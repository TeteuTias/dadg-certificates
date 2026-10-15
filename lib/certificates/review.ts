import mongoose from "mongoose";
import { CertificateClaim } from "./Claim";
import Certificate from "@/lib/models/CertificateModel";

const REASON = "Nome ou CPF do perfil alterado depois do vínculo por CPF e nome; aguarda revisão.";

/**
 * Trava do vínculo por CPF e nome: quando o aluno troca o nome ou o CPF do
 * perfil, os certificados vinculados por essa regra e ainda não revisados por
 * um administrador saem do perfil e voltam para revisão. A aprovação do
 * administrador vincula de novo.
 */
export async function returnNameCpfLinksToReview(profileId: unknown) {
  const pending = { profileId, source: "automatic-name-cpf", status: "APPROVED", reviewedBy: null };
  if (!(await CertificateClaim.exists(pending))) return 0;
  let moved = 0;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      moved = 0;
      const claims = await CertificateClaim.find(pending).session(session);
      for (const claim of claims) {
        await Certificate.updateOne(
          { _id: claim.certificateId, profileId },
          { $unset: { profileId: 1 } },
          { session },
        );
        claim.status = "PENDING";
        claim.reason = REASON;
        claim.history.push({ status: "PENDING", reason: REASON, actor: "system", at: new Date() });
        await claim.save({ session });
        moved++;
      }
    });
  } finally {
    await session.endSession();
  }
  return moved;
}
