import mongoose, { InferSchemaType, Schema } from 'mongoose';

export interface IPricingTier {
  selectionProcessId: mongoose.Types.ObjectId;
  examsCount: number;
  unitTotalPrice: number;
}

type PricingTierSchemaType = InferSchemaType<{
  selectionProcessId: mongoose.Types.ObjectId;
  examsCount: number;
  unitTotalPrice: number;
}>;

const PricingTierSchema: Schema<IPricingTier> = new mongoose.Schema(
  {
    selectionProcessId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'SelectionProcess',
    },
    examsCount: { type: Number, required: true, min: 1 },
    unitTotalPrice: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

export const PricingTier =
  (mongoose.models.PricingTier as mongoose.Model<PricingTierSchemaType>) ||
  mongoose.model<PricingTierSchemaType>('PricingTier', PricingTierSchema);
