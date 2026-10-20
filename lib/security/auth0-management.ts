import { configuredOperatorRoleName } from "./isAdmin";

/**
 * Cliente mínimo da Management API do Auth0, só para ver, dar e tirar a role
 * de operador de presença. Usa uma aplicação M2M própria, com as permissões
 * read:roles, read:users, create:role_members e delete:role_members.
 */
export class Auth0ManagementError extends Error {
  constructor(
    public code: "NOT_CONFIGURED" | "ROLE_NOT_FOUND" | "UPSTREAM",
    message: string,
  ) {
    super(message);
  }
}

let cachedToken: { base: string; token: string; expiresAt: number } | null = null;
let cachedRole: { name: string; id: string } | null = null;

function baseUrl(): string | null {
  const raw = process.env.AUTH0_DOMAIN?.trim();
  if (!raw) return null;
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).origin;
  } catch {
    return null;
  }
}

function credentials() {
  const clientId = process.env.AUTH0_MANAGEMENT_CLIENT_ID?.trim();
  const clientSecret = process.env.AUTH0_MANAGEMENT_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function operatorManagementConfigured(): boolean {
  return Boolean(baseUrl() && credentials() && configuredOperatorRoleName());
}

async function accessToken(base: string): Promise<string> {
  if (cachedToken?.base === base && cachedToken.expiresAt > Date.now() + 60_000)
    return cachedToken.token;
  const creds = credentials()!;
  const response = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      audience: `${base}/api/v2/`,
    }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!response.ok || !data.access_token)
    throw new Auth0ManagementError("UPSTREAM", "O Auth0 recusou a credencial de gerenciamento.");
  cachedToken = {
    base,
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

async function call(path: string, init: { method?: string; body?: string } = {}): Promise<unknown> {
  const base = baseUrl();
  if (!base || !operatorManagementConfigured())
    throw new Auth0ManagementError("NOT_CONFIGURED", "Gestão de operadores não configurada.");
  const response = await fetch(`${base}/api/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken(base)}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok)
    throw new Auth0ManagementError("UPSTREAM", `O Auth0 respondeu ${response.status}.`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function operatorRoleId(): Promise<string> {
  const name = configuredOperatorRoleName();
  if (!name) throw new Auth0ManagementError("NOT_CONFIGURED", "Gestão de operadores não configurada.");
  if (cachedRole?.name === name) return cachedRole.id;
  const roles = (await call(`/roles?name_filter=${encodeURIComponent(name)}`)) as Array<{ id: string; name: string }>;
  // name_filter do Auth0 é por trecho do nome; a autorização compara o nome exato.
  const role = Array.isArray(roles) ? roles.find((r) => r.name?.normalize("NFKC").trim() === name) : undefined;
  if (!role) throw new Auth0ManagementError("ROLE_NOT_FOUND", `A role "${name}" não existe no Auth0.`);
  cachedRole = { name, id: role.id };
  return role.id;
}

export async function hasOperatorRole(userId: string): Promise<boolean> {
  const roleId = await operatorRoleId();
  const roles = (await call(`/users/${encodeURIComponent(userId)}/roles?per_page=100`)) as Array<{ id: string }>;
  return Array.isArray(roles) && roles.some((r) => r.id === roleId);
}

export async function setOperatorRole(userId: string, enabled: boolean): Promise<void> {
  const roleId = await operatorRoleId();
  await call(`/users/${encodeURIComponent(userId)}/roles`, {
    method: enabled ? "POST" : "DELETE",
    body: JSON.stringify({ roles: [roleId] }),
  });
}
