import { EventAudit } from "./Audit";
import type { IEventCertificate } from "@/lib/models/EventCertificateModel";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import Event from "@/lib/models/EventCertificateModel";
import Participant, { type IEventParticipant } from "@/lib/models/EventParticipant";
import { EventOrder } from "./PaymentOrder";
import { EventError, overlaps, registrationOpen, canSelfCancel } from "./rules";
import { eventIdentity } from "./identity";
import { decryptCpf } from "@/lib/profile/crypto";
import { MpGateway } from "@/lib/selective-processes/services/gateway";
import type { NextRequest } from "next/server";
export async function register(request: NextRequest, id: string) {
  const identity = await eventIdentity(request, true, false);
  const indexes = await Participant.collection.listIndexes().toArray();
  if (!indexes.some((i) => i.name === "event_profile_unique" && i.unique))
    throw new EventError(
      "EVENT_SETUP_REQUIRED",
      503,
      "Inscrições aguardando configuração da organização.",
    );
  const session = await mongoose.startSession();
  let participantId = "",
    orderId = "",
    created = false;
  try {
    await session.withTransaction(async () => {
      created = false;
      orderId = "";
      // Serializes concurrent registrations of the same student, including schedule checks.
      await mongoose
        .model("UserProfile")
        .updateOne(
          { _id: identity.profile._id },
          { $inc: { registrationRevision: 1 } },
          { session },
        );
      const event = await Event.findById(id).session(session).lean();
      if (!event || !registrationOpen(event))
        throw new EventError(
          "REGISTRATION_CLOSED",
          409,
          "Inscrições encerradas ou fora do período.",
        );
      let participant = await Participant.findOne({
        eventId: id,
        ...identity.ownerFilter,
      }).session(session);
      if (participant && participant.status !== "CANCELLED") {
        participantId = String(participant._id);
        orderId = String(participant.activePaymentId || "");
        return;
      }
      const others = await Participant.find({
        ...identity.ownerFilter,
        status: { $ne: "CANCELLED" },
        eventId: { $ne: id },
      })
        .populate<{ eventId: IEventCertificate }>("eventId")
        .session(session)
        .lean();
      if (
        others.some(
          (p) =>
            p.eventId &&
            overlaps(
              event.statusDetails.timeLine || [],
              p.eventId.statusDetails?.timeLine || [],
            ),
        )
      )
        throw new EventError(
          "SCHEDULE_CONFLICT",
          409,
          "Você já tem uma inscrição neste horário.",
        );
      const reserved = await Event.updateOne(
        {
          _id: id,
          $expr: {
            $lt: [{ $ifNull: ["$registrationCount", 0] }, "$maxParticipants"],
          },
        },
        { $inc: { registrationCount: 1 } },
        { session },
      );
      if (!reserved.modifiedCount)
        throw new EventError("EVENT_FULL", 409, "Vagas esgotadas.");
      const paymentId = event.isPaid
        ? new mongoose.Types.ObjectId()
        : undefined;
      const amountCents = Math.round(Number(event.price) * 100);
      if (
        event.isPaid &&
        (!Number.isSafeInteger(amountCents) || amountCents <= 0)
      )
        throw new EventError(
          "INVALID_EVENT_PRICE",
          409,
          "Este evento está com o valor configurado incorretamente. Avise a organização.",
        );
      if (
        event.isPaid &&
        (!process.env.MERCADOPAGO_ACCESS_TOKEN ||
          !process.env.MERCADOPAGO_WEBHOOK_SECRET)
      )
        throw new EventError(
          "PAYMENT_CONFIGURATION_ERROR",
          503,
          "Pagamento temporariamente indisponível.",
        );
      const data = {
        profileId: identity.profile._id,
        ownerName: identity.profile.name,
        ownerEmail: identity.email,
        cpfEncrypted: identity.profile.cpfEncrypted,
        cpfLookup: identity.profile.cpfLookup,
        status: event.isPaid ? "PENDING" : "CONFIRMED",
        qrToken: randomUUID(),
        checkedIn: false,
        checkedOut: false,
        activePaymentId: paymentId,
        cancelledAt: null,
        cancellationReason: null,
      };
      if (participant) {
        Object.assign(participant, data);
        participant.ownerCpf = undefined;
        await participant.save({ session });
      } else
        [participant] = await Participant.create([{ ...data, eventId: id }], {
          session,
        });
      participantId = String(participant._id);
      created = true;
      await EventAudit.create(
        [
          {
            eventId: id,
            participantId,
            actor: identity.identity.authSubject,
            action: "registration.created",
            details: event.isPaid ? "payment-reserved" : "free-confirmed",
          },
        ],
        { session },
      );
      if (paymentId) {
        await EventOrder.create(
          [
            {
              _id: paymentId,
              participantId,
              eventId: id,
              profileId: identity.profile._id,
              title: event.eventName,
              amountCents,
              expiresAt: new Date(Date.now() + 15 * 60000),
              status: "CREATING",
              paymentIds: [],
            },
          ],
          { session },
        );
        orderId = String(paymentId);
      }
    });
  } finally {
    await session.endSession();
  }
  if (!orderId) return { participantId, status: "CONFIRMED" };
  const order = await EventOrder.findById(orderId);
  if (!order)
    throw new EventError(
      "PAYMENT_ORDER_NOT_FOUND",
      503,
      "Não foi possível localizar sua cobrança. Atualize a página em instantes.",
    );
  if (order.status === "PAID") return { participantId, status: "CONFIRMED" };
  if (
    order.status === "PENDING" &&
    order.expiresAt > new Date() &&
    order.paymentUrl
  )
    return {
      participantId,
      status: order.status,
      paymentUrl: order.paymentUrl,
      expiresAt: order.expiresAt,
    };
  if (!created)
    throw new EventError(
      "PAYMENT_RECONCILIATION_REQUIRED",
      409,
      "Estamos verificando sua cobrança. Atualize sua inscrição em instantes.",
    );
  try {
    const provider = new MpGateway(order.title || "Inscrição DADG");
    const preference = await provider.create(
      orderId,
      { amountCents: order.amountCents, currency: "BRL", examsCount: 1 },
      {
        name: identity.profile.name,
        email: identity.email,
        cpf: decryptCpf(identity.profile.cpfEncrypted),
        phone: identity.profile.phone || "",
        zipCode: "",
        street: "",
        number: "",
        neighborhood: "",
        complement: "",
      },
      order.expiresAt,
    );
    await EventOrder.updateOne(
      { _id: orderId, status: { $in: ["CREATING", "REVIEW"] } },
      {
        $set: {
          preferenceId: preference.id,
          paymentUrl: preference.init_point,
          status: "PENDING",
        },
      },
    );
    return {
      participantId,
      status: "PENDING",
      paymentUrl: preference.init_point,
      expiresAt: order.expiresAt,
    };
  } catch {
    await EventOrder.updateOne(
      { _id: orderId, status: "CREATING" },
      { $set: { status: "REVIEW", reviewReason: "CREATE_UNCERTAIN" } },
    );
    throw new EventError(
      "PAYMENT_RECONCILIATION_REQUIRED",
      503,
      "A cobrança está sendo verificada. Não faça outro pagamento.",
    );
  }
}
export async function cancelRegistration(request: NextRequest, id: string) {
  const identity = await eventIdentity(request, false);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const participant = await Participant.findOne({
        eventId: id,
        ...identity.ownerFilter,
      }).session(session);
      const event = await Event.findById(id).session(session);
      if (!participant || !event)
        throw new EventError("REGISTRATION_NOT_FOUND", 404, "Inscrição não encontrada.");
      if (participant.status === "CANCELLED") return;
      if (!canSelfCancel(event, participant))
        throw new EventError(
          "ADMIN_CANCELLATION_REQUIRED",
          409,
          "Solicite o cancelamento à organização. Inscrições pagas ou com presença exigem revisão.",
        );
      await closeRegistration(session, id, participant, identity.identity.authSubject, "student", "student");
    });
  } finally {
    await session.endSession();
  }
  return { status: "CANCELLED" };
}

