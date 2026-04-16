import mongoose, { Schema, Model, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface IAuthor extends Document {
  name: string;
  email: string;
  institution: string;
  is_advisor: boolean;
}

export interface IParticipant extends Document {
  name: string;
  email: string;
  role: string;
  is_advisor: boolean;
}

export interface IProjectConfig extends Document {
  max_authors: number;
  max_participants: number;
  max_advisors: number;
}

export interface IArticleProject extends Document {
  _id: ObjectId;
  Modalidade: string;
  Nome_do_projeto: string;
  project_config: IProjectConfig;
  authors: IAuthor[];
  participants: IParticipant[];
  created_at: Date;
  event_id: ObjectId; // Referência ao evento ao qual o trabalho está sendo submetido
  file_url?: string; // URL do arquivo submetido no R2 (opcional, para compatibilidade)
  file_id?: string; // ID do arquivo no GridFS (opcional)
  file_name?: string; // Nome original do arquivo (opcional)
  file_size?: number; // Tamanho do arquivo em bytes (opcional)
  file_type?: string; // Tipo MIME do arquivo (opcional)
}

const AuthorSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  institution: { type: String, required: true },
  is_advisor: { type: Boolean, required: true, default: false },
});

const ParticipantSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, required: true },
  is_advisor: { type: Boolean, required: true, default: false },
});

const ProjectConfigSchema: Schema = new Schema({
  max_authors: { type: Number, required: true, default: 1 },
  max_participants: { type: Number, required: true, default: 4 },
  max_advisors: { type: Number, required: true, default: 1 },
});

const ArticleProjectSchema: Schema = new Schema(
  {
    Modalidade: { type: String, required: true },
    Nome_do_projeto: { type: String, required: true },
    project_config: { type: ProjectConfigSchema, required: true },
    authors: { type: [AuthorSchema], required: true },
    participants: { type: [ParticipantSchema], required: true },
    event_id: { type: Schema.Types.ObjectId, ref: 'EventCertificate', required: true },
    file_url: { type: String, required: false }, // URL do arquivo no R2 (compatibilidade com API atual)
    file_id: { type: String, required: false }, // ID do arquivo no GridFS
    file_name: { type: String, required: false }, // Nome original do arquivo
    file_size: { type: Number, required: false }, // Tamanho do arquivo em bytes
    file_type: { type: String, required: false }, // Tipo MIME do arquivo
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, collection: 'article.projects' }
);

// Índices para melhorar performance de busca
ArticleProjectSchema.index({ event_id: 1 });
ArticleProjectSchema.index({ file_id: 1 });

const ArticleProjectModel: Model<IArticleProject> =
  mongoose.models.ArticleProject ||
  mongoose.model<IArticleProject>('ArticleProject', ArticleProjectSchema);

export default ArticleProjectModel;
