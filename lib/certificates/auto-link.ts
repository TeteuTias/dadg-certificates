import mongoose from "mongoose";
import { CertificateClaim } from "@/lib/certificates/Claim";
import Certificate from "@/lib/models/CertificateModel";
import UserProfileModel from "@/lib/models/UserProfileModel";
import { decryptCpf, type EncryptedCpf } from "@/lib/profile/crypto";
import {
  abbreviatedNameMatch,
  certificateEvidence,
  cpfSearchFilter,
  nameKey,
  ownerNames,
  profileEmails,
} from "@/lib/certificates/matching";
import { escapeSearch } from "@/lib/certificates/public-contract";

/** Documento cru do acervo: o driver nativo devolve os tipos como estão gravados. */
export type RawCertificate = {
  _id: unknown;
  ownerCpf?: unknown;
  ownerEmail?: unknown;
  ownerName?: unknown;
  isReady?: unknown;
  profileId?: unknown;
};

export type LinkSource =
  | "automatic"
  | "automatic-name-cpf"
  | "automatic-email-name"
  | "automatic-name"
  | "automatic-name-unknown-email";

const REASONS: Record<LinkSource, string> = {
  automatic: "CPF válido e e-mail do aluno correspondentes",
  "automatic-name-cpf": "CPF válido e nome completo correspondentes; e-mail do certificado diferente",
  "automatic-email-name": "Certificado sem CPF; nome completo e e-mail do aluno correspondentes",
  "automatic-name": "Certificado sem CPF nem e-mail; nome completo só aparece no acervo com o CPF do aluno",
  "automatic-name-unknown-email":
    "Certificado sem CPF com e-mail desconhecido; nome completo só aparece no acervo com o CPF do aluno",
};

/** A partir de quantas pessoas diferentes um e-mail deixa de provar o dono (e-mail de preenchimento). */
const FILLER_EMAIL_PEOPLE = 3;

/** Sugestão automática que ainda não passou por nenhuma decisão humana. */
const isOpenSuggestion = (claim: { status?: string | null; source?: string | null; reviewedBy?: string | null }) =>
  claim.status === "PENDING" && claim.source === "automatic-suggestion" && !claim.reviewedBy;

/**
 * Regras do vínculo automático, sem banco. `docs` traz tudo que o acervo tem
 * com o CPF, os e-mails ou o nome do aluno, liberado ou não, com ou sem dono:
 * os não liberados e os de outros donos servem de conferência.
 *
 * A. CPF do aluno (em qualquer campo) + e-mail do aluno ou nome completo.
 * B. Sem CPF: nome completo + e-mail do aluno que nunca aparece com outro CPF.
 * C. Sem CPF nem e-mail: nome completo que, no acervo, só aparece com o CPF do aluno.
 * D. Trabalho em conjunto: cada nome é um dono; o certificado pode ter vários.
 * Na C, o e-mail desconhecido (que nunca aparece com outro CPF) também vale.
 * O que bate pelo nome sem prova suficiente vai para revisão do administrador.
 */
