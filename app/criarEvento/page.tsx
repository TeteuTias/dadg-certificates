"use client";

import ModalAction, { IModalProps } from "@/components/ModalAction";
import StatusScheduleManager from "@/components/EventStatusManager";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import { EventStatusConfig, TimelineItem } from "@/lib/models/EventCertificateModel";
import {
    CalendarDays,
    CircleDollarSign,
    FileImage,
    ShieldCheck,
    Sparkles,
    Users,
    Wand2,
    CheckCircle2 // <-- Novo ícone para o estado ativado
} from "lucide-react";
import React, { useState } from "react";
import "./page.css";

type ModalState = IModalProps & { isOpen: boolean };

export default function Page() {
    return (
        <main className="create-event-page" style={PoppinsFontLib.style}>
            <div className="create-event-shell">
                <section className="create-event-hero fade-in">
                    <span className="create-event-badge">Novo evento</span>
                    <h1 className="create-event-hero-title">Monte um evento pronto para emitir certificados</h1>
                    <p className="create-event-hero-description">
                        Configure as informacoes principais, regras de inscricao e os templates que serao usados na geracao dos certificados.
                    </p>

                    <div className="create-event-highlight-grid">
                        <FeatureCard
                            icon={<CalendarDays size={22} />}
                            title="Informacoes basicas"
                            description="Nome, descricao e tipo do evento organizados em uma estrutura mais clara."
                        />
                        <FeatureCard
                            icon={<Users size={22} />}
                            title="Regras de acesso"
                            description="Defina vagas, inscricoes abertas e se o evento sera gratuito ou pago."
                        />
                        <FeatureCard
                            icon={<FileImage size={22} />}
                            title="Templates prontos"
                            description="Associe frente e verso do certificado sem sair do mesmo fluxo."
                        />
                    </div>
                </section>

                <CreateEventCertificateForm />
            </div>
        </main>
    );
}

