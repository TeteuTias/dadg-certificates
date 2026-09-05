import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import {
  PaymentSession,
  type PaymentSessionStatus,
} from '@/lib/selective-processes/models/PaymentSessionModel';
import { PaymentAttribution } from '@/lib/selective-processes/models/PaymentAttributionModel';
import { getMpClient } from '@/lib/selective-processes/services/mpClient';

export const dynamic = 'force-dynamic';

function mapMpStatusToSessionStatus(mpStatus: string): PaymentSessionStatus {
  const s = mpStatus.toLowerCase();

  if (s === 'approved') return 'PAGO' as any;
  if (s === 'rejected') return 'CANCELED' as any;
  if (s === 'cancelled') return 'CANCELED' as any;
  if (s === 'refunded') return 'CANCELED' as any;

  return 'MP_PENDING' as any;
}

function mapMpStatusToAttributionStatus(mpStatus: string):
  | 'PAGAMENTO_PENDENTE'
  | 'PAGAMENTO_APROVADO'
  | 'PAGAMENTO_CANCELADO' {
  const s = mpStatus.toLowerCase();

  if (s === 'approved') return 'PAGAMENTO_APROVADO';
  if (s === 'rejected' || s === 'cancelled' || s === 'refunded') {
    return 'PAGAMENTO_CANCELADO';
  }

  return 'PAGAMENTO_PENDENTE';
}

export async function POST(request: NextRequest) {
  // Mercado Pago recomenda responder 200/201 rapidamente.
  // Então validamos o mínimo e processamos em try/catch.
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const type = body?.type;
  const dataId = body?.data?.id ?? body?.id;

  // Ignora notificações não relacionadas a payment.
  if (type !== 'payment' || !dataId) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  try {
    await connectToDatabase();

    const mp = getMpClient();

    // GET /v1/payments/{id}
    const response = await mp.payments.get({ id: String(dataId) });
    //const payment = response?.body?.response ?? response?.body ?? response;
    
    const mpStatus: string | undefined = response.status;
    const externalReferenceRaw = response.external_reference;

    // Contrato: external_reference contém o _id da sessão.
    const externalReference =
      typeof externalReferenceRaw === 'string'
        ? externalReferenceRaw
        : typeof externalReferenceRaw === 'number'
          ? String(externalReferenceRaw)
          : null;

    if (!mpStatus || !externalReference) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const sessionStatus = mapMpStatusToSessionStatus(mpStatus);
    const attributionStatus = mapMpStatusToAttributionStatus(mpStatus);

    const mpSessionId = new mongoose.Types.ObjectId(externalReference);

    if (mpStatus.toLowerCase() === 'approved') {
      await PaymentSession.updateOne(
        { _id: mpSessionId },
        { $set: { status: 'PAGO' as any } }
      );

      await PaymentAttribution.updateMany(
        { compraId: mpSessionId },
        { $set: { status: 'PAGAMENTO_APROVADO' } }
      );

      // TODO: Chamar função para efetivar a inscrição do candidato no processo seletivo.
    } else if (
      mpStatus.toLowerCase() === 'rejected' ||
      mpStatus.toLowerCase() === 'cancelled' ||
      mpStatus.toLowerCase() === 'refunded'
    ) {
      await PaymentSession.updateOne(
        { _id: mpSessionId },
        { $set: { status: 'CANCELED' as any } }
      );

      await PaymentAttribution.updateMany(
        { compraId: mpSessionId },
        { $set: { status: 'PAGAMENTO_CANCELADO' } }
      );
    } else {
      await PaymentSession.updateOne(
        { _id: mpSessionId },
        { $set: { status: sessionStatus } }
      );

      await PaymentAttribution.updateMany(
        { compraId: mpSessionId },
        { $set: { status: attributionStatus } }
      );
    }
  } catch {
    // Não propagar erros para evitar retentativas massivas.
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
