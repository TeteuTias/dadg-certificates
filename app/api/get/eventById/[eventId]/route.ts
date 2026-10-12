import { withRouteAccess } from "@/lib/security/route-access";
import { NextResponse } from "next/server";
import GetEvent from "@/lib/models/src/certificatesHandler/get/GetEvent";
import { ObjectId } from "mongodb";

export const dynamic = 'force-dynamic'

async function GETHandler(request: Request, { params }: { params: Promise<{ eventId: string }> }) {


    const eventId = (await params).eventId

    const data = await GetEvent(new ObjectId(eventId))
    if (!data) {
        return NextResponse.json({ message: "O certificado não foi encontrado." }, { status: 500 })
    }
    return NextResponse.json({ "data": data })
}

export const GET = withRouteAccess(GETHandler);
