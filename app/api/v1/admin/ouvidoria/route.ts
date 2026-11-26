import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { connectToDatabase } from "@/lib/mongodb";
import { COLECAO, filtroDaBusca } from "@/lib/ouvidoria";

const POR_PAGINA = 30;
const semCache = { "Cache-Control": "private, no-store" };

export const GET = withRouteAccess(async (request: NextRequest) => {
  const conexao = await connectToDatabase();
  const col = conexao.connection.db!.collection(COLECAO);
  const q = request.nextUrl.searchParams;
  const pagina = Math.max(1, Math.min(1000, Number(q.get("pagina")) || 1));
  const filtro = filtroDaBusca(q);

  const [itens, total, abertas] = await Promise.all([
    col
      .find(filtro)
      .sort({ criadaEm: -1 })
      .skip((pagina - 1) * POR_PAGINA)
      .limit(POR_PAGINA)
      .toArray(),
    col.countDocuments(filtro),
    col.countDocuments({ status: { $in: ["recebida", "em_analise"] } }),
  ]);

  return Response.json(
    {
      data: itens.map((d) => ({ ...d, _id: String(d._id), anexo: d.anexo ? { ...d.anexo, id: String(d.anexo.id) } : null })),
      paginacao: { pagina, porPagina: POR_PAGINA, total, paginas: Math.max(1, Math.ceil(total / POR_PAGINA)) },
      abertas,
    },
    { headers: semCache },
  );
});
