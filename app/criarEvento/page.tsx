"use client";

import ModalAction, { IModalProps } from "@/components/ModalAction";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import {
    CalendarDays,
    CircleDollarSign,
    FileImage,
    ShieldCheck,
    Sparkles,
    Users,
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
    const [eventName, setEventName] = useState("");
    const [eventDescription, setEventDescription] = useState("");
    const [templatePath, setTemplatePath] = useState("template04.png");
    const [templateVersePath, setTemplateVersePath] = useState("");
    const [eventType, setEventType] = useState("");
    const [maxParticipants, setMaxParticipants] = useState<number | "">("");
    const [isOpen, setIsOpen] = useState(true);
    const [isPaid, setIsPaid] = useState(false);
    const [price, setPrice] = useState<number | "">("");
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        setEventName("");
        setEventDescription("");
        setEventType("");
        setMaxParticipants("");
        setTemplatePath("template04.png");
        setTemplateVersePath("");
        setPrice("");
        setIsPaid(false);
        setIsOpen(true);
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
            formData.append("isOpen", isOpen.toString());
            formData.append("isPaid", isPaid.toString());

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
                                id="isOpen"
                                checked={isOpen}
                                onChange={(checked) => setIsOpen(checked)}
                                title="Inscricoes abertas"
                                description="Permite novas inscricoes assim que o evento for salvo."
                            />

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
