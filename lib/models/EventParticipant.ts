import mongoose, { Schema } from 'mongoose';
import { ObjectId } from "bson";
import { IEventCertificate } from './EventCertificateModel';

export interface IEventParticipant {
    _id: ObjectId;
    eventId: ObjectId;
    owner?: ObjectId;
    ownerName: string;
    ownerEmail?: string;
    ownerCpf?: string;
    qrToken?: string;
    checkedIn: boolean;
    checkedInAt?: Date | null;
    /** Indica se o participante fez o check-out (saída) do evento */
    checkedOut?: boolean;
    /** Momento em que a saída foi confirmada */
    checkedOutAt?: Date | null;
    /** Referência ao certificado gerado após a liberação automática */
    certificateId?: ObjectId | null;
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
            required: false,
        },
        ownerName: {
            type: String,
            required: true,
        },
        ownerEmail: {
            type: String,
            required: false,
            trim: true,
            lowercase: true,
        },
        ownerCpf: {
            type: String,
            required: false,
            trim: true,
        },
        qrToken: {
            type: String,
            required: false,
            unique: true,
            sparse: true,
        },
        checkedIn: {
            type: Boolean,
            required: true,
            default: false,
        },
        checkedInAt: {
            type: Date,
            required: false,
            default: null,
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
