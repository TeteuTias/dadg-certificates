import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from "bson";

export interface IEventParticipant {
    _id: ObjectId;
    eventId: ObjectId;
    owner: ObjectId;
    ownerName: string;
    createdAt?: Date;
    updatedAt?: Date;
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
            //ref: 'User',  Por enquanto não temos
            required: true,
        },
        ownerName: {
            type: String,
            required: true,
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