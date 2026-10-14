"use client";
import { useCallback, useEffect, useState } from "react";
const SOURCES: Record<string, string> = {
  manual: "Pedido do aluno",
  automatic: "Automático: CPF e e-mail verificado",
  "automatic-name-cpf": "Automático: CPF e nome completo (e-mail diferente)",
};
const LABELS: Record<string, string> = {
  APPROVED: "Aprovar",
  REJECTED: "Rejeitar",
  REVOKED: "Revogar vínculo",
};
type Claim = {
  _id: string;
  profileId: string;
  message?: string;
  evidenceEmail?: string;
  evidenceEmailMatches?: boolean | null;
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

  // Revisão agrupada por pessoa: a mesma decisão e fundamento valem para cada pedido do grupo.
  async function review(ids: string[], decision: string, text: string) {
    setBusy(true);
    setError("");
    const failures: string[] = [];
    for (const id of ids) {
      const r = await fetch(
        `/api/v1/admin/certificate-claims/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: decision, reason: text }),
        },
      ).catch(() => null);
      const body = r ? await r.json().catch(() => ({})) : {};
      if (!r?.ok) failures.push(body.error || "Falha de conexão.");
    }
    if (failures.length)
      setError(`${failures.length} de ${ids.length} não foram salvos: ${failures[0]}`);
    await load().catch((e) => setError(e.message));
    setBusy(false);
  }

  const decisions =
    status === "PENDING" ? ["APPROVED", "REJECTED"] : status === "APPROVED" ? ["REVOKED"] : [];
  const groups = new Map<string, Claim[]>();
  for (const c of items) groups.set(c.profileId, [...(groups.get(c.profileId) || []), c]);

  const reasonField = (key: string, label: string) => (
    <label>
      {label}
      <textarea
        minLength={10}
        maxLength={1000}
        className="block w-full border p-2"
        value={reason[key] || ""}
        onChange={(e) => setReason({ ...reason, [key]: e.target.value })}
      />
    </label>
  );
  const buttons = (key: string, ids: string[], suffix = "") =>
    decisions.map((d) => (
      <button
        className="m-2 rounded border p-2"
        disabled={busy || (reason[key] || "").trim().length < 10}
        key={d}
        onClick={() => void review(ids, d, (reason[key] || "").trim())}
      >
        {LABELS[d]}
        {suffix}
      </button>
    ));

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">Vínculos de certificados</h1>
      <p>
        Confirme documentos ou registros de participação. Nome igual não
        comprova titularidade. Os pedidos aparecem agrupados por pessoa; cada
        certificado precisa ter evidência própria antes de aprovar o grupo.
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
      {[...groups.entries()].map(([profileId, claims]) => (
        <section className="my-6 rounded border p-5" key={profileId}>
          <h2 className="text-lg font-semibold">
            {claims[0].profile?.name} — RA{" "}
            {claims[0].profile?.registrationNumber || "não informado"} ·{" "}
            {claims.length} {claims.length === 1 ? "certificado" : "certificados"}
          </h2>
          {claims.map((c) => (
            <article className="my-4 rounded border p-4" key={c._id}>
              <p>
                {c.certificate?.eventName} / {c.certificate?.ownerName}
              </p>
              <p>
                {c.certificate?.ownerEmail} / {c.certificate?.ownerCpf}
              </p>
              <p>Origem: {SOURCES[c.source || "manual"] || c.source}</p>
              {c.evidenceEmail && (
                <p>
                  E-mail informado pelo aluno: {c.evidenceEmail} —{" "}
                  {c.evidenceEmailMatches
                    ? "confere com o do certificado"
                    : "diferente do certificado"}
                </p>
              )}
              {c.message && <p>Solicitação: {c.message}</p>}
              {c.reason && <p>Motivo registrado: {c.reason}</p>}
              {reasonField(c._id, "Fundamento da decisão")}
              {buttons(c._id, [c._id])}
            </article>
          ))}
          {claims.length > 1 && decisions.length > 0 && (
            <div className="mt-2 border-t pt-3">
              {reasonField(`grupo:${profileId}`, "Fundamento para todos desta pessoa")}
              {buttons(
                `grupo:${profileId}`,
                claims.map((c) => c._id),
                ` todos (${claims.length})`,
              )}
            </div>
          )}
        </section>
      ))}
    </main>
  );
}
