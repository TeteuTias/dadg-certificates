// app/api/ouvidoria/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// ===== Config =====
const SCRIPT_URL = process.env.OUVIDORIA_SCRIPT_URL;

const MIN_MESSAGE = 20;
const MAX_MESSAGE = 2000;
const MAX_NAME = 80;

const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 13;

const MIN_TURMA = 1;
const MAX_TURMA = 999;

// Tópicos permitidos (sempre em "forma normalizada")
function topicKey(x: unknown) {
  return String(x ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALLOWED_TOPICS = new Set(
  [
    "infraestrutura",
    "problemas da turma",
    "problemas com a coordenação",
    "problemas com os professores",
    "certificados",
  ].map(topicKey)
);

// ===== Anti-spam: rate limit em memória (5 req/min por IP) =====
const bucket = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = bucket.get(key);

  if (!entry || now > entry.resetAt) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= limit) return { ok: false };

  entry.count += 1;
  return { ok: true };
}

function norm(x: unknown) {
  return String(x ?? "").trim();
}

function onlyDigits(x: unknown) {
  return String(x ?? "").replace(/\D/g, "");
}

function getClientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  try {
    if (!SCRIPT_URL) {
      return NextResponse.json(
        { ok: false, error: "OUVIDORIA_SCRIPT_URL não configurada." },
        { status: 500 }
      );
    }

    const ip = getClientIp(req);
    const rl = rateLimit(ip, 5, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "Muitas tentativas. Aguarde 1 minuto e tente novamente." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const website = norm(body.website);
    if (website) return NextResponse.json({ ok: true });

    const topic = topicKey(body.topic);
    const classNumberRaw = norm(body.classNumber);
    const name = norm(body.name);
    const phone = norm(body.phone ?? body.telefone);
    const phoneDigits = onlyDigits(phone);
    const message = norm(body.message);

    if (!ALLOWED_TOPICS.has(topic)) {
      return NextResponse.json({ ok: false, error: "Tópico inválido." }, { status: 400 });
    }

    const classNumber = parseInt(classNumberRaw, 10);
    if (!Number.isFinite(classNumber) || classNumber < MIN_TURMA || classNumber > MAX_TURMA) {
      return NextResponse.json(
        { ok: false, error: `Turma inválida (use um número entre ${MIN_TURMA} e ${MAX_TURMA}).` },
        { status: 400 }
      );
    }

    if (topic === "certificados" && !name) {
      return NextResponse.json(
        { ok: false, error: "Para o tópico Certificados, o nome completo é obrigatório." },
        { status: 400 }
      );
    }

    if (name.length > MAX_NAME) {
      return NextResponse.json(
        { ok: false, error: `Nome muito longo (máx ${MAX_NAME} caracteres).` },
        { status: 400 }
      );
    }

    if (topic === "certificados") {
      if (
        !phoneDigits ||
        phoneDigits.length < MIN_PHONE_DIGITS ||
        phoneDigits.length > MAX_PHONE_DIGITS
      ) {
        return NextResponse.json(
          { ok: false, error: "Telefone inválido. Informe um número com DDD." },
          { status: 400 }
        );
      }
    } else if (phoneDigits) {
      if (phoneDigits.length < MIN_PHONE_DIGITS || phoneDigits.length > MAX_PHONE_DIGITS) {
        return NextResponse.json(
          { ok: false, error: "Telefone inválido. Informe um número com DDD." },
          { status: 400 }
        );
      }
    }

    if (message.length < MIN_MESSAGE || message.length > MAX_MESSAGE) {
      return NextResponse.json(
        { ok: false, error: `Mensagem inválida (mín ${MIN_MESSAGE}, máx ${MAX_MESSAGE} caracteres).` },
        { status: 400 }
      );
    }

    const payload = {
      topic,
      classNumber,
      name,
      phone,
      message,
      website: "",
    };

    const r = await fetchWithTimeout(
      SCRIPT_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      12_000
    );

    const text = await r.text();
    let data: any = null;

    try {
      data = JSON.parse(text);
    } catch {
      console.error("OUVIDORIA script returned non-JSON:", text.slice(0, 500));
      return NextResponse.json(
        { ok: false, error: "Falha no serviço de envio (resposta inválida do script)." },
        { status: 502 }
      );
    }

    if (!data?.ok) {
      console.error("OUVIDORIA script error:", data);
      return NextResponse.json(
        { ok: false, error: data?.error ?? "Falha ao enviar." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return NextResponse.json(
        { ok: false, error: "Tempo excedido ao enviar. Tente novamente." },
        { status: 504 }
      );
    }

    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}