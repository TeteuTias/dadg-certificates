import { NextResponse } from "next/server";
import GetAllCertificatesWithPopulateByEventId from "@/lib/models/src/certificatesHandler/get/GetAllCertificatesWithPopulateByEventId";

export const dynamic = 'force-dynamic'

export async function GET() {
    const data = await GetAllCertificatesWithPopulateByEventId()
    return NextResponse.json({ data: data })
}