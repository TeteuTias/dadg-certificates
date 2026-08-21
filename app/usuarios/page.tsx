"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";
import "./usuarios.css";

type Row = {
  id: string;
  name: string;
  period: number;
  cpfMasked: string;
  complete: boolean;
  privacyAccepted: boolean;
  updatedAt: string;
};

type Payload = {
  data: Row[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
  totals: {
    profiles: number;
    privacyAccepted: number;
    privacyRequired: number;
  };
};

const empty: Payload = {
  data: [],
  pagination: { page: 1, pageSize: 20, total: 0, pages: 1 },
  totals: { profiles: 0, privacyAccepted: 0, privacyRequired: 0 },
};

export default function UsuariosPage() {
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("");
  const [completeness, setCompleteness] = useState("");
  const [lgpd, setLgpd] = useState("");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<Payload>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/v1/admin/profiles/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            search,
            period: period ? Number(period) : undefined,
            completeness,
            lgpd,
            page,
            pageSize: 20,
          }),
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error || "Não foi possível carregar os perfis.",
          );
        setPayload(result);
      } catch (caught) {
        if ((caught as Error).name !== "AbortError")
          setError((caught as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, period, completeness, lgpd, page]);

  const resetPage = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <main className="users-admin-shell">
      <section className="users-admin-hero">
        <span className="users-admin-eyebrow">Gestão administrativa</span>
        <div className="users-admin-title-row">
          <div>
            <h1>Usuários do site DADG</h1>
            <p>
              Somente perfis criados pelo próprio aluno. E-mails não são
              armazenados nem exibidos aqui.
            </p>
          </div>
          <UsersRound aria-hidden size={42} />
        </div>
      </section>

      <section className="users-admin-stats" aria-label="Totais de perfis">
        <Stat
          label="Perfis"
          value={payload.totals.profiles}
          icon={<UsersRound size={20} />}
        />
        <Stat
          label="LGPD vigente"
          value={payload.totals.privacyAccepted}
          icon={<ShieldCheck size={20} />}
        />
        <Stat
          label="Aceite necessário"
          value={payload.totals.privacyRequired}
          icon={<ShieldAlert size={20} />}
        />
      </section>

      <section className="users-admin-panel">
        <div className="users-admin-filters">
          <label className="users-search">
            <span className="sr-only">Buscar por nome ou CPF exato</span>
            <Search size={18} aria-hidden />
            <input
              value={search}
              onChange={(event) => resetPage(setSearch, event.target.value)}
              placeholder="Nome ou CPF exato"
            />
          </label>
          <Filter
            label="Período"
            value={period}
            onChange={(value) => resetPage(setPeriod, value)}
          >
            <option value="">Todos</option>
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}º período
              </option>
            ))}
          </Filter>
          <Filter
            label="Completude"
            value={completeness}
            onChange={(value) => resetPage(setCompleteness, value)}
          >
            <option value="">Todos</option>
            <option value="complete">Completo</option>
            <option value="incomplete">Incompleto</option>
          </Filter>
          <Filter
            label="LGPD"
            value={lgpd}
            onChange={(value) => resetPage(setLgpd, value)}
          >
            <option value="">Todos</option>
            <option value="current">Vigente</option>
            <option value="required">Aceite necessário</option>
          </Filter>
        </div>

        {error ? (
          <div className="users-admin-error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="users-admin-table-wrap" aria-busy={loading}>
          <table className="users-admin-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Período</th>
                <th>Cadastro</th>
                <th>LGPD</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="users-admin-empty">
                    Carregando perfis...
                  </td>
                </tr>
              ) : null}
              {!loading && !payload.data.length ? (
                <tr>
                  <td colSpan={6} className="users-admin-empty">
                    <UserRoundSearch size={28} />
                    Nenhum perfil encontrado.
                  </td>
                </tr>
              ) : null}
              {!loading &&
                payload.data.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                    </td>
                    <td>{row.cpfMasked}</td>
                    <td>{row.period}º</td>
                    <td>
                      <Badge ok={row.complete}>
                        {row.complete ? "Completo" : "Incompleto"}
                      </Badge>
                    </td>
                    <td>
                      <Badge ok={row.privacyAccepted}>
                        {row.privacyAccepted ? "Vigente" : "Pendente"}
                      </Badge>
                    </td>
                    <td>
                      <Link
                        href={`/usuarios/${row.id}`}
                        className="users-admin-link"
                      >
                        Ver detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="users-admin-pagination">
          <p>{payload.pagination.total} resultado(s)</p>
          <div>
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1}
              aria-label="Página anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              Página {page} de {payload.pagination.pages}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage((value) =>
                  Math.min(payload.pagination.pages, value + 1),
                )
              }
              disabled={page >= payload.pagination.pages}
              aria-label="Próxima página"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <article>
      <div>{icon}</div>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="users-admin-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}
function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`users-admin-badge ${ok ? "is-ok" : "is-pending"}`}>
      {children}
    </span>
  );
}
