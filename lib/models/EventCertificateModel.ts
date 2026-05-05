import mongoose, { Schema, Model } from 'mongoose';
import { ObjectId } from 'bson';
import React from 'react';

// Definição das opções de pagamento (TypeScript)
type PaymentOptions =
    | { isPaid: false; price?: never }
    | { isPaid: true; price: number };

export type EventStatusConfig =
    | {
        status: 'DRAFT';
        timeLine?: TimelineItem[];
        registrationStartDate?: Date;
        registrationEndDate?: Date;
    }
    | {
        status: 'PUBLISHED_OPEN';
        timeLine: TimelineItem[];
        // Se está aberto ao público, TEM que ter data de início e fim definidas
        registrationStartDate: Date;
        registrationEndDate: Date;
    }
    | {
        status: 'PUBLISHED_CLOSED';
        timeLine: TimelineItem[];
        // Opcionais aqui, pois pode ser um evento que nem data de abertura tem ainda
        registrationStartDate?: Date;
        registrationEndDate?: Date;
    }
    | {
        status: 'CERTIFICATE_ONLY';
        timeLine: TimelineItem[];
        registrationStartDate?: Date;
        registrationEndDate?: Date;
    };

export type TimelineItem = {
    id: ObjectId;
    startDate: Date;
    endDate: Date;
    description: string;
};

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
    useStatementFormat: boolean;
    statusDetails: EventStatusConfig;
} & PaymentOptions;

// Definição do schema do Mongoose
const TimelineItemSchema = new Schema(
    {
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        description: { type: String, required: true },
    },
    { _id: false } // Opcional: evita gerar um ObjectId inútil para cada passo da timeline
);

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

        eventType: { type: String, required: true },
        registrationCount: { type: Number, required: true, default: 0 },
        documentVersion: { type: String, required: false, default: "2.0" },
        maxParticipants: { type: Number, required: true },

        // Regras de Pagamento
        isPaid: { type: Boolean, required: true },
        price: {
            type: Number,
            required: function (this: any) {
                return this.isPaid === true;
            }
        },
        useStatementFormat: { type: Boolean, default: false },

        // --- Lógica de Status e Timeline Aninhada em statusDetails ---
        statusDetails: {
            status: {
                type: String,
                enum: ['DRAFT', 'PUBLISHED_OPEN', 'PUBLISHED_CLOSED', 'CERTIFICATE_ONLY'],
                required: true,
            },
            registrationStartDate: {
                type: Date,
                required: function (this: any) {
                    // Obrigatório se o admin disser que está aberto
                    return this.statusDetails?.status === 'PUBLISHED_OPEN';
                }
            },
            registrationEndDate: {
                type: Date,
                required: function (this: any) {
                    return this.statusDetails?.status === 'PUBLISHED_OPEN';
                },
                validate: {
                    validator: function (this: any, val: Date) {
                        if (this.statusDetails?.status === 'PUBLISHED_OPEN' && this.statusDetails?.registrationStartDate) {
                            return val > this.statusDetails.registrationStartDate;
                        }
                        return true;
                    },
                    message: 'A data de fim das inscrições deve ser posterior à data de início.',
                }
            },
            timeLine: {
                type: [TimelineItemSchema],
                default: undefined,
                required: function (this: any) {
                    // A timeline é obrigatória para qualquer status que não seja rascunho
                    return this.statusDetails?.status !== 'DRAFT';
                },
                validate: {
                    validator: function (this: any, val: any[]) {
                        // Validação extra: se não for DRAFT, o array não pode estar vazio
                        if (this.statusDetails?.status !== 'DRAFT') {
                            return Array.isArray(val) && val.length > 0;
                        }
                        return true; // Se for DRAFT, passa (pode ser omitido)
                    },
                    message: 'A timeLine deve conter pelo menos um evento se o evento estiver publicado ou emitindo certificados.',
                },
            },
        }
    },
    { timestamps: true, collection: "certificates.events" },
);

// Criação do modelo com Mongoose
const EventCertificateModel: Model<IEventCertificate> =
    mongoose.models.EventCertificate ||
    mongoose.model<IEventCertificate>('EventCertificate', EventCertificateSchema);

export default EventCertificateModel;