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
export async function POST(request: NextRequest, { params }: RouteParams) {
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

        if (!ownerName) return NextResponse.json({ success: false, error: 'Nome é obrigatório.' }, { status: 400 });
        if (!ownerEmail) return NextResponse.json({ success: false, error: 'E-mail é obrigatório.' }, { status: 400 });
        if (!ownerCpf || ownerCpf.length !== 11) {
            return NextResponse.json({ success: false, error: 'CPF inválido — deve ter 11 dígitos.' }, { status: 400 });
        }

        await connectToDatabase();

        const event = await EventCertificateModel.findById(id).lean();
        if (!event) {
            return NextResponse.json({ success: false, error: 'Evento não encontrado.' }, { status: 404 });
        }

        // Verifica duplicatas por email dentro do mesmo evento
        const existing = await EventParticipant.findOne({
            eventId: new ObjectId(id),
            ownerEmail,
        });
        if (existing) {
            return NextResponse.json({
                success: false,
                error: `Este e-mail já está registrado neste evento (${existing.ownerName}).`,
            }, { status: 409 });
        }

        const qrToken = randomUUID();
        const now = new Date();

        // Walk-in: cria participante E já marca como presente em um único passo
        const participant = await EventParticipant.create({
            eventId: new ObjectId(id),
            ownerName,
            ownerEmail,
            ownerCpf,
            qrToken,
            checkedIn: true,
            checkedInAt: now,
        });

        return NextResponse.json({
            success: true,
            message: `${ownerName} adicionado e presença confirmada!`,
            data: {
                participantId: String(participant._id),
                ownerName,
                ownerEmail,
                checkedIn: true,
                checkedInAt: now,
            },
        }, { status: 201 });

    } catch (error: any) {
        console.error('[WALKIN_POST]', error);
        return NextResponse.json({ success: false, error: 'Erro interno ao adicionar participante.' }, { status: 500 });
    }
}
