import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { processPayment, quoteCashback } from '../services/payment.service.js';
import { processTopUp } from '../services/topup.service.js';
import { buildInsights } from '../services/insights.service.js';
import { reconcileMonth } from '../services/reconciliation.service.js';
import { getRules } from '../repositories/rules.repository.js';
import { LIMITS, TIERS, TOP_UP_METHODS } from '../config/rules.js';
import { paiseToRupees, rupeesToPaise } from '../utils/money.js';

export const api = Router();
api.use(authenticate);
const walletFor = studentId => db.prepare('SELECT * FROM wallets WHERE student_id=?').get(studentId);
const notFound = (res) => res.status(404).json({ error: 'Wallet not found' });
const present = r => ({ ...r, amount: paiseToRupees(r.amount_paise), cashback: paiseToRupees(r.cashback_paise), walletBalance: paiseToRupees(r.walletBalancePaise) });

api.get('/me', (req, res) => res.json({ id: req.user.sub, role: req.user.role || 'STUDENT' }));

api.get('/wallet', (req, res) => {
  const w = walletFor(req.user.sub);
  if (!w) return notFound(res);
  res.json({ ...w, balance: paiseToRupees(w.balance_paise) });
});

api.get('/merchants', (_req, res) => res.json(db.prepare("SELECT id,name,category,tagline FROM merchants WHERE active=1 AND category!='TOP_UP' ORDER BY category,name").all()));

api.get('/rules', (_req, res) => res.json({ tiers: TIERS, limits: LIMITS, topUpMethods: TOP_UP_METHODS, categories: getRules() }));

api.get('/insights', (req, res) => {
  const data = buildInsights(req.user.sub);
  data ? res.json(data) : notFound(res);
});

api.get('/transactions', (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
  const rows = db.prepare(`SELECT t.*, m.name AS merchant_name FROM transactions t JOIN merchants m ON m.id=t.merchant_id
    JOIN wallets w ON w.id=t.wallet_id WHERE w.student_id=? ORDER BY t.created_at DESC LIMIT ?`).all(req.user.sub, limit);
  res.json(rows);
});

// Preview applies the SAME limits as a real payment (minimum spend, per-payment cap, monthly caps).
api.post('/cashback/preview', (req, res, next) => {
  try {
    const input = z.object({ merchantId: z.string(), amount: z.number().positive() }).parse(req.body);
    const wallet = walletFor(req.user.sub);
    if (!wallet) return notFound(res);
    const merchant = db.prepare("SELECT * FROM merchants WHERE id=? AND active=1 AND category!='TOP_UP'").get(input.merchantId);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found or inactive' });
    const amountPaise = rupeesToPaise(input.amount);
    const q = quoteCashback(wallet, merchant, amountPaise);
    res.json({ amountPaise, category: merchant.category, tier: wallet.tier, cashbackPaise: q.cashbackPaise, cashback: paiseToRupees(q.cashbackPaise),
      rawCashbackPaise: q.rawPaise, limit: q.limit, note: q.note });
  } catch (e) { next(e); }
});

api.post('/payments', (req, res, next) => {
  try {
    const input = z.object({ merchantId: z.string(), amount: z.number().positive(), paymentPassword: z.string().min(4).max(32).optional() }).parse(req.body);
    const result = processPayment({ studentId: req.user.sub, merchantId: input.merchantId, amountPaise: rupeesToPaise(input.amount), idempotencyKey: req.get('Idempotency-Key'), paymentPassword: input.paymentPassword });
    res.status(result.duplicate ? 200 : 201).json(present(result));
  } catch (e) { next(e); }
});

api.post('/wallet/topup', (req, res, next) => {
  try {
    const input = z.object({ amount: z.number().positive(), method: z.enum(['UPI', 'CARD', 'NETBANKING']) }).parse(req.body);
    const result = processTopUp({ studentId: req.user.sub, amountPaise: rupeesToPaise(input.amount), method: input.method, idempotencyKey: req.get('Idempotency-Key') });
    res.status(result.duplicate ? 200 : 201).json(present(result));
  } catch (e) { next(e); }
});

api.get('/admin/reconciliation/:month', requireAdmin, (req, res, next) => {
  try { res.json(reconcileMonth(req.params.month)); } catch (e) { next(e); }
});

api.get('/admin/reconciliation/:month/csv', requireAdmin, (req, res, next) => {
  try {
    const recon = reconcileMonth(req.params.month);
    let csv = 'Category,Transactions,Volume (INR),Cashback (INR),Effective Rate (%)\n';
    for (const c of recon.categories) {
      const vol = (c.amount_paise / 100).toFixed(2);
      const cb = (c.cashback_paise / 100).toFixed(2);
      const rate = c.amount_paise ? ((c.cashback_paise / c.amount_paise) * 100).toFixed(2) : '0.00';
      csv += `"${c.category}",${c.transaction_count},${vol},${cb},${rate}%\n`;
    }
    const totVol = (recon.totals.amountPaise / 100).toFixed(2);
    const totCb = (recon.totals.cashbackPaise / 100).toFixed(2);
    csv += `\n"TOTAL",${recon.totals.transactions},${totVol},${totCb},${recon.totals.effectiveCashbackPercent}%\n`;
    csv += `"TOPUPS",${recon.totals.topUpCount},${(recon.totals.topUpPaise / 100).toFixed(2)},0.00,0.00%\n`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="finpay-reconciliation-${req.params.month}.csv"`);
    res.send(csv);
  } catch (e) { next(e); }
});

api.get('/admin/wallets', requireAdmin, (_req, res) => res.json(db.prepare('SELECT id,student_id,student_name,tier,balance_paise FROM wallets ORDER BY student_name').all()));
