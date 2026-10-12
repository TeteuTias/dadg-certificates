"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Loader2, QrCode, Users } from "lucide-react";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import "../todosEventos/[id]/presenca/page.css";

interface AttendanceEvent {
    _id: string;
    eventName: string;
    eventType: string;
    startDate: string;
    endDate: string;
    stages: number;
    finished: boolean;
}

function formatPeriod(event: AttendanceEvent) {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const date: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
    const time: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
    const sameDay = start.toDateString() === end.toDateString();
    return sameDay
        ? `${start.toLocaleDateString("pt-BR", date)}, ${start.toLocaleTimeString("pt-BR", time)} às ${end.toLocaleTimeString("pt-BR", time)}`
        : `${start.toLocaleDateString("pt-BR", date)} a ${end.toLocaleDateString("pt-BR", date)}`;
}

/**
 * Entrada da operação de presença: lista os eventos publicados para o
 * administrador ou o operador escolher onde vai ler os QR Codes.
 */
export default function PresencaEventosPage() {
    const [events, setEvents] = useState<AttendanceEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        fetch("/api/v1/events/attendance")
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || "Não foi possível carregar os eventos.");
                if (active) setEvents(data.data || []);
            })
            .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Erro de conexão."); })
            .finally(() => { if (active) setIsLoading(false); });
        return () => { active = false; };
    }, []);

    return (
        <main className="presenca-page" style={PoppinsFontLib.style}>
            <div className="presenca-shell">
                <header className="presenca-header">
                    <div className="presenca-title-area">
                        <h1 className="presenca-title"><QrCode size={28} />Presença</h1>
                        <p className="presenca-subtitle">Escolha o evento para ler os QR Codes e registrar entradas e saídas.</p>
                    </div>
                </header>

                {isLoading ? (
                    <div className="presenca-loading"><Loader2 size={32} className="spin" /><p>Carregando eventos...</p></div>
                ) : error ? (
                    <div className="glass-card presenca-empty" role="alert"><p>{error}</p></div>
                ) : events.length === 0 ? (
                    <div className="glass-card presenca-empty"><CalendarDays size={40} /><p>Nenhum evento publicado com cronograma.</p></div>
                ) : (
                    <div className="presenca-list">
                        {events.map((event) => (
                            <div key={event._id} className={`glass-card participant-row ${event.finished ? "row-absent" : "row-present"}`}>
                                <div className="participant-info">
                                    <span className="participant-name">{event.eventName}</span>
                                    <span className="participant-email">{formatPeriod(event)}</span>
                                    <span className="participant-cpf">
                                        {event.eventType} · {event.stages} {event.stages === 1 ? "etapa" : "etapas"}{event.finished ? " · encerrado" : ""}
                                    </span>
                                </div>
                                <div className="participant-actions">
                                    <Link href={`/todosEventos/${event._id}/presenca`} className="glass-button glass-button-primary manual-checkin-btn">
                                        <Users size={14} />Abrir lista
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
