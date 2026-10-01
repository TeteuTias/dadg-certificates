import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { connectToDatabase } from "@/lib/mongodb";
import Certificate from "@/lib/models/CertificateModel";
const fields = [
  "ownerName",
  "ownerCpf",
  "eventName",
  "ownerEmail",
  "certificateHours",
  "certificatePath",
  "frontTopperText",
  "frontBottomText",
  "eventId",
  "isReady",
  "onlyImage",
  "verse",
];
export const POST = withRouteAccess(async (request: NextRequest) => {
  const raw = await request.text();
  if (raw.length > 2 * 1024 * 1024)
    return Response.json({ error: "Lote maior que 2 MB." }, { status: 413 });
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (
    !["simple-bulk", "verse-bulk"].includes(body.operationType) ||
    !Array.isArray(body.certificates) ||
    !body.certificates.length ||
    body.certificates.length > 500
  )
    return Response.json(
      { error: "Envie entre 1 e 500 certificados por lote." },
      { status: 400 },
    );
  const data: Record<string, unknown>[] = [];
  for (let index = 0; index < body.certificates.length; index++) {
    const row = body.certificates[index];
    if (!row || typeof row !== "object" || Array.isArray(row))
      return Response.json(
        { error: `Linha ${index + 1} inválida.` },
        { status: 400 },
      );
    const dto = Object.fromEntries(
      fields.filter((k) => k in row).map((k) => [k, row[k]]),
    );
    const validation = new Certificate(dto).validateSync();
    if (
      validation ||
      (body.operationType === "verse-bulk" && !row.verse?.rows?.length)
    )
      return Response.json(
        { error: `Revise os campos obrigatórios da linha ${index + 1}.` },
        { status: 400 },
      );
    data.push(dto);
  }
  await connectToDatabase();
  const db = mongoose.connection.db!;
  const receipt = createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");
  if (
    await db
      .collection<{ _id: string; count: number; createdAt: Date }>(
        "certificates.imports",
      )
      .findOne({ _id: receipt })
  )
    return Response.json({ insertedCount: data.length, replayed: true });
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await db
        .collection<{ _id: string; count: number; createdAt: Date }>(
          "certificates.imports",
        )
        .insertOne(
          { _id: receipt, count: data.length, createdAt: new Date() },
          { session },
        );
      await Certificate.insertMany(data, { session });
    });
    return Response.json({ insertedCount: data.length }, { status: 201 });
  } catch (e) {
    if ((e as { code?: number }).code === 11000)
      return Response.json({ insertedCount: data.length, replayed: true });
    return Response.json(
      { error: "Lote não gravado. Tente novamente." },
      { status: 500 },
    );
  } finally {
    await session.endSession();
  }
});
