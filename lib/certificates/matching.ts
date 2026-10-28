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
    : typeof value === "string" ? value.replace(/\D/g, "")
    : "";
  const cpf = raw.length === 9 || raw.length === 10 ? raw.padStart(11, "0") : raw;
  return cpf.length === 11 && isValidCpf(cpf) ? cpf : "";
}

/**
 * Filtro que acha o CPF do perfil em qualquer forma em que o acervo o guardou.
 * Use só com o driver nativo (`Model.collection.find`): o cast do Mongoose
 * transforma o ramo numérico em texto, porque `ownerCpf` é String no schema.
 */
export function cpfSearchFilter(cpf: string) {
  const core = cpf.replace(/^0+/, "");
  const zeros = cpf.length - core.length;
  const pattern = `^\\D*${zeros ? `(?:0\\D*){0,${zeros}}` : ""}${[...core].join("\\D*")}\\D*$`;
  return { $or: [{ ownerCpf: { $regex: pattern } }, { ownerCpf: Number(cpf) }] };
}

const validCpf = certificateCpf;

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

/**
 * Vínculo por CPF e nome completo quando o e-mail do certificado é outro. O
 * CPF é a prova; o nome completo idêntico (sem acento, caixa e espaços extras)
 * substitui a conferência do e-mail. Nome de uma palavra só não basta.
 */
export function canLinkByNameAndCpf(
  certificate: { ownerCpf?: unknown; ownerName?: unknown },
  cpf: string,
  profileName: unknown,
) {
  const name = normalizeName(profileName);
  return (
    cpf !== "" &&
    validCpf(certificate.ownerCpf) === cpf &&
    name.split(" ").length >= 2 &&
    normalizeName(certificate.ownerName) === name
  );
}

/**
 * O CPF só vincula por nome quando o acervo não tem sinal de dado trocado:
 * todos os certificados desse CPF trazem o mesmo nome e nenhum dos seus
 * e-mails aparece com outro CPF válido.
 */
export function cpfIsConsistent(
  sameCpf: Array<{ ownerName?: unknown }>,
  sharingEmails: Array<{ ownerCpf?: unknown }>,
  cpf: string,
) {
  const names = new Set(sameCpf.map((c) => normalizeName(c.ownerName)).filter(Boolean));
  if (names.size > 1) return false;
  return !sharingEmails.some((c) => {
    const other = validCpf(c.ownerCpf);
    return other !== "" && other !== cpf;
  });
}
