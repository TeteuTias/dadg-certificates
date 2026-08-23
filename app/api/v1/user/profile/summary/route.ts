import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import {
  assertProfileCryptoConfigured,
  ProfileCryptoConfigurationError,
} from "@/lib/profile/crypto";
import {
  identityFromToken,
  profileSummary,
  ProfileRequestError,
} from "@/lib/profile/service";
import GateKeeper from "@/lib/security/gatekeeper";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  try {
    assertProfileCryptoConfigured();
    const user = await new GateKeeper(request).identifyStudent();
    if (!user)
      throw new ProfileRequestError(
        401,
        "NOT_AUTHENTICATED",
        "Usuário não autenticado.",
      );
    await connectToDatabase();
    const summary = await profileSummary(identityFromToken(user));
    return NextResponse.json({ success: true, summary }, { headers });
  } catch (error) {
    if (error instanceof ProfileRequestError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status, headers },
      );
    }
    if (error instanceof ProfileCryptoConfigurationError) {
      return NextResponse.json(
        {
          success: false,
          error: "Configuração segura do perfil indisponível.",
          code: "AUTH_CONFIGURATION_ERROR",
        },
        { status: 503, headers },
      );
    }
    console.error(
      "[GET /api/v1/user/profile/summary]",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { success: false, error: "Erro interno ao carregar perfil." },
      { status: 500, headers },
    );
  }
}
