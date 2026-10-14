import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { eventIdentity } from "@/lib/events/identity";
import { EventError } from "@/lib/events/rules";
import Certificate from "@/lib/models/CertificateModel";
import { CertificateNote } from "@/lib/organizer/models";
import { isOrganizerType, readHours } from "@/lib/organizer/rules";

const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ certificateId: string }> };
const fail = (status: number, error: string) => Response.json({ error }, { status, headers });

/**
 * Anotação pessoal do aluno sobre um certificado do DADG vinculado a ele: tipo e
 * horas usados só na soma do organizador. O certificado oficial não muda.
 */
export const PUT = withRouteAccess(async (request: NextRequest, { params }: Context) => {
  const { certificateId } = await params;
  if (!/^[a-f0-9]{24}$/i.test(certificateId)) return fail(400, "Certificado inválido.");
  try {
    const { profile } = await eventIdentity(request);
    const body = await request.json().catch(() => ({}));
    const type = body.type === null || body.type === "" ? null : body.type;
    if (type !== null && type !== undefined && !isOrganizerType(type)) return fail(400, "Escolha um tipo da lista.");
    const hours = readHours(body.hours);
    if (hours === "invalid") return fail(400, "Informe as horas, de 0 a 1000.");
    if (!(await Certificate.exists({ _id: certificateId, profileId: profile._id, isReady: true })))
      return fail(404, "Certificado não encontrado na sua conta.");
    const noteId = `${profile._id}:${certificateId}`;
    if (!type && hours === null) await CertificateNote.deleteOne({ _id: noteId });
    else {
      const unset = { ...(type ? {} : { type: 1 }), ...(hours !== null ? {} : { hours: 1 }) };
      await CertificateNote.updateOne(
        { _id: noteId },
        {
          $set: { profileId: profile._id, certificateId, ...(type ? { type } : {}), ...(hours !== null ? { hours } : {}) },
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
        },
        { upsert: true },
      );
    }
    return Response.json({ success: true }, { headers });
  } catch (e) {
    if (e instanceof EventError) return fail(e.status, e.message);
    return fail(500, "Não foi possível salvar a anotação.");
  }
});

/** Remove a anotação: o organizador volta a usar a carga horária oficial. */
export const DELETE = withRouteAccess(async (request: NextRequest, { params }: Context) => {
  const { certificateId } = await params;
  if (!/^[a-f0-9]{24}$/i.test(certificateId)) return fail(400, "Certificado inválido.");
  try {
    const { profile } = await eventIdentity(request, false);
    await CertificateNote.deleteOne({ _id: `${profile._id}:${certificateId}` });
    return Response.json({ success: true }, { headers });
  } catch (e) {
    if (e instanceof EventError) return fail(e.status, e.message);
    return fail(500, "Não foi possível remover a anotação.");
  }
});
