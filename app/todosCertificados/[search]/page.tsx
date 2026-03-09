"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ICertificateWithEventPopulate } from "@/lib/models/CertificateModel";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import LoadingPage from "@/components/LoadingPage";
import "./page.css";


export default function Page({ params }: { params: Promise<{ search: string }> }) {
    const [isLoading, setLoading] = useState<boolean>(true);
    const [data, setData] = useState<ICertificateWithEventPopulate[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>("");

    useEffect(() => {
        const fetchData = async () => {
            const slug = (await params).search
            if (slug !== "allCertificates") {
                setSearchQuery(slug)
            }
            const res = await fetch("/api/get/allCertificates/");
            if (!res.ok) {
                console.log("Ocorreu algum erro");
                return;
            }
            const dataJson: { data: ICertificateWithEventPopulate[] } = await res.json();
            setData(dataJson.data);
            setLoading(false);
        };
        fetchData();
    }, [params]);

    if (isLoading) {
        return <LoadingPage message="Carregando certificados..." />;
    }

    // Filtra os certificados com base no termo de busca (searchQuery)
    const filteredData = data.filter((cert) => {
        const query = searchQuery.toLowerCase();

        return (
            cert._id.toString().toLowerCase().includes(query) ||
            cert.ownerName?.toLowerCase().includes(query) ||
            cert.ownerCpf?.toLowerCase().includes(query) ||
            cert.eventName?.toLowerCase().includes(query) ||
            cert.ownerEmail?.toLowerCase().includes(query) ||
            cert.certificateHours?.toLowerCase().includes(query) ||
            cert.certificatePath?.toLowerCase().includes(query) ||
            (cert.frontTopperText && cert.frontTopperText.toLowerCase().includes(query)) ||
            (cert.frontBottomText && cert.frontBottomText.toLowerCase().includes(query)) ||
            // Busca pelo nome do evento
            (cert.eventId && cert.eventId.eventName.toLowerCase().includes(query)) ||
            // Busca pelo ID do evento
            (cert.eventId && String(cert.eventId._id).toLowerCase().includes(query))
        );
    });


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
                {filteredData.length !== 0 && (
                    <h2 className="search-results-count">
                        Foram encontrados <span>{filteredData.length}</span> resultados
                    </h2>
                )}
            </div>
            <div className="glass-container certificates-list">
                {filteredData.length === 0 ? (
                    <div className="empty-state">Nenhum certificado encontrado</div>
                ) : (
                    filteredData.map((certificate) => (
                        <CertificateComponent key={String(certificate._id)} certificate={certificate} />
                    ))
                )}
            </div>
        </main>
    );
}

const CertificateComponent: React.FC<{ certificate: ICertificateWithEventPopulate }> = ({ certificate }) => {
    return (
        <div className="glass-card certificate-item">
            <div className="certificate-field">
                <span className="certificate-field-label">Usuário</span>
                <span className="certificate-field-value">{certificate.ownerName}</span>
            </div>

            <div className="certificate-field">
                <span className="certificate-field-label">Identificação de Evento</span>
                <span className="certificate-field-value">{String(certificate?.eventId?._id)}</span>
            </div>

            <div className="certificate-field">
                <span className="certificate-field-label">Identificação do Certificado</span>
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
