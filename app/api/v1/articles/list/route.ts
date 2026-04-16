import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import ArticleProjectModel from '@/lib/models/ArticleProjectModel';
import { verifyToken } from '@/lib/security/verifyToken';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
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

    // Conectar ao banco de dados
    await connectToDatabase();

    // Buscar query parameter event_id
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    let query: any = {};
    if (eventId) {
      query.event_id = eventId;
    }

    // Buscar todos os trabalhos submetidos
    const articles = await ArticleProjectModel.find(query)
      .populate('event_id', 'eventName')
      .sort({ created_at: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: articles,
    });
  } catch (error) {
    console.error('Erro ao listar trabalhos:', error);
    return NextResponse.json(
      { error: 'Erro ao listar trabalhos' },
      { status: 500 }
    );
  }
}
