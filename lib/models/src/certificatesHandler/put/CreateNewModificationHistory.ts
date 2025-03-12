import { connectToDatabase } from "@/lib/mongodb";
import ModificationHistoryModel from "@/lib/models/ModificationHistoryModel";
import { IModificationHistory } from "@/lib/models/ModificationHistoryModel";
//
//
export default async function CreateNewModificationHistory(props: Omit<IModificationHistory, "_id">) {
    await connectToDatabase()

    const newData = await new ModificationHistoryModel({
        ...props
    })

    await newData.save()

}