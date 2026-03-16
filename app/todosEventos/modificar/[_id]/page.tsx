"use client";

import LoadingModal from "@/components/LoadingModal";
import LoadingPage from "@/components/LoadingPage";
import ModalAction, { IModalProps } from "@/components/ModalAction";
import { IEventParticipant } from "@/lib/models/EventParticipant";
import { IEventCertificate } from "@/lib/models/EventCertificateModel";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import { libSourceSerif4 } from "@/public/fonts/lib/libSourceSerif4";
import {
    ArrowLeft,
    CalendarDays,
    CircleDollarSign,
    ExternalLink,
    FileCode2,
    FileImage,
    LayoutTemplate,
    PencilRuler,
    Save,
    Settings2,
    Sparkles,
    Users,
    X,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import "./page.css";

type ViewMode = "overview" | "settings";
type ModalState = IModalProps & { isOpen: boolean };

type EventFormState = {
    eventName: string;
    eventDescription: string;
    eventType: string;
    documentVersion: string;
    maxParticipants: number | "";
    registrationCount: number | "";
    isOpen: boolean;
    isPaid: boolean;
    price: number | "";
    templatePath: string;
    templateVersePath: string;
    styleContainer: string;
    styleContainerVerse: string;
    styleFrontTopperText: string;
    styleFrontBottomText: string;
    styleNameText: string;
};

type FieldName = keyof EventFormState;
type DirtyFields = Record<FieldName, boolean>;
type VisualStyles = Pick<
    IEventCertificate,
    "styleContainer" | "styleContainerVerse" | "styleFrontTopperText" | "styleFrontBottomText" | "styleNameText"
>;

const createEmptyFormState = (): EventFormState => ({
    eventName: "",
    eventDescription: "",
    eventType: "",
    documentVersion: "",
    maxParticipants: "",
    registrationCount: "",
    isOpen: true,
    isPaid: false,
    price: "",
    templatePath: "",
    templateVersePath: "",
    styleContainer: "{}",
    styleContainerVerse: "{}",
    styleFrontTopperText: "{}",
    styleFrontBottomText: "{}",
    styleNameText: "{}",
});

const createDirtyFields = (): DirtyFields => ({
    eventName: false,
    eventDescription: false,
    eventType: false,
    documentVersion: false,
    maxParticipants: false,
    registrationCount: false,
    isOpen: false,
    isPaid: false,
    price: false,
    templatePath: false,
    templateVersePath: false,
    styleContainer: false,
    styleContainerVerse: false,
    styleFrontTopperText: false,
    styleFrontBottomText: false,
    styleNameText: false,
});

const buildFormState = (eventData: IEventCertificate): EventFormState => ({
    eventName: eventData.eventName || "",
    eventDescription: eventData.eventDescription || "",
    eventType: eventData.eventType || "",
    documentVersion: eventData.documentVersion || "",
    maxParticipants: eventData.maxParticipants || 0,
    registrationCount: eventData.registrationCount || 0,
    isOpen: eventData.isOpen ?? true,
    isPaid: eventData.isPaid ?? false,
    price: eventData.isPaid ? eventData.price : 0,
    templatePath: eventData.templatePath || "",
    templateVersePath: eventData.templateVersePath || "",
    styleContainer: JSON.stringify(eventData.styleContainer || {}, null, 2),
    styleContainerVerse: JSON.stringify(eventData.styleContainerVerse || {}, null, 2),
    styleFrontTopperText: JSON.stringify(eventData.styleFrontTopperText || {}, null, 2),
    styleFrontBottomText: JSON.stringify(eventData.styleFrontBottomText || {}, null, 2),
    styleNameText: JSON.stringify(eventData.styleNameText || {}, null, 2),
});

export default function Page({ params }: { params: Promise<{ _id: string }> }) {
    const [eventId, setEventId] = useState("");
    const [eventData, setEventData] = useState<IEventCertificate | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("overview");
    const [openEditor, setOpenEditor] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    const [formData, setFormData] = useState<EventFormState>(createEmptyFormState);
    const [originalFormData, setOriginalFormData] = useState<EventFormState>(createEmptyFormState);
    const [dirtyFields, setDirtyFields] = useState<DirtyFields>(createDirtyFields);
    const [modalState, setModalState] = useState<ModalState>({
        title: "Aviso",
        emoji: "",
        text: "",
        isOpen: false,
        buttons: [
            {
                label: "Fechar",
                action: () => setModalState((prev) => ({ ...prev, isOpen: false })),
            },
        ],
    });

    useEffect(() => {
        const loadEvent = async () => {
            const slug = (await params)._id;
            setEventId(slug);

            const response = await fetch(`/api/get/eventById/${slug}`);
            if (!response.ok) {
                setLoading(false);
                setModalState((prev) => ({
                    ...prev,
                    title: "Erro ao carregar",
                    text: "Nao foi possivel carregar os dados do evento.",
                    isOpen: true,
                }));
                return;
            }

            const dataJson: { data: IEventCertificate } = await response.json();
            const nextFormState = buildFormState(dataJson.data);

            setEventData(dataJson.data);
            setFormData(nextFormState);
            setOriginalFormData(nextFormState);
            setDirtyFields(createDirtyFields());
            setLoading(false);
        };

        loadEvent();
    }, [params]);

    const summaryCards = useMemo(() => {
        if (!eventData) {
            return [];
        }

        return [
            {
                icon: <Sparkles size={18} />,
                label: "Tipo",
                value: eventData.eventType || "Nao definido",
            },
            {
                icon: <Users size={18} />,
                label: "Participantes",
                value: `${eventData.registrationCount || 0}/${eventData.maxParticipants || 0}`,
            },
            {
                icon: <CalendarDays size={18} />,
                label: "Inscricoes",
                value: eventData.isOpen ? "Abertas" : "Fechadas",
            },
            {
                icon: <CircleDollarSign size={18} />,
                label: "Pagamento",
                value: eventData.isPaid ? formatCurrency(eventData.price) : "Gratuito",
            },
        ];
    }, [eventData]);

    const updateModal = (nextState: Partial<ModalState>) => {
        setModalState((prev) => ({ ...prev, ...nextState }));
    };

    const updateFieldValue = <K extends FieldName>(name: K, value: EventFormState[K]) => {
        setFormData((prev) => {
            const next = { ...prev, [name]: value } as EventFormState;
            if (name === "isPaid" && value === false) {
                next.price = 0;
            }
            return next;
        });

        setDirtyFields((prev) => {
            const next = { ...prev, [name]: value !== originalFormData[name] } as DirtyFields;
            if (name === "isPaid" && value === false) {
                next.price = originalFormData.price !== 0;
            }
            return next;
        });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const target = e.target;
        const name = target.name as FieldName;

        if (target.type === "checkbox") {
            updateFieldValue(name, (target as HTMLInputElement).checked as EventFormState[FieldName]);
            return;
        }

        if (target.type === "number") {
            updateFieldValue(
                name,
                (target.value === "" ? "" : Number(target.value)) as EventFormState[FieldName],
            );
            return;
        }

        updateFieldValue(name, target.value as EventFormState[FieldName]);
    };

    const saveField = async (fieldName: FieldName) => {
        if (!eventData) {
            return;
        }

        setSaving(true);

        try {
            const payload = {
                ...formData,
                _id: eventData._id,
                styleContainer: JSON.parse(formData.styleContainer),
                styleContainerVerse: JSON.parse(formData.styleContainerVerse),
                styleFrontBottomText: JSON.parse(formData.styleFrontBottomText),
                styleFrontTopperText: JSON.parse(formData.styleFrontTopperText),
                styleNameText: JSON.parse(formData.styleNameText),
            };

            const response = await fetch("/api/put/updateEvent/", {
                method: "PUT",
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok && !result.success) {
                throw new Error(result.message || "Nao foi possivel salvar este campo.");
            }

            const mergedEvent = {
                ...eventData,
                ...payload,
                styleContainer: payload.styleContainer,
                styleContainerVerse: payload.styleContainerVerse,
                styleFrontBottomText: payload.styleFrontBottomText,
                styleFrontTopperText: payload.styleFrontTopperText,
                styleNameText: payload.styleNameText,
            } as IEventCertificate;

            setEventData(mergedEvent);
            setOriginalFormData((prev) => ({ ...prev, [fieldName]: formData[fieldName] }));
            setDirtyFields((prev) => ({ ...prev, [fieldName]: false }));

            if (fieldName === "isPaid" && formData.isPaid === false) {
                setOriginalFormData((prev) => ({ ...prev, price: 0 }));
                setDirtyFields((prev) => ({ ...prev, price: false }));
            }

            updateModal({
                title: "Campo salvo com sucesso",
                text: "A alteracao foi registrada sem perder o restante das configuracoes.",
                isOpen: true,
                buttons: [
                    {
                        label: "Fechar",
                        action: () => updateModal({ isOpen: false }),
                    },
                ],
            });
        } catch (error) {
            updateModal({
                title: "Erro ao salvar",
                text: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
                isOpen: true,
                buttons: [
                    {
                        label: "Fechar",
                        action: () => updateModal({ isOpen: false }),
                    },
                ],
            });
        } finally {
            setSaving(false);
        }
    };

    const handleStylesSaved = (styles: VisualStyles) => {
        if (!eventData) {
            return;
        }

        const nextEvent = {
            ...eventData,
            ...styles,
        };

        setEventData(nextEvent);
        const nextFormState = buildFormState(nextEvent);
        setFormData(nextFormState);
        setOriginalFormData(nextFormState);
        setDirtyFields(createDirtyFields());
    };

    if (loading) {
        return <LoadingPage message="Carregando dados do evento..." />;
    }

    if (!eventData) {
        return (
            <main className="event-modify-page" style={PoppinsFontLib.style}>
                {modalState.isOpen && <ModalAction {...modalState} />}
                <section className="event-empty-state">
                    <h1>Evento nao encontrado</h1>
                    <Link href="/todosEventos" className="glass-button">
                        Voltar
                    </Link>
                </section>
            </main>
        );
    }

    if (openEditor) {
        return (
            <VisualEditor
                eventData={eventData}
                onBack={() => setOpenEditor(false)}
                onSaved={handleStylesSaved}
            />
        );
    }

    return (
        <main className="event-modify-page" style={PoppinsFontLib.style}>
            {saving && <LoadingModal />}
            {modalState.isOpen && <ModalAction {...modalState} />}

            <div className="event-modify-shell">
                <header className="event-modify-header fade-in">
                    <div className="event-modify-hero">
                        <span className="event-modify-badge">Gestao de evento</span>
                        <h1 className="event-modify-title">{eventData.eventName}</h1>
                        <p className="event-modify-subtitle">
                            Edite dados, templates e estilos sem perder a estrutura atual da tela.
                        </p>
                    </div>

                    <div className="event-modify-top-actions">
                        <Link href="/todosEventos" className="glass-button event-modify-top-button">
                            <ArrowLeft size={16} />
                            <span>Voltar</span>
                        </Link>
                        <button
                            type="button"
                            className="glass-button event-modify-top-button"
                            onClick={() => setViewMode(viewMode === "overview" ? "settings" : "overview")}
                        >
                            <Settings2 size={16} />
                            <span>{viewMode === "overview" ? "Configuracoes" : "Resumo"}</span>
                        </button>
                    </div>
                </header>

                {viewMode === "overview" && (
                    <section className="event-overview-grid fade-in">
                        <article className="glass-container event-overview-spotlight">
                            <div className="event-overview-head">
                                <div>
                                    <span className="event-overview-tagline">Resumo do evento</span>
                                    <h2>{eventData.eventName}</h2>
                                    <p>{eventData.eventDescription}</p>
                                </div>

                                <div className="glass-card event-overview-id-card">
                                    <span>ID do evento</span>
                                    <strong>{String(eventData._id)}</strong>
                                </div>
                            </div>

                            <div className="event-overview-card-grid">
                                {summaryCards.map((card) => (
                                    <article key={card.label} className="glass-card event-summary-card">
                                        <div className="event-summary-icon">{card.icon}</div>
                                        <span>{card.label}</span>
                                        <strong>{card.value}</strong>
                                    </article>
                                ))}
                            </div>

                            <div className="event-overview-chip-row">
                                <span className="event-overview-chip">
                                    <FileImage size={15} />
                                    <span>{eventData.templatePath || "Sem template de frente"}</span>
                                </span>
                                <span className="event-overview-chip">
                                    <LayoutTemplate size={15} />
                                    <span>{eventData.templateVersePath || "Sem template de verso"}</span>
                                </span>
                            </div>
                        </article>

                        <aside className="event-overview-actions">
                            <ActionCard
                                icon={<Settings2 size={20} />}
                                title="Configurar evento"
                                description="Edite cada grupo de campos com salvamento individual."
                                buttonLabel="Abrir configuracoes"
                                onClick={() => setViewMode("settings")}
                            />
                            <ActionCard
                                icon={<PencilRuler size={20} />}
                                title="Editor visual"
                                description="Ajuste posicionamento e tipografia com preview do certificado."
                                buttonLabel="Abrir editor"
                                onClick={() => setOpenEditor(true)}
                            />
                            <ActionCard
                                icon={<Users size={20} />}
                                title="Inscritos"
                                description="Veja rapidamente quem ja esta vinculado a este evento."
                                buttonLabel="Ver inscritos"
                                onClick={() => setShowParticipants(true)}
                            />
                            <Link
                                href={`/todosCertificados/${eventId}`}
                                target="_blank"
                                className="glass-card event-overview-link-card"
                            >
                                <div className="event-overview-link-icon">
                                    <ExternalLink size={18} />
                                </div>
                                <div>
                                    <strong>Ver certificados do evento</strong>
                                    <p>Abrir em nova aba para consultar os documentos gerados.</p>
                                </div>
                            </Link>
                        </aside>
                    </section>
                )}

                {viewMode === "settings" && (
                    <section className="event-settings-layout fade-in">
                        <aside className="glass-card event-settings-sidebar">
                            <span className="event-settings-kicker">Resumo rapido</span>
                            <h2>{eventData.eventName}</h2>
                            <p>{eventData.eventDescription}</p>

                            <div className="event-settings-sidebar-list">
                                {summaryCards.map((card) => (
                                    <div key={card.label} className="event-settings-sidebar-item">
                                        <div className="event-settings-sidebar-icon">{card.icon}</div>
                                        <div>
                                            <span>{card.label}</span>
                                            <strong>{card.value}</strong>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="event-settings-sidebar-actions">
                                <button type="button" className="glass-button" onClick={() => setOpenEditor(true)}>
                                    Editor visual
                                </button>
                                <button type="button" className="glass-button" onClick={() => setShowParticipants(true)}>
                                    Ver inscritos
                                </button>
                            </div>
                        </aside>

                        <section className="glass-container event-settings-panel">
                            <SettingsSection
                                icon={<Sparkles size={18} />}
                                title="Informacoes basicas"
                                description="Dados que ajudam a identificar e contextualizar o evento."
                            >
                                <div className="event-settings-grid">
                                    <EditableField
                                        label="Nome do evento"
                                        name="eventName"
                                        value={formData.eventName}
                                        dirty={dirtyFields.eventName}
                                        onChange={handleInputChange}
                                        onSave={() => saveField("eventName")}
                                    />
                                    <EditableField
                                        label="Tipo de evento"
                                        name="eventType"
                                        value={formData.eventType}
                                        dirty={dirtyFields.eventType}
                                        onChange={handleInputChange}
                                        onSave={() => saveField("eventType")}
                                    />
                                </div>
                                <EditableField
                                    label="Descricao"
                                    name="eventDescription"
                                    value={formData.eventDescription}
                                    dirty={dirtyFields.eventDescription}
                                    onChange={handleInputChange}
                                    onSave={() => saveField("eventDescription")}
                                    textarea
                                />
                            </SettingsSection>

                            <SettingsSection
                                icon={<CalendarDays size={18} />}
                                title="Regras e disponibilidade"
                                description="Controle vagas, versao do documento e condicoes de acesso."
                            >
                                <div className="event-settings-grid">
                                    <EditableField
                                        label="Versao do documento"
                                        name="documentVersion"
                                        value={formData.documentVersion}
                                        dirty={dirtyFields.documentVersion}
                                        onChange={handleInputChange}
                                        onSave={() => saveField("documentVersion")}
                                    />
                                    <EditableField
                                        label="Maximo de participantes"
                                        name="maxParticipants"
                                        value={String(formData.maxParticipants)}
                                        dirty={dirtyFields.maxParticipants}
                                        onChange={handleInputChange}
                                        onSave={() => saveField("maxParticipants")}
                                        type="number"
                                    />
                                    <EditableField
                                        label="Quantidade de inscritos"
                                        name="registrationCount"
                                        value={String(formData.registrationCount)}
                                        dirty={dirtyFields.registrationCount}
                                        onChange={handleInputChange}
                                        onSave={() => saveField("registrationCount")}
                                        type="number"
                                    />
                                </div>

                                <div className="event-toggle-row">
                                    <ToggleField
                                        label="Inscricoes"
                                        description="Define se novos usuarios ainda podem entrar no evento."
                                        active={formData.isOpen}
                                        dirty={dirtyFields.isOpen}
                                        trueLabel="Abertas"
                                        falseLabel="Fechadas"
                                        onChange={(value) => updateFieldValue("isOpen", value)}
                                        onSave={() => saveField("isOpen")}
                                    />
                                    <ToggleField
                                        label="Pagamento"
                                        description="Alterne entre gratuito e pago preservando o resto da configuracao."
                                        active={formData.isPaid}
                                        dirty={dirtyFields.isPaid || dirtyFields.price}
                                        trueLabel="Pago"
                                        falseLabel="Gratuito"
                                        onChange={(value) => updateFieldValue("isPaid", value)}
                                        onSave={() => saveField("isPaid")}
                                    />
                                </div>

                                {formData.isPaid && (
                                    <EditableField
                                        label="Preco (R$)"
                                        name="price"
                                        value={String(formData.price)}
                                        dirty={dirtyFields.price}
                                        onChange={handleInputChange}
                                        onSave={() => saveField("price")}
                                        type="number"
                                    />
                                )}
                            </SettingsSection>

                            <SettingsSection
                                icon={<FileImage size={18} />}
                                title="Templates"
                                description="Arquivos usados como base visual para frente e verso."
                            >
                                <EditableField
                                    label="Template da frente"
                                    name="templatePath"
                                    value={formData.templatePath}
                                    dirty={dirtyFields.templatePath}
                                    onChange={handleInputChange}
                                    onSave={() => saveField("templatePath")}
                                />
                                <EditableField
                                    label="Template do verso"
                                    name="templateVersePath"
                                    value={formData.templateVersePath}
                                    dirty={dirtyFields.templateVersePath}
                                    onChange={handleInputChange}
                                    onSave={() => saveField("templateVersePath")}
                                    hint="Pode ficar vazio quando o certificado nao tiver verso."
                                />
                            </SettingsSection>

                            <SettingsSection
                                icon={<FileCode2 size={18} />}
                                title="Estilos em JSON"
                                description="Blocos usados pelo renderizador do certificado."
                            >
                                <p className="event-json-warning">
                                    Edite com cuidado. Todos os campos abaixo precisam continuar como JSON valido.
                                </p>
                                <EditableField
                                    label="Style Container"
                                    name="styleContainer"
                                    value={formData.styleContainer}
                                    dirty={dirtyFields.styleContainer}
                                    onChange={handleInputChange}
                                    onSave={() => saveField("styleContainer")}
                                    textarea
                                    code
                                />
                                <EditableField
                                    label="Style Container Verse"
                                    name="styleContainerVerse"
                                    value={formData.styleContainerVerse}
                                    dirty={dirtyFields.styleContainerVerse}
                                    onChange={handleInputChange}
                                    onSave={() => saveField("styleContainerVerse")}
                                    textarea
                                    code
                                />
                                <EditableField
                                    label="Style Front Topper Text"
                                    name="styleFrontTopperText"
                                    value={formData.styleFrontTopperText}
                                    dirty={dirtyFields.styleFrontTopperText}
                                    onChange={handleInputChange}
                                    onSave={() => saveField("styleFrontTopperText")}
                                    textarea
                                    code
                                />
                                <EditableField
                                    label="Style Front Bottom Text"
                                    name="styleFrontBottomText"
                                    value={formData.styleFrontBottomText}
                                    dirty={dirtyFields.styleFrontBottomText}
                                    onChange={handleInputChange}
                                    onSave={() => saveField("styleFrontBottomText")}
                                    textarea
                                    code
                                />
                                <EditableField
                                    label="Style Name Text"
                                    name="styleNameText"
                                    value={formData.styleNameText}
                                    dirty={dirtyFields.styleNameText}
                                    onChange={handleInputChange}
                                    onSave={() => saveField("styleNameText")}
                                    textarea
                                    code
                                />
                            </SettingsSection>
                        </section>
                    </section>
                )}
            </div>

            {showParticipants && (
                <ParticipantsModal
                    eventId={eventId}
                    eventName={eventData.eventName}
                    onClose={() => setShowParticipants(false)}
                />
            )}
        </main>
    );
}

function ActionCard({
    icon,
    title,
    description,
    buttonLabel,
    onClick,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    buttonLabel: string;
    onClick: () => void;
}) {
    return (
        <article className="glass-card event-action-card">
            <div className="event-action-icon">{icon}</div>
            <h3>{title}</h3>
            <p>{description}</p>
            <button type="button" className="glass-button glass-button-primary event-action-button" onClick={onClick}>
                {buttonLabel}
            </button>
        </article>
    );
}

function SettingsSection({
    icon,
    title,
    description,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <section className="event-settings-section">
            <div className="event-settings-section-header">
                <div className="event-settings-section-icon">{icon}</div>
                <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                </div>
            </div>
            <div className="event-settings-section-content">{children}</div>
        </section>
    );
}

function EditableField({
    label,
    name,
    value,
    dirty,
    onChange,
    onSave,
    type = "text",
    textarea = false,
    hint,
    code = false,
}: {
    label: string;
    name: string;
    value: string;
    dirty: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onSave: () => void;
    type?: React.HTMLInputTypeAttribute;
    textarea?: boolean;
    hint?: string;
    code?: boolean;
}) {
    return (
        <div className={`glass-card event-edit-field ${dirty ? "is-dirty" : ""}`}>
            <div className="event-edit-field-header">
                <div>
                    <label htmlFor={name}>{label}</label>
                    {hint && <p>{hint}</p>}
                </div>
                {dirty && (
                    <button type="button" className="event-save-button" onClick={onSave}>
                        <Save size={14} />
                        <span>Salvar</span>
                    </button>
                )}
            </div>

            {textarea ? (
                <textarea
                    id={name}
                    name={name}
                    value={value}
                    onChange={onChange}
                    rows={code ? 7 : 4}
                    className={`glass-input event-edit-input event-edit-textarea ${code ? "is-code" : ""}`}
                />
            ) : (
                <input
                    id={name}
                    name={name}
                    value={value}
                    onChange={onChange}
                    type={type}
                    className={`glass-input event-edit-input ${code ? "is-code" : ""}`}
                />
            )}
        </div>
    );
}

function ToggleField({
    label,
    description,
    active,
    dirty,
    trueLabel,
    falseLabel,
    onChange,
    onSave,
}: {
    label: string;
    description: string;
    active: boolean;
    dirty: boolean;
    trueLabel: string;
    falseLabel: string;
    onChange: (value: boolean) => void;
    onSave: () => void;
}) {
    return (
        <div className={`glass-card event-toggle-card ${dirty ? "is-dirty" : ""}`}>
            <div className="event-edit-field-header">
                <div>
                    <label>{label}</label>
                    <p>{description}</p>
                </div>
                {dirty && (
                    <button type="button" className="event-save-button" onClick={onSave}>
                        <Save size={14} />
                        <span>Salvar</span>
                    </button>
                )}
            </div>

            <div className="event-toggle-options">
                <button
                    type="button"
                    className={`event-toggle-option ${active ? "is-active" : ""}`}
                    onClick={() => onChange(true)}
                >
                    {trueLabel}
                </button>
                <button
                    type="button"
                    className={`event-toggle-option ${!active ? "is-active" : ""}`}
                    onClick={() => onChange(false)}
                >
                    {falseLabel}
                </button>
            </div>
        </div>
    );
}

function VisualEditor({
    eventData,
    onBack,
    onSaved,
}: {
    eventData: IEventCertificate;
    onBack: () => void;
    onSaved: (styles: VisualStyles) => void;
}) {
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [liveTopperText, setLiveTopperText] = useState("Certificamos que");
    const [liveBottomText, setLiveBottomText] = useState(
        "participou com exito do evento organizado pela DADG,\ndemonstrando excelente aproveitamento nas atividades propostas.",
    );
    const [styles, setStyles] = useState<VisualStyles>({
        styleContainer: eventData.styleContainer || {},
        styleContainerVerse: eventData.styleContainerVerse || {},
        styleFrontTopperText: eventData.styleFrontTopperText || {},
        styleFrontBottomText: eventData.styleFrontBottomText || {},
        styleNameText: eventData.styleNameText || {},
    });

    const updateStyle = (
        section: keyof Pick<VisualStyles, "styleContainer" | "styleFrontTopperText" | "styleFrontBottomText" | "styleNameText">,
        property: string,
        value: string,
    ) => {
        setStyles((prev) => ({
            ...prev,
            [section]: {
                ...(prev[section] as React.CSSProperties),
                [property]: value,
            },
        }));
    };

    const saveStyles = async () => {
        setSaving(true);

        try {
            const response = await fetch("/api/put/updateEvent/", {
                method: "PUT",
                body: JSON.stringify({
                    _id: eventData._id,
                    ...styles,
                }),
            });

            const result = await response.json();

            if (!response.ok && !result.success) {
                throw new Error(result.message || "Nao foi possivel salvar os estilos.");
            }

            onSaved(styles);
            setFeedback("Estilos salvos com sucesso.");
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : "Erro inesperado ao salvar.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="event-editor-page" style={PoppinsFontLib.style}>
            {saving && <LoadingModal />}

            <div className="event-editor-shell">
                <header className="event-modify-header fade-in">
                    <div className="event-modify-hero">
                        <span className="event-modify-badge">Editor visual</span>
                        <h1 className="event-modify-title">{eventData.eventName}</h1>
                        <p className="event-modify-subtitle">
                            Ajuste tipografia e posicionamento mantendo o comportamento atual do editor.
                        </p>
                    </div>

                    <div className="event-modify-top-actions">
                        <button type="button" className="glass-button event-modify-top-button" onClick={onBack}>
                            <ArrowLeft size={16} />
                            <span>Voltar</span>
                        </button>
                        <button
                            type="button"
                            className="glass-button glass-button-primary event-modify-top-button"
                            onClick={saveStyles}
                        >
                            <Save size={16} />
                            <span>Salvar estilos</span>
                        </button>
                    </div>
                </header>

                {feedback && <div className="event-editor-feedback">{feedback}</div>}

                <section className="event-editor-layout">
                    <aside className="glass-container event-editor-panel">
                        <EditorSection title="Posicao geral">
                            <EditorField
                                label="Largura"
                                value={String(styles.styleContainer.width || "")}
                                onChange={(value) => updateStyle("styleContainer", "width", value)}
                            />
                            <EditorField
                                label="Top"
                                value={String(styles.styleContainer.top || "")}
                                onChange={(value) => updateStyle("styleContainer", "top", value)}
                            />
                            <EditorField
                                label="Left"
                                value={String(styles.styleContainer.left || "")}
                                onChange={(value) => updateStyle("styleContainer", "left", value)}
                            />
                        </EditorSection>

                        <EditorSection title="Texto superior">
                            <EditorTextArea label="Texto de teste" value={liveTopperText} onChange={setLiveTopperText} />
                            <EditorField
                                label="Tamanho"
                                value={String(styles.styleFrontTopperText.fontSize || "")}
                                onChange={(value) => updateStyle("styleFrontTopperText", "fontSize", value)}
                            />
                            <EditorField
                                label="Cor"
                                type="color"
                                value={String(styles.styleFrontTopperText.color || "#02425A")}
                                onChange={(value) => updateStyle("styleFrontTopperText", "color", value)}
                            />
                            <EditorField
                                label="Line height"
                                value={String(styles.styleFrontTopperText.lineHeight || "")}
                                onChange={(value) => updateStyle("styleFrontTopperText", "lineHeight", value)}
                            />
                        </EditorSection>

                        <EditorSection title="Nome">
                            <EditorField
                                label="Tamanho"
                                value={String(styles.styleNameText.fontSize || "")}
                                onChange={(value) => updateStyle("styleNameText", "fontSize", value)}
                            />
                            <EditorField
                                label="Cor"
                                type="color"
                                value={String(styles.styleNameText.color || "#02425A")}
                                onChange={(value) => updateStyle("styleNameText", "color", value)}
                            />
                            <EditorField
                                label="Peso"
                                value={String(styles.styleNameText.fontWeight || "")}
                                onChange={(value) => updateStyle("styleNameText", "fontWeight", value)}
                            />
                        </EditorSection>

                        <EditorSection title="Texto inferior">
                            <EditorTextArea label="Texto de teste" value={liveBottomText} onChange={setLiveBottomText} />
                            <EditorField
                                label="Tamanho"
                                value={String(styles.styleFrontBottomText.fontSize || "")}
                                onChange={(value) => updateStyle("styleFrontBottomText", "fontSize", value)}
                            />
                            <EditorField
                                label="Cor"
                                type="color"
                                value={String(styles.styleFrontBottomText.color || "#02425A")}
                                onChange={(value) => updateStyle("styleFrontBottomText", "color", value)}
                            />
                            <EditorField
                                label="Line height"
                                value={String(styles.styleFrontBottomText.lineHeight || "")}
                                onChange={(value) => updateStyle("styleFrontBottomText", "lineHeight", value)}
                            />
                        </EditorSection>
                    </aside>

                    <div className="glass-container event-editor-preview">
                        <div className="event-editor-preview-wrap">
                            <div className="event-editor-preview-frame">
                                <div
                                    id="frontCert"
                                    className="event-editor-preview-surface"
                                    style={{
                                        width: "2000px",
                                        height: "1414px",
                                        transform: "scale(0.45)",
                                    }}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src="https://www.dadg.com.br/api/get/templateProxy/698afa75b745573f14c27605|front?t=1771977431898"
                                        alt="Preview do certificado"
                                        className="event-editor-image"
                                    />

                                    <div className="event-editor-text-layer">
                                        <div className="event-editor-text-content" style={{ ...styles.styleContainer }}>
                                            <p style={{ ...libSourceSerif4.style, ...styles.styleFrontTopperText }}>
                                                {liveTopperText}
                                            </p>
                                            <p style={{ ...libSourceSerif4.style, ...styles.styleNameText }}>
                                                Nicolly Gozaga
                                            </p>
                                            <p className="event-editor-code">
                                                Codigo de verificacao: {String(eventData._id)}
                                            </p>
                                            <p
                                                className="event-editor-bottom-text"
                                                style={{ ...libSourceSerif4.style, ...styles.styleFrontBottomText }}
                                            >
                                                {liveBottomText.split("\n").map((line, index) => (
                                                    <React.Fragment key={`${line}-${index}`}>
                                                        {line}
                                                        <br />
                                                    </React.Fragment>
                                                ))}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="event-editor-section">
            <h3>{title}</h3>
            <div className="event-editor-fields">{children}</div>
        </section>
    );
}

function EditorField({
    label,
    value,
    onChange,
    type = "text",
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: React.HTMLInputTypeAttribute;
}) {
    return (
        <label className="event-editor-field">
            <span>{label}</span>
            <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="glass-input" />
        </label>
    );
}

function EditorTextArea({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <label className="event-editor-field event-editor-field-wide">
            <span>{label}</span>
            <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="glass-input" />
        </label>
    );
}

function ParticipantsModal({
    eventId,
    eventName,
    onClose,
}: {
    eventId: string;
    eventName: string;
    onClose: () => void;
}) {
    const [participants, setParticipants] = useState<IEventParticipant[] | null>(null);

    useEffect(() => {
        fetch(`/api/get/events/${eventId}/participants/`)
            .then((res: Response) => res.json())
            .then((data: { data: IEventParticipant[] }) => {
                setParticipants(data.data);
            });
    }, [eventId]);

    return (
        <div className="participants-overlay" onClick={onClose}>
            <div className="glass-container participants-modal" onClick={(e) => e.stopPropagation()}>
                <div className="participants-header">
                    <div>
                        <span className="event-modify-badge">Participantes</span>
                        <h2>{eventName}</h2>
                    </div>
                    <button type="button" className="participants-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {!participants && <p className="participants-empty">Carregando participantes...</p>}
                {participants && participants.length === 0 && (
                    <p className="participants-empty">Nenhum participante inscrito ainda.</p>
                )}
                {participants && participants.length > 0 && (
                    <div className="participants-table-wrap">
                        <table className="participants-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Nome</th>
                                    <th>Data de inscricao</th>
                                </tr>
                            </thead>
                            <tbody>
                                {participants.map((participant) => (
                                    <tr key={String(participant._id)}>
                                        <td>{String(participant._id)}</td>
                                        <td>{participant.ownerName}</td>
                                        <td>{formatDate(participant.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function formatCurrency(value?: number) {
    if (typeof value !== "number") {
        return "Valor nao informado";
    }

    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
}

function formatDate(value?: Date) {
    if (!value) {
        return "Nao informada";
    }

    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(value));
}
