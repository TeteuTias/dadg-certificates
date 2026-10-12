import { EventAudit } from "@/lib/events/Audit";

import GateKeeper from "@/lib/security/gatekeeper";

import mongoose from "mongoose";

import { NextRequest } from "next/server";

import { withRouteAccess } from "@/lib/security/route-access";

import { connectToDatabase } from "@/lib/mongodb";

import Event from "@/lib/models/EventCertificateModel";

import Participant from "@/lib/models/EventParticipant";

import Certificate from "@/lib/models/CertificateModel";

import { decryptCpf } from "@/lib/profile/crypto";

import { attendanceSummary, eventStages } from "@/lib/events/attendance";

async function handle(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id))
    return Response.json({ error: "Evento inválido" }, { status: 400 });
  await connectToDatabase();

  // Quem tem alguma presença e ainda não recebeu certificado. O direito ao
  // certificado depende das etapas cumpridas e é decidido por attendanceSummary.
  const filter = {
    eventId: id,
    checkedIn: true,
    status: { $nin: ["PENDING", "CANCELLED", "REVIEW"] },
    certificateId: null,
  };

  const event = await Event.findById(id).lean();
  if (!event)
    return Response.json({ error: "Evento não encontrado" }, { status: 404 });

  const eligibleIds = async () =>
    (
      await Participant.find(filter)
        .select("_id attendance checkedIn checkedOut")
        .lean()
    )
      .filter((participant) => attendanceSummary(event, participant).eligible)
      .map((participant) => participant._id);

  const ends =
    event.statusDetails?.timeLine?.map((item) =>
      new Date(item.endDate).getTime(),
    ) || [];

  const ended =
    ends.length > 0 &&
    ends.every((end) => Number.isFinite(end) && end <= Date.now());

  if (request.method === "GET")
    return Response.json({
      eligible: (await eligibleIds()).length,
      requiresCheckout: true,
      ended,
      stages: eventStages(event)?.length ?? 1,
      minAttendancePercent: event.minAttendancePercent ?? 100,
    });

  if (!ended)
    return Response.json(
      { error: "Aguarde o término da programação para emitir certificados." },
      { status: 409 },
    );

  if (!event.certificateHours || !event.templatePath)
    return Response.json(
      {
        error:
          "Defina a carga horária do certificado e o template em Editar evento antes de liberar.",
      },
      { status: 409 },
    );

  const actor = await new GateKeeper(request).identifyAdmin();

  const candidates = (await eligibleIds()).slice(0, 100);
  let issued = 0;

  for (const candidateId of candidates) {
    const session = await mongoose.startSession();
    let created = false;
    try {
      await session.withTransaction(async () => {
        created = false;

        const participant = await Participant.findOne({
          _id: candidateId,
          ...filter,
        }).session(session);
        // Reconfere dentro da transação: a presença pode ter mudado desde a listagem.
        if (!participant || !attendanceSummary(event, participant).eligible)
          return;

        const certificateId = new mongoose.Types.ObjectId();

        await Certificate.create(
          [
            {
              _id: certificateId,
              participantId: participant._id,
              profileId: participant.profileId,
              eventId: id,
              eventName: event.eventName,
              ownerName: participant.ownerName,
              ownerEmail: participant.ownerEmail,

              ownerCpf: participant.cpfEncrypted
                ? decryptCpf(participant.cpfEncrypted)
                : participant.ownerCpf,
              certificateHours: event.certificateHours,
              isReady: true,
              frontTopperText: "Certificamos que",
              frontBottomText: `participou de ${event.eventName}, com carga horária de ${event.certificateHours}.`,
              verse: { showVerse: false },
            },
          ],
          { session },
        );

        await EventAudit.create(
          [
            {
              eventId: id,
              participantId: participant._id,
              actor: actor?.sub,
              action: "certificate.issued",
              details: String(certificateId),
            },
          ],
          { session },
        );

        created = true;
        participant.certificateId = certificateId;
        await participant.save({ session });
        await Event.updateOne(
          { _id: id },
          { $set: { certificateReleased: true } },
          { session },
        );
      });
      if (created) issued++;
    } finally {
      await session.endSession();
    }
  }

  return Response.json({
    issued,
    remaining: (await eligibleIds()).length,
  });
}

export const GET = withRouteAccess(handle);
export const POST = withRouteAccess(handle);
