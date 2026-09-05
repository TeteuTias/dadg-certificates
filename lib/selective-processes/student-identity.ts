import { ObjectId } from 'bson';
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

  const rawOwnerId = user.sub.includes('|') ? user.sub.split('|')[1] : user.sub;
  if (!ObjectId.isValid(rawOwnerId)) return null;

  return { user, userId: String(rawOwnerId) };
}
