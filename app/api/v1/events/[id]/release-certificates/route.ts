import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'bson';
import EventParticipant from '@/lib/models/EventParticipant';
import EventCertificateModel from '@/lib/models/EventCertificateModel';
import CertificateModel from '@/lib/models/CertificateModel';
import GateKeeper from '@/lib/security/gatekeeper';
import { connectToDatabase } from '@/lib/mongodb';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * @description Libera certificados automaticamente para participantes que concluíram check-in e check-out.
 * POST /api/v1/events/[id]/release-certificates
 * 
 * 
 * Body: { certificateHours: string } — carga horária do certificado
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

        // Lê carga horária digitada pelo admin na hora de liberar
        const body = await request.json().catch(() => ({}));
        const certificateHours: string = (body.certificateHours || '').trim();
        if (!certificateHours) {
            return NextResponse.json({
                success: false,
                error: 'Informe a carga horária do evento (ex: "4 horas") para gerar os certificados.',
            }, { status: 400 });
        }

        await connectToDatabase();

        // 1. Buscar o evento e validar
        const event = await EventCertificateModel.findById(id).lean();
        if (!event) {
            return NextResponse.json({ success: false, error: 'Evento não encontrado.' }, { status: 404 });
        }

        if (event.certificateReleased) {
            return NextResponse.json({
                success: false,
                error: 'Os certificados deste evento já foram liberados anteriormente.',
                alreadyReleased: true,
            }, { status: 409 });
        }

        // 2. Somente participantes que concluíram entrada e saída podem receber certificado.
        const pendingCertificateQuery = {
            eventId: new ObjectId(id),
            checkedIn: true,
            $or: [{ certificateId: null }, { certificateId: { $exists: false } }],
        };
        const [pendingParticipants, awaitingCheckoutCount] = await Promise.all([
            EventParticipant.find({ ...pendingCertificateQuery, checkedOut: true }).lean(),
            EventParticipant.countDocuments({ ...pendingCertificateQuery, checkedOut: { $ne: true } }),
        ]);
        const eligibleParticipants = pendingParticipants.filter((participant) => {
            const email = typeof participant.ownerEmail === 'string' ? participant.ownerEmail.trim() : '';
            const cpf = typeof participant.ownerCpf === 'string' ? participant.ownerCpf.replace(/\D/g, '') : '';
            return email.includes('@') && cpf.length === 11;
        });
        const incompleteParticipants = pendingParticipants.filter(
            (participant) => !eligibleParticipants.some((eligible) => String(eligible._id) === String(participant._id)),
        );

        if (eligibleParticipants.length === 0) {
            return NextResponse.json({
                success: false,
                error: incompleteParticipants.length > 0
                    ? 'Os participantes que concluíram entrada e saída precisam ter e-mail e CPF regularizados antes da emissão.'
                    : awaitingCheckoutCount > 0
                        ? 'Nenhum participante concluiu check-in e check-out. Registre a saída antes de liberar certificados.'
                        : 'Nenhum participante apto para receber certificado.',
                data: {
                    incompleteParticipants: incompleteParticipants.length,
                    awaitingCheckout: awaitingCheckoutCount,
                },
            }, { status: 400 });
        }

        // 3. Montar e inserir os certificados em lote usando as horas digitadas pelo admin
        const certificateDocs = eligibleParticipants.map((p) => ({
            ownerName: p.ownerName,
            ownerCpf: p.ownerCpf,
            ownerEmail: p.ownerEmail,
            eventName: event.eventName,
            certificateHours,
            eventId: event._id,
            templatePath: event.templatePath,
            isReady: true,
            verse: {
                showVerse: !!event.templateVersePath,
            },
        }));

        const insertedCerts = await CertificateModel.insertMany(certificateDocs, { ordered: false });

        // 4. Atualizar certificateId em cada participante (mantendo ordem do bulkWrite)
        const bulkOps = insertedCerts.map((cert, idx) => ({
            updateOne: {
                filter: { _id: eligibleParticipants[idx]._id },
                update: { $set: { certificateId: cert._id } },
            },
        }));
        if (bulkOps.length > 0) {
            await EventParticipant.bulkWrite(bulkOps);
        }

        // 5. O evento só fica concluído quando nenhum presente aguarda check-out
        // e todos os participantes aptos possuem dados válidos.
        const releaseCompleted = incompleteParticipants.length === 0 && awaitingCheckoutCount === 0;
        await EventCertificateModel.findByIdAndUpdate(id, {
            $set: { certificateReleased: releaseCompleted, certificateHours },
        });

        return NextResponse.json({
            success: true,
            message: releaseCompleted
                ? `${insertedCerts.length} certificado(s) gerado(s) e liberado(s) com sucesso!`
                : `${insertedCerts.length} certificado(s) gerado(s). Ainda existem participantes aguardando check-out ou regularização de dados.`,
            data: {
                generatedCount: insertedCerts.length,
                totalEligible: eligibleParticipants.length,
                certificateHours,
                incompleteParticipants: incompleteParticipants.length,
                awaitingCheckout: awaitingCheckoutCount,
                releaseCompleted,
            },
        }, { status: 201 });

    } catch (error: any) {
        console.error('[RELEASE_CERTIFICATES_POST]', error);
        return NextResponse.json({ success: false, error: 'Erro interno ao liberar certificados.' }, { status: 500 });
    }
}
