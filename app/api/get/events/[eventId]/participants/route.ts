import { NextRequest, NextResponse } from 'next/server';


interface RouteParams {
    params: {
        eventId: string;
    };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        // const { eventId } = await params;

        return NextResponse.json({ data: [] }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ success: false, error: 'Erro ao buscar participantes' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        return NextResponse.json({}, { status: 201 });

    } catch (error) {
        return NextResponse.json({ success: false, error: 'Erro ao inscrever usuário' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        return NextResponse.json({}, { status: 200 });

    } catch (error) {
        return NextResponse.json({ success: false, error: 'Erro ao atualizar inscrição' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        return NextResponse.json({}, { status: 200 });

    } catch (error) {
        return NextResponse.json({ success: false, error: 'Erro ao remover inscrição' }, { status: 500 });
    }
}