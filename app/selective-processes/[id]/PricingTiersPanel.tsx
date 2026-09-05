"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Plus, Save, Trash2 } from "lucide-react";

type TierRow = { examsCount: string; unitTotalPrice: string };

type Feedback = { type: "success" | "error"; text: string } | null;

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Tabela de preços por quantidade de ligas.
 *
 * O checkout do candidato calcula o valor a partir daqui — sem nenhuma faixa
 * cadastrada as inscrições ficam bloqueadas com PRICING_NOT_CONFIGURED.
 */
export default function PricingTiersPanel({ selectionProcessId }: { selectionProcessId: string }) {
  const [rows, setRows] = useState<TierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(
        `/api/admin/selective-processes/selection-processes/${selectionProcessId}/pricing-tiers`,
        { cache: "no-store" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao carregar as faixas de preço.");

      const tiers = Array.isArray(data?.data) ? data.data : [];
      setRows(
        tiers.map((tier: { examsCount: number; unitTotalPrice: number }) => ({
          examsCount: String(tier.examsCount),
          unitTotalPrice: String(tier.unitTotalPrice),
        })),
      );
    } catch (e) {
      setFeedback({ type: "error", text: e instanceof Error ? e.message : "Falha ao carregar." });
    } finally {
      setLoading(false);
    }
  }, [selectionProcessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateRow = (index: number, patch: Partial<TierRow>) => {
    setRows((previous) => previous.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);

    const parsed = rows.map((row) => ({
      examsCount: Number(row.examsCount),
      unitTotalPrice: Number(String(row.unitTotalPrice).replace(",", ".")),
    }));

    if (parsed.length === 0) {
      setFeedback({ type: "error", text: "Cadastre ao menos a faixa de 1 liga." });
      setSaving(false);
      return;
    }
    if (
      parsed.some(
        (tier) =>
          !Number.isInteger(tier.examsCount) ||
          tier.examsCount < 1 || tier.examsCount > 4 ||
          !Number.isFinite(tier.unitTotalPrice) ||
          tier.unitTotalPrice <= 0,
      )
    ) {
      setFeedback({ type: "error", text: "Quantidade precisa ser inteira (mín. 1) e o valor não pode ser negativo." });
      setSaving(false);
      return;
    }
    if (new Set(parsed.map((tier) => tier.examsCount)).size !== parsed.length) {
      setFeedback({ type: "error", text: "Há duas faixas com a mesma quantidade de ligas." });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/admin/selective-processes/selection-processes/${selectionProcessId}/pricing-tiers`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pricingTiers: parsed }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao salvar as faixas de preço.");

      await load();
      setFeedback({ type: "success", text: "Tabela de preços salva." });
    } catch (e) {
      setFeedback({ type: "error", text: e instanceof Error ? e.message : "Falha ao salvar." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 rounded border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Faixas de preço</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Valor total da inscrição conforme a quantidade de ligas escolhidas. Sem faixa exata, o sistema
            multiplica o valor de 1 liga.
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRows((previous) => [...previous, { examsCount: "", unitTotalPrice: "" }])}
          className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm"
        >
          <Plus size={16} /> Nova faixa
        </button>
      </div>

      {!loading && rows.length === 0 && (
        <div className="mt-4 flex items-start gap-2 rounded border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-none" />
          Nenhuma faixa cadastrada: as inscrições deste processo seletivo estão bloqueadas até salvar ao menos
          a faixa de 1 liga.
        </div>
      )}

      {feedback && (
        <div
          className={
            "mt-4 rounded border p-3 text-sm " +
            (feedback.type === "success" ? "border-green-500/50" : "border-red-500/50")
          }
        >
          {feedback.text}
        </div>
      )}

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Carregando faixas...
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {rows.map((row, index) => {
            const preview = Number(String(row.unitTotalPrice).replace(",", "."));

            return (
              <div key={index} className="grid grid-cols-1 items-end gap-3 rounded border bg-white p-3 md:grid-cols-[1fr_1fr_auto]">
                <label>
                  <div className="text-xs text-muted-foreground">Quantidade de ligas</div>
                  <input
                    type="number"
                    min={1} max={4}
                    step={1}
                    value={row.examsCount}
                    onChange={(e) => updateRow(index, { examsCount: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                    placeholder="ex: 2"
                  />
                </label>

                <label>
                  <div className="text-xs text-muted-foreground">Valor total (R$)</div>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={row.unitTotalPrice}
                    onChange={(e) => updateRow(index, { unitTotalPrice: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                    placeholder="ex: 90"
                  />
                  {Number.isFinite(preview) && row.unitTotalPrice !== "" && (
                    <div className="mt-1 text-xs text-muted-foreground">{formatCurrency(preview)}</div>
                  )}
                </label>

                <button
                  type="button"
                  onClick={() => setRows((previous) => previous.filter((_, i) => i !== index))}
                  className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm text-red-600"
                  title="Remover faixa"
                >
                  <Trash2 size={16} /> Remover
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || loading}
        className="mt-4 inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Salvar tabela
      </button>

      <p className="mt-2 text-xs text-muted-foreground">
        Salvar substitui a tabela inteira: as faixas que não estiverem na lista acima são apagadas.
      </p>
    </div>
  );
}
