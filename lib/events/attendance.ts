import { EventError } from "./rules";

export type AttendanceMode = "checkin" | "checkout" | "reset";

export type Stage = {
  id: string;
  description: string;
  startDate: Date;
  endDate: Date;
};

type DateLike = Date | string | null | undefined;

type AttendanceEntryLike = {
  stageId: unknown;
  checkedInAt?: DateLike;
  checkedOutAt?: DateLike;
};

type EventLike = {
  minAttendancePercent?: number | null;
  statusDetails?: {
    timeLine?: Array<{
      id?: unknown;
      startDate: Date | string;
      endDate: Date | string;
      description?: string;
    }>;
  };
};

type ParticipantLike = {
  attendance?: AttendanceEntryLike[] | null;
  checkedIn?: boolean;
  checkedInAt?: DateLike;
  checkedOut?: boolean;
  checkedOutAt?: DateLike;
};

export type AttendanceEntry = {
  stageId: string;
  checkedInAt: Date | null;
  checkedOutAt: Date | null;
};

export type PresenceSummary = {
  checkedIn: boolean;
  checkedInAt: Date | null;
  checkedOut: boolean;
  checkedOutAt: Date | null;
};

function toDate(value: DateLike): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizedEntries(participant: ParticipantLike): AttendanceEntry[] {
  return (participant.attendance || []).map((entry) => ({
    stageId: String(entry.stageId),
    checkedInAt: toDate(entry.checkedInAt),
    checkedOutAt: toDate(entry.checkedOutAt),
  }));
}

/**
 * Etapas do cronograma com identidade estável. Devolve null quando o evento
 * ainda não tem id nas etapas (cronograma salvo antes da presença por etapa):
 * nesse caso vale uma única entrada e saída para o evento inteiro.
 */
export function eventStages(event: EventLike): Stage[] | null {
  const items = event.statusDetails?.timeLine || [];
  if (!items.length || items.some((item) => !item.id)) return null;
  return items.map((item) => ({
    id: String(item.id),
    description: item.description || "",
    startDate: new Date(item.startDate),
    endDate: new Date(item.endDate),
  }));
}

/** Etapa em andamento ou, fora de qualquer etapa, a mais próxima no tempo. */
export function suggestedStageId(
  stages: Stage[],
  now = new Date(),
): string | null {
  let best: Stage | null = null;
  let bestDistance = Infinity;
  for (const stage of stages) {
    const start = stage.startDate.getTime();
    const end = stage.endDate.getTime();
    const time = now.getTime();
    const distance = time < start ? start - time : time > end ? time - end : 0;
    if (distance < bestDistance || (distance === bestDistance && best && start > best.startDate.getTime())) {
      best = stage;
      bestDistance = distance;
    }
  }
  return best ? best.id : null;
}

/** Com uma única etapa ela é implícita; com várias, precisa ser informada. */
export function resolveStage(
  stages: Stage[],
  stageId: string | null | undefined,
): Stage {
  if (!stageId) {
    if (stages.length === 1) return stages[0];
    throw new EventError(
      "STAGE_REQUIRED",
      400,
      "Informe a etapa do cronograma.",
    );
  }
  const stage = stages.find((item) => item.id === String(stageId));
  if (!stage)
    throw new EventError(
      "STAGE_NOT_FOUND",
      404,
      "Etapa não encontrada neste evento.",
    );
  return stage;
}

export function stagePresence(
  participant: ParticipantLike,
  stageId: string,
): PresenceSummary {
  const entry = normalizedEntries(participant).find(
    (item) => item.stageId === stageId,
  );
  return {
    checkedIn: Boolean(entry?.checkedInAt),
    checkedInAt: entry?.checkedInAt ?? null,
    checkedOut: Boolean(entry?.checkedOutAt),
    checkedOutAt: entry?.checkedOutAt ?? null,
  };
}

function summarize(entries: AttendanceEntry[]): PresenceSummary {
  const entered = entries
    .map((entry) => entry.checkedInAt)
    .filter((date): date is Date => Boolean(date));
  const left = entries
    .map((entry) => entry.checkedOutAt)
    .filter((date): date is Date => Boolean(date));
  return {
    checkedIn: entered.length > 0,
    checkedInAt: entered.length
      ? new Date(Math.min(...entered.map((date) => date.getTime())))
      : null,
    checkedOut: left.length > 0,
    checkedOutAt: left.length
      ? new Date(Math.max(...left.map((date) => date.getTime())))
      : null,
  };
}

