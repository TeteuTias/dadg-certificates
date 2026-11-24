import assert from "node:assert/strict";
import test from "node:test";

// Origem: navegação GET vinda de outro site (Referer) é normal; só Origin conta em métodos seguros.
test("gatekeeper: Referer de outro site não recusa navegação; Origin estranha continua recusada", async () => {
  const anterior = { ...process.env };
  Object.assign(process.env, {
    APP_BASE_URL: "https://certificados.dadg.com.br",
    SESSION_SECRET: "ab".repeat(32),
    DADG_ADMIN_ROLE_NAME: "Administrador",
  });
  try {
    const { NextRequest } = await import("next/server");
    const { seal } = await import("../lib/auth/session");
    const { default: GateKeeper } = await import("../lib/security/gatekeeper");
    const sessao = await seal(
      { user: { sub: "auth0|6a0000000000000000000001", roles: ["Administrador"] }, id_token: "i", access_token: "a" },
      Math.floor(Date.now() / 1000) + 3600,
    );
    const pedir = (path: string, method: string, headers: Record<string, string>) =>
      new GateKeeper(
        new NextRequest(`https://certificados.dadg.com.br${path}`, { method, headers: { cookie: `dadg_admin_session.0=${sessao}`, ...headers } }),
      ).validate();

    // navegação vinda do site do DADG (só Referer): permitida
    const navegacao = await pedir("/event-payments", "GET", { referer: "https://www.dadg.com.br/" });
    assert.equal(navegacao.authorized, true);
    // fetch GET de outro site (Origin não declarada) numa rota com allowedOrigins: 403
    const fetchEstranho = await pedir("/event-payments", "GET", { origin: "https://evil.example" });
    assert.equal(fetchEstranho.authorized, false);
    assert.equal(fetchEstranho.code, "INVALID_REQUEST_ORIGIN");
    // POST de admin com Origin de outro site: 403
    const post = await pedir("/api/v1/admin/profiles/query", "POST", { origin: "https://www.dadg.com.br" });
    assert.equal(post.authorized, false);
    assert.equal(post.code, "INVALID_REQUEST_ORIGIN");
    // POST sem Origin mas com Referer de outro site: 403 (Referer continua valendo em mutações)
    const postReferer = await pedir("/api/v1/admin/profiles/query", "POST", { referer: "https://evil.example/x" });
    assert.equal(postReferer.code, "INVALID_REQUEST_ORIGIN");
    // POST do próprio painel: passa da checagem de origem
    assert.equal((await pedir("/api/v1/admin/profiles/query", "POST", { origin: "https://certificados.dadg.com.br" })).authorized, true);
  } finally {
    process.env = anterior;
  }
});
