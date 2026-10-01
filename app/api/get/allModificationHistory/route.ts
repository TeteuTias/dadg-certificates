import { withRouteAccess } from "@/lib/security/route-access";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GetModificationHistory from "@/lib/models/src/certificatesHandler/get/GetModificationHistory";


//
async function GETHandler() {
    await connectToDatabase()
    const data = await GetModificationHistory()
    return NextResponse.json({ data: data })

}
export const GET = withRouteAccess(GETHandler);
