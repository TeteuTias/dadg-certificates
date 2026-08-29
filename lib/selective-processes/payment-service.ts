import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { SelectionProcess } from './models/SelectionProcessModel';
import {
  PaymentSession,
  type IPaymentSession,
  type PaymentSessionStatus,
  type PaymentTicketType,
} from './models/PaymentSessionModel';
import { PaymentAttribution } from './models/PaymentAttributionModel';
import { createCheckoutProPreference } from './services/paymentMp';

const SESSION_VALIDITY_MINUTES = 15;
const ACTIVE_ATTRI_STATUS = ['PAGAMENTO_PENDENTE'];

function expiresAtPlusMinutes(min: number) {
  return new Date(Date.now() + min * 60 * 1000);
}

function isPendingWithinValidity(expiresAt: Date) {
  return Boolean(expiresAt) && new Date(expiresAt).getTime() > Date.now();
}

export type CheckoutProPaymentResult = {
  init_point: string;
  sessionId: string;
  expiresAt: Date;
};

export type CreateCheckoutProPaymentInput = {
  usuarioId: string;
  edicaoId: string;
  type: PaymentTicketType;

  // Dados para criar a preference (Checkout Pro)
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

export async function createCheckoutProPaymentForInscription(
  input: CreateCheckoutProPaymentInput
): Promise<CheckoutProPaymentResult> {
  await connectToDatabase();

  const ownerObjectId = new mongoose.Types.ObjectId(input.usuarioId);

  // 1) Validação do Processo Seletivo
  const selectionProcess = await SelectionProcess.findOne({ _id: input.edicaoId }).lean();
  if (!selectionProcess) {
    throw Object.assign(new Error('PROCESS_NOT_FOUND'), { code: 'PROCESS_NOT_FOUND' });
  }

  const registrationStart = new Date((selectionProcess as any).registrationStartDate);
  const registrationEnd = new Date((selectionProcess as any).registrationEndDate);
  const now = new Date();

  if (!(now.getTime() >= registrationStart.getTime() && now.getTime() <= registrationEnd.getTime())) {
    throw Object.assign(new Error('REGISTRATION_CLOSED'), { code: 'REGISTRATION_CLOSED' });
  }

  // 2) Checagem se usuário já pagou/inseriu definitivamente
  // Regra: se existe atribuição para (usuarioId, edicaoId) com status PAGO (ou equivalente confirmado)
  // Aqui tratamos como: PAGAMENTO_APROVADO bloqueia.
  const alreadyPaid = await PaymentAttribution.findOne({
    usuarioId: ownerObjectId,
    edicaoId: input.edicaoId,
    status: 'PAGAMENTO_APROVADO',
  }).lean();

  if (alreadyPaid) {
    throw Object.assign(new Error('ALREADY_ENROLLED'), { code: 'ALREADY_ENROLLED' });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // 3) Gerenciamento de Sessão (15 minutos) via atribuição
    // Se existir atribuição PENDENTE e sessão ainda válida, recupera.
    const pendingAttr = await PaymentAttribution.findOne({
      usuarioId: ownerObjectId,
      edicaoId: input.edicaoId,
      status: { $in: ACTIVE_ATTRI_STATUS },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (pendingAttr?.compraId) {
      const foundSession = await PaymentSession.findById((pendingAttr as any).compraId).lean();
      if (foundSession && foundSession.expiresAt && isPendingWithinValidity(new Date(foundSession.expiresAt))) {
        const init_point = (foundSession as any).paymentUrl;
        if (typeof init_point === 'string' && init_point.length > 0) {
          await session.commitTransaction();
          return {
            init_point,
            sessionId: String(foundSession._id),
            expiresAt: new Date(foundSession.expiresAt),
          };
        }
      }

      // Sessão vencida: expirar
      if (foundSession && foundSession._id) {
        await PaymentSession.updateOne(
          { _id: (foundSession as any)._id },
          { $set: { status: 'EXPIRED' as PaymentSessionStatus } },
          { session }
        );
      }
    }

    // 4) Criação do Checkout Pro + Sessão + Atribuição
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

    const expiresAt = expiresAtPlusMinutes(SESSION_VALIDITY_MINUTES);

    const createdSessionDoc = await PaymentSession.create(
      [
        {
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

    const createdSession = createdSessionDoc[0] as IPaymentSession;

    await PaymentAttribution.create(
      [
        {
          compraId: (createdSession as any)._id,
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

    // Inscrição só ocorre após webhook confirmar pagamento (placeholder no outro serviço)

    await session.commitTransaction();

    return {
      init_point: pref.init_point,
      sessionId: String((createdSession as any)._id),
      expiresAt,
    };
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
}
