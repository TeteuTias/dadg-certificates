import AcademicLeagueModel from "@/app/lib/models/AcademicLeagues";
import { connectToDatabase } from "@/app/lib/mongodb";
import { NextRequest } from "next/server";
import { ObjectId } from "bson"
//
//
export async function GET(req: NextRequest, {
    params,
}: {
    params: Promise<{ id: string }>
}) {

    const { id } = await params
    if (!id) {
        return Response.json({ message: "O parâmetro 'id' é obrigatório." }, { status: 500 });
    }
    if (!ObjectId.isValid(id)) {
        return Response.json({ message: "O parâmetro 'id' não é válido." }, { status: 500 });
    }

    //
    //
    await connectToDatabase()
    const data = await AcademicLeagueModel.findOne({
        _id: new ObjectId(id)
    }).lean();

    if (!data) {
        return Response.json({ message: "Nenhum resultado encontrado." }, { status: 404 });
    }

    return Response.json({ data: data }, { status: 200 });

}