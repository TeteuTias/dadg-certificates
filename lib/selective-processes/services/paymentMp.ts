export type CreateMpPreferenceInput = {
  externalReference: string;
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
  expiresAt: string;
};

async function postJson<T>(url: string, body: unknown, accessToken: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg = json?.message || json?.error || text || `HTTP_${res.status}`;
    throw new Error(`MERCADOPAGO_PREFERENCE_CREATE_FAILED: ${msg}`);
  }

  return json as T;
}

export async function createCheckoutProPreference(
  input: CreateMpPreferenceInput
): Promise<CreateMpPreferenceOutput> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN_NOT_SET');

  // Endpoint oficial (preferencias de checkout)
  const url = `${process.env.MERCADOPAGO_BASE_API || ""}/checkout/preferences`;
  // Soma 15 minutos para o FIM


  const preferenceData: any = {
    items: input.items.map((i) => ({
      title: i.title,
      quantity: i.quantity,
      unit_price: i.unit_price,
    })),
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
    external_reference: input.externalReference,
    //expiration_date_from: expiration_date_from,
    expires: true,
    expiration_date_to: getExpirationDateTo(15),
  };

  const response = await postJson<any>(url, preferenceData, accessToken);
  // Shape esperado no retorno:
  // { init_point: string, id: string, ... }
  const init_point: string | undefined = response?.init_point;
  const checkoutId: string | undefined = response?.id;

  if (!init_point || !checkoutId) {
    throw new Error('MERCADOPAGO_PREFERENCE_CREATE_FAILED');
  }

  return { init_point, checkoutId, expiresAt: response.expiration_date_to };
}

function getExpirationDateTo(minutesAhead = 15) {
  const date = new Date(Date.now() + minutesAhead * 60 * 1000);

  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false,
  });

  const formatted = formatter.format(date).replace(' ', 'T').replace(',', '.');
  return `${formatted}-03:00`;
}