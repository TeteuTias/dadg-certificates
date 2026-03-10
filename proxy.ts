import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifyToken } from "./lib/jose/verifyToken"
import { auth0 } from "./lib/auth0"

export async function proxy(request: NextRequest) {
  const authRes = auth0.middleware(request)
  const authHeader = request.headers.get('authorization')
  console.log(authHeader)
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

  const a = await verifyToken("eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InA0WkI0VXkxM2VuVWJKYzRaVlktUiJ9.eyJuaWNrbmFtZSI6Im1hdGV1czIuMCIsIm5hbWUiOiJtYXRldXMyLjBAaWNsb3VkLmNvbSIsInBpY3R1cmUiOiJodHRwczovL3MuZ3JhdmF0YXIuY29tL2F2YXRhci80ZTdlMTc2MDM2MGM0YTYwODlhNjkxMzRhMzVmYWZkZD9zPTQ4MCZyPXBnJmQ9aHR0cHMlM0ElMkYlMkZjZG4uYXV0aDAuY29tJTJGYXZhdGFycyUyRm1hLnBuZyIsInVwZGF0ZWRfYXQiOiIyMDI2LTAzLTEwVDAwOjIyOjUxLjgzMVoiLCJlbWFpbCI6Im1hdGV1czIuMEBpY2xvdWQuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJpc3MiOiJodHRwczovL2Rldi1xZDNneXFwMWg2bmFjbng4LnVzLmF1dGgwLmNvbS8iLCJhdWQiOiJ2RGlucTlHR3pjVFNoQ1lqS2c4REc4OFlRdkd2eGcweSIsInN1YiI6ImF1dGgwfDY3YmJkMjllNDRhN2JiODY4MTgxNGY0ZCIsImlhdCI6MTc3MzEwMjE3MiwiZXhwIjoxNzczMTM4MTcyLCJzaWQiOiJIWm9TWk9RLVAySmJKY00wSEFSSy0zVTg2ZXFlbjhRQyIsIm5vbmNlIjoiRm9iWWtkR21WVWdDTDVuUGVsRFYtYkxFSXR2NjV6bTM5bGdrQlByN2d0YyJ9.btX-A3vgjr3Hojhg63c_y-hJFCuTS7DbcqpKdsf2nhKlHXVYI1_4q-dL63pwfzM3oc4uSLSKjxpjY2sli7X6cL7O7RjNOwKPPR0Ate0hm2gL7Ji5xt5NMju-cUn-pV8syATfnsJxkclPBnwHqJp_ouqfHWacXugLkfLV5kR5xDj3g8XGdK7l-ztLeF3HQvM1C5dbOTrlfktuK_2I0uqdGdJ7vm211aoJApaTo55WFvowdMpTwvfb5IhadsfKoVoITomsBo0t3mWUFB7CxB-4yNneO3LHNF2CbsZL2IObD6Q2Qn5QUSZn4A_wijHErw668OcjxEsPW9pgg3eXkYUTQg", process.env.AUTH0_DOMAIN || "", process.env.AUTH0_DOMAIN || "")
  console.log(a)


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