"use client";

import LoadingModal from "@/components/LoadingModal";
import LoadingPage from "@/components/LoadingPage";
import ModalAction, { IModalProps } from "@/components/ModalAction";
import { ICertificateWithEventPopulate } from "@/lib/models/CertificateModel";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import {
    ArrowLeft,
    Clock3,
    ExternalLink,
    FileBadge2,
    FileImage,
    Mail,
    PencilLine,
    Save,
    ScanText,
    Sparkles,
    UserRound,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import "./page.css";

type ViewMode = "overview" | "settings";
type ModalState = IModalProps & { isOpen: boolean };

type CertificateFormState = {
    ownerName: string;
    ownerCpf: string;
    eventName: string;
    ownerEmail: string;
    certificateHours: string;
    certificatePath: string;
    frontTopperText: string;
    frontBottomText: string;
};

type FieldName = keyof CertificateFormState;
type DirtyFields = Record<FieldName, boolean>;

const createEmptyFormState = (): CertificateFormState => ({
    ownerName: "",
    ownerCpf: "",
    eventName: "",
    ownerEmail: "",
    certificateHours: "",
    certificatePath: "",
    frontTopperText: "",
    frontBottomText: "",
});

const createDirtyFields = (): DirtyFields => ({
    ownerName: false,
    ownerCpf: false,
    eventName: false,
    ownerEmail: false,
    certificateHours: false,
    certificatePath: false,
    frontTopperText: false,
    frontBottomText: false,
});

const buildFormState = (certificate: ICertificateWithEventPopulate): CertificateFormState => ({
    ownerName: certificate.ownerName || "",
    ownerCpf: certificate.ownerCpf || "",
    eventName: certificate.eventName || "",
    ownerEmail: certificate.ownerEmail || "",
    certificateHours: certificate.certificateHours || "",
    certificatePath: certificate.certificatePath || "",
    frontTopperText: certificate.frontTopperText || "",
    frontBottomText: certificate.frontBottomText || "",
});

export default function Page({ params }: { params: Promise<{ _id: string }> }) {
    const [certificateId, setCertificateId] = useState("");
    const [certificateData, setCertificateData] = useState<ICertificateWithEventPopulate | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("overview");
    const [formData, setFormData] = useState<CertificateFormState>(createEmptyFormState);
    const [originalFormData, setOriginalFormData] = useState<CertificateFormState>(createEmptyFormState);
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
        const loadCertificate = async () => {
            const slug = (await params)._id;
            setCertificateId(slug);

            const response = await fetch(`/api/get/CertificateWithPopulateByEvent/${slug}`);
            if (!response.ok) {
                setLoading(false);
                setModalState((prev) => ({
                    ...prev,
                    title: "Erro ao carregar",
                    text: "Nao foi possivel carregar este certificado.",
                    isOpen: true,
                }));
                return;
            }

            const dataJson: { data: ICertificateWithEventPopulate } = await response.json();
            const nextFormState = buildFormState(dataJson.data);

            setCertificateData(dataJson.data);
            setFormData(nextFormState);
            setOriginalFormData(nextFormState);
            setDirtyFields(createDirtyFields());
            setLoading(false);
        };

        loadCertificate();
    }, [params]);

    const summaryCards = useMemo(() => {
        if (!certificateData) {
            return [];
        }

        return [
            {
                icon: <UserRound size={18} />,
                label: "Titular",
                value: certificateData.ownerName || "Nao informado",
            },
            {
                icon: <Mail size={18} />,
                label: "Email",
                value: certificateData.ownerEmail || "Nao informado",
            },
            {
                icon: <Clock3 size={18} />,
                label: "Carga horaria",
                value: certificateData.certificateHours || "Nao informada",
            },
            {
                icon: <FileBadge2 size={18} />,
                label: "Status",
                value: certificateData.isReady ? "Liberado" : "Rascunho",
            },
        ];
    }, [certificateData]);

    const updateModal = (nextState: Partial<ModalState>) => {
        setModalState((prev) => ({ ...prev, ...nextState }));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const fieldName = name as FieldName;

        setFormData((prev) => ({ ...prev, [fieldName]: value }));
        setDirtyFields((prev) => ({
            ...prev,
            [fieldName]: value !== originalFormData[fieldName],
        }));
    };

    const saveField = async (fieldName: FieldName) => {
        if (!certificateId) {
            return;
        }

        setSaving(true);

        try {
            const formDataToSend = new FormData();
            formDataToSend.append("_id", certificateId);
            formDataToSend.append(fieldName, formData[fieldName]);

            const response = await fetch("/api/put/updateCertificate/", {
                method: "PUT",
                body: formDataToSend,
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || `Nao foi possivel salvar ${fieldName}.`);
            }

            setOriginalFormData((prev) => ({ ...prev, [fieldName]: formData[fieldName] }));
            setDirtyFields((prev) => ({ ...prev, [fieldName]: false }));
            setCertificateData((prev) =>
                prev
                    ? ({
                          ...prev,
                          [fieldName]: formData[fieldName],
                      } as ICertificateWithEventPopulate)
                    : prev,
            );

            updateModal({
                title: "Campo salvo com sucesso",
                text: "A alteracao foi registrada sem perder o restante do certificado.",
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

    if (loading) {
        return <LoadingPage message="Carregando certificado..." />;
    }

    if (!certificateData) {
        return (
            <main className="certificate-edit-page" style={PoppinsFontLib.style}>
                {modalState.isOpen && <ModalAction {...modalState} />}
                <section className="certificate-edit-empty-state">
                    <h1>Certificado nao encontrado</h1>
                    <Link href="/todosCertificados" className="glass-button">
                        Voltar
                    </Link>
                </section>
            </main>
        );
    }

    const eventId = certificateData.eventId?._id ? String(certificateData.eventId._id) : "";

    return (
        <main className="certificate-edit-page" style={PoppinsFontLib.style}>
            {saving && <LoadingModal />}
            {modalState.isOpen && <ModalAction {...modalState} />}

            <div className="certificate-edit-shell">
                <header className="certificate-edit-header fade-in">
                    <div className="certificate-edit-hero">
                        <span className="certificate-edit-badge">Gestao de certificado</span>
                        <h1 className="certificate-edit-title">{certificateData.ownerName}</h1>
                        <p className="certificate-edit-subtitle">
                            Ajuste os dados do documento sem perder o fluxo atual de salvamento por campo.
                        </p>
                    </div>

                    <div className="certificate-edit-top-actions">
                        <Link
                            href={eventId ? `/todosCertificados/${eventId}` : "/todosCertificados"}
                            className="glass-button certificate-edit-top-button"
                        >
                            <ArrowLeft size={16} />
                            <span>Voltar</span>
                        </Link>
                        <button
                            type="button"
                            className="glass-button certificate-edit-top-button"
                            onClick={() => setViewMode(viewMode === "overview" ? "settings" : "overview")}
                        >
                            <PencilLine size={16} />
                            <span>{viewMode === "overview" ? "Editar dados" : "Ver resumo"}</span>
                        </button>
                    </div>
                </header>

                {viewMode === "overview" && (
                    <section className="certificate-edit-overview-grid fade-in">
                        <article className="glass-container certificate-edit-spotlight">
                            <div className="certificate-edit-spotlight-head">
                                <div>
                                    <span className="certificate-edit-tagline">Resumo do certificado</span>
                                    <h2>{certificateData.eventName}</h2>
                                    <p>
                                        Documento vinculado ao evento{" "}
                                        <strong>{certificateData.eventId?.eventName || certificateData.eventName}</strong> com
                                        visual e textos prontos para consulta.
                                    </p>
                                </div>

                                <div className="glass-card certificate-edit-id-card">
                                    <span>ID do certificado</span>
                                    <strong>{String(certificateData._id)}</strong>
                                </div>
                            </div>

                            <div className="certificate-edit-card-grid">
                                {summaryCards.map((card) => (
                                    <article key={card.label} className="glass-card certificate-edit-summary-card">
                                        <div className="certificate-edit-summary-icon">{card.icon}</div>
                                        <span>{card.label}</span>
                                        <strong>{card.value}</strong>
                                    </article>
                                ))}
                            </div>

                            <div className="certificate-edit-pill-row">
                                <span className="certificate-edit-pill">
                                    <ScanText size={15} />
                                    <span>{certificateData.ownerCpf || "CPF nao informado"}</span>
                                </span>
                                <span className="certificate-edit-pill">
                                    <FileImage size={15} />
                                    <span>{certificateData.certificatePath || "Template nao configurado"}</span>
                                </span>
                            </div>
                        </article>

                        <aside className="certificate-edit-action-column">
                            <ActionCard
                                icon={<PencilLine size={20} />}
                                title="Editar certificado"
                                description="Abra o painel completo para salvar campo por campo."
                                buttonLabel="Abrir edicao"
                                onClick={() => setViewMode("settings")}
                            />

                            <Link
                                href={`https://www.dadg.com.br/certificados/meuCertificado/${certificateId}`}
                                target="_blank"
                                className="glass-card certificate-edit-link-card"
                            >
                                <div className="certificate-edit-link-icon">
                                    <ExternalLink size={18} />
                                </div>
                                <div>
                                    <strong>Ver certificado publicado</strong>
                                    <p>Abrir a versao publica em uma nova aba para conferencia.</p>
                                </div>
                            </Link>

                            {eventId && (
                                <Link href={`/todosEventos/modificar/${eventId}`} className="glass-card certificate-edit-link-card">
                                    <div className="certificate-edit-link-icon">
                                        <Sparkles size={18} />
                                    </div>
                                    <div>
                                        <strong>Ir para o evento</strong>
                                        <p>Consultar o evento relacionado a este certificado.</p>
                                    </div>
                                </Link>
                            )}
                        </aside>
                    </section>
                )}

                {viewMode === "settings" && (
                    <section className="certificate-edit-settings-layout fade-in">
                        <aside className="glass-card certificate-edit-sidebar">
                            <span className="certificate-edit-sidebar-kicker">Resumo rapido</span>
                            <h2>{certificateData.ownerName}</h2>
                            <p>{certificateData.eventName}</p>

                            <div className="certificate-edit-sidebar-list">
                                {summaryCards.map((card) => (
                                    <div key={card.label} className="certificate-edit-sidebar-item">
                                        <div className="certificate-edit-sidebar-icon">{card.icon}</div>
                                        <div>
                                            <span>{card.label}</span>
                                            <strong>{card.value}</strong>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Link
                                href={`https://www.dadg.com.br/certificados/meuCertificado/${certificateId}`}
                                target="_blank"
                                className="glass-button certificate-edit-sidebar-link"
                            >
                                <ExternalLink size={16} />
                                <span>Ver certificado</span>
                            </Link>
                        </aside>

                        <div className="glass-container certificate-edit-panel">
                            <SettingsSection
                                icon={<UserRound size={18} />}
                                title="Titular do certificado"
                                description="Dados principais da pessoa vinculada a este documento."
                            >
                                <div className="certificate-edit-grid">
                                    <EditableField
                                        label="Nome do proprietario"
                                        name="ownerName"
                                        value={formData.ownerName}
                                        dirty={dirtyFields.ownerName}
                                        onChange={handleInputChange}
                                        onSave={() => saveField("ownerName")}
                                    />
                                    <EditableField
                                        label="CPF"
                                        name="ownerCpf"
                                        value={formData.ownerCpf}
                                        dirty={dirtyFields.ownerCpf}
                                        onChange={handleInputChange}
                                        onSave={() => saveField("ownerCpf")}
                                    />
                                    <EditableField
                                        label="Email"
                                        name="ownerEmail"
                                        value={formData.ownerEmail}
                                        dirty={dirtyFields.ownerEmail}
                                        onChange={handleInputChange}
                                        onSave={() => saveField("ownerEmail")}
                                        type="email"
                                    />
                                </div>
                            </SettingsSection>

                            <SettingsSection
                                icon={<Sparkles size={18} />}
                                title="Contexto do certificado"
                                description="Informacoes do evento e da carga horaria exibidas no documento."
                            >
                                <div className="certificate-edit-grid">
                                    <EditableField
                                        label="Nome do evento"
                                        name="eventName"
                                        value={formData.eventName}
                                        dirty={dirtyFields.eventName}
                                        onChange={handleInputChange}
                                        onSave={() => saveField("eventName")}
                                    />
                                    <EditableField
                                        label="Horas do certificado"
                                        name="certificateHours"
                                        value={formData.certificateHours}
                                        dirty={dirtyFields.certificateHours}
                                        onChange={handleInputChange}
                                        onSave={() => saveField("certificateHours")}
                                    />
                                    <EditableField
                                        label="Caminho do certificado"
                                        name="certificatePath"
                                        value={formData.certificatePath}
                                        dirty={dirtyFields.certificatePath}
                                        onChange={handleInputChange}
                                        onSave={() => saveField("certificatePath")}
                                        hint="ID ou caminho usado para montar o template do certificado."
                                    />
                                </div>
                            </SettingsSection>

                            <SettingsSection
                                icon={<ScanText size={18} />}
                                title="Textos do documento"
                                description="Edite as mensagens exibidas na frente do certificado."
                            >
                                <EditableField
                                    label="Texto superior"
                                    name="frontTopperText"
                                    value={formData.frontTopperText}
                                    dirty={dirtyFields.frontTopperText}
                                    onChange={handleInputChange}
                                    onSave={() => saveField("frontTopperText")}
                                    textarea
                                />
                                <EditableField
                                    label="Texto inferior"
                                    name="frontBottomText"
                                    value={formData.frontBottomText}
                                    dirty={dirtyFields.frontBottomText}
                                    onChange={handleInputChange}
                                    onSave={() => saveField("frontBottomText")}
                                    textarea
                                />
                            </SettingsSection>
                        </div>
                    </section>
                )}
            </div>
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
        <article className="glass-card certificate-edit-action-card">
            <div className="certificate-edit-action-icon">{icon}</div>
            <h3>{title}</h3>
            <p>{description}</p>
            <button type="button" className="glass-button certificate-edit-action-button" onClick={onClick}>
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
        <section className="certificate-edit-section">
            <div className="certificate-edit-section-header">
                <div className="certificate-edit-section-icon">{icon}</div>
                <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                </div>
            </div>
            <div className="certificate-edit-section-content">{children}</div>
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
}) {
    return (
        <div className={`glass-card certificate-edit-field ${dirty ? "is-dirty" : ""}`}>
            <div className="certificate-edit-field-header">
                <div>
                    <label htmlFor={name}>{label}</label>
                    {hint && <p>{hint}</p>}
                </div>
                {dirty && (
                    <button type="button" className="certificate-edit-save-button" onClick={onSave}>
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
                    rows={4}
                    className="glass-input certificate-edit-input certificate-edit-textarea"
                />
            ) : (
                <input
                    id={name}
                    name={name}
                    value={value}
                    onChange={onChange}
                    type={type}
                    className="glass-input certificate-edit-input"
                />
            )}
        </div>
    );
}
