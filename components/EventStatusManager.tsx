"use client";

import { EventStatusConfig, TimelineItem } from "@/lib/models/EventCertificateModel";
import { toDateTimeLocalValue } from "@/lib/events/formDates";
import {
    AlertCircle,
    CalendarClock,
    CheckCircle2,
    FileCheck2,
    LockKeyhole,
    Megaphone,
    Plus,
    RadioTower,
    Save,
    Trash2,
} from "lucide-react";
import { ObjectId } from "bson";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./EventStatusManager.module.css";

type EventStatusManagerProps = {
    status: EventStatusConfig["status"];
    setStatus: (val: EventStatusConfig["status"]) => void;
    registrationStartDate: string;
    setRegistrationStartDate: (val: string) => void;
    registrationEndDate: string;
    setRegistrationEndDate: (val: string) => void;
    timeLine: TimelineItem[];
    setTimeLine: (val: TimelineItem[]) => void;
    saveAction?: {
        dirty: boolean;
        disabled?: boolean;
        label?: string;
        onSave: () => void;
    };
};

const statusOptions: Array<{
    value: EventStatusConfig["status"];
    label: string;
    description: string;
    icon: React.ReactNode;
}> = [
    {
        value: "DRAFT",
        label: "Rascunho",
        description: "Oculto do publico, bom para preparar dados e templates.",
        icon: <LockKeyhole size={18} />,
    },
    {
        value: "PUBLISHED_OPEN",
        label: "Inscricoes abertas",
        description: "Publicado com periodo de inscricao ativo.",
        icon: <RadioTower size={18} />,
    },
    {
        value: "PUBLISHED_CLOSED",
        label: "Inscricoes fechadas",
        description: "Publicado, mas sem novas inscricoes no momento.",
        icon: <Megaphone size={18} />,
    },
    {
        value: "CERTIFICATE_ONLY",
        label: "Apenas certificados",
        description: "Evento voltado para emissao e consulta de certificados.",
        icon: <FileCheck2 size={18} />,
    },
];

