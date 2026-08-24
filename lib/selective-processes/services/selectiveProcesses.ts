import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { Application } from '../models/ApplicationModel';
import { Exam } from '../models/ExamModel';
import { PricingTier } from '../models/PricingTierModel';
import { Ticket, type TicketPaymentStatus } from '../models/TicketModel';
import {
  SelectionProcess,
} from '../models/SelectionProcessModel';
import type { ApplicationFinalStatus, IApplication } from '../models/ApplicationModel';

export type CreateSelectionProcessInput = {
  registrationStartDate: Date;
  registrationEndDate: Date;
  maxExamsPerApplication: number;
  maxCapacity: number;
};

export async function createSelectionProcess(
  input: CreateSelectionProcessInput
) {
  await connectToDatabase();
  const created = new SelectionProcess(input);
  await created.save();
  return {
    id: String(created._id),
    ...created.toObject(),
  };
}

export async function listSelectionProcesses() {
  await connectToDatabase();
  const data = await SelectionProcess.find({}).sort({ createdAt: -1 }).lean();
  return data
    .map((p) => {
      const typed = p as unknown as {
        _id: mongoose.Types.ObjectId;
        registrationStartDate: Date;
        registrationEndDate: Date;
        maxExamsPerApplication: number;
        maxCapacity: number;
        createdAt: Date;
        updatedAt: Date;
      };

      return {
        id: String(typed._id),
        registrationStartDate: typed.registrationStartDate,
        registrationEndDate: typed.registrationEndDate,
        maxExamsPerApplication: typed.maxExamsPerApplication,
        maxCapacity: typed.maxCapacity,
        createdAt: typed.createdAt,
        updatedAt: typed.updatedAt,
      };
    })
    .filter(Boolean);
}

export async function getSelectionProcess(id: string) {
  await connectToDatabase();
  const doc = await SelectionProcess.findById(id).lean();
  if (!doc) return null;

  const selectionProcessId = doc._id as mongoose.Types.ObjectId;
  const occupancy = await getSelectionProcessOccupancy(selectionProcessId);

  return {
    id: String(doc._id),
    ...doc,
    ...occupancy,
  };
}

export async function getSelectionProcessOccupancy(selectionProcessId: mongoose.Types.ObjectId) {
  const paidCount = await Ticket.countDocuments({
    paymentStatus: 'PAID',
    selectionProcessId,
  });

  const process = await SelectionProcess.findById(selectionProcessId).lean();
  const typedProcess = process as unknown as { maxCapacity?: number } | null;
  const maxCapacity = typedProcess?.maxCapacity ?? 0;

  return {
    paidCount,
    maxCapacity,
    remainingCapacity: maxCapacity - paidCount,
  };
}

export async function updateSelectionProcess(
  id: string,
  input: Partial<CreateSelectionProcessInput>
) {
  await connectToDatabase();
  const updated = await SelectionProcess.findByIdAndUpdate(id, { $set: input }, { new: true });
  if (!updated) return null;
  return { id: String(updated._id), ...updated.toObject() };
}

export async function createExamForProcess(
  selectionProcessId: string,
  input: { examStartDate: Date; examEndDate: Date }
) {
  await connectToDatabase();
  const created = new Exam({
    selectionProcessId: new mongoose.Types.ObjectId(selectionProcessId),
    examStartDate: input.examStartDate,
    examEndDate: input.examEndDate,
  });
  await created.save();
  return { id: String(created._id), ...created.toObject() };
}

export async function getExamsBySelectionProcess(selectionProcessId: string) {
  await connectToDatabase();
  const exams = await Exam.find({ selectionProcessId }).sort({ examStartDate: 1 }).lean();
  return exams.map((e) => ({ id: String(e._id), ...e }));
}

function computeTotalByPricingTiers(pricingTiers: Array<{ examsCount: number; unitTotalPrice: number }>, examsCount: number) {
  // Regra simples: usar a tier que casa exatamente com examsCount.
  // (Você pode depois estender para combos/promoção encadeada)
  const match = pricingTiers.find((t) => t.examsCount === examsCount);
  if (!match) {
    // Fallback: nenhuma tier exata => preço linear pelo unitTotalPrice de 1 prova.
    const unit = pricingTiers.find((t) => t.examsCount === 1);
    if (!unit) return 0;
    return unit.unitTotalPrice * examsCount;
  }
  return match.unitTotalPrice;
}

