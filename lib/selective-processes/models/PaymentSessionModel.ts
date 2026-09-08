import mongoose, { Schema } from 'mongoose';
import type { Contract, Payer } from '../domain';
export type PaymentSessionStatus = 'CREATING' | 'PENDING' | 'CANCELING' | 'CANCELED' | 'PAID' | 'REVERSED' | 'REVIEW_REQUIRED' | 'EXPIRED' | 'MP_PENDING' | 'MP_APPROVED';
export type PaymentTicketType = 'ticket' | 'course';
export type IPaymentSession = {
  owner: mongoose.Types.ObjectId; edicaoId: string; orderId: string;
  candidateProfileId?: mongoose.Types.ObjectId;
  contract?: Contract; userProps: Payer; paymentConfig: { examsCount: number; totalAmount: number };
  status: PaymentSessionStatus; type: PaymentTicketType; paymentUrl?: string | null;
  settledAt?: Date; reversedAt?: Date; replacementAttempts: Array<{ key: string; hash: string }>;
  preferenceId?: string; paymentIds: string[]; expiresAt: Date;
  previousSessionId?: mongoose.Types.ObjectId; operationKey?: string; requestHash?: string;
  operationKind?: 'create' | 'replace'; reviewReason?: string; providerClosed: boolean;
};
const schema = new Schema<IPaymentSession>({
  owner: { type: Schema.Types.ObjectId, required: true, immutable: true },
  candidateProfileId: { type: Schema.Types.ObjectId, immutable: true },
  edicaoId: { type: String, required: true, immutable: true },
  orderId: { type: String, required: true, immutable: true },
  contract: {
    type: new Schema({ examsCount: { type: Number, required: true, min: 1, max: 4 },
      amountCents: { type: Number, required: true, min: 1 }, currency: { type: String, enum: ['BRL'], required: true } }, { _id: false }),
    immutable: true,
  },
  userProps: { type: Schema.Types.Mixed, required: true },
  paymentConfig: { type: Schema.Types.Mixed, required: true, immutable: true },
  status: { type: String, required: true, default: 'CREATING' },
  type: { type: String, enum: ['ticket', 'course'], required: true },
  paymentUrl: String, preferenceId: String, paymentIds: { type: [String], default: [] },
  expiresAt: { type: Date, required: true }, previousSessionId: Schema.Types.ObjectId,
  operationKey: String, requestHash: String, operationKind: String, reviewReason: String,
  settledAt: Date, reversedAt: Date, replacementAttempts: { type: [new Schema({ key: String, hash: String }, { _id: false })], default: [] },
  providerClosed: { type: Boolean, default: false },
}, { timestamps: true, autoIndex: false, autoCreate: false });
schema.index({ orderId: 1 }, { unique: true, partialFilterExpression: { orderId: { $type: 'string' } } });
schema.index({ owner: 1, edicaoId: 1, operationKey: 1 }, { unique: true, partialFilterExpression: { operationKey: { $type: 'string' } } });
schema.index({ preferenceId: 1 }, { unique: true, partialFilterExpression: { preferenceId: { $type: 'string' } } });
schema.index({ paymentIds: 1 }, { unique: true, partialFilterExpression: { 'paymentIds.0': { $exists: true } } });
export const PaymentSession = (mongoose.models.PaymentSession as mongoose.Model<IPaymentSession>) || mongoose.model<IPaymentSession>('PaymentSession', schema);
