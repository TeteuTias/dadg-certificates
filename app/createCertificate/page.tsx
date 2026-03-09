"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IEventCertificate } from "@/lib/models/EventCertificateModel";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import LoadingPage from "@/components/LoadingPage";
import "./page.css";


export default function Page() {
    const [isLoading, setLoading] = useState<boolean>(true);
    const [data, setData] = useState<IEventCertificate[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>("");

    useEffect(() => {
        const fetchData = async () => {
            const res = await fetch("/api/get/allEvents/");
            if (!res.ok) {
                console.log("Ocorreu algum erro");
                return;
            }
            const dataJson: { data: IEventCertificate[] } = await res.json();
            setData(dataJson.data);
            setLoading(false);
        };
        fetchData();
    }, []);

    if (isLoading) {
        return <LoadingPage message="Carregando eventos..." />;
    }

    // Filtra os eventos com base no termo de busca (searchQuery)
    const filteredData = data.filter((event) => {
        const query = searchQuery.toLowerCase();

        return (
            event.eventName?.toLowerCase().includes(query) ||
            event.eventDescription?.toLowerCase().includes(query) ||
            (event._id && String(event._id).toLowerCase().includes(query))
        );
    });


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
                {filteredData.length !== 0 && (
                    <h2 className="search-results-count">
                        Foram encontrados <span>{filteredData.length}</span> resultados
                    </h2>
                )}
            </div>
            <div className="glass-container events-list" style={{ width: "100%", maxWidth: "1000px" }}>
                {filteredData.length === 0 ? (
                    <div className="empty-state">Nenhum evento encontrado</div>
                ) : (
                    filteredData.map((event) => (
                        <EventComponent key={String(event._id)} event={event} />
                    ))
                )}
            </div>
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
