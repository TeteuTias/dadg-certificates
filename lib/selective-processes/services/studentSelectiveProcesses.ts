import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { Application } from '../models/ApplicationModel';
import { ApplicationLeagueSelection } from '../models/ApplicationLeagueSelectionModel';
import { Exam } from '../models/ExamModel';
import { Reservation, reservationKey } from '../models/ReservationModel';
import { withReservation, transaction } from './storage';
import { ClamError } from '../domain';
import { PaymentSession } from '../models/PaymentSessionModel';
import { PricingTier } from '../models/PricingTierModel';
import { SelectionProcess } from '../models/SelectionProcessModel';
import { Ticket } from '../models/TicketModel';
import { getSelectionProcessOccupancy } from './selectiveProcesses';

/**
 * Camada de leitura/escrita usada pelo site do aluno (dadg.com.br).
 * Diferente de `selectiveProcesses.ts`, aqui nada exige privilégio de admin:
 * as regras de negócio são aplicadas por processo seletivo e por usuário.
 */

export type StudentApplicationStatus =
  | 'PAYMENT_PROCESSING'
  | 'PAYMENT_REVIEW_REQUIRED'
  | 'PAYMENT_REVERSED'
  | 'REGISTRATION_NOT_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'SOLD_OUT'
  | 'NOT_REGISTERED'
  | 'PAYMENT_PENDING'
  | 'PAID_PENDING_LEAGUES'
  | 'ENROLLED';

type ProcessDocument = {
  _id: mongoose.Types.ObjectId;
  registrationStartDate: Date;
  registrationEndDate: Date;
  maxExamsPerApplication: number;
  maxCapacity: number;
  createdAt?: Date;
};

function serializeProcess(process: ProcessDocument) {
  const now = Date.now();
  const start = new Date(process.registrationStartDate).getTime();
  const end = new Date(process.registrationEndDate).getTime();

  return {
    id: String(process._id),
    registrationStartDate: process.registrationStartDate,
    registrationEndDate: process.registrationEndDate,
    maxExamsPerApplication: process.maxExamsPerApplication,
    maxCapacity: process.maxCapacity,
    hasStarted: now >= start,
    hasEnded: now > end,
    isRegistrationOpen: now >= start && now <= end,
  };
}

export async function listSelectionProcessesForStudents() {
  await connectToDatabase();

  const processes = (await SelectionProcess.find({})
    .sort({ registrationStartDate: -1 })
    .lean()) as unknown as ProcessDocument[];

  return Promise.all(
    processes.map(async (process) => {
      const [occupancy, examsCount] = await Promise.all([
        getSelectionProcessOccupancy(process._id),
        Exam.countDocuments({ selectionProcessId: process._id }),
      ]);

      return {
        ...serializeProcess(process),
        ...occupancy,
        examsCount,
      };
    }),
  );
}

export async function getSelectionProcessForStudents(selectionProcessId: string) {
  if (!mongoose.Types.ObjectId.isValid(selectionProcessId)) return null;

  await connectToDatabase();

  const process = (await SelectionProcess.findById(
    selectionProcessId,
  ).lean()) as unknown as ProcessDocument | null;
  if (!process) return null;

  const [occupancy, exams, pricingTiers] = await Promise.all([
    getSelectionProcessOccupancy(process._id),
    Exam.find({ selectionProcessId: process._id }).sort({ name: 1 }).lean() as unknown as Promise<
      Array<{ _id: mongoose.Types.ObjectId; name: string; examStartDate: Date; examEndDate: Date }>
    >,
    PricingTier.find({ selectionProcessId: process._id })
      .sort({ examsCount: 1 })
      .lean() as unknown as Promise<Array<{ examsCount: number; unitTotalPrice: number }>>,
  ]);

  return {
    ...serializeProcess(process),
    ...occupancy,
    exams: exams.map((exam) => ({
      id: String(exam._id),
      name: exam.name,
      examStartDate: exam.examStartDate,
      examEndDate: exam.examEndDate,
    })),
    pricingTiers: pricingTiers.map((tier) => ({
      examsCount: tier.examsCount,
      unitTotalPrice: tier.unitTotalPrice,
    })),
  };
}

/**
 * Preço total de uma inscrição com `examsCount` ligas.
 * Usa a faixa exata quando existe; caso contrário, multiplica a faixa de 1 liga.
 */
export function resolveTotalPrice(
  pricingTiers: Array<{ examsCount: number; unitTotalPrice: number }>,
  examsCount: number,
) {
  const exactTier = pricingTiers.find((tier) => tier.examsCount === examsCount);
  if (exactTier) return exactTier.unitTotalPrice;

  const singleTier = pricingTiers.find((tier) => tier.examsCount === 1);
  if (!singleTier) return null;

  return singleTier.unitTotalPrice * examsCount;
}

