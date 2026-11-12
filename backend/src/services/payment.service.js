import { randomUUID } from 'node:crypto';
import { db, DEMO_PAYMENT_PASSWORD } from '../db/database.js';
import { LIMITS } from '../config/rules.js';
import { applyCashbackLimits } from './cashback.service.js';
import { getRules } from '../repositories/rules.repository.js';
import { monthEarned, spentSince } from '../repositories/ledger.repository.js';
import { istDayStart } from '../utils/time.js';
import { makeReference } from '../utils/reference.js';
import { inr } from '../utils/money.js';

const fail = (status, message) => Object.assign(new Error(message), { status });

/** Cashback a given wallet would earn right now. Shared by the preview endpoint and the real payment. */
export function quoteCashback(wallet, merchant, amountPaise, now = new Date()) {
  const earned = monthEarned(wallet.id, now);
  return applyCashbackLimits({ amountPaise, category: merchant.category, tier: wallet.tier, rules: getRules(),
    earnedCategoryPaise: earned.byCategory[merchant.category]?.earned || 0, earnedTotalPaise: earned.totalEarned });
}

/** Limit checks, debit, cashback credit and ledger insert all happen inside ONE SQLite transaction. */
export function processPayment({ studentId, merchantId, amountPaise, idempotencyKey, paymentPassword }) {
  if (!idempotencyKey || idempotencyKey.length > 128) throw fail(400, 'A valid Idempotency-Key header is required');
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) throw fail(400, 'Amount must be a positive integer number of paise');
  if (!paymentPassword || typeof paymentPassword !== 'string' || !paymentPassword.trim()) throw fail(400, 'Payment password is required');

  return db.transaction(() => {
    const wallet = db.prepare('SELECT * FROM wallets WHERE student_id=?').get(studentId);
    if (!wallet) throw fail(404, 'Wallet not found for authenticated student');
    if (wallet.payment_password !== DEMO_PAYMENT_PASSWORD && wallet.payment_password !== paymentPassword) {
      throw fail(401, 'Incorrect payment password');
    }
    if (wallet.payment_password === DEMO_PAYMENT_PASSWORD && paymentPassword !== DEMO_PAYMENT_PASSWORD) {
      throw fail(401, 'Incorrect payment password');
    }

    const existing = db.prepare(`SELECT t.*, m.name AS merchant_name FROM transactions t JOIN merchants m ON m.id=t.merchant_id
      WHERE t.wallet_id=? AND t.idempotency_key=?`).get(wallet.id, idempotencyKey);
    if (existing) {
      if (existing.merchant_id !== merchantId || existing.amount_paise !== amountPaise) throw fail(422, 'Idempotency-Key was already used for a different payment');
      return { ...existing, duplicate: true, walletBalancePaise: existing.balance_after_paise };
    }

    const merchant = db.prepare("SELECT * FROM merchants WHERE id=? AND active=1 AND category!='TOP_UP'").get(merchantId);
    if (!merchant) throw fail(404, 'Merchant not found or inactive');
    if (amountPaise > LIMITS.maxPaymentPaise) throw fail(400, `Maximum payment is ${inr(LIMITS.maxPaymentPaise)}`);
    if (wallet.balance_paise < amountPaise) throw fail(409, 'Insufficient wallet balance. Add money to continue.');

    const now = new Date();
    const spentToday = spentSince(wallet.id, istDayStart(now));
    if (spentToday + amountPaise > LIMITS.dailySpendPaise) {
      throw fail(409, `Daily spending limit of ${inr(LIMITS.dailySpendPaise)} exceeded. You have ${inr(Math.max(0, LIMITS.dailySpendPaise - spentToday))} left today.`);
    }

    const q = quoteCashback(wallet, merchant, amountPaise, now);
    const id = randomUUID(), reference = makeReference('FP', now), createdAt = now.toISOString();
    const newBalance = wallet.balance_paise - amountPaise + q.cashbackPaise;
    db.prepare('UPDATE wallets SET balance_paise=? WHERE id=?').run(newBalance, wallet.id);
    db.prepare(`INSERT INTO transactions(id,wallet_id,merchant_id,idempotency_key,reference,type,amount_paise,cashback_paise,raw_cashback_paise,
      balance_after_paise,category,note,status,created_at) VALUES (?,?,?,?,?,'PAYMENT',?,?,?,?,?,?,'SUCCESS',?)`)
      .run(id, wallet.id, merchant.id, idempotencyKey, reference, amountPaise, q.cashbackPaise, q.rawPaise, newBalance, merchant.category, q.note, createdAt);
    return { id, reference, wallet_id: wallet.id, merchant_id: merchant.id, merchant_name: merchant.name, type: 'PAYMENT', amount_paise: amountPaise,
      cashback_paise: q.cashbackPaise, raw_cashback_paise: q.rawPaise, category: merchant.category, note: q.note, status: 'SUCCESS',
      created_at: createdAt, balance_after_paise: newBalance, walletBalancePaise: newBalance, duplicate: false };
  })();
}
