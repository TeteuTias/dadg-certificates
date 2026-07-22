import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import EventCertificateModel from "@/lib/models/EventCertificateModel";

export const dynamic = "force-dynamic";
/**
 * 
 * @abstract Rota criada para o usuário. Ela retorna os eventos que estão fechados para inscrição, filtrando por mês e ano. O formato do parâmetro é "AAAA-MM" (ex: "2026-04"). A resposta inclui os eventos do mês especificado, ordenados do mais antigo para o mais recente
 * @abstract Para isso, ela filtra os eventos por: "PUBLISHED_OPEN".
 * @returns Ela retorna os eventos que estão fechados para inscrição, filtrando por mês e ano. O formato do parâmetro é "AAAA-MM" (ex: "2026-04"). A resposta inclui os eventos do mês especificado, ordenados do mais antigo para o mais recente.
 */
export async function GET(
    req: NextRequest,
    {
        params,
    }: {
        params: Promise<{ n: string }>; // -> "YYYY-MM" => JANEIRRO É 0 E DEZEMBRO É 11!!
    }
) {
    await connectToDatabase();

    const { n } = await params;

    // 1. Validação do formato AAAA-MM
    const dateRegex = /^\d{4}-\d{2}$/;
    if (!n || !dateRegex.test(n)) {
        return NextResponse.json(
            { error: "Formato de data inválido. Use AAAA-MM (ex: 2026-04)" },
            { status: 400 }
        );
    }

    // 2. Extraindo Ano e Mês
    const [yearStr, monthStr] = n.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    // Data inicial: Dia 1º do mês (às 00:00:00)
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));

    // Data final: primeiro milissegundo do próximo mês
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    // 2. Montando a Query
    const query = {
        "statusDetails.status": { $in: ["PUBLISHED_OPEN"] },
        "statusDetails.registrationStartDate": {
            $gte: startDate, // Maior ou igual ao início do mês
            $lt: endDate,    // Menor que o início do próximo mês
        },
    };

    // 4. Busca direta trazendo TODOS os eventos do mês
    const events = await EventCertificateModel.find(query)
        .sort({ createdAt: 1 }); // Ordena do mais antigo para o mais novo dentro do mês
    console.log(`Eventos encontrados para ${n}:`, events.length);
    // Retorna tudo de uma vez
    return NextResponse.json({
        data: events,
        total: events.length,
        filter: n // Devolvemos o mês/ano pra facilitar a validação no front
    });
}