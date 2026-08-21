import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth0 } from "./lib/auth0"
import GateKeeper from "./lib/security/gatekeeper"


/**
 * 
 * @abstract Nova autenticação, fazendo a autenticação dentro de cada roat
 */
export async function proxy(request: NextRequest) {
  const authRes = await auth0.middleware(request);

  // Regra de bypass para as rotas do próprio Auth0
  if (request.nextUrl.pathname.startsWith("/auth")) {
    return authRes;
  }

  // Instancia o Keeper
  const keeper = new GateKeeper(request);

  // Veredito final de acesso (Auth + Permissões)
  const access = await keeper.validate();
  // Negado
  if (!access.authorized) {
    // Se for uma chamada de API, devolvemos JSON (401 ou 403)
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: access.message, code: access.code },
        { status: access.status || 401, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const destination = access.status === 403 ? "/not-allowed" : "/auth/login";
    const response = NextResponse.redirect(new URL(destination, request.nextUrl.origin));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  // 4. SE CHEGOU AQUI: Está validado, autenticado e (se necessário) autorizado.
  if (access.principal) authRes.headers.set("Cache-Control", "private, no-store");
  return authRes;
}
