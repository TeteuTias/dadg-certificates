import mongoose, { Schema } from 'mongoose';
export type TicketPaymentStatus = 'PENDING' | 'PAID' | 'CANCELED' | 'REVIEW_REQUIRED';
export interface ITicket {
  applicationId: mongoose.Types.ObjectId; selectionProcessId: mongoose.Types.ObjectId;
  paymentSessionId?: mongoose.Types.ObjectId; paymentStatus: TicketPaymentStatus;
  totalAmount: number; leagueAllowanceCount: number;
}
const schema = new Schema<ITicket>({
  applicationId: { type: Schema.Types.ObjectId, required: true, ref: 'Application' },
  selectionProcessId: { type: Schema.Types.ObjectId, required: true, ref: 'selectionprocesses' },
  paymentSessionId: Schema.Types.ObjectId,
  paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'CANCELED', 'REVIEW_REQUIRED'], default: 'PENDING' },
  totalAmount: { type: Number, required: true, min: 0 },
  leagueAllowanceCount: { type: Number, required: true, min: 1, max: 4 },
}, { timestamps: true, autoIndex: false, autoCreate: false });
schema.index({ applicationId: 1 }, { unique: true });
export const Ticket = (mongoose.models.Ticket as mongoose.Model<ITicket>) || mongoose.model<ITicket>('Ticket', schema);
