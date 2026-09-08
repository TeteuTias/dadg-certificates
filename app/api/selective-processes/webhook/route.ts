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
  // Requisito Mercado Pago: responder 200 rapidamente.
  // Então, parseamos e validamos o mínimo; a parte pesada segue em try/catch.
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const type = body?.type;
  const dataId = body?.data?.id ?? body?.id;
  if (type !== 'payment' || !dataId) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const checkoutIdFromMp = String(dataId);

  // Processing em bloco separado (mas ainda dentro do request).
  // Se quiser, dá pra mover para background job, mas aqui mantemos simples e robusto.
  try {
    await connectToDatabase();

    const mp = getMpClient();

    // GET /v1/payments/{id}
    const response = await mp.payments.get({ id: checkoutIdFromMp });

    const mpStatus: string | undefined = response.status;
    const externalReferenceRaw = response.external_reference;

    // No contrato que você passou: external_reference contém o _id da sessão.
    const externalReference = typeof externalReferenceRaw === 'string'
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
      // Atualiza sessão
      await PaymentSession.updateOne(
        { _id: mpSessionId },
        { $set: { status: 'PAGO' as any } }
      );

      // Atualiza atribuição (compraId == externalReference)
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
      // fallback: mantém pendente ou atualiza conforme necessidade
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
    // Compatibilidade Mercado Pago: não gerar retentativas por erro.
    // Sem log aqui para manter comportamento minimalista.
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}