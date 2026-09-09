import mongoose, { Schema } from 'mongoose';

export interface IExam {
  selectionProcessId: mongoose.Types.ObjectId;
  academicLeagueId?: mongoose.Types.ObjectId;
  name: string;
  examStartDate: Date;
  examEndDate: Date;
  acronym?: string;
  seats?: number | null;
  questionCount?: number;
  reportDay?: number | null;
}

const ExamSchema: Schema<IExam> = new mongoose.Schema(
  {
    selectionProcessId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'SelectionProcess',
    },
    academicLeagueId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicLeague',
    },
    name: { type: String, required: true },
    examStartDate: { type: Date, required: true },
    examEndDate: { type: Date, required: true },
    acronym: String,
    seats: { type: Number, default: null, min: 0, validate: (v: number | null) => v === null || Number.isInteger(v) },
    questionCount: { type: Number, default: 15, min: 1, max: 1000, validate: Number.isInteger },
    reportDay: { type: Number, enum: [1, 2, null], default: null },
  },
  { timestamps: true, autoIndex: false, autoCreate: false }
);

ExamSchema.index({ selectionProcessId: 1, acronym: 1 }, { unique: true, partialFilterExpression: { acronym: { $type: 'string' } }, name: 'clam_exam_acronym_unique' });
ExamSchema.index(
  { selectionProcessId: 1, academicLeagueId: 1 },
  {
    unique: true,
    partialFilterExpression: { academicLeagueId: { $type: 'objectId' } },
    name: 'clam_exam_academic_league_unique',
  },
);
export const Exam =
  (mongoose.models.Exam as mongoose.Model<IExam>) ||
  mongoose.model<IExam>('Exam', ExamSchema);
