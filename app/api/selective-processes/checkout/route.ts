import { withRouteAccess } from "@/lib/security/route-access";
import { NextResponse } from 'next/server';
async function POSTHandler() { return NextResponse.json({ success: false, error: 'LEGACY_PAYMENT_ENDPOINT_RETIRED' }, { status: 410 }); }

export const POST = withRouteAccess(POSTHandler);
