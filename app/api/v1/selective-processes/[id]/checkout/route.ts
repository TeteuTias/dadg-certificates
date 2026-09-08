import { NextRequest } from 'next/server';
import { checkoutRequest } from '@/lib/selective-processes/http';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return checkoutRequest(request, (await params).id);
}