export async function getStudentApplicationState(params: { selectionProcessId: string; userId: string }) {
  const { selectionProcessId, userId } = params;
  const process = await getSelectionProcessForStudents(selectionProcessId);
  if (!process) return null;
  const application = await Application.findOne({ selectionProcessId, userId }).lean();
  const ticket = application ? await Ticket.findOne({ applicationId: application._id }).lean() : null;
  const selections = application ? await ApplicationLeagueSelection.find({ applicationId: application._id }).lean() : [];
  const reservation = await Reservation.findById(reservationKey(selectionProcessId, userId)).lean();
  const payment = reservation?.activeSessionId ? await PaymentSession.findById(reservation.activeSessionId).lean() : null;
  const legacyPayment = !reservation ? await PaymentSession.exists({ owner: userId, edicaoId: selectionProcessId }) : null;
  const allowance = ticket?.leagueAllowanceCount ?? 0;
  let status: StudentApplicationStatus;
  if (reservation?.reviewReason || legacyPayment || (!reservation && application) || ticket?.paymentStatus === 'REVIEW_REQUIRED' || payment?.status === 'REVIEW_REQUIRED') status = 'PAYMENT_REVIEW_REQUIRED';
  else if (reservation?.state === 'REVERSED' || ticket?.paymentStatus === 'CANCELED') status = 'PAYMENT_REVERSED';
  else if (ticket?.paymentStatus === 'PAID') status = selections.length < allowance ? 'PAID_PENDING_LEAGUES' : 'ENROLLED';
  else if (reservation?.firstPaidAt) status = 'PAYMENT_REVIEW_REQUIRED';
  else if (payment && ['CREATING', 'CANCELING'].includes(payment.status)) status = 'PAYMENT_PROCESSING';
  else if (payment && !payment.providerClosed) status = 'PAYMENT_PENDING';
  else if (!process.hasStarted) status = 'REGISTRATION_NOT_OPEN';
  else if (process.hasEnded) status = 'REGISTRATION_CLOSED';
  else if (process.remainingCapacity <= 0 && reservation?.state !== 'RESERVED') status = 'SOLD_OUT';
  else status = 'NOT_REGISTERED';
  return {
    process, status, canCheckout: status === 'NOT_REGISTERED' || status === 'PAYMENT_PENDING',
    canSelectLeagues: status === 'PAID_PENDING_LEAGUES',
    application: application ? { id: String(application._id), finalStatus: application.finalStatus } : null,
    ticket: ticket ? { id: String(ticket._id), paymentStatus: ticket.paymentStatus, totalAmount: ticket.totalAmount, leagueAllowanceCount: allowance } : null,
    payment: payment ? {
      sessionId: String(payment._id), init_point: status === 'PAYMENT_PENDING' && !payment.providerClosed ? payment.paymentUrl ?? null : null,
      expiresAt: payment.expiresAt, examsCount: payment.contract?.examsCount ?? null,
      totalAmount: payment.contract ? payment.contract.amountCents / 100 : null, status: payment.status,
      canReplace: status === 'PAYMENT_PENDING' && !reservation?.firstPaidAt && process.isRegistrationOpen,
    } : null,
    selectedExamIds: selections.map(selection => String((selection as unknown as { examId: mongoose.Types.ObjectId }).examId)),
    remainingSelections: Math.max(allowance - selections.length, 0),
  };
}

export class LeagueSelectionError extends ClamError {}
export async function selectLeaguesForApplication(params: { selectionProcessId: string; userId: string; examIds: string[]; candidateProfileId?: string }) {
  const { selectionProcessId, userId, examIds } = params;
  if (!mongoose.isValidObjectId(selectionProcessId) || !mongoose.isValidObjectId(userId)) throw new LeagueSelectionError('INVALID_SELECTION_PROCESS_ID', 400);
  if (!examIds.length || examIds.some(id => !mongoose.isValidObjectId(id))) throw new LeagueSelectionError('INVALID_EXAM_ID', 400);
  if (new Set(examIds).size !== examIds.length) throw new LeagueSelectionError('DUPLICATED_EXAMS', 400);
  try {
    await withReservation(selectionProcessId, userId, async lock => {
      await transaction(lock, async session => {
        const application = await Application.findOne({ selectionProcessId, userId }).session(session);
        if (!application) throw new LeagueSelectionError('APPLICATION_NOT_FOUND', 404);
        const ticket = await Ticket.findOne({ applicationId: application._id }).session(session);
        if (ticket?.paymentStatus !== 'PAID') throw new LeagueSelectionError('PAYMENT_NOT_CONFIRMED');
        // Serialize with exam edits/deletion and financial changes to the process.
        await SelectionProcess.updateOne({ _id: selectionProcessId }, { $inc: { revision: 1 } }, { session });
        const count = await Exam.countDocuments({ _id: { $in: examIds }, selectionProcessId }).session(session);
        if (count !== examIds.length) throw new LeagueSelectionError('EXAMS_INVALID_FOR_PROCESS', 400);
        const selected = await ApplicationLeagueSelection.find({ applicationId: application._id }).session(session).lean();
        const old = new Set(selected.map(s => String((s as unknown as { examId: mongoose.Types.ObjectId }).examId)));
        const fresh = examIds.filter(id => !old.has(id));
        if (!fresh.length) return; // Idempotent selection retry.
        if (selected.length + fresh.length > ticket.leagueAllowanceCount) throw new LeagueSelectionError('LEAGUE_ALLOWANCE_EXCEEDED');
        await ApplicationLeagueSelection.insertMany(fresh.map(examId => ({ applicationId: application._id, selectionProcessId, examId, lockedAt: new Date() })), { session });
        application.exams.push(...fresh.map(id => new mongoose.Types.ObjectId(id)));
        application.scores.push(...fresh.map(id => ({ examId: new mongoose.Types.ObjectId(id), scoreValue: null })));
        if (params.candidateProfileId) application.candidateProfileId = new mongoose.Types.ObjectId(params.candidateProfileId);
        await application.save({ session });
      });
    });
  } catch (error) {
    if (error instanceof ClamError) throw new LeagueSelectionError(error.code, error.status);
    throw error;
  }
  return getStudentApplicationState(params);
}
