import {
  applyMpWebhookUpdate,
  getMpCheckoutIdFromBody,
  getMpWebhookStatusFromBody,
} from './paymentSessions';

export async function handleMpWebhook(body: any): Promise<{ received: boolean }> {
  // TODO: validar assinatura do webhook do Mercado Pago
  const checkoutId = getMpCheckoutIdFromBody(body);
  const mpStatus = getMpWebhookStatusFromBody(body);

  if (!checkoutId || !mpStatus) {
    return { received: false };
  }

  await applyMpWebhookUpdate({ checkoutId, mpStatus });

  return { received: true };
}