export function evaluateLinks(
  docs: RawCertificate[],
  ctx: { profileId: string; cpf: string; name: unknown; emails: Set<string> },
) {
  const key = nameKey(ctx.name);
  const fullName = key.split(" ").length >= 2;
  const rows = docs.map((doc) => ({ doc, ev: certificateEvidence(doc) }));
  const withMyCpf = rows.filter(({ ev }) => ev.cpfs.includes(ctx.cpf));

  const cpfsByEmail = new Map<string, Set<string>>();
  for (const { ev } of rows)
    for (const email of ev.emails) {
      if (!cpfsByEmail.has(email)) cpfsByEmail.set(email, new Set());
      for (const cpf of ev.cpfs) cpfsByEmail.get(email)!.add(cpf);
    }
  const emailOfOtherCpf = (email: string) => [...(cpfsByEmail.get(email) ?? [])].some((cpf) => cpf !== ctx.cpf);
  // Pessoas (grupos de nomes que são o mesmo nome abreviado) que aparecem com cada e-mail. Um e-mail
  // de preenchimento ("11111@gmail.com") vem com 3 ou mais pessoas e CPF inválido: não diz de quem é
  // o certificado, vale como e-mail ausente. Já o e-mail de 1 ou 2 outras pessoas é de outro dono.
  const peopleByEmail = new Map<string, string[][]>();
  for (const { ev } of rows)
    if (!ev.joint && ev.keys[0])
      for (const email of ev.emails) {
        const groups = peopleByEmail.get(email) ?? peopleByEmail.set(email, []).get(email)!;
        const same = groups.find((names) => names.some((name) => abbreviatedNameMatch(ev.keys[0], name)));
        if (same) same.push(ev.keys[0]);
        else groups.push([ev.keys[0]]);
      }
  const isFillerEmail = (email: string) => (peopleByEmail.get(email)?.length ?? 0) >= FILLER_EMAIL_PEOPLE;
  const emailOfOtherName = (email: string) =>
    (peopleByEmail.get(email) ?? []).some((names) => !names.some((name) => abbreviatedNameMatch(name, key)));

  // Acervo do CPF sem sinal de dado trocado: os nomes dos certificados são o do perfil (ou ele
  // abreviado) e nenhum e-mail dele aparece com outro CPF. Um nome fora do padrão não derruba o
  // CPF se a maioria (3 ou mais, 80%) confere: é o CPF digitado errado numa linha da planilha.
  const named = withMyCpf.filter(({ ev }) => !ev.joint && ev.keys[0]);
  const matching = named.filter(({ ev }) => abbreviatedNameMatch(ev.keys[0], key)).length;
  const namesConsistent = matching === named.length || (matching >= 3 && matching / named.length >= 0.8);
  const emailsConsistent = !withMyCpf.some(({ ev }) => ev.emails.some(emailOfOtherCpf));
  const cpfConsistent = namesConsistent && emailsConsistent;
  // CPFs com que o nome aparece sozinho no acervo (certificado em conjunto não diz de quem é o CPF).
  const cpfsOfName = new Set(
    rows.filter(({ ev }) => !ev.joint && ev.keys[0] === key).flatMap(({ ev }) => ev.cpfs),
  );
  const nameOnlyMine = cpfsOfName.size === 1 && cpfsOfName.has(ctx.cpf);
  const nameOf = (ev: { keys: string[] }) => fullName && ev.keys.includes(key);
  const knownEmail = (ev: { emails: string[] }) => ev.emails.some((email) => ctx.emails.has(email));

  // E-mails comprovados: os de certificados com o CPF do aluno que já são dele ou
  // que a regra A aprova. O e-mail de um certificado com CPF só não prova nada.
  const emails = new Set(ctx.emails);
  for (const { doc, ev } of withMyCpf)
    if (String(doc.profileId ?? "") === ctx.profileId || knownEmail(ev) || (nameOf(ev) && cpfConsistent))
      for (const email of ev.emails) emails.add(email);

  // Por que o certificado só com o nome do aluno não foi aprovado.
  const nameReviewReason = () => {
    if (!cpfsOfName.size) return "Nome completo do aluno sem nenhum CPF conhecido no acervo";
    if (!nameOnlyMine)
      return cpfsOfName.size > 1
        ? "Nome completo do aluno aparece no acervo com mais de um CPF"
        : "Nome completo do aluno aparece no acervo com o CPF de outra pessoa";
    return namesConsistent
      ? "E-mail de certificado com o CPF do aluno aparece no acervo com outro CPF"
      : "Os certificados com o CPF do aluno têm nomes diferentes do perfil";
  };

  const approve: Array<{ id: unknown; source: LinkSource }> = [];
  const review: Array<{ id: unknown; reason: string }> = [];
  for (const { doc, ev } of rows) {
    if (doc.isReady !== true) continue;
    const owner = doc.profileId ? String(doc.profileId) : "";
    if (owner === ctx.profileId || (owner && !ev.joint)) continue;
    const nameOk = nameOf(ev);
    const mine = ev.emails.filter((email) => emails.has(email));
    const otherCpf = ev.cpfs.some((cpf) => cpf !== ctx.cpf);

    if (ev.cpfs.includes(ctx.cpf) && !otherCpf) {
      if (knownEmail(ev)) approve.push({ id: doc._id, source: "automatic" });
      else if (nameOk && cpfConsistent) approve.push({ id: doc._id, source: "automatic-name-cpf" });
      continue;
    }
    if (!nameOk) continue;
    if (otherCpf) {
      // CPF de outra pessoa: só um trabalho em conjunto ainda pode ser do aluno.
      if (ev.joint) review.push({ id: doc._id, reason: "Trabalho em conjunto com o nome do aluno e CPF de outra pessoa" });
      continue;
    }
    if (mine.length) {
      if (mine.some(emailOfOtherCpf))
        review.push({ id: doc._id, reason: "Nome e e-mail do aluno, mas o e-mail aparece no acervo com outro CPF" });
      else approve.push({ id: doc._id, source: "automatic-email-name" });
    } else if (ev.emails.length) {
      // E-mail desconhecido: se ele já aparece com outro CPF, o certificado é de outra pessoa.
      if (!ev.emails.some(emailOfOtherCpf)) {
        const real = ev.emails.filter((email) => !isFillerEmail(email));
        if (real.some(emailOfOtherName))
          review.push({ id: doc._id, reason: "Nome completo do aluno com e-mail que aparece no acervo com outros nomes" });
        else if (nameOnlyMine && cpfConsistent)
          approve.push({ id: doc._id, source: real.length ? "automatic-name-unknown-email" : "automatic-name" });
        else
          review.push({ id: doc._id, reason: real.length ? "Nome completo do aluno com e-mail não reconhecido" : nameReviewReason() });
      }
    } else if (nameOnlyMine && cpfConsistent) approve.push({ id: doc._id, source: "automatic-name" });
    else review.push({ id: doc._id, reason: nameReviewReason() });
  }
  return { approve, review };
}

