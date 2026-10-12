import { withRouteAccess } from "@/lib/security/route-access";
import { clamFailure } from '@/lib/selective-processes/errors';
import { NextResponse } from 'next/server';
async function PUTHandler() {
  try {
 return NextResponse.json({ success: false, error: 'USE_PAYMENT_RECONCILIATION' }, { status: 410 });
  } catch (error) { return clamFailure(error); }
}

export const PUT = withRouteAccess(PUTHandler);
