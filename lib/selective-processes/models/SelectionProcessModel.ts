import mongoose, { Schema } from 'mongoose';
export interface ISelectionProcess {
  registrationStartDate: Date; registrationEndDate: Date; maxExamsPerApplication: number;
  maxCapacity: number; allocatedCount: number; accountingVersion: number; revision: number;
}
const schema = new Schema<ISelectionProcess>({
  registrationStartDate: { type: Date, required: true }, registrationEndDate: { type: Date, required: true },
  maxExamsPerApplication: { type: Number, required: true, min: 1, max: 4, validate: Number.isInteger },
  maxCapacity: { type: Number, required: true, min: 0, validate: Number.isInteger },
  allocatedCount: { type: Number, default: 0, min: 0 }, accountingVersion: { type: Number, default: 1 },
  revision: { type: Number, default: 0 },
}, { timestamps: true, autoIndex: false, autoCreate: false });
export const SelectionProcess = (mongoose.models.selectionprocesses as mongoose.Model<ISelectionProcess>) || mongoose.model<ISelectionProcess>('selectionprocesses', schema);
