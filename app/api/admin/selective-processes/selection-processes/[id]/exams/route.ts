import { NextRequest, NextResponse } from 'next/server';
import GateKeeper from '@/lib/security/gatekeeper';
import {
  createExamForProcess,
  getExamsBySelectionProcess,
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
  const created = await getExamsBySelectionProcess(id);
  return NextResponse.json({ success: true, data: created });
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

  const examStartDate = body?.examStartDate;
  const examEndDate = body?.examEndDate;

  if (!examStartDate || !examEndDate) {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }

  const created = await createExamForProcess(id, {
    examStartDate: new Date(examStartDate),
    examEndDate: new Date(examEndDate),
  });

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