// Nome em qualquer grafia de acento, com o que houver entre as palavras (partículas, outro dono).
const ACCENTS: Record<string, string> = { a: "[aàáâãä]", e: "[eèéêë]", i: "[iìíîï]", o: "[oòóôõö]", u: "[uùúûü]", c: "[cç]", n: "[nñ]" };
const nameRegex = (key: string) =>
  key.split(" ").map((token) => [...token].map((ch) => ACCENTS[ch] ?? ch).join("")).join("[\\s\\S]*");
const emailFilter = (emails: string[]) => {
  const $regex = `^\\s*(${emails.map(escapeSearch).join("|")})\\s*$`;
  return [{ ownerEmail: { $regex, $options: "i" } }, { ownerCpf: { $regex, $options: "i" } }];
};

/** Quantos e-mails entram numa mesma consulta (a expressão regular cresce com eles). */
const EMAIL_CHUNK = 100;

type LinkProfile = {
  _id: unknown;
  name: string;
  cpfLookup: string;
  cpfEncrypted: EncryptedCpf;
  registrationNumber?: string;
  contactEmail?: string;
};

/**
 * Vincula ao perfil os certificados que as regras aprovam e manda para revisão
 * os duvidosos. Idempotente: decisões anteriores (aprovadas, recusadas ou
 * pendentes) têm precedência e não são refeitas.
 */
