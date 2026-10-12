import assert from "node:assert/strict";
import test from "node:test";
import { EventError, pricingChanged } from "../lib/events/rules";
import { buildEventStatusDetails } from "../lib/events/statusDetails";
import {
  applyAttendance,
  attendanceSummary,
  eventStages,
  resolveStage,
  stagePresence,
  suggestedStageId,
} from "../lib/events/attendance";

const STAGE_A = "64a000000000000000000001";
const STAGE_B = "64a000000000000000000002";
const STAGE_C = "64a000000000000000000003";
const STAGE_D = "64a000000000000000000004";

function eventWith(ids: Array<string | undefined>, minAttendancePercent?: number) {
  return {
    minAttendancePercent,
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

function rejects(run: () => unknown, code: string) {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof EventError);
    assert.equal(error.code, code);
    return true;
  });
}

test("cobrança só muda quando preço ou gratuidade mudam de fato", () => {
  const free = { isPaid: false };
  assert.equal(pricingChanged(free, {}), false);
  assert.equal(pricingChanged(free, { isPaid: false, price: 0 }), false);
  const otherField: Record<string, unknown> = { certificateHours: "4 horas" };
  assert.equal(pricingChanged(free, otherField), false);
  assert.equal(pricingChanged(free, { isPaid: true, price: 30 }), true);

  const paid = { isPaid: true, price: 49.9 };
  assert.equal(pricingChanged(paid, { isPaid: true, price: 49.9 }), false);
  assert.equal(pricingChanged(paid, { price: 59.9 }), true);
  assert.equal(pricingChanged(paid, { isPaid: false }), true);
});

test("salvar o cronograma preserva a identidade das etapas existentes", () => {
  const item = (id: string | undefined, hour: number) => ({
    id,
    description: `Etapa ${hour}`,
    startDate: new Date(Date.UTC(2026, 10, 1, hour)).toISOString(),
    endDate: new Date(Date.UTC(2026, 10, 1, hour + 1)).toISOString(),
  });
  const result = buildEventStatusDetails(
    {
      status: "PUBLISHED_CLOSED",
      timeLine: [item(STAGE_A, 9), item(STAGE_D, 11), item(undefined, 13), item(STAGE_A, 15)],
    },
    [{ id: STAGE_A }, { id: STAGE_B }],
  );
  assert.ok(result.statusDetails);
  const ids = (result.statusDetails.timeLine || []).map((stage) => String(stage.id));
  assert.equal(ids[0], STAGE_A, "etapa existente mantém o id");
  assert.notEqual(ids[1], STAGE_D, "id desconhecido não é aceito do cliente");
  assert.equal(new Set(ids).size, 4, "ids nunca se repetem");
  assert.ok(ids.every((id) => /^[a-f0-9]{24}$/.test(id)));
});

test("etapas sem identidade mantêm o evento no modo de presença única", () => {
  assert.equal(eventStages(eventWith([STAGE_A, undefined])), null);
  assert.equal(eventStages({}), null);
  assert.equal(eventStages(eventWith([STAGE_A, STAGE_B]))?.length, 2);
});

test("a etapa sugerida é a em andamento ou a mais próxima no tempo", () => {
  const stages = eventStages(eventWith([STAGE_A, STAGE_B])) || [];
  const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 10, 1, hour, minute));
  assert.equal(suggestedStageId(stages, at(8)), STAGE_A);
  assert.equal(suggestedStageId(stages, at(9, 30)), STAGE_A);
  assert.equal(suggestedStageId(stages, at(10, 5)), STAGE_A, "saída logo após o fim");
  assert.equal(suggestedStageId(stages, at(10, 50)), STAGE_B, "entrada da etapa seguinte");
  assert.equal(suggestedStageId(stages, at(23)), STAGE_B);
  assert.equal(suggestedStageId([], at(9)), null);
});

test("com várias etapas a etapa precisa ser informada e pertencer ao evento", () => {
  const stages = eventStages(eventWith([STAGE_A, STAGE_B])) || [];
  rejects(() => resolveStage(stages, null), "STAGE_REQUIRED");
  rejects(() => resolveStage(stages, STAGE_C), "STAGE_NOT_FOUND");
  assert.equal(resolveStage(stages, STAGE_B).id, STAGE_B);
  const single = eventStages(eventWith([STAGE_A])) || [];
  assert.equal(resolveStage(single, undefined).id, STAGE_A);
});

