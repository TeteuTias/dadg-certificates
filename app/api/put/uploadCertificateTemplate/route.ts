import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import ScanTemplateModel from '@/lib/models/ScanTemplate';
import { connectToDatabase } from '@/lib/mongodb';

//
const s3Client = new S3Client({
    // O 'region' é obrigatório, 'auto' é o valor correto para o R2.
    region: 'auto',

    // Usando a URL completa do endpoint diretamente.
    endpoint: process.env.R2_ENDPOINT_URL!,

    // Usando as novas chaves para as credenciais.
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY!,
        secretAccessKey: process.env.R2_SECRET_KEY!,
    },
});

export async function POST(request: Request) {
    //
    //

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
        return new Response(JSON.stringify({ message: 'No file uploaded' }), { status: 400 });
    }
    //
    //
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    //
    await connectToDatabase()
    const scanTemplate = new ScanTemplateModel({
        // Preencha os campos necessários para o modelo
        templateExtension: file.name.split(".").reverse()[0]
    });
    await scanTemplate.save();

    const filename = `${scanTemplate.id.toString()}.${file.name.split(".").reverse()[0]}`;
    const putCommand = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: `${process.env.R2_SUBFOLDER}/${filename}`,
        Body: buffer,
        ContentType: file.type,
    });

    await s3Client.send(putCommand);

    // Aqui você pode processar o arquivo, salvá-lo em um armazenamento, etc.
    // Por simplicidade, vamos apenas retornar o nome do arquivo.

    return new Response(JSON.stringify({ message: 'File uploaded successfully', fileId: `${scanTemplate._id}` }), { status: 200 });
}