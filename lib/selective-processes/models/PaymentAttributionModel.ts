import mongoose, { Schema } from 'mongoose';
export type AttributionStatus = 'PAGAMENTO_PENDENTE' | 'PAGAMENTO_APROVADO' | 'PAGAMENTO_CANCELADO' | 'REVISAO_NECESSARIA';
export interface IPaymentAttribution {
  compraId: mongoose.Types.ObjectId; edicaoId: string; usuarioId: mongoose.Types.ObjectId;
  status: AttributionStatus; pagamento?: { checkoutId?: string; metodo: string };
}
const schema = new Schema<IPaymentAttribution>({
  compraId: { type: Schema.Types.ObjectId, required: true }, edicaoId: { type: String, required: true },
  usuarioId: { type: Schema.Types.ObjectId, required: true }, status: { type: String, required: true },
  pagamento: Schema.Types.Mixed,
}, { timestamps: true, autoIndex: false, autoCreate: false });
schema.index({ compraId: 1 }, { unique: true });
export const PaymentAttribution = (mongoose.models.PaymentAttribution as mongoose.Model<IPaymentAttribution>) || mongoose.model<IPaymentAttribution>('PaymentAttribution', schema);