test("entrada e saída são registradas por etapa, com resumo do evento", () => {
  const stages = eventStages(eventWith([STAGE_A, STAGE_B]));
  const t1 = new Date("2026-11-01T09:05:00Z");
  const t2 = new Date("2026-11-01T10:00:00Z");
  const t3 = new Date("2026-11-01T11:10:00Z");

  rejects(() => applyAttendance({}, stages, "checkout", STAGE_A, t1), "CHECKIN_REQUIRED");

  const entered = applyAttendance({}, stages, "checkin", STAGE_A, t1);
  assert.equal(entered.stageId, STAGE_A);
  assert.deepEqual(entered.summary, {
    checkedIn: true,
    checkedInAt: t1,
    checkedOut: false,
    checkedOutAt: null,
  });
  const afterEntry = { attendance: entered.attendance || [] };
  rejects(() => applyAttendance(afterEntry, stages, "checkin", STAGE_A, t2), "ALREADY_CHECKED_IN");

  const left = applyAttendance(afterEntry, stages, "checkout", STAGE_A, t2);
  const afterExit = { attendance: left.attendance || [] };
  rejects(() => applyAttendance(afterExit, stages, "checkout", STAGE_A, t3), "ALREADY_CHECKED_OUT");
  assert.equal(stagePresence(afterExit, STAGE_A).checkedOut, true);
  assert.equal(stagePresence(afterExit, STAGE_B).checkedIn, false);

  const second = applyAttendance(afterExit, stages, "checkin", STAGE_B, t3);
  assert.equal(second.attendance?.length, 2);
  // Resumo: primeira entrada e última saída do evento.
  assert.deepEqual(second.summary, {
    checkedIn: true,
    checkedInAt: t1,
    checkedOut: true,
    checkedOutAt: t2,
  });

  const removed = applyAttendance({ attendance: second.attendance || [] }, stages, "reset", STAGE_A, t3);
  assert.deepEqual(
    removed.attendance?.map((entry) => entry.stageId),
    [STAGE_B],
  );
  assert.equal(removed.summary.checkedOut, false);
});

test("evento sem identidade de etapa mantém a regra de entrada e saída únicas", () => {
  const now = new Date("2026-11-01T09:00:00Z");
  const entered = applyAttendance({}, null, "checkin", null, now);
  assert.equal(entered.attendance, null);
  assert.equal(entered.summary.checkedIn, true);
  rejects(() => applyAttendance({ checkedIn: true }, null, "checkin", null, now), "ALREADY_CHECKED_IN");
  rejects(() => applyAttendance({}, null, "checkout", null, now), "CHECKIN_REQUIRED");
  const left = applyAttendance({ checkedIn: true, checkedInAt: now }, null, "checkout", null, now);
  assert.equal(left.summary.checkedOut, true);
  assert.equal(applyAttendance({ checkedIn: true, checkedOut: true }, null, "reset", null, now).summary.checkedIn, false);
});

test("certificado exige o percentual mínimo de etapas com entrada e saída", () => {
  const full = (stageId: string) => ({
    stageId,
    checkedInAt: new Date("2026-11-01T09:00:00Z"),
    checkedOutAt: new Date("2026-11-01T10:00:00Z"),
  });
  const entryOnly = (stageId: string) => ({
    stageId,
    checkedInAt: new Date("2026-11-01T09:00:00Z"),
    checkedOutAt: null,
  });
  const four = [STAGE_A, STAGE_B, STAGE_C, STAGE_D];
  const three = { attendance: [full(STAGE_A), full(STAGE_B), full(STAGE_C), entryOnly(STAGE_D)] };

  // Padrão (sem percentual configurado) exige todas as etapas.
  assert.equal(attendanceSummary(eventWith(four), three).eligible, false);
  assert.equal(attendanceSummary(eventWith(four, 100), three).eligible, false);
  const seventyFive = attendanceSummary(eventWith(four, 75), three);
  assert.deepEqual(
    { attended: seventyFive.attended, total: seventyFive.total, eligible: seventyFive.eligible },
    { attended: 3, total: 4, eligible: true },
  );
  assert.equal(attendanceSummary(eventWith(four, 76), three).eligible, false);

  // Entrada sem saída não conta a etapa; sem etapa cumprida não há certificado.
  assert.equal(attendanceSummary(eventWith(four, 1), { attendance: [entryOnly(STAGE_A)] }).eligible, false);
  // Presença em etapa que não pertence mais ao cronograma é ignorada.
  assert.equal(attendanceSummary(eventWith([STAGE_A]), { attendance: [full(STAGE_B)] }).eligible, false);
  assert.equal(attendanceSummary(eventWith([STAGE_A]), { attendance: [full(STAGE_A)] }).eligible, true);
});

test("presença registrada no modelo antigo continua valendo", () => {
  const legacyEvent = eventWith([undefined]);
  assert.equal(attendanceSummary(legacyEvent, { checkedIn: true, checkedOut: true }).eligible, true);
  assert.equal(attendanceSummary(legacyEvent, { checkedIn: true }).eligible, false);
  // Evento que ganhou etapas depois: quem já tinha entrada e saída não perde o direito.
  const migrated = attendanceSummary(eventWith([STAGE_A, STAGE_B]), { checkedIn: true, checkedOut: true });
  assert.deepEqual(
    { legacy: migrated.legacy, attended: migrated.attended, eligible: migrated.eligible },
    { legacy: true, attended: 2, eligible: true },
  );
});