const CreateEventCertificateForm: React.FC = () => {
    const [status, setStatus] = useState<EventStatusConfig["status"]>("DRAFT");
    const [registrationStartDate, setRegistrationStartDate] = useState<string>("");
    const [registrationEndDate, setRegistrationEndDate] = useState<string>("");
    const [timeLine, setTimeLine] = useState<TimelineItem[]>([]);
    const [eventName, setEventName] = useState("");
    const [eventDescription, setEventDescription] = useState("");
    const [templatePath, setTemplatePath] = useState("template04.png");
    const [templateVersePath, setTemplateVersePath] = useState("");
    const [eventType, setEventType] = useState("");
    const [maxParticipants, setMaxParticipants] = useState<number | "">("");
    const [isPaid, setIsPaid] = useState(false);
    const [price, setPrice] = useState<number | "">("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- NOVO ESTADO: Controla a animação e o status do botão CLAM ---
    const [isClamFormatActive, setIsClamFormatActive] = useState(false);

    const [modalOpenProps, setModalOpenProps] = useState<ModalState>({
        title: "Atencao",
        emoji: "",
        text: "Voce esta prestes a criar um evento. Deseja continuar?",
        isOpen: false,
        buttons: [
            {
                label: "",
                action: () => setModalOpenProps((prev) => ({ ...prev, isOpen: false })),
            },
        ],
    });

    const toggleModalOpenProps = (newState: Partial<ModalState>) => {
        setModalOpenProps((prev) => ({ ...prev, ...newState }));
    };

    const resetForm = () => {
        setStatus("DRAFT");
        setRegistrationStartDate("");
        setRegistrationEndDate("");
        setTimeLine([]);
        setEventName("");
        setEventDescription("");
        setEventType("");
        setMaxParticipants("");
        setTemplatePath("template04.png");
        setTemplateVersePath("");
        setPrice("");
        setIsPaid(false);
        setIsClamFormatActive(false); // Reseta o botão do CLAM
    };

    // --- NOVA LÓGICA: Liga/Desliga a formatação com atualização de estado ---
    const toggleClamFormat = () => {
        setIsClamFormatActive((prev) => !prev);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const formData = new FormData();
            formData.append("eventName", eventName);
            formData.append("eventDescription", eventDescription);
            formData.append("templatePath", templatePath);
            formData.append("templateVersePath", templateVersePath);
            formData.append("eventType", eventType);
            formData.append("maxParticipants", maxParticipants.toString());
            formData.append("isPaid", isPaid.toString());
            formData.append("status", status);
            formData.append("registrationStartDate", registrationStartDate);
            formData.append("registrationEndDate", registrationEndDate);
            formData.append("timeLine", JSON.stringify(timeLine));
            formData.append("templateForm", isClamFormatActive ? "CLAM" : "default")
            if (isPaid && price !== "") {
                formData.append("price", price.toString());
            }

            const response = await fetch("/api/put/createNewEvent/", {
                method: "PUT",
                body: formData,
            });

            const dataJson: { message: string } = await response.json();

            if (!response.ok) {
                toggleModalOpenProps({
                    title: "Erro ao criar evento",
                    text: dataJson.message,
                    isOpen: true,
                    buttons: [
                        {
                            label: "Fechar",
                            action: () => toggleModalOpenProps({ isOpen: false }),
                        },
                    ],
                });
                return;
            }

            toggleModalOpenProps({
                title: "Evento adicionado com sucesso",
                text: dataJson.message,
                isOpen: true,
                buttons: [
                    {
                        label: "Perfeito",
                        action: () => toggleModalOpenProps({ isOpen: false }),
                    },
                ],
            });

            resetForm();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {modalOpenProps.isOpen && <ModalAction {...modalOpenProps} />}

            <section className="glass-container create-event-form-card fade-in">
                <div className="create-event-form-header">
                    <div>
                        <span className="create-event-form-kicker">Configuracao</span>
                        <h2 className="create-event-form-title">Criar evento</h2>
                        <p className="create-event-form-description">
                            Preencha os campos abaixo para publicar um novo evento no mesmo padrao visual do restante do sistema.
                        </p>
                    </div>

                    <div className="create-event-status-card glass-card">
                        <div className="create-event-status-icon">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <strong>Fluxo organizado</strong>
                            <span>Os dados estao separados por contexto para acelerar o cadastro.</span>
                        </div>
                    </div>
                </div>

                <form className="create-event-form" onSubmit={handleSubmit}>
                    <FormSection
                        icon={<Sparkles size={18} />}
                        title="Informacoes basicas"
                        description="Dados que identificam o evento e ajudam na busca dentro da plataforma."
                    >
                        <div className="create-event-grid">
                            <FieldGroup
                                id="eventName"
                                label="Nome do evento"
                                value={eventName}
                                onChange={(value) => setEventName(value)}
                                required
                                placeholder="Ex: Seminario de Lideranca 2026"
                            />

                            <FieldGroup
                                id="eventType"
                                label="Tipo de evento"
                                value={eventType}
                                onChange={(value) => setEventType(value)}
                                required
                                placeholder="Workshop, palestra, aula especial..."
                            />
                        </div>

                        <FieldGroup
                            id="eventDescription"
                            label="Descricao do evento"
                            value={eventDescription}
                            onChange={(value) => setEventDescription(value)}
                            required
                            textarea
                            placeholder="Explique rapidamente o objetivo do evento e o que o participante vai receber."
                        />

                        {/* --- SESSÃO ATUALIZADA: BOTÃO CLAM COM ANIMAÇÃO --- */}
                        <div 
                            className="glass-card" 
                            style={{ 
                                marginTop: "1rem", 
                                padding: "1.25rem", 
                                display: "flex", 
                                alignItems: "center", 
                                gap: "1.5rem",
                                flexWrap: "wrap",
                                transition: "all 0.3s ease-in-out",
                                borderColor: isClamFormatActive ? "rgba(46, 204, 113, 0.4)" : "var(--border-color)",
                                backgroundColor: isClamFormatActive ? "rgba(46, 204, 113, 0.05)" : "transparent"
                            }}
                        >
                            <button
                                type="button"
                                onClick={toggleClamFormat}
                                className="glass-button"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    whiteSpace: "nowrap",
                                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                    transform: isClamFormatActive ? "scale(1.02)" : "scale(1)",
                                    backgroundColor: isClamFormatActive ? "rgba(46, 204, 113, 0.15)" : "",
                                    borderColor: isClamFormatActive ? "rgba(46, 204, 113, 0.6)" : "",
                                    color: isClamFormatActive ? "#27ae60" : "inherit",
                                    boxShadow: isClamFormatActive ? "0 4px 12px rgba(46, 204, 113, 0.2)" : "none"
                                }}
                            >
                                <div style={{ 
                                    transition: "transform 0.4s ease-in-out", 
                                    transform: isClamFormatActive ? "rotate(360deg)" : "rotate(0deg)",
                                    display: "flex"
                                }}>
                                    {isClamFormatActive ? <CheckCircle2 size={16} /> : <Wand2 size={16} />}
                                </div>
                                
                                {isClamFormatActive ? "Formatação CLAM Ativada" : "Usar formatação CLAM"}
                            </button>
                            <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-color, inherit)", opacity: 0.85 }}>
                                    <strong>Facilite seu trabalho:</strong> Este botão ajusta automaticamente o texto acima, 
                                    deixando-o no tamanho e formato padrão que a equipe do CLAM mais gosta e aprova.
                                </p>
                            </div>
                        </div>
                        {/* --- FIM DA SESSÃO --- */}

                    </FormSection>
                    <FormSection
                        icon={<Sparkles size={18} />}
                        title="Status e cronograma"
                        description="Defina quando as inscricoes abrem e fecham, alem da linha do tempo do evento."
                    >
                        <StatusScheduleManager
                            status={status}
                            setStatus={setStatus}
                            registrationStartDate={registrationStartDate}
                            setRegistrationStartDate={setRegistrationStartDate}
                            registrationEndDate={registrationEndDate}
                            setRegistrationEndDate={setRegistrationEndDate}
                            timeLine={timeLine}
                            setTimeLine={setTimeLine}
                        />
                    </FormSection>
                    <FormSection
                        icon={<Users size={18} />}
                        title="Regras e disponibilidade"
                        description="Defina capacidade, status de inscricao e politica de pagamento."
                    >
                        <div className="create-event-grid create-event-grid-compact">
                            <FieldGroup
                                id="maxParticipants"
                                label="Quantidade maxima de participantes"
                                value={maxParticipants}
                                onChange={(value) => setMaxParticipants(value === "" ? "" : Number(value))}
                                required
                                type="number"
                                min={1}
                                placeholder="100"
                            />
                        </div>

                        <div className="create-event-toggle-grid">
                            <ToggleCard
                                id="isPaid"
                                checked={isPaid}
                                onChange={(checked) => {
                                    setIsPaid(checked);
                                    if (!checked) {
                                        setPrice("");
                                    }
                                }}
                                title="Evento pago"
                                description="Ative para informar o valor de participacao."
                                icon={<CircleDollarSign size={18} />}
                            />
                        </div>

                        {isPaid && (
                            <div className="create-event-price-panel glass-card">
                                <FieldGroup
                                    id="price"
                                    label="Valor do evento (R$)"
                                    value={price}
                                    onChange={(value) => setPrice(value === "" ? "" : Number(value))}
                                    required={isPaid}
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    placeholder="49.90"
                                />
                            </div>
                        )}
                    </FormSection>

                    <FormSection
                        icon={<FileImage size={18} />}
                        title="Templates do certificado"
                        description="Indique o template da frente e, se existir, o do verso."
                    >
                        <FieldGroup
                            id="templatePath"
                            label="Template da frente"
                            value={templatePath}
                            onChange={(value) => setTemplatePath(value)}
                            required
                            textarea
                            placeholder="ID ou caminho do arquivo principal"
                        />

                        <FieldGroup
                            id="templateVersePath"
                            label="Template do verso"
                            value={templateVersePath}
                            onChange={(value) => setTemplateVersePath(value)}
                            textarea
                            hint="Deixe em branco se o certificado nao tiver verso."
                            placeholder="ID ou caminho do arquivo do verso"
                        />
                    </FormSection>

                    <div className="create-event-actions">
                        <button
                            type="submit"
                            className="glass-button glass-button-primary create-event-submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Criando evento..." : "Criar evento"}
                        </button>
                    </div>
                </form>
            </section>
        </>
    );
};

