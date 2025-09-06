import mongoose, { Schema, Model } from 'mongoose';
import { IEventCertificate } from './EventCertificateModel';
import { ObjectId } from 'mongodb';

// Interface para o documento do usuário
export interface ICertificate {
    _id: ObjectId;
    ownerName: string;
    ownerCpf: string | null;
    eventName: string;
    ownerEmail: string | null;
    certificateHours: string;
    certificatePath?: string;
    frontTopperText?: string;
    frontBottomText?: string;
    eventId: ObjectId;
    isReady?: boolean;
    verse: {
        showVerse: boolean;
        topperText?: string;
        bottomText?: string;
        headers?: string[];
        rows?: [string[]];
    };
}
export interface ICertificateWithEventPopulate extends Omit<ICertificate, 'eventId'> {
    eventId: IEventCertificate;
}

// Definição do schema do usuário
const CertificateSchema: Schema<ICertificate> = new Schema(
    {
        ownerName: { type: String, required: true },
        ownerCpf: { type: String, required: true },
        eventName: { type: String, required: true },
        ownerEmail: { type: String, required: true },
        frontTopperText: { type: String },
        frontBottomText: { type: String },
        certificateHours: { type: String, required: true },
        certificatePath: { type: String, required: false },
        isReady: { type: Boolean, required: false, default: false },
        eventId: { type: Schema.Types.ObjectId, required: true, ref: "EventCertificate" },
        verse: {
            showVerse: { type: Boolean, default: false },
            topperText: { type: String, required: false },
            bottomText: { type: String, required: false },
            headers: { type: [String], required: false },
            rows: { type: [[String]], required: false }
        }

    },
    { timestamps: true, collection: "certificates.datails" }
);

// Criação do modelo com Mongoose
const CertificateModel: Model<ICertificate> = mongoose.models.Certificate || mongoose.model<ICertificate>('Certificate', CertificateSchema);

export default CertificateModel;