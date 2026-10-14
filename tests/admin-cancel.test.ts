import assert from "node:assert/strict";
import test from "node:test";
import * as rules from "../lib/events/rules";
import { loadIsolated } from "./helpers/isolated";

const EVENT_ID = "6a92fab72fd46137ff827a87";
const PARTICIPANT_ID = "507f1f77bcf86cd799439011";

type Json = Record<string, unknown>;

function setup(event: Json | null, participant: Json | null, options: { counter?: number } = {}) {
  const captured: { audits: Json[]; counterFilter?: Json; saved: boolean } = { audits: [], saved: false };
  const doc: Json | null = participant && {
    _id: PARTICIPANT_ID,
    qrToken: "antigo",
    ...participant,
    save: async () => {
      captured.saved = true;
    },
  };
  const registration = loadIsolated("lib/events/registration.ts", {
    "./Audit": {
      EventAudit: {
        create: async (docs: Json[]) => {
          captured.audits.push(...docs);
        },
      },
    },
    "@/lib/models/EventCertificateModel": {
      findById: () => ({
        select: () => ({ session: async () => event }),
        session: async () => event,
      }),
      updateOne: async (filter: Json) => {
        captured.counterFilter = filter;
        return { modifiedCount: options.counter === 0 ? 0 : 1 };
      },
    },
    "@/lib/models/EventParticipant": {
      findOne: () => ({ session: async () => doc }),
    },
    "./PaymentOrder": { EventOrder: {} },
    "./rules": rules,
    "./identity": {
      eventIdentity: async () => ({
        ownerFilter: { profileId: "perfil" },
        identity: { authSubject: "auth0|aluno" },
      }),
    },
    "@/lib/profile/crypto": {},
    "@/lib/selective-processes/services/gateway": {},
    mongoose: {
      startSession: async () => ({
        withTransaction: async (run: () => Promise<void>) => run(),
        endSession: async () => undefined,
      }),
    },
    "node:crypto": { randomUUID: () => "novo" },
  });
  const cancel = (reason = "lançamento duplicado") =>
    registration.cancelRegistrationByAdmin(EVENT_ID, PARTICIPANT_ID, "auth0|admin", reason);
  return { registration, cancel, doc, captured };
}

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: { code?: string }) => error.code === code);
}

test("admin cancela inscrição gratuita com presença, devolve a vaga e audita o motivo", async () => {
  const { cancel, doc, captured } = setup({ isPaid: false }, { status: "CONFIRMED", checkedIn: true });
  await cancel();
  assert.equal(doc?.status, "CANCELLED");
  assert.equal(doc?.cancellationReason, "admin");
  assert.equal(doc?.qrToken, "novo");
  assert.equal(doc?.checkedIn, true, "a presença fica no histórico");
  assert.equal(captured.saved, true);
  assert.deepEqual(captured.counterFilter, { _id: EVENT_ID, registrationCount: { $gt: 0 } });
  assert.equal(captured.audits[0].details, "admin: lançamento duplicado");
  assert.equal(captured.audits[0].actor, "auth0|admin");
});

test("admin não cancela inscrição paga nem com certificado emitido", async () => {
  const paid = setup({ isPaid: true }, { status: "CONFIRMED" });
  await rejectsWith(paid.cancel(), "PAID_REGISTRATION");
  assert.equal(paid.captured.saved, false);

  const issued = setup({ isPaid: false }, { status: "CONFIRMED", certificateId: "cert" });
  await rejectsWith(issued.cancel(), "CERTIFICATE_ALREADY_ISSUED");
  assert.equal(issued.captured.audits.length, 0);
});

test("cancelamento repetido não audita nem mexe na vaga", async () => {
  const { cancel, captured } = setup({ isPaid: false }, { status: "CANCELLED" });
  await cancel();
  assert.equal(captured.audits.length, 0);
  assert.equal(captured.counterFilter, undefined);
});

test("inscrição inexistente e contador zerado são recusados", async () => {
  await rejectsWith(setup({ isPaid: false }, null).cancel(), "REGISTRATION_NOT_FOUND");
  await rejectsWith(
    setup({ isPaid: false }, { status: "CONFIRMED" }, { counter: 0 }).cancel(),
    "COUNTER_REVIEW_REQUIRED",
  );
});

test("cancelamento pelo aluno continua com a mesma transação", async () => {
  const future = new Date(Date.now() + 86_400_000);
  const { registration, doc, captured } = setup(
    { isPaid: false, statusDetails: { timeLine: [{ startDate: future }] } },
    { status: "CONFIRMED", checkedIn: false },
  );
  await registration.cancelRegistration({}, EVENT_ID);
  assert.equal(doc?.status, "CANCELLED");
  assert.equal(doc?.cancellationReason, "student");
  assert.equal(captured.audits[0].details, "student");
});

function route(role: "admin" | "operator") {
  const calls: unknown[][] = [];
  const handler = loadIsolated("app/api/v1/events/[id]/registration/[participantId]/cancel/route.ts", {
    "@/lib/security/route-access": { withRouteAccess: (fn: unknown) => fn },
    "@/lib/security/gatekeeper": class {
      async identifyStaff() {
        return { user: { sub: `auth0|${role}` }, role };
      }
    },
    "@/lib/mongodb": { connectToDatabase: async () => undefined },
    "@/lib/events/registration": {
      cancelRegistrationByAdmin: async (...args: unknown[]) => {
        calls.push(args);
        return { status: "CANCELLED" };
      },
    },
    "@/lib/events/rules": rules,
  }).POST;
  const call = (body: Json) =>
    handler(
      { json: async () => body },
      { params: Promise.resolve({ id: EVENT_ID, participantId: PARTICIPANT_ID }) },
    );
  return { call, calls };
}

test("rota exige motivo e administrador", async () => {
  const admin = route("admin");
  assert.equal((await admin.call({ reason: "  " })).status, 400);
  assert.equal(admin.calls.length, 0);
  assert.equal((await admin.call({ reason: "  aluno pediu  " })).status, 200);
  assert.deepEqual(admin.calls[0], [EVENT_ID, PARTICIPANT_ID, "auth0|admin", "aluno pediu"]);

  const operator = route("operator");
  assert.equal((await operator.call({ reason: "aluno pediu" })).status, 403);
  assert.equal(operator.calls.length, 0);
});
