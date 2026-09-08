import { clamFailure } from '@/lib/selective-processes/errors';
import { NextRequest, NextResponse } from 'next/server';
import GateKeeper from '@/lib/security/gatekeeper';
import { updateScores } from '@/lib/selective-processes/services/selectiveProcesses';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ applicationId: string }> };

export async function PUT(request: NextRequest, { params }: Context) {
  try {

  const access = await new GateKeeper(request).validate();
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message, code: access.code },
      { status: access.status || 403 }
    );
  }

  const { applicationId } = await params;
  const body = await request.json().catch(() => null);

  const scores = body?.scores;


  if (!Array.isArray(scores)) {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }
  if (
    scores.some((s) => {
      const v = s as unknown;
      if (typeof v !== 'object' || v === null) return true;
      const maybe = v as { examId?: unknown; scoreValue?: unknown };
      return (
        typeof maybe.examId !== 'string' ||
        typeof maybe.scoreValue !== 'number'
      );
    })
  ) {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }

  const updated = await updateScores({
    applicationId,
    actor: access.principal?.user.sub,
    scores: (scores as Array<{ examId: string; scoreValue: number }>).map((s) => ({
      examId: s.examId,
      scoreValue: s.scoreValue,
    })),
  });

  return NextResponse.json({ success: true, data: updated });

  } catch (error) { return clamFailure(error); }
}
