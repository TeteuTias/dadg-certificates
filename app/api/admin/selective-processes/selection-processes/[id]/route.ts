import { NextRequest, NextResponse } from 'next/server';
import GateKeeper from '@/lib/security/gatekeeper';
import {
  getSelectionProcess,
  updateSelectionProcess,
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
  const data = await getSelectionProcess(id);
  if (!data) return NextResponse.json({ success: false }, { status: 404 });
  return NextResponse.json({ success: true, data });
}

export async function PUT(request: NextRequest, { params }: Context) {
  const access = await new GateKeeper(request).validate();
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message, code: access.code },
      { status: access.status || 403 }
    );
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const updated = await updateSelectionProcess(id, {
    registrationStartDate: body?.registrationStartDate ? new Date(body.registrationStartDate) : undefined,
    registrationEndDate: body?.registrationEndDate ? new Date(body.registrationEndDate) : undefined,
    maxExamsPerApplication:
      typeof body?.maxExamsPerApplication === 'number' ? body.maxExamsPerApplication : undefined,
    maxCapacity: typeof body?.maxCapacity === 'number' ? body.maxCapacity : undefined,
  });

  if (!updated) return NextResponse.json({ success: false }, { status: 404 });
  return NextResponse.json({ success: true, data: updated });
}
