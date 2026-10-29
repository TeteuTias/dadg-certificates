import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { eventIdentity } from "@/lib/events/identity";
import { CertificateClaim } from "@/lib/certificates/Claim";
import Certificate from "@/lib/models/CertificateModel";
import { EventError } from "@/lib/events/rules";
import { normalizeEmail, ownerNames } from "@/lib/certificates/matching";
export const POST = withRouteAccess(async (request: NextRequest) => {
  try {
    // Sem envio de e-mail de verificação: o administrador revisa cada pedido.
    const { profile } = await eventIdentity(request, true, false);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object")
      return Response.json({ error: "Requisição inválida." }, { status: 400 });
    if (
      !/^[a-f0-9]{24}$/i.test(body.certificateId) ||
      typeof body.message !== "string" ||
      body.message.trim().length < 10 ||
      body.message.length > 1000
    )
      return Response.json(
        {
          error:
            "Informe o código e uma justificativa entre 10 e 1.000 caracteres.",
        },
        { status: 400 },
      );
    // Evidência opcional para o administrador: o e-mail que o aluno usava nas inscrições.
    const evidenceEmail =
      typeof body.evidenceEmail === "string" && body.evidenceEmail.trim()
        ? normalizeEmail(body.evidenceEmail)
        : "";
    if (typeof body.evidenceEmail === "string" && body.evidenceEmail.trim() && !evidenceEmail)
      return Response.json(
        { error: "Informe um e-mail válido ou deixe o campo em branco." },
        { status: 400 },
      );
    const certificate = await Certificate.findOne({
      _id: body.certificateId,
      isReady: true,
    })
      .select("profileId ownerName")
      .lean();
    if (!certificate)
      return Response.json(
        { error: "Certificado não encontrado." },
        { status: 404 },
      );
    // Trabalho em conjunto pode ter mais de um dono; o administrador revisa o pedido.
    if (certificate.profileId && !ownerNames(certificate.ownerName).joint)
      return Response.json(
        {
          error:
            "Este certificado já possui vínculo. Procure a organização para revisão.",
        },
        { status: 409 },
      );
    if (
      (await CertificateClaim.countDocuments({
        profileId: profile._id,
        status: "PENDING",
        // Sugestões do vínculo automático não ocupam o limite de pedidos do aluno.
        source: "manual",
      })) >= 20
    )
      return Response.json(
        { error: "Aguarde a revisão das solicitações pendentes." },
        { status: 429 },
      );
    const id = `${profile._id}:${certificate._id}`;
    const saved = await CertificateClaim.updateOne(
      { _id: id },
      {
        $setOnInsert: {
          certificateId: certificate._id,
          profileId: profile._id,
          message: body.message.trim(),
          ...(evidenceEmail ? { evidenceEmail } : {}),
          status: "PENDING",
          source: "manual",
        },
      },
      { upsert: true },
    );
    if (!saved.upsertedCount)
      return Response.json(
        { error: "Já existe uma solicitação para este certificado." },
        { status: 409 },
      );
    return Response.json(
      { success: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof EventError
            ? e.message
            : "Não foi possível enviar a solicitação.",
      },
      { status: e instanceof EventError ? e.status : 500 },
    );
  }
});
