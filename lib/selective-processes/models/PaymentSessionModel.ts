import mongoose, { InferSchemaType, Schema } from 'mongoose';

export type PaymentSessionMethod = 'CHECKOUT_PRO' | 'PIX' | 'BOLETO' | 'CARD';
export type PaymentSessionStatus =
  | 'PENDING'
  | 'EXPIRED'
  | 'CANCELED'
  | 'PAID'
  | 'MP_PENDING'
  | 'MP_APPROVED';

export type PaymentAmountsSnapshot = {
  original: Record<string, number>;
  final: Record<string, number>;
  desconto: Record<string, number>;
};

export type PaymentCodeSnapshot = {
  code?: string | null;
  type?: string | null;
};

export type ILoteAutomatico = {
  // Mantém compatibilidade com o projeto.
  [key: string]: unknown;
};

export type PaymentTicketType = 'ticket' | 'course';

type PaymentSessionSchemaType = InferSchemaType<{
  orderId?: string | null;
  owner: mongoose.Types.ObjectId;
  edicaoId?: string;
  pixCode?: string | null;
  userProps: {
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
  paymentConfig: ILoteAutomatico;
  paymentConfigOriginal?: ILoteAutomatico;
  codigoDesconto?: PaymentCodeSnapshot;
  codigoRastreio?: PaymentCodeSnapshot;
  valoresCentavos?: PaymentAmountsSnapshot;
  metodosPagamentoPermitidos?: string[];
  metodoPagamento?: PaymentSessionMethod | null;
  type: PaymentTicketType;
  status: PaymentSessionStatus;
  paymentUrl?: string | null;
  expiresAt: Date;
  checkoutExpiresAt?: Date | null;
  previousSessionId?: mongoose.Types.ObjectId;
}>;

const PaymentSessionSchema: Schema<PaymentSessionSchemaType> = new mongoose.Schema(
  {
    orderId: { type: String, required: false, default: null },
    owner: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    edicaoId: { type: String, required: false },

    pixCode: { type: String, required: false, default: null },

    userProps: {
      name: { type: String, required: true },
      cpf: { type: String, required: true },
      zipCode: { type: String, required: true },
      street: { type: String, required: true },
      number: { type: String, required: true },
      neighborhood: { type: String, required: true },
      // Complemento e opcional no formulario de inscricao; exigir aqui fazia a
      // criacao da sessao falhar para quem mora em casa sem complemento.
      complement: { type: String, required: false, default: '' },
      phone: { type: String, required: true },
      email: { type: String, required: true },
    },

    paymentConfig: { type: Schema.Types.Mixed, required: true },
    paymentConfigOriginal: { type: Schema.Types.Mixed, required: false },

    codigoDesconto: { type: Schema.Types.Mixed, required: false },
    codigoRastreio: { type: Schema.Types.Mixed, required: false },
    valoresCentavos: { type: Schema.Types.Mixed, required: false },

    metodosPagamentoPermitidos: { type: [String], required: false },
    metodoPagamento: { type: String, required: false, default: null },

    type: { type: String, required: true, enum: ['ticket', 'course'] },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'EXPIRED', 'CANCELED', 'PAID', 'MP_PENDING', 'MP_APPROVED'],
      default: 'PENDING',
    },

    paymentUrl: { type: String, required: false, default: null },
    expiresAt: { type: Date, required: true },

    checkoutExpiresAt: { type: Date, required: false, default: null },

    previousSessionId: { type: Schema.Types.ObjectId, required: false },
  },
  { timestamps: true }
);

PaymentSessionSchema.index({ owner: 1, edicaoId: 1 });
PaymentSessionSchema.index({ expiresAt: 1 });
PaymentSessionSchema.index({ status: 1 });

export type IPaymentSession = PaymentSessionSchemaType;

export const PaymentSession =
  (mongoose.models.PaymentSession as mongoose.Model<PaymentSessionSchemaType>) ||
  mongoose.model<PaymentSessionSchemaType>('PaymentSession', PaymentSessionSchema);
