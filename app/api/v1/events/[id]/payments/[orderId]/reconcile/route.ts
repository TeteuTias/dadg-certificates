import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { connectToDatabase } from "@/lib/mongodb";
import { EventOrder } from "@/lib/events/PaymentOrder";
import { reconcileEventOrder } from "@/lib/events/reconcile";
export const POST = withRouteAccess(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string; orderId: string }> },
  ) => {
    const { id, orderId } = await params;
    if (!/^[a-f0-9]{24}$/i.test(id) || !/^[a-f0-9]{24}$/i.test(orderId))
      return Response.json({ error: "ID inválido" }, { status: 400 });
    await connectToDatabase();
    if (!(await EventOrder.exists({ _id: orderId, eventId: id })))
      return Response.json(
        { error: "Cobrança não encontrada" },
        { status: 404 },
      );
    try {
      return Response.json(await reconcileEventOrder(orderId, true));
    } catch {
      return Response.json(
        { error: "Conciliação pendente de revisão" },
        { status: 409 },
      );
    }
  },
);
