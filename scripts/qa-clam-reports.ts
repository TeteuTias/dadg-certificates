import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import ExcelJS from "exceljs";
import type { Gateway } from "../lib/selective-processes/services/gateway";
import type {
  Contract,
  GatewayPayment,
  Payer,
} from "../lib/selective-processes/domain";
import type {
  ImportKind,
  ImportRow,
  ReportKind,
} from "../lib/selective-processes/reports/types";

async function main() {
  if (
    !process.argv.includes("--approved") ||
    process.env.CLAM_RECOVERABLE_BACKUP !== "empty-baseline"
  ) {
    throw new Error(
      "Explicit approval and recoverable empty-baseline confirmation required.",
    );
  }
  // Never load .env or reuse any existing connection, database directory, credentials, or URI.
  delete process.env.MONGODB_URI;
  delete process.env.MONGODB_DB;
  process.env.PROFILE_CPF_ACTIVE_KEY_VERSION = "QA";
  process.env.PROFILE_CPF_ENCRYPTION_KEY_QA = Buffer.alloc(32, 7).toString(
    "base64",
  );
  process.env.PROFILE_CPF_LOOKUP_KEY = Buffer.alloc(32, 8).toString("base64");
  const directory = resolve(".cache/clam-reports-integration", randomUUID());
  const output = resolve(".cache/clam-report-samples");
  mkdirSync(directory + "/db", { recursive: true });
  mkdirSync(output, { recursive: true });
  const database = "clam_reports_integration_test";
  writeFileSync(
    directory + "/backup-empty.json",
    JSON.stringify(
      {
        database,
        collections: [],
        restore:
          "Recreate an empty local database, then rerun this reproducible fixture.",
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  mongoose.set("autoIndex", false);
  mongoose.set("autoCreate", false);
  const mongo = await MongoMemoryReplSet.create({
    instanceOpts: [{ dbPath: directory + "/db", port: 27020 }],
    replSet: {
      count: 1,
      ip: "127.0.0.1",
      name: "clam_reports_qa",
      storageEngine: "wiredTiger",
    },
  });
  let passed = 0;
  try {
    const uri = mongo.getUri(database);
    assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri, {
      dbName: database,
      autoIndex: false,
      autoCreate: false,
    });
    assert.equal(mongoose.connection.name, database);
    global.mongoose = { conn: mongoose, promise: Promise.resolve(mongoose) };
    const { prepareClamStorage } =
      await import("../lib/selective-processes/maintenance");
    const { checkout, reconcileSession } =
      await import("../lib/selective-processes/services/checkout");
    const { selectLeaguesForApplication } =
      await import("../lib/selective-processes/services/studentSelectiveProcesses");
    const { deleteExamForProcess, updateScores } =
      await import("../lib/selective-processes/services/selectiveProcesses");
    const { requireCandidateProfile } =
      await import("../lib/selective-processes/candidate-profile");
    const {
      readReport,
      summarize,
      confirmImport,
      saveReportSettings,
      ReportAudit,
    } = await import("../lib/selective-processes/reports/service");
    const { previewImport } =
      await import("../lib/selective-processes/reports/rules");
    const { exportWorkbook, importTemplate, parseWorkbook } =
      await import("../lib/selective-processes/reports/workbooks");
    const { saveOwnProfile } = await import("../lib/profile/service");
    const { validateProfileInput } = await import("../lib/profile/validation");
    const { PROFILE_PRIVACY_NOTICE_VERSION } =
      await import("../lib/profile/privacy-notice");
    const { SelectionProcess } =
      await import("../lib/selective-processes/models/SelectionProcessModel");
    const { Exam } =
      await import("../lib/selective-processes/models/ExamModel");
    const { PricingTier } =
      await import("../lib/selective-processes/models/PricingTierModel");
    const { Application } =
      await import("../lib/selective-processes/models/ApplicationModel");
    const { PaymentSession } =
      await import("../lib/selective-processes/models/PaymentSessionModel");
    const { Reservation } =
      await import("../lib/selective-processes/models/ReservationModel");
    const { Ticket } =
      await import("../lib/selective-processes/models/TicketModel");
    const { default: Profile } = await import("../lib/models/UserProfileModel");
    const { default: ProfileAudit } =
      await import("../lib/models/ProfileAuditModel");
    const { default: Acceptance } =
      await import("../lib/models/PrivacyAcceptanceModel");
    assert.deepEqual((await prepareClamStorage(true)).duplicateIndexes, []);
    for (const model of [Profile, ProfileAudit, Acceptance, ReportAudit]) {
      await model.createCollection();
      await model.createIndexes();
    }
    const collections = (
      await mongoose.connection
        .db!.listCollections({}, { nameOnly: true })
        .toArray()
    )
      .map((c) => c.name)
      .sort();
    assert.deepEqual(
      collections,
      [
        "selectionprocesses",
        "exams",
        "pricingtiers",
        "paymentsessions",
        "paymentattributions",
        "applications",
        "tickets",
        "applicationleagueselections",
        "clam_reservations",
        "users.profiles",
        "users.profileAudit",
        "users.privacyAcceptances",
        "clam_report_audit",
      ].sort(),
    );
    class FakeGateway implements Gateway {
      contracts = new Map<string, Contract>();
      ledger = new Map<string, GatewayPayment[]>();
      prefs = new Map<string, Awaited<ReturnType<Gateway["create"]>>>();
      async create(
        ref: string,
        contract: Contract,
        _payer: Payer,
        expires: Date,
      ) {
        this.contracts.set(ref, contract);
        const pref = {
          id: randomUUID(),
          init_point: "https://example.invalid/" + ref,
          external_reference: ref,
          expires: true,
          expiration_date_to: expires.toISOString(),
        };
        this.prefs.set(ref, pref);
        return pref;
      }
      async findPreference(ref: string) {
        return this.prefs.get(ref) || null;
      }
      async payments(ref: string) {
        return structuredClone(this.ledger.get(ref) || []);
      }
      async paymentReference(id: string) {
        return (
          [...this.ledger.values()].flat().find((p) => p.id === id)
            ?.reference || ""
        );
      }
      async close(_id: string, ref: string) {
        return this.payments(ref);
      }
      approve(ref: string, status = "approved", refundedCents = 0) {
        this.ledger.set(ref, [
          {
            id: "qa-" + ref,
            reference: ref,
            status,
            amountCents: this.contracts.get(ref)!.amountCents,
            currency: "BRL",
            refundedCents,
            updatedAt: new Date().toISOString(),
          },
        ]);
      }
    }
    const g = new FakeGateway();
    const actor = "https://qa.example.invalid/|auth0|administrator";
    const payer: Payer = {
      name: "Pagador Diferente",
      cpf: "52998224725",
      zipCode: "38440000",
      street: "Rua Fictícia",
      number: "1",
      neighborhood: "Teste",
      complement: "",
      phone: "34999999999",
      email: "pagador@example.invalid",
    };
    const selectionProcess = await SelectionProcess.create({
      registrationStartDate: new Date(Date.now() - 60000),
      registrationEndDate: new Date(Date.now() + 3600000),
      maxCapacity: 20,
      maxExamsPerApplication: 4,
    });
    const processId = String(selectionProcess._id);
    const exams = await Exam.insertMany(
      [
        {
          name: "Liga Acadêmica de Patologia",
          acronym: "LAPA",
          seats: 2,
          examStartDate: "2026-10-02T02:30:00Z",
          examEndDate: "2026-10-02T03:30:00Z",
        },
        {
          name: "Liga Acadêmica de Cardiologia",
          acronym: "LAC",
          seats: null,
          examStartDate: "2026-10-02T15:00:00Z",
          examEndDate: "2026-10-02T16:00:00Z",
        },
        {
          name: "Liga Acadêmica de Neurologia",
          acronym: "LAN",
          seats: 0,
          examStartDate: "2026-10-02T15:00:00Z",
          examEndDate: "2026-10-02T16:00:00Z",
        },
      ].map((e) => ({
        ...e,
        selectionProcessId: selectionProcess._id,
        questionCount: 15,
      })),
    );
    const examIds = exams.map((e) => String(e._id));
    await PricingTier.create({
      selectionProcessId: selectionProcess._id,
      examsCount: 1,
      unitTotalPrice: 10,
    });
    let personIndex = 0;
    async function participant(
      name: string,
      choices: number[] = [],
      paid = true,
    ) {
      const index = ++personIndex;
      const userId = String(new mongoose.Types.ObjectId());
      const identity = {
        authIssuer: "https://qa.example.invalid/",
        authSubject: "auth0|" + userId,
      };
      const token = { iss: identity.authIssuer, sub: identity.authSubject };
      let fakeCpf = String(index).padStart(9, "0");
      for (const length of [9, 10]) {
        const sum = [...fakeCpf].reduce(
          (total, digit, position) =>
            total + Number(digit) * (length + 1 - position),
          0,
        );
        const remainder = (sum * 10) % 11;
        fakeCpf += String(remainder === 10 ? 0 : remainder);
      }
      const data = {
        name,
        cpf: fakeCpf,
        period: (index % 12) + 1,
        registrationNumber: "000" + String(index).padStart(3, "0"),
        birthDate: "2002-03-04",
        phone: "349999900" + String(index).padStart(2, "0"),
        contactEmail: `participante${index}@example.invalid`,
      };
      assert.deepEqual(validateProfileInput(data).errors, {});
      await saveOwnProfile({
        identity,
        data,
        privacyAccepted: true,
        noticeVersion: PROFILE_PRIVACY_NOTICE_VERSION,
      });
      const profile = await requireCandidateProfile(token);
      const session = await checkout(
        {
          processId,
          userId,
          examsCount: Math.max(choices.length, 1),
          payer,
          candidateProfileId: String(profile._id),
          operationKey: randomUUID(),
        },
        g,
      );
      if (paid) {
        g.approve(session.sessionId);
        await reconcileSession(session.sessionId, g);
        if (choices.length)
          await selectLeaguesForApplication({
            selectionProcessId: processId,
            userId,
            candidateProfileId: String(profile._id),
            examIds: choices.map((i) => examIds[i]),
          });
      }
      const app = await Application.findOne({ userId });
      return {
        userId,
        identity,
        token,
        data,
        profile,
        session,
        appId: app ? String(app._id) : "",
      };
    }
    const code = (expected: string) => (error: unknown) =>
      (error as { code?: string }).code === expected;
    async function check(name: string, fn: () => Promise<void>) {
      await fn();
      passed++;
      console.log("PASS " + name);
    }
    const row = (
      applicationId: string,
      registrationNumber: string,
      examId: string,
      value: unknown,
    ): ImportRow => ({
      sheet: "Correção",
      row: 2,
      applicationId,
      registrationNumber,
      examId,
      value,
    });
    async function request(kind: ImportKind, rows: ImportRow[]) {
      const snapshot = await readReport(processId);
      return {
        processId,
        actor,
        kind,
        rows,
        operationId: randomUUID(),
        previewHash: previewImport(snapshot, kind, rows).hash,
      };
    }
    await check(
      "incomplete profile rejects with 428; issuer identity is enforced",
      async () => {
        await assert.rejects(
          requireCandidateProfile({
            iss: "https://qa.example.invalid/",
            sub: "auth0|absent",
          }),
          (e) =>
            code("PROFILE_INCOMPLETE")(e) &&
            (e as { status?: number }).status === 428,
        );
      },
    );
    const ana = await participant("Ana Clara de Teste", [0, 1]);
    const bruno = await participant("Bruno de Teste");
    const carla = await participant("Carla de Teste", [0, 2]);
    await participant("Ana Clara de Teste", [1]);
    await participant("Pagamento Pendente", [], false);
    const refunded = await participant("Pagamento Estornado", [0]);
    g.approve(refunded.session.sessionId, "refunded", 1000);
    await reconcileSession(refunded.session.sessionId, g);
    const review = await participant("Pagamento Em Revisão", [0]);
    await Reservation.updateOne(
      { userId: review.userId },
      { $set: { reviewReason: "QA_PARTIAL_REFUND" } },
    );
    await check(
      "only paid active rights; no-choice included; payer never identifies candidate",
      async () => {
        const snapshot = await readReport(processId);
        assert.equal(snapshot.candidates.length, 4);
        assert.equal(summarize(snapshot).pendingChoices, 1);
        assert.equal(
          snapshot.candidates.find((c) => c.id === ana.appId)
            ?.registrationNumber,
          "000001",
        );
        assert.equal(
          snapshot.candidates.find((c) => c.id === ana.appId)?.scores[
            examIds[0]
          ],
          null,
        );
        assert.ok(
          snapshot.candidates.every(
            (c) => c.name !== payer.name && c.contactEmail !== payer.email,
          ),
        );
        assert.equal(snapshot.exams[0].date, "2026-10-01");
        assert.equal(snapshot.exams[1].date, "2026-10-02");
        assert.ok(snapshot.candidates.some((c) => c.id === bruno.appId));
        await assert.rejects(
          requireCandidateProfile({
            ...ana.token,
            iss: "https://another.example.invalid/",
          }),
          code("PROFILE_INCOMPLETE"),
        );
      },
    );
    await check(
      "current profile changes exported and audited; missing fields visible",
      async () => {
        await saveOwnProfile({
          identity: ana.identity,
          data: {
            ...ana.data,
            name: "Ana Clara de Teste Atualizada",
            contactEmail: "ana.atualizada@example.invalid",
          },
          privacyAccepted: false,
        });
        assert.equal(
          (await readReport(processId)).candidates.find(
            (c) => c.id === ana.appId,
          )?.contactEmail,
          "ana.atualizada@example.invalid",
        );
        assert.ok(
          await ProfileAudit.exists({
            profileId: ana.profile._id,
            changedFields: "contactEmail",
          }),
        );
        await Profile.updateOne(
          { _id: bruno.profile._id },
          { $unset: { phone: 1 } },
        );
        assert.ok(
          summarize(await readReport(processId))
            .missingProfiles.find((p) => p.applicationId === bruno.appId)
            ?.missingFields.includes("phone"),
        );
        await assert.rejects(
          requireCandidateProfile(bruno.token),
          code("PROFILE_INCOMPLETE"),
        );
        await Profile.updateOne(
          { _id: bruno.profile._id },
          { $set: { phone: bruno.data.phone } },
        );
      },
    );
    await check(
      "zero valid; legacy uncorrected zero remains blank; duplicate confirmation idempotent",
      async () => {
        await Application.updateOne(
          { _id: ana.appId },
          { $set: { "scores.0.scoreValue": 0 } },
        );
        assert.equal(
          (await readReport(processId)).candidates.find(
            (c) => c.id === ana.appId,
          )?.scores[examIds[0]],
          null,
        );
        const args = await request("scores", [
          row(ana.appId, ana.data.registrationNumber, examIds[0], 0),
        ]);
        const [a, b] = await Promise.all([
          confirmImport(args),
          confirmImport(args),
        ]);
        assert.deepEqual(a, b);
        assert.equal(await ReportAudit.countDocuments({ kind: "scores" }), 1);
        assert.equal(
          (await readReport(processId)).candidates.find(
            (c) => c.id === ana.appId,
          )?.scores[examIds[0]],
          0,
        );
        await assert.rejects(
          confirmImport({ ...args, rows: [{ ...args.rows[0], value: 1 }] }),
          code("IDEMPOTENCY_CONFLICT"),
        );
      },
    );
    await check("invalid whole import does not partially write", async () => {
      const args = await request("scores", [
        row(ana.appId, ana.data.registrationNumber, examIds[0], 3),
        {
          ...row(carla.appId, carla.data.registrationNumber, examIds[0], 16),
          row: 3,
        },
      ]);
      await assert.rejects(confirmImport(args), code("IMPORT_HAS_ERRORS"));
      assert.equal(
        (await readReport(processId)).candidates.find((c) => c.id === ana.appId)
          ?.scores[examIds[0]],
        0,
      );
    });
    await check(
      "profile edit after preview requires fresh preview",
      async () => {
        const args = await request("scores", [
          row(ana.appId, ana.data.registrationNumber, examIds[0], 4),
        ]);
        await Profile.updateOne(
          { _id: ana.profile._id },
          { $set: { period: 7 } },
        );
        await assert.rejects(confirmImport(args), code("IMPORT_PREVIEW_STALE"));
      },
    );
    await check(
      "failure after score writes rolls back every note and revision",
      async () => {
        const before = await readReport(processId);
        const args = await request("scores", [
          row(ana.appId, ana.data.registrationNumber, examIds[0], 4),
        ]);
        const original = ReportAudit.create;
        ReportAudit.create = (async () => {
          throw new Error("QA_AUDIT_FAILURE");
        }) as typeof ReportAudit.create;
        try {
          await assert.rejects(confirmImport(args), /QA_AUDIT_FAILURE/);
        } finally {
          ReportAudit.create = original;
        }
        const after = await readReport(processId);
        assert.equal(after.revision, before.revision);
        assert.deepEqual(after.candidates, before.candidates);
      },
    );
    await check(
      "concurrent different corrections from one preview only save once",
      async () => {
        const args = await request("scores", [
          row(carla.appId, carla.data.registrationNumber, examIds[0], 15),
        ]);
        const results = await Promise.allSettled([
          confirmImport(args),
          confirmImport({ ...args, operationId: randomUUID() }),
        ]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        assert.ok(
          results.some(
            (r) =>
              r.status === "rejected" && code("IMPORT_PREVIEW_STALE")(r.reason),
          ),
        );
      },
    );
    await check("manual scores share integer bounds and audit", async () => {
      await assert.rejects(
        updateScores({
          applicationId: ana.appId,
          actor,
          scores: [{ examId: examIds[1], scoreValue: 1.5 }],
        }),
        code("INVALID_SCORES"),
      );
      await updateScores({
        applicationId: ana.appId,
        actor,
        scores: [{ examId: examIds[1], scoreValue: 12 }],
      });
      assert.equal(
        (await readReport(processId)).candidates.find((c) => c.id === ana.appId)
          ?.scores[examIds[1]],
        12,
      );
    });
    await check(
      "days and seats import atomic; calendar and financial capacity preserved",
      async () => {
        const before = await SelectionProcess.findById(processId).lean();
        const start = exams[0].examStartDate;
        await confirmImport(
          await request(
            "days",
            examIds.map((id, i) => ({
              sheet: "Dias",
              row: i + 2,
              league: id,
              value: i ? 2 : 1,
            })),
          ),
        );
        await confirmImport(
          await request("seats", [
            { sheet: "Vagas", row: 2, league: "LAPA", value: 2 },
          ]),
        );
        assert.equal((await readReport(processId)).config.mode, "file");
        assert.equal(
          (await Exam.findById(examIds[0]))!.examStartDate.toISOString(),
          new Date(start).toISOString(),
        );
        assert.equal(
          (await SelectionProcess.findById(processId))!.allocatedCount,
          before!.allocatedCount,
        );
        assert.equal(
          (await SelectionProcess.findById(processId))!.maxCapacity,
          before!.maxCapacity,
        );
        const snapshot = await readReport(processId);
        const settings = {
          revision: snapshot.revision,
          config: snapshot.config,
          exams: snapshot.exams.map((e) => ({
            id: e.id,
            acronym: e.acronym,
            seats: e.seats,
            questionCount: e.questionCount,
          })),
        };
        await assert.rejects(
          saveReportSettings(processId, actor, {
            ...settings,
            exams: settings.exams.map((e) => ({ ...e, acronym: "DUPLICADA" })),
          }),
          code("DUPLICATE_OR_INVALID_ACRONYM"),
        );
        await assert.rejects(
          saveReportSettings(processId, actor, {
            ...settings,
            exams: settings.exams.map((e) => ({ ...e, questionCount: 5 })),
          }),
          code("QUESTION_COUNT_BELOW_SCORES"),
        );
        await saveReportSettings(processId, actor, settings);
      },
    );
    await check(
      "review or refund after preview removes score eligibility",
      async () => {
        const args = await request("scores", [
          row(ana.appId, ana.data.registrationNumber, examIds[0], 4),
        ]);
        await PaymentSession.updateOne(
          { _id: ana.session.sessionId },
          { $set: { reviewReason: "QA_REVIEW" } },
        );
        await assert.rejects(confirmImport(args), code("IMPORT_HAS_ERRORS"));
        await PaymentSession.updateOne(
          { _id: ana.session.sessionId },
          { $unset: { reviewReason: 1 } },
        );
      },
    );
    await check(
      "XLSX samples generated from real local Mongo snapshot and reopened",
      async () => {
        const snapshot = await readReport(processId);
        const names: Record<ReportKind, string> = {
          all: "01-todas-inscricoes",
          day1: "02-provas-dia-1",
          day2: "03-provas-dia-2",
          counts: "04-inscritos-por-liga",
          registrations: "05-matriculas-por-prova",
          scores: "06-correcao-todas-ligas",
        };
        for (const kind of Object.keys(names) as ReportKind[]) {
          const bytes = await exportWorkbook(snapshot, kind);
          writeFileSync(`${output}/${names[kind]}.xlsx`, bytes);
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(bytes as never);
          assert.ok(wb.worksheets.length);
          for (const ws of wb.worksheets) {
            assert.equal(ws.views[0].state, "frozen");
            assert.ok(ws.autoFilter);
          }
          if (kind === "all") {
            assert.equal(wb.worksheets[0].rowCount, 5);
            assert.equal(
              wb.worksheets[0].getCell("C2").type,
              ExcelJS.ValueType.String,
            );
            assert.equal(wb.worksheets[0].getCell("C2").numFmt, "@");
          }
          if (kind === "scores") {
            assert.equal(wb.worksheets[0].getColumn(6).hidden, true);
            assert.equal(
              previewImport(
                snapshot,
                "scores",
                await parseWorkbook(bytes, "scores", processId),
              ).changes.length,
              0,
            );
          }
        }
        for (const e of snapshot.exams)
          writeFileSync(
            `${output}/07-correcao-${e.acronym}.xlsx`,
            await exportWorkbook(snapshot, "scores", e.id),
          );
        for (const kind of ["days", "seats"] as const)
          writeFileSync(
            `${output}/modelo-${kind}.xlsx`,
            await importTemplate(snapshot, kind),
          );
        writeFileSync(
          `${output}/LEIA-ME.txt`,
          "AMOSTRAS FICTÍCIAS — geradas exclusivamente do Mongo descartável local.\nNenhum dado de produção foi utilizado.\nOs nomes repetidos pertencem a matrículas diferentes. Notas vazias não foram corrigidas; zero é válido.\nVagas: LAPA = 2; LAC não informadas; LAN = 0.\nOs arquivos de correção incluem identificadores ocultos. Preserve essas colunas para importar.\n",
        );
      },
    );
    await check(
      "deleted league removes its score and choice without reducing paid allowance",
      async () => {
        const allowance = (await Ticket.findOne({ applicationId: ana.appId }))!
          .leagueAllowanceCount;
        await deleteExamForProcess(processId, examIds[0]);
        const snapshot = await readReport(processId);
        assert.ok(
          !snapshot.candidates
            .find((c) => c.id === ana.appId)
            ?.examIds.includes(examIds[0]),
        );
        assert.equal(
          (await Ticket.findOne({ applicationId: ana.appId }))!
            .leagueAllowanceCount,
          allowance,
        );
      },
    );
    writeFileSync(
      directory + "/result.json",
      JSON.stringify(
        {
          passed,
          database,
          collections,
          output,
          provider: "simulated",
          productionAccess: false,
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({ passed, output, preservedDatabaseDirectory: directory }),
    );
  } finally {
    await mongoose.disconnect();
    await mongo.stop({ doCleanup: false, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
