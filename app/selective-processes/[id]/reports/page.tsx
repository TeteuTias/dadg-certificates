"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type {
  ImportKind,
  ImportPreview,
  ReportExam,
  ReportSnapshot,
} from "@/lib/selective-processes/reports/types";

type Summary = {
  total: number;
  pendingChoices: number;
  revision: number;
  config: ReportSnapshot["config"];
  exams: ReportExam[];
  missingProfiles: Array<{
    applicationId: string;
    name: string;
    missingFields: string[];
  }>;
  duplicateRegistrations: string[];
  counts: Array<{ examId: string; count: number }>;
};
const input =
  "clam-input mt-2";
const button =
  "clam-button clam-button-primary";
const errors: Record<string, string> = {
  IMPORT_PREVIEW_STALE:
    "Os dados mudaram depois da prévia. Confira novamente o arquivo.",
  IMPORT_HAS_ERRORS: "Corrija os erros indicados antes de confirmar.",
  FILE_TOO_LARGE: "Limite: arquivo de 10 MB e 50 mil linhas.",
  INVALID_XLSX: "Envie um arquivo Excel .xlsx válido.",
  IMPORT_FORMULA_NOT_ALLOWED:
    "A planilha contém fórmulas. Cole somente os valores antes de importar.",
  IMPORT_IDENTIFIER_MUST_BE_TEXT:
    "Matrículas e identificadores precisam estar no formato Texto, preservando zeros iniciais.",
  IMPORT_WRONG_PROCESS: "O arquivo pertence a outro processo seletivo.",
  INVALID_IMPORT_HEADERS:
    "Colunas inválidas. Use o modelo disponibilizado nesta página.",
  REPORT_STORAGE_SETUP_REQUIRED:
    "A preparação da área de relatórios ainda precisa ser aplicada pelo responsável pelo sistema.",
  QUESTION_COUNT_BELOW_SCORES:
    "Existem notas maiores que o novo total de questões.",
  DUPLICATE_OR_INVALID_ACRONYM:
    "As siglas devem ser únicas e conter até 30 letras, números, hífen ou sublinhado.",
  INVALID_REPORT_DATES: "Confira as datas dos dias de prova.",
  INVALID_REPORT_SETTINGS: "Confira siglas, vagas e quantidade de questões.",
  EMPTY_IMPORT: "O arquivo não possui linhas de dados.",
};
const fields: Record<string, string> = {
  name: "nome",
  cpf: "CPF",
  period: "período",
  registrationNumber: "matrícula",
  birthDate: "nascimento",
  phone: "telefone",
  contactEmail: "e-mail",
};
async function json(response: Response) {
  const data = await response.json();
  if (!response.ok)
    throw new Error(errors[data.error] || data.error || "Falha na operação.");
  return data;
}

