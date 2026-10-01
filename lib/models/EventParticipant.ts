import mongoose, { Schema } from 'mongoose';
import { ObjectId } from "bson";
import { IEventCertificate } from './EventCertificateModel';

export interface IEventParticipant {
    _id: ObjectId;
    eventId: ObjectId;
    owner?: ObjectId;
    profileId?: ObjectId;
    status?: "PENDING" | "CONFIRMED" | "CANCELLED" | "REVIEW";
    activePaymentId?: ObjectId;
    cancelledAt?: Date;
    cancellationReason?: string;
    cpfEncrypted?: import("@/lib/profile/crypto").EncryptedCpf;
    cpfLookup?: string;
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
        profileId: { type: Schema.Types.ObjectId, ref: "UserProfile" },
        status: { type: String, enum: ["PENDING", "CONFIRMED", "CANCELLED", "REVIEW"] },
        activePaymentId: Schema.Types.ObjectId,
        cancelledAt: Date, cancellationReason: String,
        cpfEncrypted: Schema.Types.Mixed, cpfLookup: String,
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

EventParticipantSchema.index({eventId:1,profileId:1},{unique:true,partialFilterExpression:{profileId:{$type:"objectId"}},name:"event_profile_unique"});
export const EventParticipant =
    (mongoose.models.EventParticipant as mongoose.Model<IEventParticipant> | undefined) ||
    mongoose.model<IEventParticipant>('EventParticipant', EventParticipantSchema);

export default EventParticipant;
