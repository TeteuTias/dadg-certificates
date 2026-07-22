import { EventStatusConfig, TimelineItem } from "@/lib/models/EventCertificateModel";
import { ObjectId } from "bson";

export const EVENT_STATUS_VALUES: EventStatusConfig["status"][] = [
    "DRAFT",
    "PUBLISHED_OPEN",
    "PUBLISHED_CLOSED",
    "CERTIFICATE_ONLY",
];

type StatusDetailsInput = {
    status?: unknown;
    registrationStartDate?: unknown;
    registrationEndDate?: unknown;
    timeLine?: unknown;
};

type StatusDetailsResult =
    | { statusDetails: EventStatusConfig; error?: never }
    | { statusDetails?: never; error: string };

function parseOptionalDate(value: unknown, fieldName: string): { date?: Date; error?: string } {
    if (value === undefined || value === null || value === "") {
        return {};
    }

    const date = value instanceof Date ? value : new Date(String(value));

    if (Number.isNaN(date.getTime())) {
        return { error: `${fieldName} invalida.` };
    }

    return { date };
}

function parseTimelineInput(value: unknown): { items: unknown[]; error?: string } {
    if (value === undefined || value === null || value === "") {
        return { items: [] };
    }

    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            if (!Array.isArray(parsed)) {
                return { items: [], error: "Formato invalido para o cronograma." };
            }
            return { items: parsed };
        } catch {
            return { items: [], error: "Formato invalido para o cronograma." };
        }
    }

    if (!Array.isArray(value)) {
        return { items: [], error: "Formato invalido para o cronograma." };
    }

    return { items: value };
}

function normalizeTimeline(value: unknown): { timeLine: TimelineItem[]; error?: string } {
    const parsed = parseTimelineInput(value);

    if (parsed.error) {
        return { timeLine: [], error: parsed.error };
    }

    const timeLine: TimelineItem[] = [];

    for (const item of parsed.items) {
        if (!item || typeof item !== "object") {
            return { timeLine: [], error: "Cada etapa do cronograma precisa ser um objeto valido." };
        }

        const record = item as Record<string, unknown>;
        const start = parseOptionalDate(record.startDate, "Data de inicio do cronograma");
        const end = parseOptionalDate(record.endDate, "Data de fim do cronograma");
        const description = typeof record.description === "string" ? record.description.trim() : "";

        if (start.error) {
            return { timeLine: [], error: start.error };
        }

        if (end.error) {
            return { timeLine: [], error: end.error };
        }

        if (!start.date || !end.date || !description) {
            return {
                timeLine: [],
                error: "Preencha inicio, fim e descricao em todas as etapas do cronograma.",
            };
        }

        if (end.date <= start.date) {
            return { timeLine: [], error: "A data de fim deve ser posterior a data de inicio em todas as etapas." };
        }

        timeLine.push({
            id: new ObjectId(),
            startDate: start.date,
            endDate: end.date,
            description,
        });
    }

    const orderedTimeline = timeLine.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    for (let index = 0; index < orderedTimeline.length - 1; index += 1) {
        const current = orderedTimeline[index];
        const next = orderedTimeline[index + 1];

        if (current.endDate > next.startDate) {
            return {
                timeLine: [],
                error: "Existem horarios conflitantes no cronograma. Uma etapa nao pode cruzar com outra.",
            };
        }
    }

    return { timeLine: orderedTimeline };
}

export function buildEventStatusDetails(input: StatusDetailsInput): StatusDetailsResult {
    if (!EVENT_STATUS_VALUES.includes(input.status as EventStatusConfig["status"])) {
        return { error: "Forneca um status valido para o evento." };
    }

    const status = input.status as EventStatusConfig["status"];
    const registrationStart = parseOptionalDate(input.registrationStartDate, "Data de inicio das inscricoes");
    const registrationEnd = parseOptionalDate(input.registrationEndDate, "Data de fim das inscricoes");
    const timelineResult = normalizeTimeline(input.timeLine);

    if (registrationStart.error) {
        return { error: registrationStart.error };
    }

    if (registrationEnd.error) {
        return { error: registrationEnd.error };
    }

    if (registrationStart.date && registrationEnd.date && registrationStart.date >= registrationEnd.date) {
        return { error: "A data de fim das inscricoes deve ser posterior a data de inicio." };
    }

    if (timelineResult.error) {
        return { error: timelineResult.error };
    }

    const { timeLine } = timelineResult;

    if (status === "PUBLISHED_OPEN") {
        if (!registrationStart.date || !registrationEnd.date) {
            return { error: "Eventos com inscricoes abertas exigem data de inicio e fim das inscricoes." };
        }

        if (timeLine.length === 0) {
            return { error: "Eventos publicados exigem pelo menos uma etapa no cronograma." };
        }

        return {
            statusDetails: {
                status,
                timeLine,
                registrationStartDate: registrationStart.date,
                registrationEndDate: registrationEnd.date,
            },
        };
    }

    if (status === "PUBLISHED_CLOSED" || status === "CERTIFICATE_ONLY") {
        if (timeLine.length === 0) {
            return { error: "Eventos publicados ou de certificados exigem pelo menos uma etapa no cronograma." };
        }

        return {
            statusDetails: {
                status,
                timeLine,
                registrationStartDate: registrationStart.date,
                registrationEndDate: registrationEnd.date,
            },
        };
    }

    return {
        statusDetails: {
            status: "DRAFT",
            timeLine: timeLine.length > 0 ? timeLine : undefined,
            registrationStartDate: registrationStart.date,
            registrationEndDate: registrationEnd.date,
        },
    };
}
