import { createHash } from "node:crypto";

export const PROFILE_PRIVACY_NOTICE_VERSION = "dadg-profile-privacy-v2";

export const PROFILE_PRIVACY_NOTICE = {
  version: PROFILE_PRIVACY_NOTICE_VERSION,
  title: "Aviso de Privacidade e LGPD",
  introduction:
    "Em conformidade com a Lei Geral de Proteção de Dados Pessoais — LGPD (Lei nº 13.709/2018), solicitamos sua ciência e concordância com a coleta e o tratamento dos dados pessoais necessários ao seu perfil no DADG.",
  sections: [
    {
      title: "1. Finalidade do tratamento",
      text: "Nome completo, CPF, período, matrícula/RA, data de nascimento, telefone, e-mail de contato e e-mail da conta serão utilizados para identificação, cadastro, inscrições, participação em atividades, comunicação operacional, certificados e organização dos processos seletivos da CLAM. Os dados necessários constarão nas listas de participantes, provas e correção disponibilizadas aos organizadores responsáveis.",
    },
    {
      title: "2. Compartilhamento de dados",
      text: "As informações não serão comercializadas nem cedidas a terceiros sem relação com essas finalidades. O compartilhamento ocorrerá somente quando necessário com serviços que apoiam a autenticação, hospedagem, armazenamento, comunicação, realização de eventos e emissão ou validação de certificados, observadas as medidas de proteção aplicáveis.",
    },
    {
      title: "3. Segurança e armazenamento",
      text: "Os dados serão protegidos por medidas técnicas e administrativas contra acesso não autorizado, perda, alteração ou divulgação indevida e serão mantidos pelo período necessário ao cumprimento das finalidades descritas e das obrigações legais aplicáveis.",
    },
    {
      title: "4. Direitos do titular",
      text: "O titular pode solicitar confirmação do tratamento, acesso, correção, anonimização, bloqueio ou exclusão dos dados, quando aplicável, por meio da Ouvidoria do DADG.",
    },
  ],
  acceptanceText:
    "Li e concordo com o tratamento dos meus dados pessoais para as finalidades descritas acima, nos termos da Lei nº 13.709/2018 (LGPD).",
} as const;

export const PROFILE_PRIVACY_NOTICE_HASH = createHash("sha256")
  .update(JSON.stringify(PROFILE_PRIVACY_NOTICE), "utf8")
  .digest("hex");

export function isCurrentPrivacyAcceptance(
  version: unknown,
  hash: unknown,
): boolean {
  return (
    version === PROFILE_PRIVACY_NOTICE_VERSION &&
    hash === PROFILE_PRIVACY_NOTICE_HASH
  );
}
