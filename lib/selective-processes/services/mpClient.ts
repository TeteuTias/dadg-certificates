import { MercadoPagoConfig, Payment } from 'mercadopago';

export function getMpClient() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN_NOT_SET');
  }

  const client = new MercadoPagoConfig({
    accessToken,
    options: { timeout: 5000 },
  });

  return {
    config: client,
    payments: new Payment(client),
  };
}
