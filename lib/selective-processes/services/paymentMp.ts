import mercadopago from 'mercadopago';

export type CreateMpPreferenceInput = {
  // Campos livres que você pode mapear conforme o fluxo de inscrição.
  externalReference: string; // ex: session compraId
  items: Array<{
    title: string;
    quantity: number;
    unit_price: number;
  }>;
  payer: {
    email: string;
    identification?: {
      type?: string;
      number?: string;
    };
    first_name?: string;
    last_name?: string;
  };
  backUrls?: {
    success?: string;
    pending?: string;
    failure?: string;
  };
};

export type CreateMpPreferenceOutput = {
  init_point: string;
  checkoutId: string;
};

export async function createCheckoutProPreference(
  input: CreateMpPreferenceInput
): Promise<CreateMpPreferenceOutput> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN_NOT_SET');

  mercadopago.configure({ access_token: accessToken });

  // A SDK do Mercado Pago varia conforme versão; mantemos um formato genérico.
  const preferenceData: any = {
    external_reference: input.externalReference,
    items: input.items,
    payer: {
      email: input.payer.email,
      identification: input.payer.identification,
      first_name: input.payer.first_name,
      last_name: input.payer.last_name,
    },
    notification_url:
      process.env.MERCADOPAGO_WEBHOOK_URL ||
      `${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/admin/selective-processes/payments/webhook`,
    back_urls: {
      success: input.backUrls?.success,
      pending: input.backUrls?.pending,
      failure: input.backUrls?.failure,
    },
    auto_return: 'approved',
  };

  const response = await (mercadopago.preferences as any).create(preferenceData);

  const pref = response?.body?.response ?? response?.body;
  const init_point = pref?.init_point;
  const checkoutId = pref?.id;

  if (!init_point || !checkoutId) {
    throw new Error('MERCADOPAGO_PREFERENCE_CREATE_FAILED');
  }

  return { init_point, checkoutId };
}
