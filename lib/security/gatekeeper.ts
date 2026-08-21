import type { User } from "@auth0/nextjs-auth0/types";
import type { JWTPayload } from "jose";
import type { NextRequest } from "next/server";
import { auth0 } from "../auth0";
import { isAdmin } from "./isAdmin";
import { API_ROUTE_MAP, type RouteConfig } from "./route-policies";
import { AuthConfigurationError, verifyStudentToken } from "./verifyToken";
import { authorizePrincipal } from "./authorization";

type Principal = {
  kind: "student" | "admin";
  user: User;
};

export type AccessDecision = {
  authorized: boolean;
  status?: number;
  code?: string;
  message?: string;
  principal?: Principal;
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function requestOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export default class GateKeeper {
  private readonly path: string;
  private readonly method: string;
  private readonly request: NextRequest;
  private principalPromise: Promise<Principal | null> | null = null;

  constructor(request: NextRequest) {
    this.request = request;
    this.path = request.nextUrl.pathname;
    this.method = request.method.toUpperCase();
  }

  private findPolicy(): RouteConfig | undefined {
    return API_ROUTE_MAP.find((route) => {
      const pathMatches = new RegExp(route.path).test(this.path);
      return pathMatches && (!route.method || route.method === this.method);
    });
  }

  private async identifyPrincipal(): Promise<Principal | null> {
    if (this.principalPromise) return this.principalPromise;
    this.principalPromise = (async () => {
      const authorization = this.request.headers.get("authorization");
      if (authorization) {
        const payload = await verifyStudentToken(authorization);
        return payload?.sub ? { kind: "student", user: payload as User } : null;
      }

      try {
        const session = await auth0.getSession(this.request);
        return session?.user ? { kind: "admin", user: session.user } : null;
      } catch {
        return null;
      }
    })();
    return this.principalPromise;
  }

  public async validate(): Promise<AccessDecision> {
    const policy = this.findPolicy();
    if (!policy) {
      return { authorized: false, status: 403, code: "ROUTE_NOT_MAPPED", message: "Rota não autorizada." };
    }
    if (policy.isPublic) return { authorized: true };

    try {
      const principal = await this.identifyPrincipal();
      const authType = policy.authType;
      const decision = authorizePrincipal(authType, principal?.kind || null, principal?.kind === "admin" && isAdmin(principal.user));
      if (!decision.authorized) {
        return { ...decision, message: decision.status === 401 ? "Autenticação necessária." : "Acesso não autorizado." };
      }

      const origin = requestOrigin(this.request);
      const declaredOrigins = policy.allowedOrigins?.map((value) => value.replace(/\/$/, "")) || [];
      const sameOrigin = origin === this.request.nextUrl.origin.replace(/\/$/, "");
      const declaredOrigin = origin ? declaredOrigins.includes(origin) : false;

      if (principal?.kind === "admin" && !SAFE_METHODS.has(this.method) && (!origin || (!sameOrigin && !declaredOrigin))) {
        return { authorized: false, status: 403, code: "INVALID_REQUEST_ORIGIN", message: "Origem da requisição não autorizada." };
      }
      if (origin && declaredOrigins.length && !sameOrigin && !declaredOrigin) {
        return { authorized: false, status: 403, code: "INVALID_REQUEST_ORIGIN", message: "Origem da requisição não autorizada." };
      }

      return { authorized: true, principal: principal || undefined };
    } catch (error) {
      if (error instanceof AuthConfigurationError) {
        return { authorized: false, status: 503, code: "AUTH_CONFIGURATION_ERROR", message: "Autenticação temporariamente indisponível." };
      }
      return { authorized: false, status: 401, code: "NOT_AUTHENTICATED", message: "Autenticação necessária." };
    }
  }

  public async identifyStudent(): Promise<(User & JWTPayload) | null> {
    try {
      const principal = await this.identifyPrincipal();
      return principal?.kind === "student" ? principal.user as User & JWTPayload : null;
    } catch {
      return null;
    }
  }

  public async identifyAdmin(): Promise<User | null> {
    const principal = await this.identifyPrincipal();
    return principal?.kind === "admin" && isAdmin(principal.user) ? principal.user : null;
  }

  /** Compatibilidade com handlers; a política da rota já foi aplicada pelo proxy. */
  public async identifySession(): Promise<User | null> {
    try {
      return (await this.identifyPrincipal())?.user || null;
    } catch {
      return null;
    }
  }
}
