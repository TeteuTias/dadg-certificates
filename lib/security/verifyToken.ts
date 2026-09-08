import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyOptions } from "jose";

export class AuthConfigurationError extends Error {
  constructor(message = "Student authentication is not configured") {
    super(message);
    this.name = "AuthConfigurationError";
  }
}


// Only fixed diagnostic categories cross the API boundary. Never expose errors,
// token values, cookies, claims, or authentication configuration.
export class StudentTokenError extends Error {
  constructor(readonly diagnostic: string) {
    super("Student token rejected");
    this.name = "StudentTokenError";
  }
}

export function studentTokenDiagnostic(error: unknown): string {
  if (!error || typeof error !== "object") return "AUTH_RUNTIME_ERROR";
  const value = error as { code?: unknown; claim?: unknown };
  if (value.code === "ERR_JWT_CLAIM_VALIDATION_FAILED") {
    if (value.claim === "aud") return "TOKEN_AUDIENCE_MISMATCH";
    if (value.claim === "iss") return "TOKEN_ISSUER_MISMATCH";
    if (value.claim === "nbf") return "TOKEN_NOT_ACTIVE";
    return "TOKEN_CLAIM_INVALID";
  }
  switch (value.code) {
    case "ERR_JWT_EXPIRED": return "TOKEN_EXPIRED";
    case "ERR_JOSE_ALG_NOT_ALLOWED": return "TOKEN_ALGORITHM_REJECTED";
    case "ERR_JWS_SIGNATURE_VERIFICATION_FAILED": return "TOKEN_SIGNATURE_INVALID";
    case "ERR_JWS_INVALID":
    case "ERR_JWT_INVALID": return "TOKEN_FORMAT_INVALID";
    case "ERR_JWKS_TIMEOUT": return "JWKS_TIMEOUT";
    case "ERR_JWKS_NO_MATCHING_KEY": return "JWKS_KEY_NOT_FOUND";
    case "ERR_JWKS_MULTIPLE_MATCHING_KEYS": return "JWKS_MULTIPLE_KEYS";
    case "ERR_JWKS_INVALID": return "JWKS_INVALID";
    case "ERR_JOSE_GENERIC": return "JOSE_PROVIDER_ERROR";
    default: return "AUTH_RUNTIME_ERROR";
  }
}

let cachedIssuer = "";
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export function getStudentAuthConfiguration() {
  const rawIssuer = process.env.AUTH0_DOMAIN?.trim();
  const audience = process.env.AUTH0_AUDIENCE?.trim();
  if (!rawIssuer || !audience) {
    throw new AuthConfigurationError("AUTH0_DOMAIN and AUTH0_AUDIENCE are required");
  }

  let issuer: string;
  try {
    const parsed = new URL(rawIssuer.startsWith("http") ? rawIssuer : `https://${rawIssuer}`);
    parsed.pathname = parsed.pathname.replace(/\/?$/, "/");
    issuer = parsed.toString();
  } catch {
    throw new AuthConfigurationError("AUTH0_DOMAIN is invalid");
  }

  if (!cachedJwks || cachedIssuer !== issuer) {
    cachedIssuer = issuer;
    cachedJwks = createRemoteJWKSet(new URL(".well-known/jwks.json", issuer));
  }

  return { issuer, audience, jwks: cachedJwks };
}

export function studentJwtVerifyOptions(issuer: string, audience: string): JWTVerifyOptions {
  return { algorithms: ["RS256"], clockTolerance: 30, issuer, audience };
}

export async function verifyStudentToken(authorization: string): Promise<JWTPayload | null> {
  if (!authorization.startsWith("Bearer ")) throw new StudentTokenError("AUTHORIZATION_FORMAT_INVALID");
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) throw new StudentTokenError("TOKEN_EMPTY");

  const { issuer, audience, jwks } = getStudentAuthConfiguration();
  try {
    const { payload } = await jwtVerify(token, jwks, studentJwtVerifyOptions(issuer, audience));
    return payload;
  } catch (error) {
    throw new StudentTokenError(studentTokenDiagnostic(error));
  }
}

/** Compatibilidade temporária para handlers existentes. */
export const verifyToken = verifyStudentToken;
