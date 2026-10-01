import { withRouteAccess } from "@/lib/security/route-access";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { DeleteEventAndAllCertificates } from "@/lib/models/src/certificatesHandler/delete/deleteEventAndAllCertificates";
//
//
//
async function DELETEHandler(request: Request) {

    const formData = await request.formData();
    const eventId = formData.get("eventId")

    if (!eventId || eventId == undefined || typeof eventId !== "string") {
        return NextResponse.json({ message: "Forneça o _id do evento." }, { status: 500 })
    }
    const formatedEventId = new ObjectId(eventId)
    const deletedEvent = await DeleteEventAndAllCertificates(formatedEventId)
    if (!deletedEvent) {
        return NextResponse.json({ message: "Não foi possível arquivar o evento." }, { status: 500 })
    }

    return NextResponse.json({ "message": "Evento arquivado. Certificados e participantes foram preservados." })
}
export const DELETE = withRouteAccess(DELETEHandler);
