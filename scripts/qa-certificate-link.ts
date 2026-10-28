/**
 * Integração do vínculo automático com transações reais (Mongo em memória).
 * Explicit opt-in only. Never reads .env and never accepts an external Mongo URI.
 * Uso: APPROVED_TEMP_DB_TEST=yes npx tsx scripts/qa-certificate-link.ts
 *
 * Cobre os achados A01 (perfil e devolução atômicos), A02 (corrida entre troca de
 * identidade e vínculo, nas duas ordens) e A03 (CPF gravado como número BSON).
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
    await Profile.create({
      authIssuer: identity.authIssuer, authSubject: "auth0|outra-conta", name: "Bia Lima", period: 1,
      cpfEncrypted: encryptCpf(CPF_B), cpfLookup: cpfLookup(CPF_B),
    });
    await Privacy.create({
      profileId: profile._id, noticeVersion: PROFILE_PRIVACY_NOTICE_VERSION, noticeHash: PROFILE_PRIVACY_NOTICE_HASH,
      acceptedAt: new Date(), ...identity, source: "profile-web",
    });
    Keeper.prototype.validate = async () => ({ authorized: true }) as never;
    Keeper.prototype.identifyStudent = async () =>
      ({ sub: identity.authSubject, iss: identity.authIssuer, email: "conta@x.com", email_verified: false }) as never;

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
  } finally {
    await mongoose.disconnect();
    await repl.stop();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
