import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTPayload, type JWTVerifyOptions } from "jose";

export class AuthConfigurationError extends Error {
  constructor(message = "Student authentication is not configured") {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

/**
 * Categoria tecnica da falha de autenticacao do aluno. Nunca carrega token,
 * claims ou dados pessoais: serve apenas para separar erro de configuracao de
 * erro de credencial ao investigar um 401 em producao.
 */
export type StudentTokenFailure =
  | "no_credential"
  | "malformed"
  | "expired"
  | "bad_audience"
  | "bad_issuer"
  | "bad_signature"
  | "jwks_unavailable"
  | "invalid_claims";

export type StudentTokenResult =
  | { payload: JWTPayload; failure?: never; expected?: never }
  | { payload: null; failure: StudentTokenFailure; expected?: { issuer: string; audience: string } };

type RemoteJwks = ReturnType<typeof createRemoteJWKSet>;
let cachedIssuer = "";
let cachedJwks: Promise<RemoteJwks> | null = null;

/** issuer = OIDC_ISSUER exatamente como está: o `iss` do Zitadel não tem barra no fim. */
export function getStudentAuthConfiguration() {
  const issuer = process.env.OIDC_ISSUER?.trim();
  const audience = process.env.OIDC_AUDIENCE?.trim();
  if (!issuer || !audience) {
    throw new AuthConfigurationError("OIDC_ISSUER and OIDC_AUDIENCE are required");
  }
  try {
    new URL(issuer);
  } catch {
    throw new AuthConfigurationError("OIDC_ISSUER is invalid");
  }
  return { issuer, audience };
}

/** Chaves pelo `jwks_uri` da descoberta (no Zitadel é /oauth/v2/keys), cacheadas por issuer. */
export function studentJwks(issuer: string): Promise<RemoteJwks> {
  if (!cachedJwks || cachedIssuer !== issuer) {
    cachedIssuer = issuer;
    const promise = fetch(`${issuer}/.well-known/openid-configuration`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`discovery fetch failed: HTTP ${response.status}`);
      const metadata = (await response.json()) as { issuer?: unknown; jwks_uri?: unknown };
      if (metadata.issuer !== issuer || typeof metadata.jwks_uri !== "string") {
        throw new Error("discovery fetch returned unexpected issuer or jwks_uri");
      }
      return createRemoteJWKSet(new URL(metadata.jwks_uri));
    });
    promise.catch(() => {
      if (cachedJwks === promise) cachedJwks = null;
    });
    cachedJwks = promise;
  }
  return cachedJwks;
}

export function studentJwtVerifyOptions(issuer: string, audience: string): JWTVerifyOptions {
  return { algorithms: ["RS256"], clockTolerance: 30, issuer, audience };
}

function classify(error: unknown): StudentTokenFailure {
  if (error instanceof joseErrors.JWTExpired) return "expired";
  if (error instanceof joseErrors.JWSSignatureVerificationFailed) return "bad_signature";
  if (error instanceof joseErrors.JWKSNoMatchingKey || error instanceof joseErrors.JWKSMultipleMatchingKeys) {
    return "bad_signature";
  }
  if (error instanceof joseErrors.JWKSTimeout || error instanceof joseErrors.JWKSInvalid) return "jwks_unavailable";
  if (error instanceof joseErrors.JWTInvalid || error instanceof joseErrors.JWSInvalid) return "malformed";
  if (error instanceof joseErrors.JWTClaimValidationFailed) {
    if (error.claim === "aud") return "bad_audience";
    if (error.claim === "iss") return "bad_issuer";
    return "invalid_claims";
  }
  // A busca das chaves publicas falha como erro de rede, sem classe propria.
  if (error instanceof Error && /fetch|network|ENOTFOUND|ECONN|timeout/i.test(error.message)) {
    return "jwks_unavailable";
  }
  return "invalid_claims";
}

/**
 * Verifica o Bearer do aluno e, quando falha, devolve a categoria tecnica do
 * erro junto do issuer/audience esperados. Ambos os valores esperados ja sao
 * publicos (aparecem no redirect de login do site do aluno).
 */
export async function verifyStudentTokenDetailed(
  authorization: string | null,
): Promise<StudentTokenResult> {
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return { payload: null, failure: "no_credential" };
  }
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return { payload: null, failure: "no_credential" };

  const { issuer, audience } = getStudentAuthConfiguration();
  try {
    const jwks = await studentJwks(issuer);
    const { payload } = await jwtVerify(token, jwks, studentJwtVerifyOptions(issuer, audience));
    if (!payload.sub) return { payload: null, failure: "invalid_claims", expected: { issuer, audience } };
    return { payload };
  } catch (error) {
    // Nao registrar o token nem claims pessoais em falhas de autenticacao.
    return { payload: null, failure: classify(error), expected: { issuer, audience } };
  }
}

export async function verifyStudentToken(authorization: string): Promise<JWTPayload | null> {
  return (await verifyStudentTokenDetailed(authorization)).payload;
}

/** Compatibilidade temporária para handlers existentes. */
export const verifyToken = verifyStudentToken;
