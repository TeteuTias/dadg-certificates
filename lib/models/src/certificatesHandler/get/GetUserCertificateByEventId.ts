"use server";
import CertificateModel, { ICertificate } from "@/lib/models/CertificateModel";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "bson";

export default async function GetUserCertificateByEventId(
    eventId: string | ObjectId, // Aceitar string facilita a chamada do Client
): Promise<any | null> {
    await connectToDatabase();

    const certificate = await CertificateModel.findOne({
        eventId: new ObjectId(eventId),
    }).lean();

    if (!certificate) {
        return null;
    }

    // Criamos um objeto novo "limpo" para o Client
    return {
        ...certificate,
        _id: certificate._id.toString(),
        eventId: certificate.eventId.toString(),
        // Se houver campos de data, converta-os também:
        // createdAt: certificate.createdAt?.toISOString(),
    };
}