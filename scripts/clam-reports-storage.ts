import mongoose from "mongoose";
async function main() {
  const apply = process.argv.includes("--apply");
  const uri = process.env.CLAM_MAINTENANCE_URI;
  const database = process.env.CLAM_MAINTENANCE_DB;
  if (!process.argv.includes("--approved") || !uri || !database)
    throw new Error("Explicit database and approval required.");
  if (apply && !process.env.CLAM_RECOVERABLE_BACKUP)
    throw new Error("Recoverable backup confirmation required.");
  mongoose.set("autoIndex", false);
  mongoose.set("autoCreate", false);
  await mongoose.connect(uri, {
    dbName: database,
    autoIndex: false,
    autoCreate: false,
  });
  try {
    const db = mongoose.connection.db!;
    const duplicates = await db
      .collection("exams")
      .aggregate([
        { $match: { acronym: { $type: "string" } } },
        {
          $group: {
            _id: { process: "$selectionProcessId", acronym: "$acronym" },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
        { $limit: 1 },
      ])
      .toArray();
    const exists =
      (
        await db
          .listCollections({ name: "clam_report_audit" }, { nameOnly: true })
          .toArray()
      ).length > 0;
    if (apply && !duplicates.length) {
      if (!exists) await db.createCollection("clam_report_audit");
      await db
        .collection("exams")
        .createIndex(
          { selectionProcessId: 1, acronym: 1 },
          {
            unique: true,
            partialFilterExpression: { acronym: { $type: "string" } },
            name: "clam_exam_acronym_unique",
          },
        );
    }
    console.log(
      JSON.stringify({
        database,
        apply,
        conflictingAcronyms: duplicates.length > 0,
        auditCollectionExists: exists || (apply && !duplicates.length),
        modifiesParticipantData: false,
      }),
    );
    if (duplicates.length) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
main().catch((e) => {
  console.error(e.name + ": maintenance failed; connection details omitted");
  process.exitCode = 1;
});
