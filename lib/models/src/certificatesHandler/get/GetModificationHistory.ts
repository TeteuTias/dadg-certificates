import { connectToDatabase } from "@/lib/mongodb";
import ModificationHistoryModel from "@/lib/models/ModificationHistoryModel";
import { IModificationHistory } from "@/lib/models/ModificationHistoryModel";
//
//
export default async function GetModificationHistory(): Promise<IModificationHistory[]> {
    await connectToDatabase()
    const data = await ModificationHistoryModel.find({})

    
    return data
}