import { NextRequest, NextResponse } from 'next/server';
import GateKeeper from '@/lib/security/gatekeeper';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ applicationId: string }> };

// Endpoint placeholder: por enquanto, Ticket é criado junto com a Application via createApplicationAndTicketMock.
// Para manter o escopo do ADM, este endpoint será implementado como "no-op" apenas até termos o fluxo completo.
export async function POST(request: NextRequest, { params }: Context) {
  const access = await new GateKeeper(request).validate();
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message, code: access.code },
      { status: access.status || 403 }
    );
  }

  const { applicationId } = await params;
  return NextResponse.json(
    {
      success: false,
      error: 'TICKET_CREATED_DURING_APPLICATION_CREATION',
      applicationId,
    },
    { status: 400 }
  );
}
