import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { eventIdentity } from "@/lib/events/identity";
import { CertificateClaim } from "@/lib/certificates/Claim";
import Certificate from "@/lib/models/CertificateModel";
import UserProfileModel from "@/lib/models/UserProfileModel";
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
// Documento cru do acervo: o driver nativo devolve os tipos como estão gravados.
type RawCertificate = { ownerCpf?: unknown; ownerEmail?: unknown; ownerName?: unknown };
export const POST = withRouteAccess(async (request: NextRequest) => {
  if (process.env.CERTIFICATE_AUTO_LINK_ENABLED !== "true")
    return Response.json(
      {
        error:
          "Vínculo automático aguardando auditoria do acervo. Solicite revisão manual.",
      },
      { status: 409 },
    );
  let linked = 0;
  try {
    // Sem envio de e-mail de verificação: vale o e-mail informado no cadastro.
    const { profile, email } = await eventIdentity(request, true, false);
    const cpf = decryptCpf(profile.cpfEncrypted).replace(/\D/g, "");
    // Qualquer formato, CPF gravado como número e zeros à esquerda perdidos.
    const cpfFilter = cpfSearchFilter(cpf);
    // Driver nativo: o cast do Mongoose (ownerCpf é String no schema) transformaria o
    // ramo numérico do filtro em texto e o CPF gravado como número nunca seria achado.
    // Sem limite: são os certificados de um único CPF, e um corte deixaria o resto sem avaliação.
    const candidates = await Certificate.collection
      .find<RawCertificate & { _id: unknown }>({ isReady: true, profileId: null, ...cpfFilter })
      .sort({ _id: 1 })
      .toArray();

    // Conferência do acervo para o vínculo por nome, feita uma vez e só se precisar.
    let consistent: boolean | undefined;
    const cpfConsistent = async () => {
      if (consistent !== undefined) return consistent;
      const sameCpf = await Certificate.collection
        .find<RawCertificate>(cpfFilter, { projection: { ownerName: 1, ownerEmail: 1 } })
        .toArray();
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

    let stale = false;
    for (const certificate of candidates) {
      if (stale) break;
      const byEmail = canAutoLink(certificate, cpf, email);
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
          // Cerca no perfil (mesmo padrão de lib/selective-processes/reports/service.ts):
          // uma escrita real, condicionada à identidade avaliada, conflita com a troca de
          // nome ou CPF em andamento. Uma leitura dentro da transação não bloquearia nada.
          const fenced = await UserProfileModel.updateOne(
            { _id: profile._id, cpfLookup: profile.cpfLookup, name: profile.name },
            { $inc: { __v: 1 } },
            { session, timestamps: false },
          );
          if (fenced.matchedCount !== 1) {
            stale = true;
            return;
          }
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
                    ? "CPF válido e e-mail da conta correspondentes"
                    : "CPF válido e nome completo correspondentes; e-mail do certificado diferente do da conta",
                  reviewedAt: new Date(),
                  history: [
                    {
                      status: "APPROVED",
                      reason: byEmail ? "CPF e e-mail" : "CPF e nome completo",
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
    if (!(e instanceof EventError)) console.error("[certificates/link]", e);
    return Response.json(
      {
        error:
          e instanceof EventError ? e.message : "Falha ao verificar vínculos.",
        linked,
      },
      { status: e instanceof EventError ? e.status : 500 },
    );
  }
});
