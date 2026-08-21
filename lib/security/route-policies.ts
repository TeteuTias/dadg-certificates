export type ProtectedAuthType = "student" | "admin";

export type RouteConfig = {
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  allowedOrigins?: string[];
} & (
  | { isPublic: true; authType?: never }
  | { isPublic: false; authType: ProtectedAuthType }
);

const compactOrigins = (...values: Array<string | undefined>) =>
  [...new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.replace(/\/$/, "")))];

const ADMIN_ORIGINS = compactOrigins(
  "http://localhost:3000",
  "https://certificados.dadg.com.br",
  process.env.APP_BASE_URL,
  ...(process.env.ADMIN_ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()),
);

const STUDENT_ORIGINS = compactOrigins(
  "http://localhost:3001",
  "https://dadg.com.br",
  "https://dadg.imepac.edu.br",
  ...(process.env.STUDENT_ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()),
);

const admin = (path: string, method?: RouteConfig["method"]): RouteConfig => ({
  path,
  method,
  isPublic: false,
  authType: "admin",
  allowedOrigins: ADMIN_ORIGINS,
});

const student = (path: string, method?: RouteConfig["method"]): RouteConfig => ({
  path,
  method,
  isPublic: false,
  authType: "student",
  allowedOrigins: STUDENT_ORIGINS,
});

const publicGet = (path: string): RouteConfig => ({ path, method: "GET", isPublic: true });

/**
 * Rotas ordenadas do contrato mais específico para o mais abrangente.
 * Qualquer rota ausente continua negada por padrão no GateKeeper.
 */
export const API_ROUTE_MAP: RouteConfig[] = [
  { path: "^/_next/", isPublic: true },
  { path: "^/auth(/.*)?$", isPublic: true },
  { path: "^/not-allowed$", isPublic: true },

  // Autosserviço autenticado do aluno.
  student("^/api/v1/user/profile/summary$", "GET"),
  student("^/api/v1/user/profile$", "GET"),
  student("^/api/v1/user/profile$", "PUT"),
  student("^/api/v1/events/[0-9a-fA-F]{24}/registration/?$", "GET"),
  student("^/api/v1/events/[0-9a-fA-F]{24}/registration/?$", "POST"),
  student("^/api/v1/events/[0-9a-fA-F]{24}/registration/?$", "DELETE"),
  student("^/api/v1/events/user/[0-9a-fA-F]{24}$", "GET"),
  student("^/api/v1/blog/bookmarks$", "GET"),
  student("^/api/v1/blog/posts/[^/]+/interactions/me$", "GET"),
  student("^/api/v1/blog/posts/[^/]+/(like|bookmark)$", "POST"),
  student("^/api/v1/blog/posts/[^/]+/comments$", "POST"),

  // Gestão de perfis e operações administrativas.
  admin("^/api/v1/admin/profiles/query$", "POST"),
  admin("^/api/v1/admin/profiles/[0-9a-fA-F]{24}$", "GET"),
  admin("^/api/v1/admin/profiles/[0-9a-fA-F]{24}$", "PATCH"),
  admin("^/api/v1/events/[0-9a-fA-F]{24}/participants$", "GET"),
  admin("^/api/v1/events/[0-9a-fA-F]{24}/checkin/scan$", "GET"),
  admin("^/api/v1/events/[0-9a-fA-F]{24}/registration/[0-9a-fA-F]{24}/checkin$", "PATCH"),
  admin("^/api/v1/events/[0-9a-fA-F]{24}/walkin$", "POST"),
  admin("^/api/v1/events/closedForRegistration/[0-9]{4}-[0-9]{2}$", "GET"),
  admin("^/api/v1/blog/admin(/.*)?$"),
  admin("^/api/v1/warnings$", "POST"),
  admin("^/api/v1/settings$", "PUT"),
  admin("^/api/v1/test$"),

  // Leitura pública preservada.
  publicGet("^/api/v1/certificates/[^/]+/(download|scan|template)$"),
  publicGet("^/api/v1/certificates/[^/]+$"),
  publicGet("^/api/v1/certificates$"),
  publicGet("^/api/v1/leagues/[^/]+$"),
  publicGet("^/api/v1/leagues$"),
  publicGet("^/api/v1/events/openForRegistration/[0-9]{4}-[0-9]{2}$"),
  publicGet("^/api/v1/events/calendar$"),
  publicGet("^/api/v1/events/[0-9a-fA-F]{24}$"),
  publicGet("^/api/v1/events$"),
  publicGet("^/api/v1/blog/posts$"),
  publicGet("^/api/v1/blog/posts/by-slug/[^/]+$"),
  publicGet("^/api/v1/blog/posts/[^/]+$"),
  publicGet("^/api/v1/blog/posts/[^/]+/comments$"),
  publicGet("^/api/v1/settings$"),

  // Fallbacks de escrita/gestão, posicionados depois das leituras públicas.
  admin("^/api/v1/certificates"),
  admin("^/api/v1/leagues"),
  admin("^/api/v1/events"),

  // APIs legadas e páginas do aplicativo administrativo.
  admin("^/api/(get|put|delete)/.*$"),
  admin("^/$"),
  admin("^/(createCertificate|criarEvento|historicoDeModificacoes|Avisos|todosCertificados|todosEventos|Silvio|configuracoes|usuarios)(/.*)?$"),
  admin("^/teste$"),
  admin("^/Silvio\\.png$"),
];
