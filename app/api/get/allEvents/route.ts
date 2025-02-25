import { NextResponse } from "next/server"
import GetAllEvents from "@/lib/models/src/certificatesHandler/get/GetAllEvents"

export const dynamic = 'force-dynamic'


export async function GET() {
    const data = await GetAllEvents()
    return NextResponse.json({ data: data })
}