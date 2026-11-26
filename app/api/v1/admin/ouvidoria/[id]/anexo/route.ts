import { ObjectId } from "mongodb";
import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { connectToDatabase } from "@/lib/mongodb";
import { COLECAO_ANEXOS } from "@/lib/ouvidoria";

const TIPOS = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

/** Baixa o anexo de uma manifestação (só administrador). Sempre como download, nunca aberto no domínio do painel. */
export const GET = withRouteAccess(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!ObjectId.isValid(id)) return new Response("Não encontrado", { status: 404 });
  const conexao = await connectToDatabase();
  const a = await conexao.connection.db!.collection(COLECAO_ANEXOS).findOne({ manifestacaoId: new ObjectId(id) });
  if (!a || !TIPOS.has(a.tipo)) return new Response("Não encontrado", { status: 404 });
  const bytes: Uint8Array = a.dados?.buffer ?? a.dados;
  const nome = String(a.nome || "anexo").replace(/[^a-zA-Z0-9._-]/g, "_");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": a.tipo,
      "Content-Disposition": `attachment; filename="${nome}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
});