export async function linkCertificatesForProfile(profile: LinkProfile, accountEmail: unknown) {
  const cpf = decryptCpf(profile.cpfEncrypted).replace(/\D/g, "");
  const key = nameKey(profile.name);
  const known = profileEmails(profile, accountEmail);
  const projection = { ownerCpf: 1, ownerEmail: 1, ownerName: 1, isReady: 1, profileId: 1 };
  // Driver nativo: o cast do Mongoose transformaria o ramo numérico do CPF em texto.
  // shortcut: o ramo do nome é regex sem índice (varre ~15 mil documentos); se o acervo crescer muito, indexar uma chave de nome.
  const docs = await Certificate.collection
    .find<RawCertificate>(
      {
        $or: [
          ...cpfSearchFilter(cpf).$or,
          ...(known.size ? emailFilter([...known]) : []),
          ...(key.split(" ").length >= 2 ? [{ ownerName: { $regex: nameRegex(key), $options: "i" } }] : []),
        ],
      },
      { projection },
    )
    .toArray();
  // E-mails comprovados pelo CPF que o perfil não conhecia: busca o resto do acervo deles.
  const seen = new Set(docs.map((doc) => String(doc._id)));
  const proven = [
    ...new Set(
      docs
        .map(certificateEvidence)
        .filter((ev) => ev.cpfs.includes(cpf))
        .flatMap((ev) => ev.emails)
        .filter((email) => !known.has(email)),
    ),
  ];
  if (proven.length)
    for (const doc of await Certificate.collection.find<RawCertificate>({ $or: emailFilter(proven) }, { projection }).toArray())
      if (!seen.has(String(doc._id))) {
        seen.add(String(doc._id));
        docs.push(doc);
      }
  // E-mails ainda desconhecidos dos certificados com o nome do aluno: busca quem mais os usa, para
  // reconhecer o e-mail de outro CPF e o de preenchimento (um só e-mail em vários nomes).
  const unproven = new Set([...known, ...proven]);
  const unknown = [
    ...new Set(
      docs
        .map(certificateEvidence)
        .filter((ev) => key.split(" ").length >= 2 && ev.keys.includes(key))
        .flatMap((ev) => ev.emails)
        .filter((email) => !unproven.has(email)),
    ),
  ];
  for (let from = 0; from < unknown.length; from += EMAIL_CHUNK)
    for (const doc of await Certificate.collection
      .find<RawCertificate>({ $or: emailFilter(unknown.slice(from, from + EMAIL_CHUNK)) }, { projection })
      .toArray())
      if (!seen.has(String(doc._id))) {
        seen.add(String(doc._id));
        docs.push(doc);
      }

  const { approve, review } = evaluateLinks(docs, { profileId: String(profile._id), cpf, name: profile.name, emails: known });
  if (!approve.length && !review.length) return { linked: 0, review: 0 };

  const session = await mongoose.startSession();
  // Só conta depois do commit: uma tentativa abortada não pode aparecer como vínculo feito.
  const written = { linked: 0, review: 0 };
  try {
    await session.withTransaction(async () => {
      written.linked = 0;
      written.review = 0;
      // Cerca no perfil: uma escrita real, condicionada aos dados avaliados, conflita
      // com a troca de nome, CPF, RA ou e-mail de contato em andamento.
      const fenced = await UserProfileModel.updateOne(
        {
          _id: profile._id,
          cpfLookup: profile.cpfLookup,
          name: profile.name,
          registrationNumber: profile.registrationNumber ?? null,
          contactEmail: profile.contactEmail ?? null,
        },
        { $inc: { __v: 1 } },
        { session, timestamps: false },
      );
      if (fenced.matchedCount !== 1) return;

      // Qualquer solicitação ou decisão anterior (manual, revisão, recusa) tem precedência.
      // A única exceção é a sugestão automática ainda pendente, sem decisão humana: se as
      // regras agora aprovam o certificado (dado do acervo corrigido), ela vira vínculo.
      const claimId = (id: unknown) => `${profile._id}:${id}`;
      const existing = await CertificateClaim.find({ _id: { $in: [...approve, ...review].map((m) => claimId(m.id)) } })
        .select("_id status source reviewedBy")
        .session(session)
        .lean();
      const suggested = new Set(existing.filter(isOpenSuggestion).map((claim) => String(claim._id)));
      const decided = new Set(existing.map((claim) => String(claim._id)).filter((id) => !suggested.has(id)));
      const taken = new Set([...decided, ...suggested]);
      const open = approve.filter((m) => !decided.has(claimId(m.id)));
      const toReview = review.filter((m) => !taken.has(claimId(m.id)));

      if (open.length)
        await Certificate.updateMany(
          { _id: { $in: open.map((m) => m.id) }, isReady: true, profileId: null },
          { $set: { profileId: profile._id } },
          { session },
        );
      // Ficam com o aluno os que este vínculo pegou e os trabalhos em conjunto (vários donos).
      const attached = new Set(
        (
          await Certificate.find({ _id: { $in: open.map((m) => m.id) }, isReady: true })
            .select("_id profileId ownerName")
            .session(session)
            .lean()
        )
          .filter((c) => String(c.profileId) === String(profile._id) || ownerNames(c.ownerName).joint)
          .map((c) => String(c._id)),
      );
      const now = new Date();
      const linked = open.filter((m) => attached.has(String(m.id)));
      const upgraded = linked.filter((m) => suggested.has(claimId(m.id)));
      if (upgraded.length)
        await CertificateClaim.bulkWrite(
          // O tipo do Mongoose não aceita um item puro no $push de subdocumentos.
          upgraded.map(({ id, source }): unknown => ({
            updateOne: {
              // Mesma condição da leitura: uma decisão humana no meio do caminho não é sobrescrita.
              filter: { _id: claimId(id), status: "PENDING", source: "automatic-suggestion", reviewedBy: null },
              update: {
                $set: { status: "APPROVED", source, reason: REASONS[source], reviewedAt: now },
                $push: {
                  history: {
                    status: "APPROVED",
                    reason: `Reavaliado: ${REASONS[source]}`,
                    actor: "automatic",
                    at: now,
                  },
                },
              },
            },
          })) as Parameters<typeof CertificateClaim.bulkWrite>[0],
          { session },
        );
      const claims = [
        ...linked
          .filter((m) => !suggested.has(claimId(m.id)))
          .map(({ id, source }) => ({
            _id: claimId(id),
            certificateId: id,
            profileId: profile._id,
            status: "APPROVED",
            source,
            reason: REASONS[source],
            reviewedAt: now,
            history: [{ status: "APPROVED", reason: REASONS[source], actor: "automatic", at: now }],
          })),
        ...toReview.map(({ id, reason }) => ({
          _id: claimId(id),
          certificateId: id,
          profileId: profile._id,
          status: "PENDING",
          source: "automatic-suggestion",
          reason,
          history: [{ status: "PENDING", reason, actor: "automatic", at: now }],
        })),
      ];
      if (claims.length) await CertificateClaim.insertMany(claims, { session });
      written.linked = claims.filter((c) => c.status === "APPROVED").length + upgraded.length;
      written.review = toReview.length;
    });
  } finally {
    await session.endSession();
  }
  return written;
}
