import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  missingClamFields,
  validateAcademicContact,
  validBirthDate,
  validateProfileInput,
} from "../lib/profile/validation";
import {
  examDate,
  previewImport,
  selectedDay,
} from "../lib/selective-processes/reports/rules";
import {
  exportWorkbook,
  importTemplate,
  parseWorkbook,
} from "../lib/selective-processes/reports/workbooks";
import { reportFixture } from "./fixtures/clam-report";
import { API_ROUTE_MAP } from "../lib/security/route-policies";
import { authorizePrincipal } from "../lib/security/authorization";
const row = (value: unknown) => ({
  sheet: "LAPA",
  row: 2,
  applicationId: "app-1",
  examId: "exam-1",
  registrationNumber: "000123",
  value,
});
const load = async (bytes: Buffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as never);
  return wb;
};
test("profile extensions preserve old clients; CLAM requires every academic/contact field", () => {
  const existing = { name: "Ana de Teste", cpf: "52998224725", period: 3 };
  assert.deepEqual(validateProfileInput(existing).data, existing);
  assert.deepEqual(
    missingClamFields({ ...existing, cpfEncrypted: {}, cpfLookup: "abc" }),
    ["registrationNumber", "birthDate", "phone", "contactEmail"],
  );
  const extra = validateAcademicContact({
    registrationNumber: "000123",
    birthDate: "2000-02-29",
    phone: "(34) 99999-1234",
    contactEmail: "a@example.invalid",
  });
  assert.deepEqual(extra.errors, {});
  assert.equal(extra.data.registrationNumber, "000123");
  assert.equal(extra.data.phone, "34999991234");
  assert.equal(validBirthDate("2001-02-29"), false);
  assert.equal(validBirthDate("2099-01-01"), false);
  assert.equal(
    missingClamFields({
      ...existing,
      ...extra.data,
      cpfEncrypted: {},
      cpfLookup: "abc",
    }).length,
    0,
  );
});
test("Brasilia civil dates and explicit imported days are independent", () => {
  assert.equal(examDate("2026-10-02T01:00:00Z"), "2026-10-01");
  const s = reportFixture();
  assert.equal(selectedDay(s, "exam-1"), 1);
  s.config.mode = "file";
  assert.equal(selectedDay(s, "exam-1"), 2);
  assert.equal(selectedDay(s, "exam-2"), 1);
});
test("blank is unchanged; zero and maximum acertos are valid; invalid values fail", () => {
  for (const value of [null, "", undefined])
    assert.equal(
      previewImport(reportFixture(), "scores", [row(value)]).ignored,
      1,
    );
  for (const value of [0, 15, "12"])
    assert.equal(
      previewImport(reportFixture(), "scores", [row(value)]).changes.length,
      1,
    );
  for (const value of [-1, 16, 1.5, "1,5", "1.5", "Ausente"])
    assert.equal(
      previewImport(reportFixture(), "scores", [row(value)]).errors.length,
      1,
    );
});
test("duplicate, wrong registration, unknown league and inactive candidate are blocked", () => {
  const s = reportFixture();
  assert.equal(previewImport(s, "scores", [row(1), row(2)]).errors.length, 1);
  assert.equal(
    previewImport(s, "scores", [{ ...row(2), registrationNumber: "123" }])
      .errors.length,
    1,
  );
  assert.equal(
    previewImport(s, "scores", [{ ...row(2), applicationId: "other" }]).errors
      .length,
    1,
  );
  assert.equal(
    previewImport(s, "scores", [{ ...row(2), examId: "other" }]).errors.length,
    1,
  );
  s.candidates[1].registrationNumber = "000123";
  assert.equal(previewImport(s, "scores", [row(2)]).errors.length, 1);
});
test("profile or note changes invalidate preview fingerprints", () => {
  const s = reportFixture();
  const original = previewImport(s, "scores", [row(10)]).hash;
  s.candidates[0].scores["exam-1"] = 8;
  assert.notEqual(previewImport(s, "scores", [row(10)]).hash, original);
  s.candidates[0].scores["exam-1"] = null;
  s.candidates[0].name = "Nome corrigido";
  assert.notEqual(previewImport(s, "scores", [row(10)]).hash, original);
});
test("all workbook includes paid candidates without choices and preserves identifiers and dates", async () => {
  const wb = await load(await exportWorkbook(reportFixture(), "all"));
  const ws = wb.worksheets[0];
  assert.equal(ws.rowCount, 3);
  assert.equal(ws.getCell("C2").value, "000123");
  assert.equal(ws.getCell("D2").value, "01234567890");
  assert.equal(
    (ws.getCell("E2").value as Date).toISOString(),
    "2002-03-04T00:00:00.000Z",
  );
  assert.equal(ws.getCell("H3").value, "Provas ainda não escolhidas");
  assert.equal(ws.getCell("H2").value, "LAPA, LPB");
});
test("day reports restrict selected exams; league ratios handle missing and zero vacancies", async () => {
  for (const kind of ["day1", "day2"] as const) {
    const ws = (await load(await exportWorkbook(reportFixture(), kind)))
      .worksheets[0];
    assert.equal(ws.rowCount, 2);
    assert.equal(ws.getCell("E2").value, kind === "day1" ? "LAPA" : "LPB");
  }
  const s = reportFixture();
  let ws = (await load(await exportWorkbook(s, "counts"))).worksheets[0];
  assert.equal(ws.getCell("D2").value, 0.5);
  assert.equal(ws.getCell("D3").value, "Vagas não informadas");
  s.exams[0].seats = 0;
  ws = (await load(await exportWorkbook(s, "counts"))).worksheets[0];
  assert.equal(ws.getCell("D2").value, "Sem vagas");
});
test("correction XLSX round-trip uses stable hidden identity; sheets and zero preserved", async () => {
  const wb = await load(await exportWorkbook(reportFixture(), "scores"));
  assert.equal(wb.worksheets.length, 2);
  const ws = wb.getWorksheet("LAPA")!;
  assert.equal(ws.getColumn(6).hidden, true);
  assert.equal(ws.getCell("E2").value, null);
  ws.getCell("E2").value = 15;
  const rows = await parseWorkbook(
    new Uint8Array(await wb.xlsx.writeBuffer()),
    "scores",
    "process-1",
  );
  assert.equal(rows.length, 2);
  const preview = previewImport(reportFixture(), "scores", rows);
  assert.equal(preview.errors.length, 0);
  assert.equal(preview.changes.length, 1);
  assert.equal(preview.ignored, 1);
});
test("formula cells, wrong process and numeric registration identifiers are rejected", async () => {
  const wb = await load(
    await exportWorkbook(reportFixture(), "scores", "exam-1"),
  );
  const ws = wb.worksheets[0];
  ws.getCell("E2").value = { formula: "1+1", result: 2 };
  await assert.rejects(
    parseWorkbook(
      new Uint8Array(await wb.xlsx.writeBuffer()),
      "scores",
      "process-1",
    ),
    /IMPORT_FORMULA_NOT_ALLOWED/,
  );
  ws.getCell("E2").value = 1;
  ws.getCell("C2").value = 123;
  await assert.rejects(
    parseWorkbook(
      new Uint8Array(await wb.xlsx.writeBuffer()),
      "scores",
      "process-1",
    ),
    /IMPORT_IDENTIFIER_MUST_BE_TEXT/,
  );
  ws.getCell("C2").value = "000123";
  await assert.rejects(
    parseWorkbook(
      new Uint8Array(await wb.xlsx.writeBuffer()),
      "scores",
      "other",
    ),
    /IMPORT_WRONG_PROCESS/,
  );
});
test("days and vacancies models import by unambiguous league; duplicates rejected", async () => {
  const s = reportFixture();
  const bytes = await importTemplate(s, "days");
  const rows = await parseWorkbook(bytes, "days", s.processId);
  assert.equal(rows.length, 2);
  assert.equal(previewImport(s, "days", rows).errors.length, 0);
  assert.equal(
    previewImport(s, "days", [
      { sheet: "Dias", row: 2, league: "LAPA", value: 3 },
    ]).errors.length,
    1,
  );
  assert.equal(
    previewImport(s, "seats", [
      { sheet: "Vagas", row: 2, league: "exam-1", value: 0 },
    ]).changes[0].after,
    0,
  );
  s.exams[1].name = s.exams[0].name;
  assert.equal(
    previewImport(s, "seats", [
      { sheet: "Vagas", row: 2, league: s.exams[0].name, value: 2 },
    ]).errors.length,
    1,
  );
});
test("report endpoints require administrator for downloads and imports", () => {
  for (const [method, action] of [
    ["GET", "summary"],
    ["GET", "export"],
    ["GET", "template"],
    ["POST", "preview"],
    ["POST", "confirm"],
    ["POST", "settings"],
  ]) {
    const path = `/api/admin/selective-processes/selection-processes/${"a".repeat(24)}/reports/${action}`;
    const policy = API_ROUTE_MAP.find(
      (p) =>
        new RegExp(p.path).test(path) && (!p.method || p.method === method),
    );
    assert.equal(policy?.authType, "admin");
    assert.equal(authorizePrincipal("admin", null, false).status, 401);
    assert.equal(authorizePrincipal("admin", "student", false).status, 403);
  }
});
test("reordered same-name candidates keep their own grades using hidden IDs", async () => {
  const s = reportFixture();
  s.candidates[1].name = s.candidates[0].name;
  s.candidates[1].examIds = ["exam-1"];
  const wb = await load(await exportWorkbook(s, "scores", "exam-1"));
  const ws = wb.worksheets[0];
  const first = ws.getRow(2).values;
  ws.getRow(2).values = ws.getRow(3).values;
  ws.getRow(3).values = first;
  ws.getCell("E2").value = 14;
  ws.getCell("E3").value = 0;
  const preview = previewImport(
    s,
    "scores",
    await parseWorkbook(
      new Uint8Array(await wb.xlsx.writeBuffer()),
      "scores",
      s.processId,
    ),
  );
  assert.equal(preview.errors.length, 0);
  assert.deepEqual(
    preview.changes.map((c) => [c.applicationId, c.after]),
    [
      ["app-2", 14],
      ["app-1", 0],
    ],
  );
});
test("duplicate headers, header formulas and tampered ZIP lengths fail before import", async () => {
  const wb = await load(
    await exportWorkbook(reportFixture(), "scores", "exam-1"),
  );
  const ws = wb.worksheets[0];
  ws.getCell("A1").value = "Nota";
  await assert.rejects(
    parseWorkbook(
      new Uint8Array(await wb.xlsx.writeBuffer()),
      "scores",
      "process-1",
    ),
    /INVALID_IMPORT_HEADERS/,
  );
  ws.getCell("A1").value = { formula: '"Nome"', result: "Nome" };
  await assert.rejects(
    parseWorkbook(
      new Uint8Array(await wb.xlsx.writeBuffer()),
      "scores",
      "process-1",
    ),
    /IMPORT_FORMULA_NOT_ALLOWED/,
  );
  const bytes = await exportWorkbook(reportFixture(), "scores", "exam-1");
  const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  bytes.writeUInt32LE(1024 * 1024 * 101, central + 24);
  await assert.rejects(
    parseWorkbook(bytes, "scores", "process-1"),
    /FILE_TOO_LARGE/,
  );
  await assert.rejects(
    parseWorkbook(new Uint8Array([1, 2, 3]), "scores", "process-1"),
    /INVALID_XLSX/,
  );
});
