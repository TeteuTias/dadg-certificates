import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import EventCertificateModel from "@/lib/models/EventCertificateModel";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ n: string }>;
  }
) {
  // Começar pela página 0.
  await connectToDatabase();

  const { n } = await params;

  const pageSize = 10;
  const page = Number(n || 0);

  const skip = page * pageSize;

  // total de documentos
  const total = await EventCertificateModel.countDocuments({
    isOpen: false,
  });

  // busca paginada
  const events = await EventCertificateModel.find({
    isOpen: false,
  })
    .skip(skip)
    .limit(pageSize);

  // quantos restam depois desse lote
  const remaining = Math.max(total - (skip + events.length), 0);

  return NextResponse.json({
    data: events,
    length: events.length,
    total,
    remaining,
    page,
  });
}