import { NextRequest, NextResponse } from 'next/server';
import GateKeeper from '@/lib/security/gatekeeper';
import { requireCandidateProfile } from '@/lib/selective-processes/candidate-profile';
import { clamFailure } from '@/lib/selective-processes/errors';
import { identifyStudentOwner } from '@/lib/selective-processes/student-identity';
import {
  LeagueSelectionError,
  selectLeaguesForApplication,
} from '@/lib/selective-processes/services/studentSelectiveProcesses';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** Escolha das ligas acadêmicas, liberada após a confirmação do pagamento. */
export async function POST(request: NextRequest, { params }: Context) {
  const access = await new GateKeeper(request).validate();
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message, code: access.code },
      { status: access.status || 403 },
    );
  }

  const identity = await identifyStudentOwner(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'NOT_AUTHENTICATED' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const examIds = body?.examIds;

  if (!Array.isArray(examIds) || examIds.some((examId) => typeof examId !== 'string')) {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }

  try {
    const profile = await requireCandidateProfile(identity.user);
    const data = await selectLeaguesForApplication({
      candidateProfileId: String(profile._id),
      selectionProcessId: id,
      userId: identity.userId,
      examIds,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof LeagueSelectionError) {
      return NextResponse.json({ success: false, error: error.code }, { status: error.status });
    }

    return clamFailure(error);
  }
}
