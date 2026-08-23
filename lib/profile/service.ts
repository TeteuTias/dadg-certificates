import type { JWTPayload } from "jose";
import type { FilterQuery, Types } from "mongoose";
import PrivacyAcceptanceModel from "@/lib/models/PrivacyAcceptanceModel";
import ProfileAuditModel from "@/lib/models/ProfileAuditModel";
import UserProfileModel, { type UserProfileDocument } from "@/lib/models/UserProfileModel";
import { cpfLookup, decryptCpf, encryptCpf } from "./crypto";
import {
  PROFILE_PRIVACY_NOTICE_HASH,
  PROFILE_PRIVACY_NOTICE_VERSION,
} from "./privacy-notice";
import { maskCpf, type ProfileInput } from "./validation";

export type ProfileIdentity = { authIssuer: string; authSubject: string };
type LeanProfile = UserProfileDocument & { _id: Types.ObjectId };

export class ProfileRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ProfileRequestError";
  }
}

export function identityFromToken(payload: JWTPayload): ProfileIdentity {
  if (typeof payload.iss !== "string" || typeof payload.sub !== "string" || !payload.iss || !payload.sub) {
    throw new ProfileRequestError(401, "INVALID_STUDENT_IDENTITY", "Identidade autenticada inválida.");
  }
  return { authIssuer: payload.iss, authSubject: payload.sub };
}

export function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: number }).code === 11000);
}

export async function findProfile(identity: ProfileIdentity): Promise<LeanProfile | null> {
  return UserProfileModel.findOne(identity).lean() as Promise<LeanProfile | null>;
}

export async function hasCurrentAcceptance(profileId: Types.ObjectId): Promise<boolean> {
  return Boolean(await PrivacyAcceptanceModel.exists({
    profileId,
    noticeVersion: PROFILE_PRIVACY_NOTICE_VERSION,
    noticeHash: PROFILE_PRIVACY_NOTICE_HASH,
  }));
}

export async function profileSummary(identity: ProfileIdentity) {
  const profile = await findProfile(identity);
  const privacyAccepted = profile ? await hasCurrentAcceptance(profile._id) : false;
  return {
    displayName: profile?.name?.trim() || "Aluno DADG",
    complete: Boolean(profile),
    privacyNoticeRequired: !privacyAccepted,
  };
}

export async function serializeOwnProfile(identity: ProfileIdentity) {
  const profile = await findProfile(identity);
  const privacyAccepted = profile ? await hasCurrentAcceptance(profile._id) : false;
  if (!profile) {
    return {
      exists: false,
      name: null,
      cpf: null,
      cpfMasked: "Não informado",
      period: null,
      complete: false,
      privacyNoticeRequired: true,
      updatedAt: null,
    };
  }
  const cpf = decryptCpf(profile.cpfEncrypted);
  return {
    exists: true,
    name: profile.name,
    cpf,
    cpfMasked: maskCpf(cpf),
    period: profile.period,
    complete: true,
    privacyNoticeRequired: !privacyAccepted,
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export async function saveOwnProfile(args: {
  identity: ProfileIdentity;
  data: ProfileInput;
  privacyAccepted: boolean;
  noticeVersion?: string;
}) {
  const { identity, data } = args;
  const existing = await findProfile(identity);
  const acceptanceCurrent = existing ? await hasCurrentAcceptance(existing._id) : false;

  if (!acceptanceCurrent && (!args.privacyAccepted || args.noticeVersion !== PROFILE_PRIVACY_NOTICE_VERSION)) {
    throw new ProfileRequestError(
      428,
      "PRIVACY_NOTICE_REQUIRED",
      "É necessário aceitar o aviso de privacidade vigente.",
    );
  }

  const lookup = cpfLookup(data.cpf);
  const changedFields: Array<"name" | "cpf" | "period"> = existing
    ? [
        ...(existing.name !== data.name ? ["name" as const] : []),
        ...(existing.cpfLookup !== lookup ? ["cpf" as const] : []),
        ...(existing.period !== data.period ? ["period" as const] : []),
      ]
    : ["name", "cpf", "period"];

  try {
    if (existing) {
      await UserProfileModel.updateOne(
        { _id: existing._id },
        {
          $set: {
            name: data.name,
            period: data.period,
            cpfLookup: lookup,
            ...(existing.cpfLookup === lookup ? {} : { cpfEncrypted: encryptCpf(data.cpf) }),
          },
        },
        { runValidators: true },
      );
    } else {
      await UserProfileModel.create({
        ...identity,
        name: data.name,
        period: data.period,
        cpfLookup: lookup,
        cpfEncrypted: encryptCpf(data.cpf),
      });
    }
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ProfileRequestError(409, "CPF_ALREADY_IN_USE", "Este CPF já está associado a um perfil.");
    }
    throw error;
  }

  const saved = await findProfile(identity);
  if (!saved) throw new Error("Profile was not persisted");

  if (!acceptanceCurrent) {
    await PrivacyAcceptanceModel.updateOne(
      { profileId: saved._id, noticeVersion: PROFILE_PRIVACY_NOTICE_VERSION },
      {
        $setOnInsert: {
          profileId: saved._id,
          noticeVersion: PROFILE_PRIVACY_NOTICE_VERSION,
          noticeHash: PROFILE_PRIVACY_NOTICE_HASH,
          acceptedAt: new Date(),
          ...identity,
          source: "profile-web",
        },
      },
      { upsert: true },
    );
  }

  if (changedFields.length) {
    await ProfileAuditModel.create({
      profileId: saved._id,
      actorIssuer: identity.authIssuer,
      actorSubject: identity.authSubject,
      action: existing ? "profile.updated" : "profile.created",
      changedFields,
      createdAt: new Date(),
    });
  }

  return {
    exists: true,
    name: data.name,
    cpf: data.cpf,
    cpfMasked: maskCpf(data.cpf),
    period: data.period,
    complete: true,
    privacyNoticeRequired: false,
    updatedAt: saved.updatedAt.toISOString(),
  };
}

export async function acceptedProfileIds(): Promise<Types.ObjectId[]> {
  const records = await PrivacyAcceptanceModel.find({
    noticeVersion: PROFILE_PRIVACY_NOTICE_VERSION,
    noticeHash: PROFILE_PRIVACY_NOTICE_HASH,
  }).select({ profileId: 1 }).lean() as unknown as Array<{ profileId: Types.ObjectId }>;
  return records.map((record) => record.profileId);
}

export function withCompletenessFilter(
  filter: FilterQuery<UserProfileDocument>,
  completeness: unknown,
): FilterQuery<UserProfileDocument> {
  if (completeness === "complete") {
    return { ...filter, name: { $type: "string", $ne: "" }, period: { $gte: 1, $lte: 12 }, cpfLookup: { $type: "string", $ne: "" } };
  }
  if (completeness === "incomplete") {
    return { ...filter, $or: [{ name: "" }, { name: { $exists: false } }, { period: { $exists: false } }, { cpfLookup: { $exists: false } }] };
  }
  return filter;
}
