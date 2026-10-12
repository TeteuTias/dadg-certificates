import type { NextRequest } from "next/server";
import GateKeeper from "@/lib/security/gatekeeper";
import { connectToDatabase } from "@/lib/mongodb";
import {
  findProfile,
  identityFromToken,
  hasCurrentAcceptance,
} from "@/lib/profile/service";
import { EventError, verifiedEmail } from "./rules";
import { participantOwnerFilter } from "./ownership";
export async function eventIdentity(
  request: NextRequest,
  requireVerified = true,
) {
  const user = await new GateKeeper(request).identifyStudent();
  if (!user)
    throw new EventError("NOT_AUTHENTICATED", 401, "Entre na sua conta.");
  const identity = identityFromToken(user);
  await connectToDatabase();
  const profile = await findProfile(identity);
  if (!profile)
    throw new EventError("PROFILE_INCOMPLETE", 428, "Complete seu perfil.");
  const email = requireVerified
    ? verifiedEmail(user)
    : String(user[process.env.STUDENT_AUTH0_EMAIL_CLAIM || "email"] || "");
  if (requireVerified && !(await hasCurrentAcceptance(profile._id)))
    throw new EventError(
      "PRIVACY_NOTICE_REQUIRED",
      428,
      "Aceite o aviso de privacidade vigente.",
    );
  const ownerFilter = participantOwnerFilter(profile);
  return { user, identity, profile, email, ownerFilter };
}
