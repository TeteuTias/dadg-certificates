import { withRouteAccess } from "@/lib/security/route-access";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import EventCertificateModel from "@/lib/models/EventCertificateModel";

//  async function GETHandler(req: NextRequest, { params }: { params: { search: string } }) {

export const dynamic = 'force-dynamic'



async function GETHandler(req: NextRequest, {
    params,
}: {
    params: Promise<{ id: string }>
}) {

    await connectToDatabase()
    const { id } = await params
    const searchId = id
    if (!searchId) {
        return Response.json({ message: "O parâmetro 'id' é obrigatório." }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(searchId)) {
        return Response.json({ message: "O parâmetro 'id' é obrigatoriamente um ObjectId." }, { status: 422 });
    }


    const events = await EventCertificateModel.findOne({
        _id: searchId,
        archivedAt: { $exists: false }, "statusDetails.status": { $ne: "DRAFT" },
    })
    return NextResponse.json({ "data": events, })
}
export const GET = withRouteAccess(GETHandler);
