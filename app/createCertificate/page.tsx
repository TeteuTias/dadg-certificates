"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IEventCertificate } from "@/lib/models/EventCertificateModel";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import LoadingPage from "@/components/LoadingPage";
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
    const [isLoading, setLoading] = useState<boolean>(true);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
    const [data, setData] = useState<IEventCertificate[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [activeQuery, setActiveQuery] = useState<string>("");
    const [page, setPage] = useState<number>(1);
    const [total, setTotal] = useState<number>(0);
    const [hasMore, setHasMore] = useState<boolean>(false);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setPage(1);
            setActiveQuery(searchQuery.trim());
        }, 300);

        return () => window.clearTimeout(timeout);
    }, [searchQuery]);

    useEffect(() => {
        const controller = new AbortController();

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

            try {
                const res = await fetch(`/api/get/allEvents/?${searchParams.toString()}`, {
                    signal: controller.signal,
                });

                if (!res.ok) {
                    throw new Error("Nao foi possivel carregar os eventos.");
                }

                const dataJson: EventsResponse = await res.json();

                setData((previousData) => page === 1
                    ? dataJson.data
                    : [...previousData, ...dataJson.data]
                );
                setTotal(dataJson.total);
                setHasMore(dataJson.hasMore);
            } catch (error) {
                if (!(error instanceof DOMException && error.name === "AbortError")) {
                    console.error(error);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                    setIsLoadingMore(false);
                }
            }
        };

        fetchData();

        return () => controller.abort();
    }, [page, activeQuery]);

    if (isLoading) {
        return <LoadingPage message="Carregando eventos..." />;
    }

    return (
        <main className="create-certificate-container" style={PoppinsFontLib.style}>
            <h1 className="create-certificate-title">Escolha um Evento para Criar um Novo Certificado</h1>
            <div className="search-section">
                <div className="search-input-wrapper">
                    <input
                        type="text"
                        placeholder="Pesquisar..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="glass-input"
                        style={{ width: "100%" }}
                    />
                </div>
                {data.length !== 0 && (
                    <h2 className="search-results-count">
                        {activeQuery ? (
                            <>Foram encontrados <span>{total}</span> resultados</>
                        ) : (
                            <>Mostrando <span>{data.length}</span> de <span>{total}</span> eventos</>
                        )}
                    </h2>
                )}
            </div>
            <div className="glass-container events-list" style={{ width: "100%", maxWidth: "1000px" }}>
                {data.length === 0 ? (
                    <div className="empty-state">Nenhum evento encontrado</div>
                ) : (
                    data.map((event) => (
                        <EventComponent key={String(event._id)} event={event} />
                    ))
                )}
            </div>
            {hasMore && (
                <button
                    type="button"
                    className="event-load-more-button"
                    onClick={() => setPage((currentPage) => currentPage + 1)}
                    disabled={isLoadingMore}
                >
                    {isLoadingMore ? "Carregando mais..." : "Carregar mais eventos"}
                </button>
            )}
        </main>
    );
}

const EventComponent: React.FC<{ event: IEventCertificate }> = ({ event }) => {
    return (
        <div className="glass-card event-item">
            <div className="event-field">
                <span className="event-field-label">Identificação</span>
                <span className="event-field-value">{String(event._id)}</span>
            </div>

            <div className="event-field">
                <span className="event-field-label">Nome do Evento</span>
                <span className="event-field-value">{event.eventName}</span>
            </div>

            <div className="event-field">
                <span className="event-field-label">Descrição do Evento</span>
                <span className="event-field-value">{String(event.eventDescription)}</span>
            </div>

            <div className="event-actions">
                <Link
                    prefetch={false}
                    href={`/createCertificate/create/${event._id}`}
                    target="_blank"
                    className="event-button event-button-primary"
                >
                    Criar Certificado
                </Link>
                <Link
                    prefetch={false}
                    href={`/todosCertificados/${event._id}`}
                    target="_blank"
                    className="event-button event-button-primary"
                >
                    Ver Certificados Do Evento
                </Link>
            </div>
        </div>
    );
};
