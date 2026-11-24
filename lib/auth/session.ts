// Sem `import "server-only"`: o gatekeeper depende deste módulo e os testes o carregam em Node puro. Usa next/headers, então só roda no servidor.
import { EncryptJWT, jwtDecrypt, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { joinCookieParts, planSessionCookies, SESSION_COOKIE } from "./helpers";
import type { Session } from "./types";

export type { Session, User } from "./types";

export const SESSION_MAX_AGE = 14 * 24 * 60 * 60;

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || !/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error("SESSION_SECRET precisa ter 64 caracteres hexadecimais");
  }
  return Buffer.from(secret, "hex");
}

/** Cifra o payload até `expiresAt` (segundos desde a época). */
export async function seal(payload: JWTPayload, expiresAt: number): Promise<string> {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .encrypt(secretKey());
}

export async function unseal<T>(token: string | null | undefined): Promise<(T & JWTPayload) | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, secretKey(), {
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });
    return payload as T & JWTPayload;
  } catch {
    return null;
  }
}

export function cookieOptions(maxAge: number) {
  const base = process.env.APP_BASE_URL?.trim() || "";
  return {
    httpOnly: true,
    secure: !base.startsWith("http://localhost"),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Mesma API de antes: sem argumento lê os cookies da requisição atual (RSC/route handler). */
export async function getSession(request?: NextRequest): Promise<Session | null> {
  const store = request ? request.cookies : await cookies();
  const raw = joinCookieParts(SESSION_COOKIE, (name) => store.get(name)?.value);
  const session = await unseal<Session>(raw);
  if (!session?.user?.sub) return null;
  const { user, id_token, refresh_token, access_token, access_token_expires_at } = session;
  return { user, id_token, refresh_token, access_token, access_token_expires_at };
}

export async function writeSession(response: NextResponse, request: NextRequest, session: Session, expiresAt: number) {
  const value = await seal(session as unknown as JWTPayload, expiresAt);
  const plan = planSessionCookies(SESSION_COOKIE, value, request.cookies.getAll().map((c) => c.name));
  const maxAge = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
  for (const [name, part] of plan.set) response.cookies.set(name, part, cookieOptions(maxAge));
  for (const name of plan.remove) response.cookies.set(name, "", cookieOptions(0));
}

export function clearSession(response: NextResponse, request: NextRequest) {
  const plan = planSessionCookies(SESSION_COOKIE, null, request.cookies.getAll().map((c) => c.name));
  for (const name of plan.remove) response.cookies.set(name, "", cookieOptions(0));
}
