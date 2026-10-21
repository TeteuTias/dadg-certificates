import assert from "node:assert/strict";
import test from "node:test";
import {
  Auth0ManagementError,
  hasOperatorRole,
  operatorManagementConfigured,
  setOperatorRole,
} from "../lib/security/auth0-management";

const ENV = {
  AUTH0_DOMAIN: "dadg.us.auth0.com",
  AUTH0_MANAGEMENT_CLIENT_ID: "m2m",
  AUTH0_MANAGEMENT_CLIENT_SECRET: "segredo",
  DADG_OPERATOR_ROLE_NAME: "Operador",
};

test("sem credencial de gerenciamento a gestão de operadores fica desligada", async () => {
  for (const key of Object.keys(ENV)) delete process.env[key];
  assert.equal(operatorManagementConfigured(), false);
  await assert.rejects(hasOperatorRole("auth0|x"), (e: unknown) => e instanceof Auth0ManagementError && e.code === "NOT_CONFIGURED");
});

test("consulta, dá e tira a role exata de operador", async () => {
  Object.assign(process.env, ENV);
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method || "GET", body: init?.body as string | undefined });
    const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
    if (url.endsWith("/oauth/token")) return json({ access_token: "tok", expires_in: 3600 });
    // name_filter devolve também nomes parecidos; só o exato vale.
    if (url.includes("/roles?name_filter=")) return json([{ id: "rol_admin", name: "Operador Chefe" }, { id: "rol_op", name: "Operador" }]);
    if (url.includes("/users/") && (init?.method || "GET") === "GET") return json([{ id: "rol_op" }]);
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  try {
    assert.equal(operatorManagementConfigured(), true);
    assert.equal(await hasOperatorRole("google-oauth2|123"), true);
    await setOperatorRole("google-oauth2|123", false);
    const remove = calls.at(-1)!;
    assert.equal(remove.method, "DELETE");
    assert.equal(remove.url, "https://dadg.us.auth0.com/api/v2/users/google-oauth2%7C123/roles");
    assert.deepEqual(JSON.parse(remove.body!), { roles: ["rol_op"] });
    await setOperatorRole("google-oauth2|123", true);
    assert.equal(calls.at(-1)!.method, "POST");
    assert.equal(calls.filter((c) => c.url.endsWith("/oauth/token")).length, 1, "token reaproveitado");
  } finally {
    globalThis.fetch = original;
    for (const key of Object.keys(ENV)) delete process.env[key];
  }
});