/**
 * Cancelamento pelo administrador de inscrição em evento gratuito, inclusive
 * lançamento manual e inscrição com presença. A presença fica no histórico e,
 * como a inscrição sai das listas ativas, não gera certificado. Inscrição paga
 * segue pelo estorno no provedor e pela conciliação.
 */
export async function cancelRegistrationByAdmin(
  id: string,
  participantId: string,
  actor: string,
  reason: string,
) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const participant = await Participant.findOne({
        _id: participantId,
        eventId: id,
      }).session(session);
      const event = await Event.findById(id).select("isPaid").session(session);
      if (!participant || !event)
        throw new EventError("REGISTRATION_NOT_FOUND", 404, "Inscrição não encontrada.");
      if (participant.status === "CANCELLED") return;
      if (event.isPaid)
        throw new EventError(
          "PAID_REGISTRATION",
          409,
          "Inscrição paga: faça o estorno no Mercado Pago e concilie em Cobranças.",
        );
      if (participant.certificateId)
        throw new EventError(
          "CERTIFICATE_ALREADY_ISSUED",
          409,
          "Certificado já emitido: a inscrição não pode ser cancelada.",
        );
      await closeRegistration(session, id, participant, actor, `admin: ${reason}`, "admin");
    });
  } finally {
    await session.endSession();
  }
  return { status: "CANCELLED" };
}

async function closeRegistration(
  session: mongoose.ClientSession,
  eventId: string,
  participant: mongoose.HydratedDocument<IEventParticipant>,
  actor: string,
  details: string,
  reason: string,
) {
  await EventAudit.create(
    [
      {
        eventId,
        participantId: participant._id,
        actor,
        action: "registration.cancelled",
        details,
      },
    ],
    { session },
  );
  participant.status = "CANCELLED";
  participant.cancelledAt = new Date();
  participant.cancellationReason = reason;
  // O índice único de qrToken em produção não é esparso: remover o campo
  // faria a segunda inscrição cancelada colidir. Trocar o valor invalida o código.
  participant.qrToken = randomUUID();
  await participant.save({ session });
  const released = await Event.updateOne(
    { _id: eventId, registrationCount: { $gt: 0 } },
    { $inc: { registrationCount: -1 } },
    { session },
  );
  if (!released.modifiedCount)
    throw new EventError(
      "COUNTER_REVIEW_REQUIRED",
      409,
      "Não foi possível concluir agora. Tente novamente ou fale com a organização.",
    );
}
