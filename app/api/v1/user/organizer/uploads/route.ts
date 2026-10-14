import { PDFDocument } from "pdf-lib";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Types } from "mongoose";
import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { eventIdentity } from "@/lib/events/identity";
import { EventError } from "@/lib/events/rules";
import { r2 } from "@/lib/certificates/storage";
import { ExternalCertificate } from "@/lib/organizer/models";
import {
  MAX_FILE_BYTES,
  MAX_PDF_PAGES,
  QUOTA_BYTES,
  QUOTA_FILES,
  validateUploadFields,
} from "@/lib/organizer/rules";

const headers = { "Cache-Control": "private, no-store" };
const fail = (status: number, error: string, fields?: Record<string, string>) =>
  Response.json({ error, ...(fields ? { fields } : {}) }, { status, headers });

/** Envio de um certificado de fora do DADG, em PDF, para o organizador pessoal do aluno. */
export const POST = withRouteAccess(async (request: NextRequest) => {
  if (Number(request.headers.get("content-length")) > MAX_FILE_BYTES + 64 * 1024)
    return fail(413, "Envie um PDF de até 4 MB.");
  try {
    const { profile } = await eventIdentity(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 8 || file.size > MAX_FILE_BYTES)
      return fail(400, "Envie um PDF de até 4 MB.");
    const { data, errors, ok } = validateUploadFields(Object.fromEntries(form.entries()));
    if (!ok) return fail(400, "Confira os campos destacados.", errors);

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-")
      return fail(400, "O arquivo precisa ser um PDF.");
    try {
      const pdf = await PDFDocument.load(bytes);
      if (pdf.getPageCount() < 1 || pdf.getPageCount() > MAX_PDF_PAGES)
        return fail(400, `O PDF deve ter de 1 a ${MAX_PDF_PAGES} páginas.`);
    } catch {
      return fail(400, "Não foi possível ler o PDF. Ele pode estar corrompido ou protegido por senha.");
    }

    // shortcut: dois envios simultâneos podem passar um pouco da cota; trocar por reserva atômica se virar problema.
    const existing = await ExternalCertificate.find({ profileId: profile._id }).select("fileSize").lean();
    const used = existing.reduce((sum, item) => sum + (item.fileSize || 0), 0);
    if (existing.length >= QUOTA_FILES || used + bytes.length > QUOTA_BYTES)
      return fail(409, "Você atingiu o limite de espaço do organizador. Exclua algum envio para liberar espaço.");

    const id = new Types.ObjectId();
    const key = `${process.env.R2_SUBFOLDER}/organizer/${profile._id}/${id}.pdf`;
    const client = r2();
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: bytes,
        ContentType: "application/pdf",
      }),
    );
    try {
      await ExternalCertificate.create({
        _id: id,
        profileId: profile._id,
        ...data,
        fileKey: key,
        fileSize: bytes.length,
      });
    } catch (e) {
      await client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
      throw e;
    }
    return Response.json({ success: true, id: String(id) }, { status: 201, headers });
  } catch (e) {
    if (e instanceof EventError) return fail(e.status, e.message);
    console.error("[ORGANIZER_UPLOAD]", e);
    return fail(500, "Não foi possível enviar o certificado.");
  }
});
