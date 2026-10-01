import { withRouteAccess } from "@/lib/security/route-access";
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'bson';
import EventParticipant from '@/lib/models/EventParticipant';
import GateKeeper from '@/lib/security/gatekeeper';
import { connectToDatabase } from '@/lib/mongodb';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * @description Retorna a lista completa de participantes inscritos em um evento, com status de check-in.
 * Usado pela tela de presença no painel admin. Acesso restrito.
 */
async function GETHandler(request: NextRequest, { params }: RouteParams) {
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

        await connectToDatabase();

        const { searchParams } = new URL(request.url);
        const checkedInFilter = searchParams.get('checkedIn');

        const query: Record<string, unknown> = { eventId: new ObjectId(id), status: { $nin: ["PENDING", "CANCELLED", "REVIEW"] } };
        if (checkedInFilter === 'true') query.checkedIn = true;
        if (checkedInFilter === 'false') query.checkedIn = false;

        const participants = await EventParticipant.find(query)
            .select('ownerName ownerEmail ownerCpf checkedIn checkedInAt checkedOut checkedOutAt certificateId qrToken createdAt')
            .sort({ ownerName: 1 })
            .lean();

        const totalCheckedIn = await EventParticipant.countDocuments({ eventId: new ObjectId(id), status: { $nin: ["PENDING", "CANCELLED", "REVIEW"] }, checkedIn: true });
        const totalParticipants = await EventParticipant.countDocuments({ eventId: new ObjectId(id), status: { $nin: ["PENDING", "CANCELLED", "REVIEW"] } });

        return NextResponse.json({
            success: true,
            data: participants,
            meta: {
                total: totalParticipants,
                checkedIn: totalCheckedIn,
                absent: totalParticipants - totalCheckedIn,
            }
        }, { status: 200 });

    } catch (error) {
        console.error('[PARTICIPANTS_GET]', error);
        return NextResponse.json({ success: false, error: 'Erro interno ao buscar participantes.' }, { status: 500 });
    }
}

export const GET = withRouteAccess(GETHandler);
