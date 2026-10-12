import assert from "node:assert/strict";
import test from "node:test";
import * as attendance from "../lib/events/attendance";
import * as attendanceToken from "../lib/events/attendance-token";
import * as ownership from "../lib/events/ownership";
import * as rules from "../lib/events/rules";
import * as validation from "../lib/profile/validation";
import { loadIsolated } from "./helpers/isolated";

const EVENT_ID = "6a92fab72fd46137ff827a87";
const PROFILE_ID = "507f1f77bcf86cd799439011";
const STAGE_A = "64a000000000000000000001";
const STAGE_B = "64a000000000000000000002";
const CPF = "52998224725";

type Json = Record<string, unknown>;
type Handler = (request: unknown, context: unknown) => Promise<Response>;

const context = { params: Promise.resolve({ id: EVENT_ID }) };
const passthrough = { withRouteAccess: (handler: unknown) => handler };
const database = { connectToDatabase: async () => undefined };
const staff = (role: "admin" | "operator") =>
  class {
    async identifyStaff() {
      return { user: { sub: `auth0|${role}` }, role };
    }
    async identifySession() {
      return { sub: `auth0|${role}` };
    }
  };

function stagedEvent(ids: string[], extra: Json = {}) {
  return {
    eventName: "Simpósio",
    isPaid: false,
    maxParticipants: 1,
    registrationCount: 5,
    ...extra,
    statusDetails: {
      timeLine: ids.map((id, index) => ({
        id,
        description: `Etapa ${index + 1}`,
        startDate: new Date(Date.UTC(2026, 10, 1, 9 + index * 2)),
        endDate: new Date(Date.UTC(2026, 10, 1, 10 + index * 2)),
      })),
    },
  };
}

function walkin(event: Json | null, options: { existing?: boolean } = {}) {
  const captured: { filter?: Json; created?: Json; audit?: Json } = {};
  const route = loadIsolated("app/api/v1/events/[id]/walkin/route.ts", {
    "@/lib/events/rules": rules,
    "@/lib/events/attendance": attendance,
    "@/lib/events/Audit": {
      EventAudit: {
        create: async (docs: Json[]) => {
          captured.audit = docs[0];
        },
      },
    },
    mongoose: {
      startSession: async () => ({
        withTransaction: async (run: () => Promise<void>) => run(),
        endSession: async () => undefined,
      }),
    },
    "@/lib/profile/validation": validation,
    "@/lib/profile/crypto": {
      encryptCpf: () => ({ version: "test" }),
      cpfLookup: () => "lookup",
    },
    "@/lib/security/route-access": passthrough,
    "@/lib/models/EventParticipant": {
      exists: () => ({ session: async () => options.existing === true }),
      create: async (docs: Json[]) => {
        captured.created = docs[0];
        return [{ _id: "participant" }];
      },
    },
    "@/lib/models/EventCertificateModel": {
      findById: () => ({ lean: async () => event }),
      updateOne: async (filter: Json) => {
        captured.filter = filter;
        return { modifiedCount: 1 };
      },
    },
    "@/lib/security/gatekeeper": staff("operator"),
    "@/lib/mongodb": database,
    crypto: { randomUUID: () => "uuid" },
  });
  const post = (body: Json) =>
    (route.POST as Handler)({ json: async () => body }, context);
  return { post, captured };
}

const person = { ownerName: "Maria Silva", ownerEmail: "maria@example.test", ownerCpf: CPF };

test("lançamento manual: duplicado responde 409 com mensagem clara", async () => {
  const { post } = walkin(stagedEvent([STAGE_A]), { existing: true });
  const response = await post(person);
  assert.equal(response.status, 409);
  const body = (await response.json()) as Json;
  assert.equal(body.code, "PARTICIPANT_ALREADY_REGISTERED");
  assert.match(String(body.error), /Já existe inscrição/);
});

test("lançamento manual: evento lotado é aceito e a vaga é contada", async () => {
  const { post, captured } = walkin(stagedEvent([STAGE_A]));
  const response = await post(person);
  assert.equal(response.status, 201);
  assert.equal("$expr" in (captured.filter || {}), false, "sem trava de lotação");
  assert.equal(captured.filter?.isPaid, false);
  assert.equal(captured.created?.checkedIn, true);
  assert.equal(captured.created?.ownerCpf, undefined, "CPF não é gravado em claro");
  assert.ok(captured.created?.cpfEncrypted);
  assert.match(String(captured.audit?.details), /^operator stage:/);
});

test("lançamento manual: evento pago continua recusado", async () => {
  const { post, captured } = walkin(stagedEvent([STAGE_A], { isPaid: true, price: 30 }));
  assert.equal((await post(person)).status, 409);
  assert.equal(captured.created, undefined);
});

