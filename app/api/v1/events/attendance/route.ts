import { NextResponse } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { connectToDatabase } from "@/lib/mongodb";
import EventCertificateModel from "@/lib/models/EventCertificateModel";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

/**
 * @description Eventos em que se registra presença: publicados, não arquivados e com
 * cronograma. Devolve só o necessário para escolher o evento na porta.
 * GET /api/v1/events/attendance  (administrador ou operador de presença)
 */
async function GETHandler() {
  try {
    await connectToDatabase();

    const events = await EventCertificateModel.find({
      archivedAt: { $exists: false },
      "statusDetails.status": { $in: ["PUBLISHED_OPEN", "PUBLISHED_CLOSED"] },
      "statusDetails.timeLine.0": { $exists: true },
    })
      .select("eventName eventType statusDetails.timeLine")
      .limit(200)
      .lean();

    const now = Date.now();
    const data = events
      .map((event) => {
        const timeLine = event.statusDetails?.timeLine || [];
        const start = Math.min(...timeLine.map((item) => new Date(item.startDate).getTime()));
        const end = Math.max(...timeLine.map((item) => new Date(item.endDate).getTime()));
        return {
          start,
          end,
          item: {
            _id: String(event._id),
            eventName: event.eventName,
            eventType: event.eventType,
            startDate: new Date(start).toISOString(),
            endDate: new Date(end).toISOString(),
            stages: timeLine.length,
            finished: end < now,
          },
        };
      })
      // Em andamento e próximos primeiro; encerrados depois, do mais recente ao mais antigo.
      .sort((a, b) =>
        a.item.finished !== b.item.finished
          ? Number(a.item.finished) - Number(b.item.finished)
          : a.item.finished
            ? b.end - a.end
            : a.start - b.start,
      )
      .map(({ item }) => item);

    return NextResponse.json({ success: true, data }, { headers });
  } catch (error) {
    console.error("[EVENTS_ATTENDANCE_GET]", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json(
      { success: false, error: "Erro interno ao listar eventos." },
      { status: 500, headers },
    );
  }
}

export const GET = withRouteAccess(GETHandler);
