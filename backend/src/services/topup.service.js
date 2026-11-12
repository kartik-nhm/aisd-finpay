import { randomUUID } from 'node:crypto';
import { db } from '../db/database.js';
import { LIMITS, TOP_UP_METHODS } from '../config/rules.js';
import { makeReference } from '../utils/reference.js';
import { inr } from '../utils/money.js';

const fail = (status, message) => Object.assign(new Error(message), { status });

/**
 * Wallet funding is a CREDIT with its own limits and earns no cashback. The payment gateway (UPI / card / net banking)
 * is simulated in this demo: no real money moves.
 */
export function processTopUp({ studentId, amountPaise, method, idempotencyKey }) {
  if (!idempotencyKey || idempotencyKey.length > 128) throw fail(400, 'A valid Idempotency-Key header is required');
  if (!TOP_UP_METHODS[method]) throw fail(400, 'Unsupported top-up method');
  if (!Number.isSafeInteger(amountPaise) || amountPaise < LIMITS.minTopUpPaise) throw fail(400, `Minimum top-up is ${inr(LIMITS.minTopUpPaise)}`);
  if (amountPaise > LIMITS.maxTopUpPaise) throw fail(400, `Maximum top-up is ${inr(LIMITS.maxTopUpPaise)} per transaction`);

  return db.transaction(() => {
    const wallet = db.prepare('SELECT * FROM wallets WHERE student_id=?').get(studentId);
    if (!wallet) throw fail(404, 'Wallet not found for authenticated student');
    const existing = db.prepare('SELECT * FROM transactions WHERE wallet_id=? AND idempotency_key=?').get(wallet.id, idempotencyKey);
    if (existing) {
      if (existing.type !== 'TOPUP' || existing.amount_paise !== amountPaise) throw fail(422, 'Idempotency-Key was already used for a different request');
      return { ...existing, merchant_name: 'Wallet Top-up', duplicate: true, walletBalancePaise: existing.balance_after_paise };
    }
    if (wallet.balance_paise + amountPaise > LIMITS.maxBalancePaise) {
      throw fail(409, `Wallet balance cannot exceed ${inr(LIMITS.maxBalancePaise)}. You can add up to ${inr(LIMITS.maxBalancePaise - wallet.balance_paise)} now.`);
    }
    const now = new Date(), id = randomUUID(), reference = makeReference('TU', now), newBalance = wallet.balance_paise + amountPaise;
    const note = `Added via ${TOP_UP_METHODS[method]}`;
    db.prepare('UPDATE wallets SET balance_paise=? WHERE id=?').run(newBalance, wallet.id);
    db.prepare(`INSERT INTO transactions(id,wallet_id,merchant_id,idempotency_key,reference,type,amount_paise,cashback_paise,raw_cashback_paise,
      balance_after_paise,category,note,status,created_at) VALUES (?,?,'m-topup',?,?,'TOPUP',?,0,0,?,'TOP_UP',?,'SUCCESS',?)`)
      .run(id, wallet.id, idempotencyKey, reference, amountPaise, newBalance, note, now.toISOString());
    return { id, reference, wallet_id: wallet.id, merchant_id: 'm-topup', merchant_name: 'Wallet Top-up', type: 'TOPUP', amount_paise: amountPaise,
      cashback_paise: 0, raw_cashback_paise: 0, category: 'TOP_UP', note, status: 'SUCCESS', created_at: now.toISOString(),
      balance_after_paise: newBalance, walletBalancePaise: newBalance, duplicate: false };
  })();
}
