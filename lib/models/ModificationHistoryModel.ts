

import mongoose, { Schema, Model } from 'mongoose';
import { ObjectId } from 'mongodb';

// Interface para o documento do usuário
export interface IModificationHistory {
    _id: ObjectId;
    modifiedElementId: ObjectId;
    modifiedUserId: ObjectId;
    modificationDate: Date;
    modifiedDocumentType: "certificate" | "event";
    description: string;
    userName: string;
    httpMethods: "get" | "post" | "patch" | "put" | "delete"
}

const ModificationHistorySchema: Schema = new Schema(
    {
        _id: { type: ObjectId, auto: true }, // Gera automaticamente um ObjectId
        modifiedElementId: { type: ObjectId, required: true }, // ID do elemento alterado
        modifiedUserId: { type: ObjectId, required: true }, // ID do elemento alterado
        modificationDate: { type: Date, required: true }, // ID do elemento alterado
        modifiedDocumentType: {
            type: String,
            enum: ["certificate", "event"],
            required: true
        }, // Tipo do documento alterado
        description: { type: String, required: true }, // Descrição da alteração
        userName: { type: String, required: true },
        httpMethods: {
            type: String,
            enum: ["get", "post", "patch", "put", "delete"],
            required: true
        }, // Tipo do documento alterado
    },
    {
        timestamps: true, // Cria automaticamente os campos createdAt e updatedAt
        collection: "modificationHistory.logs" // Nome da coleção no banco de dados
    }
);


// Criação do modelo com Mongoose
const ModificationHistoryModel: Model<IModificationHistory> = mongoose.models.ModificationHistory || mongoose.model<IModificationHistory>('ModificationHistory', ModificationHistorySchema);

export default ModificationHistoryModel;