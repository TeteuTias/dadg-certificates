import { NextRequest, NextResponse } from 'next/server';
import GateKeeper from '@/lib/security/gatekeeper';
import { createCheckoutProPaymentForInscription } from '@/lib/selective-processes/payment-service';
import { identifyStudentOwner } from '@/lib/selective-processes/student-identity';
import {
  getSelectionProcessForStudents,
  getStudentApplicationState,
  resolveTotalPrice,
} from '@/lib/selective-processes/services/studentSelectiveProcesses';
import { ObjectId } from 'bson';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

type PayerBody = {
  name?: unknown;
  cpf?: unknown;
  zipCode?: unknown;
  street?: unknown;
  number?: unknown;
  neighborhood?: unknown;
  complement?: unknown;
  phone?: unknown;
  email?: unknown;
};

const REQUIRED_PAYER_FIELDS: Array<keyof PayerBody> = [
  'name',
  'cpf',
  'zipCode',
  'street',
  'number',
  'neighborhood',
  'phone',
  'email',
];

/**
 * Checkout de inscrição iniciado pelo próprio candidato.
 *
 * Diferente de `/api/selective-processes/checkout`, aqui o valor NÃO vem do
 * cliente: o total é calculado no servidor a partir das faixas de preço
 * (PricingTier) cadastradas para o processo seletivo.
 */
export async function POST(request: NextRequest, { params }: Context) {
  const access = await new GateKeeper(request).validate();
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message, code: access.code },
      { status: access.status || 403 },
    );
  }

  const identity = await identifyStudentOwner(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'NOT_AUTHENTICATED' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }

  const examsCount = Number(body.examsCount);
  if (!Number.isInteger(examsCount) || examsCount < 1) {
    return NextResponse.json({ success: false, error: 'INVALID_EXAMS_COUNT' }, { status: 400 });
  }

  const payer = (body.payer ?? {}) as PayerBody;
  const missingField = REQUIRED_PAYER_FIELDS.find(
    (field) => typeof payer[field] !== 'string' || !String(payer[field]).trim(),
  );
  if (missingField) {
    return NextResponse.json(
      { success: false, error: 'INVALID_PAYER', field: missingField },
      { status: 400 },
    );
  }

  const process = await getSelectionProcessForStudents(id);
  if (!process) {
    return NextResponse.json({ success: false, error: 'PROCESS_NOT_FOUND' }, { status: 404 });
  }
  if (!process.isRegistrationOpen) {
    return NextResponse.json({ success: false, error: 'REGISTRATION_CLOSED' }, { status: 409 });
  }
  if (process.remainingCapacity <= 0) {
    return NextResponse.json({ success: false, error: 'SOLD_OUT' }, { status: 409 });
  }
  if (examsCount > process.maxExamsPerApplication) {
    return NextResponse.json(
      { success: false, error: 'EXAMS_EXCEED_MAX_PER_APPLICATION' },
      { status: 400 },
    );
  }

  const state = await getStudentApplicationState({ selectionProcessId: id, userId: identity.userId });
  if (state && !state.canCheckout) {
    return NextResponse.json({ success: false, error: 'ALREADY_ENROLLED' }, { status: 409 });
  }

  const totalAmount = resolveTotalPrice(process.pricingTiers, examsCount);
  if (totalAmount === null || totalAmount <= 0) {
    return NextResponse.json({ success: false, error: 'PRICING_NOT_CONFIGURED' }, { status: 409 });
  }

  try {
    const result = await createCheckoutProPaymentForInscription({
      usuarioId: identity.userId,
      edicaoId: id,
      type: 'ticket',
      externalReference: `${new ObjectId()}`,
      items: [
        {
          title: `Inscrição - Processo Seletivo CLAM (${examsCount} liga${examsCount === 1 ? '' : 's'})`,
          quantity: 1,
          unit_price: totalAmount,
        },
      ],
      payer: {
        name: String(payer.name).trim(),
        cpf: String(payer.cpf).replace(/\D/g, ''),
        zipCode: String(payer.zipCode).replace(/\D/g, ''),
        street: String(payer.street).trim(),
        number: String(payer.number).trim(),
        neighborhood: String(payer.neighborhood).trim(),
        complement: typeof payer.complement === 'string' ? payer.complement.trim() : '',
        phone: String(payer.phone).replace(/\D/g, ''),
        email: String(payer.email).trim().toLowerCase(),
      },
      // Consumido pelo webhook para saber quantas ligas foram pagas.
      paymentConfig: { examsCount, totalAmount },
    });

    return NextResponse.json({ success: true, data: { ...result, examsCount, totalAmount } });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'PROCESS_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'PROCESS_NOT_FOUND' }, { status: 404 });
    }
    if (code === 'REGISTRATION_CLOSED') {
      return NextResponse.json({ success: false, error: 'REGISTRATION_CLOSED' }, { status: 409 });
    }
    if (code === 'ALREADY_ENROLLED') {
      return NextResponse.json({ success: false, error: 'ALREADY_ENROLLED' }, { status: 409 });
    }

    console.error('[POST /api/v1/selective-processes/:id/checkout]', error);
    return NextResponse.json({ success: false, error: 'PAYMENT_CHECKOUT_FAILED' }, { status: 500 });
  }
}
