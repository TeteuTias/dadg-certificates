import { IEventCertificate } from "@/lib/models/EventCertificateModel";
import { connectToDatabase } from "@/lib/mongodb";
import EventCertificateModel from "@/lib/models/EventCertificateModel";
import CreateNewModificationHistory from "./CreateNewModificationHistory";
import { getUserId } from "@/lib/getUserId";
import { getSession } from "@/lib/auth/session";
import { ObjectId } from "mongodb";


//
//
export default async function CreateNewEvent(props: Omit<IEventCertificate, "_id">) {
    await connectToDatabase()
    const newData = await new EventCertificateModel({ ...props })
    const savedData = await newData.save()

    const userId = await getUserId()
    const user = await getSession()

    await CreateNewModificationHistory({
        modifiedElementId: new ObjectId(savedData._id),
        modifiedUserId: new ObjectId(userId),
        modifiedDocumentType: "certificate",
        userName: `${user?.user.name}`,
        modificationDate: new Date(),
        description: `Certificado criado pelo usuário de Id: ${userId} E com o nome: ${user?.user.name}. Os dados iniciais do certificado criado são: 
        \n Nome de Evento - ${savedData.eventName}
        \n Descrição de Evento - ${savedData.eventDescription} 
        `,
        httpMethods: "put"
    })

}