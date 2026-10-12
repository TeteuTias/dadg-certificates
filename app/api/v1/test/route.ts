import { withRouteAccess } from "@/lib/security/route-access";
import { NextRequest } from "next/server";
import GateKeeper from "@/lib/security/gatekeeper";

//
//
/**
 * 
 * @abstract Apenas testa a sessão. 
 */
async function GETHandler(req: NextRequest) {
    return Response.json({ "ola": await new GateKeeper(req).identifySession() })
}
export const GET = withRouteAccess(GETHandler);
