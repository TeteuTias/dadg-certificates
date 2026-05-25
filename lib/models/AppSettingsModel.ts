import mongoose, { Document, Schema } from "mongoose";

export interface IAppSettings extends Document {
  blogEnabled: boolean;
}

const AppSettingsSchema = new Schema(
  {
    blogEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const AppSettingsModel =
  mongoose.models.AppSettings ||
  mongoose.model<IAppSettings>("AppSettings", AppSettingsSchema);

export default AppSettingsModel;
