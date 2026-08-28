import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { PaymentAttribution, type AttributionStatus } from '../models/PaymentAttributionModel';
import {
  PaymentSession,
  type IPaymentSession,
  type PaymentSessionStatus,
} from '../models/PaymentSessionModel';
import { createCheckoutProPreference } from './paymentMp';

const SESSION_VALIDITY_MINUTES = 15;

function nowPlusMinutes(min: number) {
  return new Date(Date.now() + min * 60 * 1000);
}

function mapStatusMpToSessionStatus(status: string): PaymentSessionStatus {
  const normalized = status.toUpperCase();
  if (normalized.includes('APPROVED') || normalized.includes('PAID')) return 'MP_APPROVED';
  if (normalized.includes('PENDING')) return 'MP_PENDING';
  if (normalized.includes('CANCELED') || normalized.includes('CANCELLED')) return 'CANCELED';
  return 'MP_PENDING';
}

function mapStatusMpToAttributionStatus(status: string): AttributionStatus {
  const normalized = status.toUpperCase();
  if (normalized.includes('APPROVED') || normalized.includes('PAID')) return 'PAGAMENTO_APROVADO';
  if (normalized.includes('CANCELED') || normalized.includes('CANCELLED')) return 'PAGAMENTO_CANCELADO';
  return 'PAGAMENTO_PENDENTE';
}

export type CreateOrGetSessionInput = {
  owner: string;
  edicaoId: string; // Identificador único do processo (ex: CIEPS-2026)
  type: 'ticket' | 'course';
  orderId?: string | null;

  // Para Preference/itens do MP
  externalReference: string;
  items: Array<{ title: string; quantity: number; unit_price: number }>;

  payer: {
    name: string;
    cpf: string;
    zipCode: string;
    street: string;
    number: string;
    neighborhood: string;
    complement: string;
    phone: string;
    email: string;
  };

  paymentConfig: any;
  paymentConfigOriginal?: any;
  codigoDesconto?: any;
  codigoRastreio?: any;
  valoresCentavos?: any;
  metodosPagamentoPermitidos?: string[];
};

