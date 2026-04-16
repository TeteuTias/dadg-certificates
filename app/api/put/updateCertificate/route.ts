import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import CertificateModel from '@/lib/models/CertificateModel';
import { ICertificateWithEventPopulate } from '@/lib/models/CertificateModel';
import { ObjectId } from 'mongodb';



type ICertificateUpdate = Pick<ICertificateWithEventPopulate, '_id'> & Partial<Omit<ICertificateWithEventPopulate, '_id'>>;


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
            ownerName: formData.get('ownerName') as string || undefined,
            ownerCpf: formData.get('ownerCpf') as string || undefined,
            eventName: formData.get('eventName') as string || undefined,
            ownerEmail: formData.get('ownerEmail') as string || undefined,
            certificateHours: formData.get('certificateHours') as string || undefined,
            certificatePath: formData.get('certificatePath') as string || undefined,
            frontTopperText: formData.get('frontTopperText') as string || undefined,
            frontBottomText: formData.get('frontBottomText') as string || undefined,
        };

        const { _id, ...updateFields } = data;



        const update = await CertificateModel.findOneAndUpdate(
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
