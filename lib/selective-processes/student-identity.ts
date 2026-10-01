import type { NextRequest } from 'next/server';
import GateKeeper from '@/lib/security/gatekeeper';

/**
 * Extrai o id do usuário a partir do token do aluno.
 * Mesma convenção usada nas inscrições de eventos: o `sub` do Auth0 carrega o
 * ObjectId do usuário depois do separador `|`.
 */
export async function identifyStudentOwner(request: NextRequest) {
  const user = await new GateKeeper(request).identifyStudent();
  if (!user?.sub) return null;

  const legacy = user.sub.match(/^auth0\|([a-f0-9]{24})$/i)?.[1];
  if (legacy) return { user, userId: legacy };
  const { connectToDatabase } = await import("@/lib/mongodb");
  const { findProfile, identityFromToken } = await import("@/lib/profile/service");
  await connectToDatabase();
  const profile = await findProfile(identityFromToken(user));
  if (!profile) return null;
  return { user, userId: String(profile._id) };
}
