import mongoose from "mongoose";

import { NextRequest } from "next/server";

import { withRouteAccess } from "@/lib/security/route-access";

import Participant from "@/lib/models/EventParticipant";

import GateKeeper from "@/lib/security/gatekeeper";

import { connectToDatabase } from "@/lib/mongodb";

import { EventAudit } from "@/lib/events/Audit";

import { EventError } from "@/lib/events/rules";

export const PATCH = withRouteAccess(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; participantId: string }> },
  ) => {
    const { id, participantId } = await params;

    if (!/^[a-f0-9]{24}$/i.test(id) || !/^[a-f0-9]{24}$/i.test(participantId))
      return Response.json(
        { error: "Identificador inválido." },
        { status: 400 },
      );

    const body = await request.json().catch(() => ({}));
    const mode = body.mode || "checkin";

    if (!["checkin", "checkout", "reset"].includes(mode))
      return Response.json({ error: "Ação inválida." }, { status: 400 });

    const actor = await new GateKeeper(request).identifyAdmin();

    await connectToDatabase();
    const session = await mongoose.startSession();

    try {
      const data = await session.withTransaction(async () => {
        const participant = await Participant.findOne({
          _id: participantId,
          eventId: id,
          status: { $nin: ["PENDING", "CANCELLED", "REVIEW"] },
        }).session(session);

        if (!participant)
          throw new EventError(
            "PARTICIPANT_NOT_FOUND",
            404,
            "Participante não disponível neste evento.",
          );

        if (participant.certificateId)
          throw new EventError(
            "CERTIFICATE_ALREADY_ISSUED",
            409,
            "Presença protegida: certificado já emitido.",
          );

        if (mode === "reset") {
          participant.checkedIn = false;
          participant.checkedOut = false;
          participant.checkedInAt = null;
          participant.checkedOutAt = null;
        } else if (mode === "checkout") {
          if (!participant.checkedIn)
            throw new EventError(
              "CHECKIN_REQUIRED",
              409,
              "Registre a entrada antes da saída.",
            );

          if (participant.checkedOut)
            throw new EventError(
              "ALREADY_CHECKED_OUT",
              409,
              "Saída já registrada.",
            );

          participant.checkedOut = true;
          participant.checkedOutAt = new Date();
        } else {
          if (participant.checkedIn)
            throw new EventError(
              "ALREADY_CHECKED_IN",
              409,
              "Entrada já registrada.",
            );

          participant.checkedIn = true;
          participant.checkedInAt = new Date();
        }

        await participant.save({ session });

        await EventAudit.create(
          [
            {
              eventId: id,
              participantId,
              actor: actor?.sub,
              action: `attendance.${mode}`,
              details: "admin",
            },
          ],
          { session },
        );

        return {
          participantId,
          ownerName: participant.ownerName,
          checkedIn: participant.checkedIn,
          checkedInAt: participant.checkedInAt,
          checkedOut: participant.checkedOut,
          checkedOutAt: participant.checkedOutAt,
        };
      });

      return Response.json({
        success: true,
        message: "Presença atualizada.",
        data,
      });
    } catch (error) {
      return Response.json(
        {
          success: false,
          error:
            error instanceof EventError
              ? error.message
              : "Não foi possível atualizar a presença.",
        },
        { status: error instanceof EventError ? error.status : 500 },
      );
    } finally {
      await session.endSession();
    }
  },
);
