"use client";

import {
  AVISO_GROUPS,
  COORDENADORIAS,
  EMAIL_TESTE,
  getDefaultAvisoByType,
  type AvisoCode,
  type AvisoTipo,
  type CoordenadoriaKey,
} from "@/lib/avisos";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import {
  AlertTriangle,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  Clock3,
  Mail,
  MessageSquare,
  Send,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import "./style.css";

type FeedbackState =
  | { tone: "idle" }
  | {
      tone: "success";
      title: string;
      message: string;
      sentTo: string[];
      subject?: string;
    }
  | {
      tone: "error";
      title: string;
      message: string;
    };

const TYPE_OPTIONS: {
  value: AvisoTipo;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "pre",
    label: "Pre-evento",
    description: "Use para testes internos e envios customizados fora dos modelos automaticos.",
    icon: <Clock3 size={18} />,
  },
  {
    value: "pos",
    label: "Pos-evento",
    description: "Concentra os avisos de prazo, vencimento e cobranca operacionais.",
    icon: <AlertTriangle size={18} />,
  },
];

export default function AvisosPage() {
  const [tipo, setTipo] = useState<AvisoTipo>("pos");
  const [aviso, setAviso] = useState<AvisoCode>(getDefaultAvisoByType("pos"));
  const [nomeEvento, setNomeEvento] = useState("");
  const [destinatarios, setDestinatarios] = useState<CoordenadoriaKey[]>([]);
  const [assuntoCustomizado, setAssuntoCustomizado] = useState("");
  const [mensagemCustomizada, setMensagemCustomizada] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({ tone: "idle" });
  const [toastKey, setToastKey] = useState(0);

  const avisoOptions = AVISO_GROUPS[tipo];
  const avisoSelecionado =
    avisoOptions.find((option) => option.value === aviso) ?? avisoOptions[0];
  const isTeste = aviso === "teste";
  const isCustomizado = aviso === "customizado";
  const destinatariosPreview = isTeste
    ? [EMAIL_TESTE]
    : COORDENADORIAS.filter((item) => destinatarios.includes(item.sigla)).map((item) => item.email);
  const destinatariosResumo = isTeste
    ? ["CAC"]
    : COORDENADORIAS.filter((item) => destinatarios.includes(item.sigla)).map((item) => item.sigla);
  const isSubmitEnabled =
    !isSubmitting &&
    (isTeste || destinatarios.length > 0) &&
    (!isCustomizado ||
      (assuntoCustomizado.trim().length > 0 && mensagemCustomizada.trim().length > 0));

  const helperMessage = isTeste
    ? `No modo teste, o disparo sempre vai para ${EMAIL_TESTE}.`
    : destinatarios.length === 0
      ? "Selecione ao menos uma coordenadoria para liberar o envio."
      : isCustomizado && !assuntoCustomizado.trim()
        ? "Preencha o assunto customizado antes de enviar."
        : isCustomizado && !mensagemCustomizada.trim()
          ? "Preencha a mensagem customizada antes de enviar."
          : "O backend valida o payload e repassa o envio para o Google Apps Script.";

  const resetFeedback = () => {
    if (feedback.tone !== "idle") {
      setFeedback({ tone: "idle" });
    }
  };

  const showFeedback = (nextFeedback: Exclude<FeedbackState, { tone: "idle" }>) => {
    setFeedback(nextFeedback);
    setToastKey((current) => current + 1);
  };

  useEffect(() => {
    if (feedback.tone === "idle") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback({ tone: "idle" });
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [feedback, toastKey]);

  const handleTipoChange = (nextTipo: AvisoTipo) => {
    if (nextTipo === tipo) {
      return;
    }

    resetFeedback();
    setTipo(nextTipo);
    setAviso(getDefaultAvisoByType(nextTipo));
  };

  const handleAvisoChange = (nextAviso: AvisoCode) => {
    if (nextAviso === aviso) {
      return;
    }

    resetFeedback();
    setAviso(nextAviso);
  };

  const toggleDestinatario = (sigla: CoordenadoriaKey) => {
    resetFeedback();
    setDestinatarios((current) =>
      current.includes(sigla)
        ? current.filter((item) => item !== sigla)
        : [...current, sigla],
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isTeste && destinatarios.length === 0) {
      showFeedback({
        tone: "error",
        title: "Selecione destinatarios",
        message: "Escolha ao menos uma coordenadoria antes de disparar o aviso.",
      });
      return;
    }

    if (isCustomizado && !assuntoCustomizado.trim()) {
      showFeedback({
        tone: "error",
        title: "Assunto obrigatorio",
        message: "O assunto customizado precisa ser preenchido para concluir o envio.",
      });
      return;
    }

    if (isCustomizado && !mensagemCustomizada.trim()) {
      showFeedback({
        tone: "error",
        title: "Mensagem obrigatoria",
        message: "A mensagem customizada precisa ser preenchida para concluir o envio.",
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback({ tone: "idle" });

    try {
      const response = await fetch("/api/v1/warnings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tipo,
          aviso,
          nomeEvento,
          destinatarios,
          assuntoCustomizado,
          mensagemCustomizada,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
            error?: string;
            sentTo?: string[];
            subject?: string;
          }
        | null;

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.message || data?.error || "Nao foi possivel concluir o disparo do aviso.",
        );
      }

      showFeedback({
        tone: "success",
        title: "Aviso enviado com sucesso",
        message: isTeste
          ? "O teste foi encaminhado para CAC."
          : `O disparo foi concluido para ${data.sentTo?.length ?? destinatariosPreview.length} destinatario(s).`,
        sentTo: Array.isArray(data.sentTo) ? data.sentTo : destinatariosPreview,
        subject: data.subject,
      });
    } catch (error) {
      showFeedback({
        tone: "error",
        title: "Falha no envio",
        message:
          error instanceof Error
            ? error.message
            : "Ocorreu um erro inesperado ao disparar o aviso.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="avisos-page" style={PoppinsFontLib.style}>
      <div className="avisos-shell">
        <section className="avisos-hero fade-in">
          <span className="avisos-badge">Painel de avisos</span>
          <h1 className="avisos-hero-title">
            Envie avisos automaticos para as coordenadorias sem sair do sistema
          </h1>
          <p className="avisos-hero-description">
            Escolha o momento do aviso, selecione o modelo ideal e dispare o e-mail
            em um fluxo rapido, claro e profissional.
          </p>

          <div className="avisos-highlight-grid">
            <FeatureCard
              icon={<Bell size={20} />}
              title="Modelos prontos"
              description="Fluxo enxuto para pre-evento, pos-evento, teste e mensagens customizadas."
            />
            <FeatureCard
              icon={<Users size={20} />}
              title="Destinatarios por coordenadoria"
              description="Selecione uma ou varias coordenadorias em poucos cliques, com validacao antes do envio."
            />
            <FeatureCard
              icon={<ShieldCheck size={20} />}
              title="Integracao protegida"
              description="O backend valida a requisicao e encaminha o disparo para o Google Apps Script."
            />
          </div>

          <div className="glass-card avisos-side-note">
            <div className="avisos-side-note-icon">
              <Mail size={18} />
            </div>
            <div>
              <strong>Modo teste disponivel</strong>
              <p>{`Sempre envia apenas para ${EMAIL_TESTE}.`}</p>
            </div>
          </div>
        </section>

        <section className="glass-container avisos-form-card fade-in">
          <div className="avisos-form-header">
            <div>
              <span className="avisos-form-kicker">Disparo operacional</span>
              <h2 className="avisos-form-title">Configurar aviso</h2>
              <p className="avisos-form-description">
                Defina o tipo, escolha o aviso certo e revise os destinatarios antes de
                concluir o envio.
              </p>
            </div>

            <div className="glass-card avisos-status-card">
              <div className="avisos-status-icon">
                <ShieldCheck size={20} />
              </div>
              <div>
                <strong>Fluxo de ponta a ponta</strong>
                <span>Frontend, validacao e disparo integrados ao backend.</span>
              </div>
            </div>
          </div>

          <form className="avisos-form" onSubmit={handleSubmit}>
            <FormSection
              icon={<Clock3 size={18} />}
              title="1. Tipo do aviso"
              description="Escolha se o disparo corresponde a um prazo antes ou depois do evento."
            >
              <div className="avisos-choice-grid avisos-choice-grid-dual">
                {TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`avisos-choice-card glass-card ${tipo === option.value ? "is-active" : ""}`}
                    onClick={() => handleTipoChange(option.value)}
                  >
                    <div className="avisos-choice-header">
                      <div className="avisos-choice-icon">{option.icon}</div>
                      <span className="avisos-choice-badge">
                        {tipo === option.value ? <Check size={14} /> : <X size={14} />}
                      </span>
                    </div>
                    <strong>{option.label}</strong>
                    <p>{option.description}</p>
                  </button>
                ))}
              </div>
            </FormSection>

            <FormSection
              icon={<Bell size={18} />}
              title="2. Opcao escolhida"
              description="Selecione o modelo de mensagem que sera disparado para as coordenadorias."
            >
              <div className="avisos-choice-grid">
                {avisoOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`avisos-choice-card glass-card ${aviso === option.value ? "is-active" : ""}`}
                    onClick={() => handleAvisoChange(option.value)}
                  >
                    <div className="avisos-choice-header">
                      <div className="avisos-choice-icon">
                        {option.value === "customizado" ? (
                          <MessageSquare size={18} />
                        ) : option.value === "teste" ? (
                          <ShieldCheck size={18} />
                        ) : (
                          <Bell size={18} />
                        )}
                      </div>
                      <span className="avisos-choice-badge">
                        {aviso === option.value ? <Check size={14} /> : <X size={14} />}
                      </span>
                    </div>
                    <strong>{option.label}</strong>
                    <p>{option.description}</p>
                    <span className="avisos-choice-helper">{option.helper}</span>
                  </button>
                ))}
              </div>
            </FormSection>

            <FormSection
              icon={<Calendar size={18} />}
              title="3. Nome do evento"
              description="Preencha se quiser incluir a referencia do evento no payload e no texto final do e-mail."
            >
              <FieldGroup
                id="nome-evento"
                label="Nome do evento"
                value={nomeEvento}
                onChange={(value) => {
                  resetFeedback();
                  setNomeEvento(value);
                }}
                placeholder="Ex: Simposio de Clinica Medica 2026"
              />
            </FormSection>

            <FormSection
              icon={<Users size={18} />}
              title="4. Destinatarios"
              description={
                isTeste
                  ? "As coordenadorias marcadas sao preservadas, mas o modo teste ignora essa lista no envio."
                  : "Selecione uma ou mais coordenadorias que devem receber o aviso."
              }
            >
              {isTeste && (
                <div className="glass-card avisos-fixed-target">
                  <div className="avisos-fixed-target-icon">
                    <Mail size={18} />
                  </div>
                  <div>
                    <strong>Destino fixo para teste</strong>
                    <p>{EMAIL_TESTE}</p>
                  </div>
                </div>
              )}

              <div className="avisos-recipient-grid">
                {COORDENADORIAS.map((coordenadoria) => {
                  const checked = destinatarios.includes(coordenadoria.sigla);

                  return (
                    <label
                      key={coordenadoria.sigla}
                      htmlFor={`coordenadoria-${coordenadoria.sigla}`}
                      className={`avisos-recipient-card glass-card ${checked ? "is-active" : ""} ${isTeste ? "is-disabled" : ""}`}
                    >
                      <input
                        id={`coordenadoria-${coordenadoria.sigla}`}
                        type="checkbox"
                        className="avisos-recipient-input"
                        checked={checked}
                        disabled={isTeste}
                        onChange={() => toggleDestinatario(coordenadoria.sigla)}
                      />
                      <div className="avisos-recipient-header">
                        <strong>{coordenadoria.sigla}</strong>
                        <span>{checked ? "Selecionada" : "Disponivel"}</span>
                      </div>
                      <p>{coordenadoria.email}</p>
                    </label>
                  );
                })}
              </div>
            </FormSection>

            {isCustomizado && (
              <FormSection
                icon={<MessageSquare size={18} />}
                title="5. Mensagem customizada"
                description="Escreva o assunto e o corpo do e-mail exatamente como deseja disparar."
              >
                <FieldGroup
                  id="assunto-customizado"
                  label="Assunto customizado"
                  value={assuntoCustomizado}
                  onChange={(value) => {
                    resetFeedback();
                    setAssuntoCustomizado(value);
                  }}
                  placeholder="Ex: Atualizacao urgente sobre o envio da documentacao"
                  required
                />

                <FieldGroup
                  id="mensagem-customizada"
                  label="Mensagem customizada"
                  value={mensagemCustomizada}
                  onChange={(value) => {
                    resetFeedback();
                    setMensagemCustomizada(value);
                  }}
                  placeholder="Escreva a mensagem que sera encaminhada para as coordenadorias selecionadas."
                  textarea
                  required
                />
              </FormSection>
            )}

            <section className="glass-card avisos-summary-card">
              <div className="avisos-summary-header">
                <div className="avisos-summary-icon">
                  <Send size={18} />
                </div>
                <div>
                  <h3>Resumo do disparo</h3>
                  <p>Revise as escolhas antes de enviar o e-mail automatico.</p>
                </div>
              </div>

              <div className="avisos-summary-grid">
                <SummaryItem label="Tipo" value={tipo === "pre" ? "Pre-evento" : "Pos-evento"} />
                <SummaryItem label="Opcao" value={avisoSelecionado.label} />
                <SummaryItem label="Evento" value={nomeEvento.trim() || "Nao informado"} />
                <SummaryItem
                  label="Destino"
                  value={
                    isTeste
                      ? "CAC"
                      : destinatariosResumo.length > 0
                        ? destinatariosResumo.join(", ")
                        : "Nenhuma coordenadoria selecionada"
                  }
                />
              </div>

              {destinatariosResumo.length > 0 && (
                <div className="avisos-email-list">
                  {destinatariosResumo.map((destinatario) => (
                    <span key={destinatario} className="avisos-email-pill">
                      {destinatario}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <div className="avisos-actions">
              <p className="avisos-submit-note">{helperMessage}</p>
              <button
                type="submit"
                className="glass-button glass-button-primary avisos-submit-button"
                disabled={!isSubmitEnabled}
              >
                {isSubmitting ? (
                  <>
                    <span className="avisos-button-spinner" aria-hidden="true" />
                    Enviando aviso...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Enviar aviso
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      </div>

      {feedback.tone !== "idle" && (
        <FeedbackToast
          key={toastKey}
          feedback={feedback}
          onClose={() => setFeedback({ tone: "idle" })}
        />
      )}
    </main>
  );
}

const FeatureCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => {
  return (
    <article className="glass-card avisos-feature-card">
      <div className="avisos-feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
};

const FormSection: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}> = ({ icon, title, description, children }) => {
  return (
    <section className="avisos-section">
      <div className="avisos-section-header">
        <div className="avisos-section-icon">{icon}</div>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <div className="avisos-section-content">{children}</div>
    </section>
  );
};

const FieldGroup: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  textarea?: boolean;
  required?: boolean;
}> = ({ id, label, value, onChange, placeholder, textarea = false, required = false }) => {
  return (
    <div className="avisos-field">
      <label htmlFor={id} className="avisos-label">
        {label}
      </label>

      {textarea ? (
        <textarea
          id={id}
          className="glass-input avisos-input avisos-textarea"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
        />
      ) : (
        <input
          id={id}
          className="glass-input avisos-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
        />
      )}
    </div>
  );
};

const SummaryItem: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  return (
    <div className="avisos-summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
};

const FeedbackToast: React.FC<{
  feedback: Exclude<FeedbackState, { tone: "idle" }>;
  onClose: () => void;
}> = ({ feedback, onClose }) => {
  return (
    <div className={`avisos-feedback avisos-feedback-toast ${feedback.tone}`} role="status">
      <div className="avisos-feedback-main">
        <div className="avisos-feedback-icon">
          {feedback.tone === "success" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
        </div>
        <div className="avisos-feedback-content">
          <strong>{feedback.title}</strong>
          <p>{feedback.message}</p>

          {feedback.tone === "success" && feedback.subject ? (
            <span className="avisos-feedback-meta">Assunto enviado: {feedback.subject}</span>
          ) : null}

          {feedback.tone === "success" && feedback.sentTo.length > 0 ? (
            <div className="avisos-feedback-emails">
              {feedback.sentTo.map((email) => (
                <span key={email} className="avisos-email-pill">
                  {email}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="avisos-feedback-close"
          onClick={onClose}
          aria-label="Fechar aviso"
        >
          <X size={16} />
        </button>
      </div>
      <div className="avisos-feedback-progress" aria-hidden="true" />
    </div>
  );
};
