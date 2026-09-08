import mongoose, { Schema } from 'mongoose';

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
  { timestamps: true, autoIndex: false, autoCreate: false }
);

ApplicationLeagueSelectionSchema.index({ applicationId: 1, examId: 1 }, { unique: true });

export const ApplicationLeagueSelection =
  (mongoose.models.ApplicationLeagueSelection as mongoose.Model<IApplicationLeagueSelection>) ||
  mongoose.model<IApplicationLeagueSelection>(
    'ApplicationLeagueSelection',
    ApplicationLeagueSelectionSchema
  );
