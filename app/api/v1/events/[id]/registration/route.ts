import mongoose from 'mongoose';
import EventCertificateModel from '@/lib/models/EventCertificateModel';
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'bson';
import EventParticipant from '@/lib/models/EventParticipant';
import { auth0 } from '@/lib/auth0';
import GateKeeper from '@/lib/security/gatekeeper';
import { connectToDatabase } from '@/lib/mongodb';


interface RouteParams {
    params: Promise<{
        id: string;
    }>;
}
/**
 * 
 * @description Retorna o evento que o usuário está inscrito, baseado no ID. Se ele não tiver inscrito, não é retornado.
 * @returns 
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        console.log("Buscando participantes para o evento ID:", id);
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, error: 'ID de evento inválido' }, { status: 400 });
        }
        //
        //
        // Não verifica se está autenticado, isso foi feito no proxy!
        const keeper = new GateKeeper(request)
        const user = await keeper.identifySession()
        if (!user) {
            return NextResponse.json({ success: false, message: 'Usuário não encontrado/autenticado' }, { status: 401 });
        }
        await connectToDatabase();
        const event = await EventParticipant.findOne({ eventId: id, owner: user.sub.replace("auth0|", "") }).populate("eventId").lean()
        if (!event) {
            return NextResponse.json({ success: false, error: 'Evento não encontrado' }, { status: 404 });
        }
        return NextResponse.json({ data: event }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    const session = await mongoose.startSession();

    try {
        const { id } = await params;

        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, error: 'ID de evento inválido' }, { status: 400 });
        }

        const keeper = new GateKeeper(request);
        const user = await keeper.identifySession();
        if (!user?.sub) {
            return NextResponse.json({ success: false, error: 'Usuário não autenticado' }, { status: 401 });
        }

        const ownerIdValue = user.sub.includes('|') ? user.sub.split('|')[1] : user.sub;
        if (!ownerIdValue || !ObjectId.isValid(ownerIdValue)) {
            return NextResponse.json({ success: false, error: 'Identidade do usuário inválida' }, { status: 403 });
        }

        const ownerName = user.name?.trim();
        if (!ownerName) {
            return NextResponse.json({ success: false, error: 'Nome do usuário não encontrado' }, { status: 400 });
        }

        const ownerId = new ObjectId(ownerIdValue);
        const eventId = new ObjectId(id);

        await connectToDatabase();
        session.startTransaction();

        const event = await EventCertificateModel.findOne({
            _id: eventId,
            'statusDetails.status': 'PUBLISHED_OPEN',
        })
            .session(session)
            .lean();

        if (!event) {
            await session.abortTransaction();
            return NextResponse.json({ success: false, error: 'Evento não encontrado ou inscrições fechadas' }, { status: 404 });
        }

        const now = new Date();
        const startDate = event.statusDetails.registrationStartDate ? new Date(event.statusDetails.registrationStartDate) : null;
        const endDate = event.statusDetails.registrationEndDate ? new Date(event.statusDetails.registrationEndDate) : null;

        if ((startDate && now < startDate) || (endDate && now > endDate)) {
            await session.abortTransaction();
            return NextResponse.json({ success: false, error: 'Fora do período de inscrições' }, { status: 403 });
        }

        const existingParticipant = await EventParticipant.findOne({
            eventId,
            owner: ownerId,
        }).session(session);

        if (existingParticipant) {
            await session.abortTransaction();
            return NextResponse.json({ success: false, error: 'Você já está inscrito neste evento.' }, { status: 409 });
        }

        const updatedEvent = await EventCertificateModel.findOneAndUpdate(
            {
                _id: eventId,
                'statusDetails.status': 'PUBLISHED_OPEN',
                $expr: { $lt: ['$registrationCount', '$maxParticipants'] },
            },
            { $inc: { registrationCount: 1 } },
            { session, new: true, runValidators: true }
        ).lean();

        if (!updatedEvent) {
            await session.abortTransaction();
            return NextResponse.json({ success: false, error: 'Evento lotado ou inscrições indisponíveis no momento.' }, { status: 409 });
        }

        await EventParticipant.create(
            [
                {
                    eventId,
                    owner: ownerId,
                    ownerName,
                },
            ],
            { session }
        );

        await session.commitTransaction();

        return NextResponse.json(
            {
                success: true,
                message: 'Inscrição realizada com sucesso!',
                data: {
                    eventId: updatedEvent._id,
                    registrationCount: updatedEvent.registrationCount,
                },
            },
            { status: 201 }
        );
    } catch (error: any) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        return NextResponse.json({ success: false, error: error?.message ?? 'Erro interno ao processar inscrição' }, { status: 500 });
    } finally {
        session.endSession();
    }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = await params;
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, error: 'ID de evento inválido' }, { status: 400 });
        }

        const sessionAuth = await auth0.getSession(request);
        if (!sessionAuth || !sessionAuth.user) {
            return NextResponse.json({ success: false, error: 'Usuário não autenticado' }, { status: 401 });
        }

        const ownerIdValue = sessionAuth.user.sub.includes('|') ? sessionAuth.user.sub.split('|')[1] : sessionAuth.user.sub;

        if (!ownerIdValue || !ObjectId.isValid(ownerIdValue)) {
            return NextResponse.json({ success: false, error: 'ID do participante é obrigatório' }, { status: 400 });
        }

        const ownerId = new ObjectId(ownerIdValue);
        const eventId = new ObjectId(id);

        // Verifica se a inscrição realmente existe para este usuário
        const existingParticipant = await EventParticipant.findOne({
            eventId,
            owner: ownerId
        }).session(session);

        if (!existingParticipant) {
            await session.abortTransaction();
            return NextResponse.json({ success: false, error: 'Inscrição não encontrada' }, { status: 404 });
        }

        // Remove o documento do participante
        await EventParticipant.deleteOne({ _id: existingParticipant._id }).session(session);

        // Devolve a vaga para o evento
        // A condição { $gt: 0 } é a sua barreira de segurança contra números negativos
        const updatedEvent = await EventCertificateModel.findOneAndUpdate(
            { _id: eventId, registrationCount: { $gt: 0 } },
            { $inc: { registrationCount: -1 } },
            { session, new: true }
        );

        if (!updatedEvent) {
            // Se o código cair aqui, significa que o banco de dados tem uma inconsistência:
            // O usuário tinha uma inscrição, mas o evento já marcava 0 vagas ocupadas.
            await session.abortTransaction();
            return NextResponse.json({ success: false, error: 'Erro de integridade na contagem de vagas do evento, por favor contate o administrador do sistema.' }, { status: 500 });
        }

        // Confirma a transação com segurança
        await session.commitTransaction();
        return NextResponse.json({
            success: true,
            message: 'Inscrição cancelada e vaga liberada com sucesso.',
            data: updatedEvent
        }, { status: 200 });

    } catch (error: any) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("Erro na transação de retirada:", error);
        return NextResponse.json({ success: false, error: 'Erro interno ao processar o cancelamento' }, { status: 500 });
    } finally {
        session.endSession();
    }
}