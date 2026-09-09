import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { ClamError, contractFor, paymentVerdict, type Payer } from '../domain';
import { PaymentSession, type IPaymentSession } from '../models/PaymentSessionModel';
import { PaymentAttribution } from '../models/PaymentAttributionModel';
import { Reservation } from '../models/ReservationModel';
import { SelectionProcess } from '../models/SelectionProcessModel';
import { Exam } from '../models/ExamModel';
import { PricingTier } from '../models/PricingTierModel';
import { Application } from '../models/ApplicationModel';
import { Ticket } from '../models/TicketModel';
import { transaction, withReservation, type Lock } from './storage';
import { MpGateway, type Gateway } from './gateway';

type SessionDoc = mongoose.HydratedDocument<IPaymentSession>;
export type CheckoutInput = {
  processId: string; userId: string; examsCount: number; payer: Payer;
  candidateProfileId?: string;
  operationKey: string; previousSessionId?: string;
};
const gateway = () => new MpGateway();
function result(doc: SessionDoc) {
  if (doc.status !== 'PENDING' || !doc.paymentUrl || doc.providerClosed) throw new ClamError('PAYMENT_REVIEW_REQUIRED');
  return { sessionId: String(doc._id), init_point: doc.paymentUrl, expiresAt: doc.expiresAt,
    examsCount: doc.contract!.examsCount, totalAmount: doc.contract!.amountCents / 100 };
}
async function review(lock: Lock, doc: SessionDoc, reason: string) {
  await transaction(lock, async session => {
    await PaymentSession.updateOne({ _id: doc._id }, { $set: { status: 'REVIEW_REQUIRED', reviewReason: reason } }, { session });
    await PaymentAttribution.updateOne({ compraId: doc._id }, { $set: { status: 'REVISAO_NECESSARIA' } }, { session });
    const active = await Reservation.findById(lock.key).session(session);
    if (reason === 'UNRESERVED_APPROVAL') await Reservation.updateOne({ _id: lock.key }, { $set: { reviewReason: reason } }, { session });
    if (active?.activeSessionId && String(active.activeSessionId) !== String(doc._id)) {
      await Reservation.updateOne({ _id: lock.key }, { $set: { reviewReason: reason } }, { session });
      await PaymentSession.updateOne({ _id: active.activeSessionId }, { $set: { status: 'REVIEW_REQUIRED', reviewReason: reason } }, { session });
    }
    const application = await Application.findOne({ selectionProcessId: doc.edicaoId, userId: doc.owner }).session(session);
    if (application) await Ticket.updateOne({ applicationId: application._id }, { $set: { paymentStatus: 'REVIEW_REQUIRED' } }, { session });
  });
}

