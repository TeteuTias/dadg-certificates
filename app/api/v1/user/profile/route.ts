import { withRouteAccess } from "@/lib/security/route-access";
import { after, NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GateKeeper from "@/lib/security/gatekeeper";
import {
  assertProfileCryptoConfigured,
  ProfileCryptoConfigurationError,
} from "@/lib/profile/crypto";
import { getProfileEvents } from "@/lib/profile/events";
import { linkCertificatesForProfile } from "@/lib/certificates/auto-link";
import {
  findProfile,
  identityFromToken,
  ProfileRequestError,
  saveOwnProfile,
  serializeOwnProfile,
} from "@/lib/profile/service";
import {
  PROFILE_PRIVACY_NOTICE,
  PROFILE_PRIVACY_NOTICE_HASH,
} from "@/lib/profile/privacy-notice";
import { validateProfileInput } from "@/lib/profile/validation";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}
function handleError(error: unknown, operation: string) {
  if (error instanceof ProfileRequestError) {
    return json({ success: false, error: error.message, code: error.code, fields: error.fields }, error.status);
  }
  if (error instanceof ProfileCryptoConfigurationError) {
    return json({ success: false, error: "Configuração segura do perfil indisponível.", code: "AUTH_CONFIGURATION_ERROR" }, 503);
  }
  console.error(`[${operation}]`, error instanceof Error ? error.name : "UnknownError");
  return json({ success: false, error: "Erro interno ao processar perfil.", code: "PROFILE_INTERNAL_ERROR" }, 500);
}

async function student(request: NextRequest) {
  const user = await new GateKeeper(request).identifyStudent();
  if (!user) throw new ProfileRequestError(401, "NOT_AUTHENTICATED", "Usuário não autenticado.");
  return user;
}

async function GETHandler(request: NextRequest) {
  try {
    assertProfileCryptoConfigured();
    const user = await student(request);
    const identity = identityFromToken(user);
    await connectToDatabase();
    const [profile, data] = await Promise.all([
      serializeOwnProfile(identity),
      getProfileEvents(identity),
    ]);
    return json({
      success: true,
      profile,
      privacyNotice: { ...PROFILE_PRIVACY_NOTICE, hash: PROFILE_PRIVACY_NOTICE_HASH },
      data,
    });
  } catch (error) {
    return handleError(error, "GET /api/v1/user/profile");
  }
}

async function PUTHandler(request: NextRequest) {
  try {
    assertProfileCryptoConfigured();
    const user = await student(request);
    const identity = identityFromToken(user);
    const body = await request.json().catch(() => null);
    const { data, errors } = validateProfileInput(body);
    if (!data) {
      throw new ProfileRequestError(400, "PROFILE_VALIDATION_ERROR", "Revise os campos informados.", errors);
    }
    const input = body as Record<string, unknown>;
    await connectToDatabase();
    const profile = await saveOwnProfile({
      identity,
      data,
      privacyAccepted: input.privacyAccepted === true,
      noticeVersion: typeof input.noticeVersion === "string" ? input.noticeVersion : undefined,
    });
    // Vínculo automático dos certificados ao criar a conta ou mudar CPF, nome, RA ou
    // e-mail de contato. Roda depois da resposta; uma falha não desfaz o perfil salvo.
    if (process.env.CERTIFICATE_AUTO_LINK_ENABLED === "true")
      after(async () => {
        try {
          const saved = await findProfile(identity);
          if (saved) await linkCertificatesForProfile(saved, user[process.env.STUDENT_AUTH0_EMAIL_CLAIM || "email"]);
        } catch (error) {
          console.error("[profile/auto-link]", error);
        }
      });
    return json({ success: true, profile, summary: {
      displayName: profile.name,
      complete: true,
      privacyNoticeRequired: false,
    } });
  } catch (error) {
    return handleError(error, "PUT /api/v1/user/profile");
  }
}

export const GET = withRouteAccess(GETHandler);
export const PUT = withRouteAccess(PUTHandler);
