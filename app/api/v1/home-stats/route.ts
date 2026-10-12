import { unstable_cache } from "next/cache";
import { connectToDatabase } from "@/lib/mongodb";
import Certificate from "@/lib/models/CertificateModel";
import Event from "@/lib/models/EventCertificateModel";
import League from "@/lib/models/AcademicLeagues";
const stats = unstable_cache(
  async () => {
    await connectToDatabase();
    const [certificadosEmitidos, eventosRealizados, coordenadoriasAtivas] =
      await Promise.all([
        Certificate.countDocuments({ isReady: true }),
        Event.countDocuments({ "statusDetails.status": { $ne: "DRAFT" } }),
        League.countDocuments(),
      ]);
    return { certificadosEmitidos, eventosRealizados, coordenadoriasAtivas };
  },
  ["public-stats-v2"],
  { revalidate: 300 },
);
export async function GET() {
  try {
    return Response.json(await stats());
  } catch {
    return Response.json(
      { error: "Estatísticas indisponíveis" },
      { status: 503 },
    );
  }
}
