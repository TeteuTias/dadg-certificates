import { withRouteAccess } from "@/lib/security/route-access";
import { NextRequest } from 'next/server';
import { checkoutRequest } from '@/lib/selective-processes/http';
export const dynamic = 'force-dynamic';
async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return checkoutRequest(request, (await params).id);
}

export const POST = withRouteAccess(POSTHandler);
