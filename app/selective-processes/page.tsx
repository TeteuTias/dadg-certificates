"use client";

import { useEffect, useState } from "react";
import * as LucideIcons from "lucide-react";

const { Loader2, Plus, ShieldCheck } = LucideIcons;

type SelectionProcess = {
  id: string;
  registrationStartDate: string | Date;
  registrationEndDate: string | Date;
  maxExamsPerApplication: number;
  maxCapacity: number;
};

type Feedback = { type: "success" | "error"; text: string } | null;

export default function SelectiveProcessesPage() {
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
            // futuro: navegar para create
          }}
        >
          <Plus size={16} />
          Novo
        </button>
      </div>

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

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="rounded bg-slate-900 px-3 py-2 text-white text-sm"
                    onClick={() => {
                      // futuro: navegar para /selective-processes/[id]
                    }}
                  >
                    Abrir
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Obs.: navegação detalhada e criação serão adicionadas nas próximas etapas.
      </p>
    </main>
  );
}
