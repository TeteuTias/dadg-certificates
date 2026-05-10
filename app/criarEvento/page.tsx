"use client";

import ModalAction, { IModalProps } from "@/components/ModalAction";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import { EventStatusConfig, TimelineItem } from "@/lib/models/EventCertificateModel";
import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    CircleDollarSign,
    FileImage,
    Form,
    Plus,
    ShieldCheck,
    Sparkles,
    Trash2,
    Users,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { ObjectId } from "bson";
import "./page.css";

type ModalState = IModalProps & { isOpen: boolean };
type EventStatusManagerProps = {
    status: EventStatusConfig["status"];
    setStatus: (val: EventStatusConfig["status"]) => void;
    registrationStartDate: string;
    setRegistrationStartDate: (val: string) => void;
    registrationEndDate: string;
    setRegistrationEndDate: (val: string) => void;
    timeLine: TimelineItem[];
    setTimeLine: (val: TimelineItem[]) => void;
};

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
                        icon={<Sparkles size={18} />}
                        title="Status e cronograma"
                        description="Defina quando as inscrições abrem e fecham, além da linha do tempo do evento."
                    >
                        <EventStatusManager
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
//
//
function EventStatusManager({
    status,
    setStatus,
    registrationStartDate,
    setRegistrationStartDate,
    registrationEndDate,
    setRegistrationEndDate,
    timeLine,
    setTimeLine,
}: EventStatusManagerProps) {
    const [timelineError, setTimelineError] = useState<string | null>(null);

    const isPublishedOpen = status === 'PUBLISHED_OPEN';
    const isDraft = status === 'DRAFT';

    // 1. Lógica de Validação e Cruzamento de Horários
    const validateTimeline = useCallback((currentTimeline: TimelineItem[]) => {
        let error = null;

        for (let i = 0; i < currentTimeline.length; i++) {
            const item = currentTimeline[i];
            if (!item.startDate || !item.endDate) continue;

            const start = new Date(item.startDate).getTime();
            const end = new Date(item.endDate).getTime();

            // Evita que datas inválidas quebrem a validação
            if (isNaN(start) || isNaN(end)) continue;

            // 1. Checa coerência interna: Fim deve ser depois do Início
            // (Independente se é no passado ou no futuro em relação a hoje)
            if (end <= start) {
                error = "A data de fim deve ser posterior à data de início em todas as etapas.";
                break;
            }

            // 2. Checa cruzamento com os outros itens da timeline
            for (let j = i + 1; j < currentTimeline.length; j++) {
                const otherItem = currentTimeline[j];
                if (!otherItem.startDate || !otherItem.endDate) continue;

                const otherStart = new Date(otherItem.startDate).getTime();
                const otherEnd = new Date(otherItem.endDate).getTime();

                if (isNaN(otherStart) || isNaN(otherEnd)) continue;

                // Lógica de intersecção de datas: Se sobrepuser, dá erro.
                if (start < otherEnd && end > otherStart) {
                    error = "Existem horários conflitantes na timeline. Uma etapa não pode cruzar com a outra.";
                    break; // Quebra o loop interno
                }
            }

            if (error) break; // Quebra o loop externo se já achou um erro
        }

        setTimelineError(error);
    }, []);

    // Roda a validação sempre que a timeline muda
    useEffect(() => {
        validateTimeline(timeLine);
    }, [timeLine, validateTimeline]);

    // 2. Manipulação da Timeline
    const sortTimeline = (items: TimelineItem[]) => {
        return [...items].sort((a, b) => {
            if (!a.startDate) return 1;
            if (!b.startDate) return -1;
            return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });
    };

    const addTimelineItem = () => {
        // 1. Pega a data de agora
        const now = new Date();

        // 2. Ajusta para o fuso horário local do computador do usuário
        const tzOffset = now.getTimezoneOffset() * 60000;
        const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
        // O slice(0, 16) corta os segundos e milissegundos, deixando no formato YYYY-MM-DDTHH:mm

        // 3. Cria o item com a data de agora (para início e fim)
        const newItem: TimelineItem = {
            id: new ObjectId(),
            startDate: new Date(localISOTime),
            endDate: new Date(localISOTime),
            description: ''
        };

        setTimeLine([...timeLine, newItem]);
    };

    const updateTimelineItem = (id: string, field: keyof TimelineItem, value: string) => {
        const nextValue = field === 'startDate' || field === 'endDate' ? new Date(value) : value;
        const newTimeLine = timeLine.map(item =>
            `${item.id}` === id ? { ...item, [field]: nextValue } : item
        );
        setTimeLine(newTimeLine);
    };

    const removeTimelineItem = (id: string) => {
        setTimeLine(timeLine.filter(item => `${item.id}` !== id));
    };

    // Ordena ao perder o foco do campo de data (onBlur), evitando que o input pule enquanto o usuário digita
    const handleSortOnBlur = () => {
        if (!timelineError) {
            setTimeLine(sortTimeline(timeLine));
        }
    };

    // 3. Componentes Visuais Auxiliares
    const RequiredBadge = () => (
        <span style={{ fontSize: '0.75rem', color: '#ef4444', backgroundColor: '#fef2f2', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px', fontWeight: 'bold' }}>
            Obrigatório
        </span>
    );

    const OptionalBadge = () => (
        <span style={{ fontSize: '0.75rem', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>
            Opcional
        </span>
    );

    return (
        <div className="event-status-manager" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* STATUS DO EVENTO */}
            <div className="create-event-grid">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontWeight: 600 }}>Status do Evento <RequiredBadge /></label>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as EventStatusConfig["status"])}
                        className="glass-input" // Ajuste para a sua classe CSS de inputs
                        style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                    >
                        <option value="DRAFT">Rascunho (Oculto)</option>
                        <option value="PUBLISHED_OPEN">Publicado (Inscrições Abertas)</option>
                        <option value="PUBLISHED_CLOSED">Publicado (Inscrições Fechadas / Em Breve)</option>
                        <option value="CERTIFICATE_ONLY">Apenas Emissão de Certificados</option>
                    </select>
                </div>
            </div>

            {/* DATAS DE INSCRIÇÃO */}
            <div className="create-event-grid glass-card" style={{ padding: '1.5rem', border: isPublishedOpen ? '1px solid #3b82f6' : '1px solid transparent' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontWeight: 600 }}>
                        Início das Inscrições {isPublishedOpen ? <RequiredBadge /> : <OptionalBadge />}
                    </label>
                    <input
                        type="datetime-local"
                        value={registrationStartDate}
                        onChange={(e) => setRegistrationStartDate(e.target.value)}
                        required={isPublishedOpen}
                        className="glass-input"
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontWeight: 600 }}>
                        Fim das Inscrições {isPublishedOpen ? <RequiredBadge /> : <OptionalBadge />}
                    </label>
                    <input
                        type="datetime-local"
                        value={registrationEndDate}
                        onChange={(e) => setRegistrationEndDate(e.target.value)}
                        required={isPublishedOpen}
                        className="glass-input"
                    />
                </div>
            </div>

            {/* TIMELINE */}
            <div className="timeline-section glass-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                    <div>
                        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                            Cronograma do Evento {!isDraft ? <RequiredBadge /> : <OptionalBadge />}
                        </h4>
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            As etapas são organizadas automaticamente da mais antiga para a mais recente.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={addTimelineItem}
                        className="glass-button glass-button-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Plus size={16} /> Adicionar Etapa
                    </button>
                </div>

                {/* Alerta de Erro de Horário */}
                {timelineError && (
                    <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={20} />
                        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{timelineError}</span>
                    </div>
                )}

                <div className="timeline-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {timeLine.map((item, index) => (
                        <div key={`${item.id}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Data de Início</label>
                                <input
                                    type="datetime-local"
                                    value={item.startDate.toISOString().slice(0, 16)}
                                    onChange={(e) => updateTimelineItem(`${item.id}`, 'startDate', e.target.value)}
                                    onBlur={handleSortOnBlur}
                                    required={!isDraft}
                                    className="glass-input"
                                />
                            </div>
                            <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Data de Fim</label>
                                <input
                                    type="datetime-local"
                                    value={item.endDate.toISOString().slice(0, 16)}
                                    onChange={(e) => updateTimelineItem(`${item.id}`, 'endDate', e.target.value)}
                                    onBlur={handleSortOnBlur}
                                    required={!isDraft}
                                    className="glass-input"
                                />
                            </div>
                            <div style={{ flex: '2 1 300px', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Descrição da Etapa</label>
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => updateTimelineItem(`${item.id}`, 'description', e.target.value)}
                                        required={!isDraft}
                                        placeholder="Ex: Palestra de Abertura"
                                        className="glass-input"
                                        style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeTimelineItem(`${item.id}`)}
                                    className="glass-button"
                                    style={{ color: '#ef4444', borderColor: '#ef4444', padding: '0.75rem' }}
                                    title="Remover etapa"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {timeLine.length === 0 && (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <CheckCircle2 size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                            <p>Nenhuma etapa adicionada ao cronograma.</p>
                            {!isDraft && <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>Você precisa adicionar pelo menos uma etapa para o status atual.</p>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}