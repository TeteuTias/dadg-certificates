import EventCertificateModel from '@/lib/models/EventCertificateModel';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 
 * 
 * @returns Retorna todos os eventos cadastrados no banco de dados, filtrando apenas os que possuem a versão do documento igual a "2.0", já que estes estão na versão nova...
 */
export async function GET(request: NextRequest) {
    try {
        const events = await EventCertificateModel.find({documentVersion:"2.0"}).lean()
        return NextResponse.json({ data: events }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ success: false, error: 'Erro ao buscar participantes' }, { status: 500 });
    }
}