test("lançamento manual: com várias etapas a entrada vai para a etapa informada", async () => {
  const missing = walkin(stagedEvent([STAGE_A, STAGE_B]));
  const refused = await missing.post(person);
  assert.equal(refused.status, 400);
  assert.equal(((await refused.json()) as Json).code, "STAGE_REQUIRED");
  assert.equal(missing.captured.created, undefined);

  const chosen = walkin(stagedEvent([STAGE_A, STAGE_B]));
  assert.equal((await chosen.post({ ...person, stageId: STAGE_B })).status, 201);
  const entries = chosen.captured.created?.attendance as Array<{ stageId: unknown }>;
  assert.equal(entries.length, 1);
  assert.equal(String(entries[0].stageId), STAGE_B);
});

function participantsRoute(event: Json | null, rows: Json[], role: "admin" | "operator" = "operator") {
  let lastQuery: Json = {};
  const query = (result: Json[]) => {
    const chain = {
      select: () => chain,
      sort: () => chain,
      lean: async () => result,
    };
    return chain;
  };
  const route = loadIsolated("app/api/v1/events/[id]/participants/route.ts", {
    "@/lib/security/route-access": passthrough,
    "@/lib/models/EventParticipant": {
      find: (filter: Json) => {
        lastQuery = filter;
        return query(rows);
      },
    },
    "@/lib/models/EventCertificateModel": {
      findById: () => ({ select: () => ({ lean: async () => event }) }),
    },
    "@/lib/security/gatekeeper": staff(role),
    "@/lib/mongodb": database,
    "@/lib/profile/crypto": {
      cpfLookup: () => "lookup",
      decryptCpf: (value: { broken?: boolean }) => {
        if (value.broken) throw new Error("decrypt failed");
        return CPF;
      },
    },
    "@/lib/profile/validation": validation,
    "@/lib/events/attendance": attendance,
  });
  return {
    get: (search = "") =>
      (route.GET as Handler)(
        { url: `https://fixture.invalid/api/v1/events/${EVENT_ID}/participants${search}` },
        context,
      ),
    post: (body: Json) => (route.POST as Handler)({ json: async () => body }, context),
    lastQuery: () => lastQuery,
  };
}

test("lista de presença devolve CPF mascarado e nunca o CPF, o cifrado ou o código", async () => {
  const t = (hour: number) => new Date(Date.UTC(2026, 10, 1, hour));
  const rows = [
    {
      _id: "p1",
      ownerName: "Ana",
      ownerEmail: "ana@example.test",
      cpfEncrypted: { version: "v1" },
      qrToken: "token-secreto",
      checkedIn: true,
      attendance: [{ stageId: STAGE_A, checkedInAt: t(9), checkedOutAt: t(10) }],
    },
    { _id: "p2", ownerName: "Bruno", ownerCpf: "123.456.789-09", checkedIn: false },
    { _id: "p3", ownerName: "Caio", cpfEncrypted: { broken: true }, checkedIn: false },
  ];
  const { get } = participantsRoute(stagedEvent([STAGE_A, STAGE_B], { minAttendancePercent: 50 }), rows);
  const response = await get(`?stageId=${STAGE_A}`);
  assert.equal(response.status, 200);
  const text = await response.text();
  for (const leaked of [CPF, "12345678909", "123.456.789-09", "token-secreto", "cpfEncrypted", "ownerCpf", "qrToken"])
    assert.equal(text.includes(leaked), false, `não deve conter ${leaked}`);

  const body = JSON.parse(text) as {
    data: Array<Json>;
    meta: Json;
    stages: Json[];
    stageId: string;
    legacyMode: boolean;
    viewer: Json;
  };
  assert.deepEqual(
    body.data.map((item) => item.cpfMasked),
    ["***.***.***-25", "***.***.***-09", "Não informado"],
  );
  assert.equal(body.stageId, STAGE_A);
  assert.equal(body.stages.length, 2);
  assert.equal(body.legacyMode, false);
  assert.deepEqual(body.meta, { total: 3, checkedIn: 1, absent: 2 });
  assert.equal(body.data[0].checkedOut, true);
  assert.equal(body.data[0].attendedStages, 1);
  assert.equal(body.data[0].eligible, true, "1 de 2 etapas atinge o mínimo de 50%");
  assert.equal(body.viewer.role, "operator");

  // Na outra etapa a mesma pessoa aparece sem presença.
  const other = (await (await get(`?stageId=${STAGE_B}`)).json()) as { data: Json[]; meta: Json };
  assert.equal(other.data[0].checkedIn, false);
  assert.equal(other.meta.checkedIn, 0);
});

