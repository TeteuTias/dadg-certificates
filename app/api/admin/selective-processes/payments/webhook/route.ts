import { NextRequest, NextResponse } from 'next/server';
import { handleMpWebhook } from '@/lib/selective-processes/services/paymentWebhook';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Webhook: não usar GateKeeper (deve aceitar chamadas externas do Mercado Pago).
  // TODO: validar assinatura do Mercado Pago usando segredo/configuração do projeto.

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ received: false }, { status: 400 });

  const res = await handleMpWebhook(body);
  if (!res.received) return NextResponse.json({ received: false }, { status: 400 });

  return NextResponse.json({ received: true });
}
