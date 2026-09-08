import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ClamError } from './domain';
export function clamFailure(error: unknown) {
  const code = error instanceof ClamError ? error.code : 'SELECTIVE_PROCESS_UNAVAILABLE';
  const status = error instanceof ClamError ? error.status : 503;
  const diagnosticId = randomUUID();
  if (status >= 500) console.error('[clam:request]', { diagnosticId, code, kind: error instanceof Error ? error.name : 'unknown' });
  return NextResponse.json({ success: false, error: code, diagnosticId }, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
