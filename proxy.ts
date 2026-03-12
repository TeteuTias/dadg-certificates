import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifyToken } from "./lib/auth-api/verifyToken"
import { auth0 } from "./lib/auth0"

export async function proxy(request: NextRequest) {
  const authRes = auth0.middleware(request)
  if (request.nextUrl.pathname.startsWith("/auth")) { // caso ele entre na rota auth.
    return authRes
  }

  // Pegando sessão
  const session = await auth0.getSession()

  // Caso não tenha sessão, envie para login.
  if (!session) {
    // Aqui ele não está autenticado por Cookies!!!
    // Entretanto, ele pode estar autenticado pelo Bearer vindo de uma API. Para isso vamos verificar se ele existe
    const authHeader = request.headers.get('authorization');
    if (authHeader) { // se existir mesmo um Bearer, vamos autentica-lo
      const verf = await verifyToken(authHeader)
      if (verf) {
        // Autenticou. Deixa passar
        return authRes
      }
      // Caso ele não esteja autenticado (nem por Bearer nem por API), ele ainda pode acessar as rotas públicas
      // Por enquanto, vou configurar apenas uma delas. Não vou generalizar para não termos escape de rotas indesejadas, 
      // ou que deveriam ser públicas para essa aplicação apenas
      if (request.nextUrl.pathname.includes("/api/external/dadgsite/public")) {
        // caso seja pública, pode passar.
        return authRes
      }
    }
    return NextResponse.redirect(new URL("/auth/login", request.nextUrl.origin))
  }



  return authRes
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|logoDADG.png|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
}