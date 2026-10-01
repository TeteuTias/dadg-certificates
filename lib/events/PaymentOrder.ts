import mongoose, { Schema } from "mongoose";
const schema = new Schema(
  {
    participantId: { type: Schema.Types.ObjectId, required: true },
    eventId: { type: Schema.Types.ObjectId, required: true },
    profileId: { type: Schema.Types.ObjectId, required: true },
    amountCents: { type: Number, required: true },
    title: String,
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["CREATING", "PENDING", "PAID", "CANCELLED", "REVERSED", "REVIEW"],
      required: true,
    },
    preferenceId: String,
    paymentUrl: String,
    paymentIds: [String],
    providerClosed: Boolean,
    lockToken: String,
    lockedUntil: Date,
    reviewReason: String,
  },
  {
    collection: "events.paymentOrders",
    timestamps: true,
    autoIndex: false,
    autoCreate: false,
  },
);
export const EventOrder =
  (mongoose.models.EventOrder as
    mongoose.Model<mongoose.InferSchemaType<typeof schema>> | undefined) ||
  mongoose.model("EventOrder", schema);
