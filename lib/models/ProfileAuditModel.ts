import mongoose, { Model, Schema, Types } from "mongoose";

export type ProfileAuditDocument = {
  _id: Types.ObjectId;
  profileId: Types.ObjectId;
  actorIssuer: string;
  actorSubject: string;
  action: "profile.created" | "profile.updated" | "profile.admin_updated";
  changedFields: Array<"name" | "cpf" | "period">;
  createdAt: Date;
};

const ProfileAuditSchema = new Schema<ProfileAuditDocument>({
  profileId: { type: Schema.Types.ObjectId, ref: "UserProfile", required: true, immutable: true },
  actorIssuer: { type: String, required: true, immutable: true },
  actorSubject: { type: String, required: true, immutable: true },
  action: {
    type: String,
    enum: ["profile.created", "profile.updated", "profile.admin_updated"],
    required: true,
    immutable: true,
  },
  changedFields: [{ type: String, enum: ["name", "cpf", "period"], required: true, immutable: true }],
  createdAt: { type: Date, required: true, default: Date.now, immutable: true },
}, {
  collection: "users.profileAudit",
  versionKey: false,
  autoIndex: false,
});

ProfileAuditSchema.index({ profileId: 1, createdAt: -1 }, { name: "profile_audit_timeline" });

const ProfileAuditModel = (mongoose.models.ProfileAudit as Model<ProfileAuditDocument> | undefined) ||
  mongoose.model<ProfileAuditDocument>("ProfileAudit", ProfileAuditSchema);

export default ProfileAuditModel;
