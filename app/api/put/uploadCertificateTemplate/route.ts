import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import ScanTemplate from "@/lib/models/ScanTemplate";
import { connectToDatabase } from "@/lib/mongodb";
import { r2 } from "@/lib/certificates/storage";
import { templateFormat } from "@/lib/certificates/file-validation";
export const POST = withRouteAccess(async (request: NextRequest) => {
  if (Number(request.headers.get("content-length")) > 11 * 1024 * 1024)
    return Response.json({ message: "Arquivo muito grande." }, { status: 413 });
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || file.size > 10 * 1024 * 1024)
    return Response.json(
      { message: "Envie um arquivo de até 10 MB." },
      { status: 400 },
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  let format;
  try {
    format = templateFormat(bytes);
    if (format.extension === "pdf") {
      const pdf = await PDFDocument.load(bytes);
      if (pdf.getPageCount() < 1 || pdf.getPageCount() > 50)
        throw new Error("O PDF deve ter de 1 a 50 páginas.");
    } else {
      await sharp(bytes, { limitInputPixels: 40000000, failOn: "warning" })
        .png()
        .toBuffer();
    }
  } catch (e) {
    return Response.json({ message: (e as Error).message }, { status: 400 });
  }
  const template = new ScanTemplate({ templateExtension: format.extension });
  const key = `${process.env.R2_SUBFOLDER}/${template._id}.${format.extension}`;
  const client = r2();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: bytes,
      ContentType: format.mime,
    }),
  );
  try {
    await connectToDatabase();
    await template.save();
  } catch (e) {
    await client.send(
      new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }),
    );
    throw e;
  }
  return Response.json({
    message: "Arquivo enviado.",
    fileId: String(template._id),
  });
});
