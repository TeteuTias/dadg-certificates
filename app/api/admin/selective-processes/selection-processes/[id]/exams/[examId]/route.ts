import { clamFailure } from '@/lib/selective-processes/errors';
import { NextRequest, NextResponse } from 'next/server';
import GateKeeper from '@/lib/security/gatekeeper';
import {
  deleteExamForProcess,
  updateExamForProcess,
} from '@/lib/selective-processes/services/selectiveProcesses';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string; examId: string }> };

export async function PUT(request: NextRequest, { params }: Context) {
  try {

  const access = await new GateKeeper(request).validate();
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message, code: access.code },
      { status: access.status || 403 }
    );
  }

  const { id, examId } = await params;
  const body = await request.json().catch(() => null);

  const examStartDate = body?.examStartDate;
  const examEndDate = body?.examEndDate;
  if (!examStartDate || !examEndDate || !body) {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }

  const updated = await updateExamForProcess(id, examId, {
    source: body.source,
    academicLeagueId: body.academicLeagueId,
    name: body.name,
    acronym: body.acronym,
    examStartDate: new Date(examStartDate),
    examEndDate: new Date(examEndDate),
  });

  if (!updated) return NextResponse.json({ success: false }, { status: 404 });
  return NextResponse.json({ success: true, data: updated });

  } catch (error) { return clamFailure(error); }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {

  const access = await new GateKeeper(request).validate();
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message, code: access.code },
      { status: access.status || 403 }
    );
  }

  const { id, examId } = await params;
  const deleted = await deleteExamForProcess(id, examId);

  if (!deleted) return NextResponse.json({ success: false }, { status: 404 });
  return NextResponse.json({ success: true, data: deleted });

  } catch (error) { return clamFailure(error); }
}
