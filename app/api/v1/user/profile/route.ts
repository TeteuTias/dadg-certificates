import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import GateKeeper from "@/lib/security/gatekeeper";
import EventParticipant from "@/lib/models/EventParticipant";
import CertificateModel from "@/lib/models/CertificateModel";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const keeper = new GateKeeper(req);
    const user = await keeper.identifySession();
    
    if (!user) {
        return NextResponse.json({ message: "Usuário não autenticado." }, { status: 401 });
    }

    const userId = user.sub.replace("auth0|", "");
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return NextResponse.json({ message: "ID de usuário inválido." }, { status: 403 });
    }

    const userEmail = req.headers.get("X-User-Email");
    if (!userEmail) {
        return NextResponse.json({ message: "Email do usuário não fornecido." }, { status: 400 });
    }

    await connectToDatabase();

    try {
        // Obter todas as participações do usuário com o evento populado
        const participations = await EventParticipant.find({ 
            owner: new mongoose.Types.ObjectId(userId) 
        }).populate("eventId").lean();

        // Obter todos os certificados vinculados ao e-mail do usuário
        const certificates = await CertificateModel.find({ 
            ownerEmail: userEmail 
        }).lean();

        // Mapear para o formato EventHistory do frontend
        const now = new Date();
        const events = participations.map((p: any) => {
            const event = p.eventId;
            
            // Encontrar o certificado correspondente para este evento, se houver
            const cert = certificates.find(c => c.eventId.toString() === event._id.toString());
            
            let isOpen = false;
            if (event.statusDetails?.status === 'PUBLISHED_OPEN') {
                const startDate = new Date(event.statusDetails.registrationStartDate);
                const endDate = new Date(event.statusDetails.registrationEndDate);
                if (now >= startDate && now <= endDate) {
                    isOpen = true;
                }
            }

            return {
                participationId: p._id.toString(),
                eventId: event._id.toString(),
                eventName: event.eventName,
                eventDescription: event.eventDescription,
                eventType: event.eventType,
                status: event.statusDetails?.status || "UNKNOWN",
                isOpen: isOpen,
                enrolledAt: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
                certificateId: cert ? cert._id.toString() : null,
                // Novos campos para ingresso QR e certificado automático
                qrToken: p.qrToken || null,
                checkedIn: p.checkedIn || false,
                checkedInAt: p.checkedInAt ? p.checkedInAt.toISOString() : null,
                certificateReleased: event.certificateReleased || false,
            };
        });

        return NextResponse.json({ data: events }, { status: 200 });


    } catch (error) {
        console.error("Erro ao buscar perfil do usuário:", error);
        return NextResponse.json({ message: "Erro interno no servidor." }, { status: 500 });
    }
}
