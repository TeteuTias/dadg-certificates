import type { ProtectedAuthType } from "./route-policies";

/** "admin" identifica uma sessão do painel; o papel dela vem das roles. */
export type PrincipalKind = "student" | "admin";

export function authorizePrincipal(
  authType: ProtectedAuthType,
  principalKind: PrincipalKind | null,
  adminAuthorized: boolean,
  operatorAuthorized = false,
) {
  if (!principalKind) return { authorized: false, status: 401, code: "NOT_AUTHENTICATED" } as const;
  if (authType === "student") {
    return principalKind === "student"
      ? { authorized: true } as const
      : { authorized: false, status: 403, code: "STUDENT_CREDENTIAL_REQUIRED" } as const;
  }
  if (authType === "operator") {
    // Rotas da lista de presença: administrador ou operador de presença.
    return principalKind === "admin" && (adminAuthorized || operatorAuthorized)
      ? { authorized: true } as const
      : { authorized: false, status: 403, code: "OPERATOR_ACCESS_DENIED" } as const;
  }
  return principalKind === "admin" && adminAuthorized
    ? { authorized: true } as const
    : { authorized: false, status: 403, code: "ADMIN_ACCESS_DENIED" } as const;
}
