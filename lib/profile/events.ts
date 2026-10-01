import type { IEventCertificate } from "@/lib/models/EventCertificateModel";
import { ObjectId } from "bson";
import type { ProfileIdentity } from "./service";
import { findProfile } from "./service";
import Participant from "@/lib/models/EventParticipant";
import Certificate from "@/lib/models/CertificateModel";
import { EventOrder } from "@/lib/events/PaymentOrder";
import { canSelfCancel } from "@/lib/events/rules";
export async function getProfileEvents(identity: ProfileIdentity) {
  const profile = await findProfile(identity);
  if (!profile) return [];
  const legacy = identity.authSubject.match(/^auth0\|([a-f0-9]{24})$/i)?.[1];
  const filter = legacy
    ? {
        $or: [
          { profileId: profile._id },
          { profileId: { $exists: false }, owner: new ObjectId(legacy) },
        ],
      }
    : { profileId: profile._id };
  const participants = await Participant.find(filter)
    .populate<{ eventId: IEventCertificate }>("eventId")
    .sort({ createdAt: -1 })
    .lean();
  const result = [];
  for (const p of participants) {
    const event = p.eventId;
    if (!event?._id) continue;
    const certificate = p.certificateId
      ? await Certificate.findOne({ _id: p.certificateId, isReady: true })
          .select("_id")
          .lean()
      : null;
    const order = p.activePaymentId
      ? await EventOrder.findById(p.activePaymentId).lean()
      : null;
    result.push({
      participationId: String(p._id),
      eventId: String(event._id),
      eventName: event.eventName,
      eventDescription: event.eventDescription,
      eventType: event.eventType,
      status: event.statusDetails?.status || "DRAFT",
      participationStatus: p.status || "CONFIRMED",
      isOpen:
        p.status !== "CANCELLED" &&
        !event.archivedAt &&
        (event.statusDetails?.timeLine || []).some(
          (t) => new Date(t.endDate) >= new Date(),
        ),
      isPaid: event.isPaid,
      canCancel: canSelfCancel(event, p),
      enrolledAt: p.createdAt?.toISOString() || null,
      certificateId: certificate ? String(certificate._id) : null,
      qrToken: !p.status || p.status === "CONFIRMED" ? p.qrToken : null,
      checkedIn: p.checkedIn === true,
      checkedInAt: p.checkedInAt?.toISOString() || null,
      certificateReleased: event.certificateReleased === true,
      paymentUrl:
        order?.status === "PENDING" && order.expiresAt > new Date()
          ? order.paymentUrl
          : null,
      paymentStatus: order?.status || null,
    });
  }
  return result;
}
