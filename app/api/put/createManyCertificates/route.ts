import { NextRequest, NextResponse } from "next/server";
import CertificateModel from "@/lib/models/CertificateModel";
import { ObjectId } from "mongodb";
import { ICertificate } from "@/lib/models/CertificateModel";

export async function POST(request: NextRequest) {
    /*
        ---> [ 'Nome', 'CPF (sem pontos ou traços)', 'Email' ] <---
    */
    const data: {
        update: string[][],
        frontText: string,
        bottomText: string,
        eventId: string,
        eventName: string,
        hours: string,
        path: string
    } = await request.json()

    try {

        const updateData: Omit<ICertificate, "_id">[] = data.update.map((element) => ({
            eventId: new ObjectId(data.eventId),
            ownerName: element[0],
            ownerCpf: element[1] ?? "",
            ownerEmail: element[2] ?? "",
            eventName: data.eventName,
            certificateHours: data.hours,
            certificatePath: data.path,
            frontTopperText: data.frontText,
            frontBottomText: data.bottomText,
        }))
        await CertificateModel.insertMany(updateData)

        return NextResponse.json({ message: "Certificados Criados Com Sucesso!" })
    } catch (err) {
        return NextResponse.json({ message: `${err instanceof Error ? err.message : "Ocorreu algum erro desconhecido"}` }, { status: 500 })
    }
}