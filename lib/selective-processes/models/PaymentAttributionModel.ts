import mongoose, { InferSchemaType, Schema } from 'mongoose';

export type AttributionStatus =
  | 'PAGAMENTO_PENDENTE'
  | 'PAGAMENTO_APROVADO'
  | 'PAGAMENTO_CANCELADO';

type PaymentAttributionSchemaType = InferSchemaType<{
  compraId: mongoose.Types.ObjectId;
  edicaoId: string;
  usuarioId: mongoose.Types.ObjectId;

  codigoDesconto?: Record<string, unknown> | null;
  codigoRastreio?: Record<string, unknown> | null;

  status: AttributionStatus;
  valoresCentavos?: {
    original?: Record<string, number>;
    final?: Record<string, number>;
    desconto?: Record<string, number>;
  };

  pagamento?: {
    checkoutId: string;
    metodo: 'CHECKOUT_PRO';
  };

  valorSelecionadoCentavos?: {
    original: number;
    desconto: number;
    final: number;
  };
}>;

const PaymentAttributionSchema: Schema<PaymentAttributionSchemaType> = new mongoose.Schema(
  {
    compraId: { type: Schema.Types.ObjectId, required: true, ref: 'PaymentSession' },
    edicaoId: { type: String, required: true },
    usuarioId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },

    codigoDesconto: { type: Schema.Types.Mixed, required: false, default: null },
    codigoRastreio: { type: Schema.Types.Mixed, required: false, default: null },

    status: {
      type: String,
      required: true,
      enum: ['PAGAMENTO_PENDENTE', 'PAGAMENTO_APROVADO', 'PAGAMENTO_CANCELADO'],
      default: 'PAGAMENTO_PENDENTE',
    },

    valoresCentavos: { type: Schema.Types.Mixed, required: false },

    pagamento: {
      type: Schema.Types.Mixed,
      required: false,
    },

    valorSelecionadoCentavos: { type: Schema.Types.Mixed, required: false },
  },
  { timestamps: true }
);

PaymentAttributionSchema.index({ compraId: 1 });
PaymentAttributionSchema.index({ 'pagamento.checkoutId': 1 });
PaymentAttributionSchema.index({ edicaoId: 1, usuarioId: 1 });

export type IPaymentAttribution = PaymentAttributionSchemaType;

export const PaymentAttribution =
  (mongoose.models.PaymentAttribution as mongoose.Model<PaymentAttributionSchemaType>) ||
  mongoose.model<PaymentAttributionSchemaType>(
    'PaymentAttribution',
    PaymentAttributionSchema
  );
