import type { ClientSession } from "mongoose";
import { CertificateClaim } from "./Claim";
import Certificate from "@/lib/models/CertificateModel";

const REASON = "Dados do perfil alterados depois do vínculo automático; aguarda revisão.";

/** Quais origens de vínculo dependem de cada dado do perfil. */
const DEPENDS_ON = {
  cpf: ["automatic", "automatic-name-cpf", "automatic-email-name", "automatic-name", "automatic-name-unknown-email"],
  name: ["automatic-name-cpf", "automatic-email-name", "automatic-name", "automatic-name-unknown-email"],
  // RA e e-mail de contato viram e-mails do aluno na regra sem CPF.
  contact: ["automatic-email-name"],
};

/**
 * Trava do vínculo automático: quando o aluno troca CPF, nome, RA ou e-mail de
 * contato, os vínculos automáticos que dependiam desse dado e ainda não foram
 * revisados por um administrador saem do perfil e voltam para revisão. A
 * aprovação do administrador vincula de novo.
 *
 * Roda dentro da transação que grava o perfil: ou as duas coisas acontecem, ou nenhuma.
 */
export async function returnAutomaticLinksToReview(
  profileId: unknown,
  changed: { cpf?: boolean; name?: boolean; contact?: boolean },
  session: ClientSession,
) {
  const sources = [
    ...new Set((Object.keys(DEPENDS_ON) as Array<keyof typeof DEPENDS_ON>).filter((k) => changed[k]).flatMap((k) => DEPENDS_ON[k])),
  ];
  if (!sources.length) return 0;
  const claims = await CertificateClaim.find({ profileId, source: { $in: sources }, status: "APPROVED", reviewedBy: null }).session(session);
  for (const claim of claims) {
    // Trabalho em conjunto pode ter outro dono no certificado: só sai o vínculo deste perfil.
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
