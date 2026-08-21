import { ObjectId } from "bson";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import PrivacyAcceptanceModel from "@/lib/models/PrivacyAcceptanceModel";
import ProfileAuditModel from "@/lib/models/ProfileAuditModel";
import UserProfileModel from "@/lib/models/UserProfileModel";
import {
  assertProfileCryptoConfigured,
  cpfLookup,
  decryptCpf,
  encryptCpf,
  ProfileCryptoConfigurationError,
} from "@/lib/profile/crypto";
import {
  PROFILE_PRIVACY_NOTICE_HASH,
  PROFILE_PRIVACY_NOTICE_VERSION,
} from "@/lib/profile/privacy-notice";
import { isDuplicateKeyError } from "@/lib/profile/service";
import {
  formatCpf,
  isValidCpf,
  normalizeCpf,
  normalizeName,
  validateName,
  validatePeriod,
} from "@/lib/profile/validation";
import GateKeeper from "@/lib/security/gatekeeper";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ id: string }> };

async function admin(request: NextRequest) {
  return new GateKeeper(request).identifyAdmin();
}

export async function GET(request: NextRequest, { params }: Context) {
  try {
    assertProfileCryptoConfigured();
    if (!(await admin(request)))
      return NextResponse.json(
        { success: false, code: "ADMIN_ACCESS_DENIED" },
        { status: 403, headers },
      );
    const { id } = await params;
    if (!ObjectId.isValid(id))
      return NextResponse.json(
        { success: false, error: "Perfil inválido." },
        { status: 400, headers },
      );
    await connectToDatabase();
    const profile = await UserProfileModel.findById(id).lean();
    if (!profile)
      return NextResponse.json(
        { success: false, error: "Perfil não encontrado." },
        { status: 404, headers },
      );
    const [acceptance, audit] = await Promise.all([
      PrivacyAcceptanceModel.findOne({
        profileId: profile._id,
        noticeVersion: PROFILE_PRIVACY_NOTICE_VERSION,
        noticeHash: PROFILE_PRIVACY_NOTICE_HASH,
      }).lean(),
      ProfileAuditModel.find({ profileId: profile._id })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);
    return NextResponse.json(
      {
        success: true,
        profile: {
          id: String(profile._id),
          name: profile.name,
          cpf: formatCpf(decryptCpf(profile.cpfEncrypted)),
          period: profile.period,
          updatedAt: profile.updatedAt,
          privacy: acceptance
            ? {
                accepted: true,
                noticeVersion: acceptance.noticeVersion,
                acceptedAt: acceptance.acceptedAt,
              }
            : {
                accepted: false,
                noticeVersion: PROFILE_PRIVACY_NOTICE_VERSION,
                acceptedAt: null,
              },
        },
        audit: audit.map((entry) => ({
          id: String(entry._id),
          action: entry.action,
          changedFields: entry.changedFields,
          actorSubject: entry.actorSubject,
          createdAt: entry.createdAt,
        })),
      },
      { headers },
    );
  } catch (error) {
    return profileError(error, "GET");
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    assertProfileCryptoConfigured();
    const actor = await admin(request);
    if (!actor)
      return NextResponse.json(
        { success: false, code: "ADMIN_ACCESS_DENIED" },
        { status: 403, headers },
      );
    const { id } = await params;
    if (!ObjectId.isValid(id))
      return NextResponse.json(
        { success: false, error: "Perfil inválido." },
        { status: 400, headers },
      );
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if ("privacyAccepted" in body || "noticeVersion" in body) {
      return NextResponse.json(
        {
          success: false,
          code: "ADMIN_CANNOT_ACCEPT_PRIVACY",
          error: "O administrador não pode aceitar o aviso pelo aluno.",
        },
        { status: 400, headers },
      );
    }
    await connectToDatabase();
    const profile = await UserProfileModel.findById(id).lean();
    if (!profile)
      return NextResponse.json(
        { success: false, error: "Perfil não encontrado." },
        { status: 404, headers },
      );

    const update: Record<string, unknown> = {};
    const fields: Array<"name" | "cpf" | "period"> = [];
    if ("name" in body) {
      const name = normalizeName(body.name);
      const error = validateName(name);
      if (error)
        return NextResponse.json(
          {
            success: false,
            code: "PROFILE_VALIDATION_ERROR",
            fields: { name: error },
          },
          { status: 400, headers },
        );
      if (name !== profile.name) {
        update.name = name;
        fields.push("name");
      }
    }
    if ("period" in body) {
      const period = Number(body.period);
      const error = validatePeriod(period);
      if (error)
        return NextResponse.json(
          {
            success: false,
            code: "PROFILE_VALIDATION_ERROR",
            fields: { period: error },
          },
          { status: 400, headers },
        );
      if (period !== profile.period) {
        update.period = period;
        fields.push("period");
      }
    }
    if ("cpf" in body) {
      const cpf = normalizeCpf(body.cpf);
      if (!isValidCpf(cpf))
        return NextResponse.json(
          {
            success: false,
            code: "PROFILE_VALIDATION_ERROR",
            fields: { cpf: "Informe um CPF válido." },
          },
          { status: 400, headers },
        );
      const lookup = cpfLookup(cpf);
      if (lookup !== profile.cpfLookup) {
        update.cpfLookup = lookup;
        update.cpfEncrypted = encryptCpf(cpf);
        fields.push("cpf");
      }
    }
    if (!fields.length)
      return NextResponse.json(
        { success: true, changedFields: [] },
        { headers },
      );

    try {
      await UserProfileModel.updateOne(
        { _id: profile._id },
        { $set: update },
        { runValidators: true },
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return NextResponse.json(
          {
            success: false,
            code: "CPF_ALREADY_IN_USE",
            error: "Este CPF já está associado a um perfil.",
          },
          { status: 409, headers },
        );
      }
      throw error;
    }
    await ProfileAuditModel.create({
      profileId: profile._id,
      actorIssuer: process.env.AUTH0_DOMAIN
        ? `https://${process.env.AUTH0_DOMAIN}/`
        : "admin-auth0",
      actorSubject: actor.sub,
      action: "profile.admin_updated",
      changedFields: fields,
      createdAt: new Date(),
    });
    return NextResponse.json(
      { success: true, changedFields: fields },
      { headers },
    );
  } catch (error) {
    return profileError(error, "PATCH");
  }
}

function profileError(error: unknown, method: string) {
  if (error instanceof ProfileCryptoConfigurationError) {
    return NextResponse.json(
      {
        success: false,
        code: "AUTH_CONFIGURATION_ERROR",
        error: "Configuração segura indisponível.",
      },
      { status: 503, headers },
    );
  }
  console.error(
    `[${method} /api/v1/admin/profiles/:id]`,
    error instanceof Error ? error.name : "UnknownError",
  );
  return NextResponse.json(
    { success: false, error: "Erro ao processar perfil." },
    { status: 500, headers },
  );
}
