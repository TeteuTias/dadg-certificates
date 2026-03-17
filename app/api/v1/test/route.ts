import { NextRequest } from "next/server";
import GateKeeper from "@/lib/security/gatekeeper";

//
//
/**
 * 
 * @abstract Apenas testa a sessão. 
 */
export async function GET(req: NextRequest) {
    return Response.json({ "ola": await new GateKeeper(req).identifySession() })
}