/** Caller holds the candidate lock. Gateway I/O stays outside Mongo transactions. */
export async function reconcileLocked(doc: SessionDoc, lock: Lock, provider: Gateway, close = false) {
  if (lock.reservation.reviewReason) throw new ClamError('PAYMENT_REVIEW_REQUIRED');
  if (!doc.contract || !doc.orderId) throw new ClamError('LEGACY_PAYMENT_REVIEW_REQUIRED');
  if (!doc.preferenceId) {
    const found = await provider.findPreference(doc.orderId);
    if (!found) { await review(lock, doc, 'PREFERENCE_CREATION_UNCERTAIN'); throw new ClamError('PAYMENT_REVIEW_REQUIRED'); }
    await transaction(lock, async session => {
      await PaymentSession.updateOne({ _id: doc._id }, { $set: { preferenceId: found.id, paymentUrl: found.init_point } }, { session });
    });
    doc.preferenceId = found.id;
    doc.paymentUrl = found.init_point;
  }
  let payments = await provider.payments(doc.orderId);
  let verdict = paymentVerdict(payments, doc.contract, doc.orderId);
  if (close && verdict === 'PENDING') {
    payments = await provider.close(doc.preferenceId, doc.orderId);
    verdict = paymentVerdict(payments, doc.contract, doc.orderId);
  }
  const knownMissing = doc.paymentIds.some(id => !payments.some(p => p.id === id));
  if (knownMissing || ((doc.settledAt || ['PAID', 'REVERSED'].includes(doc.status)) && verdict === 'PENDING')) {
    // A temporarily incomplete provider search must not downgrade a settled purchase.
    throw new ClamError('PAYMENT_PROVIDER_UNAVAILABLE', 503);
  }
  if (verdict === 'REVIEW_REQUIRED') {
    await review(lock, doc, 'PAYMENT_CONTRACT_MISMATCH');
    throw new ClamError('PAYMENT_REVIEW_REQUIRED');
  }
  if (doc.reversedAt && verdict === 'PAID') {
    await review(lock, doc, 'REVERSED_PAYMENT_REGRESSION');
    throw new ClamError('PAYMENT_REVIEW_REQUIRED');
  }
  if (String(lock.reservation.activeSessionId) !== String(doc._id)) {
    if (verdict !== 'PENDING') {
      await review(lock, doc, 'SUPERSEDED_PAYMENT');
      throw new ClamError('PAYMENT_REVIEW_REQUIRED');
    }
    return verdict;
  }
  if (verdict === 'PAID' && !['RESERVED', 'PAID'].includes(lock.reservation.state)) {
    await review(lock, doc, 'UNRESERVED_APPROVAL');
    throw new ClamError('PAYMENT_REVIEW_REQUIRED');
  }
  await transaction(lock, async session => {
    const reservation = await Reservation.findById(lock.key).session(session);
    if (!reservation) throw new ClamError('PAYMENT_REVIEW_REQUIRED');
    // A late payment of a superseded session is never credited to the replacement.
    if (String(reservation.activeSessionId) !== String(doc._id)) throw new ClamError('SUPERSEDED_PAYMENT_REVIEW_REQUIRED');
    if (verdict === 'PAID' || verdict === 'REVERSED') {
      const application = await Application.findOneAndUpdate(
        { selectionProcessId: doc.edicaoId, userId: doc.owner },
        { $setOnInsert: { exams: [], scores: [], finalStatus: 'PENDING_RESULTS', candidateProfileId: doc.candidateProfileId } },
        { upsert: true, new: true, session });
      if (verdict === 'PAID' && reservation.state !== 'RESERVED' && reservation.state !== 'PAID') {
        throw new ClamError('PAYMENT_REVIEW_REQUIRED');
      }
      await Ticket.findOneAndUpdate({ applicationId: application!._id }, {
        $set: { selectionProcessId: doc.edicaoId, paymentSessionId: doc._id,
          paymentStatus: verdict === 'PAID' ? 'PAID' : 'CANCELED', totalAmount: doc.contract!.amountCents / 100,
          leagueAllowanceCount: doc.contract!.examsCount },
      }, { upsert: true, session, runValidators: true });
      if (verdict === 'REVERSED' && ['RESERVED', 'PAID'].includes(reservation.state)) {
        const adjusted = await SelectionProcess.updateOne({ _id: doc.edicaoId, allocatedCount: { $gt: 0 } }, { $inc: { allocatedCount: -1, revision: 1 } }, { session });
        if (!adjusted.matchedCount) throw new ClamError('PAYMENT_REVIEW_REQUIRED');
      }
      reservation.state = verdict === 'PAID' ? 'PAID' : 'REVERSED';
      reservation.firstPaidAt ||= new Date();
      await reservation.save({ session });
    }
    await PaymentSession.updateOne({ _id: doc._id }, { $set: {
      status: verdict === 'PENDING' ? (close || doc.providerClosed ? 'CANCELED' : 'PENDING') : verdict,
      paymentIds: payments.map(p => p.id), providerClosed: doc.providerClosed || (close && verdict === 'PENDING'),
      ...(verdict === 'PAID' || verdict === 'REVERSED' ? { settledAt: doc.settledAt || new Date() } : {}),
      ...(verdict === 'REVERSED' ? { reversedAt: doc.reversedAt || new Date() } : {}),
      paymentUrl: doc.paymentUrl, preferenceId: doc.preferenceId, reviewReason: null,
    } }, { session });
    await PaymentAttribution.updateOne({ compraId: doc._id }, { $set: {
      status: verdict === 'PAID' ? 'PAGAMENTO_APROVADO' : verdict === 'REVERSED' || close || doc.providerClosed ? 'PAGAMENTO_CANCELADO' : 'PAGAMENTO_PENDENTE',
    } }, { session });
  });
  return verdict;
}