export default function EventStatusManager({
    status,
    setStatus,
    registrationStartDate,
    setRegistrationStartDate,
    registrationEndDate,
    setRegistrationEndDate,
    timeLine,
    setTimeLine,
    saveAction,
}: EventStatusManagerProps) {
    const [timelineError, setTimelineError] = useState<string | null>(null);
    const isPublishedOpen = status === "PUBLISHED_OPEN";
    const isDraft = status === "DRAFT";
    const activeStatus = useMemo(
        () => statusOptions.find((option) => option.value === status) ?? statusOptions[0],
        [status],
    );

    const validateTimeline = useCallback((currentTimeline: TimelineItem[]) => {
        let error: string | null = null;
        const orderedTimeline = [...currentTimeline]
            .filter((item) => item.startDate && item.endDate)
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

        for (let i = 0; i < orderedTimeline.length; i += 1) {
            const item = orderedTimeline[i];
            const start = new Date(item.startDate).getTime();
            const end = new Date(item.endDate).getTime();

            if (Number.isNaN(start) || Number.isNaN(end)) {
                continue;
            }

            if (end <= start) {
                error = "A data de fim deve ser posterior a data de inicio em todas as etapas.";
                break;
            }

            const nextItem = orderedTimeline[i + 1];
            if (!nextItem) {
                continue;
            }

            const nextStart = new Date(nextItem.startDate).getTime();
            if (!Number.isNaN(nextStart) && end > nextStart) {
                error = "Existem horarios conflitantes no cronograma. Uma etapa nao pode cruzar com outra.";
                break;
            }
        }

        setTimelineError(error);
    }, []);

    useEffect(() => {
        validateTimeline(timeLine);
    }, [timeLine, validateTimeline]);

    const sortTimeline = (items: TimelineItem[]) => {
        return [...items].sort((a, b) => {
            const startA = new Date(a.startDate).getTime();
            const startB = new Date(b.startDate).getTime();

            if (Number.isNaN(startA)) {
                return 1;
            }

            if (Number.isNaN(startB)) {
                return -1;
            }

            return startA - startB;
        });
    };

    const addTimelineItem = () => {
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
        const newItem: TimelineItem = {
            id: new ObjectId(),
            startDate: now,
            endDate: oneHourLater,
            description: "",
        };

        setTimeLine(sortTimeline([...timeLine, newItem]));
    };

    const updateTimelineItem = (index: number, field: keyof TimelineItem, value: string) => {
        const nextValue = field === "startDate" || field === "endDate" ? new Date(value) : value;
        const newTimeLine = timeLine.map((item, currentIndex) =>
            currentIndex === index ? { ...item, [field]: nextValue } : item,
        );

        setTimeLine(newTimeLine);
    };

    const removeTimelineItem = (index: number) => {
        setTimeLine(timeLine.filter((_, currentIndex) => currentIndex !== index));
    };

    const handleSortOnBlur = () => {
        if (!timelineError) {
            setTimeLine(sortTimeline(timeLine));
        }
    };

    return (
        <div className={styles.manager}>
            <div className={styles.statusHeader}>
                <div>
                    <span className={styles.eyebrow}>Status atual</span>
                    <h4>{activeStatus.label}</h4>
                    <p>{activeStatus.description}</p>
                </div>

                {saveAction?.dirty && (
                    <button
                        type="button"
                        className="glass-button glass-button-primary"
                        onClick={saveAction.onSave}
                        disabled={saveAction.disabled}
                    >
                        <Save size={16} />
                        <span>{saveAction.label ?? "Salvar status"}</span>
                    </button>
                )}
            </div>

            <div className={styles.statusGrid} role="radiogroup" aria-label="Status do evento">
                {statusOptions.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={status === option.value}
                        className={`${styles.statusOption} ${status === option.value ? styles.active : ""}`}
                        onClick={() => setStatus(option.value)}
                    >
                        <span className={styles.statusIcon}>{option.icon}</span>
                        <span>
                            <strong>{option.label}</strong>
                            <small>{option.description}</small>
                        </span>
                    </button>
                ))}
            </div>

            <section className={`${styles.datePanel} ${isPublishedOpen ? styles.highlight : ""}`}>
                <div className={styles.panelTitle}>
                    <CalendarClock size={18} />
                    <div>
                        <h4>Periodo de inscricoes</h4>
                        <p>Obrigatorio quando o evento estiver com inscricoes abertas.</p>
                    </div>
                </div>

                <div className={styles.dateGrid}>
                    <label className={styles.field}>
                        <span>
                            Inicio das inscricoes
                            <Badge tone={isPublishedOpen ? "required" : "optional"} />
                        </span>
                        <input
                            type="datetime-local"
                            value={registrationStartDate}
                            onChange={(e) => setRegistrationStartDate(e.target.value)}
                            required={isPublishedOpen}
                            className="glass-input"
                        />
                    </label>

                    <label className={styles.field}>
                        <span>
                            Fim das inscricoes
                            <Badge tone={isPublishedOpen ? "required" : "optional"} />
                        </span>
                        <input
                            type="datetime-local"
                            value={registrationEndDate}
                            onChange={(e) => setRegistrationEndDate(e.target.value)}
                            required={isPublishedOpen}
                            className="glass-input"
                        />
                    </label>
                </div>
            </section>

            <section className={styles.timelinePanel}>
                <div className={styles.timelineHeader}>
                    <div>
                        <h4>
                            Cronograma do evento
                            <Badge tone={isDraft ? "optional" : "required"} />
                        </h4>
                        <p>As etapas sao ordenadas por data e usadas para exibir a programacao do evento.</p>
                    </div>

                    <button type="button" onClick={addTimelineItem} className="glass-button glass-button-primary">
                        <Plus size={16} />
                        <span>Adicionar etapa</span>
                    </button>
                </div>

                {timelineError && (
                    <div className={styles.timelineError} role="alert">
                        <AlertCircle size={18} />
                        <span>{timelineError}</span>
                    </div>
                )}

                <div className={styles.timelineList}>
                    {timeLine.map((item, index) => (
                        <article key={String(item.id ?? `${index}-${item.startDate}`)} className={styles.timelineItem}>
                            <div className={styles.timelineNumber}>{String(index + 1).padStart(2, "0")}</div>

                            <label className={styles.field}>
                                <span>Inicio</span>
                                <input
                                    type="datetime-local"
                                    value={toDateTimeLocalValue(item.startDate)}
                                    onChange={(e) => updateTimelineItem(index, "startDate", e.target.value)}
                                    onBlur={handleSortOnBlur}
                                    required={!isDraft}
                                    className="glass-input"
                                />
                            </label>

                            <label className={styles.field}>
                                <span>Fim</span>
                                <input
                                    type="datetime-local"
                                    value={toDateTimeLocalValue(item.endDate)}
                                    onChange={(e) => updateTimelineItem(index, "endDate", e.target.value)}
                                    onBlur={handleSortOnBlur}
                                    required={!isDraft}
                                    className="glass-input"
                                />
                            </label>

                            <label className={`${styles.field} ${styles.descriptionField}`}>
                                <span>Descricao da etapa</span>
                                <input
                                    type="text"
                                    value={item.description}
                                    onChange={(e) => updateTimelineItem(index, "description", e.target.value)}
                                    required={!isDraft}
                                    placeholder="Ex: Palestra de abertura"
                                    className="glass-input"
                                />
                            </label>

                            <button
                                type="button"
                                className={styles.removeButton}
                                onClick={() => removeTimelineItem(index)}
                                title="Remover etapa"
                                aria-label={`Remover etapa ${index + 1}`}
                            >
                                <Trash2 size={18} />
                            </button>
                        </article>
                    ))}

                    {timeLine.length === 0 && (
                        <div className={styles.emptyState}>
                            <CheckCircle2 size={30} />
                            <strong>Nenhuma etapa adicionada.</strong>
                            <p>
                                {isDraft
                                    ? "Voce pode salvar como rascunho sem cronograma."
                                    : "Adicione pelo menos uma etapa para publicar este status."}
                            </p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

function Badge({ tone }: { tone: "required" | "optional" }) {
    return (
        <span className={`${styles.badge} ${tone === "required" ? styles.required : styles.optional}`}>
            {tone === "required" ? "Obrigatorio" : "Opcional"}
        </span>
    );
}
