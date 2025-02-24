import { ICertificate } from "@/lib/models/CertificateModel";
import CertificateModel from "@/lib/models/CertificateModel";
import { connectToDatabase } from "@/lib/mongodb";
import { ICertificateWithEventPopulate } from "@/lib/models/CertificateModel";
//
//
export default async function GetAllCertificates():Promise<ICertificateWithEventPopulate[]> {
    await connectToDatabase()
    const data = await CertificateModel.find({}).populate<{ eventId: ICertificateWithEventPopulate['eventId'] }>("eventId").lean()
    return data
}