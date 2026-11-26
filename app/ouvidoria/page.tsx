"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, EyeOff, Inbox, Search, UserRound } from "lucide-react";
import { CATEGORIAS, NOTA_MAX, RESPOSTA_MAX, rotuloCategoria, rotuloStatus, rotuloTipo, STATUS, TIPOS, type Status } from "@/lib/ouvidoria";

type Item = {
  _id: string;
  protocolo: string;
  tipo: string;
  categoria: string;
  mensagem: string;
  anonimo: boolean;
  identificacao: { nome: string; email: string; turma: string } | null;
  status: Status;
  anexo: { id: string; nome: string; tipo: string; tamanho: number } | null;
  resposta: { texto: string; em: string; por?: string } | null;
  notaInterna?: { texto: string; em: string; por?: string } | null;
  historico: { status: Status; em: string; por?: string }[];
  criadaEm: string;
  atualizadaEm: string;
};

type Resposta = { data: Item[]; paginacao: { pagina: number; total: number; paginas: number }; abertas: number };

const data = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

const COR: Record<Status, string> = {
  recebida: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  em_analise: "bg-blue-500/15 text-blue-200 border-blue-500/30",
  respondida: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  encerrada: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

const seletor = "rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500";

export default function OuvidoriaAdmin() {
  const [filtros, setFiltros] = useState({ status: "abertas", tipo: "", categoria: "", protocolo: "" });
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState<Resposta | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    const q = new URLSearchParams({ pagina: String(pagina) });
    for (const [k, v] of Object.entries(filtros)) if (v) q.set(k, v);
    const r = await fetch(`/api/v1/admin/ouvidoria?${q}`, { cache: "no-store" });
    if (!r.ok) throw new Error("Não foi possível carregar as manifestações.");
    setLista(await r.json());
  }, [filtros, pagina]);

  useEffect(() => {
    setErro("");
    void carregar().catch((e) => setErro(e.message));
  }, [carregar]);

  const mudarFiltro = (k: keyof typeof filtros, v: string) => {
    setPagina(1);
    setFiltros((f) => ({ ...f, [k]: v }));
  };

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-24 text-slate-100 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Ouvidoria</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manifestações enviadas em dadg.com.br/ouvidoria. A resposta pública aparece para quem consulta pelo protocolo; a anotação interna fica só aqui.
          </p>
        </div>
        {lista ? (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-200">
            {lista.abertas} {lista.abertas === 1 ? "aberta" : "abertas"}
          </span>
        ) : null}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select aria-label="Andamento" className={seletor} value={filtros.status} onChange={(e) => mudarFiltro("status", e.target.value)}>
          <option value="abertas">Abertas (recebida + em análise)</option>
          <option value="">Todas</option>
          {STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select aria-label="Tipo" className={seletor} value={filtros.tipo} onChange={(e) => mudarFiltro("tipo", e.target.value)}>
          <option value="">Todos os tipos</option>
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select aria-label="Assunto" className={seletor} value={filtros.categoria} onChange={(e) => mudarFiltro("categoria", e.target.value)}>
          <option value="">Todos os assuntos</option>
          {CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <label className="relative">
          <span className="sr-only">Protocolo</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
          <input
            className={`${seletor} w-full pl-9 font-mono uppercase`}
            placeholder="Protocolo"
            value={filtros.protocolo}
            onChange={(e) => mudarFiltro("protocolo", e.target.value)}
          />
        </label>
      </div>

      {erro ? <p className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{erro}</p> : null}

      <ul className="mt-6 space-y-3">
        {lista?.data.map((item) => (
          <li key={item._id} className="rounded-2xl border border-slate-800 bg-slate-900/60">
            <button
              type="button"
              onClick={() => setAberta(aberta === item._id ? null : item._id)}
              aria-expanded={aberta === item._id}
              className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 text-left sm:px-5"
            >
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${COR[item.status]}`}>{rotuloStatus(item.status)}</span>
              <span className="font-mono text-sm text-slate-300">{item.protocolo}</span>
              <span className="text-sm font-semibold">{rotuloTipo(item.tipo)}</span>
              <span className="text-sm text-slate-400">{rotuloCategoria(item.categoria)}</span>
              <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                {item.anonimo ? <EyeOff className="h-3.5 w-3.5" aria-label="Anônima" /> : <UserRound className="h-3.5 w-3.5" aria-label="Identificada" />}
                {data(item.criadaEm)}
              </span>
              <span className="w-full truncate text-sm text-slate-400">{item.mensagem}</span>
            </button>
            {aberta === item._id ? <Detalhe item={item} aoSalvar={carregar} /> : null}
          </li>
        ))}
      </ul>

      {lista && !lista.data.length ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-center text-slate-400">
          <Inbox className="h-10 w-10" aria-hidden />
          <p>Nenhuma manifestação com esses filtros.</p>
        </div>
      ) : null}

      {lista && lista.paginacao.paginas > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-4 text-sm text-slate-400">
          <button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className="rounded-lg border border-slate-700 p-2 disabled:opacity-40" aria-label="Página anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          Página {lista.paginacao.pagina} de {lista.paginacao.paginas} · {lista.paginacao.total} no total
          <button
            type="button"
            disabled={pagina >= lista.paginacao.paginas}
            onClick={() => setPagina((p) => p + 1)}
            className="rounded-lg border border-slate-700 p-2 disabled:opacity-40"
            aria-label="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </main>
  );
}

function Detalhe({ item, aoSalvar }: { item: Item; aoSalvar: () => Promise<void> }) {
  const [status, setStatus] = useState<Status>(item.status === "recebida" ? "em_analise" : item.status);
  const [resposta, setResposta] = useState(item.resposta?.texto ?? "");
  const [nota, setNota] = useState(item.notaInterna?.texto ?? "");
  const [estado, setEstado] = useState<"livre" | "salvando" | "salvo">("livre");
  const [erro, setErro] = useState("");

  async function salvar() {
    setEstado("salvando");
    setErro("");
    const r = await fetch(`/api/v1/admin/ouvidoria/${item._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resposta, nota }),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) {
      setEstado("livre");
      setErro(d.error || "Falha de conexão.");
      return;
    }
    setEstado("salvo");
    await aoSalvar().catch(() => undefined);
  }

  return (
    <div className="space-y-5 border-t border-slate-800 px-4 py-5 sm:px-5">
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Quem enviou</p>
          {item.identificacao ? (
            <p className="mt-1">
              {item.identificacao.nome}
              <br />
              <a className="text-blue-300 underline" href={`mailto:${encodeURIComponent(item.identificacao.email)}?subject=${encodeURIComponent(`Ouvidoria DADG - ${item.protocolo}`)}`}>
                {item.identificacao.email}
              </a>
              {item.identificacao.turma ? <span className="text-slate-400"> · {item.identificacao.turma}</span> : null}
            </p>
          ) : (
            <p className="mt-1 text-slate-400">Anônima. Só dá para responder pela resposta pública.</p>
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Andamento</p>
          <ul className="mt-1 space-y-0.5 text-slate-300">
            {item.historico.map((h, i) => (
              <li key={i}>
                {rotuloStatus(h.status)} · {data(h.em)}
                {h.por ? <span className="text-slate-500"> · {h.por}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500">Manifestação</p>
        <p className="mt-1 whitespace-pre-wrap break-words rounded-xl bg-slate-950/60 p-4 text-[15px] leading-7">{item.mensagem}</p>
        {item.anexo ? (
          <a
            href={`/api/v1/admin/ouvidoria/${item._id}/anexo`}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-blue-200 hover:bg-slate-800"
          >
            <Download className="h-4 w-4" aria-hidden /> Baixar anexo ({item.anexo.nome}, {(item.anexo.tamanho / 1024 / 1024).toFixed(1)} MB)
          </a>
        ) : null}
      </div>

      <div className="grid gap-4">
        <label className="block text-sm">
          <span className="font-semibold">Andamento</span>
          <select className={`${seletor} mt-1 block w-full sm:w-64`} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-semibold">Resposta pública</span>
          <span className="ml-2 text-xs text-slate-500">aparece para quem consulta o protocolo</span>
          <textarea
            className={`${seletor} mt-1 block min-h-32 w-full leading-6`}
            maxLength={RESPOSTA_MAX}
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            placeholder="Ex.: Obrigado pelo aviso. Conversamos com a coordenação e..."
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">Anotação interna</span>
          <span className="ml-2 text-xs text-slate-500">só a diretoria vê</span>
          <textarea
            className={`${seletor} mt-1 block min-h-20 w-full leading-6`}
            maxLength={NOTA_MAX}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </label>
      </div>

      {erro ? <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{erro}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={estado === "salvando"}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {estado === "salvando" ? "Salvando..." : "Salvar"}
        </button>
        {estado === "salvo" ? <span className="text-sm text-emerald-300">Salvo.</span> : null}
      </div>
    </div>
  );
}
