import type { User } from "@/lib/auth/types";

/** Claim do Zitadel: objeto cujas CHAVES são os nomes dos papéis, ex.: {"Administrador": {...}}. */
export const ADMIN_ROLES_CLAIM = "urn:zitadel:iam:org:project:roles";

export type StaffRole = "admin" | "operator";

function normalizeRoleName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim();
  return normalized || null;
}

export function roleNamesFromClaim(value: unknown): string[] {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];
}

export function configuredAdminRoleName(): string | null {
  return normalizeRoleName(process.env.DADG_ADMIN_ROLE_NAME);
}

/** Role restrita à lista de presença (ler QR, entrada, saída e lançamento manual). */
export function configuredOperatorRoleName(): string | null {
  return normalizeRoleName(process.env.DADG_OPERATOR_ROLE_NAME);
}

function hasRole(user: User | null, requiredRole: string | null): boolean {
  if (!user?.sub || !requiredRole) return false;
  // Na sessão os papéis já vêm em `roles`; em claims crus, do objeto do Zitadel.
  const roles: unknown[] = Array.isArray(user.roles) ? user.roles : roleNamesFromClaim(user[ADMIN_ROLES_CLAIM]);
  return roles.some((role) => normalizeRoleName(role) === requiredRole);
}

export function isAdmin(user: User | null): boolean {
  return hasRole(user, configuredAdminRoleName());
}

export function isOperator(user: User | null): boolean {
  return hasRole(user, configuredOperatorRoleName());
}

/** Papel da sessão no painel: administrador prevalece sobre operador. */
export function staffRole(user: User | null): StaffRole | null {
  if (isAdmin(user)) return "admin";
  if (isOperator(user)) return "operator";
  return null;
}
