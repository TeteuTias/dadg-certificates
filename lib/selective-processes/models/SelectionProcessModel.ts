import mongoose, { InferSchemaType, Schema } from 'mongoose';

export type SelectionProcessFinalStatus =
  | 'APPROVED'
  | 'WAITLIST'
  | 'REJECTED'
  | 'PENDING_RESULTS';

export interface ISelectionProcess {
  registrationStartDate: Date;
  registrationEndDate: Date;
  maxExamsPerApplication: number;
  maxCapacity: number;
}

type SelectionProcessSchemaType = InferSchemaType<{
  registrationStartDate: Date;
  registrationEndDate: Date;
  maxExamsPerApplication: number;
  maxCapacity: number;
}>;

const SelectionProcessSchema: Schema<ISelectionProcess> = new mongoose.Schema(
  {
    registrationStartDate: { type: Date, required: true },
    registrationEndDate: { type: Date, required: true },
    maxExamsPerApplication: { type: Number, required: true, min: 1 },
    maxCapacity: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

export const SelectionProcess =
  (mongoose.models.SelectionProcess as mongoose.Model<SelectionProcessSchemaType>) ||
  mongoose.model<SelectionProcessSchemaType>('SelectionProcess', SelectionProcessSchema);
