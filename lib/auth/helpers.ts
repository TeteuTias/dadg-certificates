// Funções puras do login (sem rede, sem cookies do Next) para poderem ser testadas isoladamente.

export const SESSION_COOKIE = "dadg_admin_session";
export const TX_COOKIE = "dadg_auth_tx";
/** JWE compacto é ASCII: 1 caractere = 1 byte. Nome + atributos cabem nos ~4 KB restantes. */
export const COOKIE_CHUNK_SIZE = 3800;

export function oidcScope(audience: string): string {
  return `openid profile email offline_access urn:zitadel:iam:org:project:id:${audience}:aud urn:zitadel:iam:org:projects:roles`;
}

/** Só caminho relativo do próprio site; qualquer outra coisa vira "/". */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  // O parser de URL descarta tab/quebra de linha: "/\t/evil.com" viraria "//evil.com".
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/";
  return value;
}

export function authorizationParameters(
  search: URLSearchParams,
  options: { redirectUri: string; scope: string; codeChallenge: string; state: string; nonce: string },
): Record<string, string> {
  return {
    redirect_uri: options.redirectUri,
    scope: options.scope,
    code_challenge: options.codeChallenge,
    code_challenge_method: "S256",
    state: options.state,
    nonce: options.nonce,
    ...(search.get("screen_hint") === "signup" ? { prompt: "create" } : {}),
  };
}

export function splitCookieValue(value: string, size = COOKIE_CHUNK_SIZE): string[] {
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += size) parts.push(value.slice(i, i + size));
  return parts;
}

/** Junta `name.0`, `name.1`, ... até a primeira parte ausente. */
export function joinCookieParts(name: string, get: (cookieName: string) => string | undefined): string | null {
  let value = "";
  for (let i = 0; ; i++) {
    const part = get(`${name}.${i}`);
    if (part === undefined) break;
    value += part;
  }
  return value || null;
}

/**
 * Partes a gravar e cookies a apagar: partes que sobraram de uma gravação maior e
 * cookies antigos com o mesmo prefixo (o do SDK anterior, sem sufixo ou com `__N`).
 * `value` nulo apaga tudo.
 */
export function planSessionCookies(name: string, value: string | null, existing: string[]) {
  const set = value ? splitCookieValue(value).map((part, i) => [`${name}.${i}`, part] as [string, string]) : [];
  const kept = new Set(set.map(([cookieName]) => cookieName));
  const remove = existing.filter(
    (cookieName) =>
      (cookieName === name || cookieName.startsWith(`${name}.`) || cookieName.startsWith(`${name}__`)) &&
      !kept.has(cookieName),
  );
  return { set, remove };
}
