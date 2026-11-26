import { ObjectId } from "mongodb";
import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import GateKeeper from "@/lib/security/gatekeeper";
import { connectToDatabase } from "@/lib/mongodb";
import { COLECAO, validarAtualizacao, type Status } from "@/lib/ouvidoria";

type Texto = { texto: string; em: Date; por: string } | null;
type Manifestacao = {
  _id: ObjectId;
  status: Status;
  resposta: Texto;
  notaInterna?: Texto;
  historico: { status: Status; em: Date; por?: string }[];
  atualizadaEm: Date;
};

/** Muda o andamento e, se vier, publica a resposta (o aluno vê) e a anotação interna (só o painel vê). */
export const PATCH = withRouteAccess(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "Manifestação não encontrada." }, { status: 404 });
  const actor = await new GateKeeper(request).identifyAdmin();
  if (!actor) return Response.json({ error: "Não autorizado" }, { status: 403 });

  const v = validarAtualizacao(await request.json().catch(() => null));
  if (!v.ok) return Response.json({ error: v.erro }, { status: 400 });
  const { status, resposta, nota } = v.dados;

  const conexao = await connectToDatabase();
  const col = conexao.connection.db!.collection<Manifestacao>(COLECAO);
  const atual = await col.findOne({ _id: new ObjectId(id) }, { projection: { status: 1, resposta: 1, notaInterna: 1 } });
  if (!atual) return Response.json({ error: "Manifestação não encontrada." }, { status: 404 });

  const agora = new Date();
  const por = actor.email || actor.name || actor.sub;
  const set: Partial<Manifestacao> = { status, atualizadaEm: agora };
  if (resposta !== null && resposta !== (atual.resposta?.texto ?? "")) set.resposta = resposta ? { texto: resposta, em: agora, por } : null;
  if (nota !== null && nota !== (atual.notaInterna?.texto ?? "")) set.notaInterna = nota ? { texto: nota, em: agora, por } : null;

  const mudouStatus = status !== atual.status;
  await col.updateOne(
    { _id: atual._id },
    {
      $set: set,
      ...(mudouStatus ? { $push: { historico: { status, em: agora, por } } } : {}),
    },
  );
  return Response.json({ success: true });
});
