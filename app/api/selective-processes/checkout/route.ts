import { NextResponse } from 'next/server';
export async function POST() { return NextResponse.json({ success: false, error: 'LEGACY_PAYMENT_ENDPOINT_RETIRED' }, { status: 410 }); }
