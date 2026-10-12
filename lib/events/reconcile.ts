import { EventAudit } from "./Audit";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import Event from "@/lib/models/EventCertificateModel";
import Participant from "@/lib/models/EventParticipant";
import { EventOrder } from "./PaymentOrder";
import { EventError } from "./rules";
import {
  MpGateway,
  type Gateway,
} from "@/lib/selective-processes/services/gateway";
import { paymentVerdict } from "@/lib/selective-processes/domain";
export async function reconcileEventOrder(
  id: string,
  closeExpired = false,
  provider: Gateway = new MpGateway(),
  triggerPaymentId?: string,
) {
  const token = randomUUID();
  const now = new Date();
  const order = await EventOrder.findOneAndUpdate(
    {
      _id: id,
      $or: [{ lockedUntil: { $lt: now } }, { lockedUntil: { $exists: false } }],
    },
    { $set: { lockToken: token, lockedUntil: new Date(Date.now() + 60000) } },
    { new: true },
  );
  if (!order) throw new EventError("RECONCILIATION_BUSY");
  try {
    if (
      order.status === "CREATING" &&
      Date.now() - new Date(order.createdAt).getTime() < 60000
    )
      throw new EventError("PAYMENT_CREATING");
    if (!order.preferenceId) {
      const pref = await provider.findPreference(id);
      if (!pref) throw new EventError("PAYMENT_REVIEW_REQUIRED");
      order.preferenceId = pref.id;
      order.paymentUrl = pref.init_point;
    }
    const closing =
      closeExpired &&
      order.expiresAt <= now &&
      !["PAID", "REVERSED", "CANCELLED"].includes(order.status);
    const payments = closing
      ? await provider.close(order.preferenceId, id)
      : await provider.payments(id);
    if (triggerPaymentId && !payments.some((p) => p.id === triggerPaymentId))
      throw new EventError("PAYMENT_PROVIDER_INCOMPLETE", 503);
    if (
      (order.paymentIds || []).some(
        (known: string) => !payments.some((p) => p.id === known),
      )
    )
      throw new EventError("PAYMENT_PROVIDER_INCOMPLETE", 503);
    const verdict = paymentVerdict(
      payments,
      { amountCents: order.amountCents, currency: "BRL", examsCount: 1 },
      id,
    );
    if (["PAID", "REVERSED"].includes(order.status) && verdict === "PENDING")
      throw new EventError("PAYMENT_PROVIDER_INCOMPLETE", 503);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const fenced = await EventOrder.updateOne(
          { _id: id, lockToken: token, lockedUntil: { $gt: new Date() } },
          { $set: { updatedAt: new Date() } },
          { session },
        );
        if (!fenced.matchedCount) throw new EventError("RECONCILIATION_BUSY");
        const p = await Participant.findById(order.participantId).session(
          session,
        );
        const active = p && String(p.activePaymentId) === id;
        let status =
          verdict === "PAID"
            ? "PAID"
            : verdict === "REVERSED"
              ? "REVERSED"
              : verdict === "REVIEW_REQUIRED"
                ? "REVIEW"
                : closing || order.status === "CANCELLED"
                  ? "CANCELLED"
                  : "PENDING";
        if (
          (!active && verdict !== "PENDING") ||
          (order.status === "REVERSED" && verdict === "PAID") ||
          (order.status === "CANCELLED" && verdict === "PAID")
        )
          status = "REVIEW";
        if (active) {
          if (status === "PAID") {
            p.status = "CONFIRMED";
            await p.save({ session });
          } else if (status === "REVIEW") {
            p.status = "REVIEW";
            await p.save({ session });
          } else if (
            ["CANCELLED", "REVERSED"].includes(status) &&
            p.status !== "CANCELLED"
          ) {
            // Attendance/certificates need an administrator, including after a reversal.
            if (p.checkedIn || p.certificateId) {
              p.status = "REVIEW";
              status = "REVIEW";
            } else {
              p.status = "CANCELLED";
              p.cancelledAt = new Date();
              p.cancellationReason = status;
              // Mesmo motivo do cancelamento pelo aluno: o índice único não é esparso.
              p.qrToken = randomUUID();
              const released = await Event.updateOne(
                { _id: order.eventId, registrationCount: { $gt: 0 } },
                { $inc: { registrationCount: -1 } },
                { session },
              );
              if (!released.modifiedCount)
                throw new EventError("COUNTER_REVIEW_REQUIRED");
            }
            await p.save({ session });
          }
        }
        if (status !== order.status)
          await EventAudit.create(
            [
              {
                eventId: order.eventId,
                participantId: order.participantId,
                actor: "mercadopago",
                action: "payment.reconciled",
                details: status,
              },
            ],
            { session },
          );
        await EventOrder.updateOne(
          { _id: id, lockToken: token },
          {
            $set: {
              status,
              preferenceId: order.preferenceId,
              paymentUrl: order.paymentUrl,
              paymentIds: payments.map((p) => p.id),
              providerClosed: order.providerClosed || closing,
              reviewReason:
                status === "REVIEW" ? "PAYMENT_CONTRACT_REVIEW" : null,
            },
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    return { orderId: id, verdict };
  } finally {
    await EventOrder.updateOne(
      { _id: id, lockToken: token },
      { $unset: { lockToken: 1, lockedUntil: 1 } },
    );
  }
}
