"use client";

import { useCallback, useEffect, useState } from "react";
import Link from 'next/link';
import { toLocalDateTime } from "@/lib/selective-processes/domain";
import * as LucideIcons from "lucide-react";
import PricingTiersPanel from "./PricingTiersPanel";

const { ArrowLeft, BarChart3, Loader2, RefreshCw, Save, Search, Trash2, Pencil } = LucideIcons;

type SelectionProcess = {
  id: string;
  title?: string;
  registrationStartDate: string | Date;
  registrationEndDate: string | Date;
  maxExamsPerApplication: number;
  maxCapacity: number;
  paidCount?: number;
  remainingCapacity?: number;
};


type Exam = {
  id: string;
  name: string;
  acronym?: string;
  academicLeagueId?: string;
  examStartDate: string | Date;
  examEndDate: string | Date;
};

type AcademicLeague = { _id: string; name: string; acronym: string; type: "clinic" | "basic" };


type Feedback = { type: "success" | "error"; text: string } | null;
const EMPTY_EXAM_FORM = { source: "catalog" as "catalog" | "custom", academicLeagueId: "", name: "", acronym: "", examStartDate: "", examEndDate: "" };
const ADMIN_ERRORS: Record<string, string> = {
  DUPLICATE_EXAM: "Esta liga ou sigla já foi adicionada ao processo.",
  INVALID_ACADEMIC_LEAGUE: "A liga selecionada não possui dados válidos no catálogo oficial.",
  ACADEMIC_LEAGUE_NOT_FOUND: "A liga selecionada não existe mais no catálogo oficial.",
  INVALID_EXAM_ACRONYM: "Use uma sigla de até 30 caracteres, com letras, números, hífen ou sublinhado.",
  INVALID_EXAM: "Confira a liga e o período da prova. O fim deve ocorrer depois do início.",
  INVALID_PROCESS: "Confira o título, o período e os limites do processo.",
  CAPACITY_BELOW_ALLOCATED: "A capacidade não pode ser menor que o total de vagas já ocupadas ou reservadas.",
};
const adminError = (value: unknown, fallback: string) => typeof value === "string" ? ADMIN_ERRORS[value] || value : fallback;

