import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { contractFor, normalizeLeagueAcronym, paymentVerdict, toLocalDateTime, type GatewayPayment } from '../lib/selective-processes/domain';
import { verifyMercadoPagoSignature } from '../lib/selective-processes/services/webhookSignature';
import { API_ROUTE_MAP } from '../lib/security/route-policies';

const contract = { examsCount: 1, amountCents: 1000, currency: 'BRL' as const };
const paid: GatewayPayment = { id: '1', reference: 'order', status: 'approved', amountCents: 1000, currency: 'BRL', refundedCents: 0, updatedAt: '' };
test('quantity 1–4 with server prices; limits and invalid values rejected', () => {
  for (let count = 1; count <= 4; count++) assert.equal(contractFor(count, 4, 4, [{ examsCount: 1, unitTotalPrice: 10 }]).amountCents, count * 1000);
  assert.equal(contractFor(4, 4, 4, [{ examsCount: 1, unitTotalPrice: 10 }, { examsCount: 4, unitTotalPrice: 35 }]).amountCents, 3500);
  for (const count of [0, -1, 5, 1.5, NaN, Infinity]) assert.throws(() => contractFor(count, 4, 4, [{ examsCount: 1, unitTotalPrice: 10 }]));
  assert.throws(() => contractFor(3, 2, 4, [{ examsCount: 1, unitTotalPrice: 10 }]));
  assert.throws(() => contractFor(3, 4, 2, [{ examsCount: 1, unitTotalPrice: 10 }]));
  assert.throws(() => contractFor(1, 4, 4, []));
});
test('approved payment survives other rejected and pending attempts', () => {
  for (const status of ['rejected', 'cancelled', 'pending', 'in_process']) {
    assert.equal(paymentVerdict([paid, { ...paid, id: '2', status }], contract, 'order'), 'PAID');
    assert.equal(paymentVerdict([{ ...paid, id: '2', status }, paid], contract, 'order'), 'PAID');
  }
});
test('reference, amount, currency, double approval, disputes and partial refunds require review', () => {
  for (const change of [{ reference: 'another' }, { amountCents: 1 }, { currency: 'USD' }, { refundedCents: 1 }, { status: 'in_mediation' }]) {
    assert.equal(paymentVerdict([{ ...paid, ...change }], contract, 'order'), 'REVIEW_REQUIRED');
  }
  assert.equal(paymentVerdict([paid, { ...paid, id: '2' }], contract, 'order'), 'REVIEW_REQUIRED');
  assert.equal(paymentVerdict([{ ...paid, status: 'refunded', refundedCents: 1000 }], contract, 'order'), 'REVERSED');
  assert.equal(paymentVerdict([{ ...paid, status: 'charged_back' }], contract, 'order'), 'REVERSED');
});
test('webhook fails closed for missing secret, invalid signature and stale replay', () => {
  const before = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  try {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'unit-test-secret';
    const make = (ts: string, hash?: string) => new NextRequest('https://example.invalid/hook?data.id=ABC', { headers: {
      'x-request-id': 'request-1', 'x-signature': 'ts=' + ts + ',v1=' + (hash ?? createHmac('sha256', 'unit-test-secret').update('id:abc;request-id:request-1;ts:' + ts + ';').digest('hex')),
    } });
    const now = String(Date.now());
    assert.equal(verifyMercadoPagoSignature(make(now), 'ABC'), true);
    assert.equal(verifyMercadoPagoSignature(make(now, '0'.repeat(64)), 'ABC'), false);
    assert.equal(verifyMercadoPagoSignature(make(String(Date.now()-600001)), 'ABC'), false);
    assert.equal(verifyMercadoPagoSignature(make(now), 'other'), false);
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    assert.equal(verifyMercadoPagoSignature(make(now), 'ABC'), false);
  } finally { if (before === undefined) delete process.env.MERCADOPAGO_WEBHOOK_SECRET; else process.env.MERCADOPAGO_WEBHOOK_SECRET = before; }
});
test('administrative mutations require administrator; replacement requires student', () => {
  const id = 'a'.repeat(24);
  for (const path of ['/api/admin/selective-processes/applications/' + id + '/scores', '/api/admin/selective-processes/applications/' + id + '/final-status']) {
    const match = API_ROUTE_MAP.find(r => new RegExp(r.path).test(path) && (!r.method || r.method === 'PUT'));
    assert.equal(match?.authType, 'admin');
  }
  assert.equal(API_ROUTE_MAP.find(r => new RegExp(r.path).test('/api/v1/selective-processes/' + id + '/checkout/replace') && r.method === 'POST')?.authType, 'student');
});
test('date editor roundtrip keeps local wall time', () => {
  const before = process.env.TZ;
  try {
    process.env.TZ = 'America/Sao_Paulo';
    const original = new Date('2026-09-05T13:30:00Z');
    assert.equal(toLocalDateTime(original), '2026-09-05T10:30');
    assert.equal(new Date(toLocalDateTime(original)).toISOString(), original.toISOString());
    assert.equal(toLocalDateTime('invalid'), '');
  } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
});

test('league acronyms are trimmed, uppercased and restricted to the stored format', () => {
  assert.equal(normalizeLeagueAcronym('  lacor  '), 'LACOR');
  assert.equal(normalizeLeagueAcronym('liga_2-sp'), 'LIGA_2-SP');
  assert.equal(normalizeLeagueAcronym(''), undefined);
  for (const invalid of ['LIGA CLÍNICA', 'LIGA/2', 'A'.repeat(31)]) {
    assert.throws(() => normalizeLeagueAcronym(invalid));
  }
});


test('request parsing rejects browser identity and price, validates payer and replacement session', async () => {
  const { parseCheckoutBody } = await import('../lib/selective-processes/input');
  const payer = { name: 'Aluno Teste', cpf: '52998224725', zipCode: '38440000', street: 'Rua', number: '1', neighborhood: 'Teste', complement: '', phone: '34999999999', email: 'teste@example.invalid' };
  const body = { examsCount: 4, payer };
  assert.equal(parseCheckoutBody(body, false).examsCount, 4);
  for (const key of ['userId','usuarioId','owner','items','paymentConfig','totalAmount','unit_price','amountCents','currency']) assert.throws(() => parseCheckoutBody({ ...body, [key]: 'forged' }, false));
  assert.throws(() => parseCheckoutBody({ ...body, payer: { ...payer, cpf: '11111111111' } }, false));
  assert.throws(() => parseCheckoutBody(body, true));
  assert.equal(parseCheckoutBody({ ...body, previousSessionId: 'a'.repeat(24) }, true).previousSessionId, 'a'.repeat(24));
});
