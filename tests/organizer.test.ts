import assert from "node:assert/strict";
import test from "node:test";
import * as pdfLib from "pdf-lib";
import { ObjectId } from "bson";
import * as rules from "../lib/organizer/rules";
import { API_ROUTE_MAP } from "../lib/security/route-policies";
import { loadIsolated } from "./helpers/isolated";

const { organizerTotals, parseHours, readHours, validateUploadFields } = rules;
type Json = Record<string, unknown>;
const PROFILE = new ObjectId();
const CERT = "6a92fab72fd46137ff827a87";

test("horas do texto livre da carga horária e horas informadas pelo aluno", () => {
  assert.equal(parseHours("4h"), 4);
  assert.equal(parseHours("8 horas"), 8);
  assert.equal(parseHours("4,5 h"), 4.5);
  assert.equal(parseHours(""), null);
  assert.equal(parseHours("carga a definir"), null);
  assert.equal(readHours("2,25"), 2.3);
  assert.equal(readHours(""), null);
  assert.equal(readHours("-1"), "invalid");
  assert.equal(readHours("1001"), "invalid");
});

test("campos do envio: obrigatórios no envio, só os presentes na edição", () => {
  const full = validateUploadFields({ title: "Curso de ECG", type: "curso", hours: "12", date: "2026-02-30" });
  assert.equal(full.ok, false);
  assert.deepEqual(Object.keys(full.errors), ["date"]);
  const ok = validateUploadFields({ title: " Curso de ECG ", type: "curso", hours: "12", institution: "", date: "2026-02-28" });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.data, { title: "Curso de ECG", type: "curso", institution: "", date: "2026-02-28", hours: 12 });
  assert.equal(validateUploadFields({ type: "inventado" }).errors.type, "Escolha um tipo da lista.");
  const partial = validateUploadFields({ hours: 6 }, true);
  assert.equal(partial.ok, true);
  assert.deepEqual(partial.data, { hours: 6 });
});

test("totais usam a anotação do aluno, senão a carga oficial, e não somam o que não tem horas", () => {
  const totals = organizerTotals(
    [
      { certificateId: "a", officialHours: 4, note: null },
      { certificateId: "b", officialHours: 4, note: { type: "extensao", hours: 6 } },
      { certificateId: "c", officialHours: null, note: { type: "liga", hours: null } },
    ],
    [{ type: "curso", hours: 12.5 }],
  );
  assert.deepEqual(totals, { byType: { evento: 4, extensao: 6, curso: 12.5 }, total: 22.5, unknownHours: 1 });
});

test("rotas do organizador são só do aluno", () => {
  const authTypeFor = (method: string, path: string) =>
    API_ROUTE_MAP.find((r) => new RegExp(r.path).test(path) && (!r.method || r.method === method))?.authType;
  for (const [method, path] of [
    ["GET", "/api/v1/user/organizer"],
    ["POST", "/api/v1/user/organizer/uploads"],
    ["PATCH", `/api/v1/user/organizer/uploads/${CERT}`],
    ["DELETE", `/api/v1/user/organizer/uploads/${CERT}`],
    ["GET", `/api/v1/user/organizer/uploads/${CERT}/file`],
    ["PUT", `/api/v1/user/organizer/notes/${CERT}`],
    ["DELETE", `/api/v1/user/organizer/notes/${CERT}`],
  ])
    assert.equal(authTypeFor(method, path), "student", `${method} ${path}`);
});

async function pdfBytes() {
  const doc = await pdfLib.PDFDocument.create();
  doc.addPage();
  return doc.save();
}

