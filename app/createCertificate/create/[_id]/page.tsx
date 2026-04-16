"use client";

import LoadingModal from "@/components/LoadingModal";
import LoadingPage from "@/components/LoadingPage";
import LoadingSpinner from "@/components/LoadingSpinner";
import ModalAction, { IModalProps as SimpleModalProps } from "@/components/ModalAction";
import ModalActionWithTextVerification, {
    IModalProps as VerificationModalProps,
} from "@/components/ModalActionWithTextVerification";
import { ICertificate } from "@/lib/models/CertificateModel";
import { IEventCertificate } from "@/lib/models/EventCertificateModel";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import {
    ArrowLeft,
    BadgeCheck,
    CalendarDays,
    CircleDollarSign,
    ExternalLink,
    FileImage,
    FileSpreadsheet,
    Files,
    FolderOpen,
    Info,
    Mail,
    ScanText,
    Sparkles,
    Upload,
    UserRound,
    Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import "./page.css";

type ActiveView = "overview" | "single" | "bulk";
type CertificateDraft = Omit<ICertificate, "_id" | "eventId" | "eventName" | "verse">;
type SimpleModalState = SimpleModalProps & { isOpen: boolean };
type VerificationModalState = VerificationModalProps & { isOpen: boolean };

const createEmptyCertificateForm = (): CertificateDraft => ({
    ownerName: "",
    ownerCpf: "",
    ownerEmail: "",
    certificateHours: "",
    certificatePath: "",
    frontTopperText: "",
    frontBottomText: "",
    isReady: false,
});

export default function Page({ params }: { params: Promise<{ _id: string }> }) {
    const router = useRouter();
    const [paramsId, setParamsId] = useState("");
    const [data, setData] = useState<IEventCertificate | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<ActiveView>("overview");
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<CertificateDraft>(createEmptyCertificateForm);

    const [simpleModalState, setSimpleModalState] = useState<SimpleModalState>({
        title: "Atencao",
        emoji: "",
        text: "",
        isOpen: false,
        buttons: [
            {
                label: "",
                action: () => setSimpleModalState((prev) => ({ ...prev, isOpen: false })),
            },
        ],
    });

    const [verificationModalState, setVerificationModalState] = useState<VerificationModalState>({
        title: "",
        emoji: "",
        text: "",
        expectedPhrase: "",
        onConfirm: () => undefined,
        onCancel: () => undefined,
        isOpen: false,
    });

    useEffect(() => {
        const getData = async () => {
            try {
                const slug = (await params)._id;
                setParamsId(slug);

                const response = await fetch(`/api/get/eventById/${slug}`);
                if (!response.ok) {
                    throw new Error("Nao foi possivel carregar os detalhes do evento.");
                }

                const dataJson: { data: IEventCertificate } = await response.json();
                setData(dataJson.data);
            } catch (error) {
                const message = error instanceof Error ? error.message : "Erro inesperado ao carregar o evento.";
                setLoadError(message);
            } finally {
                setLoading(false);
            }
        };

        getData();
    }, [params]);

    const eventSummary = useMemo(() => {
        if (!data) {
            return [];
        }

        return [
            {
                icon: <Info size={18} />,
                label: "Tipo do evento",
                value: data.eventType || "Nao informado",
            },
            {
                icon: <Users size={18} />,
                label: "Capacidade",
                value: `${data.maxParticipants || 0} participantes`,
            },
            {
                icon: <CalendarDays size={18} />,
                label: "Inscricoes",
                value: data.isOpen ? "Abertas" : "Fechadas",
            },
            {
                icon: <CircleDollarSign size={18} />,
                label: "Pagamento",
                value: data.isPaid ? formatCurrency(data.price) : "Evento gratuito",
            },
        ];
    }, [data]);

    const toggleSimpleModalState = (newState: Partial<SimpleModalState>) => {
        setSimpleModalState((prev) => ({ ...prev, ...newState }));
    };

    const toggleVerificationModalState = (newState: Partial<VerificationModalState>) => {
        setVerificationModalState((prev) => ({ ...prev, ...newState }));
    };

    const resetCertificateForm = () => {
        setFormData(createEmptyCertificateForm());
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleCreateCertificate = async () => {
        if (!data) {
            return;
        }

        toggleVerificationModalState({ isOpen: false });
        setIsLoading(true);

        try {
            const update = new FormData();
            update.append("eventId", String(data._id));
            update.append("eventName", data.eventName || "");
            update.append("ownerName", formData.ownerName);
            update.append("ownerEmail", formData.ownerEmail || "");
            update.append("ownerCpf", formData.ownerCpf || "");
            update.append("frontTopperText", formData.frontTopperText || "");
            update.append("frontBottomText", formData.frontBottomText || "");
            update.append("certificatePath", formData.certificatePath || "");
            update.append("certificateHours", formData.certificateHours);
            update.append("isReady", String(formData.isReady));

            const response = await fetch("/api/put/createNewCertificate", {
                method: "PUT",
                body: update,
            });

            const responseJson = await response.json();

            if (!response.ok) {
                toggleSimpleModalState({
                    text: responseJson.message?.trim() || "Nao foi possivel criar o certificado.",
                    title: "Erro",
                    isOpen: true,
                    buttons: [
                        {
                            label: "Fechar",
                            action: () => toggleSimpleModalState({ isOpen: false }),
                        },
                    ],
                });
                return;
            }

            toggleSimpleModalState({
                title: "Sucesso",
                text: "Seu certificado foi criado com sucesso.",
                isOpen: true,
                buttons: [
                    {
                        label: "Ver certificado",
                        action: () => {
                            toggleSimpleModalState({ isOpen: false });
                            router.push(`https://www.dadg.com.br/certificados/meuCertificado/${responseJson._id}`);
                        },
                    },
                    {
                        label: "Novo certificado",
                        action: () => {
                            resetCertificateForm();
                            toggleSimpleModalState({ isOpen: false });
                        },
                    },
                ],
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Erro inesperado ao criar o certificado.";
            toggleSimpleModalState({
                title: "Erro",
                text: message,
                isOpen: true,
                buttons: [
                    {
                        label: "Fechar",
                        action: () => toggleSimpleModalState({ isOpen: false }),
                    },
                ],
            });
        } finally {
            setIsLoading(false);
        }
    };

    const openCreateCertificateConfirmation = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        toggleVerificationModalState({
            isOpen: true,
            title: "Atencao",
            emoji: "",
            text: "Voce esta prestes a criar um novo certificado. Deseja continuar?",
            expectedPhrase: "Continuar",
            onConfirm: handleCreateCertificate,
            onCancel: () => toggleVerificationModalState({ isOpen: false }),
        });
    };

    if (loading) {
        return <LoadingPage message="Carregando dados do evento..." />;
    }

    if (loadError || !data) {
        return (
            <main className="certificate-create-page" style={PoppinsFontLib.style}>
                <div className="certificate-create-shell">
                    <section className="glass-container certificate-create-error fade-in">
                        <span className="certificate-create-kicker">Falha ao carregar</span>
                        <h1 className="certificate-create-title">Nao foi possivel abrir esta tela</h1>
                        <p className="certificate-create-subtitle">{loadError || "Evento nao encontrado."}</p>
                        <Link href="/createCertificate" className="glass-button certificate-create-inline-action">
                            Voltar para eventos
                        </Link>
                    </section>
                </div>
            </main>
        );
    }

    return (
        <main className="certificate-create-page" style={PoppinsFontLib.style}>
            {isLoading && <LoadingModal />}
            {simpleModalState.isOpen && <ModalAction {...simpleModalState} />}
            {verificationModalState.isOpen && <ModalActionWithTextVerification {...verificationModalState} />}

            <div className="certificate-create-shell">
                <header className="certificate-create-header fade-in">
                    <div>
                        <span className="certificate-create-kicker">
                            {activeView === "overview" && "Evento selecionado"}
                            {activeView === "single" && "Criacao individual"}
                            {activeView === "bulk" && "Criacao em lote"}
                        </span>
                        <h1 className="certificate-create-title">
                            {activeView === "overview" && "Escolha como deseja criar os certificados"}
                            {activeView === "single" && "Preencha os dados do novo certificado"}
                            {activeView === "bulk" && "Importe uma planilha para gerar varios certificados"}
                        </h1>
                        <p className="certificate-create-subtitle">
                            {activeView === "overview" &&
                                "Revise o contexto do evento e siga para o fluxo individual ou em lote usando o mesmo padrao visual do restante do painel."}
                            {activeView === "single" &&
                                "Os campos abaixo seguem a mesma linguagem visual das demais telas administrativas e mantem a criacao mais organizada."}
                            {activeView === "bulk" &&
                                "Envie sua planilha, revise os dados e configure os textos padrao antes de publicar os certificados em massa."}
                        </p>
                    </div>

                    <div className="certificate-create-header-actions">
                        <Link href="/createCertificate" className="glass-button certificate-create-inline-action">
                            <ArrowLeft size={16} />
                            <span>Trocar evento</span>
                        </Link>

                        {activeView !== "overview" && (
                            <button
                                type="button"
                                className="glass-button certificate-create-inline-action"
                                onClick={() => setActiveView("overview")}
                            >
                                <ArrowLeft size={16} />
                                <span>Voltar</span>
                            </button>
                        )}
                    </div>
                </header>

                {activeView === "overview" && (
                    <section className="certificate-overview-grid fade-in">
                        <article className="glass-container certificate-event-spotlight">
                            <div className="certificate-event-spotlight-header">
                                <div>
                                    <span className="certificate-event-badge">Evento ativo</span>
                                    <h2>{data.eventName}</h2>
                                    <p>{data.eventDescription}</p>
                                </div>

                                <div className="glass-card certificate-event-id-card">
                                    <span>ID do evento</span>
                                    <strong>{String(data._id)}</strong>
                                </div>
                            </div>

                            <div className="certificate-overview-metrics">
                                {eventSummary.map((item) => (
                                    <article key={item.label} className="glass-card certificate-metric-card">
                                        <div className="certificate-metric-icon">{item.icon}</div>
                                        <span>{item.label}</span>
                                        <strong>{item.value}</strong>
                                    </article>
                                ))}
                            </div>

                            <div className="certificate-template-strip">
                                <div className="certificate-template-pill">
                                    <FileImage size={16} />
                                    <span>{data.templatePath ? "Template da frente configurado" : "Template da frente pendente"}</span>
                                </div>
                                <div className="certificate-template-pill">
                                    <Files size={16} />
                                    <span>{data.templateVersePath ? "Verso disponivel" : "Sem verso cadastrado"}</span>
                                </div>
                            </div>
                        </article>

                        <aside className="certificate-action-column">
                            <ActionCard
                                icon={<Sparkles size={20} />}
                                title="Criar um certificado"
                                description="Preencha os dados manualmente com um formulario mais limpo e contextual."
                                actionLabel="Abrir formulario"
                                onClick={() => setActiveView("single")}
                            />

                            <ActionCard
                                icon={<FileSpreadsheet size={20} />}
                                title="Criar varios certificados"
                                description="Importe uma planilha XLSX, revise as linhas e publique tudo em lote."
                                actionLabel="Importar planilha"
                                onClick={() => setActiveView("bulk")}
                            />

                            <Link
                                prefetch={false}
                                href={`/todosCertificados/${paramsId}`}
                                target="_blank"
                                className="glass-card certificate-link-card"
                            >
                                <div className="certificate-link-card-icon">
                                    <FolderOpen size={20} />
                                </div>
                                <div>
                                    <strong>Ver certificados do evento</strong>
                                    <p>Abrir em nova aba para revisar os certificados ja emitidos.</p>
                                </div>
                                <ExternalLink size={18} />
                            </Link>
                        </aside>
                    </section>
                )}

                {activeView === "single" && (
                    <section className="certificate-form-layout fade-in">
                        <aside className="glass-card certificate-form-sidebar">
                            <span className="certificate-sidebar-kicker">Resumo rapido</span>
                            <h2>{data.eventName}</h2>
                            <p>{data.eventDescription}</p>

                            <div className="certificate-sidebar-list">
                                {eventSummary.map((item) => (
                                    <div key={item.label} className="certificate-sidebar-item">
                                        <div className="certificate-sidebar-item-icon">{item.icon}</div>
                                        <div>
                                            <span>{item.label}</span>
                                            <strong>{item.value}</strong>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Link
                                prefetch={false}
                                href={`/todosCertificados/${paramsId}`}
                                target="_blank"
                                className="glass-button glass-button-primary certificate-sidebar-link"
                            >
                                <ExternalLink size={16} />
                                <span>Ver certificados do evento</span>
                            </Link>
                        </aside>

                        <section className="glass-container certificate-form-panel">
                            <form className="certificate-draft-form" onSubmit={openCreateCertificateConfirmation}>
                                <FormSection
                                    icon={<UserRound size={18} />}
                                    title="Dados do participante"
                                    description="Informacoes usadas para identificar o titular do certificado."
                                >
                                    <div className="certificate-field-grid">
                                        <TextField
                                            name="ownerName"
                                            label="Nome completo"
                                            value={formData.ownerName || ""}
                                            onChange={handleInputChange}
                                            placeholder="Ex: Maria da Silva"
                                            required
                                        />

                                        <TextField
                                            name="ownerCpf"
                                            label="CPF"
                                            value={formData.ownerCpf || ""}
                                            onChange={handleInputChange}
                                            placeholder="000.000.000-00"
                                        />

                                        <TextField
                                            name="ownerEmail"
                                            label="Email"
                                            type="email"
                                            value={formData.ownerEmail || ""}
                                            onChange={handleInputChange}
                                            placeholder="maria@email.com"
                                            icon={<Mail size={16} />}
                                        />
                                    </div>
                                </FormSection>

                                <FormSection
                                    icon={<ScanText size={18} />}
                                    title="Conteudo do certificado"
                                    description="Defina horas, texto superior e a mensagem exibida na parte inferior."
                                >
                                    <div className="certificate-field-grid">
                                        <TextField
                                            name="certificateHours"
                                            label="Carga horaria"
                                            type="number"
                                            value={formData.certificateHours || ""}
                                            onChange={handleInputChange}
                                            placeholder="8"
                                            required
                                        />

                                        <TextField
                                            name="frontTopperText"
                                            label="Texto superior"
                                            value={formData.frontTopperText || ""}
                                            onChange={handleInputChange}
                                            placeholder="Ex: Certificamos que"
                                        />
                                    </div>

                                    <TextField
                                        name="frontBottomText"
                                        label="Texto inferior"
                                        value={formData.frontBottomText || ""}
                                        onChange={handleInputChange}
                                        placeholder="Mensagem complementar que aparecera abaixo do nome."
                                        textarea
                                    />
                                </FormSection>

                                <FormSection
                                    icon={<Upload size={18} />}
                                    title="Arquivo e publicacao"
                                    description="Associe o template ou arquivo do certificado e escolha se ele ja sera liberado."
                                >
                                    <div className="certificate-upload-grid">
                                        <TextField
                                            name="certificatePath"
                                            label="Arquivo do certificado"
                                            value={formData.certificatePath || ""}
                                            onChange={handleInputChange}
                                            placeholder="ID ou caminho do arquivo"
                                            hint="Voce pode colar o identificador manualmente ou enviar um arquivo."
                                        />

                                        <FileUploader toggleText={(text) => setFormData((prev) => ({ ...prev, certificatePath: text }))} />
                                    </div>

                                    <div className="certificate-status-panel">
                                        <div className="certificate-status-copy">
                                            <span className="certificate-status-label">Status de entrega</span>
                                            <p>Escolha se o certificado ja deve ficar disponivel para consulta assim que for criado.</p>
                                        </div>

                                        <div className="certificate-status-switches">
                                            <button
                                                type="button"
                                                className={`certificate-status-button ${formData.isReady ? "is-active" : ""}`}
                                                onClick={() => setFormData((prev) => ({ ...prev, isReady: true }))}
                                            >
                                                <BadgeCheck size={16} />
                                                <span>Liberar agora</span>
                                            </button>

                                            <button
                                                type="button"
                                                className={`certificate-status-button ${formData.isReady ? "" : "is-active"}`}
                                                onClick={() => setFormData((prev) => ({ ...prev, isReady: false }))}
                                            >
                                                <Info size={16} />
                                                <span>Salvar como rascunho</span>
                                            </button>
                                        </div>
                                    </div>
                                </FormSection>

                                <div className="certificate-form-actions">
                                    <button type="submit" className="glass-button glass-button-primary certificate-submit-button">
                                        Criar certificado
                                    </button>

                                    <button
                                        type="button"
                                        className="glass-button certificate-submit-button"
                                        onClick={() => {
                                            resetCertificateForm();
                                            setActiveView("overview");
                                        }}
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </section>
                    </section>
                )}

                {activeView === "bulk" && (
                    <section className="glass-container certificate-bulk-panel fade-in">
                        <div className="certificate-bulk-panel-header">
                            <div>
                                <span className="certificate-bulk-badge">Fluxo em lote</span>
                                <h2>Importacao guiada por planilha</h2>
                                <p>Revise o arquivo antes de publicar para manter o padrao e evitar retrabalho.</p>
                            </div>
                        </div>

                        <XLSXReader
                            eventId={paramsId}
                            eventName={data.eventName}
                            onBack={() => setActiveView("overview")}
                        />
                    </section>
                )}
            </div>
        </main>
    );
}

const ActionCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    description: string;
    actionLabel: string;
    onClick: () => void;
}> = ({ icon, title, description, actionLabel, onClick }) => {
    return (
        <article className="glass-card certificate-action-card">
            <div className="certificate-action-icon">{icon}</div>
            <h3>{title}</h3>
            <p>{description}</p>
            <button type="button" className="glass-button glass-button-primary certificate-action-button" onClick={onClick}>
                {actionLabel}
            </button>
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
        <section className="certificate-section-block">
            <div className="certificate-section-header">
                <div className="certificate-section-icon">{icon}</div>
                <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                </div>
            </div>

            <div className="certificate-section-content">{children}</div>
        </section>
    );
};

const TextField: React.FC<{
    name: string;
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    type?: React.HTMLInputTypeAttribute;
    placeholder?: string;
    hint?: string;
    textarea?: boolean;
    required?: boolean;
    icon?: React.ReactNode;
}> = ({ name, label, value, onChange, type = "text", placeholder, hint, textarea = false, required = false, icon }) => {
    return (
        <div className="certificate-field">
            <label htmlFor={name} className="certificate-field-label">
                {label}
            </label>

            <div className={`certificate-field-control ${icon ? "has-icon" : ""}`}>
                {icon && <span className="certificate-field-icon">{icon}</span>}
                {textarea ? (
                    <textarea
                        id={name}
                        name={name}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        className="glass-input certificate-input certificate-textarea"
                        required={required}
                    />
                ) : (
                    <input
                        id={name}
                        name={name}
                        type={type}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        className="glass-input certificate-input"
                        required={required}
                    />
                )}
            </div>

            {hint && <span className="certificate-field-hint">{hint}</span>}
        </div>
    );
};

const XLSXReader: React.FC<{ eventId: string; eventName: string; onBack: () => void }> = ({
    eventId,
    eventName,
    onBack,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [data, setData] = useState<string[][]>([]);
    const [fileName, setFileName] = useState("");
    const [subStep, setSubStep] = useState<0 | 1>(0);
    const [input1, setInput1] = useState("");
    const [input2, setInput2] = useState("");
    const [input3, setInput3] = useState("");
    const [input4, setInput4] = useState("");
    const [isReady, setIsReady] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const processFile = (file: File) => {
        const reader = new FileReader();
        setFileName(file.name);
        setFeedback(null);

        reader.onload = (event) => {
            const arrayBuffer = event.target?.result;
            if (arrayBuffer && typeof arrayBuffer !== "string") {
                const workbook = XLSX.read(arrayBuffer, { type: "array" });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData: string[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                setData(jsonData);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const handleCellChange = (rowIndex: number, cellIndex: number, value: string) => {
        setData((prev) =>
            prev.map((row, currentRowIndex) => {
                if (currentRowIndex !== rowIndex) {
                    return row;
                }

                return row.map((cell, currentCellIndex) => (currentCellIndex === cellIndex ? value : cell));
            }),
        );
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            processFile(file);
        }
        event.target.value = "";
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
    };

    const resetBulkFlow = () => {
        setSubStep(0);
        setData([]);
        setFileName("");
        setInput1("");
        setInput2("");
        setInput3("");
        setInput4("");
        setIsReady(false);
    };

    const pushCertificates = async () => {
        setIsSubmitting(true);
        setFeedback(null);

        try {
            const response = await fetch("/api/put/createManyCertificates", {
                method: "POST",
                body: JSON.stringify({
                    update: data.filter((row) => row.length !== 0).filter((_, index) => index !== 0),
                    frontText: input1,
                    bottomText: input2,
                    eventName,
                    eventId,
                    hours: input3,
                    isReady: String(isReady),
                    path: input4,
                }),
            });

            const responseJson: { message: string } = await response.json();

            if (!response.ok) {
                setFeedback({
                    type: "error",
                    text: responseJson.message || "Nao foi possivel criar os certificados.",
                });
                return;
            }

            setFeedback({
                type: "success",
                text: responseJson.message || "Certificados criados com sucesso.",
            });
            resetBulkFlow();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Erro inesperado ao criar os certificados.";
            setFeedback({ type: "error", text: message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="certificate-bulk-flow">
            <div className="certificate-bulk-stepper">
                <div className={`certificate-bulk-step ${subStep === 0 ? "is-active" : "is-complete"}`}>
                    <span>1</span>
                    <strong>Planilha</strong>
                </div>
                <div className={`certificate-bulk-step ${subStep === 1 ? "is-active" : ""}`}>
                    <span>2</span>
                    <strong>Configuracao</strong>
                </div>
            </div>

            {feedback && (
                <div className={`certificate-bulk-feedback ${feedback.type === "success" ? "is-success" : "is-error"}`}>
                    {feedback.text}
                </div>
            )}

            {subStep === 0 && (
                <div className="certificate-bulk-upload-stage">
                    {!data.length && (
                        <div className="certificate-bulk-upload-grid">
                            <article className="glass-card certificate-bulk-instructions">
                                <span className="certificate-bulk-badge">Antes de enviar</span>
                                <h3>Confira o arquivo</h3>
                                <p>Use uma planilha XLSX com cabecalhos na primeira linha. Depois da importacao voce ainda podera revisar e editar cada celula.</p>
                            </article>

                            <div
                                className="certificate-bulk-dropzone"
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="certificate-bulk-dropzone-icon">
                                    <FileSpreadsheet size={30} />
                                </div>
                                <h3>Selecione ou arraste sua planilha</h3>
                                <p>Arquivos aceitos: .xlsx e .xls</p>
                                <button type="button" className="glass-button glass-button-primary">
                                    Escolher planilha
                                </button>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="certificate-bulk-hidden-input"
                                />
                            </div>
                        </div>
                    )}

                    {data.length > 0 && (
                        <div className="certificate-bulk-preview">
                            <div className="certificate-bulk-preview-header">
                                <div>
                                    <span className="certificate-bulk-badge">Arquivo carregado</span>
                                    <h3>{fileName || "Planilha pronta para revisao"}</h3>
                                    <p>Revise as linhas abaixo antes de avancar para a configuracao final.</p>
                                </div>

                                <div className="certificate-bulk-preview-actions">
                                    <button type="button" className="glass-button" onClick={resetBulkFlow}>
                                        Trocar planilha
                                    </button>
                                    <button type="button" className="glass-button glass-button-primary" onClick={() => setSubStep(1)}>
                                        Proximo passo
                                    </button>
                                </div>
                            </div>

                            <div className="certificate-bulk-table-wrapper">
                                <table className="certificate-bulk-table">
                                    <tbody>
                                        {data.map((row, rowIndex) =>
                                            row.length ? (
                                                <tr key={`${rowIndex}-${row.join("-")}`} className={rowIndex === 0 ? "is-header" : ""}>
                                                    {row.map((cell, cellIndex) =>
                                                        rowIndex === 0 ? (
                                                            <td key={`${rowIndex}-${cellIndex}`}>{cell || "Sem titulo"}</td>
                                                        ) : (
                                                            <td key={`${rowIndex}-${cellIndex}`}>
                                                                <input
                                                                    type="text"
                                                                    value={cell}
                                                                    onChange={(event) =>
                                                                        handleCellChange(rowIndex, cellIndex, event.target.value)
                                                                    }
                                                                    className="certificate-bulk-cell-input"
                                                                />
                                                            </td>
                                                        ),
                                                    )}
                                                </tr>
                                            ) : null,
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {subStep === 1 && (
                <div className="certificate-bulk-config-stage">
                    <div className="certificate-bulk-config-grid">
                        <TextField
                            name="bulk-top-text"
                            label="Texto superior"
                            value={input1}
                            onChange={(event) => setInput1(event.target.value)}
                            placeholder="Ex: Certificamos que"
                        />

                        <TextField
                            name="bulk-hours"
                            label="Carga horaria"
                            value={input3}
                            onChange={(event) => setInput3(event.target.value)}
                            placeholder="Ex: 8"
                        />

                        <div className="certificate-bulk-config-column">
                            <TextField
                                name="bulk-bottom-text"
                                label="Texto inferior"
                                value={input2}
                                onChange={(event) => setInput2(event.target.value)}
                                placeholder="Mensagem complementar a ser aplicada em lote."
                                textarea
                            />
                        </div>

                        <TextField
                            name="bulk-path"
                            label="Arquivo do certificado"
                            value={input4}
                            onChange={(event) => setInput4(event.target.value)}
                            placeholder="ID ou caminho do template"
                        />
                    </div>

                    <div className="certificate-status-panel">
                        <div className="certificate-status-copy">
                            <span className="certificate-status-label">Disponibilizacao</span>
                            <p>Defina se os certificados gerados em lote ja sairao liberados para consulta.</p>
                        </div>

                        <div className="certificate-status-switches">
                            <button
                                type="button"
                                className={`certificate-status-button ${isReady ? "is-active" : ""}`}
                                onClick={() => setIsReady(true)}
                            >
                                <BadgeCheck size={16} />
                                <span>Liberar agora</span>
                            </button>

                            <button
                                type="button"
                                className={`certificate-status-button ${isReady ? "" : "is-active"}`}
                                onClick={() => setIsReady(false)}
                            >
                                <Info size={16} />
                                <span>Salvar como rascunho</span>
                            </button>
                        </div>
                    </div>

                    <div className="certificate-bulk-footer">
                        <button type="button" className="glass-button" onClick={() => setSubStep(0)}>
                            Voltar para a planilha
                        </button>

                        <div className="certificate-bulk-footer-actions">
                            <button type="button" className="glass-button" onClick={onBack}>
                                Sair do fluxo
                            </button>
                            <button
                                type="button"
                                className="glass-button glass-button-primary"
                                onClick={pushCertificates}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "Criando certificados..." : "Criar certificados"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

function FileUploader({ toggleText }: { toggleText: (text: string) => void }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [status, setStatus] = useState<"initial" | "selecting" | "selected" | "uploading" | "success" | "error">(
        "initial",
    );
    const [feedbackMessage, setFeedbackMessage] = useState("Envie uma imagem ou PDF para obter o identificador do arquivo.");

    const handleChooseFile = () => {
        setStatus("selecting");
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setStatus("selected");
            setFeedbackMessage(`Arquivo selecionado: ${file.name}`);
        } else {
            setStatus("initial");
        }

        event.target.value = "";
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setFeedbackMessage("Nenhum arquivo selecionado.");
            setStatus("error");
            return;
        }

        const formData = new FormData();
        formData.append("file", selectedFile);

        setStatus("uploading");
        setFeedbackMessage("Enviando arquivo...");

        try {
            const response = await fetch("/api/put/uploadCertificateTemplate", {
                method: "POST",
                body: formData,
            });

            const jsonData: { fileId: string; message: string } = await response.json();

            if (!response.ok) {
                throw new Error(jsonData.message || "Falha no upload do arquivo.");
            }

            toggleText(jsonData.fileId);
            setSelectedFile(null);
            setStatus("success");
            setFeedbackMessage("Arquivo enviado com sucesso. O campo acima foi preenchido automaticamente.");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Falha no upload do arquivo.";
            setStatus("error");
            setFeedbackMessage(message);
        }
    };

    return (
        <div className="glass-card certificate-template-uploader">
            <div className="certificate-template-uploader-header">
                <div className="certificate-template-uploader-icon">
                    <Upload size={18} />
                </div>
                <div>
                    <strong>Upload rapido</strong>
                    <p>Escolha o arquivo e receba o identificador para preencher o campo automaticamente.</p>
                </div>
            </div>

            <button type="button" className="glass-button certificate-template-uploader-trigger" onClick={handleChooseFile}>
                Escolher arquivo
            </button>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="certificate-template-hidden-input"
                accept="image/*,.pdf"
            />

            <p
                className={`certificate-template-feedback ${
                    status === "success" ? "is-success" : status === "error" ? "is-error" : ""
                }`}
            >
                {feedbackMessage}
            </p>

            {status === "selected" && selectedFile && (
                <button
                    type="button"
                    onClick={handleUpload}
                    className="glass-button glass-button-primary certificate-template-upload-button"
                >
                    Enviar arquivo
                </button>
            )}

            {status === "uploading" && (
                <div className="certificate-template-spinner">
                    <LoadingSpinner size="small" showPercentage={true} message="Enviando arquivo..." />
                </div>
            )}
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
