import { withRouteAccess } from "@/lib/security/route-access";
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'bson';
import EventParticipant from '@/lib/models/EventParticipant';
import EventCertificateModel from '@/lib/models/EventCertificateModel';
import UserProfileModel from '@/lib/models/UserProfileModel';
import GateKeeper from '@/lib/security/gatekeeper';
import { connectToDatabase } from '@/lib/mongodb';
import {
    AttendanceTokenConfigurationError,
    isPersonalAttendanceToken,
    verifyAttendanceToken,
} from '@/lib/events/attendance-token';
import { participantOwnerFilter } from '@/lib/events/ownership';
import { eventStages, resolveStage, stagePresence } from '@/lib/events/attendance';
import { EventError } from '@/lib/events/rules';

interface RouteParams {
    params: Promise<{ id: string }>;
}

const headers = { 'Cache-Control': 'private, no-store' };
const INVALID_CODE = 'QR Code inválido ou não pertence a este evento.';
const BLOCKED_STATUS: Record<string, { code: string; error: string }> = {
    PENDING: { code: 'REGISTRATION_PENDING', error: 'Inscrição aguardando confirmação do pagamento.' },
    REVIEW: { code: 'REGISTRATION_REVIEW', error: 'Inscrição em revisão pela organização.' },
    CANCELLED: { code: 'REGISTRATION_CANCELLED', error: 'Inscrição cancelada.' },
};

function invalid(error = INVALID_CODE, code = 'INVALID_CODE', extra: Record<string, unknown> = {}, status = 404) {
    return NextResponse.json({ success: false, valid: false, error, code, ...extra }, { status, headers });
}

/**
 * @description Valida o QR Code lido na entrada ou na saída e devolve a inscrição do aluno neste evento.
 * Aceita o QR pessoal do aluno (assinado pelo servidor) e, durante a transição, o código antigo por inscrição.
 * O código vem no corpo para não ficar registrado em URLs.
 * POST /api/v1/events/[id]/checkin/scan  Body: { token, stageId? }
 * A presença devolvida é a da etapa informada (obrigatória em eventos com várias etapas).
 */
async function POSTHandler(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;

        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, error: 'ID de evento inválido' }, { status: 400, headers });
        }

        const keeper = new GateKeeper(request);
        const user = await keeper.identifySession();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Usuário não autenticado' }, { status: 401, headers });
        }

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const token = typeof body.token === 'string' ? body.token.trim() : '';
        if (!token || token.length > 200) {
            return NextResponse.json({ success: false, error: 'QR Code é obrigatório.' }, { status: 400, headers });
        }

        const eventId = new ObjectId(id);
        const fields = 'ownerName ownerEmail status checkedIn checkedInAt checkedOut checkedOutAt attendance _id';
        let participant;

        if (isPersonalAttendanceToken(token)) {
            const profileId = verifyAttendanceToken(token);
            if (!profileId) return invalid();

            await connectToDatabase();
            const profile = await UserProfileModel.findById(profileId).select('name authSubject').lean();
            if (!profile) return invalid();

            participant = await EventParticipant.findOne({ eventId, ...participantOwnerFilter(profile) })
                .select(fields)
                .lean();
            if (!participant) {
                return invalid(
                    `${profile.name} não tem inscrição neste evento.`,
                    'NOT_REGISTERED',
                    { ownerName: profile.name },
                );
            }
        } else {
            await connectToDatabase();
            participant = await EventParticipant.findOne({ eventId, qrToken: token }).select(fields).lean();
            if (!participant) return invalid();
        }

        const blocked = participant.status ? BLOCKED_STATUS[participant.status] : undefined;
        if (blocked) {
            return invalid(blocked.error, blocked.code, { ownerName: participant.ownerName }, 409);
        }

        const event = await EventCertificateModel.findById(id).select('statusDetails').lean();
        const stages = event ? eventStages(event) : null;
        const requestedStageId = typeof body.stageId === 'string' && body.stageId ? body.stageId : null;
        const stage = stages ? resolveStage(stages, requestedStageId) : null;
        const presence = stage
            ? stagePresence(participant, stage.id)
            : {
                checkedIn: participant.checkedIn === true,
                checkedInAt: participant.checkedInAt || null,
                checkedOut: participant.checkedOut === true,
                checkedOutAt: participant.checkedOutAt || null,
            };

        return NextResponse.json({
            success: true,
            valid: true,
            data: {
                participantId: String(participant._id),
                ownerName: participant.ownerName,
                ownerEmail: participant.ownerEmail,
                stageId: stage ? stage.id : null,
                alreadyCheckedIn: presence.checkedIn,
                checkedInAt: presence.checkedInAt,
                alreadyCheckedOut: presence.checkedOut,
                checkedOutAt: presence.checkedOutAt,
            }
        }, { status: 200, headers });

    } catch (error) {
        if (error instanceof AttendanceTokenConfigurationError) {
            return NextResponse.json(
                { success: false, error: 'Leitura de QR Code pessoal indisponível: configuração pendente.', code: 'ATTENDANCE_QR_NOT_CONFIGURED' },
                { status: 503, headers },
            );
        }
        if (error instanceof EventError) {
            return NextResponse.json({ success: false, valid: false, error: error.message, code: error.code }, { status: error.status, headers });
        }
        console.error('[CHECKIN_SCAN_POST]', error instanceof Error ? error.name : 'UnknownError');
        return NextResponse.json({ success: false, error: 'Erro interno ao validar QR Code.' }, { status: 500, headers });
    }
}

export const POST = withRouteAccess(POSTHandler);
