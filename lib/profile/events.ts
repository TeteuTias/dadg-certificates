import { ObjectId } from "bson";
import CertificateModel from "@/lib/models/CertificateModel";
import EventParticipant from "@/lib/models/EventParticipant";

type PopulatedEvent = {
  _id: ObjectId;
  eventName: string;
  eventDescription: string;
  eventType: string;
  certificateReleased?: boolean;
  statusDetails?: {
    status?:
      | "DRAFT"
      | "PUBLISHED_OPEN"
      | "PUBLISHED_CLOSED"
      | "CERTIFICATE_ONLY";
    registrationStartDate?: Date;
    registrationEndDate?: Date;
  };
};

type ParticipantRecord = {
  _id: ObjectId;
  eventId: PopulatedEvent | null;
  ownerEmail?: string;
  ownerCpf?: string;
  qrToken?: string;
  checkedIn?: boolean;
  checkedInAt?: Date | null;
  checkedOut?: boolean;
  checkedOutAt?: Date | null;
  certificateId?: ObjectId | null;
  createdAt?: Date;
};

function isRegistrationOpen(event: PopulatedEvent) {
  if (event.statusDetails?.status !== "PUBLISHED_OPEN") return false;
  const now = Date.now();
  const start = event.statusDetails.registrationStartDate
    ? new Date(event.statusDetails.registrationStartDate).getTime()
    : null;
  const end = event.statusDetails.registrationEndDate
    ? new Date(event.statusDetails.registrationEndDate).getTime()
    : null;
  return (!start || now >= start) && (!end || now <= end);
}

export async function getProfileEvents(
  authSubject: string,
  authenticatedEmail?: string,
) {
  const ownerIdValue = authSubject.includes("|")
    ? authSubject.split("|")[1]
    : authSubject;
  if (!ObjectId.isValid(ownerIdValue)) return [];

  const participants = (await EventParticipant.find({
    owner: new ObjectId(ownerIdValue),
  })
    .populate("eventId")
    .sort({ createdAt: -1 })
    .lean()) as unknown as ParticipantRecord[];
  const valid = participants.filter(
    (
      participant,
    ): participant is ParticipantRecord & { eventId: PopulatedEvent } =>
      Boolean(participant.eventId?._id),
  );
  const eventIds = valid.map((participant) => participant.eventId._id);
  const linkedIds = valid
    .map((participant) => participant.certificateId)
    .filter((id): id is ObjectId => Boolean(id));

  // Compatibilidade com snapshots históricos; os dados não são devolvidos ao cliente.
  const emails = new Set<string>();
  const cpfs = new Set<string>();
  if (authenticatedEmail) emails.add(authenticatedEmail.trim().toLowerCase());
  for (const participant of valid) {
    if (participant.ownerEmail)
      emails.add(participant.ownerEmail.trim().toLowerCase());
    if (participant.ownerCpf) cpfs.add(participant.ownerCpf.replace(/\D/g, ""));
  }
  const identityFilters: Array<Record<string, unknown>> = [];
  if (emails.size) identityFilters.push({ ownerEmail: { $in: [...emails] } });
  if (cpfs.size) identityFilters.push({ ownerCpf: { $in: [...cpfs] } });
  const certificateFilters: Array<Record<string, unknown>> = [];
  if (linkedIds.length)
    certificateFilters.push({ _id: { $in: linkedIds }, isReady: true });
  if (eventIds.length && identityFilters.length) {
    certificateFilters.push({
      eventId: { $in: eventIds },
      isReady: true,
      $or: identityFilters,
    });
  }
  const certificates = certificateFilters.length
    ? await CertificateModel.find({ $or: certificateFilters })
        .select({ _id: 1, eventId: 1 })
        .lean()
    : [];
  const certificateIds = new Set(
    certificates.map((certificate) => String(certificate._id)),
  );
  const certificateByEvent = new Map(
    certificates.map((certificate) => [
      String(certificate.eventId),
      String(certificate._id),
    ]),
  );

  return valid.map((participant) => {
    const event = participant.eventId;
    const status = event.statusDetails?.status || "DRAFT";
    const linkedCertificateId =
      participant.certificateId &&
      certificateIds.has(String(participant.certificateId))
        ? String(participant.certificateId)
        : null;
    return {
      participationId: String(participant._id),
      eventId: String(event._id),
      eventName: event.eventName,
      eventDescription: event.eventDescription,
      eventType: event.eventType,
      status,
      isOpen: isRegistrationOpen(event),
      enrolledAt:
        participant.createdAt?.toISOString?.() || new Date().toISOString(),
      certificateId:
        linkedCertificateId ||
        certificateByEvent.get(String(event._id)) ||
        null,
      qrToken: participant.qrToken || null,
      checkedIn: participant.checkedIn === true,
      checkedInAt: participant.checkedInAt?.toISOString?.() || null,
      checkedOut: participant.checkedOut === true,
      checkedOutAt: participant.checkedOutAt?.toISOString?.() || null,
      certificateReleased:
        event.certificateReleased === true || status === "CERTIFICATE_ONLY",
    };
  });
}
