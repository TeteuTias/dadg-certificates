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
