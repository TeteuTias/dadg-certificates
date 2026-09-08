import { createHash } from "node:crypto";
import { ClamError } from "../domain";
import type {
  ImportKind,
  ImportPreview,
  ImportRow,
  ReportSnapshot,
} from "./types";
export const MAX_ROWS = 50000;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function examDate(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new ClamError("INVALID_EXAM_DATE", 400);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function validScore(value: unknown, questions: number): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= questions
  );
}
export function selectedDay(snapshot: ReportSnapshot, examId: string) {
  const exam = snapshot.exams.find((e) => e.id === examId);
  if (!exam) return null;
  if (snapshot.config.mode === "file") return exam.reportDay;
  return exam.date === snapshot.config.day1
    ? 1
    : exam.date === snapshot.config.day2
      ? 2
      : null;
}
export function previewImport(
  snapshot: ReportSnapshot,
  kind: ImportKind,
  rows: ImportRow[],
): ImportPreview {
  if (!["days", "seats", "scores"].includes(kind) || rows.length > MAX_ROWS)
    throw new ClamError("INVALID_IMPORT", 400);
  const preview: ImportPreview = {
    kind,
    changes: [],
    errors: [],
    ignored: 0,
    hash: "",
  };
  const seen = new Set<string>();
  const candidates = new Map(snapshot.candidates.map((c) => [c.id, c]));
  const registrationCounts = new Map<string, number>();
  for (const candidate of snapshot.candidates)
    registrationCounts.set(
      candidate.registrationNumber,
      (registrationCounts.get(candidate.registrationNumber) || 0) + 1,
    );
  for (const row of rows) {
    const error = (message: string) =>
      preview.errors.push({ sheet: row.sheet, row: row.row, message });
    const matches = snapshot.exams.filter((e) =>
      kind === "scores"
        ? e.id === row.examId
        : [e.id, e.acronym, e.name].some(
            (v) =>
              v &&
              v.trim().toLocaleUpperCase("pt-BR") ===
                row.league?.trim().toLocaleUpperCase("pt-BR"),
          ),
    );
    if (matches.length !== 1) {
      error("Liga desconhecida ou ambígua. Use o ID ou a sigla do modelo.");
      continue;
    }
    const exam = matches[0];
    const candidate =
      kind === "scores" ? candidates.get(row.applicationId || "") : undefined;
    if (kind === "scores") {
      if (!candidate || !candidate.examIds.includes(exam.id)) {
        error("Inscrição sem direito ativo nesta prova.");
        continue;
      }
      if (
        !row.registrationNumber ||
        candidate.registrationNumber !== row.registrationNumber
      ) {
        error("Matrícula divergente ou ausente. Gere uma planilha atualizada.");
        continue;
      }
      if (registrationCounts.get(row.registrationNumber) !== 1) {
        error("Matrícula duplicada. Corrija os perfis antes de importar.");
        continue;
      }
    }
    const key = `${candidate?.id || ""}:${exam.id}`;
    if (seen.has(key)) {
      error("Linha duplicada para a mesma inscrição/prova.");
      continue;
    }
    seen.add(key);
    if (row.value === null || row.value === undefined || row.value === "") {
      preview.ignored++;
      continue;
    }
    const value =
      typeof row.value === "number"
        ? row.value
        : typeof row.value === "string" && /^\d+$/.test(row.value.trim())
          ? Number(row.value.trim())
          : NaN;
    if (
      kind === "scores"
        ? !validScore(value, exam.questionCount)
        : !Number.isSafeInteger(value) ||
          value < 0 ||
          (kind === "days" && value !== 1 && value !== 2)
    ) {
      error(
        kind === "scores"
          ? `Informe acertos inteiros entre 0 e ${exam.questionCount}.`
          : kind === "days"
            ? "Dia deve ser 1 ou 2."
            : "Vagas deve ser um inteiro não negativo.",
      );
      continue;
    }
    const before =
      kind === "scores"
        ? (candidate!.scores[exam.id] ?? null)
        : kind === "days"
          ? exam.reportDay
          : exam.seats;
    if (before === value) {
      preview.ignored++;
      continue;
    }
    preview.changes.push({
      row: row.row,
      sheet: row.sheet,
      applicationId: candidate?.id,
      examId: exam.id,
      candidateName: candidate?.name,
      examName: exam.name,
      before,
      after: value,
    });
  }
  // Includes live participant identity/rights and scores. Any change requires another preview.
  preview.hash = digest({
    processId: snapshot.processId,
    revision: snapshot.revision,
    config: snapshot.config,
    exams: snapshot.exams,
    candidates: snapshot.candidates,
    kind,
    rows,
  });
  return preview;
}
