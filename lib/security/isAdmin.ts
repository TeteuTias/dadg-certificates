import type { User } from "@auth0/nextjs-auth0/types";

export const ADMIN_ROLES_CLAIM = "https://dadg.com.br/roles";

function normalizeRoleName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim();
  return normalized || null;
}

export function configuredAdminRoleName(): string | null {
  return normalizeRoleName(process.env.DADG_ADMIN_ROLE_NAME);
}

export function isAdmin(user: User | null): boolean {
  if (!user?.sub) return false;
  const requiredRole = configuredAdminRoleName();
  if (!requiredRole) return false;

  const roles = user[ADMIN_ROLES_CLAIM];
  const authorized = Array.isArray(roles) && roles.some((role) => normalizeRoleName(role) === requiredRole);

  return authorized;
}
