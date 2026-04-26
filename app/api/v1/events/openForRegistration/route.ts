import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import EventCertificateModel from "@/lib/models/EventCertificateModel";

//  export async function GET(req: NextRequest, { params }: { params: { search: string } }) {

export const dynamic = 'force-dynamic'



export async function GET(req: NextRequest,) {
    await connectToDatabase()

    const events = await EventCertificateModel.find({
        isOpen: true, // Retorna os eventos que estão abertos ao público.
    })
    return NextResponse.json({ "data": events, length: events.length })
}