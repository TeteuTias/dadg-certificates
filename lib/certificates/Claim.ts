import mongoose, { Schema } from "mongoose";
// Regras em lib/certificates/auto-link.ts. automatic-suggestion: o vínculo
// achou o nome do aluno sem prova suficiente e deixou para o administrador.
export const CLAIM_SOURCES = ["manual", "automatic", "automatic-name-cpf", "automatic-email-name", "automatic-name", "automatic-suggestion"];
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
    source: { type: String, enum: CLAIM_SOURCES },
    message: String,
    evidenceEmail: String,
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
