import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { connectToDatabase } from "@/lib/mongodb";
import { CertificateClaim, CLAIM_SOURCES } from "@/lib/certificates/Claim";
import Profile from "@/lib/models/UserProfileModel";
import Certificate from "@/lib/models/CertificateModel";
import { normalizeEmail } from "@/lib/certificates/matching";
export const GET = withRouteAccess(async (request: NextRequest) => {
  await connectToDatabase();
  const status = request.nextUrl.searchParams.get("status") || "PENDING";
  if (!["PENDING", "APPROVED", "REJECTED", "REVOKED"].includes(status))
    return Response.json({ error: "Estado inválido" }, { status: 400 });
  const source = request.nextUrl.searchParams.get("source");
  if (source && !CLAIM_SOURCES.includes(source))
    return Response.json({ error: "Origem inválida" }, { status: 400 });
  // Pedidos de remoção abertos: vínculos aprovados que o aluno disse não serem dele.
  const removalOnly = request.nextUrl.searchParams.get("removal") === "pending";
  const filter = removalOnly
    ? { status: "APPROVED", "removal.requestedAt": { $exists: true }, "removal.resolvedAt": { $exists: false } }
    : source
      ? { status, source }
      : { status };
  const claims = await CertificateClaim.find(filter)
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
    const evidenceEmailMatches = c.evidenceEmail
      ? normalizeEmail(certificate?.ownerEmail) === c.evidenceEmail
      : null;
    data.push({ ...c, profile, certificate, evidenceEmailMatches });
  }
  return Response.json(
    { data },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
