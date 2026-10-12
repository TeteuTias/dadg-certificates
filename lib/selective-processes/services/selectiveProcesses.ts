import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { Application, type ApplicationFinalStatus } from '../models/ApplicationModel';
import { Exam } from '../models/ExamModel';
import { ApplicationLeagueSelection } from '../models/ApplicationLeagueSelectionModel';
import { Ticket } from '../models/TicketModel';
import { PaymentSession } from '../models/PaymentSessionModel';
import { PricingTier } from '../models/PricingTierModel';
import { Reservation } from '../models/ReservationModel';
import { SelectionProcess } from '../models/SelectionProcessModel';
import { ClamError, normalizeLeagueAcronym } from '../domain';
import AcademicLeagueModel from '@/lib/models/AcademicLeagues';
export type CreateSelectionProcessInput = {
  title?: string; registrationStartDate: Date; registrationEndDate: Date; maxExamsPerApplication: number; maxCapacity: number;
};
function validProcess(input: CreateSelectionProcessInput) {
  if ((input.title !== undefined && (input.title.trim().length < 3 || input.title.trim().length > 120)) ||
    !Number.isFinite(input.registrationStartDate?.getTime()) || !Number.isFinite(input.registrationEndDate?.getTime()) ||
    input.registrationEndDate <= input.registrationStartDate || !Number.isInteger(input.maxExamsPerApplication) ||
    input.maxExamsPerApplication < 1 || input.maxExamsPerApplication > 4 ||
    !Number.isInteger(input.maxCapacity) || input.maxCapacity < 0) throw new ClamError('INVALID_PROCESS', 400);
}
export async function createSelectionProcess(input: CreateSelectionProcessInput) {
  validProcess(input); await connectToDatabase();
  const doc = await SelectionProcess.create({ ...input, title: input.title?.trim() || undefined });
  return { id: String(doc._id), ...doc.toObject() };
}
export async function listSelectionProcesses() {
  await connectToDatabase();
  return (await SelectionProcess.find({}).sort({ createdAt: -1 }).lean()).map(p => ({ id: String(p._id), ...p }));
}
export async function getSelectionProcess(id: string) {
  await connectToDatabase();
  const doc = await SelectionProcess.findById(id).lean();
  return doc ? { id: String(doc._id), ...doc, ...await getSelectionProcessOccupancy(doc._id) } : null;
}
export async function getSelectionProcessOccupancy(selectionProcessId: mongoose.Types.ObjectId) {
  const paidCount = await Ticket.countDocuments({ paymentStatus: 'PAID', selectionProcessId });
  const process = await SelectionProcess.findById(selectionProcessId).lean();
  const maxCapacity = process?.maxCapacity ?? 0;
  const allocated = Math.max(paidCount, process?.allocatedCount ?? 0);
  return { paidCount, reservedCount: Math.max(allocated - paidCount, 0), maxCapacity, remainingCapacity: Math.max(maxCapacity - allocated, 0) };
}
export async function updateSelectionProcess(id: string, input: Partial<CreateSelectionProcessInput>) {
  await connectToDatabase();
  return mongoose.connection.transaction(async session => {
    const doc = await SelectionProcess.findById(id).session(session);
    if (!doc) return null;
    if (doc.$isDefault('accountingVersion')) throw new ClamError('SELECTIVE_PROCESS_SETUP_REQUIRED', 503);
    for (const [key, value] of Object.entries(input)) if (value !== undefined) doc.set(key, key === 'title' && typeof value === 'string' ? value.trim() : value);
    validProcess(doc);
    if (doc.maxCapacity < doc.allocatedCount) throw new ClamError('CAPACITY_BELOW_ALLOCATED');
    doc.revision += 1; await doc.save({ session });
    return { id: String(doc._id), ...doc.toObject() };
  });
}
export async function deleteSelectionProcess(id: string) {
  await connectToDatabase();
  return mongoose.connection.transaction(async session => {
    const process = await SelectionProcess.findOneAndUpdate({ _id: id }, { $inc: { revision: 1 } }, { session });
    if (!process) return null;
    if (await Application.exists({ selectionProcessId: id }).session(session) ||
        await PaymentSession.exists({ edicaoId: id }).session(session) ||
        await Reservation.exists({ selectionProcessId: id, state: { $ne: 'IDLE' } }).session(session)) throw new ClamError('PROCESS_HAS_ENROLLMENTS');
    await Exam.deleteMany({ selectionProcessId: id }, { session });
    await PricingTier.deleteMany({ selectionProcessId: id }, { session });
    await Reservation.deleteMany({ selectionProcessId: id }, { session });
    await SelectionProcess.deleteOne({ _id: id }, { session });
    return { id };
  });
}
export type ExamInput = {
  source?: 'catalog' | 'custom';
  academicLeagueId?: string;
  name?: string;
  acronym?: string;
  examStartDate: Date;
  examEndDate: Date;
};
type ResolvedExamInput = {
  academicLeagueId?: mongoose.Types.ObjectId;
  name: string;
  acronym?: string;
  examStartDate: Date;
  examEndDate: Date;
};
function validExamDates(input: ExamInput) {
  if (!Number.isFinite(input.examStartDate?.getTime()) ||
      !Number.isFinite(input.examEndDate?.getTime()) || input.examEndDate <= input.examStartDate) throw new ClamError('INVALID_EXAM', 400);
}
async function resolveExamInput(input: ExamInput, session: mongoose.ClientSession): Promise<ResolvedExamInput> {
  validExamDates(input);
  if (input.source === 'catalog') {
    if (!input.academicLeagueId || !mongoose.isValidObjectId(input.academicLeagueId)) throw new ClamError('INVALID_ACADEMIC_LEAGUE', 400);
    const league = await AcademicLeagueModel.findById(input.academicLeagueId).session(session).lean();
    if (!league) throw new ClamError('ACADEMIC_LEAGUE_NOT_FOUND', 404);
    const acronym = normalizeLeagueAcronym(league.acronym);
    if (!acronym) throw new ClamError('INVALID_ACADEMIC_LEAGUE', 422);
    return {
      academicLeagueId: new mongoose.Types.ObjectId(input.academicLeagueId),
      name: league.name.trim(),
      acronym,
      examStartDate: input.examStartDate,
      examEndDate: input.examEndDate,
    };
  }
  const name = input.name?.trim();
  const acronym = normalizeLeagueAcronym(input.acronym);
  if (!name || name.length > 200 || (input.source === 'custom' && !acronym)) throw new ClamError('INVALID_EXAM', 400);
  return { name, acronym, examStartDate: input.examStartDate, examEndDate: input.examEndDate };
}
async function ensureExamUnique(selectionProcessId: string, input: ResolvedExamInput, session: mongoose.ClientSession, exceptId?: string) {
  const alternatives: Record<string, unknown>[] = [];
  if (input.academicLeagueId) alternatives.push({ academicLeagueId: input.academicLeagueId });
  if (input.acronym) alternatives.push({ acronym: input.acronym });
  if (!alternatives.length) alternatives.push({ name: input.name });
  const duplicate = await Exam.exists({
    selectionProcessId,
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
    $or: alternatives,
  }).session(session);
  if (duplicate) throw new ClamError('DUPLICATE_EXAM', 409);
}
export async function createExamForProcess(selectionProcessId: string, input: ExamInput) {
  validExamDates(input); await connectToDatabase();
  return mongoose.connection.transaction(async session => {
    const p = await SelectionProcess.updateOne({ _id: selectionProcessId }, { $inc: { revision: 1 } }, { session });
    if (!p.matchedCount) throw new ClamError('PROCESS_NOT_FOUND', 404);
    const resolved = await resolveExamInput(input, session);
    await ensureExamUnique(selectionProcessId, resolved, session);
    const [doc] = await Exam.create([{ selectionProcessId, ...resolved }], { session });
    return { id: String(doc._id), ...doc.toObject() };
  });
}
export async function getExamsBySelectionProcess(selectionProcessId: string) {
  await connectToDatabase();
  return (await Exam.find({ selectionProcessId }).sort({ examStartDate: 1 }).lean()).map(e => ({ id: String(e._id), ...e }));
}
export async function updateExamForProcess(selectionProcessId: string, examId: string, input: ExamInput) {
  validExamDates(input); await connectToDatabase();
  return mongoose.connection.transaction(async session => {
    await SelectionProcess.updateOne({ _id: selectionProcessId }, { $inc: { revision: 1 } }, { session });
    const resolved = await resolveExamInput(input, session);
    await ensureExamUnique(selectionProcessId, resolved, session, examId);
    const doc = await Exam.findOneAndUpdate(
      { _id: examId, selectionProcessId },
      { $set: resolved, ...(resolved.academicLeagueId ? {} : { $unset: { academicLeagueId: 1 } }) },
      { new: true, session, runValidators: true },
    ).lean();
    return doc ? { id: String(doc._id), ...doc } : null;
  });
}
export async function deleteExamForProcess(selectionProcessId: string, examId: string) {
  await connectToDatabase();
  return mongoose.connection.transaction(async session => {
    await SelectionProcess.updateOne({ _id: selectionProcessId }, { $inc: { revision: 1 } }, { session });
    const exam = await Exam.findOne({ _id: examId, selectionProcessId }).session(session);
    if (!exam) return null;
    const id = new mongoose.Types.ObjectId(examId);
    await Application.updateMany({ selectionProcessId, exams: id },
      { $pull: { exams: id, scores: { examId: id } } }, { session });
    await ApplicationLeagueSelection.deleteMany({ selectionProcessId, examId: id }, { session });
    // Contractual allowance remains unchanged: removing a selection returns one credit.
    await Exam.deleteOne({ _id: id, selectionProcessId }, { session });
    return { id: examId };
  });
}
export async function listApplicationsBySelectionProcess(selectionProcessId: string) {
  await connectToDatabase();
  return (await Application.find({ selectionProcessId }).sort({ createdAt: -1 }).lean()).map(a => ({ id: String(a._id), ...a }));
}
export async function updateScores(params: { applicationId: string; scores: Array<{ examId: string; scoreValue: number }>; graderUserId?: string; actor?: string }) {
  await connectToDatabase();
  const app = await Application.findById(params.applicationId).lean();
  if (!app) throw new ClamError('APPLICATION_NOT_FOUND', 404);
  if (!params.actor) throw new ClamError('NOT_AUTHORIZED', 403);
  const { readReport, confirmImport } = await import('../reports/service');
  const { previewImport } = await import('../reports/rules');
  const { randomUUID } = await import('node:crypto');
  const snapshot = await readReport(String(app.selectionProcessId));
  const candidate = snapshot.candidates.find(c => c.id === params.applicationId);
  const rows = params.scores.map((score, index) => ({ sheet: 'Lançamento manual', row: index + 1, applicationId: params.applicationId, examId: score.examId, registrationNumber: candidate?.registrationNumber || '', value: score.scoreValue }));
  const preview = previewImport(snapshot, 'scores', rows);
  if (!rows.length || preview.errors.length) throw new ClamError('INVALID_SCORES', 400);
  await confirmImport({ processId: snapshot.processId, actor: params.actor, kind: 'scores', rows, previewHash: preview.hash, operationId: randomUUID() });
  return { applicationId: params.applicationId, scores: (await Application.findById(params.applicationId).lean())?.scores || [] };
}
export async function setFinalStatus(params: { applicationId: string; finalStatus: ApplicationFinalStatus }) {
  await connectToDatabase();
  const doc = await Application.findByIdAndUpdate(params.applicationId, { $set: { finalStatus: params.finalStatus } }, { new: true, runValidators: true });
  if (!doc) throw new ClamError('APPLICATION_NOT_FOUND', 404);
  return params;
}

export async function replacePricingTiers(selectionProcessId: string, tiers: Array<{ examsCount: number; unitTotalPrice: number }>) {
  if (!tiers.length || tiers.some(t => !Number.isInteger(t.examsCount) || t.examsCount < 1 || t.examsCount > 4 ||
    !Number.isFinite(t.unitTotalPrice) || t.unitTotalPrice <= 0 || !Number.isSafeInteger(Math.round(t.unitTotalPrice * 100)))) throw new ClamError('INVALID_PRICING', 400);
  if (new Set(tiers.map(t => t.examsCount)).size !== tiers.length) throw new ClamError('DUPLICATED_EXAMS_COUNT', 400);
  await connectToDatabase();
  await mongoose.connection.transaction(async session => {
    const process = await SelectionProcess.findOneAndUpdate({ _id: selectionProcessId }, { $inc: { revision: 1 } }, { session });
    if (!process) throw new ClamError('PROCESS_NOT_FOUND', 404);
    await PricingTier.deleteMany({ selectionProcessId }, { session });
    await PricingTier.insertMany(tiers.map(tier => ({ ...tier, selectionProcessId })), { session });
  });
  return tiers;
}
