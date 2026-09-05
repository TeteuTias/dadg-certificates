import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
export function verifyMercadoPagoSignature(request: NextRequest, dataId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  const parts = new Map((request.headers.get('x-signature') || '').split(',').map(part => {
    const [key, ...value] = part.split('='); return [key.trim(), value.join('=').trim()];
  }));
  const ts = parts.get('ts'), hash = parts.get('v1');
  const requestId = request.headers.get('x-request-id');
  if (!ts || !/^\d+$/.test(ts) || !hash || !/^[0-9a-fA-F]{64}$/.test(hash) || !requestId) return false;
  // MP retries generate a fresh signature. Support seconds and milliseconds.
  const time = Number(ts) < 1e12 ? Number(ts) * 1000 : Number(ts);
  if (!Number.isFinite(time) || Math.abs(Date.now() - time) > 5 * 60_000) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(hash, 'hex'));
}
