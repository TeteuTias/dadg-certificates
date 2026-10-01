import { publicRateLimit } from "./public-rate-limit";
import { NextRequest, NextResponse } from "next/server";
import GateKeeper from "./gatekeeper";
export function withRouteAccess<C>(
  handler: (request: NextRequest, context: C) => Promise<Response>,
) {
  return async (request: NextRequest, context: C): Promise<Response> => {
    if (
      request.method === "GET" &&
      /\/certificates\//.test(request.nextUrl.pathname) &&
      !publicRateLimit(request)
    )
      return NextResponse.json(
        { error: "Aguarde um minuto antes de consultar novamente." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    const decision = await new GateKeeper(request).validate();
    if (!decision.authorized)
      return NextResponse.json(
        { error: decision.message, code: decision.code },
        {
          status: decision.status || 403,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    return handler(request, context);
  };
}
