"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";
import { ArrowLeft, Download, Eye, AlertCircle } from "lucide-react";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import "./page.css";

interface Author {
  name: string;
  email: string;
  institution: string;
  is_advisor: boolean;
}

interface Participant {
  name: string;
  email: string;
  role: string;
  is_advisor: boolean;
}

interface ArticleProject {
  _id: string;
  Modalidade: string;
  Nome_do_projeto: string;
  authors: Author[];
  participants: Participant[];
  event_id: { eventName: string };
  file_url?: string; // URL do arquivo no R2 (compatibilidade)
  file_id?: string; // ID do arquivo no GridFS
  file_name?: string; // Nome original do arquivo
  file_type?: string; // Tipo MIME do arquivo
  file_size?: number; // Tamanho do arquivo em bytes
  created_at: string;
}

export default function VisualizarTrabalhos() {
  const { user } = useUser();
  const [articles, setArticles] = useState<ArticleProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [selectedArticle, setSelectedArticle] = useState<ArticleProject | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const response = await fetch("/api/v1/articles/list");

      if (!response.ok) {
        throw new Error("Erro ao buscar trabalhos");
      }

      const data = await response.json();
      setArticles(data.data);
    } catch (err) {
      setError("Erro ao carregar trabalhos");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (article: ArticleProject) => {
    setSelectedArticle(article);
    setShowDetails(true);
  };

  const handleCloseDetails = () => {
    setShowDetails(false);
    setSelectedArticle(null);
  };

  const handleDownload = async (article: ArticleProject) => {
    try {
      // Se houver file_id (GridFS), fazer download via API
      if (article.file_id) {
        const response = await fetch(`/api/v1/articles/download/${article.file_id}`);

        if (!response.ok) {
          throw new Error("Erro ao fazer download do arquivo");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = article.file_name || "arquivo";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } 
      // Se houver file_url (R2), abrir diretamente
      else if (article.file_url) {
        window.open(article.file_url, "_blank");
      } else {
        throw new Error("Arquivo não disponível");
      }
    } catch (err) {
      setError("Erro ao fazer download do arquivo");
      console.error(err);
    }
  };

  const getModalityName = (code: string) => {
    const modalities: { [key: string]: string } = {
      ART: "Artigo Científico",
      POST: "Pôster Científico",
      ORAL: "Apresentação Oral",
      RES: "Resumo Simples",
      REXP: "Resumo Expandido",
      CASO: "Relato de Caso",
      REV: "Revisão Sistemática",
      PROJ: "Projeto de Pesquisa",
    };
    return modalities[code] || code;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return "Tamanho desconhecido";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  if (loading) {
    return (
      <div className="visualizar-container" style={PoppinsFontLib.style}>
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Carregando trabalhos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="visualizar-container" style={PoppinsFontLib.style}>
      <div className="visualizar-header">
        <Link href="/" className="back-button">
          <ArrowLeft size={24} />
          <span>Voltar</span>
        </Link>
        <h1 className="visualizar-title">Trabalhos Submetidos</h1>
      </div>

      <div className="visualizar-content">
        {error && (
          <div className="alert alert-error">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {articles.length === 0 ? (
          <div className="empty-state">
            <Eye size={48} />
            <h2>Nenhum trabalho submetido</h2>
            <p>Você ainda não submeteu nenhum trabalho.</p>
            <Link href="/submeterTrabalho" className="btn-submit-new">
              Submeter Trabalho
            </Link>
          </div>
        ) : (
          <div className="articles-grid">
            {articles.map((article) => (
              <div key={article._id} className="article-card">
                <div className="article-header">
                  <h3 className="article-title">{article.Nome_do_projeto}</h3>
                  <span className="modality-badge">{getModalityName(article.Modalidade)}</span>
                </div>

                <div className="article-info">
                  <p>
                    <strong>Evento:</strong> {article.event_id.eventName}
                  </p>
                  <p>
                    <strong>Data de Submissão:</strong>{" "}
                    {new Date(article.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  <p>
                    <strong>Autores:</strong> {article.authors.length}
                  </p>
                  <p>
                    <strong>Participantes:</strong> {article.participants.length}
                  </p>
                  {article.file_size && (
                    <p>
                      <strong>Tamanho do Arquivo:</strong> {formatFileSize(article.file_size)}
                    </p>
                  )}
                </div>

                <div className="article-actions">
                  <button
                    onClick={() => handleViewDetails(article)}
                    className="btn-view"
                  >
                    <Eye size={18} />
                    Ver Detalhes
                  </button>
                  <button
                    onClick={() => handleDownload(article)}
                    className="btn-download"
                  >
                    <Download size={18} />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {showDetails && selectedArticle && (
        <div className="modal-overlay" onClick={handleCloseDetails}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedArticle.Nome_do_projeto}</h2>
              <button onClick={handleCloseDetails} className="btn-close">
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h3>Informações Gerais</h3>
                <div className="detail-item">
                  <strong>Modalidade:</strong> {getModalityName(selectedArticle.Modalidade)}
                </div>
                <div className="detail-item">
                  <strong>Evento:</strong> {selectedArticle.event_id.eventName}
                </div>
                <div className="detail-item">
                  <strong>Data de Submissão:</strong>{" "}
                  {new Date(selectedArticle.created_at).toLocaleDateString("pt-BR")}
                </div>
                {selectedArticle.file_name && (
                  <div className="detail-item">
                    <strong>Nome do Arquivo:</strong> {selectedArticle.file_name}
                  </div>
                )}
                {selectedArticle.file_size && (
                  <div className="detail-item">
                    <strong>Tamanho do Arquivo:</strong> {formatFileSize(selectedArticle.file_size)}
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h3>Autores</h3>
                {selectedArticle.authors.map((author, index) => (
                  <div key={index} className="person-detail">
                    <strong>{author.name}</strong>
                    <p>{author.email}</p>
                    <p>{author.institution}</p>
                    {author.is_advisor && <span className="badge-advisor">Orientador</span>}
                  </div>
                ))}
              </div>

              <div className="detail-section">
                <h3>Participantes</h3>
                {selectedArticle.participants.map((participant, index) => (
                  <div key={index} className="person-detail">
                    <strong>{participant.name}</strong>
                    <p>{participant.email}</p>
                    <p>Função: {participant.role}</p>
                    {participant.is_advisor && <span className="badge-advisor">Orientador</span>}
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                <button
                  onClick={() => handleDownload(selectedArticle)}
                  className="btn-download-large"
                >
                  <Download size={20} />
                  Download do Arquivo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
