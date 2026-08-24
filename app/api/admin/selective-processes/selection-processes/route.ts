import { NextRequest, NextResponse } from 'next/server';
import GateKeeper from '@/lib/security/gatekeeper';
import {
  createSelectionProcess,
  listSelectionProcesses,
} from '@/lib/selective-processes/services/selectiveProcesses';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const access = await new GateKeeper(request).validate();
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message, code: access.code },
      { status: access.status || 403 }
    );
  }

  const data = await listSelectionProcesses();
  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const access = await new GateKeeper(request).validate();
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message, code: access.code },
      { status: access.status || 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const registrationStartDate = body?.registrationStartDate;
  const registrationEndDate = body?.registrationEndDate;
  const maxExamsPerApplication = body?.maxExamsPerApplication;
  const maxCapacity = body?.maxCapacity;

  if (
    !registrationStartDate ||
    !registrationEndDate ||
    typeof maxExamsPerApplication !== 'number' ||
    typeof maxCapacity !== 'number'
  ) {
    return NextResponse.json(
      { success: false, error: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  const created = await createSelectionProcess({
    registrationStartDate: new Date(registrationStartDate),
    registrationEndDate: new Date(registrationEndDate),
    maxExamsPerApplication,
    maxCapacity,
  });

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
