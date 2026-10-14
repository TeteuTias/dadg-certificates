import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { eventIdentity } from "@/lib/events/identity";
import { EventError } from "@/lib/events/rules";
import Certificate from "@/lib/models/CertificateModel";
import { CertificateNote, ExternalCertificate } from "@/lib/organizer/models";
import {
  ORGANIZER_TYPES,
  QUOTA_BYTES,
  QUOTA_FILES,
  organizerTotals,
  parseHours,
} from "@/lib/organizer/rules";

const headers = { "Cache-Control": "private, no-store" };

/** Organizador do aluno: certificados do DADG vinculados, anotações, envios próprios e totais por tipo. */
export const GET = withRouteAccess(async (request: NextRequest) => {
  try {
    const { profile } = await eventIdentity(request, false);
    const [certificates, notes, uploads] = await Promise.all([
      Certificate.find({ profileId: profile._id, isReady: true })
        .select("_id eventName certificateHours")
        .sort({ _id: -1 })
        .limit(1000)
        .lean(),
      CertificateNote.find({ profileId: profile._id }).select("certificateId type hours").lean(),
      ExternalCertificate.find({ profileId: profile._id })
        .select("title type institution date hours fileSize createdAt")
        .sort({ date: -1, createdAt: -1 })
        .limit(QUOTA_FILES)
        .lean(),
    ]);
    const noteBy = new Map(notes.map((n) => [String(n.certificateId), n]));
    const dadg = certificates.map((c) => {
      const note = noteBy.get(String(c._id));
      return {
        certificateId: String(c._id),
        eventName: c.eventName,
        officialHoursText: c.certificateHours || "",
        officialHours: parseHours(c.certificateHours),
        note: note ? { type: note.type ?? null, hours: note.hours ?? null } : null,
      };
    });
    const external = uploads.map((u) => ({
      id: String(u._id),
      title: u.title,
      type: u.type,
      institution: u.institution || "",
      date: u.date || "",
      hours: u.hours,
      fileSize: u.fileSize,
    }));
    return Response.json(
      {
        types: ORGANIZER_TYPES,
        dadg,
        external,
        totals: organizerTotals(dadg, external),
        usage: {
          bytes: external.reduce((sum, u) => sum + u.fileSize, 0),
          files: external.length,
          quotaBytes: QUOTA_BYTES,
          quotaFiles: QUOTA_FILES,
        },
      },
      { headers },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof EventError ? e.message : "Não foi possível carregar o organizador." },
      { status: e instanceof EventError ? e.status : 500, headers },
    );
  }
});
