import mongoose, { InferSchemaType, Schema } from 'mongoose';

export type TicketPaymentStatus = 'PENDING' | 'PAID' | 'CANCELED';

type TicketSchemaType = InferSchemaType<{
  applicationId: mongoose.Types.ObjectId;
  paymentStatus: TicketPaymentStatus;
  totalAmount: number;
}>;

export interface ITicket {
  applicationId: mongoose.Types.ObjectId;
  paymentStatus: TicketPaymentStatus;
  totalAmount: number;
}

const TicketSchema: Schema<ITicket> = new mongoose.Schema(
  {
    applicationId: { type: Schema.Types.ObjectId, required: true, ref: 'Application' },
    paymentStatus: {
      type: String,
      required: true,
      enum: ['PENDING', 'PAID', 'CANCELED'],
      default: 'PENDING',
    },
    totalAmount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

export const Ticket =
  (mongoose.models.Ticket as mongoose.Model<TicketSchemaType>) ||
  mongoose.model<TicketSchemaType>('Ticket', TicketSchema);
