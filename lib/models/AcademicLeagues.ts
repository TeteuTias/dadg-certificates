import mongoose, { Schema, Model } from 'mongoose';
import { ObjectId } from 'mongoose';

// Interface para o documento do certificado
export interface IAcademicLeague {
    _id: ObjectId;
    name: string;
    acronym: string;
    area: string;
    advisors: string[];
    highlightText: string;
    about: string;
    geralText: string;
    examples: string[];
    description: string;
    type: "clinic" | "basic"
    logoLink: string
}


// Definição do esquema do certificado
const AcademicLeagueSchema: Schema<IAcademicLeague> = new Schema(
    {
        name: { type: String, required: true },
        acronym: { type: String, required: true },
        area: { type: String, required: true },
        geralText: { type: String, required: true },
        advisors: { type: [String], required: true },
        highlightText: { type: String, required: true },
        about: { type: String, required: true },
        examples: { type: [String], required: true },
        description: { type: String, required: true },
        type: { type: String, enum: ["clinic", "basic"], required: true },
        logoLink: { type: String, required: true }
    },
    { timestamps: true, collection: "clam.data" }
);

// Criação do modelo no Mongoose
const AcademicLeagueModel: Model<IAcademicLeague> = mongoose.models.AcademicLeague || mongoose.model<IAcademicLeague>('AcademicLeague', AcademicLeagueSchema);

export default AcademicLeagueModel;
