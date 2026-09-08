import { clamFailure } from '@/lib/selective-processes/errors';
import { NextResponse } from 'next/server';
export async function PUT() {
  try {
 return NextResponse.json({ success: false, error: 'USE_PAYMENT_RECONCILIATION' }, { status: 410 });
  } catch (error) { return clamFailure(error); }
}
