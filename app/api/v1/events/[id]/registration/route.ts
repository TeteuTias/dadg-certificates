import { NextRequest } from "next/server";
import { eventIdentity } from "@/lib/events/identity";
import { register, cancelRegistration } from "@/lib/events/registration";
import Participant from "@/lib/models/EventParticipant";
import { EventOrder } from "@/lib/events/PaymentOrder";
import { EventError } from "@/lib/events/rules";
import { withRouteAccess } from "@/lib/security/route-access";
type Context = { params: Promise<{ id: string }> };
async function handle(request: NextRequest, { params }: Context) {
  const { id } = await params;
  const headers = { "Cache-Control": "private, no-store" };
  if (!/^[a-f0-9]{24}$/i.test(id))
    return Response.json(
      { error: "Evento inválido." },
      { status: 400, headers },
    );
  try {
    let data;
    if (request.method === "POST") data = await register(request, id);
    else if (request.method === "DELETE")
      data = await cancelRegistration(request, id);
    else {
      const identity = await eventIdentity(request, false);
      const p = await Participant.findOne({
        eventId: id,
        ...identity.ownerFilter,
      }).lean();
      if (!p) throw new EventError("REGISTRATION_NOT_FOUND", 404);
      const order = p.activePaymentId
        ? await EventOrder.findById(p.activePaymentId).lean()
        : null;
      data = {
        _id: String(p._id),
        status: p.status || "CONFIRMED",
        qrToken: !p.status || p.status === "CONFIRMED" ? p.qrToken : null,
        checkedIn: p.checkedIn,
        certificateId: p.certificateId,
        paymentUrl: order?.status === "PENDING" ? order.paymentUrl : null,
        expiresAt: order?.expiresAt,
      };
    }
    return Response.json({ success: true, data }, { headers });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error:
          error instanceof EventError
            ? error.message
            : "Não foi possível processar a inscrição.",
        code: error instanceof EventError ? error.code : "REGISTRATION_ERROR",
      },
      { status: error instanceof EventError ? error.status : 500, headers },
    );
  }
}
export const GET = withRouteAccess(handle);
export const POST = withRouteAccess(handle);
export const DELETE = withRouteAccess(handle);
