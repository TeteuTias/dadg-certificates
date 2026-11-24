import "server-only";
import { decodeJwt } from "jose";
import * as client from "openid-client";
import { NextResponse, type NextRequest } from "next/server";
import { adminSessionUser } from "@/lib/security/adminSession";
import { authorizationParameters, endSessionParameters, isPrefetch, oidcScope, safeReturnTo, TX_COOKIE } from "./helpers";
import { clearSession, cookieOptions, getSession, seal, SESSION_MAX_AGE, unseal, writeSession } from "./session";

type LoginTransaction = { code_verifier: string; state: string; nonce: string; returnTo: string };

const TX_MAX_AGE = 10 * 60;

function oidcEnv() {
  const issuer = process.env.OIDC_ISSUER?.trim();
  const clientId = process.env.OIDC_CLIENT_ID?.trim();
  const clientSecret = process.env.OIDC_CLIENT_SECRET?.trim();
  const audience = process.env.OIDC_AUDIENCE?.trim();
  const appBaseUrl = process.env.APP_BASE_URL?.trim().replace(/\/$/, "");
  if (!issuer || !clientId || !clientSecret || !audience || !appBaseUrl) {
    throw new Error("OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_AUDIENCE e APP_BASE_URL são obrigatórios");
  }
  return { issuer, clientId, clientSecret, audience, appBaseUrl };
}

let configPromise: Promise<client.Configuration> | null = null;

/** Descoberta cacheada em memória; uma falha é descartada para a próxima tentativa. */
function oidcConfig(): Promise<client.Configuration> {
  if (!configPromise) {
    const { issuer, clientId, clientSecret } = oidcEnv();
    // URL explícita do .well-known: nenhuma normalização de barra no issuer.
    const promise = client
      .discovery(
        new URL(`${issuer}/.well-known/openid-configuration`),
        clientId,
        undefined,
        client.ClientSecretBasic(clientSecret),
      )
      .then((config) => {
        // O id_token é comparado com este valor; ele precisa ser exatamente OIDC_ISSUER.
        if (config.serverMetadata().issuer !== issuer) throw new Error("issuer da descoberta diverge de OIDC_ISSUER");
        return config;
      });
    promise.catch(() => {
      if (configPromise === promise) configPromise = null;
    });
    configPromise = promise;
  }
  return configPromise;
}

const now = () => Math.floor(Date.now() / 1000);

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

async function login(request: NextRequest) {
  const { audience, appBaseUrl } = oidcEnv();
  const config = await oidcConfig();
  const tx: LoginTransaction = {
    code_verifier: client.randomPKCECodeVerifier(),
    state: client.randomState(),
    nonce: client.randomNonce(),
    returnTo: safeReturnTo(request.nextUrl.searchParams.get("returnTo")),
  };
  const url = client.buildAuthorizationUrl(
    config,
    authorizationParameters(request.nextUrl.searchParams, {
      redirectUri: `${appBaseUrl}/auth/callback`,
      scope: oidcScope(audience),
      codeChallenge: await client.calculatePKCECodeChallenge(tx.code_verifier),
      state: tx.state,
      nonce: tx.nonce,
    }),
  );
  const response = NextResponse.redirect(url);
  response.cookies.set(TX_COOKIE, await seal(tx, now() + TX_MAX_AGE), cookieOptions(TX_MAX_AGE));
  return noStore(response);
}

async function callback(request: NextRequest) {
  const { appBaseUrl } = oidcEnv();
  const tx = await unseal<LoginTransaction>(request.cookies.get(TX_COOKIE)?.value);
  if (!tx) throw new Error("transação de login ausente ou expirada");
  const config = await oidcConfig();
  // redirect_uri do token endpoint sai desta URL: usa a base pública, não a interna da plataforma.
  const currentUrl = new URL(`${appBaseUrl}/auth/callback${request.nextUrl.search}`);
  const tokens = await client.authorizationCodeGrant(config, currentUrl, {
    pkceCodeVerifier: tx.code_verifier,
    expectedState: tx.state,
    expectedNonce: tx.nonce,
    idTokenExpected: true,
  });
  const idClaims = tokens.claims();
  if (!idClaims || !tokens.id_token) throw new Error("id_token ausente");
  // Zitadel só põe perfil/papéis no id_token se a aplicação estiver configurada assim; o userinfo completa.
  const userinfo = await client.fetchUserInfo(config, tokens.access_token, idClaims.sub).catch(() => undefined);
  let accessClaims: Record<string, unknown> | undefined;
  try {
    accessClaims = decodeJwt(tokens.access_token); // veio direto do token endpoint; opaco = sem claims
  } catch {
    accessClaims = undefined;
  }

  const response = NextResponse.redirect(new URL(safeReturnTo(tx.returnTo), appBaseUrl));
  response.cookies.set(TX_COOKIE, "", cookieOptions(0));
  await writeSession(
    response,
    request,
    {
      user: adminSessionUser(idClaims, userinfo, accessClaims),
      id_token: tokens.id_token,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      access_token_expires_at: tokens.expires_in ? now() + tokens.expires_in : undefined,
    },
    now() + SESSION_MAX_AGE,
  );
  return noStore(response);
}

async function logout(request: NextRequest) {
  const { appBaseUrl } = oidcEnv();
  const session = await getSession(request);
  let target = new URL("/", appBaseUrl);
  try {
    const config = await oidcConfig();
    if (session?.refresh_token) {
      await client
        .tokenRevocation(config, session.refresh_token, { token_type_hint: "refresh_token" })
        .catch((error) => logAuthError("revocation", error));
    }
    target = client.buildEndSessionUrl(config, endSessionParameters(session?.id_token));
  } catch (error) {
    logAuthError("logout", error);
  }
  const response = NextResponse.redirect(target);
  clearSession(response, request);
  return noStore(response);
}

/** Só a categoria do erro: nada de tokens, claims ou dados pessoais. */
function logAuthError(stage: string, error: unknown) {
  const code = error instanceof Error ? (error as Error & { code?: string }).code || error.name : "UnknownError";
  console.error("[AUTH]", stage, code);
}

function failure(stage: string, error: unknown) {
  logAuthError(stage, error);
  // Página própria em vez de redirecionar: redirecionar para "/" voltaria ao login e poderia entrar em laço.
  const response = new NextResponse(
    '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Erro ao entrar</title>' +
      '<body style="font-family:sans-serif;padding:2rem"><h1>Não foi possível entrar.</h1>' +
      '<p><a href="/auth/login">Tentar novamente</a></p></body></html>',
    { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
  response.cookies.set(TX_COOKIE, "", cookieOptions(0));
  return noStore(response);
}

/** Responde /auth/login, /auth/callback e /auth/logout; o resto segue adiante. */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  try {
    if (pathname === "/auth/login") return await login(request);
    if (pathname === "/auth/callback") return await callback(request);
    if (pathname === "/auth/logout") return isPrefetch(request.headers) ? new NextResponse(null, { status: 204 }) : await logout(request);
  } catch (error) {
    return failure(pathname.slice("/auth/".length), error);
  }
  return NextResponse.next();
}
