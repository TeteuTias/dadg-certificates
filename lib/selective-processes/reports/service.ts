import mongoose, { type ClientSession, Schema } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import UserProfile from "@/lib/models/UserProfileModel";
import { decryptCpf } from "@/lib/profile/crypto";
import { missingClamFields, onlyDigits } from "@/lib/profile/validation";
import { SelectionProcess } from "../models/SelectionProcessModel";
import { Application } from "../models/ApplicationModel";
import { Ticket } from "../models/TicketModel";
import { Reservation } from "../models/ReservationModel";
import { PaymentSession } from "../models/PaymentSessionModel";
import { ApplicationLeagueSelection } from "../models/ApplicationLeagueSelectionModel";
import { Exam } from "../models/ExamModel";
import { ClamError } from "../domain";
import { digest, examDate, previewImport } from "./rules";
import type { ImportKind, ImportRow, ReportSnapshot } from "./types";

type Audit = {
  _id: string;
  processId: string;
  actor: string;
  kind: string;
  requestHash: string;
  result: unknown;
  changes: unknown[];
  createdAt: Date;
};
const auditSchema = new Schema<Audit>(
  {
    _id: String,
    processId: String,
    actor: String,
    kind: String,
    requestHash: String,
    result: Schema.Types.Mixed,
    changes: [Schema.Types.Mixed],
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "clam_report_audit", autoIndex: false, autoCreate: false },
);
export const ReportAudit =
  (mongoose.models.ClamReportAudit as mongoose.Model<Audit>) ||
  mongoose.model<Audit>("ClamReportAudit", auditSchema);

