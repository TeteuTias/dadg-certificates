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

async function handle(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id))
    return Response.json({ error: "Evento inválido" }, { status: 400 });
  await connectToDatabase();

  const filter = {
    eventId: id,
    checkedIn: true,
    checkedOut: true,
    status: { $nin: ["PENDING", "CANCELLED", "REVIEW"] },
    certificateId: null,
  };

  const event = await Event.findById(id).lean();
  if (!event)
    return Response.json({ error: "Evento não encontrado" }, { status: 404 });

  const ends =
    event.statusDetails?.timeLine?.map((item) =>
      new Date(item.endDate).getTime(),
    ) || [];

  const ended =
    ends.length > 0 &&
    ends.every((end) => Number.isFinite(end) && end <= Date.now());

  if (request.method === "GET")
    return Response.json({
      eligible: await Participant.countDocuments(filter),
      requiresCheckout: true,
      ended,
    });

  if (!ended)
    return Response.json(
      { error: "Aguarde o término da programação para emitir certificados." },
      { status: 409 },
    );

  if (!event.certificateHours || !event.templatePath)
    return Response.json(
      { error: "Configure carga horária e template antes de liberar." },
      { status: 409 },
    );

  const actor = await new GateKeeper(request).identifyAdmin();

  const candidates = await Participant.find(filter)
    .select("_id")
    .limit(100)
    .lean();
  let issued = 0;

  for (const candidate of candidates) {
    const session = await mongoose.startSession();
    let created = false;
    try {
      await session.withTransaction(async () => {
        created = false;

        const participant = await Participant.findOne({
          _id: candidate._id,
          ...filter,
        }).session(session);
        if (!participant) return;

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
    remaining: await Participant.countDocuments(filter),
  });
}

export const GET = withRouteAccess(handle);
export const POST = withRouteAccess(handle);
