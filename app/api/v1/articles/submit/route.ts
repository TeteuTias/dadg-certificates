import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import ArticleProjectModel from '@/lib/models/ArticleProjectModel';
import EventCertificateModel, { IEventCertificate } from '@/lib/models/EventCertificate';
import { verifyToken } from '@/lib/security/verifyToken';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

// Cliente R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || '',
    secretAccessKey: process.env.R2_SECRET_KEY || '',
  },
});

export async function POST(request: NextRequest) {

  try {

    // 🔐 Auth
    const token = request.headers
      .get('Authorization')
      ?.replace('Bearer ', '');

    if (!token) {

      return NextResponse.json(
        { error: 'Token não fornecido' },
        { status: 401 }
      );

    }

    const decoded = await verifyToken(token);

    if (!decoded) {

      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );

    }

    await connectToDatabase();

    // 📥 FormData
    const formData = await request.formData();

    const file = formData.get('file') as File;
    const eventId = formData.get('event_id') as string;
    const modality = formData.get('modality') as string;
    const projectName = formData.get('project_name') as string;

    if (
      !file ||
      !eventId ||
      !modality ||
      !projectName
    ) {

      return NextResponse.json(
        { error: 'Campos obrigatórios não fornecidos' },
        { status: 400 }
      );

    }

    // 🔎 Buscar evento
    if (!mongoose.Types.ObjectId.isValid(eventId)) {

      return NextResponse.json(
        { error: 'ID de evento inválido' },
        { status: 400 }
      );

    }

    const event = await EventCertificateModel
      .findById(eventId)
      .lean<IEventCertificate>();

    if (!event) {

      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      );

    }

    // 🔒 Verificar abertura
    if (!event.isOpen) {

      return NextResponse.json(
        { error: 'Evento fechado' },
        { status: 400 }
      );

    }

    // 👥 Verificar vagas
    if (
      event.registrationCount >=
      event.maxParticipants
    ) {

      return NextResponse.json(
        { error: 'Evento lotado' },
        { status: 400 }
      );

    }

    // 💰 PaymentOptions
    if (event.isPaid && !event.price) {

      return NextResponse.json(
        { error: 'Evento pago sem preço' },
        { status: 500 }
      );

    }

    // 📄 Converter arquivo
    const buffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(buffer);

    // 🧾 Nome único
    const extension =
      file.name.split('.').pop();

    const fileName =
      `${uuidv4()}.${extension}`;

    const filePath =
      `trabalhos-dadg/${eventId}/${fileName}`;

    // ☁️ Upload
    await s3Client.send(

      new PutObjectCommand({

        Bucket:
          process.env.R2_BUCKET_NAME ||
          'dadgcertificados',

        Key: filePath,

        Body: fileBuffer,

        ContentType: file.type,

      })

    );

    const fileUrl =
      `${process.env.R2_ENDPOINT_URL}/${filePath}`;

    // 📦 Criar projeto
    const articleProject =
      new ArticleProjectModel({

        Modalidade: modality,

        Nome_do_projeto: projectName,

        event_id: eventId,

        file_url: fileUrl,

      });

    await articleProject.save();

    // 📊 Incrementar contador
    await EventCertificateModel.updateOne(

      { _id: eventId },

      {
        $inc: {
          registrationCount: 1
        }
      }

    );

    return NextResponse.json({

      success: true,

      message: 'Submissão realizada',

      data: {

        project_id:
          articleProject._id,

        file_url: fileUrl,

        eventName:
          event.eventName,

        documentVersion:
          event.documentVersion,

      }

    });

  } catch (error) {

    console.error(
      'Erro ao submeter:',
      error
    );

    return NextResponse.json(

      { error: 'Erro interno' },

      { status: 500 }

    );

  }

}