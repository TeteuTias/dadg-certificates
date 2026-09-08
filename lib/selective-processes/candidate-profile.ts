import type { JWTPayload } from "jose";
import { connectToDatabase } from "@/lib/mongodb";
import {
  findProfile,
  identityFromToken,
  hasCurrentAcceptance,
} from "@/lib/profile/service";
import { missingClamFields } from "@/lib/profile/validation";
import { ClamError } from "./domain";

export async function requireCandidateProfile(user: JWTPayload) {
  await connectToDatabase();
  const profile = await findProfile(identityFromToken(user));
  const missing = missingClamFields(profile);
  if (profile && !(await hasCurrentAcceptance(profile._id)))
    missing.push("privacyAccepted");
  if (missing.length || !profile)
    throw new ClamError("PROFILE_INCOMPLETE", 428, missing);
  return profile;
}
