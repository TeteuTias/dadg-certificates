import mongoose, { Schema, Model } from 'mongoose';
import { ObjectId } from 'mongodb';
import React from 'react';

// Definição das opções de pagamento (TypeScript)
type PaymentOptions =
    | { isPaid: false; price?: never }
    | { isPaid: true; price: number };

// Tipo principal do documento do usuário
export type IEventCertificate = {
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
    registrationCount: number;
    templatePath: string;
    templateVersePath?: string;

    // Informações Gerais e Regras
    eventType: string;
    documentVersion: string;
    maxParticipants: number;
    isOpen: boolean;
    useStatementFormat: boolean;
} & PaymentOptions;

// Definição do schema do Mongoose
const EventCertificateSchema = new Schema<IEventCertificate>(
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

        // --- Novos Campos Adicionados ---
        eventType: { type: String, required: true },
        registrationCount: { type: Number, required: true, default: 0 },
        documentVersion: { type: String, required: false, default: "2.0" }, // Mantido como String (ex: "1.0", "v2"), mude para Number se preferir
        maxParticipants: { type: Number, required: true },
        isOpen: { type: Boolean, required: true, default: true },
        isPaid: { type: Boolean, required: true },
        price: {
            type: Number,
            // O Mongoose executará esta função para decidir se o campo é obrigatório no banco de dados
            required: function (this: any) {
                return this.isPaid === true;
            }
        },
        useStatementFormat: { type: Boolean, default: false },
    },
    { timestamps: true, collection: "certificates.events" },
);

// Criação do modelo com Mongoose
const EventCertificateModel: Model<IEventCertificate> =
    mongoose.models.EventCertificate ||
    mongoose.model<IEventCertificate>('EventCertificate', EventCertificateSchema);

export default EventCertificateModel;