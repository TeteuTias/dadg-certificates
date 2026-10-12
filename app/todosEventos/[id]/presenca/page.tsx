"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    Award,
    Camera,
    CameraOff,
    CheckCircle2,
    Loader2,
    QrCode,
    RefreshCw,
    Search,
    UserPlus,
    Users,
    XCircle,
    AlertTriangle,
    ExternalLink,
    LogOut,
} from "lucide-react";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import "./page.css";

interface Participant {
    _id: string;
    ownerName: string;
    ownerEmail: string;
    cpfMasked: string;
    checkedIn: boolean;
    checkedInAt?: string;
    checkedOut?: boolean;
    checkedOutAt?: string;
    certificateId?: string;
    createdAt: string;
    attendedStages?: number;
    totalStages?: number;
}

interface Stage {
    id: string;
    description: string;
    startDate: string;
    endDate: string;
}

interface Meta {
    total: number;
    checkedIn: number;
    absent: number;
}

type QrDecoder=(data:Uint8ClampedArray,width:number,height:number,options:{inversionAttempts:string})=>{data:string}|null;
declare global {interface Window {jsQR?:QrDecoder}}

type ScanState = "idle" | "scanning" | "validating" | "success" | "error" | "duplicate";

interface ScanResult {
    participantId: string;
    ownerName: string;
    ownerEmail: string;
    alreadyCheckedIn: boolean;
    alreadyCheckedOut?: boolean;
}

