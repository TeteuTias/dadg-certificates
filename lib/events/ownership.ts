import { ObjectId } from "bson";

/**
 * Filtro das inscrições de um perfil. As novas apontam para o perfil; as
 * antigas guardam apenas o ID da conta Auth0 em `owner`.
 */
export function participantOwnerFilter(profile: {
  _id: unknown;
  authSubject: string;
}) {
  const legacy = profile.authSubject.match(/^auth0\|([a-f0-9]{24})$/i)?.[1];
  return legacy
    ? {
        $or: [
          { profileId: profile._id },
          { profileId: { $exists: false }, owner: new ObjectId(legacy) },
        ],
      }
    : { profileId: profile._id };
}
