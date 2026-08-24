import mongoose, { InferSchemaType, Schema } from 'mongoose';

export type ApplicationFinalStatus =
  | 'APPROVED'
  | 'WAITLIST'
  | 'REJECTED'
  | 'PENDING_RESULTS';

export interface IScoreSubdoc {
  examId: mongoose.Types.ObjectId;
  scoreValue: number;
  graderUserId?: mongoose.Types.ObjectId;
  updatedAt?: Date;
}

type ApplicationSchemaType = InferSchemaType<{
  selectionProcessId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  exams: mongoose.Types.ObjectId[];
  finalStatus: ApplicationFinalStatus;
  scores: Array<{
    examId: mongoose.Types.ObjectId;
    scoreValue: number;
    graderUserId?: mongoose.Types.ObjectId;
    updatedAt?: Date;
  }>;
}>;

export interface IApplication {
  selectionProcessId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  exams: mongoose.Types.ObjectId[];
  finalStatus: ApplicationFinalStatus;
  scores: IScoreSubdoc[];
}

const ScoreSubdocSchema: Schema<IScoreSubdoc> = new mongoose.Schema(
  {
    examId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Exam',
    },
    scoreValue: { type: Number, required: true },
    graderUserId: { type: Schema.Types.ObjectId, required: false },
    updatedAt: { type: Date, required: false },
  },
  { _id: false }
);

const ApplicationSchema: Schema<IApplication> = new mongoose.Schema(
  {
    selectionProcessId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'SelectionProcess',
    },
    userId: { type: Schema.Types.ObjectId, required: true },
    exams: [{ type: Schema.Types.ObjectId, required: true, ref: 'Exam' }],
    finalStatus: {
      type: String,
      required: true,
      enum: ['APPROVED', 'WAITLIST', 'REJECTED', 'PENDING_RESULTS'],
      default: 'PENDING_RESULTS',
    },
    scores: { type: [ScoreSubdocSchema], required: true, default: [] },
  },
  { timestamps: true }
);

export const Application =
  (mongoose.models.Application as mongoose.Model<ApplicationSchemaType>) ||
  mongoose.model<ApplicationSchemaType>('Application', ApplicationSchema);
