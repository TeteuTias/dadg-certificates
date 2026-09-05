"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as LucideIcons from "lucide-react";

const { Loader2, Plus, ShieldCheck, Trash2 } = LucideIcons;

type SelectionProcess = {
  id: string;
  registrationStartDate: string | Date;
  registrationEndDate: string | Date;
  maxExamsPerApplication: number;
  maxCapacity: number;
};

type Feedback = { type: "success" | "error"; text: string } | null;

export default function SelectiveProcessesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    registrationStartDate: "",
    registrationEndDate: "",
    maxExamsPerApplication: "",
    maxCapacity: "",
  });
  const [items, setItems] = useState<SelectionProcess[] | null>(null);
  const [loading, setLoading] = useState(true);
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
    <main className="min-h-screen p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Processos seletivos</h1>
          <p className="text-sm text-muted-foreground">Crie editais, gerencie vagas e lance notas.</p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-white"
          onClick={() => {
            setForm({
              registrationStartDate: "",
              registrationEndDate: "",
              maxExamsPerApplication: "",
              maxCapacity: "",
            });
            setCreateOpen(true);
          }}
        >
          <Plus size={16} />
          Novo
        </button>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded border bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Novo processo seletivo</div>
                <div className="mt-1 text-xs text-muted-foreground">Esboço simples para criação via admin</div>
              </div>
              <button
                type="button"
                className="rounded border px-2 py-1 text-sm"
                onClick={() => setCreateOpen(false)}
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label>
                <div className="text-xs text-muted-foreground">registrationStartDate (ISO)</div>
                <input
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={form.registrationStartDate}
                  onChange={(e) => setForm((f) => ({ ...f, registrationStartDate: e.target.value }))}
                  placeholder="2026-09-01T00:00:00Z"
                />
              </label>

              <label>
                <div className="text-xs text-muted-foreground">registrationEndDate (ISO)</div>
                <input
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={form.registrationEndDate}
                  onChange={(e) => setForm((f) => ({ ...f, registrationEndDate: e.target.value }))}
                  placeholder="2026-09-30T23:59:59Z"
                />
              </label>

              <label>
                <div className="text-xs text-muted-foreground">Máximo de ligas por inscrição (1 a 4)</div>
                <input
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  min={1} max={4} step={1}
                  value={form.maxExamsPerApplication}
                  onChange={(e) => setForm((f) => ({ ...f, maxExamsPerApplication: e.target.value }))}
                  placeholder="3"
                />
              </label>

              <label>
                <div className="text-xs text-muted-foreground">maxCapacity</div>
                <input
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={form.maxCapacity}
                  onChange={(e) => setForm((f) => ({ ...f, maxCapacity: e.target.value }))}
                  placeholder="50"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                disabled={loading}
                onClick={async () => {
                  setFeedback(null);

                  const { registrationStartDate, registrationEndDate, maxExamsPerApplication, maxCapacity } = form;

                  if (!registrationStartDate || !registrationEndDate || !maxExamsPerApplication || !maxCapacity) {
                    setFeedback({ type: 'error', text: 'Campos obrigatórios.' });
                    return;
                  }

                  const maxExamsPerApplicationNum = Number(maxExamsPerApplication);
                  const maxCapacityNum = Number(maxCapacity);

                  if (!Number.isFinite(maxExamsPerApplicationNum) || !Number.isFinite(maxCapacityNum)) {
                    setFeedback({ type: 'error', text: 'maxExamsPerApplication e maxCapacity devem ser números.' });
                    return;
                  }

                  try {
                    const res = await fetch('/api/admin/selective-processes/selection-processes', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        registrationStartDate,
                        registrationEndDate,
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
                  }
                }}
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Carregando...
          </div>
        ) : feedback ? (
          <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm">
            {feedback.text}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(items ?? []).map((p) => (
              <article key={p.id} className="rounded border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Edital</div>
                    <div className="mt-1 text-xs text-muted-foreground">ID: {p.id}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs rounded bg-slate-100 px-2 py-1">
                    <ShieldCheck size={14} /> ADM
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Início inscrição</div>
                    <div className="font-medium">{new Date(p.registrationStartDate).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Fim inscrição</div>
                    <div className="font-medium">{new Date(p.registrationEndDate).toLocaleDateString()}</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Provas/aplicação</div>
                    <div className="font-medium">{p.maxExamsPerApplication}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Vagas (PAID)</div>
                    <div className="font-medium">{p.maxCapacity}</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/selective-processes/${p.id}`}
                    className="rounded bg-slate-900 px-3 py-2 text-white text-sm"
                  >
                    Gerenciar ligas
                  </Link>

                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm"
                    onClick={async () => {
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
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        OBS.: navegação detalhada e estão em: selective-processes/id.
      </p>
    </main>
  );
}
