import mongoose, { Schema } from "mongoose";
const schema = new Schema(
  {
    eventId: Schema.Types.ObjectId,
    participantId: Schema.Types.ObjectId,
    actor: String,
    action: String,
    details: String,
  },
  {
    collection: "events.audit",
    timestamps: true,
    autoCreate: false,
    autoIndex: false,
  },
);
export const EventAudit =
  mongoose.models.EventAudit || mongoose.model("EventAudit", schema);