export async function reportSnapshot(
  processId: string,
  session: ClientSession,
): Promise<ReportSnapshot> {
  if (!mongoose.isValidObjectId(processId))
    throw new ClamError("INVALID_PROCESS", 400);
  const process = await SelectionProcess.findById(processId)
    .session(session)
    .lean();
  if (!process) throw new ClamError("PROCESS_NOT_FOUND", 404);
  const exams = await Exam.find({ selectionProcessId: processId })
    .sort({ examStartDate: 1, name: 1 })
    .session(session)
    .lean();
  const applications = await Application.find({ selectionProcessId: processId })
    .sort({ _id: 1 })
    .session(session)
    .lean();
  const tickets = await Ticket.find({
    selectionProcessId: processId,
    paymentStatus: "PAID",
  })
    .session(session)
    .lean();
  const reservations = await Reservation.find({
    selectionProcessId: processId,
    state: "PAID",
    reviewReason: { $in: [null, ""] },
  })
    .session(session)
    .lean();
  const payments = await PaymentSession.find({
    edicaoId: processId,
    status: "PAID",
    reversedAt: null,
  })
    .session(session)
    .lean();
  const choices = await ApplicationLeagueSelection.find({
    selectionProcessId: processId,
  })
    .session(session)
    .lean();
  const profiles = await UserProfile.find({
    _id: { $in: applications.map((a) => a.candidateProfileId).filter(Boolean) },
  })
    .session(session)
    .lean();
  const dates = [
    ...new Set(exams.map((e) => examDate(e.examStartDate))),
  ].sort();
  const snapshot: ReportSnapshot = {
    processId,
    revision: process.revision || 0,
    generatedAt: new Date().toISOString(),
    config: {
      mode: process.reportConfig?.mode || "dates",
      day1: process.reportConfig?.day1 ?? dates[0] ?? "",
      day2: process.reportConfig?.day2 ?? dates[1] ?? "",
    },
    exams: exams.map((e) => ({
      id: String(e._id),
      name: e.name,
      acronym: e.acronym || "",
      date: examDate(e.examStartDate),
      seats: e.seats ?? null,
      questionCount: e.questionCount ?? 15,
      reportDay: e.reportDay ?? null,
    })),
    candidates: [],
  };
  const ticketByApplication = new Map(
    tickets.map((t) => [String(t.applicationId), t]),
  );
  const paymentById = new Map(payments.map((p) => [String(p._id), p]));
  const reservationByPayment = new Map(
    reservations.map((r) => [String(r.activeSessionId), r]),
  );
  const profileById = new Map(profiles.map((p) => [String(p._id), p]));
  const examIdsInProcess = new Set(snapshot.exams.map((e) => e.id));
  const choicesByApplication = new Map<string, Set<string>>();
  for (const choice of choices) {
    const key = String(choice.applicationId);
    if (!choicesByApplication.has(key))
      choicesByApplication.set(key, new Set());
    choicesByApplication.get(key)!.add(String(choice.examId));
  }
  for (const app of applications) {
    const ticket = ticketByApplication.get(String(app._id));
    const payment = ticket && paymentById.get(String(ticket.paymentSessionId));
    const reservation =
      payment && reservationByPayment.get(String(payment._id));
    if (
      !ticket ||
      !payment ||
      !reservation ||
      String(reservation.userId) !== String(app.userId) ||
      reservation.reviewReason ||
      payment.reviewReason
    )
      continue;
    const linkedProfile = profileById.get(String(app.candidateProfileId));
    const profile =
      linkedProfile?.authSubject.split("|").pop() === String(app.userId)
        ? linkedProfile
        : undefined;
    const missing = missingClamFields(profile || null);
    let cpf = "";
    if (profile?.cpfEncrypted) {
      try {
        cpf = decryptCpf(profile.cpfEncrypted);
      } catch {
        if (!missing.includes("cpf")) missing.push("cpf");
      }
    }
    const examIds = [...(choicesByApplication.get(String(app._id)) || [])]
      .filter(
        (id) => app.exams.map(String).includes(id) && examIdsInProcess.has(id),
      )
      .sort();
    const scores = Object.fromEntries(
      examIds.map((id) => {
        const score = app.scores.find((s) => String(s.examId) === id);
        return [
          id,
          score?.updatedAt && typeof score.scoreValue === "number"
            ? score.scoreValue
            : null,
        ];
      }),
    );
    snapshot.candidates.push({
      id: String(app._id),
      profileId: profile ? String(profile._id) : "",
      name: profile?.name || `Cadastro pendente (${String(app._id).slice(-6)})`,
      registrationNumber: onlyDigits(profile?.registrationNumber || ""),
      birthDate: profile?.birthDate || "",
      period: profile?.period ?? null,
      phone: onlyDigits(profile?.phone || ""),
      contactEmail: profile?.contactEmail || "",
      cpf,
      missingFields: missing,
      examIds,
      scores,
    });
  }
  return snapshot;
}
export async function readReport(processId: string) {
  await connectToDatabase();
  return mongoose.connection.transaction(
    (session) => reportSnapshot(processId, session),
    { readConcern: { level: "snapshot" } },
  );
}
export function summarize(snapshot: ReportSnapshot) {
  const registrationCounts = new Map<string, number>();
  for (const candidate of snapshot.candidates)
    if (candidate.registrationNumber)
      registrationCounts.set(
        candidate.registrationNumber,
        (registrationCounts.get(candidate.registrationNumber) || 0) + 1,
      );
  const duplicateRegistrations = [...registrationCounts]
    .filter(([, count]) => count > 1)
    .map(([registration]) => registration);
  return {
    processId: snapshot.processId,
    generatedAt: snapshot.generatedAt,
    revision: snapshot.revision,
    config: snapshot.config,
    exams: snapshot.exams,
    total: snapshot.candidates.length,
    pendingChoices: snapshot.candidates.filter((c) => !c.examIds.length).length,
    missingProfiles: snapshot.candidates
      .filter((c) => c.missingFields.length)
      .map((c) => ({
        applicationId: c.id,
        name: c.name,
        missingFields: c.missingFields,
      })),
    duplicateRegistrations,
    counts: snapshot.exams.map((e) => ({
      examId: e.id,
      count: snapshot.candidates.filter((c) => c.examIds.includes(e.id)).length,
    })),
  };
}
async function ensureAuditStorage() {
  const exists = await mongoose.connection
    .db!.listCollections({ name: "clam_report_audit" }, { nameOnly: true })
    .toArray();
  if (!exists.length) throw new ClamError("REPORT_STORAGE_SETUP_REQUIRED", 503);
}
async function lockProcess(processId: string, session: ClientSession) {
  const updated = await SelectionProcess.updateOne(
    { _id: processId },
    { $inc: { revision: 1 } },
    { session },
  );
  if (!updated.matchedCount) throw new ClamError("PROCESS_NOT_FOUND", 404);
}
export async function confirmImport(args: {
  processId: string;
  actor: string;
  kind: ImportKind;
  rows: ImportRow[];
  previewHash: string;
  operationId: string;
}) {
  await connectToDatabase();
  await ensureAuditStorage();
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(args.operationId))
    throw new ClamError("INVALID_IDEMPOTENCY_KEY", 400);
  const id = digest([args.processId, args.actor, args.operationId]);
  const requestHash = digest([args.kind, args.rows, args.previewHash]);
  return mongoose.connection.transaction(
    async (session) => {
      const existing = await ReportAudit.findById(id).session(session).lean();
      if (existing) {
        if (existing.requestHash !== requestHash)
          throw new ClamError("IDEMPOTENCY_CONFLICT");
        return existing.result;
      }
      const snapshot = await reportSnapshot(args.processId, session);
      const preview = previewImport(snapshot, args.kind, args.rows);
      if (preview.errors.length) throw new ClamError("IMPORT_HAS_ERRORS", 400);
      if (!args.previewHash || args.previewHash !== preview.hash)
        throw new ClamError("IMPORT_PREVIEW_STALE");
      await lockProcess(args.processId, session);
      // Fence profile edits as well as process/payment/choice changes during confirmation.
      for (const candidate of snapshot.candidates.filter((c) =>
        preview.changes.some((change) => change.applicationId === c.id),
      )) {
        const fenced = await UserProfile.updateOne(
          {
            _id: candidate.profileId,
            registrationNumber: candidate.registrationNumber,
          },
          { $inc: { __v: 1 } },
          { session, timestamps: false },
        );
        if (fenced.matchedCount !== 1)
          throw new ClamError("IMPORT_PREVIEW_STALE");
        const ticket = await Ticket.findOneAndUpdate(
          { applicationId: candidate.id, paymentStatus: "PAID" },
          { $inc: { __v: 1 } },
          { session, timestamps: false },
        );
        if (!ticket) throw new ClamError("IMPORT_PREVIEW_STALE");
        const payment = await PaymentSession.updateOne(
          { _id: ticket.paymentSessionId, status: "PAID", reversedAt: null },
          { $inc: { __v: 1 } },
          { session, timestamps: false },
        );
        const reservation = await Reservation.updateOne(
          {
            selectionProcessId: args.processId,
            activeSessionId: ticket.paymentSessionId,
            state: "PAID",
          },
          { $inc: { __v: 1 } },
          { session, timestamps: false },
        );
        if (payment.matchedCount !== 1 || reservation.matchedCount !== 1)
          throw new ClamError("IMPORT_PREVIEW_STALE");
      }
      for (const change of preview.changes) {
        if (args.kind === "scores") {
          const application = await Application.findById(
            change.applicationId,
          ).session(session);
          if (!application) throw new ClamError("IMPORT_PREVIEW_STALE");
          const score = application.scores.find(
            (s) => String(s.examId) === change.examId,
          );
          if (score) {
            score.scoreValue = change.after;
            score.updatedAt = new Date();
          } else
            application.scores.push({
              examId: new mongoose.Types.ObjectId(change.examId),
              scoreValue: change.after,
              updatedAt: new Date(),
            });
          await application.save({ session });
        } else
          await Exam.updateOne(
            { _id: change.examId, selectionProcessId: args.processId },
            {
              $set:
                args.kind === "days"
                  ? { reportDay: change.after }
                  : { seats: change.after },
            },
            { session, runValidators: true },
          );
      }
      if (args.kind === "days")
        await SelectionProcess.updateOne(
          { _id: args.processId },
          { $set: { "reportConfig.mode": "file" } },
          { session },
        );
      const result = {
        applied: preview.changes.length,
        ignored: preview.ignored,
        operationId: args.operationId,
      };
      await ReportAudit.create(
        [
          {
            _id: id,
            processId: args.processId,
            actor: args.actor,
            kind: args.kind,
            requestHash,
            result,
            changes: preview.changes,
          },
        ],
        { session },
      );
      return result;
    },
    { readConcern: { level: "snapshot" } },
  );
}
export type ReportSettings = {
  revision: number;
  config: ReportSnapshot["config"];
  exams: Array<{
    id: string;
    acronym: string;
    seats: number | null;
    questionCount: number;
  }>;
};
export async function saveReportSettings(
  processId: string,
  actor: string,
  input: ReportSettings,
) {
  if (
    !input ||
    !input.config ||
    !["dates", "file"].includes(input.config.mode) ||
    !Array.isArray(input.exams) ||
    input.exams.length > 1000 ||
    !Number.isInteger(input.revision)
  )
    throw new ClamError("INVALID_REPORT_SETTINGS", 400);
  const { config } = input;
  const validDate = (value: unknown) =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(new Date(value + "T12:00:00Z").getTime()) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
  if (
    config.mode === "dates" &&
    (!validDate(config.day1) ||
      (config.day2 !== "" && !validDate(config.day2)) ||
      config.day1 === config.day2)
  )
    throw new ClamError("INVALID_REPORT_DATES", 400);
  const acronyms = new Set<string>();
  const ids = new Set<string>();
  for (const e of input.exams) {
    if (!e || typeof e.acronym !== "string" || !mongoose.isValidObjectId(e.id))
      throw new ClamError("INVALID_REPORT_SETTINGS", 400);
    e.acronym = e.acronym.trim().toUpperCase();
    if (
      e.acronym &&
      (!/^[A-Z0-9_-]{1,30}$/.test(e.acronym) || acronyms.has(e.acronym))
    )
      throw new ClamError("DUPLICATE_OR_INVALID_ACRONYM", 400);
    if (e.acronym) acronyms.add(e.acronym);
    if (
      ids.has(e.id) ||
      !Number.isInteger(e.questionCount) ||
      e.questionCount < 1 ||
      e.questionCount > 1000 ||
      (e.seats !== null && (!Number.isSafeInteger(e.seats) || e.seats < 0))
    )
      throw new ClamError("INVALID_REPORT_SETTINGS", 400);
    ids.add(e.id);
  }
  await connectToDatabase();
  await ensureAuditStorage();
  return mongoose.connection.transaction(async (session) => {
    const snapshot = await reportSnapshot(processId, session);
    if (
      snapshot.revision !== input.revision ||
      snapshot.exams.length !== input.exams.length ||
      snapshot.exams.some((e) => !ids.has(e.id))
    )
      throw new ClamError("IMPORT_PREVIEW_STALE");
    for (const exam of input.exams) {
      const incompatible = await Application.exists({
        selectionProcessId: processId,
        scores: {
          $elemMatch: {
            examId: exam.id,
            scoreValue: { $gt: exam.questionCount },
            updatedAt: { $exists: true },
          },
        },
      }).session(session);
      if (incompatible) throw new ClamError("QUESTION_COUNT_BELOW_SCORES", 400);
    }
    await lockProcess(processId, session);
    for (const e of input.exams)
      await Exam.updateOne(
        { _id: e.id, selectionProcessId: processId },
        {
          $set: {
            acronym: e.acronym || null,
            seats: e.seats,
            questionCount: e.questionCount,
          },
        },
        { session, runValidators: true },
      );
    await SelectionProcess.updateOne(
      { _id: processId },
      { $set: { reportConfig: config } },
      { session },
    );
    await ReportAudit.create(
      [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          processId,
          actor,
          kind: "settings",
          requestHash: digest(input),
          result: { saved: true },
          changes: [
            {
              before: { config: snapshot.config, exams: snapshot.exams },
              after: input,
            },
          ],
        },
      ],
      { session },
    );
    return { saved: true };
  });
}
