import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectToDatabase } from "../lib/mongodb";
import UserProfileModel from "../lib/models/UserProfileModel";
import PrivacyAcceptanceModel from "../lib/models/PrivacyAcceptanceModel";
import ProfileAuditModel from "../lib/models/ProfileAuditModel";
import {
  assertProfileCryptoConfigured,
  decryptCpf,
  encryptCpf,
  ProfileCryptoConfigurationError,
} from "../lib/profile/crypto";

loadEnvConfig(process.cwd());
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const rotation = [...args]
  .find((arg) => arg.startsWith("--rotate-to="))
  ?.split("=")[1];

async function indexes() {
  const specs = [
    [
      UserProfileModel.collection,
      { authIssuer: 1, authSubject: 1 },
      { unique: true, name: "profile_identity_unique" },
    ],
    [
      UserProfileModel.collection,
      { cpfLookup: 1 },
      { unique: true, name: "profile_cpf_lookup_unique" },
    ],
    [
      PrivacyAcceptanceModel.collection,
      { profileId: 1, noticeVersion: 1 },
      { unique: true, name: "privacy_profile_notice_unique" },
    ],
    [
      ProfileAuditModel.collection,
      { profileId: 1, createdAt: -1 },
      { name: "profile_audit_timeline" },
    ],
  ] as const;

  const duplicateCpf = await UserProfileModel.aggregate([
    { $group: { _id: "$cpfLookup", count: { $sum: 1 } } },
    { $match: { _id: { $ne: null }, count: { $gt: 1 } } },
    { $count: "groups" },
  ]);
  const duplicateIdentity = await UserProfileModel.aggregate([
    {
      $group: {
        _id: { authIssuer: "$authIssuer", authSubject: "$authSubject" },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $count: "groups" },
  ]);
  console.log(
    `Verificação de duplicidades: CPF=${duplicateCpf[0]?.groups || 0}; identidade=${duplicateIdentity[0]?.groups || 0}.`,
  );
  if ((duplicateCpf[0]?.groups || duplicateIdentity[0]?.groups) && apply) {
    throw new Error("Índices não foram criados porque há duplicidades.");
  }
  if (!apply) {
    console.log(
      "Modo somente leitura. Use --apply para criar os índices ausentes.",
    );
    return;
  }
  for (const [collection, keys, options] of specs)
    await collection.createIndex(keys, options);
  console.log("Índices de perfil confirmados.");
}

async function auditAndRotate() {
  const versions = await UserProfileModel.aggregate([
    { $group: { _id: "$cpfEncrypted.keyVersion", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  console.log(
    "Versões de criptografia:",
    versions.map((row) => `${row._id || "ausente"}=${row.count}`).join(", ") ||
      "nenhum perfil",
  );
  if (!rotation) return;
  if (!apply) {
    console.log(`Rotação para ${rotation} não executada. Repita com --apply.`);
    return;
  }
  if (!process.env[`PROFILE_CPF_ENCRYPTION_KEY_${rotation.toUpperCase()}`]) {
    throw new ProfileCryptoConfigurationError(
      `A chave da versão ${rotation} não está configurada.`,
    );
  }
  const cursor = UserProfileModel.find({
    "cpfEncrypted.keyVersion": { $ne: rotation },
  }).cursor();
  let updated = 0;
  for await (const profile of cursor) {
    const plaintext = decryptCpf(profile.cpfEncrypted);
    profile.cpfEncrypted = encryptCpf(plaintext, rotation);
    await profile.save();
    updated += 1;
  }
  console.log(
    `Rotação concluída: ${updated} registro(s) recriptografado(s); nenhum CPF foi impresso.`,
  );
}

async function main() {
  try {
    assertProfileCryptoConfigured();
    console.log("Configuração criptográfica válida (segredos não exibidos).");
    await connectToDatabase();
    await indexes();
    await auditAndRotate();
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(
    error instanceof ProfileCryptoConfigurationError
      ? "Configuração criptográfica inválida."
      : "Manutenção de perfis falhou.",
  );
  process.exitCode = 1;
});
