/** No operation runs without explicit --db and --mode; inspect is read-only. */
import { MongoClient } from "mongodb";
const args = new Map(
  process.argv.slice(2).map((v) => {
    const [k, ...rest] = v.replace(/^--/, "").split("=");
    return [k, rest.join("=")];
  }),
);
async function main() {
  const dbName = args.get("db"),
    mode = args.get("mode");
  if (!dbName || !["inspect", "apply"].includes(mode || ""))
    throw new Error("Use --db=DATABASE --mode=inspect|apply");
  if (mode === "apply" && !args.get("backup-id"))
    throw new Error("Informe --backup-id=IDENTIFICADOR_DO_BACKUP_RECUPERAVEL");
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI ausente");
  const client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  try {
    await client.connect();
    const db = client.db(dbName);
    const duplicates = await db
      .collection("certificates.participants")
      .aggregate([
        { $match: { profileId: { $type: "objectId" } } },
        {
          $group: {
            _id: { eventId: "$eventId", profileId: "$profileId" },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
        { $count: "groups" },
      ])
      .toArray();
    const certificates = await db
      .collection("certificates.datails")
      .aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            released: { $sum: { $cond: [{ $eq: ["$isReady", true] }, 1, 0] } },
            withCpf: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: [{ $type: "$ownerCpf" }, "string"] },
                      { $ne: ["$ownerCpf", ""] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            withEmail: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: [{ $type: "$ownerEmail" }, "string"] },
                      { $ne: ["$ownerEmail", ""] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ])
      .toArray();
    console.log(
      JSON.stringify(
        {
          db: dbName,
          mode,
          duplicateProfileGroups: duplicates[0]?.groups || 0,
          certificateCoverage: certificates.map((v) => ({
            total: v.total,
            released: v.released,
            withCpf: v.withCpf,
            withEmail: v.withEmail,
          })),
        },
        null,
        2,
      ),
    );
    if (mode === "inspect") return;
    if (duplicates.length)
      throw new Error("Corrija duplicidades antes de criar o índice.");
    const names = await db.listCollections({}, { nameOnly: true }).toArray();
    for (const name of [
      "events.paymentOrders",
      "events.audit",
      "certificates.claims",
      "certificates.imports",
    ]) {
      if (!names.some((c) => c.name === name)) await db.createCollection(name);
    }
    await db
      .collection("certificates.participants")
      .createIndex(
        { eventId: 1, profileId: 1 },
        {
          unique: true,
          partialFilterExpression: { profileId: { $type: "objectId" } },
          name: "event_profile_unique",
        },
      );
    await db
      .collection("certificates.datails")
      .createIndex(
        { profileId: 1, isReady: 1 },
        { name: "certificate_profile_ready" },
      );
    await db
      .collection("certificates.claims")
      .createIndex(
        { profileId: 1, status: 1 },
        { name: "certificate_claim_profile" },
      );
    await db
      .collection("events.paymentOrders")
      .createIndex(
        { status: 1, expiresAt: 1 },
        { name: "event_payment_reconciliation" },
      );
    console.log(
      "Estruturas preparadas. Nenhum documento histórico foi vinculado ou convertido.",
    );
  } finally {
    await client.close();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha");
  process.exitCode = 1;
});
