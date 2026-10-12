import { withRouteAccess } from "@/lib/security/route-access";
import { NextResponse } from "next/server";
import GetAllCertificatesWithPopulateByEventId from "@/lib/models/src/certificatesHandler/get/GetAllCertificatesWithPopulateByEventId";

export const dynamic = 'force-dynamic'

async function GETHandler(request: Request) {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "60");
    const search = searchParams.get("search") || "";

    const data = await GetAllCertificatesWithPopulateByEventId({
        page,
        limit,
        search,
    });

    return NextResponse.json(data)
}

export const GET = withRouteAccess(GETHandler);
