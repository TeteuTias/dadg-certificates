import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import CertificateModel from "@/lib/models/CertificateModel";
import { IEventCertificate } from "@/lib/models/EventCertificateModel";
//  export async function GET(req: NextRequest, { params }: { params: { search: string } }) {

export const dynamic = 'force-dynamic'



export async function GET(req: NextRequest, {
    params,
}: {
    params: Promise<{ search: string }>
}) {

    await connectToDatabase()
    const { search } = await params
    const searchValue = search
    if (!searchValue || !mongoose.Types.ObjectId.isValid(searchValue)) {
        return Response.json({ message: "O parâmetro 'search' é obrigatório." }, { status: 500 });
    }


    const certificates = await CertificateModel.findOne({
        _id: search,
        isReady: true, // Certificados prontos,
    }).populate<{ eventId: IEventCertificate }>("eventId");
    if (!certificates) {
        return Response.json({ message: "Seu Certificado não foi encontrado. Entre em contato com o Suporte." }, { status: 500 });
    }
    return NextResponse.json({ "data": certificates, })
}