import assert from "node:assert/strict";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  authorizationParameters,
  COOKIE_CHUNK_SIZE,
  joinCookieParts,
  oidcScope,
  planSessionCookies,
  safeReturnTo,
  splitCookieValue,
} from "../lib/auth/helpers";
import { verifyStudentTokenDetailed } from "../lib/security/verifyToken";

test("returnTo aceita só caminho relativo do próprio site", () => {
  assert.equal(safeReturnTo("/usuarios?x=1"), "/usuarios?x=1");
  assert.equal(safeReturnTo("/"), "/");
  for (const unsafe of [null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "\\\\evil", "/\t/evil.example", "/\n/evil.example", "usuarios"])
    assert.equal(safeReturnTo(unsafe), "/", String(unsafe));
});

test("screen_hint=signup vira prompt=create; sem ele não há prompt", () => {
  const base = { redirectUri: "https://app.test/auth/callback", scope: oidcScope("42"), codeChallenge: "c", state: "s", nonce: "n" };
  const signup = authorizationParameters(new URLSearchParams("screen_hint=signup"), base);
  assert.equal(signup.prompt, "create");
  assert.equal(signup.code_challenge_method, "S256");
  assert.equal(signup.redirect_uri, "https://app.test/auth/callback");
  assert.equal(authorizationParameters(new URLSearchParams(""), base).prompt, undefined);
  assert.equal(authorizationParameters(new URLSearchParams("screen_hint=login"), base).prompt, undefined);
  assert.equal(
    oidcScope("42"),
    "openid profile email offline_access urn:zitadel:iam:org:project:id:42:aud urn:zitadel:iam:org:projects:roles",
  );
});

test("cookie da sessão: divide em partes de até 3800 bytes e junta de volta", () => {
  const value = "a".repeat(COOKIE_CHUNK_SIZE * 2 + 123);
  const parts = splitCookieValue(value);
  assert.equal(parts.length, 3);
  for (const part of parts) assert.ok(Buffer.byteLength(part) <= 3800);

  const { set } = planSessionCookies("dadg_admin_session", value, []);
  assert.deepEqual(set.map(([name]) => name), ["dadg_admin_session.0", "dadg_admin_session.1", "dadg_admin_session.2"]);
  const jar = new Map(set);
  assert.equal(joinCookieParts("dadg_admin_session", (name) => jar.get(name)), value);
  assert.equal(joinCookieParts("dadg_admin_session", () => undefined), null);
});

test("cookie da sessão: apaga partes que sobraram e cookies antigos do mesmo prefixo", () => {
  const existing = [
    "dadg_admin_session.0",
    "dadg_admin_session.1",
    "dadg_admin_session.2",
    "dadg_admin_session",
    "dadg_admin_session__0",
    "dadg_auth_tx",
    "outro_cookie",
  ];
  const smaller = planSessionCookies("dadg_admin_session", "x".repeat(10), existing);
  assert.deepEqual(smaller.set.map(([name]) => name), ["dadg_admin_session.0"]);
  assert.deepEqual(smaller.remove, ["dadg_admin_session.1", "dadg_admin_session.2", "dadg_admin_session", "dadg_admin_session__0"]);

  const cleared = planSessionCookies("dadg_admin_session", null, existing);
  assert.deepEqual(cleared.set, []);
  assert.deepEqual(cleared.remove, existing.slice(0, 5));
});

test("Bearer do aluno: issuer sem barra e JWKS pelo jwks_uri da descoberta", async (t) => {
  const issuer = "https://login.verify.test";
  const audience = "987654321";
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  const requested: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    requested.push(url);
    const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    if (url === `${issuer}/.well-known/openid-configuration`) return json({ issuer, jwks_uri: `${issuer}/oauth/v2/keys` });
    if (url === `${issuer}/oauth/v2/keys`) return json({ keys: [jwk] });
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  const previous = { issuer: process.env.OIDC_ISSUER, audience: process.env.OIDC_AUDIENCE };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (previous.issuer === undefined) delete process.env.OIDC_ISSUER;
    else process.env.OIDC_ISSUER = previous.issuer;
    if (previous.audience === undefined) delete process.env.OIDC_AUDIENCE;
    else process.env.OIDC_AUDIENCE = previous.audience;
  });
  process.env.OIDC_ISSUER = issuer;
  process.env.OIDC_AUDIENCE = audience;

  const sign = (iss: string, aud = audience) =>
    new SignJWT({ sub: "auth0|6a92fab72fd46137ff827a87" })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .setIssuer(iss)
      .setAudience(aud)
      .sign(privateKey);

  const ok = await verifyStudentTokenDetailed(`Bearer ${await sign(issuer)}`);
  assert.equal(ok.payload?.sub, "auth0|6a92fab72fd46137ff827a87");
  assert.ok(requested.includes(`${issuer}/oauth/v2/keys`));
  assert.ok(!requested.some((url) => url.includes("jwks.json")));

  const slash = await verifyStudentTokenDetailed(`Bearer ${await sign(`${issuer}/`)}`);
  assert.equal(slash.failure, "bad_issuer");
  assert.deepEqual(slash.expected, { issuer, audience });

  const wrongAudience = await verifyStudentTokenDetailed(`Bearer ${await sign(issuer, "outro")}`);
  assert.equal(wrongAudience.failure, "bad_audience");

  // Descoberta cacheada: só uma busca do .well-known para as três verificações.
  assert.equal(requested.filter((url) => url.endsWith("/.well-known/openid-configuration")).length, 1);
});
