import GetAllNamesAndAcronym from "@/app/lib/models/src/AcademicLeagues/GetAllNamesAndAcronym";

//
//
export async function GET() {
    const data = await GetAllNamesAndAcronym()
    return Response.json({ data: data })
}