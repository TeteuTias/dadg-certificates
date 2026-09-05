import { NextRequest, NextResponse } from 'next/server';
import GateKeeper from '@/lib/security/gatekeeper';
import {
  createApplicationAndTicketMock,
  listApplicationsBySelectionProcess,
} from '@/lib/selective-processes/services/selectiveProcesses';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const access = await new GateKeeper(request).validate();
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message, code: access.code },
      { status: access.status || 403 }
    );
  }

  const { id } = await params;
  const data = await listApplicationsBySelectionProcess(id);
  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest, { params }: Context) {
  const access = await new GateKeeper(request).validate();
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message, code: access.code },
      { status: access.status || 403 }
    );
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const userId = body?.userId;
  const exams = body?.exams;

  if (!userId || !Array.isArray(exams)) {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }
  if (exams.some((x) => typeof x !== 'string')) {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }

  const created = await createApplicationAndTicketMock({
    selectionProcessId: id,
    userId,
    exams,
  });

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
