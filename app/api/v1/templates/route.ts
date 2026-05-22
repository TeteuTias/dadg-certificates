import { NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Inicializa o cliente fora da função para reaproveitar a conexão entre requisições
const s3Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT_URL!,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY!,
        secretAccessKey: process.env.R2_SECRET_KEY!,
    },
});

export async function GET() {
    try {
        const listCommand = new ListObjectsV2Command({
            Bucket: process.env.R2_BUCKET_NAME!,
            Delimiter: "/" // Garante que só pegue arquivos na raiz
        });

        const response = await s3Client.send(listCommand);

        if (!response.Contents) {
            return NextResponse.json({ success: true, documents: [] });
        }

        // Gerando URLs assinadas em paralelo
        const documents = await Promise.all(
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
                    key: item.Key,
                    size: item.Size,
                    lastModified: item.LastModified,
                    url,
                    isImage,
                };
            })
        );

        return NextResponse.json({ success: true, documents }, { status: 200 });

    } catch (error) {
        console.error("Erro na API ao listar documentos no R2:", error);
        return NextResponse.json(
            { success: false, error: "Falha ao listar documentos" },
            { status: 500 }
        );
    }
}