import { filterDefaultIdTokenClaims } from "@auth0/nextjs-auth0/server";
import type { User } from "@auth0/nextjs-auth0/types";
import { ADMIN_ROLES_CLAIM } from "./isAdmin";

/**
 * Mantém o conjunto mínimo padrão do SDK e a única claim personalizada usada
 * para autorização administrativa. O SDK Auth0 v4 remove claims personalizadas
 * da sessão quando `beforeSessionSaved` não é configurado.
 */
export function adminSessionUser(user: User): User {
  const filteredUser = filterDefaultIdTokenClaims(user) as User;
  const roles = user[ADMIN_ROLES_CLAIM];

  if (!Array.isArray(roles)) return filteredUser;

  const safeRoles = roles.filter((role): role is string => typeof role === "string");
  if (safeRoles.length === 0) return filteredUser;

  return {
    ...filteredUser,
    [ADMIN_ROLES_CLAIM]: safeRoles,
  };
}
