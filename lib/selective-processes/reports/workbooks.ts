import { onlyDigits } from "../../profile/validation";
import ExcelJS from "exceljs";
import { checkXlsxArchive } from "./zip-limits";
import { ClamError } from "../domain";
import { MAX_FILE_BYTES, MAX_ROWS, selectedDay } from "./rules";
import type {
  ImportKind,
  ImportRow,
  ReportCandidate,
  ReportKind,
  ReportSnapshot,
} from "./types";

function sheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: string[],
  rows: unknown[][],
  hidden: string[] = [],
) {
  const base =
    name
      .replace(/[\\/*?:\[\]]/g, " ")
      .trim()
      .slice(0, 27) || "Liga";
  let unique = base;
  let i = 1;
  while (
    workbook.worksheets.some(
      (ws) => ws.name.toLocaleLowerCase() === unique.toLocaleLowerCase(),
    )
  )
    unique = `${base.slice(0, 25)} ${i++}`;
  const ws = workbook.addWorksheet(unique, {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  });
  ws.columns = headers.map((header) => ({
    header,
    key: header,
    width:
      (
        {
          Provas: 50,
          Nome: 40,
          "Nome completo": 40,
          "E-mail": 36,
          RA: 16,
          Matrícula: 16,
          CPF: 18,
          Telefone: 20,
          Nascimento: 18,
          "Data de nascimento": 20,
          Período: 12,
          Nota: 12,
          Liga: 32,
          Dia: 12,
          Inscritos: 12,
          Vagas: 25,
          "Candidatos por vaga": 25,
        } as Record<string, number>
      )[header] || 23,
    hidden: hidden.includes(header),
  }));
  for (const row of rows) ws.addRow(row);
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: {
      row: Math.max(1, ws.rowCount),
      column: headers.length - hidden.length,
    },
  };
  ws.getRow(1).font = {
    name: "Arial",
    size: 11,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  ws.getRow(1).alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF093D75" },
  };
  ws.getRow(1).height = 32;
  ws.eachRow((row, number) => {
    if (number > 1) {
      row.font = { name: "Arial", size: 11, color: { argb: "FF172B4D" } };
      row.alignment = { vertical: "middle", wrapText: true };
      let lines = 1;
      row.eachCell((cell, column) => {
        if (!ws.getColumn(column).hidden && typeof cell.value === "string")
          lines = Math.max(
            lines,
            Math.ceil(
              cell.value.length / ((ws.getColumn(column).width || 20) * 0.9),
            ),
          );
      });
      row.height = Math.max(24, lines * 18);
      if (number % 2 === 0)
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF0F5FA" },
        };
    }
  });
  headers.forEach((header, index) => {
    if (
      [
        "RA",
        "Matrícula",
        "CPF",
        "Telefone",
        "_Inscricao",
        "_Prova",
        "_Processo",
      ].includes(header)
    )
      ws.getColumn(index + 1).numFmt = "@";
    if (header === "Nascimento" || header === "Data de nascimento")
      ws.getColumn(index + 1).numFmt = "dd/mm/yyyy";
  });
  ws.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "1:1",
  };
  return ws;
}
const birth = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T00:00:00Z") : null;
function examsFor(
  snapshot: ReportSnapshot,
  candidate: ReportCandidate,
  day?: number,
) {
  return snapshot.exams.filter(
    (e) =>
      candidate.examIds.includes(e.id) &&
      (!day || selectedDay(snapshot, e.id) === day),
  );
}
export async function exportWorkbook(
  snapshot: ReportSnapshot,
  kind: ReportKind,
  examId?: string,
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DADG";
  wb.created = new Date(snapshot.generatedAt);
  const candidates = [...snapshot.candidates].sort(
    (a, b) =>
      a.name.localeCompare(b.name, "pt-BR") ||
      a.registrationNumber.localeCompare(b.registrationNumber),
  );
  if (kind === "all")
    sheet(
      wb,
      "Todas inscrições",
      [
        "E-mail",
        "Nome completo",
        "RA",
        "CPF",
        "Data de nascimento",
        "Período",
        "Telefone",
        "Provas",
      ],
      candidates.map((c) => [
        c.contactEmail,
        c.name,
        c.registrationNumber,
        c.cpf,
        birth(c.birthDate),
        c.period,
        c.phone,
        examsFor(snapshot, c)
          .map((e) => e.acronym || e.name)
          .join(", ") || "Provas ainda não escolhidas",
      ]),
    );
  else if (kind === "day1" || kind === "day2") {
    const day = kind === "day1" ? 1 : 2;
    sheet(
      wb,
      `Provas dia ${day}`,
      ["Nome completo", "Matrícula", "Nascimento", "Período", "Provas"],
      candidates
        .filter((c) => examsFor(snapshot, c, day).length)
        .map((c) => [
          c.name,
          c.registrationNumber,
          birth(c.birthDate),
          c.period,
          examsFor(snapshot, c, day)
            .map((e) => e.acronym || e.name)
            .join(", "),
        ]),
    );
  } else if (kind === "counts") {
    const ws = sheet(
      wb,
      "Inscritos por liga",
      ["Liga", "Inscritos", "Vagas", "Candidatos por vaga"],
      snapshot.exams.map((e) => {
        const count = candidates.filter((c) => c.examIds.includes(e.id)).length;
        return [
          e.acronym || e.name,
          count,
          e.seats ?? "Vagas não informadas",
          e.seats === null
            ? "Vagas não informadas"
            : e.seats === 0
              ? "Sem vagas"
              : count / e.seats,
        ];
      }),
    );
    ws.getColumn(4).numFmt = "0.00";
  } else if (kind === "registrations" || kind === "scores") {
    const exams = snapshot.exams.filter((e) => !examId || e.id === examId);
    if (examId && !exams.length) throw new ClamError("EXAM_NOT_FOUND", 404);
    for (const exam of exams) {
      const group = candidates.filter((c) => c.examIds.includes(exam.id));
      if (kind === "registrations")
        sheet(
          wb,
          exam.acronym || exam.name,
          ["Matrícula"],
          group.map((c) => [c.registrationNumber]),
        );
      else {
        const ws = sheet(
          wb,
          exam.acronym || exam.name,
          [
            "Nome",
            "Período",
            "Matrícula",
            "Nascimento",
            "Nota",
            "_Inscricao",
            "_Prova",
            "_Processo",
          ],
          group.map((c) => [
            c.name,
            c.period,
            c.registrationNumber,
            birth(c.birthDate),
            c.scores[exam.id] ?? null,
            c.id,
            exam.id,
            snapshot.processId,
          ]),
          ["_Inscricao", "_Prova", "_Processo"],
        );
        for (let row = 2; row <= group.length + 1; row++)
          ws.getCell(row, 5).dataValidation = {
            type: "whole",
            operator: "between",
            formulae: [0, exam.questionCount],
            allowBlank: true,
            showErrorMessage: true,
            error: `Informe de 0 a ${exam.questionCount} acertos inteiros.`,
          };
      }
    }
    if (!exams.length) sheet(wb, "Sem provas", ["Matrícula"], []);
  } else throw new ClamError("INVALID_REPORT", 400);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
export async function importTemplate(
  snapshot: ReportSnapshot,
  kind: "days" | "seats",
) {
  const wb = new ExcelJS.Workbook();
  sheet(
    wb,
    kind === "days" ? "Dias" : "Vagas",
    ["Liga", kind === "days" ? "Dia" : "Vagas"],
    snapshot.exams.map((e) => [
      e.acronym || e.id,
      kind === "days" ? e.reportDay : e.seats,
    ]),
  );
  return Buffer.from(await wb.xlsx.writeBuffer());
}
export async function parseWorkbook(
  bytes: Uint8Array,
  kind: ImportKind,
  processId: string,
): Promise<ImportRow[]> {
  if (!bytes.length || bytes.length > MAX_FILE_BYTES)
    throw new ClamError("FILE_TOO_LARGE", 400);
  const buffer = Buffer.from(bytes);
  checkXlsxArchive(buffer);
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as never);
  } catch {
    throw new ClamError("INVALID_XLSX", 400);
  }
  const rows: ImportRow[] = [];
  for (const ws of wb.worksheets) {
    if (ws.rowCount > MAX_ROWS + 1 || ws.columnCount > 30)
      throw new ClamError("FILE_TOO_LARGE", 400);
    const headers = new Map<string, number>();
    ws.getRow(1).eachCell((cell, col) => {
      if (cell.type === ExcelJS.ValueType.Formula || cell.formula)
        throw new ClamError("IMPORT_FORMULA_NOT_ALLOWED", 400);
      const key = cell.text.trim();
      if (headers.has(key)) throw new ClamError("INVALID_IMPORT_HEADERS", 400);
      headers.set(key, col);
    });
    const required =
      kind === "scores"
        ? ["Matrícula", "Nota", "_Inscricao", "_Prova", "_Processo"]
        : ["Liga", kind === "days" ? "Dia" : "Vagas"];
    if (required.some((name) => !headers.has(name)))
      throw new ClamError("INVALID_IMPORT_HEADERS", 400);
    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      if (!row.hasValues) continue;
      row.eachCell((cell) => {
        if (cell.type === ExcelJS.ValueType.Formula || cell.formula)
          throw new ClamError("IMPORT_FORMULA_NOT_ALLOWED", 400);
      });
      const get = (key: string) => row.getCell(headers.get(key)!).value;
      const text = (key: string) => {
        const value = get(key);
        if (value !== null && typeof value !== "string")
          throw new ClamError("IMPORT_IDENTIFIER_MUST_BE_TEXT", 400);
        return String(value ?? "").trim();
      };
      if (kind === "scores") {
        if (text("_Processo") !== processId)
          throw new ClamError("IMPORT_WRONG_PROCESS", 400);
        rows.push({
          sheet: ws.name,
          row: i,
          applicationId: text("_Inscricao"),
          examId: text("_Prova"),
          registrationNumber: onlyDigits(text("Matrícula")),
          value: get("Nota"),
        });
      } else
        rows.push({
          sheet: ws.name,
          row: i,
          league: text("Liga"),
          value: get(kind === "days" ? "Dia" : "Vagas"),
        });
      if (rows.length > MAX_ROWS) throw new ClamError("FILE_TOO_LARGE", 400);
    }
  }
  if (!rows.length) throw new ClamError("EMPTY_IMPORT", 400);
  return rows;
}
