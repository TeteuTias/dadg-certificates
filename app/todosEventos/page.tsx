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

const PAGE_SIZE = 48;

type EventsResponse = {
    data: IEventCertificate[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
};

export default function Page() {
    const [isLoading, setLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [data, setData] = useState<IEventCertificate[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeQuery, setActiveQuery] = useState("");
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setPage(1);
            setActiveQuery(searchQuery.trim());
        }, 300);

        return () => window.clearTimeout(timeout);
    }, [searchQuery]);

    useEffect(() => {
        const fetchData = async () => {
            if (page === 1) {
                setLoading(true);
            } else {
                setIsLoadingMore(true);
            }

            const searchParams = new URLSearchParams({
                page: String(page),
                limit: String(PAGE_SIZE),
            });

            if (activeQuery) {
                searchParams.set("search", activeQuery);
            }

            const res = await fetch(`/api/get/allEvents/?${searchParams.toString()}`);
            if (!res.ok) {
                setLoading(false);
                setIsLoadingMore(false);
                return;
            }

            const dataJson: EventsResponse = await res.json();

            setData((prev) => (page === 1 ? dataJson.data : [...prev, ...dataJson.data]));
            setTotal(dataJson.total);
            setHasMore(dataJson.hasMore);
            setLoading(false);
            setIsLoadingMore(false);
        };

        fetchData();
    }, [page, activeQuery]);

    const resultsLabel = useMemo(() => {
        if (total === 0) {
            return "Nenhum evento encontrado";
        }

        if (!activeQuery) {
            return `Mostrando ${data.length} de ${total} eventos`;
        }

        return `${total} resultado${total === 1 ? "" : "s"}`;
    }, [activeQuery, data.length, total]);

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
                        <strong>{total}</strong>
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
                        <span>{activeQuery ? total : data.length}</span>
                        <small>{activeQuery ? "resultados" : "carregados"}</small>
                    </div>
                </section>

                <div className="events-results-summary">
                    <span>{resultsLabel}</span>
                </div>

                <section className="events-list">
                    {data.length === 0 ? (
                        <div className="glass-container events-empty-state">Nenhum evento encontrado.</div>
                    ) : (
                        data.map((event) => <EventCard key={String(event._id)} event={event} />)
                    )}
                </section>

                {hasMore && (
                    <div className="events-load-more">
                        <button
                            type="button"
                            className="glass-button events-load-more-button"
                            onClick={() => setPage((prev) => prev + 1)}
                            disabled={isLoadingMore}
                        >
                            {isLoadingMore ? "Carregando mais..." : "Carregar mais eventos"}
                        </button>
                    </div>
                )}
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
                        <span>{event.statusDetails.status === "PUBLISHED_OPEN" ? "Inscricoes abertas" : "Inscricoes fechadas"}</span>
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
