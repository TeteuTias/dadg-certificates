import mongoose, { InferSchemaType, Schema } from 'mongoose';

export interface IExam {
  selectionProcessId: mongoose.Types.ObjectId;
  name: string;
  examStartDate: Date;
  examEndDate: Date;
}

type ExamSchemaType = InferSchemaType<{
  selectionProcessId: mongoose.Types.ObjectId;
  name: string;
  examStartDate: Date;
  examEndDate: Date;
}>;

const ExamSchema: Schema<IExam> = new mongoose.Schema(
  {
    selectionProcessId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'SelectionProcess',
    },
    name: { type: String, required: true },
    examStartDate: { type: Date, required: true },
    examEndDate: { type: Date, required: true },
  },
  { timestamps: true }
);

export const Exam =
  (mongoose.models.Exam as mongoose.Model<ExamSchemaType>) ||
  mongoose.model<ExamSchemaType>('Exam', ExamSchema);