export async function createOrGetPaymentSession(
  input: CreateOrGetSessionInput
): Promise<{
  session: IPaymentSession;
  expiresAt: Date;
  init_point: string | null;
}> {
  await connectToDatabase();

  const ownerObjectId = new mongoose.Types.ObjectId(input.owner);

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const expiresCutoff = new Date(Date.now() - 1); // usado apenas p/ consistência; vamos checar expiresAt

    const existing = await PaymentSession.findOne({
      owner: ownerObjectId,
      edicaoId: input.edicaoId,
      status: { $in: ['PENDING', 'MP_PENDING', 'MP_APPROVED', 'EXPIRED', 'CANCELED'] },
    }).sort({ expiresAt: -1 });

    if (existing && existing.expiresAt && new Date(existing.expiresAt).getTime() > Date.now()) {
      // Se existir e ainda não expirou: retorna imediatamente.
      return {
        session: existing,
        expiresAt: existing.expiresAt,
        init_point: existing.paymentUrl ?? null,
      };
    }

    // Se houver sessão vencida: invalida.
    if (existing) {
      await PaymentSession.updateOne(
        { _id: existing._id },
        { $set: { status: 'EXPIRED', expiresAt: existing.expiresAt } },
        { session }
      );
    }

    // CRÍTICO: Prevenção de duplicidade
    // Em transação, criamos apenas uma sessão nova.
    // Para reforçar, buscamos novamente por sessões ativas antes de inserir.
    const active = await PaymentSession.findOne({
      owner: ownerObjectId,
      edicaoId: input.edicaoId,
      expiresAt: { $gt: new Date() },
      status: { $in: ['PENDING', 'MP_PENDING'] },
    }).session(session);

    if (active) {
      return {
        session: active,
        expiresAt: active.expiresAt,
        init_point: active.paymentUrl ?? null,
      };
    }

    const pref = await createCheckoutProPreference({
      externalReference: input.externalReference,
      items: input.items,
      payer: {
        email: input.payer.email,
        identification: {
          type: 'CPF',
          number: input.payer.cpf,
        },
        first_name: input.payer.name,
        last_name: '',
      },
      backUrls: {
        success: process.env.MERCADOPAGO_BACK_URL_SUCCESS,
        pending: process.env.MERCADOPAGO_BACK_URL_PENDING,
        failure: process.env.MERCADOPAGO_BACK_URL_FAILURE,
      },
    });

    const expiresAt = nowPlusMinutes(SESSION_VALIDITY_MINUTES);

    const createdSession = await PaymentSession.create(
      [
        {
          orderId: input.orderId ?? null,
          owner: ownerObjectId,
          edicaoId: input.edicaoId,
          pixCode: null,
          userProps: {
            name: input.payer.name,
            cpf: input.payer.cpf,
            zipCode: input.payer.zipCode,
            street: input.payer.street,
            number: input.payer.number,
            neighborhood: input.payer.neighborhood,
            complement: input.payer.complement,
            phone: input.payer.phone,
            email: input.payer.email,
          },
          paymentConfig: input.paymentConfig,
          paymentConfigOriginal: input.paymentConfigOriginal,
          codigoDesconto: input.codigoDesconto ?? null,
          codigoRastreio: input.codigoRastreio ?? null,
          valoresCentavos: input.valoresCentavos,
          metodosPagamentoPermitidos: input.metodosPagamentoPermitidos,
          metodoPagamento: 'CHECKOUT_PRO',
          type: input.type,
          status: 'PENDING',
          paymentUrl: pref.init_point,
          expiresAt,
          checkoutExpiresAt: null,
          previousSessionId: undefined,
        },
      ],
      { session }
    );

    const inserted = createdSession[0];

    await PaymentAttribution.create(
      [
        {
          compraId: inserted._id,
          edicaoId: input.edicaoId,
          usuarioId: ownerObjectId,
          codigoDesconto: input.codigoDesconto ?? null,
          codigoRastreio: input.codigoRastreio ?? null,
          status: 'PAGAMENTO_PENDENTE',
          valoresCentavos: input.valoresCentavos,
          pagamento: {
            checkoutId: pref.checkoutId,
            metodo: 'CHECKOUT_PRO',
          },
          valorSelecionadoCentavos: input.valoresCentavos
            ? {
                original: input.valoresCentavos.original?.PIX ?? 0,
                desconto: input.valoresCentavos.desconto?.PIX ?? 0,
                final: input.valoresCentavos.final?.PIX ?? 0,
              }
            : undefined,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return {
      session: inserted,
      expiresAt,
      init_point: pref.init_point,
    };
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
}

export async function applyMpWebhookUpdate(params: {
  checkoutId: string;
  mpStatus: string;
}): Promise<{
  sessionId?: string;
  attributionId?: string;
  updated: boolean;
}> {
  await connectToDatabase();

  const { checkoutId, mpStatus } = params;

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const attribution = await PaymentAttribution.findOne({
      'pagamento.checkoutId': checkoutId,
    }).session(session);

    if (!attribution) {
      await session.abortTransaction();
      return { updated: false };
    }

    const nextSessionStatus = mapStatusMpToSessionStatus(mpStatus);
    const nextAttrStatus = mapStatusMpToAttributionStatus(mpStatus);

    const updatedAttribution = await PaymentAttribution.updateOne(
      { _id: attribution._id },
      { $set: { status: nextAttrStatus } },
      { session }
    );

    const paymentSession = await PaymentSession.findById(attribution.compraId).session(session);
    if (paymentSession) {
      await PaymentSession.updateOne(
        { _id: paymentSession._id },
        { $set: { status: nextSessionStatus } },
        { session }
      );
    }

    await session.commitTransaction();

    return {
      sessionId: attribution.compraId.toString(),
      attributionId: attribution._id.toString(),
      updated: Boolean(updatedAttribution.modifiedCount || updatedAttribution.matchedCount),
    };
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
}

export function getMpWebhookStatusFromBody(body: any): string | null {
  return (
    body?.data?.status ||
    body?.resource?.status ||
    body?.status ||
    body?.event?.status ||
    null
  );
}

export function getMpCheckoutIdFromBody(body: any): string | null {
  const v = body?.data?.id ?? body?.resource?.id ?? body?.id ?? null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return null;
}

// TODO: Função de inscrever candidato definitivamente no processo seletivo após a confirmação do pagamento
export async function enrollCandidateAfterPaid(_: {
  // Implementar quando o fluxo de matrícula estiver definido.
  paymentSessionId: string;
  edicaoId: string;
  usuarioId: string;
}) {
  // Intencionalmente vazio nesta etapa (backend apenas).
}
