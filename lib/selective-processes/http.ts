import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import GateKeeper from '@/lib/security/gatekeeper';
import { parseCheckoutBody } from './input';
import { ClamError } from './domain';
import { identifyStudentOwner } from './student-identity';
import { requireCandidateProfile } from './candidate-profile';
import { checkout } from './services/checkout';
export { clamFailure } from "./errors";
import { clamFailure } from "./errors";
export async function checkoutRequest(request: NextRequest, processId: string, replace = false) {
  try {
    const access = await new GateKeeper(request).validate();
    if (!access.authorized) return NextResponse.json({ success: false, error: access.code }, { status: access.status || 403 });
    const identity = await identifyStudentOwner(request);
    if (!identity) throw new ClamError('NOT_AUTHENTICATED', 401);
    const profile = await requireCandidateProfile(identity.user);
    const body = await request.json().catch(() => null);
    if (!mongoose.isValidObjectId(processId)) throw new ClamError('INVALID_BODY', 400);
    const fields = parseCheckoutBody(body, replace);
    const data = await checkout({ ...fields, processId, userId: identity.userId, candidateProfileId: String(profile._id),
      operationKey: request.headers.get('idempotency-key') || '' });
    return NextResponse.json({ success: true, data });
  } catch (error) { return clamFailure(error); }
}
