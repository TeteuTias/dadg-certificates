import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import GateKeeper from "@/lib/security/gatekeeper";
import { connectToDatabase } from "@/lib/mongodb";
import { cancelRegistrationByAdmin } from "@/lib/events/registration";
import { EventError } from "@/lib/events/rules";

/**
 * Cancela, pelo administrador, a inscrição de um participante em evento gratuito.
 * POST /api/v1/events/[id]/registration/[participantId]/cancel
 * Body: { reason } (3 a 300 caracteres, gravado na auditoria)
 */
export const POST = withRouteAccess(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; participantId: string }> },
  ) => {
    const { id, participantId } = await params;
    if (!/^[a-f0-9]{24}$/i.test(id) || !/^[a-f0-9]{24}$/i.test(participantId))
      return Response.json({ error: "Identificador inválido." }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 3 || reason.length > 300)
      return Response.json(
        { error: "Informe o motivo do cancelamento (3 a 300 caracteres)." },
        { status: 400 },
      );

    // A política já exige administrador; a role de operador não basta.
    const staff = await new GateKeeper(request).identifyStaff();
    if (staff?.role !== "admin")
      return Response.json(
        { error: "Apenas administradores cancelam inscrições." },
        { status: 403 },
      );

    await connectToDatabase();
    try {
      const data = await cancelRegistrationByAdmin(id, participantId, staff.user.sub, reason);
      return Response.json({ success: true, data });
    } catch (error) {
      if (error instanceof EventError)
        return Response.json(
          { success: false, error: error.message, code: error.code },
          { status: error.status },
        );
      console.error("[ADMIN_CANCEL]", error);
      return Response.json(
        { success: false, error: "Não foi possível cancelar a inscrição." },
        { status: 500 },
      );
    }
  },
);
