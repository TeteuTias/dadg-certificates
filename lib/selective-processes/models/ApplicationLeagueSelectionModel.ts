import mongoose, { InferSchemaType, Schema } from 'mongoose';

type ApplicationLeagueSelectionSchemaType = InferSchemaType<{
  applicationId: mongoose.Types.ObjectId;
  selectionProcessId: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  lockedAt: Date;
}>;

export interface IApplicationLeagueSelection {
  applicationId: mongoose.Types.ObjectId;
  selectionProcessId: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  lockedAt: Date;
}

const ApplicationLeagueSelectionSchema: Schema<IApplicationLeagueSelection> = new mongoose.Schema(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Application',
    },
    selectionProcessId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'SelectionProcess',
    },
    examId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Exam',
    },
    lockedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

ApplicationLeagueSelectionSchema.index({ applicationId: 1, examId: 1 }, { unique: true });

export const ApplicationLeagueSelection =
  (mongoose.models.ApplicationLeagueSelection as mongoose.Model<ApplicationLeagueSelectionSchemaType>) ||
  mongoose.model<ApplicationLeagueSelectionSchemaType>(
    'ApplicationLeagueSelection',
    ApplicationLeagueSelectionSchema
  );
