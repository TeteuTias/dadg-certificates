import mongoose from 'mongoose';
import EventCertificateModel from '@/lib/models/EventCertificateModel';
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from "bson"
import EventParticipant from '@/lib/models/EventParticipant';
import { auth0 } from '@/lib/auth0';


interface RouteParams {
    params: {
        eventId: string;
    };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { eventId } = await params;
        if (!ObjectId.isValid(eventId)) {
            return NextResponse.json({ success: false, error: 'ID de evento inválido' }, { status: 400 });
        }
        const event = await EventCertificateModel.findOne({ _id: eventId, documentVersion: "2.0" }).lean()
        if (!event) {
            return NextResponse.json({ success: false, error: 'Evento não encontrado' }, { status: 404 });
        }
        return NextResponse.json({ data: event }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ success: false, error: 'Erro ao buscar participantes' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    // Iniciando a Sessão para a Transação Atômica
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const resolvedParams = await params;
        const eventId = resolvedParams.eventId;

        if (!ObjectId.isValid(eventId)) {
            return NextResponse.json({ success: false, error: 'ID de evento inválido' }, { status: 400 });
        }

        // Extraindo dados
        const body = await request.json();
        const sessionAuth = await auth0.getSession(request);
        if (!sessionAuth || !sessionAuth.user) {
            return NextResponse.json({ success: false, error: 'Usuário não autenticado' }, { status: 401 });
        }
        const user = sessionAuth.user;

        const ownerId = new ObjectId(user.sub.split('|')[1]); // Extraindo o ID do usuário (ajuste conforme seu formato de sub)
        const ownerName = user.name;
        if (!ownerId || !ownerName) {
            return NextResponse.json({ success: false, error: 'Dados do participante incompletos' }, { status: 400 });
        }

        // 2. Buscando o evento DENTRO da sessão
        const event = await EventCertificateModel.findOne({
            _id: eventId,
            documentVersion: "2.0" // somente 2.0 pois estes estão no formato correto!
        }).session(session).lean();

        if (!event) {
            await session.abortTransaction();
            return NextResponse.json({ success: false, error: 'Evento não encontrado' }, { status: 404 });
        }
        if (!event.isOpen) {
            await session.abortTransaction();
            return NextResponse.json({ success: false, error: 'Evento fechado para inscrições' }, { status: 403 });
        }

        // Verificando Toggle
        const existingParticipant = await EventParticipant.findOne({
            eventId,
            owner: ownerId
        }).session(session);

        if (existingParticipant) {
            // CAMINHO A: USUÁRIO JÁ INSCRITO -> CANCELAR

            // Remove o participante
            await EventParticipant.deleteOne({ _id: existingParticipant._id }).session(session);

            // Decrementa a vaga (garantindo que não fique negativo)
            const updatedEvent = await EventCertificateModel.findOneAndUpdate(
                { _id: eventId, registrationCount: { $gt: 0 } },
                { $inc: { registrationCount: -1 } },
                { session, new: true }
            );

            if (!updatedEvent) {
                await session.abortTransaction();
                return NextResponse.json({ success: false, error: 'Erro ao processar cancelamento de vaga' }, { status: 500 });
            }

            // Confirma a transação
            await session.commitTransaction();
            return NextResponse.json({
                success: true,
                message: 'Inscrição cancelada com sucesso.',
                data: updatedEvent
            }, { status: 200 });

        } else {
            // CAMINHO B: USUÁRIO NÃO INSCRITO -> INSCREVER

            if (event.registrationCount >= event.maxParticipants) {
                await session.abortTransaction();
                return NextResponse.json({ success: false, error: 'Limite de participantes atingido' }, { status: 403 });
            }

            // Incremento de vaga
            const updatedEvent = await EventCertificateModel.findOneAndUpdate(
                {
                    _id: eventId,
                    isOpen: true,
                    $expr: { $lt: ["$registrationCount", "$maxParticipants"] }
                },
                { $inc: { registrationCount: 1 } },
                {
                    session,
                    new: true,
                    runValidators: true
                }
            );

            if (!updatedEvent) {
                await session.abortTransaction();
                return NextResponse.json(
                    { success: false, error: "Inscrições encerradas ou evento não disponível devido à concorrência." },
                    { status: 422 }
                );
            }

            // Escrevendo o nome dele na lista de inscritos
            await EventParticipant.create(
                [{
                    eventId,
                    owner: ownerId,
                    ownerName
                }],
                { session }
            );

            // Confirma a transação
            await session.commitTransaction();
            return NextResponse.json({
                success: true,
                message: 'Inscrição realizada com sucesso.',
                data: updatedEvent
            }, { status: 201 });
        }

    } catch (error: any) {
        await session.abortTransaction();
        console.error("Erro na transação de inscrição:", error);
        return NextResponse.json({ success: false, error: 'Erro interno no servidor ao processar inscrição' }, { status: 500 });

    } finally {
        // Sempre encerra a sessão, dando erro ou sucesso, caso contrário vai travar tudo ...
        await session.endSession();
    }
}
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const resolvedParams = await params;
        const eventId = resolvedParams.eventId;

        if (!ObjectId.isValid(eventId)) {
            return NextResponse.json({ success: false, error: 'ID de evento inválido' }, { status: 400 });
        }

        const sessionAuth = await auth0.getSession(request);
        if (!sessionAuth || !sessionAuth.user) {
            return NextResponse.json({ success: false, error: 'Usuário não autenticado' }, { status: 401 });
        }

        const ownerId = sessionAuth.user.sub.split('|')[1];

        if (!ownerId) {
            return NextResponse.json({ success: false, error: 'ID do participante é obrigatório' }, { status: 400 });
        }

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
        await session.abortTransaction();
        console.error("Erro na transação de retirada:", error);
        return NextResponse.json({ success: false, error: 'Erro interno ao processar o cancelamento' }, { status: 500 });
    } finally {
        await session.endSession(); // Garante que não trave a sessão do banco de dados
    }
}