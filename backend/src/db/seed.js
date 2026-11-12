import { randomUUID } from 'node:crypto';
import { CATEGORY_RULES, LIMITS } from '../config/rules.js';
import { applyCashbackLimits } from '../services/cashback.service.js';
import { makeReference } from '../utils/reference.js';
import { istMonthKey } from '../utils/time.js';

const OFFSET_MS = 330 * 60 * 1000;
const HISTORY_DAYS = 45;
const CATEGORY_OF = { 'm-canteen': 'CANTEEN', 'm-cafe': 'CANTEEN', 'm-chai': 'CANTEEN', 'm-stationery': 'STATIONERY', 'm-xerox': 'STATIONERY',
  'm-transport': 'TRANSPORT', 'm-cab': 'TRANSPORT', 'm-hostel': 'HOSTEL', 'm-laundry': 'HOSTEL', 'm-online': 'ONLINE' };
// Typical rupee amounts for each merchant. Tiny amounts intentionally fall below cashback minimums.
const AMOUNTS = { 'm-canteen': [40, 55, 70, 85, 110, 140], 'm-cafe': [60, 90, 120, 180, 240], 'm-chai': [10, 15, 20, 30, 40],
  'm-stationery': [25, 45, 80, 120, 250, 420], 'm-xerox': [8, 12, 30, 60, 150], 'm-transport': [10, 15, 20, 30, 300],
  'm-cab': [60, 90, 140, 220], 'm-laundry': [60, 90, 120, 180], 'm-online': [149, 299, 449, 799, 1299] };

// weights decide how often each student shops at each merchant
const PROFILES = [
  { id: 'w-rahul', studentId: 'student-rahul', name: 'Rahul Sharma', tier: 'BASIC', seed: 11, hostelFee: 2800,
    weights: { 'm-canteen': 6, 'm-chai': 5, 'm-cafe': 2, 'm-xerox': 2, 'm-stationery': 1, 'm-transport': 2, 'm-laundry': 1, 'm-online': 0.4 } },
  { id: 'w-priya', studentId: 'student-priya', name: 'Priya Rao', tier: 'PRIME', seed: 23, hostelFee: 3200,
    weights: { 'm-canteen': 3, 'm-cafe': 4, 'm-chai': 2, 'm-stationery': 3, 'm-xerox': 3, 'm-cab': 1.5, 'm-transport': 1, 'm-online': 1, 'm-laundry': 1 } },
  { id: 'w-aman', studentId: 'student-aman', name: 'Aman Das', tier: 'PREMIUM', seed: 37, hostelFee: 3600,
    weights: { 'm-canteen': 3, 'm-cafe': 3, 'm-chai': 1, 'm-transport': 3, 'm-cab': 3, 'm-online': 2, 'm-stationery': 1, 'm-laundry': 1.5 } }
];

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, list) => list[Math.floor(r() * list.length)];
function weighted(r, weights) { const total = Object.values(weights).reduce((a, b) => a + b, 0); let x = r() * total; for (const [k, w] of Object.entries(weights)) { if ((x -= w) < 0) return k; } return Object.keys(weights)[0]; }

export function seedDemoData(db) {
  const rules = Object.fromEntries(Object.entries(CATEGORY_RULES));
  const insertWallet = db.prepare('INSERT INTO wallets(id,student_id,student_name,payment_password,tier,balance_paise,created_at) VALUES (?,?,?,?,?,?,?)');
  const setBalance = db.prepare('UPDATE wallets SET balance_paise=? WHERE id=?');
  const insertTx = db.prepare(`INSERT INTO transactions(id,wallet_id,merchant_id,idempotency_key,reference,type,amount_paise,cashback_paise,raw_cashback_paise,
    balance_after_paise,category,note,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'SUCCESS',?)`);

  const now = Date.now();
  const istMidnightToday = Math.floor((now + OFFSET_MS) / 86400000) * 86400000 - OFFSET_MS;

  db.transaction(() => {
    for (const p of PROFILES) {
      const r = rng(p.seed);
      const events = [{ ts: istMidnightToday - (HISTORY_DAYS + 1) * 86400000 + 9 * 3600000, type: 'TOPUP', amount: (r() < 0.5 ? 1000 : 1500) * 100, note: 'Added via UPI' }];
      for (let d = HISTORY_DAYS; d >= 1; d--) {
        const dayStart = istMidnightToday - d * 86400000;
        const dayOfMonth = new Date(dayStart + OFFSET_MS).getUTCDate();
        const n = (x => (x < 0.18 ? 0 : x < 0.55 ? 1 : x < 0.85 ? 2 : 3))(r());
        for (let i = 0; i < n; i++) {
          const merchant = weighted(r, p.weights);
          events.push({ ts: dayStart + (8 + r() * 13) * 3600000, type: 'PAYMENT', merchant, amount: Math.round(pick(r, AMOUNTS[merchant]) * 100) });
        }
        if (dayOfMonth === 2) events.push({ ts: dayStart + 10.5 * 3600000, type: 'PAYMENT', merchant: 'm-hostel', amount: p.hostelFee * 100 });
      }
      events.sort((a, b) => a.ts - b.ts);

      insertWallet.run(p.id, p.studentId, p.name, 'FinPay@2026', p.tier, 0, new Date(events[0].ts).toISOString());
      let balance = 0;
      const earnedCat = {}, earnedTotal = {};
      const topUp = (ts, amount, note) => {
        balance += amount;
        insertTx.run(randomUUID(), p.id, 'm-topup', `seed-${randomUUID()}`, makeReference('FP', new Date(ts)), 'TOPUP', amount, 0, 0, balance, 'TOP_UP', note, new Date(ts).toISOString());
      };
      for (const e of events) {
        if (e.type === 'TOPUP') { topUp(e.ts, e.amount, e.note); continue; }
        if (balance < e.amount) topUp(e.ts - 60000, Math.min(LIMITS.maxTopUpPaise, Math.ceil((e.amount - balance + 20000) / 50000) * 50000), pick(r, ['Added via UPI', 'Added via UPI', 'Added via Debit card']));
        const category = CATEGORY_OF[e.merchant], month = istMonthKey(e.ts);
        const res = applyCashbackLimits({ amountPaise: e.amount, category, tier: p.tier, rules,
          earnedCategoryPaise: earnedCat[`${month}:${category}`] || 0, earnedTotalPaise: earnedTotal[month] || 0 });
        earnedCat[`${month}:${category}`] = (earnedCat[`${month}:${category}`] || 0) + res.cashbackPaise;
        earnedTotal[month] = (earnedTotal[month] || 0) + res.cashbackPaise;
        balance = balance - e.amount + res.cashbackPaise;
        insertTx.run(randomUUID(), p.id, e.merchant, `seed-${randomUUID()}`, makeReference('FP', new Date(e.ts)), 'PAYMENT', e.amount, res.cashbackPaise, res.rawPaise, balance, category, res.note, new Date(e.ts).toISOString());
      }
      if (balance < 60000) topUp(istMidnightToday - 30 * 60000, 100000, 'Added via UPI');
      setBalance.run(balance, p.id);
    }
  })();
}
