import assert from "node:assert/strict";
import test from "node:test";
import { loadIsolated } from "./helpers/isolated";
const id = "507f1f77bcf86cd799439011";
const path = "app/api/v1/certificates/[search]/scan/route.ts";
function scan(published: boolean) {
  let reads = 0;
  const route = loadIsolated(path, {
    "@/lib/security/route-access": {
      withRouteAccess: (handler: unknown) => handler,
    },
    "@/lib/mongodb": { connectToDatabase: async () => undefined },
    mongoose: { Types: { ObjectId: { isValid: () => true } } },
    "@/lib/models/ScanTemplate": {
      findOne: async () => ({ _id: id, templateExtension: "png" }),
    },
    "@/lib/models/CertificateModel": {
      exists: async (filter: Record<string, unknown>) => {
        assert.equal(filter.isReady, true);
        return published;
      },
      findOne: (filter: Record<string, unknown>) => {
        assert.equal(filter.isReady, true);
        return { populate: async () => null };
      },
    },
    "@/lib/certificates/storage": {
      getSignedUrl: async () => {
        reads++;
        return "https://fixture.invalid/image";
      },
    },
  });
  return { route, reads: () => reads };
}
test("scan legado com e sem |front preserva acesso somente para certificado liberado", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]));
  try {
    for (const suffix of ["", "|front"]) {
      const { route, reads } = scan(true);
      const response = await route.GET(
        {},
        { params: Promise.resolve({ search: id + suffix }) },
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "image/png");
      assert.equal(reads(), 1);
    }
    for (const suffix of ["", "|front", "|verse"]) {
      const { route, reads } = scan(false);
      const response = await route.GET(
        {},
        { params: Promise.resolve({ search: id + suffix }) },
      );
      assert.notEqual(response.status, 200);
      assert.equal(reads(), 0);
    }
  } finally {
    globalThis.fetch = original;
  }
});
test("guarda da rota recusa antes de executar a mutação", async () => {
  let called = false;
  const exports = loadIsolated("lib/security/route-access.ts", {
    "./public-rate-limit": { publicRateLimit: () => true },
    "./gatekeeper": class {
      async validate() {
        return { authorized: false, status: 403, code: "FORBIDDEN" };
      }
    },
  });
  const wrap = exports.withRouteAccess as unknown as (
    handler: () => Promise<Response>,
  ) => (request: unknown, context: unknown) => Promise<Response>;
  const handler = wrap(async () => {
    called = true;
    return Response.json({ ok: true });
  });
  assert.equal(
    (
      await handler(
        { method: "POST", nextUrl: { pathname: "/api/v1/certificates/bulk" } },
        {},
      )
    ).status,
    403,
  );
  assert.equal(called, false);
});

test("server action administrativa nega antes de consultar certificados",async()=>{let touched=false;
 const action=loadIsolated("lib/models/src/certificatesHandler/get/GetUserCertificateByEventId.ts",{"@/lib/auth0":{auth0:{getSession:async()=>null}},"@/lib/security/isAdmin":{isAdmin:()=>false},"@/lib/mongodb":{connectToDatabase:async()=>{touched=true;}},"@/lib/models/CertificateModel":{}});
 await assert.rejects(action.default(id),/FORBIDDEN/);assert.equal(touched,false);
});
