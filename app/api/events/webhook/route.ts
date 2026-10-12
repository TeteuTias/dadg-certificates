import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { verifyMercadoPagoSignature } from "@/lib/selective-processes/services/webhookSignature";
import { MpGateway } from "@/lib/selective-processes/services/gateway";
import { EventOrder } from "@/lib/events/PaymentOrder";
import { reconcileEventOrder } from "@/lib/events/reconcile";
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const queryId = request.nextUrl.searchParams.get("data.id");
  const id = queryId || String(body?.data?.id || "");
  if (!id || (queryId && body?.data?.id && queryId !== String(body.data.id)))
    return Response.json({ ok: false }, { status: 400 });
  if (!verifyMercadoPagoSignature(request, id))
    return Response.json({ ok: false }, { status: 401 });
  if (body?.type !== "payment") return Response.json({ ok: true });
  try {
    const gateway = new MpGateway();
    const reference = await gateway.paymentReference(id);
    if (!/^[a-f0-9]{24}$/i.test(reference)) return Response.json({ ok: true });
    await connectToDatabase();
    if (!(await EventOrder.exists({ _id: reference })))
      return Response.json({ ok: true });
    await reconcileEventOrder(reference, false, gateway, id);
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { ok: false, error: "PAYMENT_RECONCILIATION_PENDING" },
      { status: 503 },
    );
  }
}