export async function createApplicationAndTicketMock(params: {
  selectionProcessId: string;
  userId: string;
  exams: string[];
}) {
  const { selectionProcessId, userId, exams } = params;

  await connectToDatabase();

  const selectionProcess = await SelectionProcess.findById(selectionProcessId).lean();
  if (!selectionProcess) throw new Error('SELECTION_PROCESS_NOT_FOUND');

  const typedProcess = selectionProcess as unknown as {
    maxExamsPerApplication: number;
  };

  if (exams.length > typedProcess.maxExamsPerApplication) {
    throw new Error('EXAMS_EXCEED_MAX_PER_APPLICATION');
  }

  const examDocs = await Exam.find({ _id: { $in: exams }, selectionProcessId }).select({ _id: 1 }).lean();
  if (examDocs.length !== exams.length) {
    throw new Error('EXAMS_INVALID_FOR_PROCESS');
  }

  const pricingTiers = await PricingTier.find({ selectionProcessId })
    .select({ examsCount: 1, unitTotalPrice: 1 })
    .lean();

  const typedTiers = pricingTiers as unknown as Array<{
    examsCount: number;
    unitTotalPrice: number;
  }>;

  const totalAmount = computeTotalByPricingTiers(
    typedTiers.map((t) => ({
      examsCount: t.examsCount,
      unitTotalPrice: t.unitTotalPrice,
    })),
    exams.length
  );

  const appDoc = await Application.create({
    selectionProcessId,
    userId,
    exams,
    finalStatus: 'PENDING_RESULTS',
    scores: exams.map((examId) => ({ examId, scoreValue: 0 })),
  });

  const ticket = await Ticket.create({
    applicationId: appDoc._id,
    selectionProcessId: new mongoose.Types.ObjectId(selectionProcessId),
    paymentStatus: 'PENDING',
    totalAmount,
  });

  const typedTicket = ticket as unknown as {
    _id: mongoose.Types.ObjectId;
    paymentStatus: TicketPaymentStatus;
  };

  return {
    applicationId: String(appDoc._id),
    ticketId: String(typedTicket._id),
    totalAmount,
    paymentStatus: typedTicket.paymentStatus,
  };
}

export async function setTicketPaymentStatus(params: {
  ticketId: string;
  paymentStatus: TicketPaymentStatus;
  actorUserId?: string;
}) {
  const { ticketId, paymentStatus } = params;
  await connectToDatabase();

  const ticket = await Ticket.findById(ticketId).lean();
  if (!ticket) throw new Error('TICKET_NOT_FOUND');

  const typedTicket = ticket as unknown as {
    paymentStatus: TicketPaymentStatus;
  };

  if (typedTicket.paymentStatus === paymentStatus) return { ticketId, paymentStatus };

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const currentTicket = await Ticket.findById(ticketId).session(session);
    if (!currentTicket) throw new Error('TICKET_NOT_FOUND');

    if (paymentStatus === 'PAID') {
      const application = await Application.findById(currentTicket.get('applicationId')).session(session);
      if (!application) throw new Error('APPLICATION_NOT_FOUND');

      const process = await SelectionProcess.findById(application.get('selectionProcessId')).session(session);
      if (!process) throw new Error('SELECTION_PROCESS_NOT_FOUND');

      // Occupação/vagas contam somente tickets PAID no mesmo SelectionProcess.
      // Como a opção 1 é “sempre permitir PAID”, não travamos a transição.
      await Ticket.countDocuments({
        paymentStatus: 'PAID',
        selectionProcessId: process._id,
      }).session(session);

      currentTicket.set('paymentStatus', 'PAID');
    } else {
      currentTicket.set('paymentStatus', paymentStatus);
    }

    await currentTicket.save({ session });

    const finalStatus = currentTicket.get('paymentStatus');
    const process = await SelectionProcess.findById(
      (await Application.findById(currentTicket.get('applicationId')).session(session))?.get('selectionProcessId')
    ).session(session);

    if (process) {
      const occupancy = await getSelectionProcessOccupancy(process._id);
      await session.commitTransaction();
      return {
        ticketId,
        paymentStatus: finalStatus,
        paidCount: occupancy.paidCount,
        maxCapacity: occupancy.maxCapacity,
        remainingCapacity: occupancy.remainingCapacity,
      };
    }

    await session.commitTransaction();
    return { ticketId, paymentStatus: finalStatus };
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
}

export async function listApplicationsBySelectionProcess(selectionProcessId: string) {
  await connectToDatabase();
  const apps = await Application.find({ selectionProcessId }).sort({ createdAt: -1 }).lean();
  return apps.map((a) => ({ id: String(a._id), ...a }));
}

export async function updateScores(params: {
  applicationId: string;
  scores: Array<{ examId: string; scoreValue: number }>;
  graderUserId?: string;
}) {
  const { applicationId, scores, graderUserId } = params;
  await connectToDatabase();

  const app = (await Application.findById(applicationId)) as mongoose.HydratedDocument<IApplication> | null;
  if (!app) throw new Error('APPLICATION_NOT_FOUND');

  const map = new Map(scores.map((s) => [String(s.examId), s.scoreValue]));
  app.scores = app.scores.map((s) => {
    const v = map.get(String(s.examId));
    if (typeof v === 'number') {
      s.scoreValue = v;
      if (graderUserId) s.graderUserId = new mongoose.Types.ObjectId(graderUserId);
      s.updatedAt = new Date();
    }
    return s;
  });

  await app.save();
  return { applicationId, scores: app.scores };
}

export async function setFinalStatus(params: {
  applicationId: string;
  finalStatus: ApplicationFinalStatus;
}) {
  const { applicationId, finalStatus } = params;
  await connectToDatabase();
  const updated = await Application.findByIdAndUpdate(
    applicationId,
    { $set: { finalStatus } },
    { new: true }
  );
  if (!updated) throw new Error('APPLICATION_NOT_FOUND');

  return { applicationId, finalStatus };
}
