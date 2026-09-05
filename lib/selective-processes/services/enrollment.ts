import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { Application } from '../models/ApplicationModel';
import { PaymentSession } from '../models/PaymentSessionModel';
import { Ticket } from '../models/TicketModel';

/**
 * Efetiva a inscrição do candidato quando o Mercado Pago confirma o pagamento.
 *
 * O checkout acontece antes da escolha das ligas, então aqui só criamos a
 * Application e o Ticket pago com o número de ligas contratadas
 * (`paymentConfig.examsCount`). A escolha das ligas em si é feita depois pelo
 * candidato em `selectLeaguesForApplication`.
 *
 * A função é idempotente: o webhook do Mercado Pago pode ser reentregue.
 */
export async function confirmEnrollmentForPaymentSession(paymentSessionId: mongoose.Types.ObjectId) {
  await connectToDatabase();

  const paymentSession = (await PaymentSession.findById(paymentSessionId).lean()) as unknown as {
    _id: mongoose.Types.ObjectId;
    owner: mongoose.Types.ObjectId;
    edicaoId?: string;
    type?: string;
    paymentConfig?: { examsCount?: number; totalAmount?: number };
  } | null;

  if (!paymentSession?.edicaoId) return null;
  if (!mongoose.Types.ObjectId.isValid(paymentSession.edicaoId)) return null;

  const selectionProcessId = new mongoose.Types.ObjectId(paymentSession.edicaoId);
  const userId = paymentSession.owner;

  const examsCount = Number(paymentSession.paymentConfig?.examsCount ?? 1);
  const leagueAllowanceCount = Number.isFinite(examsCount) && examsCount > 0 ? Math.floor(examsCount) : 1;
  const totalAmount = Number(paymentSession.paymentConfig?.totalAmount ?? 0);

  const application =
    (await Application.findOne({ selectionProcessId, userId })) ||
    (await Application.create({
      selectionProcessId,
      userId,
      exams: [],
      finalStatus: 'PENDING_RESULTS',
      scores: [],
    }));

  const existingTicket = await Ticket.findOne({ applicationId: application._id });

  if (!existingTicket) {
    await Ticket.create({
      applicationId: application._id,
      selectionProcessId,
      paymentStatus: 'PAID',
      totalAmount,
      leagueAllowanceCount,
    });
    return { applicationId: String(application._id), leagueAllowanceCount };
  }

  if (existingTicket.get('paymentStatus') !== 'PAID') {
    existingTicket.set('paymentStatus', 'PAID');
    existingTicket.set('leagueAllowanceCount', leagueAllowanceCount);
    if (totalAmount > 0) existingTicket.set('totalAmount', totalAmount);
    await existingTicket.save();
  }

  return {
    applicationId: String(application._id),
    leagueAllowanceCount: Number(existingTicket.get('leagueAllowanceCount') ?? leagueAllowanceCount),
  };
}

/**
 * Localiza a sessao de pagamento a partir do `external_reference` devolvido
 * pelo Mercado Pago. A referencia e gravada em `orderId` na criacao da sessao;
 * o fallback por `_id` mantem compatibilidade com sessoes antigas.
 */
export async function resolvePaymentSessionId(externalReference: string) {
  await connectToDatabase();

  const byOrderId = (await PaymentSession.findOne({ orderId: externalReference })
    .select({ _id: 1 })
    .lean()) as unknown as { _id: mongoose.Types.ObjectId } | null;
  if (byOrderId?._id) return byOrderId._id;

  if (!mongoose.Types.ObjectId.isValid(externalReference)) return null;

  const byId = (await PaymentSession.findById(externalReference)
    .select({ _id: 1 })
    .lean()) as unknown as { _id: mongoose.Types.ObjectId } | null;

  return byId?._id ?? null;
}
