import { NextRequest, NextResponse } from 'next/server';
import GateKeeper from '@/lib/security/gatekeeper';
import { identifyStudentOwner } from '@/lib/selective-processes/student-identity';
import { getStudentApplicationState } from '@/lib/selective-processes/services/studentSelectiveProcesses';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/**
 * Situação do candidato logado no processo seletivo: se já tem inscrição,
 * se o pagamento foi confirmado e quais ligas ele já escolheu.
 */
export async function GET(request: NextRequest, { params }: Context) {
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

  try {
    const data = await getStudentApplicationState({ selectionProcessId: id, userId: identity.userId });
    if (!data) {
      return NextResponse.json({ success: false, error: 'PROCESS_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[GET /api/v1/selective-processes/:id/me]', error);
    return NextResponse.json({ success: false, error: 'APPLICATION_STATE_FAILED' }, { status: 500 });
  }
}
