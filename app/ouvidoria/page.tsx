"use client";

import { useState } from "react";
import "./style.css";

const MIN_LENGTH = 20;
const MAX_LENGTH = 2000;
const MAX_NAME_LENGTH = 80;

const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 13;

const MIN_TURMA = 1;
const MAX_TURMA = 999;

const TOPIC_OPTIONS = [
  { value: "infraestrutura", label: "Infraestrutura" },
  { value: "problemas da turma", label: "Problemas da turma" },
  { value: "problemas com a coordenação", label: "Problemas com a coordenação" },
  { value: "problemas com os professores", label: "Problemas com os professores" },
  { value: "certificados", label: "Certificados" },
] as const;

const CERTIFICADOS_TOPIC = "certificados";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatPhoneBR(value: string) {
  const digits = onlyDigits(value).slice(0, MAX_PHONE_DIGITS);

  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  if (!rest) return `(${ddd})`;

  // 11 dígitos (celular): (DD) 99999-9999
  // 10 dígitos (fixo):    (DD) 9999-9999
  const prefixLen = rest.length >= 9 ? 5 : 4;
  const prefix = rest.slice(0, prefixLen);
  const suffix = rest.slice(prefixLen, prefixLen + 4);

  return suffix ? `(${ddd}) ${prefix}-${suffix}` : `(${ddd}) ${prefix}`;
}

