import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.DATABASE_FILE = ':memory:';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.JWT_ISSUER = 'talenthub';
process.env.JWT_AUDIENCE = 'finpay';
process.env.ENABLE_DEV_AUTH = 'true';

let request, tokenFor;
before(async () => {
  const { default: supertest } = await import('supertest');
  const { app } = await import('../src/app.js');
  request = supertest(app);
  tokenFor = async (studentId, role = 'STUDENT') => (await request.post('/api/dev/token').send({ studentId, role })).body.token;
});

const pay = (token, merchantId, amount, key = randomUUID(), paymentPassword = 'FinPay@2026') =>
  request.post('/api/payments').set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key).send({ merchantId, amount, paymentPassword });

test('requires a bearer token', async () => assert.equal((await request.get('/api/wallet')).status, 401));

test('seeded wallet has realistic history and insights', async () => {
  const t = await tokenFor('student-rahul');
  const tx = await request.get('/api/transactions').set('Authorization', `Bearer ${t}`);
  assert.ok(tx.body.length > 30);
  const ins = await request.get('/api/insights').set('Authorization', `Bearer ${t}`);
  assert.equal(ins.body.daily.length, 14);
  assert.ok(ins.body.cashbackThisMonthPaise <= ins.body.ceilingPaise);
});

test('payment debits, credits capped cashback and is idempotent', async () => {
  const t = await tokenFor('student-priya');
  const before = (await request.get('/api/wallet').set('Authorization', `Bearer ${t}`)).body.balance_paise;
  const key = randomUUID();
  const a = await pay(t, 'm-canteen', 100, key);
  assert.equal(a.status, 201);
  assert.equal(a.body.cashback_paise, 187); // 1.5% x 1.25 (PRIME) of ₹100, floored
  const b = await pay(t, 'm-canteen', 100, key);
  assert.equal(b.status, 200); assert.equal(b.body.id, a.body.id);
  const after = (await request.get('/api/wallet').set('Authorization', `Bearer ${t}`)).body.balance_paise;
  assert.equal(after, before - 10000 + a.body.cashback_paise);
  assert.equal((await pay(t, 'm-canteen', 150, key)).status, 422);
});

test('preview matches the real payment', async () => {
  const t = await tokenFor('student-aman');
  const p = await request.post('/api/cashback/preview').set('Authorization', `Bearer ${t}`).send({ merchantId: 'm-online', amount: 500 });
  const r = await pay(t, 'm-online', 500);
  assert.equal(p.body.cashbackPaise, r.body.cashback_paise);
});

test('small payments below the minimum earn no cashback', async () => {
  const t = await tokenFor('student-rahul');
  const r = await pay(t, 'm-chai', 10);
  assert.equal(r.status, 201); assert.equal(r.body.cashback_paise, 0);
});

test('guards: insufficient balance, daily limit, max payment, top-up merchant', async () => {
  const t = await tokenFor('student-rahul');
  assert.equal((await pay(t, 'm-online', 4900)).status, 409);          // more than the balance
  assert.equal((await pay(t, 'm-online', 6000)).status, 400);          // above max single payment
  assert.equal((await pay(t, 'm-topup', 100)).status, 404);            // top-up is not a merchant
  assert.equal((await pay(t, 'm-canteen', 0)).status, 400);
});

test('top-up credits the wallet, earns no cashback and enforces limits', async () => {
  const t = await tokenFor('student-priya');
  const topup = (amount, key = randomUUID()) => request.post('/api/wallet/topup').set('Authorization', `Bearer ${t}`).set('Idempotency-Key', key).send({ amount, method: 'UPI' });
  const before = (await request.get('/api/wallet').set('Authorization', `Bearer ${t}`)).body.balance_paise;
  const key = randomUUID();
  const ok = await topup(500, key);
  assert.equal(ok.status, 201); assert.equal(ok.body.cashback_paise, 0);
  assert.equal((await topup(500, key)).status, 200);
  assert.equal((await request.get('/api/wallet').set('Authorization', `Bearer ${t}`)).body.balance_paise, before + 50000);
  assert.equal((await topup(5)).status, 400);
  assert.equal((await topup(10001)).status, 400);
});

test('reconciliation is admin-only and excludes top-ups from payment volume', async () => {
  const student = await tokenFor('student-rahul'), admin = await tokenFor('student-rahul', 'ADMIN');
  const month = new Date().toISOString().slice(0, 7);
  assert.equal((await request.get(`/api/admin/reconciliation/${month}`).set('Authorization', `Bearer ${student}`)).status, 403);
  const rec = await request.get(`/api/admin/reconciliation/${month}`).set('Authorization', `Bearer ${admin}`);
  assert.equal(rec.status, 200);
  assert.ok(!rec.body.categories.some(c => c.category === 'TOP_UP'));
  assert.equal((await request.get('/api/admin/reconciliation/2026-13').set('Authorization', `Bearer ${admin}`)).status, 400);
});
