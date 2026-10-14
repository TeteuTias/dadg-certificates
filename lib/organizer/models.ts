import mongoose, { Schema } from "mongoose";
import { ORGANIZER_TYPES } from "./rules";

const types = Object.keys(ORGANIZER_TYPES);

/** Certificado de fora do DADG enviado pelo aluno. Fica fora do acervo e da consulta pública. */
const externalCertificateSchema = new Schema(
  {
    profileId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    type: { type: String, enum: types, required: true },
    institution: { type: String, default: "" },
    date: { type: String, default: "" },
    hours: { type: Number, required: true, min: 0 },
    fileKey: { type: String, required: true },
    fileSize: { type: Number, required: true },
  },
  {
    collection: "users.externalCertificates",
    timestamps: true,
    autoIndex: false,
    autoCreate: false,
  },
);

/** Anotação pessoal do aluno sobre um certificado do DADG. Nunca altera o certificado oficial. */
const certificateNoteSchema = new Schema(
  {
    _id: String, // `${profileId}:${certificateId}`
    profileId: { type: Schema.Types.ObjectId, required: true },
    certificateId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: types },
    hours: { type: Number, min: 0 },
  },
  {
    collection: "users.certificateNotes",
    timestamps: true,
    autoIndex: false,
    autoCreate: false,
  },
);

export const ExternalCertificate =
  (mongoose.models.ExternalCertificate as
    mongoose.Model<mongoose.InferSchemaType<typeof externalCertificateSchema>> | undefined) ||
  mongoose.model("ExternalCertificate", externalCertificateSchema);

export const CertificateNote =
  (mongoose.models.CertificateNote as
    mongoose.Model<mongoose.InferSchemaType<typeof certificateNoteSchema>> | undefined) ||
  mongoose.model("CertificateNote", certificateNoteSchema);
