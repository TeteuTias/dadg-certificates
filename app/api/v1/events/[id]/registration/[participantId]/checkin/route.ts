import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'bson';
import EventParticipant from '@/lib/models/EventParticipant';
import GateKeeper from '@/lib/security/gatekeeper';
import { connectToDatabase } from '@/lib/mongodb';

interface RouteParams {
    params: Promise<{ id: string; participantId: string }>;
}

/**
 * @description Registra check-in, check-out ou remove manualmente a presença de um participante.
 * PATCH /api/v1/events/[id]/registration/[participantId]/checkin
 * Apenas admins autenticados podem chamar este endpoint.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { id, participantId } = await params;

        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, error: 'ID de evento inválido' }, { status: 400 });
        }
        if (!ObjectId.isValid(participantId)) {
            return NextResponse.json({ success: false, error: 'ID de participante inválido' }, { status: 400 });
        }

        const keeper = new GateKeeper(request);
        const user = await keeper.identifySession();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Usuário não autenticado' }, { status: 401 });
        }

        let mode = 'checkin';
        try {
            const body = await request.json();
            if (body && body.mode) {
                mode = body.mode;
            }
        } catch (e) {
            // body is optional, default to checkin
        }
        if (!['checkin', 'checkout', 'reset'].includes(mode)) {
            return NextResponse.json({ success: false, error: 'Ação de presença inválida.' }, { status: 400 });
        }

        await connectToDatabase();

        const participant = await EventParticipant.findOne({
            _id: new ObjectId(participantId),
            eventId: new ObjectId(id),
        });

        if (!participant) {
            return NextResponse.json({ success: false, error: 'Participante não encontrado neste evento.' }, { status: 404 });
        }

        const now = new Date();

        if (mode === 'reset') {
            if (participant.certificateId) {
                return NextResponse.json({
                    success: false,
                    error: 'Não é possível remover a presença porque o certificado já foi emitido.',
                }, { status: 409 });
            }
            if (!participant.checkedIn && !participant.checkedOut) {
                return NextResponse.json({
                    success: false,
                    error: 'Este participante ainda não possui presença registrada.',
                }, { status: 409 });
            }

            participant.checkedIn = false;
            participant.checkedInAt = null;
            participant.checkedOut = false;
            participant.checkedOutAt = null;
            await participant.save();

            return NextResponse.json({
                success: true,
                message: `Presença de ${participant.ownerName} removida com sucesso!`,
                data: {
                    participantId: String(participant._id),
                    ownerName: participant.ownerName,
                    checkedIn: false,
                    checkedInAt: null,
                    checkedOut: false,
                    checkedOutAt: null,
                },
            }, { status: 200 });
        }

        if (mode === 'checkout') {
            if (!participant.checkedIn) {
                return NextResponse.json({
                    success: false,
                    error: 'Participante não realizou check-in ainda, não pode fazer check-out.',
                }, { status: 400 });
            }
            if (participant.checkedOut) {
                return NextResponse.json({
                    success: false,
                    error: 'Este participante já realizou check-out.',
                    data: {
                        participantId: String(participant._id),
                        ownerName: participant.ownerName,
                        checkedOutAt: participant.checkedOutAt,
                    }
                }, { status: 409 });
            }
            participant.checkedOut = true;
            participant.checkedOutAt = now;
            await participant.save();

            return NextResponse.json({
                success: true,
                message: `Check-out de ${participant.ownerName} confirmado com sucesso!`,
                data: {
                    participantId: String(participant._id),
                    ownerName: participant.ownerName,
                    ownerEmail: participant.ownerEmail,
                    checkedOut: true,
                    checkedOutAt: now,
                }
            }, { status: 200 });
        }

        // Default mode: checkin
        if (participant.checkedIn) {
            return NextResponse.json({
                success: false,
                error: 'Este participante já realizou check-in.',
                data: {
                    participantId: String(participant._id),
                    ownerName: participant.ownerName,
                    checkedInAt: participant.checkedInAt,
                }
            }, { status: 409 });
        }

        participant.checkedIn = true;
        participant.checkedInAt = now;
        await participant.save();

        return NextResponse.json({
            success: true,
            message: `Check-in de ${participant.ownerName} confirmado com sucesso!`,
            data: {
                participantId: String(participant._id),
                ownerName: participant.ownerName,
                ownerEmail: participant.ownerEmail,
                checkedIn: true,
                checkedInAt: now,
            }
        }, { status: 200 });

    } catch (error: any) {
        console.error('[CHECKIN_PATCH]', error);
        return NextResponse.json({ success: false, error: 'Erro interno ao registrar check-in.' }, { status: 500 });
    }
}
