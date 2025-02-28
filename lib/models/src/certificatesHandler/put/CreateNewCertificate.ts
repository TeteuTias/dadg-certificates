import { ICertificate } from "@/lib/models/CertificateModel";
import { connectToDatabase } from "@/lib/mongodb";
import CertificateModel from "@/lib/models/CertificateModel";
import { ObjectId } from "mongodb";


export default async function CreateNewCertificate(props: Omit<ICertificate, "_id">): Promise<ObjectId> {
    await connectToDatabase()
    const newData = await new CertificateModel({ ...props })
    const data = await newData.save()
    return data._id
}