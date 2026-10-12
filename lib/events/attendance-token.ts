import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "dadg1";
const PROFILE_ID = /^[a-f0-9]{24}$/;
const SIGNATURE = /^[A-Za-z0-9_-]{22}$/;
const SIGNATURE_BYTES = 16;

export class AttendanceTokenConfigurationError extends Error {
  constructor() {
    super("ATTENDANCE_QR_SECRET is not configured");
    this.name = "AttendanceTokenConfigurationError";
  }
}

function secret(): string | null {
  const value = process.env.ATTENDANCE_QR_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

function signature(profileId: string, key: string): Buffer {
  return createHmac("sha256", key)
    .update(`attendance:v1:${profileId}`)
    .digest()
    .subarray(0, SIGNATURE_BYTES);
}

/**
 * QR Code pessoal do aluno: o ID do perfil acompanhado de uma assinatura do
 * servidor. Nada é gravado no banco e o código não pode ser forjado a partir
 * do ID. Devolve null quando o segredo não está configurado.
 */
export function signAttendanceToken(profileId: string): string | null {
  const key = secret();
  const id = String(profileId).toLowerCase();
  if (!key || !PROFILE_ID.test(id)) return null;
  return `${PREFIX}.${id}.${signature(id, key).toString("base64url")}`;
}

export function isPersonalAttendanceToken(token: string): boolean {
  return token.startsWith(`${PREFIX}.`);
}

/** Devolve o ID do perfil quando a assinatura confere; null para código inválido. */
export function verifyAttendanceToken(token: string): string | null {
  const key = secret();
  if (!key) throw new AttendanceTokenConfigurationError();
  const [prefix, id = "", received = "", ...rest] = token.split(".");
  if (
    prefix !== PREFIX ||
    rest.length > 0 ||
    !PROFILE_ID.test(id) ||
    !SIGNATURE.test(received)
  )
    return null;
  const expected = signature(id, key);
  const actual = Buffer.from(received, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected)
    ? id
    : null;
}
