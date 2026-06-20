import mongoose, { Schema, Model } from 'mongoose';
import { ObjectId } from 'bson';

// Interface para o documento do usuário
export interface IEventCertificate {
    _id: ObjectId;
    eventName: string;
    eventDescription: string;
    styleContainer: React.CSSProperties;
    styleContainerVerse: {
        containerStyle?: React.CSSProperties,
        rowsStyle?: React.CSSProperties,
        headerStyle?: React.CSSProperties,
    };
    styleFrontTopperText: React.CSSProperties;
    styleFrontBottomText: React.CSSProperties;
    styleNameText: React.CSSProperties;
    templatePath: string;
    templateVersePath?: string
}

// Definição do schema do usuário
const EventCertificateSchema: Schema<IEventCertificate> = new Schema(
    {
        eventName: { type: String, required: true },
        eventDescription: { type: String, required: true },
        styleContainerVerse: {
            containerStyle: { type: Object, required: false },
            rowsStyle: { type: Object, required: false },
            headerStyle: { type: Object, required: false },
        },
        styleContainer: { type: Object, required: true },
        styleFrontTopperText: { type: Object, required: true },
        styleFrontBottomText: { type: Object, required: true },
        styleNameText: { type: Object, required: true },
        templatePath: { type: String, required: true },
        templateVersePath: { type: String, required: false },
    },
    { timestamps: true, collection: "certificates.events" },
);

// Criação do modelo com Mongoose
const EventCertificateModel: Model<IEventCertificate> = mongoose.models.EventCertificate || mongoose.model<IEventCertificate>('EventCertificate', EventCertificateSchema);

export default EventCertificateModel;