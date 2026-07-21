import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "bson";
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
    statusDetails?: {
        status?: "DRAFT" | "PUBLISHED_OPEN" | "PUBLISHED_CLOSED" | "CERTIFICATE_ONLY";
        registrationStartDate?: Date;
        registrationEndDate?: Date;
    };
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
            .lean();

        const eventIds = participants
            .map((participant) => participant.eventId as unknown as PopulatedEvent)
            .filter((event): event is PopulatedEvent => Boolean(event?._id))
            .map((event) => event._id);
        const emails = new Set<string>();
        const cpfs = new Set<string>();

        if (user.email) emails.add(user.email.trim().toLowerCase());
        for (const participant of participants) {
            if (participant.ownerEmail) emails.add(participant.ownerEmail.trim().toLowerCase());
            if (participant.ownerCpf) cpfs.add(participant.ownerCpf.replace(/\D/g, ""));
        }

        const identityFilters: Array<Record<string, unknown>> = [];
        if (emails.size) identityFilters.push({ ownerEmail: { $in: [...emails] } });
        if (cpfs.size) identityFilters.push({ ownerCpf: { $in: [...cpfs] } });

        const certificates = eventIds.length && identityFilters.length
            ? await CertificateModel.find({
                eventId: { $in: eventIds },
                isReady: true,
                $or: identityFilters,
            }).select({ _id: 1, eventId: 1 }).lean()
            : [];

        const certificateByEvent = new Map(
            certificates.map((certificate) => [String(certificate.eventId), String(certificate._id)]),
        );

        const data = participants.flatMap((participant) => {
            const event = participant.eventId as unknown as PopulatedEvent;
            if (!event?._id) return [];

            const status = event.statusDetails?.status || "DRAFT";
            return [{
                participationId: String(participant._id),
                eventId: String(event._id),
                eventName: event.eventName,
                eventDescription: event.eventDescription,
                eventType: event.eventType,
                status,
                isOpen: isRegistrationOpen(event),
                enrolledAt: participant.createdAt?.toISOString?.() || new Date().toISOString(),
                certificateId: certificateByEvent.get(String(event._id)) || null,
                qrToken: participant.qrToken || null,
                checkedIn: participant.checkedIn === true,
                checkedInAt: participant.checkedInAt?.toISOString?.() || null,
                certificateReleased: status === "CERTIFICATE_ONLY",
            }];
        });

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("[GET /api/v1/user/profile]", error);
        return NextResponse.json({ success: false, error: "Erro interno ao carregar perfil" }, { status: 500 });
    }
}
