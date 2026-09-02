import { NextRequest, NextResponse } from 'next/server';
import GateKeeper from '@/lib/security/gatekeeper';
import { listSelectionProcessesForStudents } from '@/lib/selective-processes/services/studentSelectiveProcesses';

export const dynamic = 'force-dynamic';

/** Listagem pública dos processos seletivos exibida no site do aluno. */
export async function GET(request: NextRequest) {
  const access = await new GateKeeper(request).validate();
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message, code: access.code },
      { status: access.status || 403 },
    );
  }

  try {
    const data = await listSelectionProcessesForStudents();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[GET /api/v1/selective-processes]', error);
    return NextResponse.json(
      { success: false, error: 'SELECTION_PROCESSES_LIST_FAILED' },
      { status: 500 },
    );
  }
}
