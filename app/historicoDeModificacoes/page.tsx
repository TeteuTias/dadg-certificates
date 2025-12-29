"use client";
import { useEffect, useState } from "react";
import { IModificationHistory } from "@/lib/models/ModificationHistoryModel";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import LoadingPage from "@/components/LoadingPage";
import "./page.css";


export default function Page() {
    const [isLoading, setLoading] = useState<boolean>(true);
    const [data, setData] = useState<IModificationHistory[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>("");

    useEffect(() => {
        const fetchData = async () => {
            const res = await fetch("/api/get/allModificationHistory/");
            if (!res.ok) {
                console.log("Ocorreu algum erro");
                return;
            }
            const dataJson: { data: IModificationHistory[] } = await res.json();
            setData(dataJson.data);
            setLoading(false);
        };
        fetchData();
    }, []);

    if (isLoading) {
        return <LoadingPage message="Carregando histórico..." />;
    }

    // Filtra o histórico com base no termo de busca (searchQuery)
    const filteredData = data.filter((event) => {
        const query = searchQuery.toLowerCase();

        return (
            event.description?.toLowerCase().includes(query) ||
            event.modifiedDocumentType?.toLowerCase().includes(query) ||
            (event._id && String(event._id).toLowerCase().includes(query))
        );
    });


    return (
        <main className="history-container" style={PoppinsFontLib.style}>
            <h1 className="history-title">Histórico de Modificações</h1>
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
            <div className="glass-container history-list">
                {filteredData.length === 0 ? (
                    <div className="empty-state">Nenhum histórico encontrado</div>
                ) : (
                    filteredData.map((event) => (
                        <ModificationHistoryComponent key={String(event._id)} event={event} />
                    ))
                )}
            </div>
        </main>
    );
}

const ModificationHistoryComponent: React.FC<{ event: IModificationHistory }> = ({ event }) => {
    return (
        <div className="glass-card history-item">
            <div className="history-field">
                <span className="history-field-label">Identificação</span>
                <span className="history-field-value">{String(event._id)}</span>
            </div>

            <div className="history-field">
                <span className="history-field-label">Data Modificação</span>
                <span className="history-field-value">{event.modificationDate.toString()}</span>
            </div>

            <div className="history-field">
                <span className="history-field-label">Id do Documento Modificado</span>
                <span className="history-field-value">{String(event.modifiedElementId)}</span>
            </div>

            <div className="history-field">
                <span className="history-field-label">Usuário</span>
                <span className="history-field-value">{String(event.userName)}</span>
            </div>

            <div className="history-field">
                <span className="history-field-label">Descrição</span>
                <span className="history-field-value">{event.description}</span>
            </div>

            <div className="history-field">
                <span className="history-field-label">Tipo de Documento Modificado</span>
                <span className="history-field-value">{String(event.modifiedDocumentType)}</span>
            </div>
        </div>
    );
};
