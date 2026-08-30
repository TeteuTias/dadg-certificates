import { NextRequest, NextResponse } from 'next/server';
import GateKeeper from '@/lib/security/gatekeeper';
import { createOrGetPaymentSession } from '@/lib/selective-processes/services/paymentSessions';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const access = await new GateKeeper(request).validate();
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message, code: access.code },
      { status: access.status || 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });

  // Contrato com frontend separado:
  // owner (userId) + edicaoId identificam unicamente a sessão ativa.
  const owner = body?.owner;
  const edicaoId = body?.edicaoId;
  const type = body?.type;
  const orderId = body?.orderId ?? null;

  if (!owner || typeof owner !== 'string') {
    return NextResponse.json({ success: false, error: 'INVALID_OWNER' }, { status: 400 });
  }
  if (!edicaoId || typeof edicaoId !== 'string') {
    return NextResponse.json({ success: false, error: 'INVALID_EDICAO_ID' }, { status: 400 });
  }
  if (type !== 'ticket' && type !== 'course') {
    return NextResponse.json({ success: false, error: 'INVALID_TYPE' }, { status: 400 });
  }

  const externalReference = body?.externalReference;
  const items = body?.items;
  const payer = body?.payer;

  if (typeof externalReference !== 'string') {
    return NextResponse.json({ success: false, error: 'INVALID_EXTERNAL_REFERENCE' }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ success: false, error: 'INVALID_ITEMS' }, { status: 400 });
  }
  if (!payer || typeof payer !== 'object') {
    return NextResponse.json({ success: false, error: 'INVALID_PAYER' }, { status: 400 });
  }

  try {
    const result = (await createOrGetPaymentSession({
      owner,
      edicaoId,
      type,
      orderId,
      externalReference,
      items: items.map((x: any) => ({
        title: String(x?.title ?? 'Pagamento'),
        quantity: typeof x?.quantity === 'number' ? x.quantity : Number(x?.quantity ?? 1),
        unit_price: typeof x?.unit_price === 'number' ? x.unit_price : Number(x?.unit_price ?? 0),
      })),
      payer: {
        name: String(payer?.name ?? ''),
        cpf: String(payer?.cpf ?? ''),
        zipCode: String(payer?.zipCode ?? ''),
        street: String(payer?.street ?? ''),
        number: String(payer?.number ?? ''),
        neighborhood: String(payer?.neighborhood ?? ''),
        complement: String(payer?.complement ?? ''),
        phone: String(payer?.phone ?? ''),
        email: String(payer?.email ?? ''),
      },
      paymentConfig: body?.paymentConfig ?? {},
      paymentConfigOriginal: body?.paymentConfigOriginal,
      codigoDesconto: body?.codigoDesconto,
      codigoRastreio: body?.codigoRastreio,
      valoresCentavos: body?.valoresCentavos,
      metodosPagamentoPermitidos: body?.metodosPagamentoPermitidos,
    }))


    return NextResponse.json({
      success: true,
      data: {
        status: (result as any).session.status,
        init_point: (result as any).init_point,
        expiresAt: (result as any).expiresAt,
        sessionId: (result as any).session._id.toString(),
        compraId: (result as any).session._id.toString(),
      },
    });
  } catch (e: any) {
    const result: any = null;

    return NextResponse.json(
      { success: false, error: e?.message || 'PAYMENT_SESSION_FAILED' },
      { status: 500 }
    );
  }
}
