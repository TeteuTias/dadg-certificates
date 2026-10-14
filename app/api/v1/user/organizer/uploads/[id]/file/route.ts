import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { eventIdentity } from "@/lib/events/identity";
import { EventError } from "@/lib/events/rules";
import { getSignedUrl } from "@/lib/certificates/storage";
import { ExternalCertificate } from "@/lib/organizer/models";

const headers = { "Cache-Control": "private, no-store" };

/** Link temporário (60 s) para o próprio aluno abrir um PDF que enviou. */
export const GET = withRouteAccess(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    if (!/^[a-f0-9]{24}$/i.test(id))
      return Response.json({ error: "Envio inválido." }, { status: 400, headers });
    try {
      const { profile } = await eventIdentity(request, false);
      const item = await ExternalCertificate.findOne({ _id: id, profileId: profile._id })
        .select("fileKey")
        .lean();
      if (!item) return Response.json({ error: "Envio não encontrado." }, { status: 404, headers });
      const url = await getSignedUrl(process.env.R2_BUCKET_NAME || "", item.fileKey);
      if (!url) return Response.json({ error: "Arquivo indisponível." }, { status: 404, headers });
      return Response.json({ url }, { headers });
    } catch (e) {
      return Response.json(
        { error: e instanceof EventError ? e.message : "Não foi possível abrir o arquivo." },
        { status: e instanceof EventError ? e.status : 500, headers },
      );
    }
  },
);
