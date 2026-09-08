import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import GateKeeper from '@/lib/security/gatekeeper';
import { getSelectionProcess, updateSelectionProcess, deleteSelectionProcess } from '@/lib/selective-processes/services/selectiveProcesses';
import { clamFailure } from '@/lib/selective-processes/errors';
import { ClamError } from '@/lib/selective-processes/domain';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
async function run(request: NextRequest, { params }: Context) {
  try {
    const access = await new GateKeeper(request).validate();
    if (!access.authorized) return NextResponse.json({ success: false, error: access.code }, { status: access.status || 403 });
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) throw new ClamError('INVALID_ID', 400);
    let data;
    if (request.method === 'DELETE') data = await deleteSelectionProcess(id);
    else if (request.method === 'GET') data = await getSelectionProcess(id);
    else {
      const body = await request.json();
      data = await updateSelectionProcess(id, {
        registrationStartDate: body.registrationStartDate ? new Date(body.registrationStartDate) : undefined,
        registrationEndDate: body.registrationEndDate ? new Date(body.registrationEndDate) : undefined,
        maxExamsPerApplication: body.maxExamsPerApplication, maxCapacity: body.maxCapacity,
      });
    }
    return NextResponse.json({ success: Boolean(data), data }, { status: data ? 200 : 404 });
  } catch (error) { return clamFailure(error); }
}
export const GET = run;
export const PUT = run;
export const DELETE = run;
