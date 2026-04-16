import { connectToDatabase } from "@/lib/mongodb";
import AcademicLeagueModel, { IAcademicLeague } from "@/lib/models/AcademicLeagues";
//
//
export async function GET() {
    await connectToDatabase()
    const data = await AcademicLeagueModel.find<Pick<IAcademicLeague, "name" | "acronym" | "type">[]>({}, { name: 1, acronym: 1, type: 1 }).sort({ name: 1 }).lean()
    return Response.json({ data: data })
}