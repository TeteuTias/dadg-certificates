"use client";

import { useEffect, useMemo, useState } from "react";
import * as LucideIcons from "lucide-react";

const { Loader2, RefreshCw } = LucideIcons;

type SelectionProcess = {
  id: string;
  registrationStartDate: string | Date;
  registrationEndDate: string | Date;
  maxExamsPerApplication: number;
  maxCapacity: number;
  paidCount?: number;
  remainingCapacity?: number;
};

type TicketPaymentStatus = "PENDING" | "PAID" | "CANCELED";

type TicketUpdateResponse = { ticketId: string; paymentStatus: TicketPaymentStatus };

type Feedback = { type: "success" | "error"; text: string } | null;

export default function SelectionProcessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [process, setProcess] = useState<SelectionProcess | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const [ticketIdToUpdate, setTicketIdToUpdate] = useState("");
  const [newStatus, setNewStatus] = useState<TicketPaymentStatus>("PAID");

  const id = useMemo(() => {
    // params is a Promise; we unwrap in effect.
    return null as null | string;
  }, []);

  async function load(pId: string) {
    setFeedback(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/selective-processes/selection-processes/${pId}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao carregar processo.");
      setProcess(data?.data || null);
    } catch (e) {
      setFeedback({ type: "error", text: e instanceof Error ? e.message : "Falha ao carregar" });
    } finally {
      setLoading(false);
    }
  }

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
  }, [params]);

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
          <div className="text-sm font-semibold">Atualizar paymentStatus (mock)</div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="md:col-span-2">
              <div className="text-xs text-muted-foreground">ticketId</div>
              <input
                value={ticketIdToUpdate}
                onChange={(e) => setTicketIdToUpdate(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                placeholder="ex: 64f..."
              />
            </label>
            <label>
              <div className="text-xs text-muted-foreground">paymentStatus</div>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as TicketPaymentStatus)}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              >
                <option value="PENDING">PENDING</option>
                <option value="PAID">PAID</option>
                <option value="CANCELED">CANCELED</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            className="mt-4 inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
            disabled={!ticketIdToUpdate}
            onClick={async () => {
              if (!process.id) return;
              setFeedback(null);
              try {
                const res = await fetch(
                  `/api/admin/selective-processes/tickets/${ticketIdToUpdate}/payment-status`,
                  {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ paymentStatus: newStatus }),
                  }
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data?.error || "Falha ao atualizar ticket.");
                const updated = data?.data as TicketUpdateResponse | undefined;
                if (!updated) throw new Error("Resposta inválida.");
                await load(process.id);
                setFeedback({ type: "success", text: "Ticket atualizado. Contagem recarregada." });
              } catch (e) {
                setFeedback({ type: "error", text: e instanceof Error ? e.message : "Falha" });
              }
            }}
          >
            Aplicar
          </button>
        </div>
      )}
    </main>
  );
}
