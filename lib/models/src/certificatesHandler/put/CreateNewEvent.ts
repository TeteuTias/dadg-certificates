import { IEventCertificate } from "@/lib/models/EventCertificateModel";
import { connectToDatabase } from "@/lib/mongodb";
import EventCertificateModel from "@/lib/models/EventCertificateModel";

export default async function CreateNewEvent(props: Omit<IEventCertificate, "_id">) {
    await connectToDatabase()
    const newData = await new EventCertificateModel({ ...props })
    await newData.save()

}