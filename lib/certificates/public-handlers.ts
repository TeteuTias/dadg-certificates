import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Certificate from "@/lib/models/CertificateModel";
import { certificateSearch, publicCertificate } from "./public-contract";
const headers = { "Cache-Control": "no-store" };
export async function searchCertificates(
  request: NextRequest,
  { params }: { params: Promise<{ search: string }> },
) {
  let filter;
  try {
    filter = certificateSearch((await params).search);
  } catch (error) {
    return Response.json(
      { message: (error as Error).message },
      { status: 400, headers },
    );
  }
  const page = Math.min(
    100,
    Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1),
  );
  if (!Number.isInteger(page))
    return Response.json(
      { message: "Página inválida." },
      { status: 400, headers },
    );
  await connectToDatabase();
  const rows = await Certificate.find(filter)
    .select("_id ownerName eventName")
    .sort({ _id: 1 })
    .skip((page - 1) * 30)
    .limit(31)
    .maxTimeMS(3000)
    .lean();
  return Response.json(
    { data: rows.slice(0, 30), page, hasMore: rows.length > 30 && page < 100 },
    { headers },
  );
}
export async function certificateDetails(
  _request: NextRequest,
  { params }: { params: Promise<{ search: string }> },
) {
  const { search } = await params;
  if (!/^[0-9a-f]{24}$/i.test(search))
    return Response.json(
      { message: "Código inválido." },
      { status: 400, headers },
    );
  await connectToDatabase();
  const certificate = await Certificate.findOne({ _id: search, isReady: true })
    .populate("eventId")
    .lean();
  if (!certificate || !certificate.eventId)
    return Response.json(
      { message: "Certificado não encontrado ou ainda não liberado." },
      { status: 404, headers },
    );
  return Response.json(
    {
      data: publicCertificate(
        certificate as unknown as Record<string, unknown>,
      ),
    },
    { headers },
  );
}
