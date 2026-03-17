import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!start || !end) {
        console.log('Parâmetros de data ausentes');
        return NextResponse.json({ items: [] });
    }

    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    const apiKey = process.env.GOOGLE_API_KEY;

    console.log('Configurações:', {
        calendarId: calendarId ? 'Configurado' : 'Não configurado',
        apiKey: apiKey ? 'Configurado' : 'Não configurado',
        start,
        end
    });

    if (!calendarId || !apiKey) {
        console.error('Variáveis de ambiente não configuradas:', { 
            calendarId: calendarId ? 'Configurado' : 'Não configurado',
            apiKey: apiKey ? 'Configurado' : 'Não configurado'
        });
        return NextResponse.json({ items: [] });
    }

    try {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
            calendarId
        )}/events?key=${apiKey}&timeMin=${start}&timeMax=${end}&singleEvents=true&orderBy=startTime`;

        console.log('Fazendo requisição para:', url);

        const res = await fetch(url);

        if (!res.ok) {
            const errorData = await res.text();
            console.error('Erro na resposta da API:', {
                status: res.status,
                statusText: res.statusText,
                error: errorData
            });
            return NextResponse.json({ items: [] });
        }

        const data = await res.json();
        console.log('Eventos encontrados:', data.items?.length || 0);
        return NextResponse.json(data);
    } catch (error) {
        console.error('Erro ao buscar eventos:', error);
        return NextResponse.json({ items: [] });
    }
}

//Filtre por data via query: ?date=2026-03-15