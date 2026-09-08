import mongoose, { Schema } from 'mongoose';
export interface IReservation {
  _id: string; selectionProcessId: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId;
  state: 'IDLE' | 'RESERVED' | 'PAID' | 'REVERSED'; activeSessionId?: mongoose.Types.ObjectId;
  reviewReason?: string; firstPaidAt?: Date; lockToken?: string | null; lockUntil?: Date | null;
}
const schema = new Schema<IReservation>({
  _id: String, selectionProcessId: { type: Schema.Types.ObjectId, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  state: { type: String, enum: ['IDLE', 'RESERVED', 'PAID', 'REVERSED'], default: 'IDLE' },
  reviewReason: String, activeSessionId: Schema.Types.ObjectId, firstPaidAt: Date, lockToken: String, lockUntil: Date,
}, { timestamps: true, autoIndex: false, autoCreate: false });
export const Reservation = (mongoose.models.ClamReservation as mongoose.Model<IReservation>) || mongoose.model<IReservation>('ClamReservation', schema, 'clam_reservations');
export const reservationKey = (processId: string, userId: string) => `${processId.toLowerCase()}:${userId.toLowerCase()}`;
