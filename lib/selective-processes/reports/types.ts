export type ReportKind =
  "all" | "day1" | "day2" | "counts" | "registrations" | "scores";
export type ImportKind = "days" | "seats" | "scores";
export type ReportExam = {
  id: string;
  name: string;
  acronym: string;
  date: string;
  seats: number | null;
  questionCount: number;
  reportDay: number | null;
};
export type ReportCandidate = {
  id: string;
  profileId: string;
  name: string;
  registrationNumber: string;
  birthDate: string;
  period: number | null;
  phone: string;
  contactEmail: string;
  cpf: string;
  missingFields: string[];
  examIds: string[];
  scores: Record<string, number | null>;
};
export type ReportSnapshot = {
  processId: string;
  revision: number;
  generatedAt: string;
  config: { mode: "dates" | "file"; day1: string; day2: string };
  exams: ReportExam[];
  candidates: ReportCandidate[];
};
export type ImportRow = {
  sheet: string;
  row: number;
  league?: string;
  value: unknown;
  applicationId?: string;
  examId?: string;
  registrationNumber?: string;
};
export type Change = {
  row: number;
  sheet: string;
  applicationId?: string;
  examId: string;
  candidateName?: string;
  examName: string;
  before: number | null;
  after: number;
};
export type ImportPreview = {
  kind: ImportKind;
  changes: Change[];
  errors: Array<{ sheet: string; row: number; message: string }>;
  ignored: number;
  hash: string;
};
