import type { NextRequest } from "next/server";
import { ObjectId } from "bson";
import GateKeeper from "@/lib/security/gatekeeper";
import { connectToDatabase } from "@/lib/mongodb";
import {
  findProfile,
  identityFromToken,
  hasCurrentAcceptance,
} from "@/lib/profile/service";
import { EventError, verifiedEmail } from "./rules";
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
  const legacy = identity.authSubject.match(/^auth0\|([a-f0-9]{24})$/i)?.[1];
  const ownerFilter = legacy
    ? {
        $or: [
          { profileId: profile._id },
          { profileId: { $exists: false }, owner: new ObjectId(legacy) },
        ],
      }
    : { profileId: profile._id };
  return { user, identity, profile, email, ownerFilter };
}
