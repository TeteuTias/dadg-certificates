import { clamFailure } from '@/lib/selective-processes/errors';
import { NextRequest, NextResponse } from 'next/server';
import GateKeeper from '@/lib/security/gatekeeper';
import { setFinalStatus } from '@/lib/selective-processes/services/selectiveProcesses';

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

  const finalStatus = body?.finalStatus;
  if (
    finalStatus !== 'APPROVED' &&
    finalStatus !== 'WAITLIST' &&
    finalStatus !== 'REJECTED' &&
    finalStatus !== 'PENDING_RESULTS'
  ) {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }

  const updated = await setFinalStatus({ applicationId, finalStatus });
  return NextResponse.json({ success: true, data: updated });

  } catch (error) { return clamFailure(error); }
}
