import type { ClientSession } from "mongoose";
import { CertificateClaim } from "./Claim";
import Certificate from "@/lib/models/CertificateModel";

const REASON = "Nome ou CPF do perfil alterado depois do vínculo automático; aguarda revisão.";

/**
 * Trava do vínculo automático: quando o aluno troca o nome ou o CPF do perfil,
 * os certificados vinculados por CPF e nome (e, se o CPF mudou, também por CPF e
 * e-mail) ainda não revisados por um administrador saem do perfil e voltam para
 * revisão. A aprovação do administrador vincula de novo.
 *
 * Roda dentro da transação que grava o perfil: ou as duas coisas acontecem, ou nenhuma.
 */
export async function returnNameCpfLinksToReview(
  profileId: unknown,
  cpfChanged: boolean,
  session: ClientSession,
) {
  const pending = {
    profileId,
    source: cpfChanged ? { $in: ["automatic", "automatic-name-cpf"] } : "automatic-name-cpf",
    status: "APPROVED",
    reviewedBy: null,
  };
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
  }
  return claims.length;
}
