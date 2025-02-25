import { ObjectId } from "mongodb"
import EventCertificateModel from "@/lib/models/EventCertificateModel"
import { IEventCertificate } from "@/lib/models/EventCertificateModel"
import { connectToDatabase } from "@/lib/mongodb"
//
//
export default async function GetEvent(eventId: ObjectId): Promise<IEventCertificate | null> {

    await connectToDatabase
    const data = await EventCertificateModel.findOne({
        _id: eventId
    })

    return data
}