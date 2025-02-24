import { NextResponse } from "next/server";
import GetAllCertificates from "@/lib/models/src/certificatesHandler/get/GetAllCertificates";

export async function GET() {
    const data = await GetAllCertificates()
    return NextResponse.json({ data: data })
}