// ... O restante dos componentes continuam inalterados (FeatureCard, FormSection, FieldGroup, ToggleCard)
const FeatureCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    description: string;
}> = ({ icon, title, description }) => {
    return (
        <article className="glass-card create-event-feature-card">
            <div className="create-event-feature-icon">{icon}</div>
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
        <section className="create-event-section">
            <div className="create-event-section-header">
                <div className="create-event-section-icon">{icon}</div>
                <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                </div>
            </div>

            <div className="create-event-section-content">{children}</div>
        </section>
    );
};

const FieldGroup: React.FC<{
    id: string;
    label: string;
    value: string | number;
    onChange: (value: string) => void;
    placeholder?: string;
    hint?: string;
    required?: boolean;
    textarea?: boolean;
    type?: React.HTMLInputTypeAttribute;
    min?: number;
    step?: string;
}> = ({
    id,
    label,
    value,
    onChange,
    placeholder,
    hint,
    required = false,
    textarea = false,
    type = "text",
    min,
    step,
}) => {
        return (
            <div className="create-event-field">
                <label htmlFor={id} className="create-event-label">
                    {label}
                </label>

                {textarea ? (
                    <textarea
                        id={id}
                        required={required}
                        className="glass-input create-event-input create-event-textarea"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                    />
                ) : (
                    <input
                        id={id}
                        required={required}
                        className="glass-input create-event-input"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        type={type}
                        min={min}
                        step={step}
                    />
                )}

                {hint && <span className="create-event-hint">{hint}</span>}
            </div>
        );
    };

const ToggleCard: React.FC<{
    id: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    title: string;
    description: string;
    icon?: React.ReactNode;
}> = ({ id, checked, onChange, title, description, icon }) => {
    return (
        <label className={`create-event-toggle-card glass-card ${checked ? "is-active" : ""}`} htmlFor={id}>
            <input
                id={id}
                type="checkbox"
                className="create-event-toggle-input"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />

            <div className="create-event-toggle-header">
                <div className="create-event-toggle-icon">{icon ?? <ShieldCheck size={18} />}</div>
                <span className="create-event-toggle-badge">{checked ? "Ativo" : "Inativo"}</span>
            </div>

            <strong>{title}</strong>
            <p>{description}</p>
        </label>
    );
};