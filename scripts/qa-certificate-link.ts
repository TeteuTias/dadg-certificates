/**
 * Integração do vínculo automático com transações reais (Mongo em memória).
 * Explicit opt-in only. Never reads .env and never accepts an external Mongo URI.
 * Uso: APPROVED_TEMP_DB_TEST=yes npx tsx scripts/qa-certificate-link.ts
 *
 * Cobre os achados A01 (perfil e devolução atômicos), A02 (corrida entre troca de
 * identidade e vínculo, nas duas ordens) e A03 (CPF gravado como número BSON),
 * e as regras do vínculo completo: colunas trocadas, e-mail institucional antigo
 * e do RA, nome ligado só ao CPF do aluno e trabalho em conjunto com dois donos.
 */
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";

async function main() {
  if (process.env.APPROVED_TEMP_DB_TEST !== "yes")
    throw new Error("Requires explicit approval: APPROVED_TEMP_DB_TEST=yes");
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = repl.getUri("dadg_link_integration");
  process.env.MONGODB_DB = "dadg_link_integration";
  process.env.PROFILE_CPF_ACTIVE_KEY_VERSION = "test";
  process.env.PROFILE_CPF_ENCRYPTION_KEY_TEST = Buffer.alloc(32, 1).toString("base64");
  process.env.PROFILE_CPF_LOOKUP_KEY = Buffer.alloc(32, 2).toString("base64");
  process.env.CERTIFICATE_AUTO_LINK_ENABLED = "true";
  try {
    const { connectToDatabase } = await import("../lib/mongodb");
    await connectToDatabase();
    const { default: Profile } = await import("../lib/models/UserProfileModel");
    const { default: Privacy } = await import("../lib/models/PrivacyAcceptanceModel");
    const { default: ProfileAudit } = await import("../lib/models/ProfileAuditModel");
    const { default: Certificate } = await import("../lib/models/CertificateModel");
    const { CertificateClaim } = await import("../lib/certificates/Claim");
    const { encryptCpf, cpfLookup } = await import("../lib/profile/crypto");
    const { isValidCpf } = await import("../lib/profile/validation");
    const { saveOwnProfile, ProfileRequestError } = await import("../lib/profile/service");
    const { PROFILE_PRIVACY_NOTICE_HASH, PROFILE_PRIVACY_NOTICE_VERSION } =
      await import("../lib/profile/privacy-notice");
    const { default: Keeper } = await import("../lib/security/gatekeeper");
    for (const model of [Profile, Privacy, ProfileAudit, Certificate, CertificateClaim])
      await model.createCollection();
    await Profile.createIndexes();

    const CPF_A = "52998224725", CPF_B = "11144477735", CPF_C = "39053344705";
    for (const cpf of [CPF_A, CPF_B, CPF_C]) assert.ok(isValidCpf(cpf), cpf);

    const identity = { authIssuer: "https://test.invalid/", authSubject: "auth0|link-integration" };
    const profile = await Profile.create({
      ...identity, name: "Ana Souza", period: 1, cpfEncrypted: encryptCpf(CPF_A), cpfLookup: cpfLookup(CPF_A),
    });
    const other = await Profile.create({
      authIssuer: identity.authIssuer, authSubject: "auth0|outra-conta", name: "Bia Lima", period: 1,
      cpfEncrypted: encryptCpf(CPF_B), cpfLookup: cpfLookup(CPF_B),
    });
    await Privacy.create({
      profileId: profile._id, noticeVersion: PROFILE_PRIVACY_NOTICE_VERSION, noticeHash: PROFILE_PRIVACY_NOTICE_HASH,
      acceptedAt: new Date(), ...identity, source: "profile-web",
    });
    Keeper.prototype.validate = async () => ({ authorized: true }) as never;
    let session = { sub: identity.authSubject, email: "conta@x.com" };
    Keeper.prototype.identifyStudent = async () =>
      ({ sub: session.sub, iss: identity.authIssuer, email: session.email, email_verified: false }) as never;

    const { POST: autoLink } = await import("../app/api/v1/user/certificates/link/route");
    const link = async () =>
      (await (await autoLink(new NextRequest("https://test.invalid/api/v1/user/certificates/link", { method: "POST" }), undefined)).json()) as { linked: number };
    const save = (name: string, cpf: string) =>
      saveOwnProfile({ identity, data: { name, cpf, period: 1 }, privacyAccepted: true, noticeVersion: PROFILE_PRIVACY_NOTICE_VERSION });
    // Inserção crua: preserva o tipo BSON (número) que o schema não aceitaria.
    const insertCertificate = async (doc: Record<string, unknown>) =>
      (await Certificate.collection.insertOne({
        eventName: "Acervo sintético", eventId: new mongoose.Types.ObjectId(), certificateHours: "4h",
        isReady: true, ownerName: "Ana Souza", ...doc,
      })).insertedId;
    const ownerOf = async (id: unknown) => (await Certificate.collection.findOne({ _id: id as mongoose.Types.ObjectId }))?.profileId;
    const claimOf = (id: unknown) => CertificateClaim.findById(`${profile._id}:${id}`).lean();
    const barrier = () => {
      let release!: () => void, reached!: () => void;
      const released = new Promise<void>((resolve) => (release = resolve));
      const arrived = new Promise<void>((resolve) => (reached = resolve));
      return { release, reached, released, arrived };
    };

    // A03: CPF gravado como número BSON é achado; separador fora do padrão também.
    const numeric = await insertCertificate({ ownerCpf: Number(CPF_A), ownerEmail: "conta@x.com" });
    const byName = await insertCertificate({ ownerCpf: "529 982 247 25", ownerEmail: "antigo@y.com" });
    assert.equal((await link()).linked, 2);
    assert.equal(String(await ownerOf(numeric)), String(profile._id));
    assert.equal((await claimOf(numeric))?.source, "automatic");
    assert.equal((await claimOf(byName))?.source, "automatic-name-cpf");
    console.log("PASS A03: CPF numérico e CPF com espaços vinculados");

    // A01: falha no meio da devolução desfaz também a troca de nome.
    const originalSave = CertificateClaim.prototype.save;
    let failNext = true;
    CertificateClaim.prototype.save = async function (this: unknown, ...args: unknown[]) {
      if (failNext) {
        failNext = false;
        throw new Error("falha simulada na devolução");
      }
      return (originalSave as (...a: unknown[]) => Promise<unknown>).apply(this, args);
    } as typeof originalSave;
    await assert.rejects(save("Ana Maria Souza", CPF_A), /falha simulada/);
    assert.equal((await Profile.findById(profile._id).lean())?.name, "Ana Souza");
    assert.equal(String(await ownerOf(byName)), String(profile._id));
    assert.equal((await claimOf(byName))?.status, "APPROVED");
    // Reenvio dos mesmos dados conclui as duas coisas.
    await save("Ana Maria Souza", CPF_A);
    CertificateClaim.prototype.save = originalSave;
    assert.equal((await Profile.findById(profile._id).lean())?.name, "Ana Maria Souza");
    assert.equal(await ownerOf(byName), undefined);
    assert.equal((await claimOf(byName))?.status, "PENDING");
    assert.equal(String(await ownerOf(numeric)), String(profile._id), "troca só de nome mantém o vínculo por e-mail");
    console.log("PASS A01: falha intermediária não deixa estado parcial e o reenvio conclui");

    // A01: CPF de outra conta é recusado sem desfazer vínculos.
    await assert.rejects(save("Ana Maria Souza", CPF_B), (e: unknown) => e instanceof ProfileRequestError && e.status === 409);
    assert.equal(String(await ownerOf(numeric)), String(profile._id));
    assert.equal((await claimOf(numeric))?.status, "APPROVED");
    console.log("PASS A01: CPF duplicado responde 409 e preserva os vínculos");

    // A02, vínculo primeiro: o /link para depois da cerca; a troca de CPF espera e devolve o vínculo novo.
    const late = await insertCertificate({ ownerCpf: Number(CPF_A), ownerEmail: "conta@x.com", ownerName: "Ana Maria Souza" });
    const originalCreate = CertificateClaim.insertMany.bind(CertificateClaim);
    const first = barrier();
    let paused = false;
    CertificateClaim.insertMany = (async (...args: unknown[]) => {
      if (!paused) {
        paused = true;
        first.reached();
        await first.released;
      }
      return (originalCreate as (...a: unknown[]) => Promise<unknown>)(...args);
    }) as typeof CertificateClaim.insertMany;
    const linking = link();
    await first.arrived;
    const changing = save("Ana Maria Souza", CPF_C);
    await new Promise((resolve) => setTimeout(resolve, 300));
    first.release();
    assert.equal((await linking).linked, 1);
    await changing;
    CertificateClaim.insertMany = originalCreate as typeof CertificateClaim.insertMany;
    assert.equal(await ownerOf(late), undefined, "vínculo feito com o CPF antigo voltou para revisão");
    assert.equal((await claimOf(late))?.status, "PENDING");
    assert.equal(await ownerOf(numeric), undefined);
    assert.equal(await CertificateClaim.countDocuments({ profileId: profile._id, status: "APPROVED", reviewedBy: null }), 0);
    console.log("PASS A02: vínculo concorrente feito antes da troca de CPF volta para revisão");

    // A02, troca primeiro: o /link avaliou a identidade antiga e a cerca não casa mais.
    const afterChange = await insertCertificate({ ownerCpf: CPF_C, ownerEmail: "conta@x.com", ownerName: "Ana Maria Souza" });
    const originalUpdate = Profile.updateOne.bind(Profile);
    const second = barrier();
    Profile.updateOne = ((filter: unknown, update: { $inc?: { __v?: number } }, ...rest: unknown[]) => {
      if (update?.$inc?.__v) {
        second.reached();
        return second.released.then(() => (originalUpdate as (...a: unknown[]) => unknown)(filter, update, ...rest));
      }
      return (originalUpdate as (...a: unknown[]) => unknown)(filter, update, ...rest);
    }) as typeof Profile.updateOne;
    const linking2 = link();
    await second.arrived;
    await save("Ana Maria de Souza", CPF_C);
    second.release();
    assert.equal((await linking2).linked, 0);
    Profile.updateOne = originalUpdate as typeof Profile.updateOne;
    assert.equal(await ownerOf(afterChange), undefined);
    assert.equal(await claimOf(afterChange), null);
    console.log("PASS A02: troca de nome antes da cerca impede o vínculo com a identidade antiga");

    // Vínculo completo: aluno novo com RA e acervo sujo (colunas trocadas, CPF inválido, só nome).
    const CPF_D = "12345678062";
    assert.ok(isValidCpf(CPF_D));
    const carlosIdentity = { authIssuer: identity.authIssuer, authSubject: "auth0|carlos" };
    const carlos = await Profile.create({
      ...carlosIdentity, name: "Carlos Pereira Rocha", period: 1, registrationNumber: "2426520099",
      cpfEncrypted: encryptCpf(CPF_D), cpfLookup: cpfLookup(CPF_D),
    });
    await Privacy.create({
      profileId: carlos._id, noticeVersion: PROFILE_PRIVACY_NOTICE_VERSION, noticeHash: PROFILE_PRIVACY_NOTICE_HASH,
      acceptedAt: new Date(), ...carlosIdentity, source: "profile-web",
    });
    session = { sub: carlosIdentity.authSubject, email: "carlos@x.com" };
    const carlosName = { ownerName: "Carlos Pereira Rocha" };
    const swapped = await insertCertificate({ ...carlosName, ownerCpf: "carlos@x.com", ownerEmail: CPF_D });
    const oldInstitutional = await insertCertificate({ ...carlosName, ownerCpf: "13", ownerEmail: "carlos.rocha@aluno.imepac.edu.br" });
    const raEmail = await insertCertificate({ ...carlosName, ownerEmail: " 2426520099@aluno.imepac.edu.br " });
    const nameOnly = await insertCertificate({ ownerName: "CARLOS PEREIRA DA ROCHA" });
    const joint = await insertCertificate({ ownerName: "Bia Lima e Carlos Pereira Rocha", profileId: other._id });
    const notReady = await insertCertificate({ ...carlosName, ownerCpf: CPF_D, ownerEmail: "carlos@x.com", isReady: false });
    const carlosClaim = (id: unknown) => CertificateClaim.findById(`${carlos._id}:${id}`).lean();

    const result = (await link()) as { linked: number; review: number };
    assert.deepEqual(result, { linked: 5, review: 0 });
    assert.equal((await carlosClaim(swapped))?.source, "automatic");
    assert.equal((await carlosClaim(oldInstitutional))?.source, "automatic-email-name");
    assert.equal((await carlosClaim(raEmail))?.source, "automatic-email-name");
    assert.equal((await carlosClaim(nameOnly))?.source, "automatic-name");
    assert.equal((await carlosClaim(joint))?.source, "automatic-name");
    for (const id of [swapped, oldInstitutional, raEmail, nameOnly]) assert.equal(String(await ownerOf(id)), String(carlos._id));
    assert.equal(String(await ownerOf(joint)), String(other._id), "trabalho em conjunto mantém o outro dono");
    assert.equal(await ownerOf(notReady), undefined);
    assert.deepEqual(await link(), { linked: 0, review: 0 }, "segunda rodada não refaz nada");
    console.log("PASS vínculo completo: colunas trocadas, e-mail antigo, RA, só nome e dupla");

    // Homônimo: o nome passa a aparecer com outro CPF; o próximo certificado só com nome vai para revisão.
    const stranger = await insertCertificate({ ...carlosName, ownerCpf: CPF_B, ownerEmail: "bia@x.com" });
    const ambiguous = await insertCertificate({ ownerName: "Carlos Pereira Rocha", eventName: "Outro evento" });
    assert.deepEqual(await link(), { linked: 0, review: 1 });
    assert.equal(await ownerOf(stranger), undefined, "CPF de outra pessoa com o mesmo nome não entra");
    assert.equal(await carlosClaim(stranger), null);
    assert.equal(await ownerOf(ambiguous), undefined);
    assert.equal((await carlosClaim(ambiguous))?.status, "PENDING");
    assert.equal((await carlosClaim(ambiguous))?.source, "automatic-suggestion");
    console.log("PASS homônimo: nome com dois CPFs vai para revisão e o certificado alheio fica de fora");

    // Lista e total do aluno incluem o trabalho em conjunto; o outro dono continua vendo.
    const { GET: listMine } = await import("../app/api/v1/user/certificates/route");
    const list = async () =>
      (await (await listMine(new NextRequest("https://test.invalid/api/v1/user/certificates"), undefined)).json()) as {
        total: number; data: Array<{ _id: string }>;
      };
    const carlosList = await list();
    assert.equal(carlosList.total, 5);
    assert.ok(carlosList.data.some((c) => c._id === String(joint)));
    const biaIdentity = { authIssuer: identity.authIssuer, authSubject: "auth0|outra-conta" };
    await Privacy.create({
      profileId: other._id, noticeVersion: PROFILE_PRIVACY_NOTICE_VERSION, noticeHash: PROFILE_PRIVACY_NOTICE_HASH,
      acceptedAt: new Date(), ...biaIdentity, source: "profile-web",
    });
    session = { sub: biaIdentity.authSubject, email: "bia@x.com" };
    assert.ok((await list()).data.some((c) => c._id === String(joint)));
    console.log("PASS lista: trabalho em conjunto aparece para as duas contas e entra no total");

    // Acervo corrigido: o homônimo some e a sugestão pendente é reavaliada como vínculo, na mesma transação.
    session = { sub: carlosIdentity.authSubject, email: "carlos@x.com" };
    await Certificate.collection.deleteOne({ _id: stranger });
    const unknownEmail = await insertCertificate({ ...carlosName, ownerEmail: "carlos.novo@x.com", eventName: "Evento do e-mail novo" });
    const refused = await insertCertificate({ ownerName: "Carlos Pereira Rocha", eventName: "Recusado antes" });
    await CertificateClaim.create({
      _id: `${carlos._id}:${refused}`, certificateId: refused, profileId: carlos._id, status: "REJECTED",
      source: "automatic-suggestion", reviewedBy: "admin", history: [{ status: "REJECTED", actor: "admin", at: new Date() }],
    });
    assert.deepEqual(await link(), { linked: 2, review: 0 });
    const upgraded = await carlosClaim(ambiguous);
    assert.equal(upgraded?.status, "APPROVED");
    assert.equal(upgraded?.source, "automatic-name");
    assert.equal(upgraded?.history.length, 2, "a história guarda a sugestão e a reavaliação");
    assert.match(String(upgraded?.history.at(-1)?.reason), /^Reavaliado: /);
    assert.equal(String(await ownerOf(ambiguous)), String(carlos._id));
    assert.equal((await carlosClaim(unknownEmail))?.source, "automatic-name-unknown-email");
    assert.equal(String(await ownerOf(unknownEmail)), String(carlos._id));
    assert.equal((await carlosClaim(refused))?.status, "REJECTED", "decisão do administrador não é refeita");
    assert.equal(await ownerOf(refused), undefined);
    assert.deepEqual(await link(), { linked: 0, review: 0 }, "segunda rodada não refaz nada");
    console.log("PASS reavaliação: sugestão pendente vira vínculo; e-mail desconhecido vincula; recusa do admin fica");

    // Pedido de remoção: o aluno diz que o certificado não é dele; o administrador remove ou mantém.
    Keeper.prototype.identifyAdmin = async () => ({ sub: "auth0|admin" }) as never;
    const { POST: requestRemoval } = await import("../app/api/v1/user/certificates/removal/route");
    const { PATCH: decide } = await import("../app/api/v1/admin/certificate-claims/[id]/route");
    const removal = (certificateId: unknown, message?: string) =>
      requestRemoval(
        new NextRequest("https://test.invalid/api/v1/user/certificates/removal", {
          method: "POST", body: JSON.stringify({ certificateId: String(certificateId), message }),
        }),
        undefined,
      );
    const adminDecision = (certificateId: unknown, status: string, reason: string) =>
      decide(
        new NextRequest("https://test.invalid/api/v1/admin/certificate-claims/x", {
          method: "PATCH", body: JSON.stringify({ status, reason }),
        }),
        { params: Promise.resolve({ id: `${carlos._id}:${certificateId}` }) },
      );
    session = { sub: carlosIdentity.authSubject, email: "carlos@x.com" };

    // Remover: sai da conta e o vínculo automático não traz de volta.
    assert.equal((await removal(raEmail, "Não participei deste evento.")).status, 200);
    assert.equal(String(await ownerOf(raEmail)), String(carlos._id), "o certificado fica na conta até o administrador decidir");
    assert.equal((await removal(raEmail)).status, 409, "pedido repetido");
    const open = (await carlosClaim(raEmail))?.removal;
    assert.ok(open?.requestedAt && !open.resolvedAt);
    assert.equal((await adminDecision(raEmail, "REVOKED", "Confirmado: não é do aluno.")).status, 200);
    const removed = await carlosClaim(raEmail);
    assert.equal(removed?.status, "REVOKED");
    assert.equal(removed?.removal?.decision, "REMOVED");
    assert.equal(await ownerOf(raEmail), undefined);
    assert.deepEqual(await link(), { linked: 0, review: 0 }, "o vínculo automático não refaz a decisão do administrador");
    assert.equal(await ownerOf(raEmail), undefined);

    // Manter: o vínculo segue e vira decisão humana (não volta para revisão automática).
    assert.equal((await removal(unknownEmail)).status, 200);
    assert.equal((await adminDecision(unknownEmail, "KEEP", "Conferido: o certificado é dele.")).status, 200);
    const kept = await carlosClaim(unknownEmail);
    assert.equal(kept?.status, "APPROVED");
    assert.equal(kept?.removal?.decision, "KEPT");
    assert.equal(kept?.reviewedBy, "auth0|admin");
    assert.equal(String(await ownerOf(unknownEmail)), String(carlos._id));
    assert.equal((await adminDecision(unknownEmail, "KEEP", "Conferido de novo, sem pedido.")).status, 409, "sem pedido aberto não há o que manter");

    // Certificado de outra pessoa não entra no pedido.
    assert.equal((await removal(refused)).status, 404);
    console.log("PASS remoção: pedido do aluno, administrador remove ou mantém, e o vínculo automático respeita");
  } finally {
    await mongoose.disconnect();
    await repl.stop();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