export async function reconcileSession(id: string, provider: Gateway = gateway(), closeExpired = false, triggerPaymentId?: string) {
  const { storageReady } = await import('./storage');
  await storageReady();
  const doc = await PaymentSession.findById(id);
  if (!doc) throw new ClamError('PAYMENT_SESSION_NOT_FOUND', 404);
  return withReservation(doc.edicaoId, String(doc.owner), async lock => {
    const current = await PaymentSession.findById(doc._id);
    if (!current) throw new ClamError('PAYMENT_SESSION_NOT_FOUND', 404);
    if (triggerPaymentId && !current.paymentIds.includes(triggerPaymentId)) current.paymentIds.push(triggerPaymentId);
    const verdict = await reconcileLocked(current, lock, provider, closeExpired && current.expiresAt.getTime() <= Date.now());
    // Only administrative reconciliation without a replacement releases an expired reservation.
    if (closeExpired && verdict === 'PENDING') {
      const closed = await PaymentSession.findById(current._id);
      if (closed?.providerClosed) await transaction(lock, async session => {
        const r = await Reservation.findById(lock.key).session(session);
        if (r?.state === 'RESERVED' && String(r.activeSessionId) === String(current._id)) {
          const released = await SelectionProcess.updateOne({ _id: doc.edicaoId, allocatedCount: { $gt: 0 } }, { $inc: { allocatedCount: -1, revision: 1 } }, { session });
          if (!released.matchedCount) throw new ClamError('PAYMENT_REVIEW_REQUIRED');
          r.state = 'IDLE'; await r.save({ session });
        }
      });
    }
    return { sessionId: id, verdict };
  });
}

