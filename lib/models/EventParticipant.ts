import mongoose, { Schema } from 'mongoose';
import { ObjectId } from "bson";
import { IEventCertificate } from './EventCertificateModel';

export interface IEventParticipant {
    _id: ObjectId;
    eventId: ObjectId;
    owner: ObjectId;
    ownerName: string;
    /** E-mail do participante — necessário para emissão automática do certificado */
    ownerEmail: string;
    /** CPF do participante — necessário para emissão automática do certificado */
    ownerCpf: string;
    /** Token único (UUID v4) usado para gerar o QR Code do ingresso */
    qrToken: string;
    /** Indica se o participante teve sua presença confirmada no evento */
    checkedIn: boolean;
    /** Momento em que a presença foi confirmada */
    checkedInAt?: Date;
    /** Indica se o participante fez o check-out (saída) do evento */
    checkedOut?: boolean;
    /** Momento em que a saída foi confirmada */
    checkedOutAt?: Date;
    /** Referência ao certificado gerado após a liberação automática */
    certificateId?: ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IEventParticipantWithEventPopulate extends Omit<IEventParticipant, 'eventId'> {
    eventId: IEventCertificate;
}

const EventParticipantSchema = new Schema<IEventParticipant>(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'EventCertificate',
            required: true,
        },
        owner: {
            type: Schema.Types.ObjectId,
            required: true,
        },
        ownerName: {
            type: String,
            required: true,
        },
        ownerEmail: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        ownerCpf: {
            type: String,
            required: true,
            trim: true,
        },
        qrToken: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        checkedIn: {
            type: Boolean,
            required: true,
            default: false,
        },
        checkedInAt: {
            type: Date,
            required: false,
        },
        checkedOut: {
            type: Boolean,
            required: false,
            default: false,
        },
        checkedOutAt: {
            type: Date,
            required: false,
        },
        certificateId: {
            type: Schema.Types.ObjectId,
            ref: 'Certificate',
            required: false,
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
        collection: 'certificates.participants',
    }
);

export const EventParticipant =
    mongoose.models.EventParticipant ||
    mongoose.model<IEventParticipant>('EventParticipant', EventParticipantSchema);

export default EventParticipant;