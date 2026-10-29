import mongoose from "mongoose";
import { CertificateClaim } from "@/lib/certificates/Claim";
import Certificate from "@/lib/models/CertificateModel";
import UserProfileModel from "@/lib/models/UserProfileModel";
import { decryptCpf, type EncryptedCpf } from "@/lib/profile/crypto";
import { certificateEvidence, cpfSearchFilter, nameKey, ownerNames, profileEmails } from "@/lib/certificates/matching";
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

export type LinkSource = "automatic" | "automatic-name-cpf" | "automatic-email-name" | "automatic-name";

const REASONS: Record<LinkSource, string> = {
  automatic: "CPF válido e e-mail do aluno correspondentes",
  "automatic-name-cpf": "CPF válido e nome completo correspondentes; e-mail do certificado diferente",
  "automatic-email-name": "Certificado sem CPF; nome completo e e-mail do aluno correspondentes",
  "automatic-name": "Certificado sem CPF nem e-mail; nome completo só aparece no acervo com o CPF do aluno",
};

/**
 * Regras do vínculo automático, sem banco. `docs` traz tudo que o acervo tem
 * com o CPF, os e-mails ou o nome do aluno, liberado ou não, com ou sem dono:
 * os não liberados e os de outros donos servem de conferência.
 *
 * A. CPF do aluno (em qualquer campo) + e-mail do aluno ou nome completo.
 * B. Sem CPF: nome completo + e-mail do aluno que nunca aparece com outro CPF.
 * C. Sem CPF nem e-mail: nome completo que, no acervo, só aparece com o CPF do aluno.
 * D. Trabalho em conjunto: cada nome é um dono; o certificado pode ter vários.
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

  // Acervo do CPF sem sinal de dado trocado: um nome só e nenhum e-mail dele com outro CPF.
  const single = withMyCpf.filter(({ ev }) => !ev.joint);
  const cpfConsistent =
    new Set(single.map(({ ev }) => ev.keys[0])).size <= 1 &&
    !withMyCpf.some(({ ev }) => ev.emails.some(emailOfOtherCpf));
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
      if (!ev.emails.some(emailOfOtherCpf))
        review.push({ id: doc._id, reason: "Nome completo do aluno com e-mail não reconhecido" });
    } else if (nameOnlyMine && cpfConsistent) approve.push({ id: doc._id, source: "automatic-name" });
    else
      review.push({
        id: doc._id,
        reason: cpfsOfName.size
          ? "Nome completo do aluno aparece no acervo com mais de um CPF"
          : "Nome completo do aluno sem nenhum CPF conhecido no acervo",
      });
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
      if (!seen.has(String(doc._id))) docs.push(doc);

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
      const claimId = (id: unknown) => `${profile._id}:${id}`;
      const decided = new Set(
        (
          await CertificateClaim.find({ _id: { $in: [...approve, ...review].map((m) => claimId(m.id)) } })
            .select("_id")
            .session(session)
            .lean()
        ).map((claim) => String(claim._id)),
      );
      const open = approve.filter((m) => !decided.has(claimId(m.id)));
      const toReview = review.filter((m) => !decided.has(claimId(m.id)));

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
      const claims = [
        ...open
          .filter((m) => attached.has(String(m.id)))
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
      written.linked = claims.filter((c) => c.status === "APPROVED").length;
      written.review = toReview.length;
    });
  } finally {
    await session.endSession();
  }
  return written;
}
