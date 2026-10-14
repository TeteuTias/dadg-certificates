import mongoose, { Schema } from "mongoose";
const schema = new Schema(
  {
    _id: String,
    certificateId: { type: Schema.Types.ObjectId, required: true },
    profileId: { type: Schema.Types.ObjectId, required: true },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "REVOKED"],
      required: true,
    },
    // automatic: CPF e e-mail verificado; automatic-name-cpf: CPF e nome completo, e-mail diferente.
    source: { type: String, enum: ["manual", "automatic", "automatic-name-cpf"] },
    message: String,
    reason: String,
    reviewedBy: String,
    reviewedAt: Date,
    history: [{ status: String, reason: String, actor: String, at: Date }],
  },
  {
    collection: "certificates.claims",
    timestamps: true,
    autoIndex: false,
    autoCreate: false,
  },
);
export const CertificateClaim =
  (mongoose.models.CertificateClaim as
    mongoose.Model<mongoose.InferSchemaType<typeof schema>> | undefined) ||
  mongoose.model("CertificateClaim", schema);