export default function OuvidoriaPage() {
  const [topic, setTopic] = useState("");
  const [classNumber, setClassNumber] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState("");
  const [website, setWebsite] = useState("");
  const [showCertificadosPopup, setShowCertificadosPopup] = useState(false);

  const isCertificadosTopic = topic === CERTIFICADOS_TOPIC;

  function handleTopicClick(value: string) {
    if (value === CERTIFICADOS_TOPIC) {
      setShowCertificadosPopup(true);
    } else {
      setPhone("");
    }
    setTopic(value);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");

    if (topic === CERTIFICADOS_TOPIC && !name.trim()) {
      setStatus("error");
      setError("Para o tópico Certificados, o nome completo é obrigatório.");
      return;
    }

    if (name.trim().length > MAX_NAME_LENGTH) {
      setStatus("error");
      setError(`Nome muito longo (máx ${MAX_NAME_LENGTH} caracteres).`);
      return;
    }

    const turmaNum = parseInt(classNumber, 10);
    if (!Number.isFinite(turmaNum) || turmaNum < MIN_TURMA || turmaNum > MAX_TURMA) {
      setStatus("error");
      setError(`Turma inválida (use um número entre ${MIN_TURMA} e ${MAX_TURMA}).`);
      return;
    }

    const phoneDigits = onlyDigits(phone);
    if (topic === CERTIFICADOS_TOPIC) {
      if (
        phoneDigits.length < MIN_PHONE_DIGITS ||
        phoneDigits.length > MAX_PHONE_DIGITS
      ) {
        setStatus("error");
        setError("Telefone inválido. Informe um número com DDD.");
        return;
      }
    } else if (phoneDigits) {
      if (
        phoneDigits.length < MIN_PHONE_DIGITS ||
        phoneDigits.length > MAX_PHONE_DIGITS
      ) {
        setStatus("error");
        setError("Telefone inválido. Informe um número com DDD.");
        return;
      }
    }

    if (message.length < MIN_LENGTH || message.length > MAX_LENGTH) {
      setStatus("error");
      setError(`Mensagem inválida (mín ${MIN_LENGTH}, máx ${MAX_LENGTH} caracteres).`);
      return;
    }

    const r = await fetch("/api/ouvidoria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        classNumber: turmaNum,
        name,
        phone,
        message,
        website,
      }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok || !data.ok) {
      setStatus("error");
      setError(data?.error ?? "Não foi possível enviar.");
      return;
    }

    setStatus("ok");
    setTopic("");
    setClassNumber("");
    setName("");
    setPhone("");
    setMessage("");
    setWebsite("");
  }

  return (
    <main className="ouvidoria-container">
      <div className="ouvidoria-content">
        <header className="ouvidoria-header">
          <h1 className="ouvidoria-title">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Ouvidoria
          </h1>
          <p className="ouvidoria-subtitle">
            Selecione um tópico e descreva sua demanda. Sua opinião é importante para nós.
            (Mínimo {MIN_LENGTH} caracteres)
          </p>
        </header>

        <div className="ouvidoria-form-card">
          <form onSubmit={onSubmit} className="ouvidoria-form">
            <div className="ouvidoria-honeypot" aria-hidden>
              <label>
                Website
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
            </div>

            <div className="ouvidoria-field">
              <span className="ouvidoria-field-label" id="ouvidoria-topic-label">
                Tópico
              </span>
              <div
                className="ouvidoria-topic-grid"
                role="group"
                aria-labelledby="ouvidoria-topic-label"
              >
                {TOPIC_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`ouvidoria-topic-option ${topic === opt.value ? "selected" : ""}`}
                    onClick={() => handleTopicClick(opt.value)}
                    aria-pressed={topic === opt.value}
                  >
                    <span className="ouvidoria-topic-option-text">{opt.label}</span>
                    {topic === opt.value && (
                      <span className="ouvidoria-topic-option-check" aria-hidden>
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {!topic && <span className="ouvidoria-topic-hint">Escolha um tópico acima</span>}
              <input
                type="text"
                name="topic"
                value={topic}
                readOnly
                required
                tabIndex={-1}
                aria-hidden
                className="ouvidoria-topic-hidden"
              />
            </div>

            <div className="ouvidoria-field">
              <label htmlFor="ouvidoria-class">Turma</label>
              <div className="ouvidoria-input-wrap ouvidoria-class-wrap">
                <span className="ouvidoria-input-icon" aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <input
                  id="ouvidoria-class"
                  type="number"
                  inputMode="numeric"
                  className="ouvidoria-input"
                  value={classNumber}
                  onChange={(e) => setClassNumber(e.target.value)}
                  min={MIN_TURMA}
                  max={MAX_TURMA}
                  required
                  placeholder="Ex.: 39"
                  aria-describedby="ouvidoria-class-hint"
                />
              </div>
              <span id="ouvidoria-class-hint" className="ouvidoria-turma-hint">
                {classNumber ? `Turma ${classNumber}` : ``}
              </span>
            </div>

            <div className="ouvidoria-field">
              <label htmlFor="ouvidoria-name">
                Nome {isCertificadosTopic ? <span className="ouvidoria-required">*</span> : "(opcional)"}
              </label>
              <div className="ouvidoria-input-wrap ouvidoria-name-wrap">
                <span className="ouvidoria-input-icon" aria-hidden>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  id="ouvidoria-name"
                  type="text"
                  className="ouvidoria-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={MAX_NAME_LENGTH}
                  placeholder={isCertificadosTopic ? "Digite seu nome completo" : "Se quiser se identificar..."}
                  autoComplete="name"
                  required={isCertificadosTopic}
                  aria-required={isCertificadosTopic}
                />
              </div>
              <span className="ouvidoria-char-count">
                {name.trim().length} / {MAX_NAME_LENGTH} caracteres
              </span>
            </div>

            {isCertificadosTopic && (
              <div className="ouvidoria-field">
                <label htmlFor="ouvidoria-phone">
                  Telefone <span className="ouvidoria-required">*</span>
                </label>
                <div className="ouvidoria-input-wrap ouvidoria-phone-wrap">
                  <span className="ouvidoria-input-icon" aria-hidden>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.63 2.62a2 2 0 0 1-.45 2.11L8 9.91a16 16 0 0 0 6.09 6.09l1.46-1.29a2 2 0 0 1 2.11-.45c.84.3 1.72.51 2.62.63A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </span>
                  <input
                    id="ouvidoria-phone"
                    type="tel"
                    inputMode="tel"
                    className="ouvidoria-input"
                    value={phone}
                  onChange={(e) => setPhone(formatPhoneBR(e.target.value))}
                    placeholder="Ex.: (34) 99999-9999"
                    autoComplete="tel"
                    required
                  />
                </div>
                <span className="ouvidoria-char-count">
                  {onlyDigits(phone).length} dígitos informados
                </span>
              </div>
            )}

            <div className="ouvidoria-field">
              <label htmlFor="ouvidoria-message">Mensagem</label>
              <textarea
                id="ouvidoria-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                minLength={MIN_LENGTH}
                maxLength={MAX_LENGTH}
                required
                placeholder="Descreva com detalhes sua sugestão, reclamação ou dúvida..."
              />
              <span className="ouvidoria-char-count">
                {message.length} / {MAX_LENGTH} caracteres
              </span>
            </div>

            <button type="submit" className="ouvidoria-submit" disabled={status === "sending"}>
              {status === "sending" ? "Enviando..." : "Enviar"}
            </button>

            {status === "ok" && (
              <p className="ouvidoria-feedback success" role="status">
                Mensagem enviada. Obrigado!
              </p>
            )}
            {status === "error" && (
              <p className="ouvidoria-feedback error" role="alert">
                {error}
              </p>
            )}
          </form>
        </div>
      </div>

      {showCertificadosPopup && (
        <div className="ouvidoria-popup-overlay" role="dialog" aria-modal="true" aria-labelledby="ouvidoria-popup-title">
          <div className="ouvidoria-popup">
            <h2 id="ouvidoria-popup-title" className="ouvidoria-popup-title">Tópico Certificados</h2>
            <p className="ouvidoria-popup-text">
              Para este tópico, é necessário inserir o <strong>nome completo</strong> no campo e{" "}
              <strong>telefone</strong> para que possamos entrar em contato com você se necessário.
            </p>
            <button
              type="button"
              className="ouvidoria-popup-close"
              onClick={() => setShowCertificadosPopup(false)}
              aria-label="Fechar"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </main>
  );
}