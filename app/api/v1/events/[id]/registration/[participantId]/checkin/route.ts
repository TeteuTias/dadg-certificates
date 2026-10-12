import mongoose from "mongoose";

import { NextRequest } from "next/server";

import { withRouteAccess } from "@/lib/security/route-access";

import Event from "@/lib/models/EventCertificateModel";

import Participant from "@/lib/models/EventParticipant";

import GateKeeper from "@/lib/security/gatekeeper";

import { connectToDatabase } from "@/lib/mongodb";

import { EventAudit } from "@/lib/events/Audit";

import { EventError } from "@/lib/events/rules";

import {
  applyAttendance,
  eventStages,
  type AttendanceMode,
} from "@/lib/events/attendance";

/**
 * Registra entrada, saída ou remoção de presença de um participante.
 * PATCH /api/v1/events/[id]/registration/[participantId]/checkin
 * Body: { mode: "checkin" | "checkout" | "reset", stageId? }
 * Em eventos com várias etapas, `stageId` é obrigatório.
 */
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
    const mode: AttendanceMode = body.mode || "checkin";
    const requestedStageId =
      typeof body.stageId === "string" && body.stageId ? body.stageId : null;

    if (!["checkin", "checkout", "reset"].includes(mode))
      return Response.json({ error: "Ação inválida." }, { status: 400 });

    // Administrador ou operador de presença: a política da rota já validou o acesso.
    const staff = await new GateKeeper(request).identifyStaff();
    const role = staff?.role || "admin";

    await connectToDatabase();
    const session = await mongoose.startSession();

    try {
      const data = await session.withTransaction(async () => {
        const event = await Event.findById(id)
          .select("statusDetails")
          .session(session)
          .lean();

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

        const result = applyAttendance(
          participant,
          event ? eventStages(event) : null,
          mode,
          requestedStageId,
        );

        if (result.attendance)
          participant.attendance = result.attendance.map((entry) => ({
            stageId: new mongoose.Types.ObjectId(entry.stageId),
            checkedInAt: entry.checkedInAt,
            checkedOutAt: entry.checkedOutAt,
          }));
        participant.checkedIn = result.summary.checkedIn;
        participant.checkedInAt = result.summary.checkedInAt;
        participant.checkedOut = result.summary.checkedOut;
        participant.checkedOutAt = result.summary.checkedOutAt;

        await participant.save({ session });

        await EventAudit.create(
          [
            {
              eventId: id,
              participantId,
              actor: staff?.user.sub,
              action: `attendance.${mode}`,
              details: result.stageId ? `${role} stage:${result.stageId}` : role,
            },
          ],
          { session },
        );

        const stage = result.stageId
          ? result.attendance?.find((entry) => entry.stageId === result.stageId)
          : null;

        return {
          participantId,
          ownerName: participant.ownerName,
          stageId: result.stageId,
          // Presença na etapa informada; sem etapas, a do evento.
          checkedIn: result.stageId ? Boolean(stage?.checkedInAt) : result.summary.checkedIn,
          checkedInAt: result.stageId ? (stage?.checkedInAt ?? null) : result.summary.checkedInAt,
          checkedOut: result.stageId ? Boolean(stage?.checkedOutAt) : result.summary.checkedOut,
          checkedOutAt: result.stageId ? (stage?.checkedOutAt ?? null) : result.summary.checkedOutAt,
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
          ...(error instanceof EventError ? { code: error.code } : {}),
        },
        { status: error instanceof EventError ? error.status : 500 },
      );
    } finally {
      await session.endSession();
    }
  },
);
