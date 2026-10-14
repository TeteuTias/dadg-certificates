import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { connectToDatabase } from "@/lib/mongodb";
import { CertificateClaim } from "@/lib/certificates/Claim";
import Profile from "@/lib/models/UserProfileModel";
import Certificate from "@/lib/models/CertificateModel";
export const GET = withRouteAccess(async (request: NextRequest) => {
  await connectToDatabase();
  const status = request.nextUrl.searchParams.get("status") || "PENDING";
  if (!["PENDING", "APPROVED", "REJECTED", "REVOKED"].includes(status))
    return Response.json({ error: "Estado inválido" }, { status: 400 });
  const source = request.nextUrl.searchParams.get("source");
  if (source && !["manual", "automatic", "automatic-name-cpf"].includes(source))
    return Response.json({ error: "Origem inválida" }, { status: 400 });
  const claims = await CertificateClaim.find(source ? { status, source } : { status })
    .sort({ createdAt: 1 })
    .limit(100)
    .lean();
  const data = [];
  for (const c of claims) {
    const [profile, certificate] = await Promise.all([
      Profile.findById(c.profileId)
        .select("name registrationNumber period")
        .lean(),
      Certificate.findById(c.certificateId)
        .select("ownerName eventName ownerEmail ownerCpf")
        .lean(),
    ]);
    data.push({ ...c, profile, certificate });
  }
  return Response.json(
    { data },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
