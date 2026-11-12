import { db } from '../db/database.js';
import { istMonthStart } from '../utils/time.js';

/** What this wallet has spent / earned in the current IST calendar month, per category and overall. */
export function monthEarned(walletId, now = new Date()) {
  const rows = db.prepare(`SELECT category, COALESCE(SUM(cashback_paise),0) AS earned, COALESCE(SUM(amount_paise),0) AS spent, COUNT(*) AS count
    FROM transactions WHERE wallet_id=? AND type='PAYMENT' AND status='SUCCESS' AND created_at>=? GROUP BY category`).all(walletId, istMonthStart(now));
  const byCategory = Object.fromEntries(rows.map(r => [r.category, r]));
  return { byCategory, totalEarned: rows.reduce((a, r) => a + r.earned, 0), totalSpent: rows.reduce((a, r) => a + r.spent, 0) };
}

export function spentSince(walletId, isoStart) {
  return db.prepare(`SELECT COALESCE(SUM(amount_paise),0) AS total FROM transactions
    WHERE wallet_id=? AND type='PAYMENT' AND status='SUCCESS' AND created_at>=?`).get(walletId, isoStart).total;
}
