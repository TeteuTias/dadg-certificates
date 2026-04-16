import { NextResponse } from "next/server"
import GetAllEvents from "@/lib/models/src/certificatesHandler/get/GetAllEvents"

export const dynamic = 'force-dynamic'


export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "48");
    const search = searchParams.get("search") || "";

    const data = await GetAllEvents({
        page,
        limit,
        search,
    });

    return NextResponse.json(data)
}
