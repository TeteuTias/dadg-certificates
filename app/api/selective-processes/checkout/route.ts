import { NextRequest, NextResponse } from 'next/server';
import GateKeeper from '@/lib/security/gatekeeper';
import { createCheckoutProPaymentForInscription } from '@/lib/selective-processes/payment-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Como o frontend é separado, esta rota ainda deve ser protegida por auth/admin conforme seu GateKeeper.
  const access = await new GateKeeper(request).validate();
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message, code: access.code },
      { status: access.status || 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }

  const usuarioId = body?.usuarioId;
  const edicaoId = body?.edicaoId;
  const type = body?.type;

  if (!usuarioId || typeof usuarioId !== 'string') {
    return NextResponse.json({ success: false, error: 'INVALID_USUARIO_ID' }, { status: 400 });
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
  const paymentConfig = body?.paymentConfig;

  if (typeof externalReference !== 'string') {
    return NextResponse.json(
      { success: false, error: 'INVALID_EXTERNAL_REFERENCE' },
      { status: 400 }
    );
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ success: false, error: 'INVALID_ITEMS' }, { status: 400 });
  }
  if (!payer || typeof payer !== 'object') {
    return NextResponse.json({ success: false, error: 'INVALID_PAYER' }, { status: 400 });
  }
  if (!paymentConfig || typeof paymentConfig !== 'object') {
    return NextResponse.json({ success: false, error: 'INVALID_PAYMENT_CONFIG' }, { status: 400 });
  }

  try {
    const result = await createCheckoutProPaymentForInscription({
      usuarioId,
      edicaoId,
      type,
      externalReference,
      items: items.map((x: any) => ({
        title: String(x?.title ?? 'Pagamento'),
        quantity:
          typeof x?.quantity === 'number' ? x.quantity : Number(x?.quantity ?? 1),
        unit_price:
          typeof x?.unit_price === 'number' ? x.unit_price : Number(x?.unit_price ?? 0),
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
      paymentConfig,
      paymentConfigOriginal: body?.paymentConfigOriginal,
      codigoDesconto: body?.codigoDesconto,
      codigoRastreio: body?.codigoRastreio,
      valoresCentavos: body?.valoresCentavos,
      metodosPagamentoPermitidos: body?.metodosPagamentoPermitidos,
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (e: any) {
    const code = e?.code;

    if (code === 'PROCESS_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'PROCESS_NOT_FOUND' }, { status: 404 });
    }
    if (code === 'REGISTRATION_CLOSED') {
      return NextResponse.json(
        { success: false, error: 'REGISTRATION_CLOSED' },
        { status: 409 }
      );
    }
    if (code === 'ALREADY_ENROLLED') {
      return NextResponse.json(
        { success: false, error: 'ALREADY_ENROLLED' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: e?.message || 'PAYMENT_CHECKOUT_FAILED' },
      { status: 500 }
    );
  }
}