export async function checkout(input: CheckoutInput, provider: Gateway = gateway()) {
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(input.operationKey)) throw new ClamError('INVALID_IDEMPOTENCY_KEY', 400);
  const hash = createHash('sha256').update(JSON.stringify({
    examsCount: input.examsCount, previous: input.previousSessionId ?? null, payer: input.payer,
  })).digest('hex');
  return withReservation(input.processId, input.userId, async lock => {
    if (lock.reservation.reviewReason) throw new ClamError('PAYMENT_REVIEW_REQUIRED');
    if (lock.reservation.firstPaidAt) throw new ClamError('ALREADY_ENROLLED');
    const priorAttempt = await PaymentSession.findOne({ owner: input.userId, edicaoId: input.processId, 'replacementAttempts.key': input.operationKey });
    if (priorAttempt && priorAttempt.replacementAttempts.find(a => a.key === input.operationKey)?.hash !== hash) throw new ClamError('IDEMPOTENCY_CONFLICT');
    const existingOperation = await PaymentSession.findOne({ owner: input.userId, edicaoId: input.processId, operationKey: input.operationKey });
    if (existingOperation) {
      if (existingOperation.requestHash !== hash) throw new ClamError('IDEMPOTENCY_CONFLICT');
      if (String(lock.reservation.activeSessionId) !== String(existingOperation._id)) throw new ClamError('PAYMENT_SESSION_CHANGED');
      if (existingOperation.providerClosed || existingOperation.expiresAt.getTime() <= Date.now()) throw new ClamError('PAYMENT_REPLACEMENT_REQUIRED');
      if (existingOperation.status !== 'PENDING') {
        const verdict = await reconcileLocked(existingOperation, lock, provider);
        if (verdict !== 'PENDING') throw new ClamError('ALREADY_ENROLLED');
      }
      return result((await PaymentSession.findById(existingOperation._id))!);
    }
    let current = lock.reservation.activeSessionId ? await PaymentSession.findById(lock.reservation.activeSessionId) : null;
    if (input.previousSessionId && (!current || String(current._id) !== input.previousSessionId)) throw new ClamError('PAYMENT_SESSION_CHANGED');
    if (current?.contract && !input.previousSessionId && !current.providerClosed) {
      if (current.contract.examsCount !== input.examsCount) throw new ClamError('PAYMENT_REPLACEMENT_REQUIRED');
      if (current.status !== 'PENDING' || current.expiresAt.getTime() <= Date.now()) throw new ClamError('PAYMENT_REPLACEMENT_REQUIRED');
      return result(current);
    }
    const process = await SelectionProcess.findById(input.processId).lean();
    if (!process) throw new ClamError('PROCESS_NOT_FOUND', 404);
    if (process.accountingVersion !== 1) throw new ClamError('SELECTIVE_PROCESS_SETUP_REQUIRED', 503);
    const now = Date.now();
    if (now < new Date(process.registrationStartDate).getTime() || now > new Date(process.registrationEndDate).getTime()) throw new ClamError('REGISTRATION_CLOSED');
    const exams = await Exam.countDocuments({ selectionProcessId: input.processId });
    const tiers = await PricingTier.find({ selectionProcessId: input.processId }).lean();
    const contract = contractFor(input.examsCount, process.maxExamsPerApplication, exams,
      tiers as unknown as Array<{ examsCount: number; unitTotalPrice: number }>);
    if (current && input.previousSessionId && !priorAttempt) {
      await transaction(lock, async session => {
        await PaymentSession.updateOne({ _id: current!._id }, { $push: { replacementAttempts: { key: input.operationKey, hash } } }, { session });
      });
    }
    if (current && !current.providerClosed) {
      await transaction(lock, async session => {
        await PaymentSession.updateOne({ _id: current!._id }, { $set: { status: 'CANCELING' } }, { session });
      });
      try {
        const verdict = await reconcileLocked(current, lock, provider, true);
        if (verdict !== 'PENDING') throw new ClamError('ALREADY_ENROLLED');
      } catch (error) {
        if (error instanceof ClamError && error.code === 'ALREADY_ENROLLED') throw error;
        // A cancellation can be refused because approval won the race.
        let latest: string | undefined;
        try { latest = await reconcileLocked(current, lock, provider); } catch { /* Keep ambiguous results blocked below. */ }
        if (latest === 'PAID' || latest === 'REVERSED') throw new ClamError('ALREADY_ENROLLED');
        await review(lock, current, error instanceof ClamError ? error.code : 'CANCELLATION_UNCERTAIN');
        throw new ClamError('PAYMENT_CANCELLATION_PENDING');
      }
      current = await PaymentSession.findById(current._id);
      if (!current?.providerClosed) throw new ClamError('PAYMENT_CANCELLATION_PENDING');
    }
    const id = new mongoose.Types.ObjectId();
    let allocated = false;
    await transaction(lock, async session => {
      const r = await Reservation.findById(lock.key).session(session);
      if (!r || r.firstPaidAt) throw new ClamError('ALREADY_ENROLLED');
      // Serialize with process edits, league deletion, and price replacement.
      const filter: Record<string, unknown> = { _id: input.processId, accountingVersion: 1, revision: process.revision,
        registrationStartDate: { $lte: new Date() }, registrationEndDate: { $gte: new Date() } };
      const reservedNewSeat = r.state !== 'RESERVED';
      if (reservedNewSeat) filter.$expr = { $lt: ['$allocatedCount', '$maxCapacity'] };
      const reserved = await SelectionProcess.updateOne(filter,
        { $inc: { allocatedCount: reservedNewSeat ? 1 : 0, revision: 1 } }, { session });
      if (!reserved.matchedCount) throw new ClamError('PROCESS_CHANGED_OR_SOLD_OUT');
      await PaymentSession.create([{
        _id: id, owner: input.userId, edicaoId: input.processId, orderId: String(id), contract,
        candidateProfileId: input.candidateProfileId,
        userProps: input.payer, paymentConfig: { examsCount: contract.examsCount, totalAmount: contract.amountCents / 100 },
        status: 'CREATING', type: 'ticket', expiresAt: new Date(Date.now() + 15 * 60_000),
        previousSessionId: current?._id, operationKey: input.operationKey, requestHash: hash,
        operationKind: input.previousSessionId ? 'replace' : 'create',
      }], { session });
      await PaymentAttribution.create([{ compraId: id, usuarioId: input.userId, edicaoId: input.processId, status: 'PAGAMENTO_PENDENTE' }], { session });
      r.state = 'RESERVED'; r.activeSessionId = id; await r.save({ session });
      allocated = reservedNewSeat;
    });
    const created = (await PaymentSession.findById(id))!;
    try {
      const preference = await provider.create(String(id), contract, input.payer, created.expiresAt);
      await transaction(lock, async session => {
        await PaymentSession.updateOne({ _id: id, status: 'CREATING' }, { $set: {
          status: 'PENDING', preferenceId: preference.id, paymentUrl: preference.init_point,
        } }, { session });
        await PaymentAttribution.updateOne({ compraId: id }, { $set: { pagamento: { checkoutId: preference.id, metodo: 'CHECKOUT_PRO' } } }, { session });
      });
    } catch (error) {
      // PAYMENT_CONFIGURATION_ERROR e decidido dentro do gateway antes de
      // qualquer chamada ao Mercado Pago: nenhuma preferencia pode existir,
      // entao nao ha pagamento ambiguo a revisar. Marcar a reserva aqui
      // bloquearia o candidato para sempre - tanto o checkout quanto a
      // reconciliacao administrativa recusam qualquer reserva com
      // reviewReason - inclusive depois de a variavel ser corrigida.
      // Desfazemos a reserva e devolvemos a causa real.
      if (error instanceof ClamError && error.code === 'PAYMENT_CONFIGURATION_ERROR') {
        await transaction(lock, async session => {
          const r = await Reservation.findById(lock.key).session(session);
          if (!r || r.firstPaidAt || String(r.activeSessionId) !== String(id)) return;
          if (allocated) {
            await SelectionProcess.updateOne({ _id: input.processId, allocatedCount: { $gt: 0 } },
              { $inc: { allocatedCount: -1, revision: 1 } }, { session });
          }
          await PaymentSession.updateOne({ _id: id, status: 'CREATING' },
            { $set: { status: 'CANCELED', providerClosed: true } }, { session });
          await PaymentAttribution.updateOne({ compraId: id }, { $set: { status: 'PAGAMENTO_CANCELADO' } }, { session });
          r.state = 'IDLE'; r.activeSessionId = undefined; await r.save({ session });
        });
        console.error('[clam:checkout]', { sessionId: String(id), code: 'PAYMENT_CONFIGURATION_ERROR' });
        throw error;
      }
      await review(lock, created, 'PREFERENCE_CREATION_UNCERTAIN');
      console.error('[clam:checkout]', { sessionId: String(id), code: error instanceof ClamError ? error.code : 'PROVIDER_FAILURE' });
      throw new ClamError('PAYMENT_REVIEW_REQUIRED', 503);
    }
    return result((await PaymentSession.findById(id))!);
  });
}
