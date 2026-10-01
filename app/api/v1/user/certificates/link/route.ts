import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { eventIdentity } from "@/lib/events/identity";
import { CertificateClaim } from "@/lib/certificates/Claim";
import Certificate from "@/lib/models/CertificateModel";
import { decryptCpf } from "@/lib/profile/crypto";
import { canAutoLink } from "@/lib/certificates/matching";
import { escapeSearch } from "@/lib/certificates/public-contract";
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
    const { profile, email } = await eventIdentity(request);
    const cpf = decryptCpf(profile.cpfEncrypted).replace(/\D/g, "");
    const formattedCpf = cpf.replace(
      /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
      "$1.$2.$3-$4",
    );
    const candidates = await Certificate.find({
      isReady: true,
      profileId: null,
      ownerCpf: { $in: [cpf, formattedCpf] },
      ownerEmail: { $regex: `^${escapeSearch(email)}$`, $options: "i" },
    })
      .limit(100)
      .lean();
    let linked = 0;
    for (const certificate of candidates) {
      if (!canAutoLink(certificate, cpf, email, true)) continue;
      const session = await mongoose.startSession();
      let attached = false;
      try {
        await session.withTransaction(async () => {
          attached = false;
          const claimId = `${profile._id}:${certificate._id}`;
          const existing =
            await CertificateClaim.findById(claimId).session(session);
          if (existing) return; // Every manual decision or pending review takes precedence.

          const result = await Certificate.updateOne(
            { _id: certificate._id, isReady: true, profileId: null },
            { $set: { profileId: profile._id } },
            { session },
          );
          if (result.modifiedCount) {
            attached = true;
            await CertificateClaim.create(
              [
                {
                  _id: claimId,
                  certificateId: certificate._id,
                  profileId: profile._id,
                  status: "APPROVED",
                  source: "automatic",
                  reason:
                    "CPF válido e e-mail autenticado verificado correspondentes",
                  reviewedAt: new Date(),
                  history: [
                    {
                      status: "APPROVED",
                      reason: "CPF e e-mail verificados",
                      actor: "automatic",
                      at: new Date(),
                    },
                  ],
                },
              ],
              { session },
            );
          }
        });
        if (attached) linked++;
      } finally {
        await session.endSession();
      }
    }
    return Response.json(
      { linked },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof EventError ? e.message : "Falha ao verificar vínculos.",
      },
      { status: e instanceof EventError ? e.status : 500 },
    );
  }
});
