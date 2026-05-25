import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import EventCertificateModel, { IEventCertificate } from '@/lib/models/EventCertificateModel';
import { buildEventStatusDetails } from '@/lib/events/statusDetails';

export async function PUT(request: Request) {
    try {
        await connectToDatabase();

        // 1. Recebemos o corpo da requisição
        let rawData = await request.json();
        // 2. Se o frontend enviou stringificado, forçamos a conversão para objeto
        if (typeof rawData === 'string') {
            rawData = JSON.parse(rawData);
        }
        // 3. Agora podemos tipar com seguranca e desestruturar
        const formData = rawData as Partial<IEventCertificate> & {
            _id?: unknown;
            status?: unknown;
            registrationStartDate?: unknown;
            registrationEndDate?: unknown;
            timeLine?: unknown;
        };
        const {
            _id,
            status,
            registrationStartDate,
            registrationEndDate,
            timeLine,
            statusDetails,
            ...restUpdateData
        } = formData;
        const updateData = restUpdateData as Partial<IEventCertificate>;

        if (typeof _id !== 'string') {
            return NextResponse.json(
                { success: false, message: '_id e invalido ou esta ausente' },
                { status: 400 }
            );
        }

        const statusPayload = statusDetails ?? (
            status !== undefined
                ? { status, registrationStartDate, registrationEndDate, timeLine }
                : undefined
        );

        if (statusPayload) {
            const statusDetailsResult = buildEventStatusDetails(statusPayload);

            if (statusDetailsResult.error) {
                return NextResponse.json(
                    { success: false, message: statusDetailsResult.error },
                    { status: 400 }
                );
            }

            updateData.statusDetails = statusDetailsResult.statusDetails;
        }

        const update = await EventCertificateModel.findOneAndUpdate(
            { _id },
            { $set: updateData },
            { new: true, runValidators: true }
        ).lean();

        if (!update) {
            return NextResponse.json(
                { success: false, message: 'Certificado não encontrado ou atualização falhou.' },
                { status: 404 }
            );
        }
        return NextResponse.json({ success: true, data: update });

    } catch (error) {
        let message = 'Erro ao atualizar o certificado.';
        if (error instanceof Error) {
            message = error.message;
        }
        return NextResponse.json(
            { success: false, message },
            { status: 500 }
        );
    }
}
