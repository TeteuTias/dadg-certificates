import mongoose, { type ClientSession } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { ClamError } from '../domain';
import { Reservation, reservationKey, type IReservation } from '../models/ReservationModel';
import { PaymentSession } from '../models/PaymentSessionModel';
import { Application } from '../models/ApplicationModel';
import { Ticket } from '../models/TicketModel';
import { PaymentAttribution } from '../models/PaymentAttributionModel';

export async function storageReady() {
  const { connectToDatabase } = await import('@/lib/mongodb');
  await connectToDatabase();
  // Read-only readiness check. Indexes must be installed explicitly, never by a request.
  for (const [model, key] of [
    [PaymentSession, { orderId: 1 }], [PaymentSession, { preferenceId: 1 }], [PaymentSession, { paymentIds: 1 }], [PaymentSession, { owner: 1, edicaoId: 1, operationKey: 1 }],
    [Application, { selectionProcessId: 1, userId: 1 }], [Ticket, { applicationId: 1 }],
    [PaymentAttribution, { compraId: 1 }],
  ] as const) {
    const indexes = await model.collection.listIndexes().toArray().catch(() => []);
    if (!indexes.some(index => index.unique && JSON.stringify(index.key) === JSON.stringify(key))) {
      throw new ClamError('SELECTIVE_PROCESS_SETUP_REQUIRED', 503);
    }
  }
}
export type Lock = { key: string; token: string; reservation: mongoose.HydratedDocument<IReservation> };
export async function withReservation<T>(processId: string, userId: string, fn: (lock: Lock) => Promise<T>): Promise<T> {
  await storageReady();
  const key = reservationKey(processId, userId);
  if (!await Reservation.exists({ _id: key })) {
    const legacy = await PaymentSession.exists({ owner: userId, edicaoId: processId });
    const existingApplication = await Application.exists({ selectionProcessId: processId, userId });
    if (legacy || existingApplication) throw new ClamError('LEGACY_PAYMENT_REVIEW_REQUIRED');
    try { await Reservation.create({ _id: key, selectionProcessId: processId, userId, state: 'IDLE' }); }
    catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
  }
  const token = randomUUID();
  const reservation = await Reservation.findOneAndUpdate({
    _id: key, $or: [{ lockToken: null }, { lockUntil: { $lt: new Date() } }],
  }, { $set: { lockToken: token, lockUntil: new Date(Date.now() + 120_000) } }, { new: true });
  if (!reservation) throw new ClamError('PAYMENT_PROCESSING');
  try { return await fn({ key, token, reservation }); }
  finally { await Reservation.updateOne({ _id: key, lockToken: token }, { $unset: { lockToken: 1, lockUntil: 1 } }); }
}
export async function transaction<T>(lock: Lock, fn: (session: ClientSession) => Promise<T>): Promise<T> {
  return mongoose.connection.transaction(async session => {
    // Every financial transaction writes the reservation, providing fencing and serialization.
    const fenced = await Reservation.updateOne({ _id: lock.key, lockToken: lock.token },
      { $set: { lockUntil: new Date(Date.now() + 120_000) } }, { session });
    if (!fenced.matchedCount) throw new ClamError('PAYMENT_PROCESSING');
    return fn(session);
  });
}
