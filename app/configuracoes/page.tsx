"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Newspaper,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import "./page.css";

type Feedback = {
  type: "success" | "error";
  text: string;
} | null;

export default function ConfiguracoesPage() {
  const [blogEnabled, setBlogEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/v1/settings", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || typeof data.blogEnabled !== "boolean") {
          throw new Error(data.error || "Não foi possível carregar as configurações.");
        }

        setBlogEnabled(data.blogEnabled);
      } catch (error) {
        setFeedback({
          type: "error",
          text: error instanceof Error ? error.message : "Não foi possível carregar as configurações.",
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchSettings();
  }, []);

  const toggleBlog = async () => {
    if (blogEnabled === null || saving) return;

    const newValue = !blogEnabled;
    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/v1/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogEnabled: newValue }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível salvar a configuração.");
      }

      setBlogEnabled(typeof data.blogEnabled === "boolean" ? data.blogEnabled : newValue);
      setFeedback({ type: "success", text: "Configuração salva com sucesso." });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível salvar a configuração.",
      });
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = loading
    ? "Carregando"
    : blogEnabled === true
      ? "Blog publicado"
      : blogEnabled === false
        ? "Blog oculto"
        : "Indisponível";

  return (
    <main className="settings-page" style={PoppinsFontLib.style}>
      <div className="settings-shell">
        <header className="settings-header fade-in">
          <div className="settings-hero">
            <span className="settings-badge"><Settings size={15} />Administração</span>
            <h1>Configurações globais</h1>
            <p>
              Controle recursos que refletem no site principal sem alterar o restante da experiência.
            </p>
          </div>

          <div className="glass-card settings-overview" aria-live="polite">
            <span className={`settings-status-dot ${blogEnabled ? "is-active" : ""}`} />
            <div>
              <small>Estado atual</small>
              <strong>{statusLabel}</strong>
            </div>
          </div>
        </header>

        <section className="settings-section fade-in">
          <div className="settings-section-heading">
            <div>
              <span>Conteúdo e comunicação</span>
              <h2>Visibilidade dos canais</h2>
            </div>
            <p>As mudanças são aplicadas imediatamente no site principal.</p>
          </div>

          {loading ? (
            <div className="glass-card settings-loading" role="status">
              <Loader2 size={24} className="settings-spinner" />
              <div>
                <strong>Carregando configurações</strong>
                <span>Consultando o estado atual do sistema.</span>
              </div>
            </div>
          ) : blogEnabled === null ? (
            <div className="glass-card settings-loading is-error" role="alert">
              <AlertCircle size={24} />
              <div>
                <strong>Configuração indisponível</strong>
                <span>Não foi possível consultar o estado do blog neste momento.</span>
              </div>
            </div>
          ) : (
            <article className="glass-card settings-card">
              <div className="settings-card-icon"><Newspaper size={24} /></div>

              <div className="settings-card-copy">
                <div className="settings-card-title-row">
                  <h3>Blog do Diretório</h3>
                  <span className={`settings-state-pill ${blogEnabled ? "is-active" : "is-inactive"}`}>
                    {blogEnabled ? "Ativo" : "Oculto"}
                  </span>
                </div>
                <p>
                  Define se o blog aparece no menu, no perfil e nas páginas públicas do site principal.
                  Ao desativar, o conteúdo permanece armazenado e pode ser reativado depois.
                </p>
              </div>

              <div className="settings-control">
                <span className="settings-control-label">Exibir no site</span>
                <label className={`settings-switch ${blogEnabled ? "is-active" : ""}`}>
                  <input
                    type="checkbox"
                    checked={blogEnabled === true}
                    onChange={() => void toggleBlog()}
                    disabled={saving || blogEnabled === null}
                    aria-label={blogEnabled ? "Ocultar blog do site principal" : "Exibir blog no site principal"}
                  />
                  <span className="settings-switch-track" aria-hidden="true">
                    <span className="settings-switch-thumb">
                      {saving && <Loader2 size={13} className="settings-spinner" />}
                    </span>
                  </span>
                </label>
                <span className="settings-control-state">
                  {saving ? "Salvando..." : blogEnabled ? "Visível" : "Não visível"}
                </span>
              </div>
            </article>
          )}

          <div className="glass-card settings-note">
            <ShieldCheck size={20} />
            <div>
              <strong>Configuração protegida</strong>
              <p>Somente usuários autenticados nesta área administrativa podem alterar esse estado.</p>
            </div>
          </div>
        </section>

        {feedback && (
          <div className={`settings-feedback is-${feedback.type}`} role="status" aria-live="polite">
            {feedback.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.text}</span>
          </div>
        )}
      </div>
    </main>
  );
}
