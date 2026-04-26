import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth0 } from "./lib/auth0"
import GateKeeper from "./lib/security/gatekeeper"


/**
 * 
 * @abstract Nova autenticação, fazendo a autenticação dentro de cada roat
 */
export async function proxy(request: NextRequest) {
  const authRes = auth0.middleware(request);

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
        { success: false, message: access.message },
        { status: access.status || 401 }
      );
    }

    // Se for acesso via navegador em página protegida, manda pro Login
    return NextResponse.redirect(new URL("/auth/login", request.nextUrl.origin));
  }

  // 4. SE CHEGOU AQUI: Está validado, autenticado e (se necessário) autorizado.
  return authRes;
}