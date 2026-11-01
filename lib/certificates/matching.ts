import { isValidCpf } from "@/lib/profile/validation";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * CPF de um certificado como o acervo guardou: texto em qualquer formato ou
 * número. Planilhas antigas perderam zeros à esquerda; com 9 ou 10 dígitos o
 * valor é completado com zeros e só vale se o dígito verificador conferir.
 */
export function certificateCpf(value: unknown) {
  const raw =
    typeof value === "number" && Number.isSafeInteger(value) ? String(value)
    : typeof value === "string" && !value.includes("@") ? value.replace(/\D/g, "")
    : "";
  const cpf = raw.length === 9 || raw.length === 10 ? raw.padStart(11, "0") : raw;
  return cpf.length === 11 && isValidCpf(cpf) ? cpf : "";
}

/**
 * Filtro que acha o CPF do perfil em qualquer forma em que o acervo o guardou,
 * inclusive no campo do e-mail (planilhas com as colunas trocadas).
 * Use só com o driver nativo (`Model.collection.find`): o cast do Mongoose
 * transforma o ramo numérico em texto, porque `ownerCpf` é String no schema.
 */
export function cpfSearchFilter(cpf: string) {
  const core = cpf.replace(/^0+/, "");
  const zeros = cpf.length - core.length;
  const pattern = `^\\D*${zeros ? `(?:0\\D*){0,${zeros}}` : ""}${[...core].join("\\D*")}\\D*$`;
  return {
    $or: [
      { ownerCpf: { $regex: pattern } },
      { ownerCpf: Number(cpf) },
      { ownerEmail: { $regex: pattern } },
      { ownerEmail: Number(cpf) },
    ],
  };
}

/** Nome comparável: sem acento, minúsculo e com espaços simples. */
export function normalizeName(value: unknown) {
  return typeof value === "string"
    ? value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim()
    : "";
}

/** E-mail comparável, ou vazio quando não tem formato de e-mail. */
export function normalizeEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return EMAIL.test(email) ? email : "";
}

export function canAutoLink(
  certificate: { ownerCpf?: unknown; ownerEmail?: unknown },
  cpf: string,
  email: string,
) {
  const sourceCpf = certificateCpf(certificate.ownerCpf);
  const target = normalizeEmail(email);
  return sourceCpf !== "" && sourceCpf === cpf && target !== "" && normalizeEmail(certificate.ownerEmail) === target;
}

const PARTICLES = new Set(["de", "da", "do", "dos", "das", "e"]);

/**
 * Chave de nome para comparar pessoas: sem acento, caixa, pontuação e as
 * partículas de/da/do/dos/das/e ("Zambiazi da Sá" e "Zambiazi de Sa" batem).
 */
export function nameKey(value: unknown) {
  return typeof value === "string"
    ? value
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^a-z]+/g, " ")
        .split(" ")
        .filter((token) => token && !PARTICLES.has(token))
        .join(" ")
    : "";
}

/**
 * Duas chaves de `nameKey` que podem ser da mesma pessoa quando uma é a outra
 * abreviada: ambas com nome e sobrenome, mesmo primeiro nome e as palavras da
 * menor aparecendo, na ordem, na maior ("Ana Souza" e "Ana Maria Souza").
 * Só serve para conferir o acervo de um CPF já conhecido; nunca vincula sozinho.
 */
export function abbreviatedNameMatch(a: string, b: string) {
  const x = a.split(" ").filter(Boolean);
  const y = b.split(" ").filter(Boolean);
  if (x.length < 2 || y.length < 2 || x[0] !== y[0]) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  let at = 0;
  for (const token of short) {
    while (at < long.length && long[at] !== token) at += 1;
    if (at === long.length) return false;
    at += 1;
  }
  return true;
}

/**
 * Pessoas citadas no nome do certificado. Trabalho em conjunto vem como
 * "Ana Souza e Bia Lima" (ou com vírgula, ponto e vírgula, barra, &): cada
 * parte com nome e sobrenome conta como um dono. O nome inteiro também vale,
 * para "João e Silva" continuar sendo uma pessoa só.
 */
export function ownerNames(value: unknown) {
  const raw = typeof value === "string" ? value : "";
  const parts = raw
    .split(/\s+(?:e|&)\s+|[,;/]/i)
    .map(nameKey)
    .filter((key) => key.split(" ").length >= 2);
  const joint = parts.length >= 2;
  return { joint, keys: [...new Set([nameKey(raw), ...(joint ? parts : [])])].filter(Boolean) };
}

/** CPFs e e-mails do certificado, procurados nos dois campos (colunas trocadas). */
export function certificateEvidence(certificate: { ownerCpf?: unknown; ownerEmail?: unknown; ownerName?: unknown }) {
  const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
  return {
    cpfs: unique([certificateCpf(certificate.ownerCpf), certificateCpf(certificate.ownerEmail)]),
    emails: unique([normalizeEmail(certificate.ownerEmail), normalizeEmail(certificate.ownerCpf)]),
    ...ownerNames(certificate.ownerName),
  };
}

const INSTITUTIONAL = "aluno.imepac.edu.br";

/**
 * E-mails do aluno conhecidos pelo perfil: o da conta, o de contato, o
 * institucional atual (RA@) e o antigo (primeironome.ultimosobrenome@).
 * Nenhum é verificado; sem CPF no certificado eles só valem junto com o nome.
 */
export function profileEmails(
  profile: { name?: unknown; registrationNumber?: unknown; contactEmail?: unknown },
  accountEmail: unknown,
) {
  const tokens = nameKey(profile.name).split(" ");
  const ra = typeof profile.registrationNumber === "string" ? profile.registrationNumber.replace(/\D/g, "") : "";
  return new Set(
    [
      normalizeEmail(accountEmail),
      normalizeEmail(profile.contactEmail),
      ra.length >= 5 ? `${ra}@${INSTITUTIONAL}` : "",
      tokens.length >= 2 ? `${tokens[0]}.${tokens[tokens.length - 1]}@${INSTITUTIONAL}` : "",
    ].filter(Boolean),
  );
}
