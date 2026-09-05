"use client";

import { useCallback, useEffect, useState } from "react";
import { toLocalDateTime } from "@/lib/selective-processes/domain";
import * as LucideIcons from "lucide-react";
import PricingTiersPanel from "./PricingTiersPanel";

const { Loader2, RefreshCw, Trash2, Pencil } = LucideIcons;

type SelectionProcess = {
  id: string;
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
  examStartDate: string | Date;
  examEndDate: string | Date;
};


type Feedback = { type: "success" | "error"; text: string } | null;

export default function SelectionProcessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [process, setProcess] = useState<SelectionProcess | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const [paymentSessionId, setPaymentSessionId] = useState("");

  const [exams, setExams] = useState<Exam[]>([]);
  const [examsLoading, setExamsLoading] = useState(false);

  const [examForm, setExamForm] = useState({
    name: "",
    examStartDate: "",
    examEndDate: "",
  });

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
      setProcess(data?.data || null);

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

  const paidCount = process?.paidCount ?? 0;
  const remainingCapacity = process?.remainingCapacity ?? Math.max((process?.maxCapacity ?? 0) - paidCount, 0);

  return (
    <main className="min-h-screen p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Processo seletivo</h1>
          <p className="text-sm text-muted-foreground">Detalhe e contagem de vagas</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded border px-3 py-2"
          onClick={async () => {
            if (!process?.id) return;
            await load(process.id);
          }}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? "Carregando" : "Atualizar"}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded border p-4">
          <div className="text-sm text-muted-foreground">Vagas (máx.)</div>
          <div className="mt-1 text-2xl font-semibold">{process?.maxCapacity ?? "—"}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-muted-foreground">Ocupação (PAID)</div>
          <div className="mt-1 text-2xl font-semibold">{paidCount}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-muted-foreground">Restantes</div>
          <div className="mt-1 text-2xl font-semibold">{remainingCapacity}</div>
        </div>
      </div>

      {loading && (
        <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={16} />
          Carregando...
        </div>
      )}

      {!loading && feedback && (
        <div
          className={
            "mt-6 rounded border p-3 text-sm " +
            (feedback.type === "success" ? "border-green-500/50" : "border-red-500/50")
          }
        >
          {feedback.text}
        </div>
      )}

      {!loading && process && (
        <div className="mt-6 rounded border p-4">
<div className="text-sm font-semibold">Reconciliar pagamento com o Mercado Pago</div>
          <label className="mt-3 block text-sm">ID da sessão de pagamento
            <input value={paymentSessionId} onChange={e => setPaymentSessionId(e.target.value)}
              className="mt-1 block w-full rounded border px-3 py-2" />
          </label>
          <button type="button" disabled={!paymentSessionId || loading} className="mt-4 rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
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
        </div>
      )}

      {!loading && process && (
        <div className="mt-6 rounded border p-4">
          <div className="text-sm font-semibold">Ligas acadêmicas (exames)</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Gerencie os exames/ligações que o usuário verá para se inscrever.
          </div>

          <div className="mt-4">
            {examsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={16} className="animate-spin" /> Carregando ligas...
              </div>
            ) : (
              <div className="grid gap-3">
                {(exams ?? []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhuma liga cadastrada.</div>
                ) : (
                  (exams ?? []).map((ex) => (
                    <div key={ex.id} className="rounded border bg-white p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-sm font-medium">{ex.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">ID: <span className="break-all">{ex.id}</span></div>
                          <div className="mt-2 text-xs">
                            <div className="text-muted-foreground">Início</div>
                            <div>{new Date(ex.examStartDate).toLocaleString()}</div>
                          </div>
                          <div className="mt-2 text-xs">
                            <div className="text-muted-foreground">Fim</div>
                            <div>{new Date(ex.examEndDate).toLocaleString()}</div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2 md:mt-0">
                          <button
                            type="button"
                            className="rounded border p-2 text-slate-700 hover:bg-slate-50"
                            onClick={() => {
                              setEditingExamId(ex.id);
                              const start = ex.examStartDate instanceof Date ? ex.examStartDate : new Date(ex.examStartDate);
                              const end = ex.examEndDate instanceof Date ? ex.examEndDate : new Date(ex.examEndDate);
                              setExamForm({
                                name: ex.name,
                                examStartDate: toLocalDateTime(start),
                                examEndDate: toLocalDateTime(end),
                              });
                            }}
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm"
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

          <div className="mt-6 rounded border bg-slate-50 p-4">
            <div className="text-sm font-semibold">{editingExamId ? "Editar liga" : "Nova liga"}</div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="md:col-span-1">
                <div className="text-xs text-muted-foreground">name</div>
                <input
                  value={examForm.name}
                  onChange={(e) => setExamForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  placeholder="Ex: Liga de Química"
                />
              </label>

              <label className="md:col-span-1">
                <div className="text-xs text-muted-foreground">examStartDate</div>
                <input
                  type="datetime-local"
                  value={examForm.examStartDate}
                  onChange={(e) => setExamForm((f) => ({ ...f, examStartDate: e.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                />
              </label>

              <label className="md:col-span-1">
                <div className="text-xs text-muted-foreground">examEndDate</div>
                <input
                  type="datetime-local"
                  value={examForm.examEndDate}
                  onChange={(e) => setExamForm((f) => ({ ...f, examEndDate: e.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                onClick={async () => {
                  if (!process.id) return;
                  setFeedback(null);
                  try {
                    const payload = {
                      name: examForm.name,
                      examStartDate: examForm.examStartDate
                        ? new Date(examForm.examStartDate).toISOString()
                        : null,
                      examEndDate: examForm.examEndDate
                        ? new Date(examForm.examEndDate).toISOString()
                        : null,
                    };

                    if (!payload.name || !payload.examStartDate || !payload.examEndDate) {
                      setFeedback({ type: "error", text: "Preencha name e datas." });
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
                      if (!res.ok) throw new Error(data?.error || "Falha ao editar liga.");
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
                      if (!res.ok) throw new Error(data?.error || "Falha ao criar liga.");
                    }

                    setEditingExamId(null);
                    setExamForm({ name: "", examStartDate: "", examEndDate: "" });
                    await loadExams(process.id);
                    setFeedback({ type: "success", text: "Liga salva." });
                  } catch (e) {
                    setFeedback({ type: "error", text: e instanceof Error ? e.message : "Falha" });
                  }
                }}
              >
                {editingExamId ? "Salvar edição" : "Criar liga"}
              </button>

              {editingExamId && (
                <button
                  type="button"
                  className="rounded border px-3 py-2 text-sm"
                  onClick={() => {
                    setEditingExamId(null);
                    setExamForm({ name: "", examStartDate: "", examEndDate: "" });
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>

          {confirmDeleteExam && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-md rounded border bg-white p-4">
                <div className="text-sm font-semibold">Confirmar apagar</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Isso vai remover a liga da inscrição do usuário e devolver crédito.
                </div>

                <div className="mt-3 rounded border bg-slate-50 p-3 text-sm">
                  <div className="text-xs text-muted-foreground">ID</div>
                  <div className="break-all">{confirmDeleteExam.id}</div>
                  <div className="mt-2 text-xs text-muted-foreground">Nome</div>
                  <div>{confirmDeleteExam.name}</div>
                  <div className="mt-2 text-xs text-muted-foreground">Início</div>
                  <div>{new Date(confirmDeleteExam.examStartDate).toLocaleString()}</div>
                  <div className="mt-2 text-xs text-muted-foreground">Fim</div>
                  <div>{new Date(confirmDeleteExam.examEndDate).toLocaleString()}</div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded border px-3 py-2 text-sm"
                    onClick={() => setConfirmDeleteExam(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="rounded bg-red-600 px-3 py-2 text-sm text-white"
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
                          setExamForm({ name: "", examStartDate: "", examEndDate: "" });
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
        </div>
      )}

      {!loading && process?.id && <PricingTiersPanel selectionProcessId={process.id} />}

    </main>
  );
}
