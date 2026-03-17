import { connectToDatabase } from "@/lib/mongodb";
import { NextRequest } from "next/server";
import { ObjectId } from "bson";
import CertificateModel from "@/lib/models/CertificateModel";

export async function DELETE(req: NextRequest, {
    params,
}: {
    params: Promise<{ search: string }>
}) {
    await connectToDatabase()
    const { search } = await params
    const searchValue = search
    if (!searchValue || !ObjectId.isValid(searchValue)) {
        return Response.json({ message: "O parâmetro 'search' é obrigatório." }, { status: 400 });
    }


    const certificates = await CertificateModel.deleteOne({
        _id: search,
    })
    if (certificates.deletedCount != 1) {
        return Response.json({ message: "O certificado não foi deletado." }, { status: 404 });
    }
    return Response.json({ "message": `O certificado foi deletado com sucesso!`, })
}