import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyOptions } from "jose";

export class AuthConfigurationError extends Error {
  constructor(message = "Student authentication is not configured") {
    super(message);
    this.name = "AuthConfigurationError";
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
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;

  const { issuer, audience, jwks } = getStudentAuthConfiguration();
  try {
    const { payload } = await jwtVerify(token, jwks, studentJwtVerifyOptions(issuer, audience));
    return payload;
  } catch {
    // Não registrar o token nem claims pessoais em falhas de autenticação.
    return null;
  }
}

/** Compatibilidade temporária para handlers existentes. */
export const verifyToken = verifyStudentToken;
