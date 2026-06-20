import AcademicLeagueModel from "../../AcademicLeagues";
import { connectToDatabase } from "@/app/lib/mongodb";
import { IAcademicLeague } from "../../AcademicLeagues";

//
//
export default async function GetAllNamesAndAcronym(): Promise<IAcademicLeague[]> {
    await connectToDatabase()
    const data = await AcademicLeagueModel.find<Pick<IAcademicLeague, "name" | "acronym" | "type">[]>({}, { name: 1, acronym: 1, type: 1 }).sort({ name: 1 }).lean()
    return data
}