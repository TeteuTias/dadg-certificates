// app/teste/DocumentViewer.tsx
'use client'

import { useState } from 'react';
import type { R2Document } from './teste'; // Ajuste o caminho da sua tipagem

interface DocumentViewerProps {
    documents: R2Document[];
}

export default function DocumentViewer({ documents }: DocumentViewerProps) {
    const [expandedDoc, setExpandedDoc] = useState<R2Document | null>(null);

    if (documents.length === 0) {
        return (
            <div className="border border-dashed border-zinc-300 rounded-lg p-12 text-center text-zinc-500">
                Nenhum documento encontrado no bucket.
            </div>
        );
    }

    return (
        <>
            <div className="border border-zinc-200 rounded-lg overflow-hidden shadow-sm bg-white">
                <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-50 text-zinc-600 border-b border-zinc-200">
                        <tr>
                            <th className="px-6 py-4 font-medium">Arquivo</th>
                            <th className="px-6 py-4 font-medium">Tamanho</th>
                            <th className="px-6 py-4 font-medium">Última Modificação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                        {documents.map((doc) => (
                            <tr
                                key={doc.key}
                                onClick={() => setExpandedDoc(doc)}
                                className="hover:bg-zinc-50 transition-colors cursor-pointer group"
                            >
                                <td className="px-6 py-4 flex items-center gap-4 font-mono text-zinc-800">
                                    <div className="h-10 w-10 flex-shrink-0 rounded border border-zinc-200 bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:text-zinc-600 transition-colors">
                                        {doc.isImage ? (
                                            <ImageIcon className="h-5 w-5" />
                                        ) : (
                                            <PdfIcon className="h-5 w-5" />
                                        )}
                                    </div>
                                    <span className="truncate max-w-[200px] sm:max-w-xs">{doc.key}</span>
                                </td>
                                <td className="px-6 py-4 text-zinc-500">
                                    {doc.size ? (doc.size / 1024).toFixed(2) + " KB" : "--"}
                                </td>
                                <td className="px-6 py-4 text-zinc-500">
                                    {doc.lastModified ? new Date(doc.lastModified).toLocaleDateString('pt-BR') : "--"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal de Visualização e Download */}
            {expandedDoc && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setExpandedDoc(null)}
                >
                    <div
                        className="relative w-full max-w-4xl bg-white rounded-lg shadow-xl flex flex-col max-h-[90vh] overflow-hidden border border-zinc-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-zinc-200 bg-zinc-50">
                            <h3 className="font-mono text-sm text-zinc-800 truncate px-2">{expandedDoc.key}</h3>
                            <div className="flex items-center gap-2">
                                {/* Botão de Download direto do R2 */}
                                <a
                                    href={expandedDoc.url}
                                    download={expandedDoc.key}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-md transition-colors"
                                >
                                    Baixar Arquivo
                                </a>
                                <button
                                    onClick={() => setExpandedDoc(null)}
                                    className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200 rounded-md transition-colors"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto bg-zinc-100/50 p-4 flex justify-center items-center relative min-h-[50vh]">
                            {/* Usa a URL pré-assinada que veio direto do servidor */}
                            {expandedDoc.isImage ? (
                                <img
                                    src={expandedDoc.url}
                                    alt={expandedDoc.key}
                                    className="max-w-full max-h-full object-contain rounded border border-zinc-200 shadow-sm"
                                />
                            ) : (
                                <iframe
                                    src={expandedDoc.url}
                                    className="w-full h-full min-h-[70vh] rounded border border-zinc-200 shadow-sm"
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

// Ícones SVG minimalistas
function ImageIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
        </svg>
    );
}

function PdfIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
        </svg>
    );
}