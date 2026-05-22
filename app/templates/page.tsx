'use client'

import { useState, useMemo, useEffect } from 'react';

// Tipagem unificada
export type R2Document = {
    key: string;
    size: number;
    lastModified: string; 
    url: string;
    isImage: boolean;
};

export default function DocumentosPage() {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [documents, setDocuments] = useState<R2Document[]>([]);

    useEffect(() => {
        const fetchDocumentos = async () => {
            try {
                const response = await fetch('/api/v1/templates/');
                const data: {
                    success: boolean;
                    error?: string;
                    documents: R2Document[];
                } = await response.json();

                if (data.success) {
                    setDocuments(data.documents);
                } else {
                    alert(data.error || "Erro ao carregar arquivos.");
                }
            } catch (err) {
                console.error("Erro ao conectar com a API", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDocumentos();
    }, []);

    if (isLoading) {
        return (
            <main className="min-h-[calc(100vh-80px)] flex justify-center items-center p-6 bg-slate-950">
                <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-xl text-center">
                    <h3 className="text-xl md:text-2xl font-bold text-indigo-100 mb-2">Carregando</h3>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-[calc(100vh-80px)] px-4 py-7 pb-12 md:px-6 md:py-10 md:pb-16 bg-slate-950 font-sans">
            {/* O Shell divide a tela em 2 colunas: Hero na esquerda, Conteúdo na direita */}
            <div className="w-full max-w-[1240px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] gap-8 items-start">
                
                {/* COLUNA ESQUERDA: Hero Fixo */}
                <div className="lg:sticky lg:top-[110px] flex flex-col gap-6 lg:pt-8 lg:pb-2 px-2 max-lg:static max-lg:p-0">
                    <span className="w-fit px-3.5 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-[0.78rem] font-bold tracking-[0.08em] uppercase">
                        Cloudflare R2
                    </span>
                    <h1 className="text-[clamp(2.2rem,4vw,3.3rem)] leading-[1.08] font-extrabold text-indigo-100 drop-shadow-[0_10px_30px_rgba(15,23,42,0.45)]">
                        Arquivos e<br/>Documentos
                    </h1>
                    <p className="text-blue-200 leading-[1.6]">
                        Gerencie, visualize e faça o download dos arquivos armazenados diretamente no bucket do seu sistema.
                    </p>
                    
                    <div className="grid gap-4 mt-4">
                        <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-start gap-3.5 min-w-[min(280px,100%)] max-md:w-full">
                            <div className="w-11 h-11 rounded-xl inline-flex flex-shrink-0 items-center justify-center bg-blue-500/15 border border-blue-400/25 text-blue-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                            </div>
                            <div className="flex flex-col gap-1">
                                <strong className="text-indigo-100">Total Armazenado</strong>
                                <span className="text-blue-200 leading-[1.6]">{documents.length} documentos na raiz</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* COLUNA DIREITA: Conteúdo interativo */}
                <DocumentViewer documents={documents} />
            </div>
        </main>
    );
}

// ==========================================
// COMPONENTE VISUAL (VIEWER)
// ==========================================

interface DocumentViewerProps {
    documents: R2Document[];
}

function DocumentViewer({ documents }: DocumentViewerProps) {
    const [expandedDoc, setExpandedDoc] = useState<R2Document | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>("");

    const filteredDocs = useMemo(() => {
        if (!searchQuery) return documents;
        return documents.filter(doc =>
            doc.key.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [documents, searchQuery]);

    const resultsLabel = useMemo(() => {
        if (filteredDocs.length === 0) return "Nenhum documento encontrado";
        if (!searchQuery) return `Exibindo todos os ${documents.length} documentos`;
        return `${filteredDocs.length} resultado${filteredDocs.length === 1 ? "" : "s"} encontrado${filteredDocs.length === 1 ? "" : "s"}`;
    }, [searchQuery, filteredDocs.length, documents.length]);

    return (
        <>
            <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 md:p-8 shadow-xl">
                
                {/* Header do Form (Busca) */}
                <div className="flex flex-col md:flex-row items-start justify-between gap-6 mb-8">
                    <div className="flex flex-col gap-2.5 w-full">
                        <label className="text-blue-100 text-[0.93rem] font-bold">Pesquisar Arquivo</label>
                        <input
                            type="text"
                            placeholder="Digite o nome do documento..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-inherit"
                        />
                        <span className="text-blue-200 leading-[1.6] text-sm mt-1">{resultsLabel}</span>
                    </div>
                </div>

                {/* Grid de Documentos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredDocs.length === 0 ? (
                        <div className="p-5 md:p-6 rounded-2xl border border-white/10 bg-slate-900/35 w-full text-center col-span-1 md:col-span-2">
                            <p className="text-white/60">Sua busca não retornou nenhum arquivo.</p>
                        </div>
                    ) : (
                        filteredDocs.map((doc) => (
                            <div key={doc.key} className="bg-slate-900/40 backdrop-blur-sm border border-white/10 rounded-2xl p-5 flex flex-col gap-3.5 hover:bg-slate-800/50 transition-colors">
                                {/* Cabeçalho do Card (Ícone e Nome) */}
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-11 h-11 rounded-xl inline-flex flex-shrink-0 items-center justify-center bg-blue-500/15 border border-blue-400/25 text-blue-300">
                                        {doc.isImage ? <ImageIcon /> : <PdfIcon />}
                                    </div>
                                    <h3 className="font-mono text-sm text-indigo-100 truncate" title={doc.key}>
                                        {doc.key}
                                    </h3>
                                </div>

                                {/* Informações */}
                                <div className="flex flex-col gap-1.5 mt-2">
                                    <span className="text-blue-100 font-bold text-xs">Tamanho</span>
                                    <p className="text-sm text-blue-200">{doc.size ? (doc.size / 1024).toFixed(2) + " KB" : "--"}</p>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <span className="text-blue-100 font-bold text-xs">Última Modificação</span>
                                    <p className="text-sm text-blue-200">{doc.lastModified ? new Date(doc.lastModified).toLocaleDateString('pt-BR') : "--"}</p>
                                </div>

                                {/* Botões de Ação na base do Card */}
                                <div className="flex justify-end mt-auto pt-4">
                                    <div className="grid grid-cols-2 w-full gap-2">
                                        <button
                                            onClick={() => setExpandedDoc(doc)}
                                            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-medium hover:bg-white/10 transition-colors text-center"
                                        >
                                            Visualizar
                                        </button>
                                        <a
                                            href={doc.url}
                                            download={doc.key}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-100 text-xs font-medium hover:bg-blue-500/20 transition-colors text-center"
                                        >
                                            Baixar
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal de Visualização */}
            {expandedDoc && (
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
                    onClick={() => setExpandedDoc(null)}
                >
                    <div
                        className="relative w-full max-w-4xl bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden backdrop-blur-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <h3 className="font-mono text-sm text-blue-100 truncate px-2">{expandedDoc.key}</h3>
                            <button
                                onClick={() => setExpandedDoc(null)}
                                className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                Fechar
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-4 flex justify-center items-center relative min-h-[60vh] bg-black/20">
                            {expandedDoc.isImage ? (
                                <img
                                    src={expandedDoc.url}
                                    alt={expandedDoc.key}
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                                />
                            ) : (
                                <iframe
                                    src={expandedDoc.url}
                                    className="w-full h-full min-h-[70vh] rounded-lg shadow-sm bg-white"
                                    title="Visualizador de Documento"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// Ícones SVG
function ImageIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
        </svg>
    );
}

function PdfIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
        </svg>
    );
}