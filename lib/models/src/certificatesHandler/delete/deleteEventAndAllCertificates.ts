import EventCertificateModel from "@/lib/models/EventCertificateModel";
import CertificateModel from "@/lib/models/CertificateModel";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";
//
//
export async function DeleteEventAndAllCertificates(eventId: ObjectId) {
    await connectToDatabase()
    await EventCertificateModel.deleteOne({ _id: eventId })
    await CertificateModel.deleteOne({ eventId: eventId })

}