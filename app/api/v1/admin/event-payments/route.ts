import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { connectToDatabase } from "@/lib/mongodb";
import { EventOrder } from "@/lib/events/PaymentOrder";
export const GET = withRouteAccess(async (request: NextRequest) => {
  await connectToDatabase();
  const eventId = request.nextUrl.searchParams.get("eventId");
  if (eventId && !/^[a-f0-9]{24}$/i.test(eventId))
    return Response.json({ error: "Evento inválido" }, { status: 400 });
  const data = await EventOrder.find(eventId ? { eventId } : {})
    .select("_id eventId title status amountCents expiresAt reviewReason")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return Response.json(
    { data },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
