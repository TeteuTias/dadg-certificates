import assert from "node:assert/strict";
import test from "node:test";
import { API_ROUTE_MAP } from "../lib/security/route-policies";
import { filtroDaBusca, validarAtualizacao } from "../lib/ouvidoria";

test("ouvidoria: rotas do painel exigem administrador", () => {
  const rota = (path: string, method: string) =>
    API_ROUTE_MAP.find((r) => new RegExp(r.path).test(path) && (!r.method || r.method === method));
  for (const [path, method] of [
    ["/ouvidoria", "GET"],
    ["/api/v1/admin/ouvidoria", "GET"],
    ["/api/v1/admin/ouvidoria/0123456789abcdef01234567", "PATCH"],
    ["/api/v1/admin/ouvidoria/0123456789abcdef01234567/anexo", "GET"],
  ]) {
    const r = rota(path, method);
    assert.ok(r, path);
    assert.equal(r.isPublic, false, path);
    assert.equal(r.authType, "admin", path);
  }
  assert.equal(rota("/api/v1/admin/ouvidoria", "DELETE"), undefined);
});

test("ouvidoria: atualização exige andamento válido e resposta ao marcar respondida", () => {
  assert.equal(validarAtualizacao({ status: "x" }).ok, false);
  assert.equal(validarAtualizacao({ status: "respondida", resposta: "  " }).ok, false);
  assert.equal(validarAtualizacao({ status: "em_analise", resposta: "a".repeat(4001) }).ok, false);
  const v = validarAtualizacao({ status: "respondida", resposta: " Resolvido.\r\n " });
  assert.deepEqual(v, { ok: true, dados: { status: "respondida", resposta: "Resolvido.", nota: null } });
});

test("ouvidoria: filtro aceita só valores conhecidos e protocolo sem regex injetada", () => {
  const f = filtroDaBusca(new URLSearchParams({ status: "abertas", tipo: "denuncia", categoria: "$where", protocolo: "ouv-2026.*(a)" }));
  assert.deepEqual(f.status, { $in: ["recebida", "em_analise"] });
  assert.equal(f.tipo, "denuncia");
  assert.equal(f.categoria, undefined);
  const re = (f.protocolo as { $regex: string }).$regex;
  assert.match(re, /^[0-9A-Z?-]+$/);
  assert.ok(new RegExp((filtroDaBusca(new URLSearchParams({ protocolo: "2026ab" })).protocolo as { $regex: string }).$regex).test("OUV-2026-AB12-CD34"));
});
