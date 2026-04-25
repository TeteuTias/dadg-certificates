import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import EventCertificateModel, { IEventCertificate } from '@/lib/models/EventCertificateModel';

export async function PUT(request: Request) {
    try {
        await connectToDatabase();

        // 1. Recebemos o corpo da requisição
        let rawData = await request.json();
        // 2. Se o frontend enviou stringificado, forçamos a conversão para objeto
        if (typeof rawData === 'string') {
            rawData = JSON.parse(rawData);
        }
        // 3. Agora podemos tipar com segurança e desestruturar
        const formData = rawData as IEventCertificate;
        const { _id, ...updateData } = formData;

        if (typeof _id !== 'string') {
            return NextResponse.json(
                { success: false, message: '_id é inválido ou está ausente' },
                { status: 400 }
            );
        }

        const update = await EventCertificateModel.findOneAndUpdate(
            { _id },
            { $set: updateData },
            { new: true }
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