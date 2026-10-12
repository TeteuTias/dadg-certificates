import { withRouteAccess } from "@/lib/security/route-access";
import { clamFailure } from '@/lib/selective-processes/errors';
import { NextResponse } from 'next/server';
async function POSTHandler() {
  try {
 return NextResponse.json({ success: false, error: 'LEGACY_PAYMENT_ENDPOINT_RETIRED' }, { status: 410 });
  } catch (error) { return clamFailure(error); }
}

export const POST = withRouteAccess(POSTHandler);
