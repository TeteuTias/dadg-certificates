import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'bson';
import EventParticipant from '@/lib/models/EventParticipant';
import GateKeeper from '@/lib/security/gatekeeper';
import { connectToDatabase } from '@/lib/mongodb';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * @description Valida um QR Code de ingresso. Recebe o token via query param e retorna os dados do participante.
 * GET /api/v1/events/[id]/checkin/scan?token=UUID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json({ success: false, error: 'Token QR Code é obrigatório.' }, { status: 400 });
        }

        await connectToDatabase();

        const participant = await EventParticipant.findOne({
            eventId: new ObjectId(id),
            qrToken: token,
        })
            .select('ownerName ownerEmail ownerCpf checkedIn checkedInAt checkedOut checkedOutAt _id')
            .lean() as any;

        if (!participant) {
            return NextResponse.json({
                success: false,
                valid: false,
                error: 'QR Code inválido ou não pertence a este evento.',
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            valid: true,
            data: {
                participantId: String(participant._id),
                ownerName: participant.ownerName,
                ownerEmail: participant.ownerEmail,
                alreadyCheckedIn: participant.checkedIn,
                checkedInAt: participant.checkedInAt,
                alreadyCheckedOut: participant.checkedOut,
                checkedOutAt: participant.checkedOutAt,
            }
        }, { status: 200 });

    } catch (error: any) {
        console.error('[CHECKIN_SCAN_GET]', error);
        return NextResponse.json({ success: false, error: 'Erro interno ao validar QR Code.' }, { status: 500 });
    }
}
