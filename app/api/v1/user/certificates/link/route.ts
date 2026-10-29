import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { eventIdentity } from "@/lib/events/identity";
import { linkCertificatesForProfile } from "@/lib/certificates/auto-link";
import { EventError } from "@/lib/events/rules";
export const POST = withRouteAccess(async (request: NextRequest) => {
  if (process.env.CERTIFICATE_AUTO_LINK_ENABLED !== "true")
    return Response.json(
      {
        error:
          "Vínculo automático aguardando auditoria do acervo. Solicite revisão manual.",
      },
      { status: 409 },
    );
  try {
    // Sem envio de e-mail de verificação: vale o e-mail informado no cadastro.
    const { profile, email } = await eventIdentity(request, true, false);
    const result = await linkCertificatesForProfile(profile, email);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (!(e instanceof EventError)) console.error("[certificates/link]", e);
    return Response.json(
      {
        error:
          e instanceof EventError ? e.message : "Falha ao verificar vínculos.",
        linked: 0,
      },
      { status: e instanceof EventError ? e.status : 500 },
    );
  }
});
