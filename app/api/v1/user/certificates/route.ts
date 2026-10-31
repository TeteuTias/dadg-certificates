import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { eventIdentity } from "@/lib/events/identity";
import Certificate from "@/lib/models/CertificateModel";
import { CertificateClaim } from "@/lib/certificates/Claim";
import { EventError } from "@/lib/events/rules";
export const GET = withRouteAccess(async (request: NextRequest) => {
  try {
    const { profile } = await eventIdentity(request, false);
    const page = Math.max(
      1,
      Math.min(
        100,
        Math.floor(Number(request.nextUrl.searchParams.get("page")) || 1),
      ),
    );
    // Dono pelo certificado ou por vínculo aprovado (trabalho em conjunto tem vários donos).
    const approved = await CertificateClaim.find({ profileId: profile._id, status: "APPROVED" })
      .select("certificateId")
      .lean();
    const mine = {
      isReady: true,
      $or: [{ profileId: profile._id }, { _id: { $in: approved.map((c) => c.certificateId) } }],
    };
    const [data, claims, total] = await Promise.all([
      Certificate.find(mine)
        .select("_id eventName ownerName certificateHours")
        .sort({ _id: -1 })
        .skip((page - 1) * 50)
        .limit(51)
        .lean(),
      CertificateClaim.find({ profileId: profile._id })
        .select("_id certificateId status reason message createdAt removal")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      // Mesmo filtro da lista: o total confere com o que o aluno pode abrir.
      Certificate.countDocuments(mine),
    ]);
    return Response.json(
      {
        data: data.slice(0, 50),
        hasMore: data.length > 50,
        total,
        claims,
        automaticEnabled: process.env.CERTIFICATE_AUTO_LINK_ENABLED === "true",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof EventError
            ? e.message
            : "Não foi possível consultar seus certificados.",
      },
      { status: e instanceof EventError ? e.status : 500 },
    );
  }
});
