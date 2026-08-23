import { NextRequest, NextResponse } from "next/server";
import type { FilterQuery, Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import UserProfileModel, {
  type UserProfileDocument,
} from "@/lib/models/UserProfileModel";
import {
  assertProfileCryptoConfigured,
  cpfLookup,
  decryptCpf,
  ProfileCryptoConfigurationError,
} from "@/lib/profile/crypto";
import {
  acceptedProfileIds,
  withCompletenessFilter,
} from "@/lib/profile/service";
import { isValidCpf, maskCpf, normalizeCpf } from "@/lib/profile/validation";
import GateKeeper from "@/lib/security/gatekeeper";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function POST(request: NextRequest) {
  try {
    assertProfileCryptoConfigured();
    if (!(await new GateKeeper(request).identifyAdmin())) {
      return NextResponse.json(
        { success: false, code: "ADMIN_ACCESS_DENIED" },
        { status: 403, headers },
      );
    }
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const page = Math.max(
      1,
      Number.isInteger(body.page) ? Number(body.page) : 1,
    );
    const pageSize = Math.min(
      50,
      Math.max(
        10,
        Number.isInteger(body.pageSize) ? Number(body.pageSize) : 20,
      ),
    );
    let filter: FilterQuery<UserProfileDocument> = {};

    const search = typeof body.search === "string" ? body.search.trim() : "";
    if (search) {
      const digits = normalizeCpf(search);
      if (digits.length === 11 && isValidCpf(digits))
        filter.cpfLookup = cpfLookup(digits);
      else filter.name = { $regex: escapeRegex(search), $options: "i" };
    }
    const period = Number(body.period);
    if (Number.isInteger(period) && period >= 1 && period <= 12)
      filter.period = period;
    filter = withCompletenessFilter(filter, body.completeness);

    await connectToDatabase();
    const acceptedIds = await acceptedProfileIds();
    if (body.lgpd === "current") filter._id = { $in: acceptedIds };
    if (body.lgpd === "required") filter._id = { $nin: acceptedIds };

    const [profiles, total, allProfiles] = await Promise.all([
      UserProfileModel.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      UserProfileModel.countDocuments(filter),
      UserProfileModel.countDocuments({}),
    ]);
    const acceptedSet = new Set(
      acceptedIds.map((id: Types.ObjectId) => String(id)),
    );
    const rows = profiles.map((profile) => {
      const cpf = decryptCpf(profile.cpfEncrypted);
      return {
        id: String(profile._id),
        name: profile.name,
        period: profile.period,
        cpfMasked: maskCpf(cpf),
        complete: Boolean(
          profile.name &&
            profile.cpfLookup &&
            profile.period >= 1 &&
            profile.period <= 12,
        ),
        privacyAccepted: acceptedSet.has(String(profile._id)),
        updatedAt: profile.updatedAt,
      };
    });

    return NextResponse.json(
      {
        success: true,
        data: rows,
        pagination: {
          page,
          pageSize,
          total,
          pages: Math.max(1, Math.ceil(total / pageSize)),
        },
        totals: {
          profiles: allProfiles,
          privacyAccepted: acceptedIds.length,
          privacyRequired: Math.max(0, allProfiles - acceptedIds.length),
        },
      },
      { headers },
    );
  } catch (error) {
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
      "[POST /api/v1/admin/profiles/query]",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { success: false, error: "Erro ao consultar perfis." },
      { status: 500, headers },
    );
  }
}