/**
 * Aplica entrada, saída ou remoção de presença e devolve o novo estado.
 * Não grava nada: a rota persiste o resultado dentro da transação.
 */
export function applyAttendance(
  participant: ParticipantLike,
  stages: Stage[] | null,
  mode: AttendanceMode,
  stageId: string | null | undefined,
  now = new Date(),
): { stageId: string | null; attendance: AttendanceEntry[] | null; summary: PresenceSummary } {
  if (!stages) {
    const current: PresenceSummary = {
      checkedIn: participant.checkedIn === true,
      checkedInAt: toDate(participant.checkedInAt),
      checkedOut: participant.checkedOut === true,
      checkedOutAt: toDate(participant.checkedOutAt),
    };
    if (mode === "reset")
      return {
        stageId: null,
        attendance: null,
        summary: { checkedIn: false, checkedInAt: null, checkedOut: false, checkedOutAt: null },
      };
    if (mode === "checkout") {
      if (!current.checkedIn)
        throw new EventError("CHECKIN_REQUIRED", 409, "Registre a entrada antes da saída.");
      if (current.checkedOut)
        throw new EventError("ALREADY_CHECKED_OUT", 409, "Saída já registrada.");
      return { stageId: null, attendance: null, summary: { ...current, checkedOut: true, checkedOutAt: now } };
    }
    if (current.checkedIn)
      throw new EventError("ALREADY_CHECKED_IN", 409, "Entrada já registrada.");
    return { stageId: null, attendance: null, summary: { ...current, checkedIn: true, checkedInAt: now } };
  }

  const stage = resolveStage(stages, stageId);
  const entries = normalizedEntries(participant);
  const index = entries.findIndex((entry) => entry.stageId === stage.id);
  const current = index >= 0 ? entries[index] : null;

  if (mode === "reset") {
    if (index >= 0) entries.splice(index, 1);
  } else if (mode === "checkout") {
    if (!current?.checkedInAt)
      throw new EventError(
        "CHECKIN_REQUIRED",
        409,
        "Registre a entrada nesta etapa antes da saída.",
      );
    if (current.checkedOutAt)
      throw new EventError(
        "ALREADY_CHECKED_OUT",
        409,
        "Saída já registrada nesta etapa.",
      );
    current.checkedOutAt = now;
  } else {
    if (current?.checkedInAt)
      throw new EventError(
        "ALREADY_CHECKED_IN",
        409,
        "Entrada já registrada nesta etapa.",
      );
    if (current) current.checkedInAt = now;
    else entries.push({ stageId: stage.id, checkedInAt: now, checkedOutAt: null });
  }

  return { stageId: stage.id, attendance: entries, summary: summarize(entries) };
}

function requiredPercent(value: unknown): number {
  const percent = Number(value);
  return Number.isFinite(percent) && percent >= 1 && percent <= 100
    ? percent
    : 100;
}

/**
 * Etapas cumpridas (entrada e saída) e direito ao certificado frente ao
 * percentual mínimo do evento. Presenças registradas no modelo antigo (uma
 * entrada e uma saída por evento) continuam valendo.
 */
export function attendanceSummary(event: EventLike, participant: ParticipantLike) {
  const stages = eventStages(event);
  const required = requiredPercent(event.minAttendancePercent);
  const entries = normalizedEntries(participant);
  const legacyComplete =
    participant.checkedIn === true && participant.checkedOut === true;

  if (!stages || (entries.length === 0 && legacyComplete)) {
    const total = stages?.length || 1;
    return {
      legacy: true,
      total,
      attended: legacyComplete ? total : 0,
      percent: legacyComplete ? 100 : 0,
      required,
      eligible: legacyComplete,
    };
  }

  const attended = stages.filter((stage) => {
    const presence = stagePresence(participant, stage.id);
    return presence.checkedIn && presence.checkedOut;
  }).length;
  const percent = (attended / stages.length) * 100;
  return {
    legacy: false,
    total: stages.length,
    attended,
    percent,
    required,
    eligible: attended > 0 && percent >= required,
  };
}
