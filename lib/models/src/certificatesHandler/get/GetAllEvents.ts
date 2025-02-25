import { IEventCertificate } from "@/lib/models/EventCertificateModel";
import EventCertificateModel from "@/lib/models/EventCertificateModel";
import { connectToDatabase } from "@/lib/mongodb";

export default async function GetAllEvents(): Promise<IEventCertificate[]> {
    await connectToDatabase()
    const data = EventCertificateModel.find({}).lean()
    return data
}