import mongoose, { Schema, Model } from 'mongoose';
import { ObjectId } from 'mongoose';

// Interface para o documento do usuário
export interface ICertificate {
    _id: ObjectId;
    ownerName: string;
    ownerCpf: string;
    eventName: string;
    ownerEmail: string;
    certificateHours: string;
    certificatePath: string;
    frontTopperText?: string;
    frontBottomText?: string;
    eventId: ObjectId;
}

// Definição do schema do usuário
const CertificateSchema: Schema<ICertificate> = new Schema(
    {
        eventId: { type: Schema.Types.ObjectId },
        ownerName: { type: String, required: true },
        ownerCpf: { type: String, required: true },
        eventName: { type: String, required: true },
        ownerEmail: { type: String, required: true },
        certificateHours: { type: String, required: true },
        certificatePath: { type: String, required: true },

    },
    { timestamps: true, collection: "certificates.datails" }
);

// Criação do modelo com Mongoose
const CertificateModel: Model<ICertificate> = mongoose.models.Certificate || mongoose.model<ICertificate>('Certificate', CertificateSchema);

export default CertificateModel;