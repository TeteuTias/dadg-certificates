import { withRouteAccess } from "@/lib/security/route-access";
import { NextResponse } from "next/server";
import GetCertificate from "@/lib/models/src/certificatesHandler/get/GetCertificate";
import { ObjectId } from "mongodb";

export const dynamic = 'force-dynamic'

async function GETHandler(request: Request, { params }: { params: Promise<{ certificateId: string }> }) {


    const certificateId = (await params).certificateId
    console.log(certificateId)
    const data = await GetCertificate(new ObjectId(certificateId))
    if (!data) {
        return NextResponse.json({message:"O certificado não foi encontrado."},{status:500})
    }
    return NextResponse.json({ "data": data })
}

export const GET = withRouteAccess(GETHandler);
