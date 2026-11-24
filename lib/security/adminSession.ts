import type { Session } from "@/lib/auth/types";
import { ADMIN_ROLES_CLAIM, roleNamesFromClaim } from "./isAdmin";

type Claims = Record<string, unknown> | undefined | null;

/**
 * Monta o usuário guardado na sessão só com os campos usados pelo painel.
 * `sources` em ordem de prioridade (id_token, userinfo, access token); os papéis
 * são a união das chaves do claim do Zitadel em todas as fontes.
 */
export function adminSessionUser(...sources: Claims[]): Session["user"] {
  const pick = (key: string) => sources.find((claims) => claims?.[key] !== undefined)?.[key];
  const sub = pick("sub");
  if (typeof sub !== "string" || !sub) throw new Error("sub ausente");
  const email = pick("email");
  const emailVerified = pick("email_verified");
  const name = pick("name");
  const roles = [...new Set(sources.flatMap((claims) => roleNamesFromClaim(claims?.[ADMIN_ROLES_CLAIM])))];
  return {
    sub,
    ...(typeof email === "string" ? { email } : {}),
    ...(typeof emailVerified === "boolean" ? { email_verified: emailVerified } : {}),
    ...(typeof name === "string" ? { name } : {}),
    roles,
  };
}