export default function SelectionProcessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [process, setProcess] = useState<SelectionProcess | null>(null);
  const [processForm, setProcessForm] = useState({ title: "", registrationStartDate: "", registrationEndDate: "", maxExamsPerApplication: "", maxCapacity: "" });
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const [paymentSessionId, setPaymentSessionId] = useState("");

  const [exams, setExams] = useState<Exam[]>([]);
  const [catalog, setCatalog] = useState<AcademicLeague[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [examsLoading, setExamsLoading] = useState(false);
  const [savingExam, setSavingExam] = useState(false);

  const [examForm, setExamForm] = useState(EMPTY_EXAM_FORM);

  const [editingExamId, setEditingExamId] = useState<string | null>(null);

  const [confirmDeleteExam, setConfirmDeleteExam] = useState<Exam | null>(null);

  const loadExams = useCallback(async (pId: string) => {
    setExamsLoading(true);
    try {
      const res = await fetch(
        `/api/admin/selective-processes/selection-processes/${pId}/exams`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao carregar exames.");
      setExams(Array.isArray(data?.data) ? data.data : []);
    } finally {
      setExamsLoading(false);
    }
  }, []);

  const load = useCallback(async (pId: string) => {
    setFeedback(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/selective-processes/selection-processes/${pId}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao carregar processo.");
      const loaded = data?.data as SelectionProcess | null;
      setProcess(loaded);
      if (loaded) setProcessForm({
        title: loaded.title?.trim() || `Processo seletivo CLAM ${new Date(loaded.registrationStartDate).getFullYear()}`,
        registrationStartDate: toLocalDateTime(loaded.registrationStartDate),
        registrationEndDate: toLocalDateTime(loaded.registrationEndDate),
        maxExamsPerApplication: String(loaded.maxExamsPerApplication),
        maxCapacity: String(loaded.maxCapacity),
      });

      await loadExams(pId);
    } catch (e) {
      setFeedback({ type: "error", text: e instanceof Error ? e.message : "Falha ao carregar" });
    } finally {
      setLoading(false);
    }
  }, [loadExams]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await params;
        if (!mounted) return;
        await load(p.id);
      } finally {
        // no-op
      }
    })();
    return () => {
      mounted = false;
    };
  }, [params, load]);

  useEffect(() => {
    fetch("/api/v1/leagues", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error("Não foi possível carregar o catálogo de ligas.");
        setCatalog(Array.isArray(body?.data) ? body.data : []);
      })
      .catch((error) => setFeedback({ type: "error", text: error instanceof Error ? error.message : "Falha ao carregar o catálogo." }));
  }, []);

  const paidCount = process?.paidCount ?? 0;
  const remainingCapacity = process?.remainingCapacity ?? Math.max((process?.maxCapacity ?? 0) - paidCount, 0);
  const visibleCatalog = catalog.filter((league) => `${league.acronym} ${league.name}`.toLocaleLowerCase("pt-BR").includes(catalogSearch.trim().toLocaleLowerCase("pt-BR")));

  return (
    <main className="clam-shell space-y-6">
      <Link href="/selective-processes" className="clam-button w-fit"><ArrowLeft size={16} /> Voltar aos processos</Link>
      <section className="clam-hero flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="clam-kicker">Gestão da edição</p>
          <h1 className="mt-2 text-3xl font-black text-white">{process?.title || (process ? `Processo seletivo CLAM ${new Date(process.registrationStartDate).getFullYear()}` : "Processo seletivo")}</h1>
          <p className="clam-muted mt-2">Controle configurações, ligas, preços e operação.</p>
        </div>
        <div className="flex flex-wrap gap-2">{process?.id && <Link className="clam-button clam-button-primary" href={`/selective-processes/${process.id}/reports`}><BarChart3 size={16} /> Relatórios e correção</Link>}<button
          type="button"
          className="clam-button"
          onClick={async () => {
            if (!process?.id) return;
            await load(process.id);
          }}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? "Carregando" : "Atualizar"}
        </button></div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="clam-card">
          <div className="clam-muted text-sm">Capacidade</div>
          <div className="mt-1 text-2xl font-semibold text-white">{process?.maxCapacity ?? "—"}</div>
        </div>
        <div className="clam-card">
          <div className="clam-muted text-sm">Pagamentos confirmados</div>
          <div className="mt-1 text-2xl font-semibold text-white">{paidCount}</div>
        </div>
        <div className="clam-card">
          <div className="clam-muted text-sm">Vagas restantes</div>
          <div className="mt-1 text-2xl font-semibold text-white">{remainingCapacity}</div>
        </div>
      </div>

      {loading && (
        <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={16} />
          Carregando...
        </div>
      )}

      {!loading && feedback && (
        <div role="status" className={`clam-feedback ${feedback.type === "success" ? "clam-feedback-success" : "clam-feedback-error"}`}>
          {feedback.text}
        </div>
      )}

      {!loading && process && (
        <section className="clam-panel">
          <div><p className="clam-kicker">Configuração</p><h2 className="mt-2 text-xl font-bold text-white">Dados do processo</h2></div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="clam-label md:col-span-2">Título<input className="clam-input" maxLength={120} value={processForm.title} onChange={(event) => setProcessForm({ ...processForm, title: event.target.value })} /></label>
            <label className="clam-label">Abertura das inscrições<input className="clam-input" type="datetime-local" value={processForm.registrationStartDate} onChange={(event) => setProcessForm({ ...processForm, registrationStartDate: event.target.value })} /></label>
            <label className="clam-label">Encerramento das inscrições<input className="clam-input" type="datetime-local" value={processForm.registrationEndDate} onChange={(event) => setProcessForm({ ...processForm, registrationEndDate: event.target.value })} /></label>
            <label className="clam-label">Máximo de ligas por candidato<input className="clam-input" type="number" min={1} max={4} step={1} value={processForm.maxExamsPerApplication} onChange={(event) => setProcessForm({ ...processForm, maxExamsPerApplication: event.target.value })} /></label>
            <label className="clam-label">Capacidade de inscrições<input className="clam-input" type="number" min={0} step={1} value={processForm.maxCapacity} onChange={(event) => setProcessForm({ ...processForm, maxCapacity: event.target.value })} /></label>
          </div>
          <button className="clam-button clam-button-primary mt-5" type="button" onClick={async () => {
            if (!processForm.registrationStartDate || !processForm.registrationEndDate) { setFeedback({ type: "error", text: "Informe a abertura e o encerramento das inscrições." }); return; }
            const payload = { title: processForm.title.trim(), registrationStartDate: new Date(processForm.registrationStartDate).toISOString(), registrationEndDate: new Date(processForm.registrationEndDate).toISOString(), maxExamsPerApplication: Number(processForm.maxExamsPerApplication), maxCapacity: Number(processForm.maxCapacity) };
            if (payload.title.length < 3 || !Number.isInteger(payload.maxExamsPerApplication) || payload.maxExamsPerApplication < 1 || payload.maxExamsPerApplication > 4 || !Number.isInteger(payload.maxCapacity) || payload.maxCapacity < 0 || new Date(payload.registrationEndDate) <= new Date(payload.registrationStartDate)) { setFeedback({ type: "error", text: "Confira o título, o período e os limites do processo." }); return; }
            setLoading(true); setFeedback(null);
            try { const response = await fetch(`/api/admin/selective-processes/selection-processes/${process.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(adminError(body?.error, "Não foi possível salvar o processo.")); await load(process.id); setFeedback({ type: "success", text: "Configurações do processo salvas." }); }
            catch (error) { setFeedback({ type: "error", text: error instanceof Error ? error.message : "Falha ao salvar." }); }
            finally { setLoading(false); }
          }}><Save size={16} /> Salvar configurações</button>
        </section>
      )}

      {!loading && process && (
        <details className="clam-panel">
          <summary className="cursor-pointer font-semibold text-white">Ferramenta de suporte: reconciliar pagamento</summary>
          <label className="mt-3 block text-sm">ID da sessão de pagamento
            <input value={paymentSessionId} onChange={e => setPaymentSessionId(e.target.value)}
              className="clam-input mt-2" />
          </label>
          <button type="button" disabled={!paymentSessionId || loading} className="clam-button clam-button-primary mt-4"
            onClick={async () => {
              setLoading(true);
              try {
                const res = await fetch(`/api/admin/selective-processes/payments/${paymentSessionId}/reconcile`, { method: 'POST' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Falha ao consultar pagamento.');
                await load(process.id);
                setFeedback({ type: 'success', text: 'Pagamento consultado e situação reconciliada.' });
              } catch (error) { setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Falha ao reconciliar.' }); }
              finally { setLoading(false); }
            }}>Consultar e reconciliar</button>
        </details>
      )}

      {!loading && process && (
        <section className="clam-panel">
          <p className="clam-kicker">Opções do candidato</p>
          <h2 className="mt-2 text-xl font-bold text-white">Ligas e provas</h2>
          <p className="clam-muted mt-1 text-sm">Escolha uma liga do catálogo oficial ou cadastre uma opção excepcional para esta edição.</p>

          <div className="mt-4">
            {examsLoading ? (
              <div className="clam-muted flex items-center gap-2 text-sm">
                <Loader2 size={16} className="animate-spin" /> Carregando ligas...
              </div>
            ) : (
              <div className="grid gap-3">
                {(exams ?? []).length === 0 ? (
                  <div className="clam-feedback clam-feedback-warning">Nenhuma liga foi adicionada a este processo.</div>
                ) : (
                  (exams ?? []).map((ex) => (
                    <div key={ex.id} className="clam-card">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-xs font-black tracking-widest text-blue-300">{ex.acronym || "SEM SIGLA · LEGADO"}</div>
                          <div className="mt-1 text-sm font-semibold text-white">{ex.name}</div>
                          <div className="mt-2 text-xs">
                            <div className="clam-muted">Início</div>
                            <div>{new Date(ex.examStartDate).toLocaleString()}</div>
                          </div>
                          <div className="mt-2 text-xs">
                            <div className="clam-muted">Fim</div>
                            <div>{new Date(ex.examEndDate).toLocaleString()}</div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2 md:mt-0">
                          <button
                            type="button"
                            className="clam-button"
                            onClick={() => {
                              setEditingExamId(ex.id);
                              const start = ex.examStartDate instanceof Date ? ex.examStartDate : new Date(ex.examStartDate);
                              const end = ex.examEndDate instanceof Date ? ex.examEndDate : new Date(ex.examEndDate);
                              setExamForm({
                                source: ex.academicLeagueId ? "catalog" : "custom",
                                academicLeagueId: ex.academicLeagueId || "",
                                name: ex.name,
                                acronym: ex.acronym || "",
                                examStartDate: toLocalDateTime(start),
                                examEndDate: toLocalDateTime(end),
                              });
                            }}
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            className="clam-button clam-button-danger"
                            onClick={() => setConfirmDeleteExam(ex)}
                          >
                            <Trash2 size={14} />
                            Apagar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="clam-card mt-6">
            <div className="text-lg font-semibold text-white">{editingExamId ? "Editar liga" : "Adicionar liga"}</div>

            <div className="mt-4 flex gap-2">
              <button type="button" className={`clam-button ${examForm.source === "catalog" ? "clam-button-primary" : ""}`} onClick={() => setExamForm((form) => ({ ...form, source: "catalog", name: "", acronym: "" }))}>Catálogo oficial</button>
              <button type="button" className={`clam-button ${examForm.source === "custom" ? "clam-button-primary" : ""}`} onClick={() => setExamForm((form) => ({ ...form, source: "custom", academicLeagueId: "" }))}>Liga personalizada</button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {examForm.source === "catalog" ? <div className="md:col-span-2 grid gap-3">
                <label className="clam-label"><span className="inline-flex items-center gap-2"><Search size={15} /> Buscar por nome ou sigla</span><input className="clam-input" value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Ex.: cardiologia ou LACOR" /></label>
                <label className="clam-label">Liga do catálogo<select className="clam-input" value={examForm.academicLeagueId} onChange={(event) => setExamForm((form) => ({ ...form, academicLeagueId: event.target.value }))}><option value="">Selecione uma liga</option>{visibleCatalog.map((league) => <option key={league._id} value={league._id}>{league.acronym} — {league.name}</option>)}</select></label>
              </div> : <>
                <label className="clam-label">Nome completo<input value={examForm.name} onChange={(e) => setExamForm((f) => ({ ...f, name: e.target.value }))} className="clam-input" placeholder="Ex.: Liga Acadêmica de Cardiologia" /></label>
                <label className="clam-label">Sigla<input value={examForm.acronym} maxLength={30} onChange={(e) => setExamForm((f) => ({ ...f, acronym: e.target.value.toUpperCase() }))} className="clam-input" placeholder="Ex.: LACOR" /></label>
              </>}

              <label className="clam-label">Início da prova
                <input
                  type="datetime-local"
                  value={examForm.examStartDate}
                  onChange={(e) => setExamForm((f) => ({ ...f, examStartDate: e.target.value }))}
                  className="clam-input"
                />
              </label>

              <label className="clam-label">Fim da prova
                <input
                  type="datetime-local"
                  value={examForm.examEndDate}
                  onChange={(e) => setExamForm((f) => ({ ...f, examEndDate: e.target.value }))}
                  className="clam-input"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                className="clam-button clam-button-primary"
                disabled={savingExam}
                onClick={async () => {
                  if (!process.id) return;
                  setFeedback(null);
                  setSavingExam(true);
                  try {
                    const dates = {
                      examStartDate: examForm.examStartDate
                        ? new Date(examForm.examStartDate).toISOString()
                        : null,
                      examEndDate: examForm.examEndDate
                        ? new Date(examForm.examEndDate).toISOString()
                        : null,
                    };
                    const payload = examForm.source === "catalog"
                      ? { source: "catalog", academicLeagueId: examForm.academicLeagueId, ...dates }
                      : { source: "custom", name: examForm.name.trim(), acronym: examForm.acronym.trim().toUpperCase(), ...dates };

                    if (!payload.examStartDate || !payload.examEndDate || (examForm.source === "catalog" ? !examForm.academicLeagueId : !examForm.name.trim() || !examForm.acronym.trim())) {
                      setFeedback({ type: "error", text: "Selecione a liga ou informe nome e sigla, além do período da prova." });
                      return;
                    }

                    if (editingExamId) {
                      const res = await fetch(
                        `/api/admin/selective-processes/selection-processes/${process.id}/exams/${editingExamId}`,
                        {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        }
                      );
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(adminError(data?.error, "Falha ao editar liga."));
                    } else {
                      const res = await fetch(
                        `/api/admin/selective-processes/selection-processes/${process.id}/exams`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        }
                      );
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(adminError(data?.error, "Falha ao criar liga."));
                    }

                    setEditingExamId(null);
                    setExamForm(EMPTY_EXAM_FORM);
                    await loadExams(process.id);
                    setFeedback({ type: "success", text: "Liga salva." });
                  } catch (e) {
                    setFeedback({ type: "error", text: e instanceof Error ? e.message : "Falha" });
                  } finally {
                    setSavingExam(false);
                  }
                }}
              >
                {savingExam ? "Salvando..." : editingExamId ? "Salvar edição" : "Criar liga"}
              </button>

              {editingExamId && (
                <button
                  type="button"
                  className="clam-button"
                  onClick={() => {
                    setEditingExamId(null);
                    setExamForm(EMPTY_EXAM_FORM);
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>

          {confirmDeleteExam && (
            <div className="clam-modal-backdrop">
              <div className="clam-modal" role="alertdialog" aria-modal="true">
                <div className="text-xl font-semibold text-white">Remover liga do processo?</div>
                <div className="clam-muted mt-2 text-sm">
                  Isso vai remover a liga da inscrição do usuário e devolver crédito.
                </div>

                <div className="clam-card mt-3 text-sm">
                  <div className="text-xs font-black tracking-widest text-blue-300">{confirmDeleteExam.acronym || "SEM SIGLA"}</div>
                  <div className="mt-1 font-semibold text-white">{confirmDeleteExam.name}</div>
                  <div className="clam-muted mt-2 text-xs">Início</div>
                  <div>{new Date(confirmDeleteExam.examStartDate).toLocaleString()}</div>
                  <div className="clam-muted mt-2 text-xs">Fim</div>
                  <div>{new Date(confirmDeleteExam.examEndDate).toLocaleString()}</div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="clam-button"
                    onClick={() => setConfirmDeleteExam(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="clam-button clam-button-danger"
                    onClick={async () => {
                      if (!process?.id || !confirmDeleteExam) return;
                      setFeedback(null);
                      try {
                        const res = await fetch(
                          `/api/admin/selective-processes/selection-processes/${process.id}/exams/${confirmDeleteExam.id}`,
                          { method: "DELETE" }
                        );
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data?.error || "Falha ao apagar liga.");

                        setConfirmDeleteExam(null);
                        await loadExams(process.id);
                        if (editingExamId === confirmDeleteExam.id) {
                          setEditingExamId(null);
                          setExamForm(EMPTY_EXAM_FORM);
                        }
                        setFeedback({ type: "success", text: "Liga apagada." });
                      } catch (e) {
                        setFeedback({ type: "error", text: e instanceof Error ? e.message : "Falha" });
                      }
                    }}
                  >
                    Apagar
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {!loading && process?.id && <PricingTiersPanel selectionProcessId={process.id} />}

    </main>
  );
}
