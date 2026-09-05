import { NextRequest, NextResponse } from 'next/server';
import { ClamError } from '../domain';
import { verifyMercadoPagoSignature } from './webhookSignature';
import { MpGateway } from './gateway';
import { PaymentSession } from '../models/PaymentSessionModel';
import { storageReady } from './storage';
import { reconcileSession } from './checkout';
export async function paymentWebhook(request: NextRequest) {
  if (!process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()) return NextResponse.json({ ok: false, error: 'PAYMENT_CONFIGURATION_ERROR' }, { status: 503 });
  const body = await request.json().catch(() => null);
  const queryId = request.nextUrl.searchParams.get('data.id');
  const id = queryId || String(body?.data?.id || '');
  if (!id || (queryId && body?.data?.id && queryId !== String(body.data.id))) return NextResponse.json({ ok: false }, { status: 400 });
  if (!verifyMercadoPagoSignature(request, id)) return NextResponse.json({ ok: false }, { status: 401 });
  if (body?.type !== 'payment') return NextResponse.json({ ok: true });
  try {
    const provider = new MpGateway();
    const reference = await provider.paymentReference(id);
    await storageReady();
    const doc = await PaymentSession.findOne({ orderId: reference });
    if (!doc) return NextResponse.json({ ok: true, ignored: true });
    await reconcileSession(String(doc._id), provider, false, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof ClamError ? error.code : 'PAYMENT_PROCESSING_FAILED';
    console.error('[clam:webhook]', { paymentId: id, code });
    // A durable review state is acknowledged. Transient errors must be retried.
    if (code === 'PAYMENT_REVIEW_REQUIRED') return NextResponse.json({ ok: true, reviewRequired: true });
    return NextResponse.json({ ok: false, error: code }, { status: 503 });
  }
}
