import EventCertificateModel from "@/lib/models/EventCertificateModel";
import { IEventCertificate } from "@/lib/models/EventCertificateModel";
import CertificateModel from "@/lib/models/CertificateModel";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";
import CreateNewModificationHistory from "../put/CreateNewModificationHistory";
import { getUserId } from "@/lib/getUserId";
import { auth0 } from "@/lib/auth0";

//
//
export async function DeleteEventAndAllCertificates(eventId: ObjectId): Promise<IEventCertificate | null> {
    await connectToDatabase()
    const deletedDocument = await EventCertificateModel.findOneAndDelete({ _id: new ObjectId(eventId) }).lean();
    await CertificateModel.deleteMany({ eventId: eventId })



    const userId = await getUserId()
    const user = await auth0.getSession()


    const userName = await user?.user.nickname

    await CreateNewModificationHistory({
        modifiedElementId: new ObjectId(eventId),
        modifiedUserId: new ObjectId(userId),
        modifiedDocumentType: "event",
        userName: `${userName}`,
        modificationDate: new Date(),
        description: `O evento de ID: ${deletedDocument?._id}, de nome: ${deletedDocument?.eventName}, foi apagado em: ${new Date().toLocaleString()} pelo usuário de email: ${user?.user.email} e usuário: ${userName} e Identificação: ${userId}. A descrição do evento apagado era: " ${deletedDocument?.eventDescription} ". TODOS OS CERTIFICADOS ASSOCIADOS A ESSE EVENTO FORAM APAGADOS PERMANENTEMENTE JUNTO AO EVENTO.`,
        httpMethods: "delete"
    })

    return deletedDocument

}