export default function PresencaPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [participants, setParticipants] = useState<Participant[]>([]);
    const [meta, setMeta] = useState<Meta>({ total: 0, checkedIn: 0, absent: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "checkedIn" | "absent">("all");
    const [searchQuery, setSearchQuery] = useState("");
    // IDs devolvidos pelo servidor quando a busca é um CPF completo; null = busca local.
    const [cpfMatchIds, setCpfMatchIds] = useState<Set<string> | null>(null);

    // Etapas do cronograma. A presença é registrada na etapa selecionada; eventos
    // sem identidade de etapa funcionam em modo legado (uma entrada e uma saída).
    const [stages, setStages] = useState<Stage[]>([]);
    const [stageId, setStageId] = useState<string | null>(null);
    const [legacyMode, setLegacyMode] = useState(false);
    // Papel de quem opera a tela; o operador não vê as ações exclusivas de administrador.
    const [viewerRole, setViewerRole] = useState<"admin" | "operator">("admin");
    const stageRef = useRef<string | null>(null);

    // QR Scanner
    const [scanMode, setScanMode] = useState<"checkin" | "checkout">("checkin");
    const [scanState, setScanState] = useState<ScanState>("idle");
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [scanError, setScanError] = useState("");
    const [scanErrorTitle, setScanErrorTitle] = useState("QR Code inválido");
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const jsQRRef = useRef<QrDecoder|null>(null);

    // Walk-in modal
    const [showWalkin, setShowWalkin] = useState(false);
    const [walkinForm, setWalkinForm] = useState({ ownerName: "", ownerEmail: "", ownerCpf: "" });
    const [walkinLoading, setWalkinLoading] = useState(false);
    const [walkinError, setWalkinError] = useState("");

    const fetchParticipants = useCallback(async () => {
        try {
            setIsLoading(true);
            const query = stageRef.current ? `?stageId=${stageRef.current}` : "";
            const res = await fetch(`/api/v1/events/${eventId}/participants${query}`);
            if (!res.ok) throw new Error("Erro ao buscar participantes");
            const data = await res.json();
            setParticipants(data.data || []);
            setMeta(data.meta || { total: 0, checkedIn: 0, absent: 0 });
            setStages(data.stages || []);
            setLegacyMode(data.legacyMode === true);
            setViewerRole(data.viewer?.role === "operator" ? "operator" : "admin");
            // Na primeira carga o servidor sugere a etapa em andamento ou a mais próxima.
            if (!stageRef.current && data.stageId) { stageRef.current = data.stageId; setStageId(data.stageId); }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [eventId]);

    useEffect(() => { fetchParticipants(); }, [fetchParticipants]);

    // A lista traz o CPF mascarado; a busca por CPF completo é resolvida no servidor.
    useEffect(() => {
        const digits = searchQuery.replace(/\D/g, "");
        if (digits.length !== 11 || /[a-zA-Z@]/.test(searchQuery)) { setCpfMatchIds(null); return; }
        let active = true;
        fetch(`/api/v1/events/${eventId}/participants`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cpf: digits }),
        })
            .then(res => (res.ok ? res.json() : { participantIds: [] }))
            .then(data => { if (active) setCpfMatchIds(new Set<string>(data.participantIds || [])); })
            .catch(() => { if (active) setCpfMatchIds(new Set<string>()); });
        return () => { active = false; };
    }, [searchQuery, eventId]);

    // Carrega jsQR via CDN (sem dependência extra)
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.jsQR) { jsQRRef.current = window.jsQR ?? null; return; }
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
        script.onload = () => { jsQRRef.current = window.jsQR ?? null; };
        document.head.appendChild(script);
    }, []);

    const stopCamera = useCallback(() => {
        if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    }, []);

    const failScan = useCallback((message: string, title = "QR Code inválido") => {
        setScanState("error"); setScanErrorTitle(title); setScanError(message);
    }, []);

    const handleQRDetected = useCallback(async (token: string) => {
        setScanState("validating");
        try {
            // O código vai no corpo: o QR pessoal identifica o aluno e não deve ficar em URLs.
            const scanRes = await fetch(`/api/v1/events/${eventId}/checkin/scan`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, stageId: stageRef.current }),
            });
            const scanData = await scanRes.json();
            if (!scanRes.ok || !scanData.valid) {
                if (scanData.code === "NOT_REGISTERED") {
                    failScan(`${scanData.error} Use "Adicionar sem QR" para lançar a presença.`, "Aluno sem inscrição");
                } else if (typeof scanData.code === "string" && scanData.code.startsWith("REGISTRATION_")) {
                    failScan(`${scanData.ownerName ? `${scanData.ownerName}: ` : ""}${scanData.error}`, "Inscrição não confirmada");
                } else {
                    failScan(scanData.error || "QR Code inválido para este evento.");
                }
                return;
            }

            const participantData = scanData.data;

            if (scanMode === "checkin" && participantData.alreadyCheckedIn) {
                setScanState("duplicate"); setScanResult(participantData); return;
            }
            if (scanMode === "checkout") {
                if (!participantData.alreadyCheckedIn) {
                    failScan("Participante ainda não registrou a entrada.", "Entrada pendente"); return;
                }
                if (participantData.alreadyCheckedOut) {
                    setScanState("duplicate"); setScanResult(participantData); return;
                }
            }

            const checkinRes = await fetch(`/api/v1/events/${eventId}/registration/${participantData.participantId}/checkin`, { 
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: scanMode, stageId: stageRef.current }),
            });
            const checkinData = await checkinRes.json();
            if (!checkinRes.ok) { failScan(checkinData.error || "Erro ao registrar presença.", "Presença não registrada"); return; }
            
            setScanState("success"); setScanResult(participantData);
            await fetchParticipants();
        } catch { failScan("Erro de conexão ao validar QR Code.", "Falha de conexão"); }
    }, [eventId, scanMode, fetchParticipants, failScan]);

    const scanFrame = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const jsQR = jsQRRef.current;
        if (!video || !canvas || !jsQR || video.readyState !== video.HAVE_ENOUGH_DATA) {
            animFrameRef.current = requestAnimationFrame(scanFrame); return;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });
        if (code?.data) { stopCamera(); handleQRDetected(code.data); return; }
        animFrameRef.current = requestAnimationFrame(scanFrame);
    }, [stopCamera, handleQRDetected]);

    const startCamera = async () => {
        setScanState("scanning"); setScanResult(null); setScanError("");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            streamRef.current = stream;
            if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
            animFrameRef.current = requestAnimationFrame(scanFrame);
        } catch {
            failScan("Não foi possível acessar a câmera. Verifique as permissões.", "Câmera indisponível");
        }
    };

    const resetScanner = () => { stopCamera(); setScanState("idle"); setScanResult(null); setScanError(""); };

    const selectStage = (id: string) => {
        stageRef.current = id; setStageId(id); resetScanner(); void fetchParticipants();
    };
    const currentStage = stages.find(stage => stage.id === stageId) || null;
    const stageLabel = (stage: Stage) => {
        const start = new Date(stage.startDate); const end = new Date(stage.endDate);
        const time: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
        return `${stage.description} — ${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${start.toLocaleTimeString("pt-BR", time)} às ${end.toLocaleTimeString("pt-BR", time)}`;
    };

    // Walk-in
    const handleWalkin = async () => {
        setWalkinLoading(true); setWalkinError("");
        try {
            const cpfClean = walkinForm.ownerCpf.replace(/\D/g, "");
            const res = await fetch(`/api/v1/events/${eventId}/walkin`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...walkinForm, ownerCpf: cpfClean, stageId: stageRef.current }),
            });
            const data = await res.json();
            if (!res.ok) { setWalkinError(data.error || "Erro ao adicionar participante."); return; }
            setShowWalkin(false); setWalkinForm({ ownerName: "", ownerEmail: "", ownerCpf: "" });
            await fetchParticipants();
        } catch { setWalkinError("Erro de conexão."); }
        finally { setWalkinLoading(false); }
    };

    const filteredParticipants = participants.filter(p => {
        const matchesFilter = filter === "all" || (filter === "checkedIn" && p.checkedIn) || (filter === "absent" && !p.checkedIn);
        const q = searchQuery.toLowerCase();
        const matchesSearch = cpfMatchIds
            ? cpfMatchIds.has(p._id)
            : !q || p.ownerName.toLowerCase().includes(q) || (p.ownerEmail || "").toLowerCase().includes(q);
        return matchesFilter && matchesSearch;
    });
    return (
        <main className="presenca-page" style={PoppinsFontLib.style}>
            <div className="presenca-shell">

                {/* Header */}
                <header className="presenca-header">
                    <Link href={viewerRole === "operator" ? "/presenca" : "/todosEventos"} className="presenca-back-link"><ArrowLeft size={16} />Voltar para eventos</Link>
                    <div className="presenca-title-area">
                        <h1 className="presenca-title"><Users size={28} />Lista de Presença</h1>
                        <p className="presenca-subtitle">{viewerRole === "operator" ? "Confirme as presenças com QR Code ou manualmente." : "Confirme as presenças com QR Code ou manualmente e libere os certificados ao final."}</p>
                    </div>
                    <div className="presenca-header-actions">
                        {viewerRole === "admin" && (<>
                        <Link href={`/event-payments?eventId=${eventId}`} className="glass-button">Pagamentos</Link>
                        <Link href="/certificate-claims" className="glass-button">Revisar vínculos antigos</Link>
                        <button className="glass-button" onClick={async()=>{
                          const preview=await fetch(`/api/v1/events/${eventId}/certificates`);const summary=await preview.json();
                          if(!preview.ok){alert(summary.error||"Não foi possível verificar os participantes.");return;}
                          if(!window.confirm(`Liberar certificados para ${summary.eligible} participantes que cumpriram a presença mínima (${summary.minAttendancePercent ?? 100}% das etapas, com entrada e saída)? Cada execução processa até 100.`))return;
                          const response=await fetch(`/api/v1/events/${eventId}/certificates`,{method:"POST"});const result=await response.json();
                          alert(response.ok?`${result.issued} processados; ${result.remaining} restantes.`:result.error||"Erro ao emitir certificados.");
                        }}>Liberar certificados de presença</button>
                        <Link href={`/todosCertificados/${eventId}`} target="_blank" className="glass-button presenca-certs-link">
                            <ExternalLink size={15} />Ver certificados (fluxo manual)
                        </Link>
                        </>)}
                        <button onClick={() => setShowWalkin(true)} className="glass-button glass-button-primary">
                            <UserPlus size={16} />Adicionar sem QR
                        </button>
                    </div>
                </header>

                {/* Etapa */}
                {stages.length > 0 && (
                    <div className="glass-card presenca-stage">
                        <label htmlFor="presenca-stage-select" className="presenca-stage-label">Etapa do cronograma</label>
                        {stages.length > 1 ? (
                            <select id="presenca-stage-select" className="glass-input presenca-stage-select" value={stageId || ""} onChange={e => selectStage(e.target.value)}>
                                {stages.map(stage => <option key={stage.id} value={stage.id}>{stageLabel(stage)}</option>)}
                            </select>
                        ) : (
                            <p id="presenca-stage-select" className="presenca-stage-single">{stageLabel(stages[0])}</p>
                        )}
                        <p className="presenca-stage-hint">Entradas, saídas e contadores abaixo valem para esta etapa. Conta para o certificado a etapa com entrada e saída.</p>
                    </div>
                )}
                {legacyMode && !isLoading && (
                    <div className="glass-card presenca-stage" role="status">
                        <p className="presenca-stage-hint">Este evento ainda registra uma única entrada e saída. Para registrar presença por etapa, abra Editar evento e salve o cronograma.</p>
                    </div>
                )}

                {/* Stats */}
                <div className="presenca-stats">
                    <div className="stat-card stat-card-total"><span className="stat-number">{meta.total}</span><span className="stat-label">Inscritos</span></div>
                    <div className="stat-card stat-card-present"><span className="stat-number">{meta.checkedIn}</span><span className="stat-label">Presentes</span></div>
                    <div className="stat-card stat-card-absent"><span className="stat-number">{meta.absent}</span><span className="stat-label">Ausentes</span></div>
                    {meta.total > 0 && (
                        <div className="stat-card stat-card-pct">
                            <span className="stat-number">{Math.round((meta.checkedIn / meta.total) * 100)}%</span>
                            <span className="stat-label">Frequência</span>
                        </div>
                    )}
                </div>

                {/* QR Scanner */}
                <div className="glass-card scanner-card">
                    <div className="scanner-header">
                        <QrCode size={22} className="scanner-icon" />
                        <h2>Leitor de QR Code</h2>
                        <div className="scanner-mode-toggle" style={{ display: "flex", gap: "10px", marginLeft: "auto" }}>
                            <button 
                                onClick={() => { setScanMode("checkin"); resetScanner(); }}
                                className={`glass-button ${scanMode === "checkin" ? "glass-button-primary" : ""}`}
                                style={{ padding: "5px 10px", fontSize: "12px" }}>
                                Check-in (Entrada)
                            </button>
                            <button 
                                onClick={() => { setScanMode("checkout"); resetScanner(); }}
                                className={`glass-button ${scanMode === "checkout" ? "glass-button-primary" : ""}`}
                                style={{ padding: "5px 10px", fontSize: "12px" }}>
                                Check-out (Saída)
                            </button>
                        </div>
                    </div>
                    {scanState === "idle" && (
                        <div className="scanner-idle">
                            <p className="scanner-hint">Aponte a câmera para o QR Code pessoal do aluno (em Meu perfil no site). Modo atual: <strong>{scanMode === "checkin" ? "Entrada" : "Saída"}</strong>{currentStage ? <> · Etapa: <strong>{currentStage.description}</strong></> : null}</p>
                            <button onClick={startCamera} className="glass-button glass-button-primary scanner-btn"><Camera size={18} />Abrir câmera</button>
                        </div>
                    )}
                    {scanState === "scanning" && (
                        <div className="scanner-live">
                            <div className="scanner-viewfinder">
                                <video ref={videoRef} className="scanner-video" playsInline muted />
                                <canvas ref={canvasRef} className="scanner-canvas" />
                                <div className="scanner-overlay">
                                    <div className="scanner-frame" />
                                    <span className="scanner-instructions">Aponte para o QR Code do aluno</span>
                                </div>
                            </div>
                            <button onClick={resetScanner} className="glass-button scanner-btn scanner-cancel"><CameraOff size={16} />Cancelar leitura</button>
                        </div>
                    )}
                    {scanState === "validating" && (<div className="scanner-feedback scanner-validating"><Loader2 size={40} className="scanner-spinner" /><p>Validando QR Code...</p></div>)}
                    {scanState === "success" && scanResult && (
                        <div className="scanner-feedback scanner-success">
                            <CheckCircle2 size={48} className="scanner-success-icon" />
                            <h3>✅ {scanMode === "checkin" ? "Presença" : "Saída"} Confirmada!</h3>
                            <p className="scanner-name">{scanResult.ownerName}</p>
                            <p className="scanner-email">{scanResult.ownerEmail}</p>
                            <button onClick={resetScanner} className="glass-button glass-button-primary scanner-btn"><RefreshCw size={16} />Escanear próximo</button>
                        </div>
                    )}
                    {scanState === "duplicate" && scanResult && (
                        <div className="scanner-feedback scanner-duplicate">
                            <AlertTriangle size={48} className="scanner-warning-icon" />
                            <h3>⚠️ {scanMode === "checkin" ? "Já fez Check-in" : "Já fez Check-out"}</h3>
                            <p className="scanner-name">{scanResult.ownerName}</p>
                            <p className="scanner-email">Ação já registrada anteriormente.</p>
                            <button onClick={resetScanner} className="glass-button scanner-btn"><RefreshCw size={16} />Escanear outro</button>
                        </div>
                    )}
                    {scanState === "error" && (
                        <div className="scanner-feedback scanner-error">
                            <XCircle size={48} className="scanner-error-icon" />
                            <h3>{scanErrorTitle}</h3>
                            <p>{scanError}</p>
                            <button onClick={resetScanner} className="glass-button scanner-btn"><RefreshCw size={16} />Tentar novamente</button>
                        </div>
                    )}
                </div>

                {/* Filtros */}
                <div className="presenca-controls">
                    <div className="presenca-filters">
                        {(["all", "checkedIn", "absent"] as const).map(f => (
                            <button key={f} onClick={() => setFilter(f)} className={`filter-btn ${filter === f ? "filter-btn-active" : ""}`}>
                                {f === "all" && `Todos (${meta.total})`}
                                {f === "checkedIn" && `✅ Presentes (${meta.checkedIn})`}
                                {f === "absent" && `⏳ Ausentes (${meta.absent})`}
                            </button>
                        ))}
                    </div>
                    <label className="presenca-search">
                        <Search size={16} />
                        <input type="text" placeholder="Nome, e-mail ou CPF completo..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="glass-input presenca-search-input" />
                    </label>
                </div>

                {/* Lista */}
                {isLoading ? (
                    <div className="presenca-loading"><Loader2 size={32} className="spin" /><p>Carregando participantes...</p></div>
                ) : filteredParticipants.length === 0 ? (
                    <div className="glass-card presenca-empty"><Users size={40} /><p>Nenhum participante encontrado.</p></div>
                ) : (
                    <div className="presenca-list">
                        {filteredParticipants.map(p => (
                            <ParticipantRow key={p._id} participant={p} eventId={eventId} stageId={stageId} onCheckinSuccess={fetchParticipants} />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal: Adicionar sem QR Code (Walk-in) */}
            {showWalkin && (
                <div className="modal-backdrop" onClick={() => setShowWalkin(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <UserPlus size={20} className="modal-icon" />
                            <h2>Adicionar sem QR Code</h2>
                        </div>
                        <p className="modal-desc">Adicione uma pessoa que não se inscreveu previamente. A presença será confirmada automaticamente.</p>
                        <div className="modal-fields">
                            <div className="modal-field">
                                <label>Nome completo *</label>
                                <input type="text" placeholder="Ex: Maria Silva" value={walkinForm.ownerName}
                                    onChange={e => setWalkinForm(f => ({ ...f, ownerName: e.target.value }))} className="glass-input" />
                            </div>
                            <div className="modal-field">
                                <label>E-mail *</label>
                                <input type="email" placeholder="email@exemplo.com" value={walkinForm.ownerEmail}
                                    onChange={e => setWalkinForm(f => ({ ...f, ownerEmail: e.target.value }))} className="glass-input" />
                            </div>
                            <div className="modal-field">
                                <label>CPF *</label>
                                <input type="text" placeholder="000.000.000-00" maxLength={14}
                                    value={walkinForm.ownerCpf}
                                    onChange={e => {
                                        const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                                        const fmt = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) => d ? `${a}.${b}.${c}-${d}` : c ? `${a}.${b}.${c}` : b ? `${a}.${b}` : a);
                                        setWalkinForm(f => ({ ...f, ownerCpf: fmt }));
                                    }} className="glass-input" />
                            </div>
                        </div>
                        {walkinError && <p className="modal-error">{walkinError}</p>}
                        <div className="modal-actions">
                            <button onClick={() => setShowWalkin(false)} className="glass-button">Cancelar</button>
                            <button onClick={handleWalkin} disabled={walkinLoading} className="glass-button glass-button-primary">
                                {walkinLoading ? <><Loader2 size={15} className="spin" />Salvando...</> : <><CheckCircle2 size={15} />Confirmar Presença</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </main>
    );
}

function ParticipantRow({ participant, eventId, stageId, onCheckinSuccess }: { participant: Participant; eventId: string; stageId: string | null; onCheckinSuccess: () => void | Promise<void> }) {
    const [isChecking, setIsChecking] = useState(false);
    const [actionError, setActionError] = useState("");

    const handleManualAction = async (mode: "checkin" | "checkout" | "reset") => {
        const confirmationMessage = mode === "reset"
            ? `Remover a presença de ${participant.ownerName}${stageId ? " nesta etapa" : ""}? A entrada e a saída serão apagadas.`
            : `Confirmar ${mode === "checkin" ? "entrada" : "saída"} de ${participant.ownerName}?`;
        if (!confirm(confirmationMessage)) return;
        setIsChecking(true);
        setActionError("");
        try {
            const res = await fetch(`/api/v1/events/${eventId}/registration/${participant._id}/checkin`, { 
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ mode, stageId })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const fallbackMessage = mode === "reset"
                    ? "Não foi possível remover a presença."
                    : `Não foi possível registrar ${mode === "checkin" ? "o check-in" : "o check-out"}.`;
                throw new Error(data.error || data.message || fallbackMessage);
            }
            await onCheckinSuccess();
        } catch (error) {
            setActionError(error instanceof Error ? error.message : "Erro de conexão ao registrar presença.");
        } finally { setIsChecking(false); }
    };

    return (
        <div className={`glass-card participant-row ${participant.checkedIn ? "row-present" : "row-absent"}`}>
            <div className={`participant-status-dot ${participant.checkedIn ? "dot-present" : "dot-absent"}`} />
            <div className="participant-info">
                <span className="participant-name">{participant.ownerName}</span>
                <span className="participant-email">{participant.ownerEmail}</span>
                <span className="participant-cpf">CPF: {participant.cpfMasked}</span>
                {(participant.totalStages || 0) > 1 && (
                    <span className="participant-cpf">Etapas cumpridas: {participant.attendedStages || 0} de {participant.totalStages}</span>
                )}
            </div>
            <div className="participant-actions">
                {participant.checkedIn ? (
                    <>
                        <span className="checkin-badge" style={{ marginBottom: participant.checkedOut ? "5px" : "0", display: "flex" }}>
                            <CheckCircle2 size={14} />
                            Entrada: {participant.checkedInAt ? new Date(participant.checkedInAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Sim"}
                        </span>
                        {participant.checkedOut ? (
                            <span className="checkin-badge" style={{ display: "flex", backgroundColor: "rgba(255, 152, 0, 0.1)", color: "var(--warning)" }}>
                                <LogOut size={14} />
                                Saída: {participant.checkedOutAt ? new Date(participant.checkedOutAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Sim"}
                            </span>
                        ) : (
                            <button onClick={() => handleManualAction("checkout")} disabled={isChecking} className="glass-button manual-checkin-btn" style={{ marginLeft: "10px" }}>
                                {isChecking ? <Loader2 size={14} className="spin" /> : <LogOut size={14} />}
                                Saída manual
                            </button>
                        )}
                        {!participant.certificateId && (
                            <button onClick={() => handleManualAction("reset")} disabled={isChecking} className="glass-button manual-remove-presence-btn">
                                {isChecking ? <Loader2 size={14} className="spin" /> : <XCircle size={14} />}
                                Remover presença
                            </button>
                        )}
                    </>
                ) : (
                    <button onClick={() => handleManualAction("checkin")} disabled={isChecking} className="glass-button manual-checkin-btn">
                        {isChecking ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                        Check-in manual
                    </button>
                )}
                {participant.certificateId && (
                    <span className="cert-badge"><Award size={14} />Certificado emitido</span>
                )}
                {actionError && <span className="participant-action-error" role="alert">{actionError}</span>}
            </div>
        </div>
    );
}
