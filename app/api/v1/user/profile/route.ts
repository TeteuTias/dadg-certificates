import { ObjectId } from "bson";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import CertificateModel from "@/lib/models/CertificateModel";
import EventParticipant from "@/lib/models/EventParticipant";
import GateKeeper from "@/lib/security/gatekeeper";

export const dynamic = "force-dynamic";

type PopulatedEvent = {
    _id: ObjectId;
    eventName: string;
    eventDescription: string;
    eventType: string;
    certificateReleased?: boolean;
    statusDetails?: {
        status?: "DRAFT" | "PUBLISHED_OPEN" | "PUBLISHED_CLOSED" | "CERTIFICATE_ONLY";
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

export async function GET(request: NextRequest) {
    const keeper = new GateKeeper(request);
    const user = await keeper.identifySession();

    if (!user?.sub) {
        return NextResponse.json({ success: false, error: "Usuário não autenticado" }, { status: 401 });
    }

    const ownerIdValue = user.sub.includes("|") ? user.sub.split("|")[1] : user.sub;
    if (!ObjectId.isValid(ownerIdValue)) {
        return NextResponse.json({ success: false, error: "Identidade do usuário inválida" }, { status: 403 });
    }

    try {
        await connectToDatabase();

        const participants = await EventParticipant.find({ owner: new ObjectId(ownerIdValue) })
            .populate("eventId")
            .sort({ createdAt: -1 })
            .lean() as unknown as ParticipantRecord[];

        const validParticipants = participants.filter(
            (participant): participant is ParticipantRecord & { eventId: PopulatedEvent } => Boolean(participant.eventId?._id),
        );
        const eventIds = validParticipants.map((participant) => participant.eventId._id);
        const linkedCertificateIds = validParticipants
            .map((participant) => participant.certificateId)
            .filter((certificateId): certificateId is ObjectId => Boolean(certificateId));

        const emails = new Set<string>();
        const cpfs = new Set<string>();
        if (typeof user.email === "string" && user.email.trim()) {
            emails.add(user.email.trim().toLowerCase());
        }
        for (const participant of validParticipants) {
            if (participant.ownerEmail) emails.add(participant.ownerEmail.trim().toLowerCase());
            if (participant.ownerCpf) cpfs.add(participant.ownerCpf.replace(/\D/g, ""));
        }

        const identityFilters: Array<Record<string, unknown>> = [];
        if (emails.size) identityFilters.push({ ownerEmail: { $in: [...emails] } });
        if (cpfs.size) identityFilters.push({ ownerCpf: { $in: [...cpfs] } });

        const certificateFilters: Array<Record<string, unknown>> = [];
        if (linkedCertificateIds.length) {
            certificateFilters.push({ _id: { $in: linkedCertificateIds }, isReady: true });
        }
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

        const certificateIds = new Set(certificates.map((certificate) => String(certificate._id)));
        const certificateByEvent = new Map(
            certificates.map((certificate) => [String(certificate.eventId), String(certificate._id)]),
        );

        const data = validParticipants.map((participant) => {
            const event = participant.eventId;
            const status = event.statusDetails?.status || "DRAFT";
            const linkedCertificateId = participant.certificateId && certificateIds.has(String(participant.certificateId))
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
                enrolledAt: participant.createdAt?.toISOString?.() || new Date().toISOString(),
                certificateId: linkedCertificateId || certificateByEvent.get(String(event._id)) || null,
                qrToken: participant.qrToken || null,
                checkedIn: participant.checkedIn === true,
                checkedInAt: participant.checkedInAt?.toISOString?.() || null,
                checkedOut: participant.checkedOut === true,
                checkedOutAt: participant.checkedOutAt?.toISOString?.() || null,
                certificateReleased: event.certificateReleased === true || status === "CERTIFICATE_ONLY",
            };
        });

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("[GET /api/v1/user/profile]", error);
        return NextResponse.json({ success: false, error: "Erro interno ao carregar perfil" }, { status: 500 });
    }
}
