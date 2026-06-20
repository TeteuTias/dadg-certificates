import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import CertificateModel from '@/app/lib/models/CertificateModel';
import EventCertificateModel from '@/app/lib/models/EventCertificateModel';
import AcademicLeagueModel from '@/app/lib/models/AcademicLeagues';

export const revalidate = 0; // disable cache

export async function GET() {
    try {
        await connectToDatabase();

        const [
            alunosRepresentados,
            eventosRealizados,
            coordenadoriasAtivas,
            certificadosEmitidos
        ] = await Promise.all([
            CertificateModel.distinct('ownerCpf').then(cpfs => cpfs.length),
            EventCertificateModel.countDocuments(),
            AcademicLeagueModel.countDocuments(),
            CertificateModel.countDocuments()
        ]);

        return NextResponse.json({
            alunosRepresentados,
            eventosRealizados,
            coordenadoriasAtivas,
            certificadosEmitidos
        });
    } catch (error) {
        console.error('Error fetching home stats:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
