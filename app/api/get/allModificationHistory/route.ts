import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GetModificationHistory from "@/lib/models/src/certificatesHandler/get/GetModificationHistory";


//
export async function GET() {
    await connectToDatabase()
    const data = await GetModificationHistory()
    return NextResponse.json({ data: data })

}