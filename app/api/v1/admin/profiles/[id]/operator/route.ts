import { withRouteAccess } from "@/lib/security/route-access";
import { ObjectId } from "bson";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import ProfileAuditModel from "@/lib/models/ProfileAuditModel";
import UserProfileModel from "@/lib/models/UserProfileModel";
import GateKeeper from "@/lib/security/gatekeeper";
import {
  Auth0ManagementError,
  hasOperatorRole,
  operatorManagementConfigured,
  setOperatorRole,
} from "@/lib/security/auth0-management";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ id: string }> };

/**
 * Role de operador de presença do perfil no Auth0.
 * GET devolve o estado; PUT { enabled } dá ou tira a role e registra no histórico do perfil.
 */
async function handle(request: NextRequest, { params }: Context) {
  const actor = await new GateKeeper(request).identifyAdmin();
  if (!actor)
    return NextResponse.json({ success: false, code: "ADMIN_ACCESS_DENIED" }, { status: 403, headers });
  const { id } = await params;
  if (!ObjectId.isValid(id))
    return NextResponse.json({ success: false, error: "Perfil inválido." }, { status: 400, headers });
  if (!operatorManagementConfigured())
    return NextResponse.json({ success: true, configured: false, isOperator: null }, { headers });

  let enabled: boolean | undefined;
  if (request.method === "PUT") {
    const body = (await request.json().catch(() => ({}))) as { enabled?: unknown };
    if (typeof body.enabled !== "boolean")
      return NextResponse.json({ success: false, error: "Informe enabled como verdadeiro ou falso." }, { status: 400, headers });
    enabled = body.enabled;
  }

  try {
    await connectToDatabase();
    const profile = await UserProfileModel.findById(id).select("authSubject").lean();
    if (!profile)
      return NextResponse.json({ success: false, error: "Perfil não encontrado." }, { status: 404, headers });

    if (enabled === undefined) {
      const isOperator = await hasOperatorRole(profile.authSubject);
      return NextResponse.json({ success: true, configured: true, isOperator }, { headers });
    }

    await setOperatorRole(profile.authSubject, enabled);
    await ProfileAuditModel.create({
      profileId: profile._id,
      actorIssuer: process.env.AUTH0_DOMAIN ? `https://${process.env.AUTH0_DOMAIN}/` : "admin-auth0",
      actorSubject: actor.sub,
      action: enabled ? "profile.operator_granted" : "profile.operator_revoked",
      changedFields: ["operatorRole"],
      createdAt: new Date(),
    });
    return NextResponse.json({ success: true, configured: true, isOperator: enabled }, { headers });
  } catch (error) {
    if (error instanceof Auth0ManagementError) {
      const status = error.code === "UPSTREAM" ? 502 : 409;
      return NextResponse.json({ success: false, code: error.code, error: error.message }, { status, headers });
    }
    console.error("[PROFILE_OPERATOR]", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ success: false, error: "Não foi possível atualizar a role." }, { status: 500, headers });
  }
}

export const GET = withRouteAccess(handle);
export const PUT = withRouteAccess(handle);
