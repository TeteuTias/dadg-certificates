import { withRouteAccess } from "@/lib/security/route-access";

import { NextRequest } from "next/server";
import ScanTemplateModel from "@/lib/models/ScanTemplate";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import CertificateModel from "@/lib/models/CertificateModel";
import { getSignedUrl } from "@/lib/certificates/storage";
import { ObjectId } from "bson";
import { IEventCertificate } from "@/lib/models/EventCertificateModel";
//  async function GETHandler(req: NextRequest, { params }: { params: { search: string } }) {

export const dynamic = "force-dynamic";

// Configuração do cliente R2

const getMimeType = (extension: string): string => {
  switch (extension.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
};

const getBufferByImageUrl = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Falha ao baixar o template");
  const buffer = await response.arrayBuffer();
  return buffer;
};

// search => certificadoId|type; onde type é front ou verse, para determinar qual template o usuário quer baixar!

async function GETHandler(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ search: string }>;
  },
) {
  try {
    const { search } = await params;
    const typeTemplate = search.split("|")[1]; // Pega o segundo valor após o pipe
    const searchValueId = search.split("|")[0]; // Pega o primeiro valor antes do pipe

    if (
      ObjectId.isValid(searchValueId) &&
      (!typeTemplate || typeTemplate === "front")
    ) {
      // procurando o template

      await connectToDatabase();
      const published = await CertificateModel.exists({
        certificatePath: searchValueId,
        isReady: true,
      });
      if (!published && !typeTemplate)
        return Response.json(
          { message: "Certificado não liberado." },
          { status: 404 },
        );
      if (published) {
        const template = await ScanTemplateModel.findOne({
          _id: new ObjectId(searchValueId),
        });

        if (!template) {
          return Response.json(
            { message: "Template não encontrado." },
            { status: 404 },
          );
        }
        await connectToDatabase();
        const templateLink = await getSignedUrl(
          process.env.R2_BUCKET_NAME ?? "",
          `${process.env.R2_SUBFOLDER}/${template._id}.${template.templateExtension}`,
        );
        if (!templateLink) {
          throw new Error("Erro ao baixar seu Certificado");
        }
        const arrayBuffer = await getBufferByImageUrl(templateLink);
        return new Response(arrayBuffer, {
          headers: {
            "Content-Type": getMimeType(template.templateExtension),
            "Cache-Control": "private, no-store", // cache de 1 dia
          },
        });
      }
    }
    if (
      !typeTemplate ||
      (typeTemplate !== "front" && typeTemplate !== "verse")
    ) {
      return Response.json(
        {
          message:
            "O parâmetro 'search' deve conter um tipo válido (front ou verse).",
        },
        { status: 500 },
      );
    }
    if (!searchValueId || !mongoose.Types.ObjectId.isValid(searchValueId)) {
      return Response.json(
        { message: "O parâmetro 'search' é obrigatório." },
        { status: 500 },
      );
    }
    //

    //
    await connectToDatabase();
    const owners = await CertificateModel.findOne({
      _id: searchValueId,
      isReady: true,
    }).populate<{ eventId: IEventCertificate }>("eventId");
    if (!owners) {
      return Response.json(
        {
          message:
            "Seu Certificado não foi encontrado. Entre em contato com o Suporte.",
        },
        { status: 500 },
      );
    }

    if (
      typeTemplate === "verse" &&
      (!owners.verse.showVerse || !owners.eventId.templateVersePath)
    ) {
      return Response.json(
        {
          message:
            "Seu Certificado não possui Verso. Entre em contato com o Suporte.",
        },
        { status: 500 },
      );
    }

    const templateLink = await getSignedUrl(
      process.env.R2_BUCKET_NAME ?? "",
      typeTemplate === "front"
        ? owners?.eventId.templatePath
        : owners?.eventId.templateVersePath || "",
    );
    if (!templateLink) {
      throw new Error("Erro ao baixar seu Certificado");
    }
    const arrayBuffer = await getBufferByImageUrl(templateLink);
    return new Response(arrayBuffer, {
      headers: {
        "Content-Type": "image/jpeg", // ou o tipo correto da sua imagem
        "Cache-Control": "private, no-store", // cache de 1 dia
      },
    });
  } catch (err) {
    return Response.json(
      { message: err instanceof Error ? err.message : "ERROR" },
      { status: 500 },
    );
  }
}
export const GET = withRouteAccess(GETHandler);
