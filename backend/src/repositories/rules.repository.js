import { db } from '../db/database.js';

export const getRules = () => Object.fromEntries(db.prepare(`SELECT category, rate_percent AS ratePercent, min_txn_paise AS minTxnPaise,
  per_txn_cap_paise AS perTxnCapPaise, monthly_cap_paise AS monthlyCapPaise FROM cashback_rules ORDER BY category`).all().map(r => [r.category, r]));
