"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as LucideIcons from "lucide-react";

const { ArrowRight, CalendarDays, Loader2, Plus, ShieldCheck, Trash2 } = LucideIcons;

type SelectionProcess = {
  id: string;
  title?: string;
  registrationStartDate: string | Date;
  registrationEndDate: string | Date;
  maxExamsPerApplication: number;
  maxCapacity: number;
};

type Feedback = { type: "success" | "error"; text: string } | null;

export default function SelectiveProcessesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    registrationStartDate: "",
    registrationEndDate: "",
    maxExamsPerApplication: "",
    maxCapacity: "",
  });
  const [items, setItems] = useState<SelectionProcess[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/api/admin/selective-processes/selection-processes", {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Falha ao carregar processos." );
        setItems(Array.isArray(data?.data) ? data.data : []);
      } catch (e) {
        setFeedback({ type: "error", text: e instanceof Error ? e.message : "Falha ao carregar" });
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  return (
    <main className="clam-shell space-y-6">
      <section className="clam-hero flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="clam-kicker">Coordenação de Ligas Acadêmicas</p>
          <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">Processos seletivos da CLAM</h1>
          <p className="clam-muted mt-2">Configure edições, ligas, preços, inscrições e relatórios em um só lugar.</p>
        </div>
        <button
          type="button"
          className="clam-button clam-button-primary"
          onClick={() => {
            setForm({
              title: "",
              registrationStartDate: "",
              registrationEndDate: "",
              maxExamsPerApplication: "",
              maxCapacity: "",
            });
            setCreateOpen(true);
          }}
        >
          <Plus size={16} />
          Novo processo
        </button>
      </section>

      {createOpen && (
        <div className="clam-modal-backdrop">
          <div className="clam-modal" role="dialog" aria-modal="true" aria-labelledby="new-process-title">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="clam-kicker">Nova edição</p>
                <h2 id="new-process-title" className="mt-2 text-2xl font-bold text-white">Novo processo seletivo</h2>
              </div>
              <button
                type="button"
                className="clam-button"
                onClick={() => setCreateOpen(false)}
              >
                Fechar
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="clam-label sm:col-span-2">Título do processo
                <input className="clam-input" value={form.title} maxLength={120} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex.: Processo Seletivo CLAM 2026.2" />
              </label>
              <label className="clam-label">Abertura das inscrições
                <input
                  type="datetime-local"
                  className="clam-input"
                  value={form.registrationStartDate}
                  onChange={(e) => setForm((f) => ({ ...f, registrationStartDate: e.target.value }))}
                />
              </label>

              <label className="clam-label">Encerramento das inscrições
                <input
                  type="datetime-local"
                  className="clam-input"
                  value={form.registrationEndDate}
                  onChange={(e) => setForm((f) => ({ ...f, registrationEndDate: e.target.value }))}
                />
              </label>

              <label className="clam-label">Máximo de ligas por candidato
                <input
                  type="number"
                  className="clam-input"
                  min={1} max={4} step={1}
                  value={form.maxExamsPerApplication}
                  onChange={(e) => setForm((f) => ({ ...f, maxExamsPerApplication: e.target.value }))}
                  placeholder="3"
                />
              </label>

              <label className="clam-label">Capacidade de inscrições
                <input
                  type="number" min={0} step={1}
                  className="clam-input"
                  value={form.maxCapacity}
                  onChange={(e) => setForm((f) => ({ ...f, maxCapacity: e.target.value }))}
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="clam-button clam-button-primary"
                disabled={saving}
                onClick={async () => {
                  setFeedback(null);

                  const { title, registrationStartDate, registrationEndDate, maxExamsPerApplication, maxCapacity } = form;

                  if (title.trim().length < 3 || !registrationStartDate || !registrationEndDate || !maxExamsPerApplication || maxCapacity === "") {
                    setFeedback({ type: 'error', text: 'Campos obrigatórios.' });
                    return;
                  }

                  const maxExamsPerApplicationNum = Number(maxExamsPerApplication);
                  const maxCapacityNum = Number(maxCapacity);

                  if (!Number.isInteger(maxExamsPerApplicationNum) || maxExamsPerApplicationNum < 1 || maxExamsPerApplicationNum > 4 || !Number.isInteger(maxCapacityNum) || maxCapacityNum < 0) {
                    setFeedback({ type: 'error', text: 'O limite de ligas deve ser um inteiro de 1 a 4 e a capacidade deve ser um inteiro igual ou maior que zero.' });
                    return;
                  }
                  if (new Date(registrationEndDate) <= new Date(registrationStartDate)) {
                    setFeedback({ type: 'error', text: 'O encerramento precisa ocorrer depois da abertura das inscrições.' });
                    return;
                  }

                  setSaving(true);
                  try {
                    const res = await fetch('/api/admin/selective-processes/selection-processes', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: title.trim(),
                        registrationStartDate: new Date(registrationStartDate).toISOString(),
                        registrationEndDate: new Date(registrationEndDate).toISOString(),
                        maxExamsPerApplication: maxExamsPerApplicationNum,
                        maxCapacity: maxCapacityNum,
                      }),
                    });

                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data?.error || 'Falha ao criar processo.');

                    const created = data?.data;
                    if (created?.id) {
                      setItems((prev) => (prev ? [created, ...prev] : [created]));
                    }

                    setFeedback({ type: 'success', text: 'Processo criado.' });
                    setCreateOpen(false);
                  } catch (e) {
                    setFeedback({ type: 'error', text: e instanceof Error ? e.message : 'Falha' });
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Criando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div role="status" className={`clam-feedback ${feedback.type === "success" ? "clam-feedback-success" : "clam-feedback-error"}`}>
          {feedback.text}
        </div>
      )}

      <section>
        {loading ? (
          <div className="clam-panel flex min-h-48 items-center justify-center gap-2 text-sm">
            <Loader2 size={16} className="animate-spin" /> Carregando...
          </div>
        ) : (items ?? []).length === 0 ? (
          <div className="clam-panel py-14 text-center">
            <CalendarDays className="mx-auto text-blue-400" size={34} />
            <h2 className="mt-4 text-xl font-bold text-white">Nenhum processo criado</h2>
            <p className="clam-muted mt-2">Crie uma edição para configurar ligas e preços.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(items ?? []).map((p) => (
              <article key={p.id} className="clam-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="clam-kicker">Edição CLAM</p>
                    <h2 className="mt-2 text-xl font-bold text-white">{p.title?.trim() || `Processo seletivo CLAM ${new Date(p.registrationStartDate).getFullYear()}`}</h2>
                  </div>
                  <span className="inline-flex h-fit items-center gap-1 rounded-full border border-blue-400/25 bg-blue-500/10 px-2 py-1 text-xs text-blue-200">
                    <ShieldCheck size={14} /> ADM
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="clam-muted text-xs">Abertura</div>
                    <div className="font-medium text-slate-100">{new Date(p.registrationStartDate).toLocaleString("pt-BR")}</div>
                  </div>
                  <div>
                    <div className="clam-muted text-xs">Encerramento</div>
                    <div className="font-medium text-slate-100">{new Date(p.registrationEndDate).toLocaleString("pt-BR")}</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="clam-muted text-xs">Ligas por candidato</div>
                    <div className="font-medium text-slate-100">Até {p.maxExamsPerApplication}</div>
                  </div>
                  <div>
                    <div className="clam-muted text-xs">Capacidade</div>
                    <div className="font-medium text-slate-100">{p.maxCapacity} inscrições</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/selective-processes/${p.id}`}
                    className="clam-button clam-button-primary"
                  >
                    Gerenciar <ArrowRight size={16} />
                  </Link>

                  <button
                    type="button"
                    className="clam-button clam-button-danger"
                    onClick={async () => {
                      if (!window.confirm(`Excluir ${p.title || "este processo seletivo"}? Esta ação só será aceita se não houver inscrições ou cobranças.`)) return;
                      setFeedback(null);
                      try {
                        const res = await fetch(
                          `/api/admin/selective-processes/selection-processes/${p.id}`,
                          { method: "DELETE" }
                        );
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data?.error === "PROCESS_HAS_ENROLLMENTS" ? "Este processo possui inscrições ou cobranças vinculadas e não pode ser excluído." : data?.error || "Falha ao deletar.");
                        setItems((prev) => (prev ? prev.filter((x) => x.id !== p.id) : prev));
                        setFeedback({ type: "success", text: "Processo deletado." });
                      } catch (e) {
                        setFeedback({ type: "error", text: e instanceof Error ? e.message : "Falha" });
                      }
                    }}
                  >
                    <Trash2 size={14} />
                    Deletar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
