import { EventError } from "@/lib/events/rules";
import { EventAudit } from "@/lib/events/Audit";
import mongoose from "mongoose";
import { isValidCpf, validateName } from "@/lib/profile/validation";
import { encryptCpf, cpfLookup } from "@/lib/profile/crypto";
import { withRouteAccess } from "@/lib/security/route-access";
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'bson';
import EventParticipant from '@/lib/models/EventParticipant';
import EventCertificateModel from '@/lib/models/EventCertificateModel';
import GateKeeper from '@/lib/security/gatekeeper';
import { connectToDatabase } from '@/lib/mongodb';
import { randomUUID } from 'crypto';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * @description Adiciona um participante walk-in (sem inscrição prévia) e já marca como presente.
 * POST /api/v1/events/[id]/walkin
 * 
 * Body: { ownerName, ownerEmail, ownerCpf }
 * Usado pelo admin na tela de presença quando alguém não se inscreveu antes mas está presente.
 * Não decrementa vagas nem verifica datas — é um lançamento manual de admin.
 */
async function POSTHandler(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;

        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, error: 'ID de evento inválido' }, { status: 400 });
        }

        const keeper = new GateKeeper(request);
        const user = await keeper.identifySession();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Usuário não autenticado' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const ownerName: string = (body.ownerName || '').trim();
        const ownerEmail: string = (body.ownerEmail || '').trim().toLowerCase();
        const ownerCpf: string = (body.ownerCpf || '').trim().replace(/[^0-9]/g, '');

        if (validateName(ownerName)) return NextResponse.json({ success: false, error: 'Nome é obrigatório.' }, { status: 400 });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) return NextResponse.json({ success: false, error: 'E-mail é obrigatório.' }, { status: 400 });
        if (!isValidCpf(ownerCpf)) {
            return NextResponse.json({ success: false, error: 'CPF inválido — deve ter 11 dígitos.' }, { status: 400 });
        }

        await connectToDatabase();

        const event = await EventCertificateModel.findById(id).lean();
        if (!event || event.archivedAt) {
            return NextResponse.json({ success: false, error: 'Evento não encontrado.' }, { status: 404 });
        }

        if (event.isPaid) return NextResponse.json({error:"Eventos pagos exigem inscrição e pagamento pela conta do participante."},{status:409});
        // Verifica duplicatas por email dentro do mesmo evento
        const qrToken = randomUUID();
        const now = new Date();

        // Walk-in: cria participante E já marca como presente em um único passo
        const session=await mongoose.startSession();let participantId="";
        try{await session.withTransaction(async()=>{
          const existing=await EventParticipant.exists({eventId:id,status:{$ne:"CANCELLED"},$or:[{ownerEmail},{ownerCpf},{cpfLookup:cpfLookup(ownerCpf)}]}).session(session);
          if(existing)throw new Error("Participante já cadastrado.");
          const updated=await EventCertificateModel.updateOne({_id:id,archivedAt:{$exists:false},isPaid:false,$expr:{$lt:[{$ifNull:["$registrationCount",0]},"$maxParticipants"]}},{$inc:{registrationCount:1}},{session});
          if(!updated.modifiedCount)throw new Error("Evento indisponível ou sem vagas.");
          const [p]=await EventParticipant.create([{eventId:id,ownerName,ownerEmail,cpfEncrypted:encryptCpf(ownerCpf),cpfLookup:cpfLookup(ownerCpf),status:"CONFIRMED",qrToken,checkedIn:true,checkedInAt:now}],{session});participantId=String(p._id);
 await EventAudit.create([{eventId:id,participantId:p._id,actor:user.sub,action:"registration.walkin",details:"admin"}],{session});
        });}finally{await session.endSession();}


        return NextResponse.json({
            success: true,
            message: `${ownerName} adicionado e presença confirmada!`,
            data: {
                participantId: participantId,
                ownerName,
                ownerEmail,
                checkedIn: true,
                checkedInAt: now,
            },
        }, { status: 201 });

    } catch (error) {
        console.error('[WALKIN_POST]', error);
        return NextResponse.json({ success: false, error: error instanceof EventError ? error.message : 'Erro interno ao adicionar participante.' }, { status: error instanceof EventError ? error.status : 500 });
    }
}

export const POST = withRouteAccess(POSTHandler);
