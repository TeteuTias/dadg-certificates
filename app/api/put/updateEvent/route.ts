import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import EventCertificateModel from '@/lib/models/EventCertificateModel';

import { IEventCertificate } from '@/lib/models/EventCertificateModel';

import { ObjectId } from 'mongodb';



type ICertificateUpdate = Pick<IEventCertificate, '_id'> & Partial<Omit<IEventCertificate, '_id'>>;


export async function PUT(request: Request) {
    try {
        // Conecta ao banco de dados
        await connectToDatabase();

        // Extrai os dados enviados na requisição
        const formData = await request.formData();

        const tryId = formData.get('_id') // ganbiarra

        if (typeof tryId !== 'string') {
            return NextResponse.json(
                { success: false, message: '_id é inválido ou está ausente' },
                { status: 500 }
            );
        }

        // Constrói o objeto extraindo cada campo do FormData
        const data: ICertificateUpdate = {
            _id: new ObjectId(tryId), // _id é obrigatório

            eventName: formData.get("eventName") as string || undefined,
            eventDescription: formData.get("eventDescription") as string || undefined,

        };

        const { _id, ...updateFields } = data;



        const update = await EventCertificateModel.findOneAndUpdate(
            { _id }, // Usa o _id já convertido
            { $set: updateFields },
            { new: true }
        );

        if (!update) {
            return NextResponse.json(
                { success: false, message: 'Certificado não encontrado ou atualização falhou.' },
                { status: 404 }
            );
        }


        // Atualiza o certificado e retorna o documento atualizado
        return NextResponse.json({ success: true, data: data });


    } catch (error) {
        let message = 'Erro ao atualizar o certificado.'
        if (error instanceof Error) {
            message = error.message
        }
        return NextResponse.json(
            { success: false, message: message },
            { status: 500 }
        );
    }
}
