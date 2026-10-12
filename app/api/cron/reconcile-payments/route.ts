import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { EventOrder } from "@/lib/events/PaymentOrder";
import { reconcileEventOrder } from "@/lib/events/reconcile";
import { PaymentSession } from "@/lib/selective-processes/models/PaymentSessionModel";
import { reconcileSession } from "@/lib/selective-processes/services/checkout";
// Até 20 conciliações em sequência, cada uma com várias chamadas ao Mercado Pago.
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  await connectToDatabase();
  const result = { processed: 0, pending: 0 };
  const orders = await EventOrder.find({
    status: { $in: ["PENDING", "CREATING", "REVIEW"] },
    expiresAt: { $lte: new Date() },
  })
    .sort({ updatedAt: 1 })
    .limit(10)
    .lean();
  for (const order of orders) {
    try {
      await reconcileEventOrder(String(order._id), true);
      result.processed++;
    } catch {
      result.pending++;
    }
  }
  const sessions = await PaymentSession.find({
    status: { $in: ["PENDING", "CREATING"] },
    expiresAt: { $lte: new Date() },
  })
    .sort({ updatedAt: 1 })
    .limit(10)
    .lean();
  for (const session of sessions) {
    try {
      await reconcileSession(String(session._id), undefined, true);
      result.processed++;
    } catch {
      result.pending++;
    }
  }
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
