/**
 * Ouvidoria: o site do aluno (dadg-site-principal, lib/ouvidoria*.ts) grava nas coleções `ouvidoria`
 * e `ouvidoria_anexos`; aqui o painel lista, muda o andamento e publica a resposta.
 * Os rótulos e valores precisam ser os mesmos dos dois lados.
 */
export const COLECAO = "ouvidoria";
export const COLECAO_ANEXOS = "ouvidoria_anexos";

export const TIPOS = [
  { value: "reclamacao", label: "Reclamação" },
  { value: "sugestao", label: "Sugestão" },
  { value: "elogio", label: "Elogio" },
  { value: "denuncia", label: "Denúncia" },
  { value: "solicitacao", label: "Solicitação" },
] as const;

export const CATEGORIAS = [
  { value: "eventos", label: "Eventos" },
  { value: "certificados", label: "Certificados" },
  { value: "financeiro", label: "Financeiro" },
  { value: "estrutura", label: "Estrutura e campus" },
  { value: "curso", label: "Coordenação e professores" },
  { value: "turma", label: "Turma" },
  { value: "diretoria", label: "Diretoria do DADG" },
  { value: "outros", label: "Outros" },
] as const;

export const STATUS = [
  { value: "recebida", label: "Recebida" },
  { value: "em_analise", label: "Em análise" },
  { value: "respondida", label: "Respondida" },
  { value: "encerrada", label: "Encerrada" },
] as const;

export type Status = (typeof STATUS)[number]["value"];

export const RESPOSTA_MAX = 4000;
export const NOTA_MAX = 2000;

const existe = (lista: readonly { value: string }[], v: unknown): v is string =>
  typeof v === "string" && lista.some((x) => x.value === v);

export const statusValido = (v: unknown): v is Status => existe(STATUS, v);
export const tipoValido = (v: unknown) => existe(TIPOS, v);
export const categoriaValida = (v: unknown) => existe(CATEGORIAS, v);

const rotulo = (lista: readonly { value: string; label: string }[], v: string) => lista.find((x) => x.value === v)?.label ?? v;
export const rotuloTipo = (v: string) => rotulo(TIPOS, v);
export const rotuloCategoria = (v: string) => rotulo(CATEGORIAS, v);
export const rotuloStatus = (v: string) => rotulo(STATUS, v);

export type Atualizacao = { status: Status; resposta: string | null; nota: string | null };

/** Valida o PATCH do painel. `resposta`/`nota` ausentes = não mexe; string vazia = apaga. */
export function validarAtualizacao(body: unknown): { ok: true; dados: Atualizacao } | { ok: false; erro: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (!statusValido(b.status)) return { ok: false, erro: "Andamento inválido." };
  const texto = (v: unknown, max: number, nome: string) => {
    if (v === undefined || v === null) return { ok: true as const, valor: null };
    if (typeof v !== "string") return { ok: false as const, erro: `${nome} inválida.` };
    const t = v.replace(/\r\n?/g, "\n").trim();
    if (t.length > max) return { ok: false as const, erro: `${nome} passou de ${max} caracteres.` };
    return { ok: true as const, valor: t };
  };
  const resposta = texto(b.resposta, RESPOSTA_MAX, "Resposta");
  if (!resposta.ok) return { ok: false, erro: resposta.erro };
  const nota = texto(b.nota, NOTA_MAX, "Anotação");
  if (!nota.ok) return { ok: false, erro: nota.erro };
  if (b.status === "respondida" && !resposta.valor)
    return { ok: false, erro: "Para marcar como respondida, escreva a resposta pública." };
  return { ok: true, dados: { status: b.status, resposta: resposta.valor, nota: nota.valor } };
}

/** Filtro da listagem a partir da query string (só valores conhecidos). */
export function filtroDaBusca(q: URLSearchParams): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  const status = q.get("status");
  const tipo = q.get("tipo");
  const categoria = q.get("categoria");
  if (status === "abertas") f.status = { $in: ["recebida", "em_analise"] };
  else if (statusValido(status)) f.status = status;
  if (tipoValido(tipo)) f.tipo = tipo;
  if (categoriaValida(categoria)) f.categoria = categoria;
  const protocolo = (q.get("protocolo") || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  // Trecho do protocolo, com ou sem traços. O padrão só tem [0-9A-Z] e "-?": sem regex injetada.
  if (protocolo.length >= 4) f.protocolo = { $regex: protocolo.slice(0, 20).split("").join("-?") };
  return f;
}
