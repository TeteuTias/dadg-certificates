"use client";
import { useCallback, useEffect, useState } from "react";
const SOURCES: Record<string, string> = {
  manual: "Pedido do aluno",
  automatic: "Automático: CPF e e-mail verificado",
  "automatic-name-cpf": "Automático: CPF e nome completo (e-mail diferente)",
};
type Claim = {
  _id: string;
  message?: string;
  source?: string;
  reason?: string;
  profile?: { name: string; registrationNumber?: string };
  certificate?: {
    ownerName: string;
    eventName: string;
    ownerEmail: string;
    ownerCpf: string;
  };
};
export default function Claims() {
  const [items, setItems] = useState<Claim[]>([]);
  const [status, setStatus] = useState("PENDING");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(
      `/api/v1/admin/certificate-claims?status=${status}${source ? `&source=${source}` : ""}`,
    );
    if (!r.ok) throw new Error("Falha ao carregar solicitações");
    setItems((await r.json()).data);
  }, [status, source]);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  async function review(id: string, decision: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        `/api/v1/admin/certificate-claims/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: decision, reason: reason[id] }),
        },
      );
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">Vínculos de certificados</h1>
      <p>
        Confirme documentos ou registros de participação. Nome igual não
        comprova titularidade.
      </p>
      <label>
        Estado{" "}
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {["PENDING", "APPROVED", "REJECTED", "REVOKED"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>{" "}
      <label>
        Origem{" "}
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Todas</option>
          {Object.entries(SOURCES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {items.map((c) => (
        <section className="my-5 rounded border p-5" key={c._id}>
          <h2>
            {c.profile?.name} — RA{" "}
            {c.profile?.registrationNumber || "não informado"}
          </h2>
          <p>
            {c.certificate?.eventName} / {c.certificate?.ownerName}
          </p>
          <p>
            {c.certificate?.ownerEmail} / {c.certificate?.ownerCpf}
          </p>
          <p>Origem: {SOURCES[c.source || "manual"] || c.source}</p>
          {c.message && <p>Solicitação: {c.message}</p>}
          {c.reason && <p>Motivo registrado: {c.reason}</p>}
          <label>
            Fundamento da decisão
            <textarea
              minLength={10}
              maxLength={1000}
              className="block w-full border p-2"
              value={reason[c._id] || ""}
              onChange={(e) =>
                setReason({ ...reason, [c._id]: e.target.value })
              }
            />
          </label>
          {(status === "PENDING"
            ? ["APPROVED", "REJECTED"]
            : status === "APPROVED"
              ? ["REVOKED"]
              : []
          ).map((d) => (
            <button
              className="m-2 rounded border p-2"
              disabled={busy || (reason[c._id] || "").trim().length < 10}
              key={d}
              onClick={() => void review(c._id, d)}
            >
              {
                {
                  APPROVED: "Aprovar",
                  REJECTED: "Rejeitar",
                  REVOKED: "Revogar vínculo",
                }[d]
              }
            </button>
          ))}
        </section>
      ))}
    </main>
  );
}
