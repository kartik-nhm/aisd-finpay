import { db } from '../db/database.js';
import { LIMITS, TIERS } from '../config/rules.js';
import { getRules } from '../repositories/rules.repository.js';
import { monthEarned } from '../repositories/ledger.repository.js';
import { istDateKey, istDayStart, istMonthKey } from '../utils/time.js';

/** Everything the dashboard + rewards screens need, computed from the ledger. */
export function buildInsights(studentId, now = new Date()) {
  const wallet = db.prepare('SELECT * FROM wallets WHERE student_id=?').get(studentId);
  if (!wallet) return null;
  const tier = TIERS[wallet.tier], rules = getRules(), earned = monthEarned(wallet.id, now);

  const categories = Object.entries(rules).map(([category, r]) => ({
    category,
    ratePercent: Number((r.ratePercent * tier.rateMultiplier).toFixed(3)),
    minTxnPaise: r.minTxnPaise,
    perTxnCapPaise: Math.floor(r.perTxnCapPaise * tier.capMultiplier),
    monthlyCapPaise: Math.floor(r.monthlyCapPaise * tier.capMultiplier),
    earnedPaise: earned.byCategory[category]?.earned || 0,
    spentPaise: earned.byCategory[category]?.spent || 0,
    count: earned.byCategory[category]?.count || 0
  }));

  const since = new Date(new Date(istDayStart(now)).getTime() - 13 * 86400000).toISOString();
  const rows = db.prepare(`SELECT amount_paise, created_at FROM transactions WHERE wallet_id=? AND type='PAYMENT' AND status='SUCCESS' AND created_at>=?`).all(wallet.id, since);
  const byDay = {};
  for (const r of rows) byDay[istDateKey(r.created_at)] = (byDay[istDateKey(r.created_at)] || 0) + r.amount_paise;
  const daily = Array.from({ length: 14 }, (_, i) => {
    const date = istDateKey(new Date(new Date(istDayStart(now)).getTime() - (13 - i) * 86400000 + 3600000));
    return { date, amountPaise: byDay[date] || 0 };
  });

  const lifetime = db.prepare(`SELECT COALESCE(SUM(cashback_paise),0) AS cashback, COUNT(*) AS payments FROM transactions
    WHERE wallet_id=? AND type='PAYMENT' AND status='SUCCESS'`).get(wallet.id);

  return {
    month: istMonthKey(now), tier: wallet.tier,
    tierBenefits: { ...tier }, tiers: TIERS,
    spentThisMonthPaise: earned.totalSpent, cashbackThisMonthPaise: earned.totalEarned,
    ceilingPaise: tier.monthlyCeilingPaise,
    lifetimeCashbackPaise: lifetime.cashback, lifetimePayments: lifetime.payments,
    spentTodayPaise: daily[13].amountPaise, limits: LIMITS, categories, daily
  };
}
