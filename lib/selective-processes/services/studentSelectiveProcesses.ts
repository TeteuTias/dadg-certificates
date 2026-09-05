import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { Application } from '../models/ApplicationModel';
import { ApplicationLeagueSelection } from '../models/ApplicationLeagueSelectionModel';
import { Exam } from '../models/ExamModel';
import { PaymentAttribution } from '../models/PaymentAttributionModel';
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

export async function getStudentApplicationState(params: {
  selectionProcessId: string;
  userId: string;
}) {
  const { selectionProcessId, userId } = params;

  const process = await getSelectionProcessForStudents(selectionProcessId);
  if (!process) return null;

  const processObjectId = new mongoose.Types.ObjectId(selectionProcessId);
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const application = await Application.findOne({
    selectionProcessId: processObjectId,
    userId: userObjectId,
  }).lean();

  const ticket = application
    ? await Ticket.findOne({ applicationId: application._id }).lean()
    : null;

  const selections = application
    ? await ApplicationLeagueSelection.find({ applicationId: application._id }).lean()
    : [];

  const pendingAttribution = await PaymentAttribution.findOne({
    usuarioId: userObjectId,
    edicaoId: selectionProcessId,
    status: 'PAGAMENTO_PENDENTE',
  })
    .sort({ createdAt: -1 })
    .lean();

  const pendingSession = pendingAttribution
    ? ((await PaymentSession.findById(
        (pendingAttribution as unknown as { compraId: mongoose.Types.ObjectId }).compraId,
      ).lean()) as unknown as {
        _id: mongoose.Types.ObjectId;
        status: string;
        paymentUrl?: string | null;
        expiresAt: Date;
      } | null)
    : null;

  const hasValidPendingSession = Boolean(
    pendingSession &&
      pendingSession.paymentUrl &&
      new Date(pendingSession.expiresAt).getTime() > Date.now(),
  );

  const isPaid = (ticket as unknown as { paymentStatus?: string } | null)?.paymentStatus === 'PAID';
  const leagueAllowanceCount =
    (ticket as unknown as { leagueAllowanceCount?: number } | null)?.leagueAllowanceCount ?? 0;
  const remainingSelections = Math.max(leagueAllowanceCount - selections.length, 0);

  let status: StudentApplicationStatus;
  if (isPaid) {
    status = remainingSelections > 0 ? 'PAID_PENDING_LEAGUES' : 'ENROLLED';
  } else if (hasValidPendingSession) {
    status = 'PAYMENT_PENDING';
  } else if (!process.hasStarted) {
    status = 'REGISTRATION_NOT_OPEN';
  } else if (process.hasEnded) {
    status = 'REGISTRATION_CLOSED';
  } else if (process.remainingCapacity <= 0) {
    status = 'SOLD_OUT';
  } else {
    status = 'NOT_REGISTERED';
  }

  return {
    process,
    status,
    canCheckout: status === 'NOT_REGISTERED' || status === 'PAYMENT_PENDING',
    canSelectLeagues: status === 'PAID_PENDING_LEAGUES',
    application: application
      ? {
          id: String(application._id),
          finalStatus: (application as unknown as { finalStatus: string }).finalStatus,
        }
      : null,
    ticket: ticket
      ? {
          id: String((ticket as unknown as { _id: mongoose.Types.ObjectId })._id),
          paymentStatus: (ticket as unknown as { paymentStatus: string }).paymentStatus,
          totalAmount: (ticket as unknown as { totalAmount: number }).totalAmount,
          leagueAllowanceCount,
        }
      : null,
    payment: hasValidPendingSession && pendingSession
      ? {
          sessionId: String(pendingSession._id),
          init_point: pendingSession.paymentUrl,
          expiresAt: pendingSession.expiresAt,
        }
      : null,
    selectedExamIds: selections.map((selection) =>
      String((selection as unknown as { examId: mongoose.Types.ObjectId }).examId),
    ),
    remainingSelections,
  };
}

export class LeagueSelectionError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'LeagueSelectionError';
  }
}

/**
 * Registra as ligas escolhidas pelo candidato depois do pagamento confirmado.
 * As escolhas são definitivas: uma liga já travada não pode ser trocada.
 */
export async function selectLeaguesForApplication(params: {
  selectionProcessId: string;
  userId: string;
  examIds: string[];
}) {
  const { selectionProcessId, userId, examIds } = params;

  if (!mongoose.Types.ObjectId.isValid(selectionProcessId)) {
    throw new LeagueSelectionError('INVALID_SELECTION_PROCESS_ID', 400);
  }
  if (examIds.length === 0) {
    throw new LeagueSelectionError('NO_EXAMS_SELECTED', 400);
  }
  if (examIds.some((examId) => !mongoose.Types.ObjectId.isValid(examId))) {
    throw new LeagueSelectionError('INVALID_EXAM_ID', 400);
  }
  if (new Set(examIds).size !== examIds.length) {
    throw new LeagueSelectionError('DUPLICATED_EXAMS', 400);
  }

  await connectToDatabase();

  const processObjectId = new mongoose.Types.ObjectId(selectionProcessId);
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const examObjectIds = examIds.map((examId) => new mongoose.Types.ObjectId(examId));

  const application = await Application.findOne({
    selectionProcessId: processObjectId,
    userId: userObjectId,
  });
  if (!application) throw new LeagueSelectionError('APPLICATION_NOT_FOUND', 404);

  const ticket = await Ticket.findOne({ applicationId: application._id });
  const paymentStatus = ticket?.get('paymentStatus');
  if (!ticket || paymentStatus !== 'PAID') {
    throw new LeagueSelectionError('PAYMENT_NOT_CONFIRMED', 409);
  }

  const validExams = await Exam.countDocuments({
    _id: { $in: examObjectIds },
    selectionProcessId: processObjectId,
  });
  if (validExams !== examObjectIds.length) {
    throw new LeagueSelectionError('EXAMS_INVALID_FOR_PROCESS', 400);
  }

  const alreadySelected = await ApplicationLeagueSelection.find({
    applicationId: application._id,
  }).lean();
  const alreadySelectedIds = new Set(
    alreadySelected.map((selection) =>
      String((selection as unknown as { examId: mongoose.Types.ObjectId }).examId),
    ),
  );

  const newExamIds = examObjectIds.filter((examId) => !alreadySelectedIds.has(String(examId)));
  if (newExamIds.length === 0) {
    throw new LeagueSelectionError('LEAGUES_ALREADY_SELECTED', 409);
  }

  const allowance = Number(ticket.get('leagueAllowanceCount') ?? 0);
  if (alreadySelected.length + newExamIds.length > allowance) {
    throw new LeagueSelectionError('LEAGUE_ALLOWANCE_EXCEEDED', 409);
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    await ApplicationLeagueSelection.insertMany(
      newExamIds.map((examId) => ({
        applicationId: application._id,
        selectionProcessId: processObjectId,
        examId,
        lockedAt: new Date(),
      })),
      { session },
    );

    const currentExams = (application.get('exams') as mongoose.Types.ObjectId[]) ?? [];
    application.set('exams', [...currentExams, ...newExamIds]);

    const currentScores =
      (application.get('scores') as Array<{ examId: mongoose.Types.ObjectId; scoreValue: number }>) ?? [];
    application.set('scores', [
      ...currentScores,
      ...newExamIds.map((examId) => ({ examId, scoreValue: 0 })),
    ]);

    await application.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  return getStudentApplicationState({ selectionProcessId, userId });
}
