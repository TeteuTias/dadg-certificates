import CertificateModel from "@/lib/models/CertificateModel";
import { ICertificateWithEventPopulate } from "@/lib/models/CertificateModel";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export default async function GetCertificate(certificateId: ObjectId): Promise<ICertificateWithEventPopulate | null> {

    await connectToDatabase()
    const data = await CertificateModel.findOne({ _id: certificateId }).populate<{ eventId: ICertificateWithEventPopulate['eventId'] }>("eventId").lean()
    return data

}