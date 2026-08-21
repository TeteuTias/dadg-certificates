import mongoose, { Model, Schema, Types } from "mongoose";

export type PrivacyAcceptanceDocument = {
  _id: Types.ObjectId;
  profileId: Types.ObjectId;
  noticeVersion: string;
  noticeHash: string;
  acceptedAt: Date;
  authIssuer: string;
  authSubject: string;
  source: "profile-web";
};

const PrivacyAcceptanceSchema = new Schema<PrivacyAcceptanceDocument>({
  profileId: { type: Schema.Types.ObjectId, ref: "UserProfile", required: true, immutable: true },
  noticeVersion: { type: String, required: true, immutable: true },
  noticeHash: { type: String, required: true, immutable: true },
  acceptedAt: { type: Date, required: true, immutable: true },
  authIssuer: { type: String, required: true, immutable: true },
  authSubject: { type: String, required: true, immutable: true },
  source: { type: String, enum: ["profile-web"], required: true, immutable: true },
}, {
  collection: "users.privacyAcceptances",
  versionKey: false,
  autoIndex: false,
});

PrivacyAcceptanceSchema.index(
  { profileId: 1, noticeVersion: 1 },
  { unique: true, name: "privacy_profile_notice_unique" },
);

const PrivacyAcceptanceModel = (mongoose.models.PrivacyAcceptance as Model<PrivacyAcceptanceDocument> | undefined) ||
  mongoose.model<PrivacyAcceptanceDocument>("PrivacyAcceptance", PrivacyAcceptanceSchema);

export default PrivacyAcceptanceModel;
