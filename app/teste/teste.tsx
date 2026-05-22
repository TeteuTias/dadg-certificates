'use server'

import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT_URL!,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY!,
        secretAccessKey: process.env.R2_SECRET_KEY!,
    },
});

export type R2Document = {
    key: string;
    size: number;
    lastModified: Date;
    url: string;
    isImage: boolean;
};

export async function listR2Documents() {
    try {
        const listCommand = new ListObjectsV2Command({
            Bucket: process.env.R2_BUCKET_NAME!,
            Delimiter: "/"
        });

        const response = await s3Client.send(listCommand);

        if (!response.Contents) {
            return { success: true, documents: [] };
        }

        // Gerando URLs assinadas em paralelo para performance
        const documents: R2Document[] = await Promise.all(
            response.Contents.map(async (item) => {
                const getCommand = new GetObjectCommand({
                    Bucket: process.env.R2_BUCKET_NAME!,
                    Key: item.Key,
                });

                // URL válida por 1 hora (3600 segundos)
                const url = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

                // Verifica se é imagem pelas extensões mais comuns
                const isImage = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(item.Key || "");

                return {
                    key: item.Key as string,
                    size: item.Size as number,
                    lastModified: item.LastModified as Date,
                    url,
                    isImage,
                };
            })
        );
        return { success: true, documents };
    } catch (error) {
        console.error("Erro ao listar documentos no R2:", error);
        return { success: false, error: "Falha ao listar documentos" };
    }
}