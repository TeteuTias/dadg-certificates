import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { eventIdentity } from "@/lib/events/identity";
import { EventError } from "@/lib/events/rules";
import { r2 } from "@/lib/certificates/storage";
import { ExternalCertificate } from "@/lib/organizer/models";
import { validateUploadFields } from "@/lib/organizer/rules";

const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ id: string }> };
const fail = (status: number, error: string, fields?: Record<string, string>) =>
  Response.json({ error, ...(fields ? { fields } : {}) }, { status, headers });

/** Edição dos dados de um envio próprio: título, tipo, instituição, data e horas. */
export const PATCH = withRouteAccess(async (request: NextRequest, { params }: Context) => {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return fail(400, "Envio inválido.");
  try {
    const { profile } = await eventIdentity(request);
    const body = await request.json().catch(() => ({}));
    const { data, errors, ok } = validateUploadFields(body, true);
    if (!ok) return fail(400, "Confira os campos destacados.", errors);
    if (!Object.keys(data).length) return fail(400, "Nada para alterar.");
    const result = await ExternalCertificate.updateOne({ _id: id, profileId: profile._id }, { $set: data });
    if (!result.matchedCount) return fail(404, "Envio não encontrado.");
    return Response.json({ success: true }, { headers });
  } catch (e) {
    if (e instanceof EventError) return fail(e.status, e.message);
    return fail(500, "Não foi possível salvar as alterações.");
  }
});

/** Exclusão de um envio próprio e do arquivo no armazenamento. */
export const DELETE = withRouteAccess(async (request: NextRequest, { params }: Context) => {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return fail(400, "Envio inválido.");
  try {
    const { profile } = await eventIdentity(request, false);
    const removed = await ExternalCertificate.findOneAndDelete({ _id: id, profileId: profile._id }).lean();
    if (!removed) return fail(404, "Envio não encontrado.");
    // O registro já saiu; se o arquivo não for apagado agora, fica só um objeto órfão no armazenamento.
    await r2()
      .send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: removed.fileKey }))
      .catch((error) => console.error("[ORGANIZER_DELETE_FILE]", error));
    return Response.json({ success: true }, { headers });
  } catch (e) {
    if (e instanceof EventError) return fail(e.status, e.message);
    return fail(500, "Não foi possível excluir o envio.");
  }
});
