import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

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
    // user is not authenticated, redirect to login page
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