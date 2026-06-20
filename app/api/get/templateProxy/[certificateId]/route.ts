/* eslint-disable */
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongodb";
import CertificateModel from "@/app/lib/models/CertificateModel";
import AWS from "aws-sdk";
import { IEventCertificate } from "@/app/lib/models/EventCertificateModel";
//  export async function GET(req: NextRequest, { params }: { params: { certificateId: string } }) {

export const dynamic = 'force-dynamic'

// Configuração do cliente R2
const s3 = new AWS.S3({
    endpoint: process.env.R2_ENDPOINT, // Substitua pelo endpoint do seu bucket
    accessKeyId: process.env.R2_ACCESS_KEY_ID, // Defina isso no .env.local
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    signatureVersion: 'v4',
});

const getSignedUrl = async (bucket: string, key: string): Promise<string | undefined> => {
    const params = { Bucket: bucket, Key: key }; // coloca a key aqui dps

    try {
        // Verifica se o arquivo existe
        await s3.headObject(params).promise();

        // Gera a URL assinada se o arquivo existir
        return s3.getSignedUrlPromise("getObject", { ...params, Expires: 60, });
    } catch (error) {
        // Verifica se o erro é uma instância de Error
        if (error instanceof Error) {
            // Trata erros específicos do S3
            if ((error as any).code === "NotFound" || (error as any).code === "NoSuchKey") {
                // console.warn(`Objeto não encontrado: bucket=${bucket}, key=${key}`);
                return undefined;
            }
            // Lança outros erros
            throw error;
        } else {
            // Lança erros desconhecidos
            throw new Error("Erro desconhecido ocorreu ao tentar gerar URL assinada.");
        }
    }
};

const getBufferByImageUrl = async (url: string): Promise<ArrayBuffer> => {
    const response = await fetch(url)
    if (!response.ok) throw new Error("Falha ao baixar o template");
    const buffer = await response.arrayBuffer()
    return buffer
};

// CertificateId => certificadoId|type; onde type é front ou verse, para determinar qual template o usuário quer baixar!

export async function GET(req: NextRequest, {
    params,
}: {
    params: Promise<{ certificateId: string }>
}) {

    await connectToDatabase()
    const { certificateId } = await params
    const typeTemplate = certificateId.split("|")[1]; // Pega o segundo valor após o pipe
    const searchValueId = certificateId.split("|")[0]; // Pega o primeiro valor antes do pipe

    if (!typeTemplate || (typeTemplate !== "front" && typeTemplate !== "verse")) {
        return Response.json({ message: "O parâmetro 'certificateId' deve conter um tipo válido (front ou verse)." }, { status: 500 });
    }
    if (!searchValueId || !mongoose.Types.ObjectId.isValid(searchValueId)) {
        return Response.json({ message: "O parâmetro 'certificateId' é obrigatório." }, { status: 500 });
    }


    const owners = await CertificateModel.findOne({
        _id: searchValueId
    }).populate<{ eventId: IEventCertificate }>("eventId");
    if (!owners) {
        return Response.json({ message: "Seu Certificado não foi encontrado. Entre em contato com o Suporte." }, { status: 500 });
    }

    if (typeTemplate === "verse" && (!owners.verse.showVerse || !owners.eventId.templateVersePath)) {
        return Response.json({ message: "Seu Certificado não possui Verso. Entre em contato com o Suporte." }, { status: 500 });
    }

    const templateLink = await getSignedUrl(process.env.R2_BUCKET_NAME ?? "", typeTemplate === "front" ? owners?.eventId.templatePath : owners?.eventId.templateVersePath || "")
    if (!templateLink) {
        throw new Error("Erro ao baixar seu Certificado")
    }
    const arrayBuffer = await getBufferByImageUrl(templateLink)
    return new Response(arrayBuffer, {
        headers: {
            'Content-Type': 'image/jpeg', // ou o tipo correto da sua imagem
            'Cache-Control': 'public, max-age=86400' // cache de 1 dia
        }
    })
}