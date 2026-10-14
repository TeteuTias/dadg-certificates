/**
 * Prepara as coleções do organizador pessoal de horas. Nada roda sem --db e --mode.
 * inspect: só leitura, diz o que existe. apply: cria o que falta e exige --backup-id.
 * Uso: npx tsx scripts/organizer-setup.ts --db=NOME_EXATO --mode=inspect|apply [--backup-id=ID]
 */
import { MongoClient } from "mongodb";

const args = new Map(
  process.argv.slice(2).map((v) => {
    const [k, ...rest] = v.replace(/^--/, "").split("=");
    return [k, rest.join("=")];
  }),
);
const COLLECTIONS = ["users.externalCertificates", "users.certificateNotes"];
const INDEXES: Array<[string, Record<string, 1 | -1>, string]> = [
  ["users.externalCertificates", { profileId: 1, createdAt: -1 }, "organizer_external_profile"],
  ["users.certificateNotes", { profileId: 1 }, "organizer_note_profile"],
];

async function main() {
  const dbName = args.get("db");
  const mode = args.get("mode");
  if (!dbName || !["inspect", "apply"].includes(mode || ""))
    throw new Error("Use --db=NOME_EXATO --mode=inspect|apply");
  if (mode === "apply" && !args.get("backup-id"))
    throw new Error("Informe --backup-id=IDENTIFICADOR_DO_BACKUP_RECUPERAVEL");
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI ausente");
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
    const state = [];
    for (const [collection, , name] of INDEXES) {
      const exists = names.includes(collection);
      const indexes = exists ? (await db.collection(collection).indexes()).map((i) => i.name) : [];
      state.push({ collection, exists, index: name, indexExists: indexes.includes(name) });
    }
    console.log(JSON.stringify({ db: dbName, mode, state }, null, 2));
    if (mode === "inspect") return;
    for (const collection of COLLECTIONS) if (!names.includes(collection)) await db.createCollection(collection);
    for (const [collection, keys, name] of INDEXES) await db.collection(collection).createIndex(keys, { name });
    console.log("Coleções e índices do organizador prontos. Nenhum documento existente foi alterado.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha");
  process.exitCode = 1;
});
