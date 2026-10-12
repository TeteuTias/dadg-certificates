import test from 'node:test';
import assert from 'node:assert/strict';
import { MpGateway } from '../lib/selective-processes/services/gateway';
test('provider closure verifies preference and every pending payment before replacement', async () => {
  const originalFetch = global.fetch, token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  process.env.MERCADOPAGO_ACCESS_TOKEN = 'fake';
  try {
    const calls: string[] = []; let status = 'pending';
    global.fetch = async (url, init) => {
      const path = new URL(String(url)).pathname; calls.push((init?.method || 'GET') + ' ' + path);
      let body: unknown = {};
      if (path.includes('/preferences/')) body = { external_reference: 'order', expires: true, expiration_date_to: '2020-01-01T00:00:00Z' };
      else if (path.endsWith('/search')) body = { results: [{ id: 123, status, external_reference: 'order', transaction_amount: 10, currency_id: 'BRL' }], paging: { total: 1 } };
      else if (path.endsWith('/123')) { if (init?.method === 'PUT') status = 'cancelled'; body = { id: 123, status, external_reference: 'order', transaction_amount: 10, currency_id: 'BRL' }; }
      return Response.json(body);
    };
    const result = await new MpGateway().close('preference', 'order');
    assert.equal(result[0].status, 'cancelled');
    assert.ok(calls.indexOf('GET /checkout/preferences/preference') < calls.indexOf('PUT /v1/payments/123'));
    assert.equal(calls.filter(c => c === 'GET /v1/payments/search').length, 2);
  } finally { global.fetch = originalFetch; if (token === undefined) delete process.env.MERCADOPAGO_ACCESS_TOKEN; else process.env.MERCADOPAGO_ACCESS_TOKEN = token; }
});
test('unconfirmed expiration and provider errors cannot be treated as cancellation', async () => {
  const original = global.fetch, token = process.env.MERCADOPAGO_ACCESS_TOKEN; process.env.MERCADOPAGO_ACCESS_TOKEN = 'fake';
  try {
    global.fetch = async () => Response.json({ external_reference: 'order', expires: false });
    await assert.rejects(new MpGateway().close('pref', 'order'), { code: 'PAYMENT_CANCELLATION_PENDING' });
    global.fetch = async () => Response.json({}, { status: 500 });
    await assert.rejects(new MpGateway().close('pref', 'order'), { code: 'PAYMENT_PROVIDER_UNAVAILABLE' });
    global.fetch = async () => { throw new DOMException('Timeout', 'TimeoutError'); };
    await assert.rejects(new MpGateway().close('pref', 'order'), { name: 'TimeoutError' });
  } finally { global.fetch = original; if (token === undefined) delete process.env.MERCADOPAGO_ACCESS_TOKEN; else process.env.MERCADOPAGO_ACCESS_TOKEN = token; }
});
test('cobranças de evento e do CLAM são criadas sem boleto', async () => {
  const original = global.fetch;
  const saved = { token: process.env.MERCADOPAGO_ACCESS_TOKEN, secret: process.env.MERCADOPAGO_WEBHOOK_SECRET, base: process.env.APP_BASE_URL };
  process.env.MERCADOPAGO_ACCESS_TOKEN = 'fake'; process.env.MERCADOPAGO_WEBHOOK_SECRET = 'fake'; process.env.APP_BASE_URL = 'https://backend.test';
  try {
    const sent: Array<Record<string, unknown>> = [];
    global.fetch = async (_url, init) => { sent.push(JSON.parse(String(init?.body))); return Response.json({ id: 'pref', init_point: 'https://mp.test/checkout' }); };
    const contract = { amountCents: 3000, currency: 'BRL' as const, examsCount: 1 };
    const payer = { name: 'Ana', email: 'ana@example.test', cpf: '52998224725', phone: '', zipCode: '', street: '', number: '', neighborhood: '', complement: '' };
    const expires = new Date(Date.now() + 900_000);
    await new MpGateway('Simpósio').create('order', contract, payer, expires);
    await new MpGateway().create('order', contract, payer, expires);
    for (const body of sent) assert.deepEqual(body.payment_methods, { excluded_payment_types: [{ id: 'ticket' }] });
    assert.equal(sent[0].notification_url, 'https://backend.test/api/events/webhook');
    assert.equal(sent[1].notification_url, 'https://backend.test/api/selective-processes/webhook');
  } finally {
    global.fetch = original;
    for (const [key, value] of [['MERCADOPAGO_ACCESS_TOKEN', saved.token], ['MERCADOPAGO_WEBHOOK_SECRET', saved.secret], ['APP_BASE_URL', saved.base]] as const) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
