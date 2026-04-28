import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import EventCertificateModel from "@/lib/models/EventCertificateModel";

export const dynamic = "force-dynamic";
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
  const startDate = new Date(year, month - 1, 1);
  // Data final: Dia 1º do próximo mês (exclusivo)
  const endDate = new Date(year, month, 1);

  // 3. Montando a Query
  // Nota: Mantenha a versão com $regex se o seu createdAt no banco for do tipo String
  const query = {
    isOpen: false,
    createdAt: {
      $gte: startDate,
      $lt: endDate,
    },
  };

  // 4. Busca direta trazendo TODOS os eventos do mês
  const events = await EventCertificateModel.find(query)
    .sort({ createdAt: 1 }); // Ordena do mais antigo para o mais novo dentro do mês

  // Retorna tudo de uma vez
  return NextResponse.json({
    data: events,
    total: events.length,
    filter: n // Devolvemos o mês/ano pra facilitar a validação no front
  });
}