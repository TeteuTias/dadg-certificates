"use client";

import LoadingPage from "@/components/LoadingPage";
import { IEventCertificate } from "@/lib/models/EventCertificateModel";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import {
    CalendarDays,
    CircleDollarSign,
    ExternalLink,
    Search,
    Settings2,
    Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import "./page.css";

export default function Page() {
    const [isLoading, setLoading] = useState(true);
    const [data, setData] = useState<IEventCertificate[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            const res = await fetch("/api/get/allEvents/");
            if (!res.ok) {
                setLoading(false);
                return;
            }

            const dataJson: { data: IEventCertificate[] } = await res.json();
            setData(dataJson.data);
            setLoading(false);
        };

        fetchData();
    }, []);

    const filteredData = useMemo(() => {
        const query = searchQuery.toLowerCase();

        return data.filter((event) => {
            return (
                event.eventName?.toLowerCase().includes(query) ||
                event.eventDescription?.toLowerCase().includes(query) ||
                String(event._id).toLowerCase().includes(query)
            );
        });
    }, [data, searchQuery]);

    if (isLoading) {
        return <LoadingPage message="Carregando eventos..." />;
    }

    return (
        <main className="events-page" style={PoppinsFontLib.style}>
            <div className="events-shell">
                <header className="events-header fade-in">
                    <div className="events-hero">
                        <span className="events-badge">Gestao de eventos</span>
                        <h1 className="events-title">Todos os eventos</h1>
                        <p className="events-subtitle">
                            Consulte rapidamente cada evento, filtre por nome ou ID e entre direto na configuracao ou nos certificados relacionados.
                        </p>
                    </div>

                    <div className="glass-card events-stats-card">
                        <strong>{data.length}</strong>
                        <span>eventos cadastrados</span>
                    </div>
                </header>

                <section className="events-toolbar fade-in">
                    <label className="glass-card events-search-card">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Pesquisar por nome, descricao ou ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="glass-input events-search-input"
                        />
                    </label>

                    <div className="events-results-pill">
                        <span>{filteredData.length}</span>
                        <small>resultados</small>
                    </div>
                </section>

                <section className="events-list">
                    {filteredData.length === 0 ? (
                        <div className="glass-container events-empty-state">Nenhum evento encontrado.</div>
                    ) : (
                        filteredData.map((event) => <EventCard key={String(event._id)} event={event} />)
                    )}
                </section>
            </div>
        </main>
    );
}

function EventCard({ event }: { event: IEventCertificate }) {
    return (
        <article className="glass-card event-card fade-in">
            <div className="event-card-main">
                <div className="event-card-heading">
                    <span className="event-card-id">{String(event._id)}</span>
                    <h2>{event.eventName}</h2>
                </div>

                <p className="event-card-description">{event.eventDescription}</p>

                <div className="event-card-metrics">
                    <span className="event-card-chip">
                        <CalendarDays size={15} />
                        <span>{event.isOpen ? "Inscricoes abertas" : "Inscricoes fechadas"}</span>
                    </span>
                    <span className="event-card-chip">
                        <Users size={15} />
                        <span>{event.registrationCount || 0}/{event.maxParticipants || 0} participantes</span>
                    </span>
                    <span className="event-card-chip">
                        <CircleDollarSign size={15} />
                        <span>{event.isPaid ? formatCurrency(event.price) : "Gratuito"}</span>
                    </span>
                </div>
            </div>

            <div className="event-card-actions">
                <Link
                    prefetch={false}
                    href={`/todosEventos/modificar/${event._id}`}
                    target="_blank"
                    className="glass-button glass-button-primary event-card-button"
                >
                    <Settings2 size={16} />
                    <span>Editar evento</span>
                </Link>
                <Link
                    prefetch={false}
                    href={`/todosCertificados/${event._id}`}
                    target="_blank"
                    className="glass-button event-card-button"
                >
                    <ExternalLink size={16} />
                    <span>Ver certificados</span>
                </Link>
            </div>
        </article>
    );
}

function formatCurrency(value?: number) {
    if (typeof value !== "number") {
        return "Valor nao informado";
    }

    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
}
