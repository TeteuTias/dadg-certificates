import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/security/verifyToken';
import { cookies } from "next/headers";
import EventCertificateModel, { IEventCertificate } from '@/lib/models/EventCertificate';

export async function GET(request: NextRequest) {

  try {

    // 🔐 Verificar autenticação

    let token =
      request.headers
        .get('Authorization')
        ?.replace('Bearer ', '');

    if (!token) {

      const cookieStore =
        await cookies();

      token =
        cookieStore
          .get('__session')
          ?.value;

    }

    if (!token) {

      return NextResponse.json(
        { error: 'Token não fornecido' },
        { status: 401 }
      );

    }

    const decoded =
      await verifyToken(token);

    if (!decoded) {

      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );

    }

    // 🔌 Conectar banco

    await connectToDatabase();

    // 🔎 Buscar TODOS eventos (sem filtro isOpen)

    const events =
      await EventCertificateModel
        .find({})
        .lean<IEventCertificate[]>();


    console.log(
      "Eventos encontrados:",
      events.length
    );


    // 📦 Formatar resposta

    const response =

      events.map(event => ({

        _id:
          event._id,

        eventName:
          event.eventName,

        eventDescription:
          event.eventDescription,

        eventType:
          event.eventType,

        templatePath:
          event.templatePath,

        templateVersePath:
          event.templateVersePath,

        documentVersion:
          event.documentVersion,

        registrationCount:
          event.registrationCount,

        maxParticipants:
          event.maxParticipants,

        isOpen:
          event.isOpen,

        isPaid:
          event.isPaid,

        price:
          event.isPaid
            ? event.price
            : undefined,

        // útil para frontend

        isFull:
          event.registrationCount >=
          event.maxParticipants,

        modalities:
          getModalitiesForEventType(
            event.eventType
          ),

      }));


    return NextResponse.json({

      success: true,

      data: response,

    });

  }

  catch (error) {

    console.error(
      'Erro ao buscar eventos:',
      error
    );

    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    );

  }

}


// Modalidades

function getModalitiesForEventType(
  eventType: string
) {

  const map: Record<string, any[]> = {

    Palestra: [
      {
        name: 'Palestra',
        code: 'palestra',
        description: 'Apresentação de palestra'
      }
    ],

    Workshop: [
      {
        name: 'Workshop',
        code: 'workshop',
        description: 'Oficina interativa'
      }
    ],

    Seminário: [
      {
        name: 'Seminário',
        code: 'seminario',
        description: 'Seminário acadêmico'
      }
    ],

    Conferência: [
      {
        name: 'Conferência',
        code: 'conferencia',
        description: 'Conferência'
      }
    ],

    Simpósio: [
      {
        name: 'Simpósio',
        code: 'simposio',
        description: 'Simpósio'
      }
    ],

  };

  return (

    map[eventType] ||

    [
      {
        name: 'Padrão',
        code: 'padrao',
        description: 'Modalidade padrão'
      }
    ]

  );

}