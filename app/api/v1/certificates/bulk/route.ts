import CertificateModel from '@/lib/models/CertificateModel';
import { connectToDatabase } from '@/lib/mongodb';
import { NextResponse } from 'next/server';
// import { connectToDatabase } from '@/lib/mongodb';
// import CertificateModel from '@/models/Certificate';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // 1. Desestruturando o "Envelope"
        const { operationType, certificates } = body;

        // 2. Validação rigorosa
        if (!operationType || !['simple-bulk', 'verse-bulk'].includes(operationType)) {
            return NextResponse.json(
                { error: "O campo 'operationType' é obrigatório e deve ser 'simple-bulk' ou 'verse-bulk'." },
                { status: 400 }
            );
        }

        if (!Array.isArray(certificates) || certificates.length === 0) {
            return NextResponse.json(
                { error: "A lista de certificados está vazia ou em formato inválido." },
                { status: 400 }
            );
        }

        // 3. Conexão com o banco (descomente quando for plugar no seu BD)
        await connectToDatabase();

        // 4. Processamento baseado no tipo de lote
        if (operationType === 'verse-bulk') {
            console.log(`[API] Processando ${certificates.length} certificados COM verso.`);
            // Validação extra: garantir que as linhas do verso existem
            const hasInvalidVerse = certificates.some(cert => !cert.verse?.rows || cert.verse.rows.length === 0);
            if (hasInvalidVerse) {
                return NextResponse.json({ error: "Lote de verso inválido. Linhas vazias detectadas." }, { status: 400 });
            }

            await CertificateModel.insertMany(certificates);

        } else {
            console.log(`[API] Processando ${certificates.length} certificados SIMPLES (sem verso).`);
            await CertificateModel.insertMany(certificates);
        }

        return NextResponse.json({
            message: "Lote processado e salvo com sucesso!",
            insertedCount: certificates.length,
            type: operationType
        }, { status: 201 });

    } catch (error: any) {
        console.error("[CERTIFICATES_BULK_POST]", error);
        return NextResponse.json(
            { error: "Erro interno no servidor ao processar o lote." },
            { status: 500 }
        );
    }
}