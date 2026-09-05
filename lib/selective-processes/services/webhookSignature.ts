import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';

/**
 * Validacao da assinatura das notificacoes do Mercado Pago.
 *
 * O endpoint de webhook precisa ser publico (o Mercado Pago nao envia sessao
 * nem token do nosso Auth0), entao a assinatura e a unica barreira contra
 * alguem disparar notificacoes falsas.
 *
 * Enquanto MERCADOPAGO_WEBHOOK_SECRET nao estiver configurado a validacao fica
 * desligada, para nao derrubar o fluxo de quem ainda nao gerou o segredo no
 * painel do Mercado Pago (Suas integracoes > Webhooks).
 *
 * Formato do cabecalho x-signature: "ts=<timestamp>,v1=<hmac_sha256>"
 * Manifesto assinado: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 */
export function verifyMercadoPagoSignature(request: NextRequest, dataId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (!secret) return true;

  const signature = request.headers.get('x-signature');
  if (!signature) return false;

  const parts = new Map(
    signature.split(',').map((part) => {
      const [key, ...rest] = part.split('=');
      return [key.trim(), rest.join('=').trim()] as const;
    }),
  );

  const timestamp = parts.get('ts');
  const hash = parts.get('v1');
  if (!timestamp || !hash) return false;

  const requestId = request.headers.get('x-request-id') || '';
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(hash, 'hex');
  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
