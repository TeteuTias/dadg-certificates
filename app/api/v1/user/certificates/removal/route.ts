import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { eventIdentity } from "@/lib/events/identity";
import { CertificateClaim } from "@/lib/certificates/Claim";
import Certificate from "@/lib/models/CertificateModel";
import { EventError } from "@/lib/events/rules";

const OPEN_LIMIT = 20;

/**
 * O aluno avisa que um certificado da conta dele não é dele. O vínculo continua até o
 * administrador decidir (remover ou manter); aqui só se registra o pedido.
 */
export const POST = withRouteAccess(async (request: NextRequest) => {
  try {
    const { profile } = await eventIdentity(request, true, false);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object")
      return Response.json({ error: "Requisição inválida." }, { status: 400 });
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!/^[a-f0-9]{24}$/i.test(body.certificateId) || message.length > 1000)
      return Response.json(
        { error: "Informe o certificado e, se quiser, um comentário de até 1.000 caracteres." },
        { status: 400 },
      );

    const claimId = `${profile._id}:${body.certificateId}`;
    const claim = await CertificateClaim.findOne({ _id: claimId, status: "APPROVED" })
      .select("_id removal")
      .lean();
    // Mesmo critério da lista do aluno: dono pelo certificado ou por vínculo aprovado.
    const owned =
      claim ||
      (await Certificate.exists({ _id: body.certificateId, isReady: true, profileId: profile._id }));
    if (!owned)
      return Response.json({ error: "Certificado não encontrado na sua conta." }, { status: 404 });

    if (claim?.removal?.requestedAt && !claim.removal.resolvedAt)
      return Response.json({ error: "Já existe um pedido de remoção para este certificado." }, { status: 409 });

    if (
      (await CertificateClaim.countDocuments({
        profileId: profile._id,
        status: "APPROVED",
        "removal.requestedAt": { $exists: true },
        "removal.resolvedAt": { $exists: false },
      })) >= OPEN_LIMIT
    )
      return Response.json({ error: "Aguarde a análise dos pedidos de remoção pendentes." }, { status: 429 });

    const now = new Date();
    const removal = { requestedAt: now, ...(message ? { message } : {}) };
    const history = { status: "APPROVED", reason: "Aluno pediu a remoção do certificado", actor: String(profile._id), at: now };
    if (claim) {
      // Só grava se o pedido ainda não existe: dois cliques seguidos não duplicam.
      const saved = await CertificateClaim.updateOne(
        { _id: claimId, status: "APPROVED", $or: [{ "removal.requestedAt": null }, { "removal.resolvedAt": { $ne: null } }] },
        { $set: { removal }, $push: { history } },
      );
      if (!saved.modifiedCount)
        return Response.json({ error: "Já existe um pedido de remoção para este certificado." }, { status: 409 });
    } else {
      // Vínculo antigo, de antes das solicitações: o registro nasce aqui para o administrador poder revogá-lo.
      const created = await CertificateClaim.updateOne(
        { _id: claimId },
        {
          $setOnInsert: {
            certificateId: body.certificateId,
            profileId: profile._id,
            status: "APPROVED",
            reason: "Vínculo anterior às solicitações",
            removal,
            history: [
              { status: "APPROVED", reason: "Vínculo anterior às solicitações", actor: "system", at: now },
              history,
            ],
          },
        },
        { upsert: true },
      );
      if (!created.upsertedCount)
        return Response.json({ error: "Já existe um pedido de remoção para este certificado." }, { status: 409 });
    }
    return Response.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return Response.json(
      { error: e instanceof EventError ? e.message : "Não foi possível enviar o pedido." },
      { status: e instanceof EventError ? e.status : 500 },
    );
  }
});
