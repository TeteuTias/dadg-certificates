import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifyToken } from "./lib/security/verifyToken"
import { auth0 } from "./lib/auth0"
import GateKeeper from "./lib/security/gatekeeper"
import { API_ROUTE_MAP } from "./lib/security/route-policies"

export async function proxy(request: NextRequest) {
  const authRes = auth0.middleware(request);

  // A REGRA QUE SALVA O AUTH0
  if (request.nextUrl.pathname.startsWith("/auth")) {
    return authRes;
  }

  //  O GateKeeper assume o controle para o resto do sistema
  const keeper = new GateKeeper(request, API_ROUTE_MAP);
  const access = keeper.validate();

  // Segurança por Padrão (Bloqueia o que não está no mapa)
  if (!access.authorized) {
    return NextResponse.json({ message: access.message }, { status: access.status });
  }

  // 4Se for pública, libera sem gastar processamento
  if (!access.requiresAuth) {
    return authRes;
  }

  // PROCESSAMENTO PESADO (Só ocorre se a rota exigir auth)
  const session = await auth0.getSession();
  const authHeader = request.headers.get('authorization');
  let isAuthenticated = false;

  if (authHeader && await verifyToken(authHeader)) {
    isAuthenticated = true;
  } else if (session) {
    isAuthenticated = true;
  }

  // Resposta final se falhar a autenticação
  if (!isAuthenticated) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/auth/login", request.nextUrl.origin));
  }
  console.log(`pode pssar! - ${request.nextUrl.pathname}`)

  return authRes;
}