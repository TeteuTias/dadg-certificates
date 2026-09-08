import type { ReportSnapshot } from "../../lib/selective-processes/reports/types";
export function reportFixture(): ReportSnapshot {
  return {
    processId: "process-1",
    revision: 1,
    generatedAt: "2026-09-07T12:00:00Z",
    config: { mode: "dates", day1: "2026-10-01", day2: "2026-10-02" },
    exams: [
      {
        id: "exam-1",
        name: "Liga da Prova A",
        acronym: "LAPA",
        date: "2026-10-01",
        seats: 2,
        questionCount: 15,
        reportDay: 2,
      },
      {
        id: "exam-2",
        name: "Liga da Prova B",
        acronym: "LPB",
        date: "2026-10-02",
        seats: null,
        questionCount: 20,
        reportDay: 1,
      },
    ],
    candidates: [
      {
        id: "app-1",
        profileId: "profile-1",
        name: "Ana de Teste",
        registrationNumber: "000123",
        cpf: "01234567890",
        birthDate: "2002-03-04",
        period: 3,
        phone: "34999990001",
        contactEmail: "ana@example.invalid",
        missingFields: [],
        examIds: ["exam-1", "exam-2"],
        scores: { "exam-1": null, "exam-2": 0 },
      },
      {
        id: "app-2",
        profileId: "profile-2",
        name: "Bruno de Teste",
        registrationNumber: "000124",
        cpf: "09876543210",
        birthDate: "2001-12-31",
        period: 4,
        phone: "34999990002",
        contactEmail: "bruno@example.invalid",
        missingFields: [],
        examIds: [],
        scores: {},
      },
    ],
  };
}