export default function ReportsPage() {
  const { id } = useParams<{ id: string }>();
  const base = `/api/admin/selective-processes/selection-processes/${id}/reports`;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [config, setConfig] = useState<ReportSnapshot["config"]>({
    mode: "dates",
    day1: "",
    day2: "",
  });
  const [exams, setExams] = useState<ReportExam[]>([]);
  const [kind, setKind] = useState<ImportKind>("scores");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [operationId, setOperationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const data: Summary = await json(
      await fetch(`${base}/summary`, { cache: "no-store" }),
    );
    setSummary(data);
    setConfig(data.config);
    setExams(data.exams);
  }, [base]);
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, [load]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na operação.");
    } finally {
      setBusy(false);
    }
  };
  const download = (query: string, template = false) =>
    run(async () => {
      const response = await fetch(
        `${base}/${template ? "template" : "export"}?${query}`,
        { cache: "no-store" },
      );
      if (!response.ok) await json(response);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `clam-${id}-${new URLSearchParams(query).get("kind")}.xlsx`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  const upload = (confirm: boolean) =>
    run(async () => {
      if (!file) throw new Error("Selecione o arquivo .xlsx.");
      if (
        !file.name.toLowerCase().endsWith(".xlsx") ||
        file.size > 10 * 1024 * 1024
      )
        throw new Error("Envie um arquivo .xlsx de até 10 MB.");
      const form = new FormData();
      form.set("file", file);
      form.set("kind", kind);
      if (confirm && preview) form.set("previewHash", preview.hash);
      const data = await json(
        await fetch(`${base}/${confirm ? "confirm" : "preview"}`, {
          method: "POST",
          body: form,
          headers: confirm ? { "Idempotency-Key": operationId } : {},
        }),
      );
      if (confirm) {
        setMessage(
          `${data.applied} alterações salvas. ${data.ignored} linhas sem alteração.`,
        );
        setPreview(null);
        await load();
      } else {
        setPreview(data);
        setOperationId(crypto.randomUUID());
      }
    });
  const save = () =>
    run(async () => {
      await json(
        await fetch(`${base}/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revision: summary?.revision,
            config,
            exams: exams.map(({ id, acronym, seats, questionCount }) => ({
              id,
              acronym,
              seats,
              questionCount,
            })),
          }),
        }),
      );
      await load();
      setPreview(null);
      setMessage("Configuração salva.");
    });
  const unassigned = exams.filter((e) =>
    config.mode === "file"
      ? !e.reportDay
      : ![config.day1, config.day2].includes(e.date),
  );
  return (
    <main className="clam-shell space-y-6">
      <Link
        href={`/selective-processes/${id}`}
        className="clam-button w-fit"
      >
        Voltar ao processo
      </Link>
      <header className="clam-hero">
        <p className="clam-kicker">Operação da seleção</p>
        <h1 className="mt-2 text-3xl font-black text-white">Relatórios e correção</h1>
        <p className="clam-muted mt-2">
          Listas de candidatos com pagamento aprovado e direito ativo nas
          provas.
        </p>
      </header>
      {message && (
        <p
          role="status"
          className="clam-feedback clam-feedback-success"
        >
          {message}
        </p>
      )}
      {!summary ? (
        <p className="clam-panel">Carregando relatórios...</p>
      ) : (
        <>
          <section className="clam-panel">
            <h2 className="font-semibold">Conferência antes do download</h2>
            <p className="my-3">
              {summary.total} inscrições válidas · {summary.pendingChoices}{" "}
              ainda sem provas escolhidas · {summary.missingProfiles.length}{" "}
              cadastros incompletos
            </p>
            {!!summary.missingProfiles.length && (
              <details>
                <summary>Ver pendências cadastrais</summary>
                <ul className="mt-3 space-y-2">
                  {summary.missingProfiles.map((c) => (
                    <li key={c.applicationId}>
                      {c.name}:{" "}
                      {c.missingFields.map((f) => fields[f] || f).join(", ")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {!!summary.duplicateRegistrations.length && (
              <p className="mt-3 text-amber-200">
                Matrículas duplicadas:{" "}
                {summary.duplicateRegistrations.join(", ")}. A importação dessas
                notas será bloqueada.
              </p>
            )}
            <button
              className={`${button} mt-3`}
              disabled={busy}
              onClick={() => run(load)}
            >
              Atualizar conferência
            </button>
          </section>
          <section className="clam-panel space-y-4">
            <h2 className="font-semibold">Dias, vagas e questões</h2>
            <label className="block max-w-sm">
              Separação dos dias
              <select
                className={input}
                value={config.mode}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    mode: e.target.value as "dates" | "file",
                  })
                }
              >
                <option value="dates">
                  Pelas datas cadastradas (Brasília)
                </option>
                <option value="file">Pelo arquivo de dias importado</option>
              </select>
            </label>
            {config.mode === "dates" && (
              <div className="flex flex-wrap gap-4">
                {(["day1", "day2"] as const).map((field, i) => (
                  <label key={field}>
                    Data do {i + 1}º dia
                    <input
                      type="date"
                      className={input}
                      value={config[field]}
                      onChange={(e) =>
                        setConfig({ ...config, [field]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
            )}
            {!!unassigned.length && (
              <p className="text-amber-200">
                Sem dia definido:{" "}
                {unassigned.map((e) => e.acronym || e.name).join(", ")}. Essas
                provas não aparecerão nas listas dos dias 1 e 2.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left">
                <thead>
                  <tr>
                    {[
                      "Prova",
                      "Sigla",
                      "Inscritos",
                      "Vagas na liga",
                      "Questões",
                      "Dia importado",
                    ].map((h) => (
                      <th key={h} className="p-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exams.map((exam, i) => (
                    <tr key={exam.id} className="border-t">
                      <td className="p-2">
                        {exam.name}
                        <div className="text-xs text-blue-100">
                          {exam.date.split("-").reverse().join("/")}
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          aria-label={`Sigla ${exam.name}`}
                          className={input}
                          maxLength={30}
                          value={exam.acronym}
                          onChange={(e) =>
                            setExams((all) =>
                              all.map((x, n) =>
                                n === i ? { ...x, acronym: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        {summary.counts.find((c) => c.examId === exam.id)
                          ?.count || 0}
                      </td>
                      <td className="p-2">
                        <input
                          aria-label={`Vagas ${exam.name}`}
                          type="number"
                          min={0}
                          step={1}
                          className={input}
                          value={exam.seats ?? ""}
                          placeholder="Não informado"
                          onChange={(e) =>
                            setExams((all) =>
                              all.map((x, n) =>
                                n === i
                                  ? {
                                      ...x,
                                      seats:
                                        e.target.value === ""
                                          ? null
                                          : Number(e.target.value),
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          aria-label={`Questões ${exam.name}`}
                          type="number"
                          min={1}
                          max={1000}
                          step={1}
                          className={input}
                          value={exam.questionCount}
                          onChange={(e) =>
                            setExams((all) =>
                              all.map((x, n) =>
                                n === i
                                  ? {
                                      ...x,
                                      questionCount: Number(e.target.value),
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="p-2">{exam.reportDay || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className={button} disabled={busy} onClick={save}>
              Salvar configuração
            </button>
            <p className="text-sm text-blue-100">
              Vagas por liga representam vagas de aprovação. A capacidade de
              inscrições permanece independente.
            </p>
          </section>
          <section className="clam-panel space-y-4">
            <h2 className="font-semibold">Baixar planilhas</h2>
            <p className="text-sm">
              Os downloads usam a configuração salva. A relação geral inclui CPF
              e contato; as listas por dia e por liga levam somente os campos
              necessários.
            </p>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  ["all", "Todas as inscrições"],
                  ["day1", "Provas 1º dia"],
                  ["day2", "Provas 2º dia"],
                  ["counts", "Inscritos por liga"],
                  ["registrations", "Matrículas por prova"],
                  ["scores", "Correção — todas as ligas"],
                ] as const
              ).map(([kind, label]) => (
                <button
                  className={button}
                  key={kind}
                  disabled={busy}
                  onClick={() => download(`kind=${kind}`)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {exams.map((e) => (
                <button
                  key={e.id}
                  className="rounded-lg border px-3 py-2"
                  disabled={busy}
                  onClick={() => download(`kind=scores&examId=${e.id}`)}
                >
                  Correção: {e.acronym || e.name}
                </button>
              ))}
            </div>
          </section>
          <section className="clam-panel space-y-4">
            <h2 className="font-semibold">Importar arquivo</h2>
            <p>
              Use os modelos. Na correção, preencha somente a coluna Nota com
              acertos inteiros. Célula vazia não altera a nota; zero representa
              zero acertos.
            </p>
            <label className="block max-w-sm">
              Tipo de importação
              <select
                className={input}
                value={kind}
                disabled={busy}
                onChange={(e) => {
                  setKind(e.target.value as ImportKind);
                  setPreview(null);
                }}
              >
                <option value="scores">Notas de correção</option>
                <option value="days">Dias das provas</option>
                <option value="seats">Vagas por liga</option>
              </select>
            </label>
            {kind !== "scores" && (
              <button
                className="rounded-lg border px-4 py-2"
                disabled={busy}
                onClick={() => download(`kind=${kind}`, true)}
              >
                Baixar modelo
              </button>
            )}
            <label className="block">
              Arquivo Excel (até 10 MB)
              <input
                className={`${input} mt-2`}
                type="file"
                accept=".xlsx"
                disabled={busy}
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setPreview(null);
                }}
              />
            </label>
            <button
              className={button}
              disabled={busy || !file}
              onClick={() => upload(false)}
            >
              {busy ? "Processando..." : "Conferir arquivo"}
            </button>
            {preview && (
              <div className="space-y-3 border-t pt-4">
                <h3 className="font-semibold">
                  Prévia — {preview.changes.length} alterações ·{" "}
                  {preview.ignored} sem alteração · {preview.errors.length}{" "}
                  erros
                </h3>
                {!!preview.errors.length && (
                  <ul
                    role="alert"
                    className="max-h-64 overflow-auto text-rose-200"
                  >
                    {preview.errors.map((e, i) => (
                      <li key={i}>
                        {e.sheet}, linha {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="max-h-80 overflow-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th>Aba / linha</th>
                        <th>Candidato / prova</th>
                        <th>Anterior</th>
                        <th>Novo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.changes.map((c, i) => (
                        <tr key={i} className="border-t">
                          <td className="py-2">
                            {c.sheet} / {c.row}
                          </td>
                          <td className="px-3">
                            {c.candidateName && <div>{c.candidateName}</div>}
                            <div className="text-sm text-blue-100">
                              {c.examName}
                            </div>
                          </td>
                          <td>{c.before ?? "Não informado"}</td>
                          <td>{c.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  className={button}
                  disabled={
                    busy || !!preview.errors.length || !preview.changes.length
                  }
                  onClick={() => upload(true)}
                >
                  Confirmar e salvar {preview.changes.length} alterações
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
