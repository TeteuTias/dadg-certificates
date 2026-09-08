import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import GateKeeper from '@/lib/security/gatekeeper';
import { reconcileSession } from '@/lib/selective-processes/services/checkout';
import { clamFailure } from '@/lib/selective-processes/http';
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const access = await new GateKeeper(request).validate();
  if (!access.authorized) return NextResponse.json({ success: false, error: access.code }, { status: access.status || 403 });
  const { sessionId } = await params;
  if (!mongoose.isValidObjectId(sessionId)) return NextResponse.json({ success: false, error: 'INVALID_SESSION_ID' }, { status: 400 });
  try {
    const data = await reconcileSession(sessionId, undefined, true);
    console.info('[clam:admin-reconcile]', { sessionId, actor: access.principal?.user.sub });
    return NextResponse.json({ success: true, data });
  } catch (error) { return clamFailure(error); }
}
