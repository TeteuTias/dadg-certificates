import mongoose, { Model, Schema, Types } from "mongoose";
import type { EncryptedCpf } from "@/lib/profile/crypto";

export type UserProfileDocument = {
  _id: Types.ObjectId;
  authIssuer: string;
  authSubject: string;
  name: string;
  period: number;
  cpfEncrypted: EncryptedCpf;
  cpfLookup: string;
  createdAt: Date;
  updatedAt: Date;
};

const UserProfileSchema = new Schema<UserProfileDocument>({
  authIssuer: { type: String, required: true, immutable: true },
  authSubject: { type: String, required: true, immutable: true },
  name: { type: String, required: true },
  period: { type: Number, required: true, min: 1, max: 12 },
  cpfEncrypted: {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    keyVersion: { type: String, required: true },
  },
  cpfLookup: { type: String, required: true },
}, {
  collection: "users.profiles",
  timestamps: true,
  autoIndex: false,
});

UserProfileSchema.index({ authIssuer: 1, authSubject: 1 }, { unique: true, name: "profile_identity_unique" });
UserProfileSchema.index({ cpfLookup: 1 }, { unique: true, name: "profile_cpf_lookup_unique" });

const UserProfileModel = (mongoose.models.UserProfile as Model<UserProfileDocument> | undefined) ||
  mongoose.model<UserProfileDocument>("UserProfile", UserProfileSchema);

export default UserProfileModel;
