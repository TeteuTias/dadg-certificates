import { isValidCpf } from "@/lib/profile/validation";
import { normalizeEmail, normalizeName as normalizedName } from "./matching";

/**
 * Contagem da qualidade do acervo para o vínculo automático. Recebe os
 * certificados um a um e devolve só agregados: nenhum CPF, e-mail ou nome
 * sai daqui. Espelha `canAutoLink`, a regra por CPF e nome e a busca de
 * `/api/v1/user/certificates/link`.
 */
export type AcervoDoc = {
  ownerCpf?: unknown;
  ownerEmail?: unknown;
  ownerName?: unknown;
  isReady?: unknown;
  profileId?: unknown;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createAcervoAudit() {
  const count = {
    total: 0,
    liberados: 0,
    jaVinculados: 0,
    semDonoLiberados: 0,
    cpfAusenteOuIlegivel: 0,
    cpfSemOnzeDigitos: 0,
    cpfDigitoVerificadorInvalido: 0,
    cpfValido: 0,
    cpfValidoEmFormatoQueABuscaNaoAcha: 0,
    emailAusente: 0,
    emailInvalido: 0,
    emailValido: 0,
    emailValidoComEspacosNasPontas: 0,
    aptosPelaRegra: 0,
    aptosEEncontraveisPelaBusca: 0,
  };
  const hipoteses = {
    cpfGravadoComoNumero: 0,
    cpfRecuperavelComZerosAEsquerda: 0,
    emailInvalidoSemArroba: 0,
    emailInvalidoComMaisDeUmValorNoCampo: 0,
    emailInvalidoSemPontoNoDominio: 0,
    emailInvalidoOutro: 0,
  };
  const byCpf = new Map<string, { emails: Set<string>; names: Set<string>; certificates: number }>();
  const cpfsByEmail = new Map<string, Set<string>>();
  // Espelho da conferência da regra por CPF e nome na rota de vínculo, sobre o acervo inteiro.
  const searchableByCpf = new Map<string, { names: Set<string>; emails: Set<string> }>();
  const validCpfsByEmail = new Map<string, Set<string>>();
  const nameRuleCandidates = new Map<string, number>();

  function add(doc: AcervoDoc) {
    count.total++;
    if (doc.isReady === true) count.liberados++;
    if (doc.profileId) count.jaVinculados++;

    const anyRaw = typeof doc.ownerCpf === "string" ? doc.ownerCpf : "";
    const anyCpf = anyRaw.replace(/\D/g, "");
    const anyEmail = normalizeEmail(doc.ownerEmail);
    if (anyCpf.length === 11 && isValidCpf(anyCpf)) {
      const anyFormatted = anyCpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
      if (anyRaw === anyCpf || anyRaw === anyFormatted) {
        const entry = searchableByCpf.get(anyCpf) ?? { names: new Set<string>(), emails: new Set<string>() };
        const name = normalizedName(doc.ownerName);
        if (name) entry.names.add(name);
        if (anyEmail) entry.emails.add(anyEmail);
        searchableByCpf.set(anyCpf, entry);
      }
      if (anyEmail) validCpfsByEmail.set(anyEmail, (validCpfsByEmail.get(anyEmail) ?? new Set<string>()).add(anyCpf));
    }

    // O vínculo automático só considera certificado liberado e sem dono.
    if (doc.isReady !== true || doc.profileId) return;
    count.semDonoLiberados++;

    if (typeof doc.ownerCpf === "number") hipoteses.cpfGravadoComoNumero++;
    const looseDigits =
      typeof doc.ownerCpf === "number" ? String(Math.trunc(doc.ownerCpf)) : anyCpf;
    if ((looseDigits.length === 9 || looseDigits.length === 10) && isValidCpf(looseDigits.padStart(11, "0")))
      hipoteses.cpfRecuperavelComZerosAEsquerda++;

    const rawCpf = anyRaw;
    const cpf = anyCpf;
    let cpfOk = false;
    let cpfSearchable = false;
    if (!cpf) count.cpfAusenteOuIlegivel++;
    else if (cpf.length !== 11) count.cpfSemOnzeDigitos++;
    else if (!isValidCpf(cpf)) count.cpfDigitoVerificadorInvalido++;
    else {
      cpfOk = true;
      count.cpfValido++;
      const formatted = cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
      cpfSearchable = rawCpf === cpf || rawCpf === formatted;
      if (!cpfSearchable) count.cpfValidoEmFormatoQueABuscaNaoAcha++;
      else nameRuleCandidates.set(cpf, (nameRuleCandidates.get(cpf) ?? 0) + 1);
    }

    const rawEmail = typeof doc.ownerEmail === "string" ? doc.ownerEmail : "";
    const email = rawEmail.trim().toLowerCase();
    let emailOk = false;
    if (!email) count.emailAusente++;
    else if (!EMAIL.test(email)) {
      count.emailInvalido++;
      if (!email.includes("@")) hipoteses.emailInvalidoSemArroba++;
      else if (/[,;\s]/.test(email) || email.split("@").length > 2) hipoteses.emailInvalidoComMaisDeUmValorNoCampo++;
      else if (!email.split("@")[1].includes(".")) hipoteses.emailInvalidoSemPontoNoDominio++;
      else hipoteses.emailInvalidoOutro++;
    } else {
      emailOk = true;
      count.emailValido++;
      if (rawEmail !== rawEmail.trim()) count.emailValidoComEspacosNasPontas++;
    }

    if (!cpfOk || !emailOk) return;
    count.aptosPelaRegra++;
    if (cpfSearchable && rawEmail === rawEmail.trim()) count.aptosEEncontraveisPelaBusca++;

    const entry = byCpf.get(cpf) ?? { emails: new Set<string>(), names: new Set<string>(), certificates: 0 };
    entry.emails.add(email);
    const name = normalizedName(doc.ownerName);
    if (name) entry.names.add(name);
    entry.certificates++;
    byCpf.set(cpf, entry);
    const cpfs = cpfsByEmail.get(email) ?? new Set<string>();
    cpfs.add(cpf);
    cpfsByEmail.set(email, cpfs);
  }

  function result() {
    let cpfsComVariosEmails = 0;
    let certificadosDeCpfsComVariosEmails = 0;
    let cpfsComVariosNomes = 0;
    for (const entry of byCpf.values()) {
      if (entry.emails.size > 1) {
        cpfsComVariosEmails++;
        certificadosDeCpfsComVariosEmails += entry.certificates;
      }
      if (entry.names.size > 1) cpfsComVariosNomes++;
    }
    let emailsComVariosCpfs = 0;
    for (const cpfs of cpfsByEmail.values()) if (cpfs.size > 1) emailsComVariosCpfs++;

    // Teto da regra por CPF e nome: candidatos cujo CPF passa na conferência do acervo.
    // O vínculo ainda exige que o nome do perfil seja igual ao do certificado.
    let cpfsSemConflito = 0;
    let certificadosAlcancaveis = 0;
    for (const [cpf, certificates] of nameRuleCandidates) {
      const entry = searchableByCpf.get(cpf);
      const shared = [...(entry?.emails ?? [])].some((email) =>
        [...(validCpfsByEmail.get(email) ?? [])].some((other) => other !== cpf),
      );
      if ((entry?.names.size ?? 0) <= 1 && !shared) {
        cpfsSemConflito++;
        certificadosAlcancaveis += certificates;
      }
    }

    return {
      ...count,
      hipoteses,
      regraCpfENome: { cpfsSemConflito, certificadosAlcancaveis },
      conflitosEntreAptos: {
        cpfsDistintos: byCpf.size,
        cpfsComVariosEmails,
        certificadosDeCpfsComVariosEmails,
        emailsComVariosCpfs,
        cpfsComVariosNomes,
      },
    };
  }

  return { add, result };
}
