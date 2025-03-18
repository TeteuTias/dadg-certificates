import mongoose, { Schema, Model } from 'mongoose';
import { ObjectId } from 'mongodb';

// Interface para o documento do usuário
export interface IEventCertificate {
    _id: ObjectId;
    eventName: string;
    eventDescription: string;
    styleContainer: React.CSSProperties;
    styleFrontTopperText: React.CSSProperties;
    styleFrontBottomText: React.CSSProperties;
    styleNameText: React.CSSProperties;
    templatePath: string;
}

// Definição do schema do usuário
const EventCertificateSchema: Schema<IEventCertificate> = new Schema(
    {
        eventName: { type: String, required: true },
        eventDescription: { type: String, required: true },
        styleContainer: { type: Object, required: true },
        styleFrontTopperText: { type: Object, required: true },
        styleFrontBottomText: { type: Object, required: true },
        styleNameText: { type: Object, required: true },
        templatePath: { type: String, required: true },
    },
    { timestamps: true, collection: "certificates.events" }
);

// Criação do modelo com Mongoose
const EventCertificateModel: Model<IEventCertificate> = mongoose.models.EventCertificate || mongoose.model<IEventCertificate>('EventCertificate', EventCertificateSchema);

export default EventCertificateModel;