import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function toUtcIsoFromDateOnlySP(dateStr: string, addDays = 0) {
  // Interpreta "YYYY-MM-DD" como meia-noite em America/Sao_Paulo (UTC-03)
  // e converte para ISO em UTC (00:00 -03:00 => 03:00Z).
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + addDays, 3, 0, 0));
  return utc.toISOString();
}

function normalizeTimeParam(value: string, isEnd: boolean) {
  // Se já vier RFC3339/ISO com hora, usa como está
  if (value.includes("T")) return value;

  // Se vier só "YYYY-MM-DD":
  // timeMin = começo do dia (SP)
  // timeMax = começo do dia seguinte (SP), pois timeMax é exclusivo
  return toUtcIsoFromDateOnlySP(value, isEnd ? 1 : 0);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    console.log("Parâmetros de data ausentes", { start, end });
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const apiKey = process.env.GOOGLE_API_KEY;

  console.log("Configurações:", {
    calendarId: calendarId ? "Configurado" : "Não configurado",
    apiKey: apiKey ? "Configurado" : "Não configurado",
    start,
    end,
  });

  if (!calendarId || !apiKey) {
    console.error("Variáveis de ambiente não configuradas:", {
      calendarId: calendarId ? "Configurado" : "Não configurado",
      apiKey: apiKey ? "Configurado" : "Não configurado",
    });
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const timeMin = normalizeTimeParam(start, false);
  const timeMax = normalizeTimeParam(end, true);

  const url =
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events` +
    `?key=${encodeURIComponent(apiKey)}` +
    `&timeMin=${encodeURIComponent(timeMin)}` +
    `&timeMax=${encodeURIComponent(timeMax)}` +
    `&singleEvents=true` +
    `&orderBy=startTime` +
    `&timeZone=${encodeURIComponent("America/Sao_Paulo")}`;

  console.log("Fazendo requisição para:", url);

  try {
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Erro na resposta da API do Google Calendar:", {
        status: res.status,
        statusText: res.statusText,
        error: errorText,
      });
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const data = await res.json();
    console.log("Eventos encontrados:", data.items?.length || 0);

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar eventos:", error);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}