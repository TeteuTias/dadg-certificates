import { NextRequest, NextResponse } from 'next/server';
import GateKeeper from '@/lib/security/gatekeeper';
import { setTicketPaymentStatus } from '@/lib/selective-processes/services/selectiveProcesses';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ ticketId: string }> };

export async function PUT(request: NextRequest, { params }: Context) {
  const access = await new GateKeeper(request).validate();
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message, code: access.code },
      { status: access.status || 403 }
    );
  }

  const { ticketId } = await params;
  const body = await request.json().catch(() => null);

  const paymentStatus = body?.paymentStatus;
  const allowed = ['PENDING', 'PAID', 'CANCELED'];
  if (!allowed.includes(paymentStatus)) {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }

  const updated = await setTicketPaymentStatus({
    ticketId,
    paymentStatus,
  });

  return NextResponse.json({ success: true, data: updated });
}
