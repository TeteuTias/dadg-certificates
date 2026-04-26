import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import EventCertificateModel from "@/lib/models/EventCertificateModel";
import GateKeeper from "@/lib/security/gatekeeper";
import EventParticipant from "@/lib/models/EventParticipant";
//  export async function GET(req: NextRequest, { params }: { params: { search: string } }) {

export const dynamic = 'force-dynamic'


/**
 * 
 * @abstract Pega os eventos que o usuário está inscrito e retorna para ele. Para confirmar a validade do UserId, o sistema irá pegar o userId que ele enviou, e comparar com o extraído pelo token de autenticação Auth ou Bearer.
 * Quero que ele envie o _id dele para ser uma verificação extra.
 * @returns Lista com todos os eventos que o usuário está inscrito.
 */
export async function GET(req: NextRequest, {
    params,
}: {
    params: Promise<{ userId: string }>
}) {
    // TEORICAMENTE, o GateKeeper já fez a autenticação e autorização logo no Proxy. Assim, não vamos verificar novamente aqui para não perder performance.
    // Instancia o Keeper
    const keeper = new GateKeeper(req);
    // NOVAMENTE, ELE NÃO VAI VERIFICAR A SESSÃO, APENAS NORMALIZAR O USUÁRIO PARA O FORMATO PADRÃO DO AUTH0.
    // ASSIM,ESSA ROTA, TEM QUE ESTAR AUTENTICADA PREVIAMENTE VIA PROXY!
    const user = await keeper.identifySession();
    if (!user) {
        return Response.json({ message: "Usuário não autenticado." }, { status: 401 });
    }
    await connectToDatabase()
    const { userId } = await params
    const userIdToken = user.sub.replace("auth0|", "")
    if (userId !== userIdToken) {
        return NextResponse.json({ message: "ID do usuário não corresponde ao token de autenticação." }, { status: 403 });
    }
    const userInscription = await EventParticipant.find({ owner: new mongoose.Types.ObjectId(userId) }).lean()


    return NextResponse.json({ "data": userInscription })
}