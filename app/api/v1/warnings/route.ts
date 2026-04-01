import { NextResponse } from "next/server";
import { getAppsScriptTipo, validateAvisosPayload } from "@/lib/avisos";

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
const APPS_SCRIPT_TOKEN = process.env.GOOGLE_APPS_SCRIPT_TOKEN?.trim();

type AppsScriptResponse = {
  ok?: boolean;
  error?: string;
  sentTo?: string[];
  subject?: string;
};

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Nao foi possivel ler o body enviado para os avisos." },
      { status: 400 },
    );
  }

  const validation = validateAvisosPayload(body);

  if (!validation.success) {
    return NextResponse.json({ ok: false, message: validation.message }, { status: 400 });
  }

  if (!APPS_SCRIPT_URL) {
    return NextResponse.json(
      {
        ok: false,
        message: "A variavel GOOGLE_APPS_SCRIPT_URL nao esta configurada no servidor.",
      },
      { status: 500 },
    );
  }

  if (!APPS_SCRIPT_TOKEN) {
    return NextResponse.json(
      {
        ok: false,
        message: "A variavel GOOGLE_APPS_SCRIPT_TOKEN nao esta configurada no servidor.",
      },
      { status: 500 },
    );
  }

  try {
    const appsScriptResponse = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: APPS_SCRIPT_TOKEN,
        ...validation.data,
        tipo: getAppsScriptTipo(validation.data.tipo, validation.data.aviso),
      }),
      cache: "no-store",
    });

    const rawResponse = await appsScriptResponse.text();
    let parsedResponse: AppsScriptResponse | null = null;

    try {
      parsedResponse = rawResponse ? (JSON.parse(rawResponse) as AppsScriptResponse) : null;
    } catch {
      parsedResponse = null;
    }

    if (!appsScriptResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            parsedResponse?.error ||
            "O Google Apps Script respondeu com erro ao processar o envio.",
        },
        { status: 502 },
      );
    }

    if (!parsedResponse?.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            parsedResponse?.error ||
            "O Google Apps Script retornou uma resposta invalida para o disparo.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Aviso enviado com sucesso.",
      sentTo: Array.isArray(parsedResponse.sentTo) ? parsedResponse.sentTo : [],
      subject: typeof parsedResponse.subject === "string" ? parsedResponse.subject : "",
    });
  } catch (error) {
    console.error("Erro ao encaminhar aviso para o Google Apps Script:", error);
    return NextResponse.json(
      {
        ok: false,
        message: "Falha ao conectar com o Google Apps Script para realizar o disparo.",
      },
      { status: 502 },
    );
  }
}
