import { db } from '../db/database.js';
import { istMonthRange } from '../utils/time.js';

export function reconcileMonth(month) {
  const { start, end } = istMonthRange(month);   // IST calendar month, expressed in UTC
  const rows = db.prepare(`SELECT category, COUNT(*) AS transaction_count,
    COALESCE(SUM(amount_paise),0) AS amount_paise, COALESCE(SUM(cashback_paise),0) AS cashback_paise
    FROM transactions WHERE type='PAYMENT' AND status='SUCCESS' AND created_at>=? AND created_at<? GROUP BY category ORDER BY category`).all(start, end);
  const topups = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(amount_paise),0) AS total FROM transactions
    WHERE type='TOPUP' AND status='SUCCESS' AND created_at>=? AND created_at<?`).get(start, end);
  const totals = rows.reduce((a, r) => ({ transactions: a.transactions + r.transaction_count, amountPaise: a.amountPaise + r.amount_paise, cashbackPaise: a.cashbackPaise + r.cashback_paise }),
    { transactions: 0, amountPaise: 0, cashbackPaise: 0 });
  return { month, timezone: 'Asia/Kolkata', categories: rows,
    totals: { ...totals, topUpCount: topups.n, topUpPaise: topups.total,
      effectiveCashbackPercent: totals.amountPaise ? Number(((totals.cashbackPaise / totals.amountPaise) * 100).toFixed(2)) : 0 },
    generatedAt: new Date().toISOString() };
}
