import { clamFailure } from '@/lib/selective-processes/errors';
import { NextResponse } from 'next/server';
export async function POST() {
  try {
 return NextResponse.json({ success: false, error: 'LEGACY_PAYMENT_ENDPOINT_RETIRED' }, { status: 410 });
  } catch (error) { return clamFailure(error); }
}