test("busca por CPF é resolvida no servidor e exige CPF válido", async () => {
  const { post, lastQuery } = participantsRoute(stagedEvent([STAGE_A]), [{ _id: "p1" }]);
  assert.equal((await post({ cpf: "111.111.111-11" })).status, 400);
  assert.equal((await post({ cpf: "123" })).status, 400);

  const response = await post({ cpf: "529.982.247-25" });
  assert.equal(response.status, 200);
  assert.deepEqual(((await response.json()) as Json).participantIds, ["p1"]);
  const alternatives = lastQuery().$or as Json[];
  assert.equal(alternatives[0].cpfLookup, "lookup");
});

function scanRoute(options: { profile?: Json | null; participant?: Json | null; event?: Json | null }) {
  const lean = (value: unknown) => ({ select: () => ({ lean: async () => value }) });
  const route = loadIsolated("app/api/v1/events/[id]/checkin/scan/route.ts", {
    "@/lib/security/route-access": passthrough,
    "@/lib/models/EventParticipant": { findOne: () => lean(options.participant ?? null) },
    "@/lib/models/EventCertificateModel": { findById: () => lean(options.event ?? null) },
    "@/lib/models/UserProfileModel": { findById: () => lean(options.profile ?? null) },
    "@/lib/security/gatekeeper": staff("operator"),
    "@/lib/mongodb": database,
    "@/lib/events/attendance-token": attendanceToken,
    "@/lib/events/ownership": ownership,
    "@/lib/events/attendance": attendance,
    "@/lib/events/rules": rules,
  });
  return (body: Json) => (route.POST as Handler)({ json: async () => body }, context);
}

test("leitura do QR pessoal: valida assinatura, inscrição e etapa", async () => {
  const previous = process.env.ATTENDANCE_QR_SECRET;
  process.env.ATTENDANCE_QR_SECRET = "s".repeat(48);
  try {
    const token = attendanceToken.signAttendanceToken(PROFILE_ID);
    assert.ok(token);
    const profile = { _id: PROFILE_ID, name: "Ana Souza", authSubject: "google-oauth2|1" };
    const event = stagedEvent([STAGE_A, STAGE_B]);
    const participant = {
      _id: "p1",
      ownerName: "Ana Souza",
      ownerEmail: "ana@example.test",
      status: "CONFIRMED",
      checkedIn: true,
      attendance: [{ stageId: STAGE_A, checkedInAt: new Date("2026-11-01T09:00:00Z") }],
    };

    // Assinatura adulterada: mesmo erro genérico de código inválido.
    const forged = `${token.slice(0, token.lastIndexOf(".") + 1)}${"A".repeat(22)}`;
    const invalid = await scanRoute({ profile, participant, event })({ token: forged, stageId: STAGE_A });
    assert.equal(invalid.status, 404);
    assert.equal(((await invalid.json()) as Json).code, "INVALID_CODE");

    const notRegistered = await scanRoute({ profile, participant: null, event })({ token, stageId: STAGE_A });
    assert.equal(notRegistered.status, 404);
    const missing = (await notRegistered.json()) as Json;
    assert.equal(missing.code, "NOT_REGISTERED");
    assert.equal(missing.ownerName, "Ana Souza");

    const pending = await scanRoute({ profile, participant: { ...participant, status: "PENDING" }, event })({
      token,
      stageId: STAGE_A,
    });
    assert.equal(pending.status, 409);
    assert.equal(((await pending.json()) as Json).code, "REGISTRATION_PENDING");

    const noStage = await scanRoute({ profile, participant, event })({ token });
    assert.equal(noStage.status, 400);
    assert.equal(((await noStage.json()) as Json).code, "STAGE_REQUIRED");

    const scan = scanRoute({ profile, participant, event });
    const first = ((await (await scan({ token, stageId: STAGE_A })).json()) as { data: Json }).data;
    assert.deepEqual(
      { id: first.participantId, stage: first.stageId, entered: first.alreadyCheckedIn, left: first.alreadyCheckedOut },
      { id: "p1", stage: STAGE_A, entered: true, left: false },
    );
    const second = ((await (await scan({ token, stageId: STAGE_B })).json()) as { data: Json }).data;
    assert.equal(second.alreadyCheckedIn, false, "a presença é por etapa");
  } finally {
    if (previous === undefined) delete process.env.ATTENDANCE_QR_SECRET;
    else process.env.ATTENDANCE_QR_SECRET = previous;
  }
});

test("leitura do QR pessoal sem segredo configurado responde 503", async () => {
  const previous = process.env.ATTENDANCE_QR_SECRET;
  delete process.env.ATTENDANCE_QR_SECRET;
  try {
    const response = await scanRoute({})({ token: `dadg1.${PROFILE_ID}.${"A".repeat(22)}` });
    assert.equal(response.status, 503);
  } finally {
    if (previous !== undefined) process.env.ATTENDANCE_QR_SECRET = previous;
  }
});
