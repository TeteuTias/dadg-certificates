import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { eventIdentity } from "@/lib/events/identity";
import { CertificateClaim } from "@/lib/certificates/Claim";
import Certificate from "@/lib/models/CertificateModel";
import { EventError } from "@/lib/events/rules";
export const POST = withRouteAccess(async (request: NextRequest) => {
  try {
    const { profile } = await eventIdentity(request);
    const body = await request.json();
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
    const certificate = await Certificate.findOne({
      _id: body.certificateId,
      isReady: true,
    })
      .select("profileId")
      .lean();
    if (!certificate)
      return Response.json(
        { error: "Certificado não encontrado." },
        { status: 404 },
      );
    if (certificate.profileId)
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
      })) >= 20
    )
      return Response.json(
        { error: "Aguarde a revisão das solicitações pendentes." },
        { status: 429 },
      );
    const id = `${profile._id}:${certificate._id}`;
    await CertificateClaim.updateOne(
      { _id: id },
      {
        $setOnInsert: {
          certificateId: certificate._id,
          profileId: profile._id,
          message: body.message.trim(),
          status: "PENDING",
          source: "manual",
        },
      },
      { upsert: true },
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
