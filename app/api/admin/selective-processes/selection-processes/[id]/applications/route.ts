import { clamFailure } from '@/lib/selective-processes/errors';
import { NextRequest, NextResponse } from 'next/server';
import GateKeeper from '@/lib/security/gatekeeper';
import {
  listApplicationsBySelectionProcess,
} from '@/lib/selective-processes/services/selectiveProcesses';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {

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

  } catch (error) { return clamFailure(error); }
}

export async function POST() {
  try {
 return NextResponse.json({ success: false, error: 'LEGACY_PAYMENT_ENDPOINT_RETIRED' }, { status: 410 });
  } catch (error) { return clamFailure(error); }
}
