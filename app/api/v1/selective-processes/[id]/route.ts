import { NextRequest, NextResponse } from 'next/server';
import GateKeeper from '@/lib/security/gatekeeper';
import { getSelectionProcessForStudents } from '@/lib/selective-processes/services/studentSelectiveProcesses';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** Detalhe público de um processo seletivo, com as ligas e a tabela de preços. */
export async function GET(request: NextRequest, { params }: Context) {
  const access = await new GateKeeper(request).validate();
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message, code: access.code },
      { status: access.status || 403 },
    );
  }

  const { id } = await params;

  try {
    const data = await getSelectionProcessForStudents(id);
    if (!data) {
      return NextResponse.json({ success: false, error: 'PROCESS_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[GET /api/v1/selective-processes/:id]', error);
    return NextResponse.json({ success: false, error: 'SELECTION_PROCESS_FAILED' }, { status: 500 });
  }
}
