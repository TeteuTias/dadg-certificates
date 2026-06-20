import mongoose, { Schema, Model } from 'mongoose';
import { IEventCertificate } from './EventCertificateModel';
import { ObjectId } from 'mongoose';

// Interface para o documento do certificado
export interface ICertificate {
    _id: ObjectId;
    ownerId: ObjectId;
    ownerName: string;
    ownerCpf: string;
    eventName: string;
    ownerEmail: string;
    certificatePath?: string;
    frontTopperText?: string;
    frontBottomText?: string;
    isReady?: boolean;
    onlyImage?: boolean;
    verse: {
        showVerse: boolean;
        topperText?: string;
        bottomText?: string;
        headers?: string[];
        rows?: [string[]];
    };
    certificateHours: string;
    eventId: ObjectId;
}

export interface ICertificateWithEventIdPopulate extends Omit<ICertificate, "eventId"> {
    eventId: IEventCertificate
}

// Definição do esquema do certificado
const CertificateSchema: Schema<ICertificate> = new Schema(
    {
        ownerId: { type: Schema.Types.ObjectId, required: true },
        ownerName: { type: String, required: true },
        ownerCpf: { type: String, required: true },
        eventName: { type: String, required: true },
        ownerEmail: { type: String, required: true },
        frontTopperText: { type: String },
        frontBottomText: { type: String },
        certificatePath: { type: Schema.Types.Mixed, required: false },
        certificateHours: { type: String, required: true },
        onlyImage: { type: Boolean, required: false, default: false },
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

// Criação do modelo no Mongoose
const CertificateModel: Model<ICertificate> = mongoose.models.Certificate || mongoose.model<ICertificate>('Certificate', CertificateSchema);

export default CertificateModel;
