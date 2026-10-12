import { withRouteAccess } from "@/lib/security/route-access";
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'bson';
import EventParticipant from '@/lib/models/EventParticipant';
import EventCertificateModel from '@/lib/models/EventCertificateModel';
import GateKeeper from '@/lib/security/gatekeeper';
import { connectToDatabase } from '@/lib/mongodb';
import { cpfLookup, decryptCpf } from '@/lib/profile/crypto';
import { formatCpf, isValidCpf, maskCpf, normalizeCpf } from '@/lib/profile/validation';
import { attendanceSummary, eventStages, stagePresence, suggestedStageId } from '@/lib/events/attendance';

interface RouteParams {
    params: Promise<{ id: string }>;
}

const headers = { 'Cache-Control': 'private, no-store' };
const ACTIVE_STATUS = { $nin: ['PENDING', 'CANCELLED', 'REVIEW'] };

type StoredCpf = { cpfEncrypted?: Parameters<typeof decryptCpf>[0]; ownerCpf?: string };

/** O CPF completo nunca sai desta rota: a lista mostra apenas os dois dígitos finais. */
function maskedCpf(participant: StoredCpf): string {
    try {
        return maskCpf(participant.cpfEncrypted ? decryptCpf(participant.cpfEncrypted) : participant.ownerCpf);
    } catch {
        return maskCpf(undefined);
    }
}

/**
 * @description Retorna os participantes confirmados de um evento com a presença na etapa pedida.
 * GET /api/v1/events/[id]/participants?stageId=...
 * Sem `stageId`, usa a etapa em andamento ou a mais próxima. Eventos cujo cronograma ainda
 * não tem identidade de etapa respondem em modo legado (uma entrada e uma saída por evento).
 */
async function GETHandler(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;

        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, error: 'ID de evento inválido' }, { status: 400, headers });
        }

        const keeper = new GateKeeper(request);
        const staff = await keeper.identifyStaff();
        if (!staff) {
            return NextResponse.json({ success: false, error: 'Usuário não autenticado' }, { status: 401, headers });
        }

        await connectToDatabase();

        const { searchParams } = new URL(request.url);
        const checkedInFilter = searchParams.get('checkedIn');
        const requestedStageId = searchParams.get('stageId');

        const event = await EventCertificateModel.findById(id)
            .select('eventName statusDetails minAttendancePercent')
            .lean();
        if (!event) {
            return NextResponse.json({ success: false, error: 'Evento não encontrado.' }, { status: 404, headers });
        }

        const stages = eventStages(event);
        const stageId = stages
            ? (stages.find((stage) => stage.id === requestedStageId)?.id ?? suggestedStageId(stages))
            : null;

        const participants = await EventParticipant.find({ eventId: new ObjectId(id), status: ACTIVE_STATUS })
            .select('ownerName ownerEmail ownerCpf cpfEncrypted checkedIn checkedInAt checkedOut checkedOutAt attendance certificateId createdAt')
            .sort({ ownerName: 1 })
            .lean();

        const all = participants.map((participant) => {
            const presence = stageId
                ? stagePresence(participant, stageId)
                : {
                    checkedIn: participant.checkedIn === true,
                    checkedInAt: participant.checkedInAt || null,
                    checkedOut: participant.checkedOut === true,
                    checkedOutAt: participant.checkedOutAt || null,
                };
            const summary = attendanceSummary(event, participant);
            return {
                _id: String(participant._id),
                ownerName: participant.ownerName,
                ownerEmail: participant.ownerEmail || '',
                cpfMasked: maskedCpf(participant),
                checkedIn: presence.checkedIn,
                checkedInAt: presence.checkedInAt,
                checkedOut: presence.checkedOut,
                checkedOutAt: presence.checkedOutAt,
                attendedStages: summary.attended,
                totalStages: summary.total,
                eligible: summary.eligible,
                certificateId: participant.certificateId ? String(participant.certificateId) : null,
                createdAt: participant.createdAt || null,
            };
        });

        const totalCheckedIn = all.filter((participant) => participant.checkedIn).length;
        const data = checkedInFilter === 'true'
            ? all.filter((participant) => participant.checkedIn)
            : checkedInFilter === 'false'
                ? all.filter((participant) => !participant.checkedIn)
                : all;

        return NextResponse.json({
            success: true,
            data,
            meta: {
                total: all.length,
                checkedIn: totalCheckedIn,
                absent: all.length - totalCheckedIn,
            },
            event: {
                name: event.eventName,
                minAttendancePercent: event.minAttendancePercent ?? 100,
            },
            stages: (stages || []).map((stage) => ({
                id: stage.id,
                description: stage.description,
                startDate: stage.startDate,
                endDate: stage.endDate,
            })),
            stageId,
            legacyMode: !stages,
            // A tela esconde ações exclusivas de administrador; a autorização real é da política de rota.
            viewer: { role: staff.role },
        }, { status: 200, headers });

    } catch (error) {
        console.error('[PARTICIPANTS_GET]', error instanceof Error ? error.name : 'UnknownError');
        return NextResponse.json({ success: false, error: 'Erro interno ao buscar participantes.' }, { status: 500, headers });
    }
}

/**
 * @description Localiza participantes do evento por CPF completo. O CPF vem no corpo
 * (nunca na URL) e a resposta traz somente os identificadores encontrados.
 * POST /api/v1/events/[id]/participants  Body: { cpf }
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
        const cpf = normalizeCpf(body.cpf);
        if (cpf.length !== 11 || !isValidCpf(cpf)) {
            return NextResponse.json({ success: false, error: 'Informe um CPF válido com 11 dígitos.' }, { status: 400, headers });
        }

        await connectToDatabase();

        const matches = await EventParticipant.find({
            eventId: new ObjectId(id),
            status: ACTIVE_STATUS,
            $or: [{ cpfLookup: cpfLookup(cpf) }, { ownerCpf: { $in: [cpf, formatCpf(cpf)] } }],
        })
            .select('_id')
            .lean();

        return NextResponse.json({
            success: true,
            participantIds: matches.map((participant) => String(participant._id)),
        }, { status: 200, headers });

    } catch (error) {
        console.error('[PARTICIPANTS_POST]', error instanceof Error ? error.name : 'UnknownError');
        return NextResponse.json({ success: false, error: 'Erro interno ao buscar participante.' }, { status: 500, headers });
    }
}

export const GET = withRouteAccess(GETHandler);
export const POST = withRouteAccess(POSTHandler);
