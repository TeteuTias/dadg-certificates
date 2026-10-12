import { EventError } from "@/lib/events/rules";
import { EventAudit } from "@/lib/events/Audit";
import { applyAttendance, eventStages } from "@/lib/events/attendance";
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
 * Body: { ownerName, ownerEmail, ownerCpf, stageId? }
 * A entrada é lançada na etapa informada (obrigatória em eventos com várias etapas).
 * Usado na tela de presença quando alguém não se inscreveu antes mas está presente.
 * É um lançamento manual: conta a vaga, mas não é barrado pela lotação nem pelo
 * período de inscrições. Eventos pagos exigem inscrição pela conta do participante.
 */
async function POSTHandler(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;

        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, error: 'ID de evento inválido' }, { status: 400 });
        }

        const keeper = new GateKeeper(request);
        const staff = await keeper.identifyStaff();
        if (!staff) {
            return NextResponse.json({ success: false, error: 'Usuário não autenticado' }, { status: 401 });
        }
        const { user, role } = staff;

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

        if (event.isPaid) {
            return NextResponse.json(
                { success: false, error: 'Eventos pagos exigem inscrição e pagamento pela conta do participante.' },
                { status: 409 },
            );
        }

        const qrToken = randomUUID();
        const now = new Date();
        const lookup = cpfLookup(ownerCpf);
        const requestedStageId = typeof body.stageId === 'string' && body.stageId ? body.stageId : null;
        const entry = applyAttendance({}, eventStages(event), 'checkin', requestedStageId, now);

        // Walk-in: cria o participante e já marca a entrada em uma única transação.
        const session = await mongoose.startSession();
        let participantId = '';
        try {
            await session.withTransaction(async () => {
                const existing = await EventParticipant.exists({
                    eventId: id,
                    status: { $ne: 'CANCELLED' },
                    $or: [{ ownerEmail }, { ownerCpf }, { cpfLookup: lookup }],
                }).session(session);
                if (existing) {
                    throw new EventError(
                        'PARTICIPANT_ALREADY_REGISTERED',
                        409,
                        'Já existe inscrição com este e-mail ou CPF neste evento.',
                    );
                }

                const updated = await EventCertificateModel.updateOne(
                    { _id: id, archivedAt: { $exists: false }, isPaid: false },
                    { $inc: { registrationCount: 1 } },
                    { session },
                );
                if (!updated.modifiedCount) {
                    throw new EventError(
                        'EVENT_UNAVAILABLE',
                        409,
                        'Evento indisponível para lançamento manual.',
                    );
                }

                const [participant] = await EventParticipant.create(
                    [{
                        eventId: id,
                        ownerName,
                        ownerEmail,
                        cpfEncrypted: encryptCpf(ownerCpf),
                        cpfLookup: lookup,
                        status: 'CONFIRMED',
                        qrToken,
                        checkedIn: true,
                        checkedInAt: now,
                        ...(entry.attendance
                            ? {
                                attendance: entry.attendance.map((item) => ({
                                    stageId: new ObjectId(item.stageId),
                                    checkedInAt: item.checkedInAt,
                                })),
                            }
                            : {}),
                    }],
                    { session },
                );
                participantId = String(participant._id);

                await EventAudit.create(
                    [{
                        eventId: id,
                        participantId: participant._id,
                        actor: user.sub,
                        action: 'registration.walkin',
                        details: entry.stageId ? `${role} stage:${entry.stageId}` : role,
                    }],
                    { session },
                );
            });
        } finally {
            await session.endSession();
        }

        return NextResponse.json({
            success: true,
            message: `${ownerName} adicionado e presença confirmada!`,
            data: {
                participantId: participantId,
                ownerName,
                ownerEmail,
                stageId: entry.stageId,
                checkedIn: true,
                checkedInAt: now,
            },
        }, { status: 201 });

    } catch (error) {
        if (error instanceof EventError) {
            return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status });
        }
        console.error('[WALKIN_POST]', error);
        return NextResponse.json({ success: false, error: 'Erro interno ao adicionar participante.' }, { status: 500 });
    }
}

export const POST = withRouteAccess(POSTHandler);
