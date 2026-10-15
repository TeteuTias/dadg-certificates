import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { eventIdentity } from "@/lib/events/identity";
import { CertificateClaim } from "@/lib/certificates/Claim";
import Certificate from "@/lib/models/CertificateModel";
import { decryptCpf } from "@/lib/profile/crypto";
import {
  canAutoLink,
  canLinkByNameAndCpf,
  cpfIsConsistent,
  cpfSearchFilter,
  normalizeEmail,
} from "@/lib/certificates/matching";
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
    // Qualquer formato, CPF gravado como número e zeros à esquerda perdidos.
    const cpfFilter = cpfSearchFilter(cpf);
    const candidates = await Certificate.find({
      isReady: true,
      profileId: null,
      ...cpfFilter,
    })
      .limit(100)
      .lean();

    // Conferência do acervo para o vínculo por nome, feita uma vez e só se precisar.
    let consistent: boolean | undefined;
    const cpfConsistent = async () => {
      if (consistent !== undefined) return consistent;
      const sameCpf = await Certificate.find(cpfFilter)
        .select("ownerName ownerEmail")
        .lean();
      const emails = [...new Set(sameCpf.map((c) => normalizeEmail(c.ownerEmail)).filter(Boolean))];
      const sharing = emails.length
        ? await Certificate.find({
            ownerEmail: {
              $regex: `^\\s*(${emails.map(escapeSearch).join("|")})\\s*$`,
              $options: "i",
            },
          })
            .select("ownerCpf")
            .lean()
        : [];
      consistent = cpfIsConsistent(sameCpf, sharing, cpf);
      return consistent;
    };

    let linked = 0;
    for (const certificate of candidates) {
      const byEmail = canAutoLink(certificate, cpf, email, true);
      const byName =
        !byEmail &&
        canLinkByNameAndCpf(certificate, cpf, profile.name) &&
        (await cpfConsistent());
      if (!byEmail && !byName) continue;
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
                  source: byEmail ? "automatic" : "automatic-name-cpf",
                  reason: byEmail
                    ? "CPF válido e e-mail autenticado verificado correspondentes"
                    : "CPF válido e nome completo correspondentes; e-mail do certificado diferente do da conta",
                  reviewedAt: new Date(),
                  history: [
                    {
                      status: "APPROVED",
                      reason: byEmail ? "CPF e e-mail verificados" : "CPF e nome completo",
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
