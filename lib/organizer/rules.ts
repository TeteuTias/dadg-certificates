/**
 * Organizador pessoal de horas do aluno. Tudo aqui é declarado pelo aluno e
 * não altera nem verifica certificados: o DADG não se responsabiliza por esses
 * dados. Os tipos guardam um código estável para um mapeamento futuro às
 * categorias oficiais de horas complementares.
 */
export const ORGANIZER_TYPES = {
  evento: "Evento",
  extensao: "Extensão",
  monitoria: "Monitoria",
  curso: "Curso",
  congresso: "Congresso ou jornada",
  estagio: "Estágio",
  liga: "Liga acadêmica",
  pesquisa: "Pesquisa",
  outro: "Outro",
} as const;
export type OrganizerType = keyof typeof ORGANIZER_TYPES;

/** Tipo usado para um certificado do DADG que o aluno ainda não classificou. */
export const DADG_DEFAULT_TYPE: OrganizerType = "evento";

// O limite da Vercel para o corpo da requisição é de cerca de 4,5 MB, e o PDF passa pelo site e pelo backend.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_PDF_PAGES = 20;
export const QUOTA_BYTES = 100 * 1024 * 1024;
export const QUOTA_FILES = 60;
export const MAX_HOURS = 1000;

export const isOrganizerType = (value: unknown): value is OrganizerType =>
  typeof value === "string" && Object.hasOwn(ORGANIZER_TYPES, value);

/** Horas a partir do texto livre de carga horária ("4h", "8 horas", "4,5 h"). Sem número legível, null. */
export function parseHours(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const match = value.replace(",", ".").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const hours = Number(match[0]);
  return hours <= MAX_HOURS ? hours : null;
}

/** Horas informadas pelo aluno: número de 0 a 1000, com até uma casa decimal. */
export function readHours(value: unknown): number | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  const hours = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(hours) || hours < 0 || hours > MAX_HOURS) return "invalid";
  return Math.round(hours * 10) / 10;
}

export type UploadFields = {
  title: string;
  type: OrganizerType;
  institution: string;
  date: string;
  hours: number;
};

/** Valida os campos de um certificado enviado pelo aluno. `partial` aceita só os campos presentes (edição). */
export function validateUploadFields(input: Record<string, unknown>, partial = false) {
  const errors: Record<string, string> = {};
  const data: Partial<UploadFields> = {};
  const has = (key: string) => !partial || key in input;

  if (has("title")) {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (title.length < 3 || title.length > 150) errors.title = "Informe um título de 3 a 150 caracteres.";
    else data.title = title;
  }
  if (has("type")) {
    if (!isOrganizerType(input.type)) errors.type = "Escolha um tipo da lista.";
    else data.type = input.type;
  }
  if (has("institution")) {
    const institution = typeof input.institution === "string" ? input.institution.trim() : "";
    if (institution.length > 150) errors.institution = "Use até 150 caracteres.";
    else data.institution = institution;
  }
  if (has("date")) {
    const date = typeof input.date === "string" ? input.date.trim() : "";
    const real = /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);
    if (date && !real) errors.date = "Informe uma data válida.";
    else data.date = date;
  }
  if (has("hours")) {
    const hours = readHours(input.hours);
    if (hours === null || hours === "invalid") errors.hours = `Informe as horas, de 0 a ${MAX_HOURS}.`;
    else data.hours = hours;
  }
  return { data, errors, ok: Object.keys(errors).length === 0 };
}

type DadgRow = { certificateId: string; officialHours: number | null; note?: { type?: string | null; hours?: number | null } | null };
type UploadRow = { type: string; hours: number };

/** Total de horas por tipo: anotação do aluno quando existe, senão a carga oficial; sem horas, não soma. */
export function organizerTotals(dadg: DadgRow[], uploads: UploadRow[]) {
  const totals: Record<string, number> = {};
  let unknownHours = 0;
  const add = (type: string, hours: number | null | undefined) => {
    if (typeof hours !== "number") {
      unknownHours++;
      return;
    }
    totals[type] = Math.round(((totals[type] ?? 0) + hours) * 10) / 10;
  };
  for (const row of dadg) {
    const type = isOrganizerType(row.note?.type) ? row.note.type : DADG_DEFAULT_TYPE;
    add(type, typeof row.note?.hours === "number" ? row.note.hours : row.officialHours);
  }
  for (const row of uploads) add(row.type, row.hours);
  const total = Math.round(Object.values(totals).reduce((sum, value) => sum + value, 0) * 10) / 10;
  return { byType: totals, total, unknownHours };
}