function uploadRoute(options: { used?: number[]; createFails?: boolean } = {}) {
  const sent: Json[] = [];
  const created: Json[] = [];
  class Command {
    constructor(public input: Json) {}
  }
  const route = loadIsolated("app/api/v1/user/organizer/uploads/route.ts", {
    "pdf-lib": pdfLib,
    "@aws-sdk/client-s3": { PutObjectCommand: class extends Command {}, DeleteObjectCommand: class extends Command {} },
    mongoose: { Types: { ObjectId } },
    "next/server": {},
    "@/lib/security/route-access": { withRouteAccess: (fn: unknown) => fn },
    "@/lib/events/identity": { eventIdentity: async () => ({ profile: { _id: PROFILE } }) },
    "@/lib/events/rules": { EventError: class extends Error {} },
    "@/lib/certificates/storage": {
      r2: () => ({
        send: async (command: { constructor: { name: string }; input: Json }) => {
          sent.push({ kind: Object.getPrototypeOf(command).constructor === Command ? "?" : command.constructor.name, ...command.input });
        },
      }),
    },
    "@/lib/organizer/models": {
      ExternalCertificate: {
        find: () => ({ select: () => ({ lean: async () => (options.used || []).map((fileSize) => ({ fileSize })) }) }),
        create: async (doc: Json) => {
          if (options.createFails) throw new Error("db");
          created.push(doc);
        },
      },
    },
    "@/lib/organizer/rules": rules,
  });
  const post = (bytes: Uint8Array, fields: Json = { title: "Curso de ECG", type: "curso", hours: "12" }) => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(bytes)], "c.pdf", { type: "application/pdf" }));
    for (const [k, v] of Object.entries(fields)) form.set(k, String(v));
    return route.POST({ headers: { get: () => null }, formData: async () => form });
  };
  return { post, sent, created };
}

test("envio aceita PDF válido, grava no armazenamento e depois o registro", async () => {
  process.env.R2_SUBFOLDER = "certs";
  const { post, sent, created } = uploadRoute();
  const response = await post(await pdfBytes());
  assert.equal(response.status, 201);
  assert.equal(sent.length, 1);
  assert.match(String(sent[0].Key), new RegExp(`^certs/organizer/${PROFILE}/[a-f0-9]{24}\\.pdf$`));
  assert.equal(created[0].title, "Curso de ECG");
  assert.equal(created[0].fileKey, sent[0].Key);
});

test("envio recusa o que não é PDF, campos inválidos e cota cheia", async () => {
  const notPdf = uploadRoute();
  assert.equal((await notPdf.post(new TextEncoder().encode("isto não é um pdf"))).status, 400);
  assert.equal((await notPdf.post(await pdfBytes(), { title: "x", type: "curso", hours: "1" })).status, 400);
  assert.equal(notPdf.sent.length, 0);

  const full = uploadRoute({ used: [rules.QUOTA_BYTES - 10] });
  assert.equal((await full.post(await pdfBytes())).status, 409);
  assert.equal(full.sent.length, 0);
});

test("se o registro falhar, o arquivo enviado é apagado", async () => {
  const { post, sent } = uploadRoute({ createFails: true });
  assert.equal((await post(await pdfBytes())).status, 500);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].Key, sent[0].Key);
});

function notesRoute(owned: boolean) {
  const calls: Json[] = [];
  const route = loadIsolated("app/api/v1/user/organizer/notes/[certificateId]/route.ts", {
    "next/server": {},
    "@/lib/security/route-access": { withRouteAccess: (fn: unknown) => fn },
    "@/lib/events/identity": { eventIdentity: async () => ({ profile: { _id: PROFILE } }) },
    "@/lib/events/rules": { EventError: class extends Error {} },
    "@/lib/models/CertificateModel": { exists: async () => owned },
    "@/lib/organizer/models": {
      CertificateNote: {
        updateOne: async (filter: Json, update: Json) => calls.push({ op: "update", filter, update }),
        deleteOne: async (filter: Json) => calls.push({ op: "delete", filter }),
      },
    },
    "@/lib/organizer/rules": rules,
  });
  const put = (body: Json) => route.PUT({ json: async () => body }, { params: Promise.resolve({ certificateId: CERT }) });
  return { put, calls };
}

test("anotação só vale para certificado da própria conta e nunca toca o certificado", async () => {
  const other = notesRoute(false);
  assert.equal((await other.put({ type: "extensao", hours: 6 })).status, 404);
  assert.equal(other.calls.length, 0);

  const own = notesRoute(true);
  assert.equal((await own.put({ type: "inventado" })).status, 400);
  assert.equal((await own.put({ type: "extensao", hours: "6" })).status, 200);
  assert.deepEqual(own.calls[0].update, {
    $set: { profileId: PROFILE, certificateId: CERT, type: "extensao", hours: 6 },
  });
  assert.equal((await own.put({ type: "", hours: "" })).status, 200);
  assert.equal(own.calls[1].op, "delete");
});
