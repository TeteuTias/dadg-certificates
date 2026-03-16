"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ICertificateWithEventPopulate } from "@/lib/models/CertificateModel";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import LoadingPage from "@/components/LoadingPage";
import "./page.css";

const PAGE_SIZE = 60;

type CertificatesResponse = {
    data: ICertificateWithEventPopulate[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
};

export default function Page({ params }: { params: Promise<{ search: string }> }) {
    const [isLoading, setLoading] = useState<boolean>(true);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
    const [data, setData] = useState<ICertificateWithEventPopulate[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [activeQuery, setActiveQuery] = useState<string>("");
    const [page, setPage] = useState<number>(1);
    const [total, setTotal] = useState<number>(0);
    const [hasMore, setHasMore] = useState<boolean>(false);
    const [isReady, setIsReady] = useState<boolean>(false);

    useEffect(() => {
        const resolveInitialQuery = async () => {
            const slug = (await params).search;
            const initialQuery = slug !== "allCertificates" ? slug : "";

            setSearchQuery(initialQuery);
            setActiveQuery(initialQuery);
            setPage(1);
            setIsReady(true);
        };

        resolveInitialQuery();
    }, [params]);

    useEffect(() => {
        if (!isReady) {
            return;
        }

        const timeout = window.setTimeout(() => {
            setPage(1);
            setActiveQuery(searchQuery.trim());
        }, 300);

        return () => window.clearTimeout(timeout);
    }, [searchQuery, isReady]);

    useEffect(() => {
        if (!isReady) {
            return;
        }

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

            const res = await fetch(`/api/get/allCertificates/?${searchParams.toString()}`);
            if (!res.ok) {
                setLoading(false);
                setIsLoadingMore(false);
                return;
            }

            const dataJson: CertificatesResponse = await res.json();

            setData((prev) => (page === 1 ? dataJson.data : [...prev, ...dataJson.data]));
            setTotal(dataJson.total);
            setHasMore(dataJson.hasMore);
            setLoading(false);
            setIsLoadingMore(false);
        };

        fetchData();
    }, [page, activeQuery, isReady]);

    const resultsLabel = useMemo(() => {
        if (total === 0) {
            return "Nenhum certificado encontrado";
        }

        if (!activeQuery) {
            return `Mostrando ${data.length} de ${total} certificados`;
        }

        return `${total} resultado${total === 1 ? "" : "s"} encontrado${total === 1 ? "" : "s"}`;
    }, [activeQuery, data.length, total]);

    if (isLoading) {
        return <LoadingPage message="Carregando certificados..." />;
    }

    return (
        <main className="certificates-container" style={PoppinsFontLib.style}>
            <h1 className="certificates-title">Todos os Certificados</h1>
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
                <h2 className="search-results-count">
                    <span>{resultsLabel}</span>
                </h2>
            </div>

            <div className="glass-container certificates-list">
                {data.length === 0 ? (
                    <div className="empty-state">Nenhum certificado encontrado</div>
                ) : (
                    data.map((certificate) => (
                        <CertificateComponent key={String(certificate._id)} certificate={certificate} />
                    ))
                )}
            </div>

            {hasMore && (
                <div className="certificates-load-more">
                    <button
                        type="button"
                        className="glass-button certificates-load-more-button"
                        onClick={() => setPage((prev) => prev + 1)}
                        disabled={isLoadingMore}
                    >
                        {isLoadingMore ? "Carregando mais..." : "Carregar mais certificados"}
                    </button>
                </div>
            )}
        </main>
    );
}

const CertificateComponent: React.FC<{ certificate: ICertificateWithEventPopulate }> = ({ certificate }) => {
    return (
        <div className="glass-card certificate-item">
            <div className="certificate-field">
                <span className="certificate-field-label">Usuario</span>
                <span className="certificate-field-value">{certificate.ownerName}</span>
            </div>

            <div className="certificate-field">
                <span className="certificate-field-label">Identificacao de Evento</span>
                <span className="certificate-field-value">{String(certificate?.eventId?._id)}</span>
            </div>

            <div className="certificate-field">
                <span className="certificate-field-label">Identificacao do Certificado</span>
                <span className="certificate-field-value">{String(certificate._id)}</span>
            </div>

            <div className="certificate-field">
                <span className="certificate-field-label">Nome do Evento</span>
                <span className="certificate-field-value">{certificate.eventName}</span>
            </div>

            <div className="certificate-actions">
                <Link
                    prefetch={false}
                    href={`https://www.dadg.com.br/certificados/meuCertificado/${certificate._id}`}
                    target="_blank"
                    className="certificate-button certificate-button-primary"
                >
                    Ver Certificado
                </Link>
                <Link
                    prefetch={false}
                    href={`/todosCertificados/modificar/${certificate._id}`}
                    target="_blank"
                    className="certificate-button certificate-button-primary"
                >
                    Editar Certificado
                </Link>
            </div>
        </div>
    );
};
