import { isValidCpf } from "@/lib/profile/validation";

/**
 * Contagem da qualidade do acervo para o vínculo automático. Recebe os
 * certificados um a um e devolve só agregados: nenhum CPF, e-mail ou nome
 * sai daqui. Espelha `canAutoLink` e a busca de `/api/v1/user/certificates/link`.
 */
export type AcervoDoc = {
  ownerCpf?: unknown;
  ownerEmail?: unknown;
  ownerName?: unknown;
  isReady?: unknown;
  profileId?: unknown;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizedName = (value: unknown) =>
  typeof value === "string"
    ? value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
    : "";

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
  const byCpf = new Map<string, { emails: Set<string>; names: Set<string>; certificates: number }>();
  const cpfsByEmail = new Map<string, Set<string>>();

  function add(doc: AcervoDoc) {
    count.total++;
    if (doc.isReady === true) count.liberados++;
    if (doc.profileId) count.jaVinculados++;
    // O vínculo automático só considera certificado liberado e sem dono.
    if (doc.isReady !== true || doc.profileId) return;
    count.semDonoLiberados++;

    const rawCpf = typeof doc.ownerCpf === "string" ? doc.ownerCpf : "";
    const cpf = rawCpf.replace(/\D/g, "");
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
    }

    const rawEmail = typeof doc.ownerEmail === "string" ? doc.ownerEmail : "";
    const email = rawEmail.trim().toLowerCase();
    let emailOk = false;
    if (!email) count.emailAusente++;
    else if (!EMAIL.test(email)) count.emailInvalido++;
    else {
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
    return {
      ...count,
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
