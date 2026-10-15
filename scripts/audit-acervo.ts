/**
 * Auditoria somente leitura do acervo de certificados para o vínculo automático.
 * Uso: npx tsx scripts/audit-acervo.ts --db=NOME_EXATO
 * Uma única consulta em `certificates.datails`, só com os campos necessários,
 * contada em memória. Imprime apenas agregados, sem dados pessoais.
 */
import { MongoClient } from "mongodb";
import { createAcervoAudit, type AcervoDoc } from "../lib/certificates/acervo-audit";

const dbName = process.argv.find((arg) => arg.startsWith("--db="))?.slice(5);

async function main() {
  if (!dbName) throw new Error("Use --db=NOME_EXATO");
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI ausente");
  const client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 120000,
  });
  const started = Date.now();
  try {
    await client.connect();
    const audit = createAcervoAudit();
    const cursor = client
      .db(dbName)
      .collection<AcervoDoc>("certificates.datails")
      .find(
        {},
        {
          projection: { _id: 0, ownerCpf: 1, ownerEmail: 1, ownerName: 1, isReady: 1, profileId: 1 },
          batchSize: 2000,
          maxTimeMS: 120000,
        },
      );
    let read = 0;
    for await (const doc of cursor) {
      audit.add(doc);
      if (++read % 5000 === 0) console.error(`lidos ${read}...`);
    }
    console.log(
      JSON.stringify(
        { db: dbName, colecao: "certificates.datails", segundos: (Date.now() - started) / 1000, ...audit.result() },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha");
  process.exitCode = 1;
});
