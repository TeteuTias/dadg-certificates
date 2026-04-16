import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { DeleteEventAndAllCertificates } from "@/lib/models/src/certificatesHandler/delete/deleteEventAndAllCertificates";
//
//
//
export async function DELETE(request: Request) {

    const formData = await request.formData();
    const eventId = formData.get("eventId")

    if (!eventId || eventId == undefined || typeof eventId !== "string") {
        return NextResponse.json({ message: "Forneça o _id do evento." }, { status: 500 })
    }
    const formatedEventId = new ObjectId(eventId)
    const deletedEvent = await DeleteEventAndAllCertificates(formatedEventId)
    if (!deletedEvent) {
        return NextResponse.json({ message: "Não foi possível apagar o evento." }, { status: 500 })
    }

    return NextResponse.json({ "message": "Seu evento e TODOS OS CERTIFICADOS ASSOCIADOS A ELE foram apagados com sucesso" })
}