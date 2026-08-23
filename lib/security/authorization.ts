import type { ProtectedAuthType } from "./route-policies";

export type PrincipalKind = "student" | "admin";

export function authorizePrincipal(
  authType: ProtectedAuthType,
  principalKind: PrincipalKind | null,
  adminAuthorized: boolean,
) {
  if (!principalKind) return { authorized: false, status: 401, code: "NOT_AUTHENTICATED" } as const;
  if (authType === "student") {
    return principalKind === "student"
      ? { authorized: true } as const
      : { authorized: false, status: 403, code: "STUDENT_CREDENTIAL_REQUIRED" } as const;
  }
  return principalKind === "admin" && adminAuthorized
    ? { authorized: true } as const
    : { authorized: false, status: 403, code: "ADMIN_ACCESS_DENIED" } as const;
}
