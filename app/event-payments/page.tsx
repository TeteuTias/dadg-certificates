"use client";
import { useEffect, useState } from "react";
type Order = {
  _id: string;
  eventId: string;
  title: string;
  status: string;
  amountCents: number;
  reviewReason?: string;
};
export default function Payments() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const r = await fetch(
      "/api/v1/admin/event-payments" + window.location.search,
    );
    if (!r.ok) throw new Error("Falha ao carregar cobranças");
    setOrders((await r.json()).data);
  }
  useEffect(() => {
    void load().catch((e) => setMessage(e.message));
  }, []);
  async function reconcile(o: Order) {
    setBusy(true);
    try {
      const r = await fetch(
        `/api/v1/events/${o.eventId}/payments/${o._id}/reconcile`,
        { method: "POST" },
      );
      const data = await r.json();
      setMessage(r.ok ? "Pagamento conferido com o provedor." : data.error);
      await load();
    } catch {
      setMessage("Conciliação indisponível. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">Pagamentos de eventos</h1>
      <p>
        A conciliação consulta o Mercado Pago e encerra reservas vencidas. Para
        uma cobrança paga, efetue o estorno no provedor e depois concilie;
        presença e certificados exigem revisão manual.
      </p>
      {message && <p role="status">{message}</p>}
      {orders.map((o) => (
        <section key={o._id} className="my-4 rounded border p-4">
          <h2>{o.title}</h2>
          <p>
            {o.status} —{" "}
            {(o.amountCents / 100).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
          {o.reviewReason && <p>{o.reviewReason}</p>}
          <button
            disabled={busy}
            onClick={() => void reconcile(o)}
            className="rounded border p-3"
          >
            Conferir no provedor
          </button>
        </section>
      ))}
    </main>
  );
}
