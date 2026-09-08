import { NextRequest, NextResponse } from "next/server";
import GateKeeper from "@/lib/security/gatekeeper";
import { ClamError } from "@/lib/selective-processes/domain";
import { clamFailure } from "@/lib/selective-processes/errors";
import {
  readReport,
  summarize,
  confirmImport,
  saveReportSettings,
} from "@/lib/selective-processes/reports/service";
import {
  exportWorkbook,
  importTemplate,
  parseWorkbook,
} from "@/lib/selective-processes/reports/workbooks";
import {
  MAX_FILE_BYTES,
  previewImport,
} from "@/lib/selective-processes/reports/rules";
import type {
  ImportKind,
  ReportKind,
} from "@/lib/selective-processes/reports/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; action: string }> };
const headers = { "Cache-Control": "private, no-store" };
async function authorized(request: NextRequest) {
  const access = await new GateKeeper(request).validate();
  if (
    !access.authorized ||
    access.principal?.kind !== "admin" ||
    !access.principal.user.sub
  )
    throw new ClamError(access.code || "NOT_AUTHORIZED", access.status || 403);
  return `${access.principal.user.iss || ""}|${access.principal.user.sub}`;
}
function download(buffer: Buffer, name: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      ...headers,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
    },
  });
}
async function boundedBody(request: NextRequest, limit: number) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new ClamError("FILE_TOO_LARGE", 400);
  const reader = request.body?.getReader();
  if (!reader) throw new ClamError("INVALID_IMPORT", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new ClamError("FILE_TOO_LARGE", 400);
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function GET(request: NextRequest, context: Context) {
  try {
    await authorized(request);
    const { id, action } = await context.params;
    const snapshot = await readReport(id);
    if (action === "summary")
      return NextResponse.json(summarize(snapshot), { headers });
    const kind = request.nextUrl.searchParams.get("kind") || "";
    if (action === "template" && (kind === "days" || kind === "seats"))
      return download(
        await importTemplate(snapshot, kind),
        `modelo-${kind}-${id}`,
      );
    if (
      action === "export" &&
      ["all", "day1", "day2", "counts", "registrations", "scores"].includes(
        kind,
      )
    )
      return download(
        await exportWorkbook(
          snapshot,
          kind as ReportKind,
          request.nextUrl.searchParams.get("examId") || undefined,
        ),
        `clam-${kind}-${id}`,
      );
    throw new ClamError("INVALID_REPORT", 400);
  } catch (error) {
    return clamFailure(error);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const actor = await authorized(request);
    const { id, action } = await context.params;
    if (action === "settings")
      return NextResponse.json(
        await saveReportSettings(
          id,
          actor,
          JSON.parse(
            (await boundedBody(request, 1024 * 1024)).toString("utf8"),
          ),
        ),
        { headers },
      );
    if (!["preview", "confirm"].includes(action))
      throw new ClamError("INVALID_IMPORT", 400);
    const body = await boundedBody(request, MAX_FILE_BYTES + 65536);
    const form = await new Response(new Uint8Array(body), {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
    const file = form.get("file");
    const kind = String(form.get("kind")) as ImportKind;
    if (
      !(file instanceof File) ||
      !file.name.toLowerCase().endsWith(".xlsx") ||
      file.size > MAX_FILE_BYTES ||
      !["days", "seats", "scores"].includes(kind)
    )
      throw new ClamError("INVALID_XLSX", 400);
    const rows = await parseWorkbook(
      new Uint8Array(await file.arrayBuffer()),
      kind,
      id,
    );
    if (action === "preview")
      return NextResponse.json(
        previewImport(await readReport(id), kind, rows),
        { headers },
      );
    return NextResponse.json(
      await confirmImport({
        processId: id,
        actor,
        rows,
        kind,
        previewHash: String(form.get("previewHash") || ""),
        operationId: request.headers.get("idempotency-key") || "",
      }),
      { headers },
    );
  } catch (error) {
    return clamFailure(error);
  }
}
