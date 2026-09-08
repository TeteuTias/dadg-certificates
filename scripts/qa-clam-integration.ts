import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Gateway } from '../lib/selective-processes/services/gateway';
import type { Contract, GatewayPayment, Payer } from '../lib/selective-processes/domain';

async function main() {
  if (!process.argv.includes('--approved') || process.env.CLAM_RECOVERABLE_BACKUP !== 'empty-baseline') {
    throw new Error('Explicit approval and CLAM_RECOVERABLE_BACKUP=empty-baseline are required before starting Mongo.');
  }
  const directory = resolve('.cache/clam-integration', randomUUID());
  mkdirSync(directory + '/db', { recursive: true });
  writeFileSync(directory + '/backup-empty.json', JSON.stringify({ database: 'clam_integration_test', collections: [], restore: 'Recreate an empty isolated database, then run this fixture script.' }, null, 2));
  mongoose.set('autoIndex', false); mongoose.set('autoCreate', false);
  // Uses a fresh empty directory; never reads project .env files or an existing Mongo URI.
  const mongo = await MongoMemoryReplSet.create({ instanceOpts: [{ port: 27019, dbPath: directory + '/db' }],
    replSet: { count: 1, ip: '127.0.0.1', name: 'clam_test', storageEngine: 'wiredTiger' } });
  let passed = 0;
  try {
    const uri = mongo.getUri('clam_integration_test');
    assert.ok(uri.startsWith('mongodb://127.0.0.1:'));
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
    global.mongoose = { conn: mongoose, promise: Promise.resolve(mongoose) };
    const { prepareClamStorage } = await import('../lib/selective-processes/maintenance');
    const { checkout, reconcileSession } = await import('../lib/selective-processes/services/checkout');
    const { selectLeaguesForApplication } = await import('../lib/selective-processes/services/studentSelectiveProcesses');
    const { deleteExamForProcess, deleteSelectionProcess } = await import('../lib/selective-processes/services/selectiveProcesses');
    const { SelectionProcess } = await import('../lib/selective-processes/models/SelectionProcessModel');
    const { Exam } = await import('../lib/selective-processes/models/ExamModel');
    const { PricingTier } = await import('../lib/selective-processes/models/PricingTierModel');
    const { PaymentSession } = await import('../lib/selective-processes/models/PaymentSessionModel');
    const { Application } = await import('../lib/selective-processes/models/ApplicationModel');
    const { Ticket } = await import('../lib/selective-processes/models/TicketModel');
    const { Reservation } = await import('../lib/selective-processes/models/ReservationModel');
    const report = await prepareClamStorage(true); assert.deepEqual(report.duplicateIndexes, []);
    const payer: Payer = { name: 'Teste CLAM', cpf: '52998224725', zipCode: '38440000', street: 'Rua Teste', number: '1', neighborhood: 'Teste', complement: '', phone: '34999999999', email: 'clam@example.invalid' };
    class FakeGateway implements Gateway {
      prefs = new Map<string, Awaited<ReturnType<Gateway['create']>>>();
      ledger = new Map<string, GatewayPayment[]>();
      contracts = new Map<string, Contract>();
      createCount = 0; closeFailure = false; createFailure = false; approveDuringClose = false;
      async create(reference: string, contract: Contract, _payer: Payer, expiresAt: Date) {
        this.createCount++; this.contracts.set(reference, contract);
        const pref = { id: randomUUID(), init_point: 'https://example.invalid/checkout/' + reference, expires: true, expiration_date_to: expiresAt.toISOString(), external_reference: reference };
        this.prefs.set(reference, pref); this.ledger.set(reference, []);
        if (this.createFailure) throw new Error('Simulated lost provider response');
        return pref;
      }
      async findPreference(ref: string) { return this.prefs.get(ref) || null; }
      async payments(ref: string) { return structuredClone(this.ledger.get(ref) || []); }
      async paymentReference(id: string) { return [...this.ledger.values()].flat().find(p => p.id === id)?.reference || ''; }
      async close(_id: string, ref: string) {
        if (this.closeFailure) throw new Error('Simulated refused cancellation / timeout');
        if (this.approveDuringClose) this.approve(ref);
        else this.ledger.set(ref, (this.ledger.get(ref) || []).map(p => ({ ...p, status: 'cancelled' })));
        return this.payments(ref);
      }
      approve(ref: string, status = 'approved', refundedCents = 0) {
        const c = this.contracts.get(ref)!;
        this.ledger.set(ref, [{ id: 'payment-' + ref, reference: ref, status, amountCents: c.amountCents, currency: 'BRL', refundedCents, updatedAt: new Date().toISOString() }]);
      }
    }
    async function fixture(capacity = 10) {
      const p = await SelectionProcess.create({ registrationStartDate: new Date(Date.now()-60000), registrationEndDate: new Date(Date.now()+3600000), maxCapacity: capacity, maxExamsPerApplication: 4 });
      const exams = await Exam.insertMany(Array.from({ length: 4 }, (_, i) => ({ selectionProcessId: p._id, name: 'Liga ' + i, examStartDate: new Date(), examEndDate: new Date(Date.now()+3600000) })));
      await PricingTier.create({ selectionProcessId: p._id, examsCount: 1, unitTotalPrice: 10 });
      const g = new FakeGateway();
      const input = { processId: String(p._id), userId: String(new mongoose.Types.ObjectId()), examsCount: 1, payer, operationKey: randomUUID() };
      return { p, exams, g, input };
    }
    async function check(name: string, fn: () => Promise<void>) { await fn(); passed++; console.log('PASS ' + name); }
    const code = (expected: string) => (error: unknown) => (error as { code?: string }).code === expected;
    for (let quantity = 1; quantity <= 4; quantity++) await check('purchase ' + quantity + ' leagues and no top-up', async () => {
      const { g, input } = await fixture(); input.examsCount = quantity;
      const created = await checkout(input, g); assert.equal(created.totalAmount, quantity * 10);
      assert.equal((await checkout(input, g)).sessionId, created.sessionId); assert.equal(g.createCount, 1);
      g.approve(created.sessionId); await reconcileSession(created.sessionId, g);
      await reconcileSession(created.sessionId, g);
      assert.equal(await Application.countDocuments({ userId: input.userId }), 1);
      assert.equal((await Ticket.findOne({ paymentSessionId: created.sessionId }))!.leagueAllowanceCount, quantity);
      await assert.rejects(checkout({ ...input, operationKey: randomUUID() }, g), code('ALREADY_ENROLLED'));
    });
    await check('invalid quantities never call gateway', async () => {
      const { g, input } = await fixture();
      for (const count of [0, 5, -1, 1.5, NaN]) await assert.rejects(checkout({ ...input, examsCount: count, operationKey: randomUUID() }, g), code('INVALID_EXAMS_COUNT'));
      assert.equal(g.createCount, 0);
    });
    await check('replace 1 with 4, repeat request and reject altered payload', async () => {
      const { g, input, p } = await fixture(1);
      const first = await checkout(input, g);
      await assert.rejects(checkout({ ...input, examsCount: 4, operationKey: randomUUID() }, g), code('PAYMENT_REPLACEMENT_REQUIRED'));
      const replacement = { ...input, examsCount: 4, previousSessionId: first.sessionId, operationKey: randomUUID() };
      const second = await checkout(replacement, g);
      assert.equal((await checkout(replacement, g)).sessionId, second.sessionId); assert.equal(g.createCount, 2);
      assert.equal((await SelectionProcess.findById(p._id))!.allocatedCount, 1);
      await assert.rejects(checkout({ ...replacement, examsCount: 3 }, g), code('IDEMPOTENCY_CONFLICT'));
      assert.equal((await PaymentSession.findById(first.sessionId))!.providerClosed, true);
      await reconcileSession(first.sessionId, g); // Old canceled notification cannot affect replacement.
      assert.equal((await PaymentSession.findById(second.sessionId))!.status, 'PENDING');
    });
    await check('refused cancellation / timeout keeps only old charge and request hash', async () => {
      const { g, input } = await fixture(); const first = await checkout(input, g); g.closeFailure = true;
      const request = { ...input, examsCount: 4, previousSessionId: first.sessionId, operationKey: randomUUID() };
      await assert.rejects(checkout(request, g), code('PAYMENT_CANCELLATION_PENDING'));
      await assert.rejects(checkout({ ...request, examsCount: 3 }, g), code('IDEMPOTENCY_CONFLICT'));
      assert.equal(g.createCount, 1);
      g.closeFailure = false; await checkout(request, g); assert.equal(g.createCount, 2);
    });
    await check('approved during replacement preserves original contract', async () => {
      const { g, input } = await fixture(); const first = await checkout(input, g); g.approveDuringClose = true;
      await assert.rejects(checkout({ ...input, examsCount: 4, previousSessionId: first.sessionId, operationKey: randomUUID() }, g), code('ALREADY_ENROLLED'));
      assert.equal(g.createCount, 1);
      assert.equal((await Ticket.findOne({ paymentSessionId: first.sessionId }))!.leagueAllowanceCount, 1);
    });
    await check('lost creation response is reconciled without a second preference', async () => {
      const { g, input } = await fixture(); const first = await checkout(input, g); g.createFailure = true;
      const request = { ...input, examsCount: 4, previousSessionId: first.sessionId, operationKey: randomUUID() };
      await assert.rejects(checkout(request, g), code('PAYMENT_REVIEW_REQUIRED'));
      g.createFailure = false; const recovered = await checkout(request, g);
      assert.equal(recovered.examsCount, 4); assert.equal(g.createCount, 2);
    });
    await check('last seat contention and simultaneous payment confirmation', async () => {
      const { g, input, p } = await fixture(1);
      const attempts = await Promise.allSettled([checkout(input, g), checkout({ ...input, userId: String(new mongoose.Types.ObjectId()), operationKey: randomUUID() }, g)]);
      assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1); assert.equal(g.createCount, 1);
      const first = attempts.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof checkout>>>;
      g.approve(first.value.sessionId);
      await Promise.allSettled([reconcileSession(first.value.sessionId, g), reconcileSession(first.value.sessionId, g)]);
      await reconcileSession(first.value.sessionId, g);
      assert.equal(await Application.countDocuments({ selectionProcessId: p._id }), 1);
      assert.equal(await Ticket.countDocuments({ selectionProcessId: p._id }), 1);
      assert.equal((await SelectionProcess.findById(p._id))!.allocatedCount, 1);
    });
    await check('duplicate and rejected attempts cannot downgrade approved; refund revokes and releases once', async () => {
      const { g, input, p, exams } = await fixture(); const first = await checkout(input, g);
      g.approve(first.sessionId); await reconcileSession(first.sessionId, g);
      const paid = g.ledger.get(first.sessionId)![0];
      g.ledger.get(first.sessionId)!.push({ ...paid, id: 'rejected-attempt', status: 'rejected' });
      await reconcileSession(first.sessionId, g); assert.equal((await PaymentSession.findById(first.sessionId))!.status, 'PAID');
      g.ledger.get(first.sessionId)![0] = { ...paid, status: 'refunded', refundedCents: 1000 };
      await reconcileSession(first.sessionId, g); await reconcileSession(first.sessionId, g);
      assert.equal((await SelectionProcess.findById(p._id))!.allocatedCount, 0);
      assert.equal((await Ticket.findOne({ paymentSessionId: first.sessionId }))!.paymentStatus, 'CANCELED');
      await assert.rejects(selectLeaguesForApplication({ selectionProcessId: input.processId, userId: input.userId, examIds: [String(exams[0]._id)] }), code('PAYMENT_NOT_CONFIRMED'));
    });
    await check('partial refunds and mismatched amount require review', async () => {
      for (const partial of [true, false]) {
        const { g, input } = await fixture(); const first = await checkout(input, g); g.approve(first.sessionId);
        if (partial) g.ledger.get(first.sessionId)![0].refundedCents = 100;
        else g.ledger.get(first.sessionId)![0].amountCents = 1;
        await assert.rejects(reconcileSession(first.sessionId, g), code('PAYMENT_REVIEW_REQUIRED'));
        assert.equal(await Ticket.countDocuments({ paymentSessionId: first.sessionId }), 0);
      }
    });
    await check('concurrent league selections, credit return, and linked process deletion', async () => {
      const { g, input, exams } = await fixture(); const first = await checkout(input, g); g.approve(first.sessionId); await reconcileSession(first.sessionId, g);
      const choose = (id: string) => selectLeaguesForApplication({ selectionProcessId: input.processId, userId: input.userId, examIds: [id] });
      const attempts = await Promise.allSettled([choose(String(exams[0]._id)), choose(String(exams[1]._id))]);
      assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1);
      const app = (await Application.findOne({ userId: input.userId }))!; assert.equal(app.exams.length, 1);
      await deleteExamForProcess(input.processId, String(app.exams[0]));
      const after = (await Application.findById(app._id))!; assert.equal(after.exams.length, 0); assert.equal(after.scores.length, 0);
      assert.equal((await Ticket.findOne({ applicationId: app._id }))!.leagueAllowanceCount, 1);
      const remaining = exams.find(e => String(e._id) !== String(app.exams[0]))!;
      await choose(String(remaining._id));
      await assert.rejects(deleteSelectionProcess(input.processId), code('PROCESS_HAS_ENROLLMENTS'));
    });
    await check('expired local session cannot create a second charge', async () => {
      const { g, input } = await fixture(); const first = await checkout(input, g);
      await PaymentSession.updateOne({ _id: first.sessionId }, { $set: { expiresAt: new Date(Date.now()-1000) } });
      await assert.rejects(checkout(input, g), code('PAYMENT_REPLACEMENT_REQUIRED'));
      assert.equal(g.createCount, 1);
      await reconcileSession(first.sessionId, g, true);
      const reservation = await Reservation.findOne({ userId: input.userId }); assert.equal(reservation!.state, 'IDLE');
    });

    await check('failure between application and ticket rolls back; retry grants exactly once', async () => {
      const { g, input } = await fixture(); const first = await checkout(input, g); g.approve(first.sessionId);
      const original = Ticket.findOneAndUpdate;
      Ticket.findOneAndUpdate = (() => { throw new Error('Injected write failure'); }) as typeof original;
      try { await assert.rejects(reconcileSession(first.sessionId, g), /Injected write failure/); }
      finally { Ticket.findOneAndUpdate = original; }
      assert.equal(await Application.countDocuments({ userId: input.userId }), 0);
      assert.equal((await PaymentSession.findById(first.sessionId))!.status, 'PENDING');
      await reconcileSession(first.sessionId, g);
      assert.equal(await Application.countDocuments({ userId: input.userId }), 1);
      assert.equal(await Ticket.countDocuments({ paymentSessionId: first.sessionId }), 1);
    });
    await check('price replacement rolls back deletions if insertion fails', async () => {
      const { input } = await fixture();
      const { replacePricingTiers } = await import('../lib/selective-processes/services/selectiveProcesses');
      const original = PricingTier.insertMany;
      PricingTier.insertMany = (async () => { throw new Error('Injected pricing failure'); }) as typeof original;
      try { await assert.rejects(replacePricingTiers(input.processId, [{ examsCount: 1, unitTotalPrice: 20 }]), /Injected pricing failure/); }
      finally { PricingTier.insertMany = original; }
      assert.equal((await PricingTier.collection.findOne({ selectionProcessId: new mongoose.Types.ObjectId(input.processId) }))!.unitTotalPrice, 10);
      await replacePricingTiers(input.processId, [{ examsCount: 1, unitTotalPrice: 20 }]);
      assert.equal((await PricingTier.collection.findOne({ selectionProcessId: new mongoose.Types.ObjectId(input.processId) }))!.unitTotalPrice, 20);
    });
    await check('late approval of superseded session blocks replacement and never grants its rights', async () => {
      const { g, input } = await fixture(); const first = await checkout(input, g);
      const second = await checkout({ ...input, examsCount: 4, previousSessionId: first.sessionId, operationKey: randomUUID() }, g);
      g.approve(first.sessionId);
      await assert.rejects(reconcileSession(first.sessionId, g), code('PAYMENT_REVIEW_REQUIRED'));
      assert.equal((await PaymentSession.findById(second.sessionId))!.status, 'REVIEW_REQUIRED');
      assert.equal(await Ticket.countDocuments({ selectionProcessId: input.processId }), 0);
      await assert.rejects(checkout({ ...input, operationKey: randomUUID() }, g), code('PAYMENT_REVIEW_REQUIRED'));
    });

    await check('legacy accounting cannot be silently initialized through process edits', async () => {
      const { updateSelectionProcess } = await import('../lib/selective-processes/services/selectiveProcesses');
      const id = new mongoose.Types.ObjectId();
      await SelectionProcess.collection.insertOne({ _id: id, registrationStartDate: new Date(), registrationEndDate: new Date(Date.now()+3600000), maxCapacity: 10, maxExamsPerApplication: 4 } as never);
      await assert.rejects(updateSelectionProcess(String(id), { maxCapacity: 20 }), code('SELECTIVE_PROCESS_SETUP_REQUIRED'));
      assert.equal((await SelectionProcess.collection.findOne({ _id: id }))!.accountingVersion, undefined);
    });
    await check('approval after confirmed release requires review and cannot start another checkout', async () => {
      const { g, input } = await fixture(); const first = await checkout(input, g);
      await PaymentSession.updateOne({ _id: first.sessionId }, { $set: { expiresAt: new Date(Date.now()-1000) } });
      await reconcileSession(first.sessionId, g, true);
      g.approve(first.sessionId);
      await assert.rejects(reconcileSession(first.sessionId, g), code('PAYMENT_REVIEW_REQUIRED'));
      await assert.rejects(checkout({ ...input, operationKey: randomUUID() }, g), code('PAYMENT_REVIEW_REQUIRED'));
    });
    console.log(JSON.stringify({ passed, database: 'clam_integration_test', retainedDirectory: directory, provider: 'fake; no Mercado Pago API requests' }));
  } finally {
    await mongoose.disconnect();
    await mongo.stop({ doCleanup: false, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
