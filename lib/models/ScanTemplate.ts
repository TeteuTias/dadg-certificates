import { ObjectId } from "bson";
import mongoose, { Schema, Model } from "mongoose";

interface ScanTemplate {
    id: ObjectId;
    templateExtension: string;
    createdAt: Date;
    updatedAt: Date;
}


const ScanTemplateSchema: Schema<ScanTemplate> = new Schema(
    {
        templateExtension: { type: String, required: true },
    },
    { timestamps: true, collection: "certificates.scanTemplates" },
);

// Criação do modelo com Mongoose
const ScanTemplateModel: Model<ScanTemplate> = mongoose.models.ScanTemplate || mongoose.model<ScanTemplate>('ScanTemplate', ScanTemplateSchema);

export default ScanTemplateModel;