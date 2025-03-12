import { ICertificate } from "@/lib/models/CertificateModel";
import { connectToDatabase } from "@/lib/mongodb";
import CertificateModel from "@/lib/models/CertificateModel";
import { ObjectId } from "mongodb";
import CreateNewModificationHistory from "./CreateNewModificationHistory";
import { getUserId } from "@/lib/getUserId";
import { auth0 } from "@/lib/auth0";

export default async function CreateNewCertificate(props: Omit<ICertificate, "_id">): Promise<ObjectId> {
    await connectToDatabase()

    const newData = await new CertificateModel({ ...props })
    const data = await newData.save()
    const userId = await getUserId()
    const user = await auth0.getSession()


    await CreateNewModificationHistory({
        modifiedElementId: new ObjectId(data._id),
        modifiedUserId: new ObjectId(userId),
        modifiedDocumentType: "certificate",
        userName: `${user?.user.nickname}`,
        modificationDate: new Date(),
        description: `Certificado criado pelo usuário de Id: ${userId} E com o nome: ${user?.user.nickname}. Os dados iniciais do certificado criado são: 
        \n Identificação - ${data._id},
        \n Nome de usuário - ${data.ownerName}
        \n Cpf - ${data.ownerCpf}
        \n Nome de Evento - ${data.eventName}
        \n Email - ${data.ownerEmail}
        \n Horas - ${data.certificateHours}
        \n Tempalte Usado - ${data.certificatePath}
        \n Texto Superior [Frente] - ${data.frontTopperText}
        \n Texto Inferior [Frente] - ${data.frontBottomText}
        \n Identificação de Evento - ${data.eventId}
        `,
        httpMethods: "put"
    })

    return data._id
}