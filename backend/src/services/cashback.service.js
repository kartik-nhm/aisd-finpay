import { TIERS } from '../config/rules.js';
import { inr } from '../utils/money.js';

const bad = message => Object.assign(new Error(message), { status: 400 });

/**
 * Pure calculation, no database access. Returns RAW cashback in integer paise (before any caps).
 * Uses integer maths (basis points x multiplier percent) so values like 1.5% x 1.25 never suffer
 * floating-point drift; the result is floored, never rounded up.
 */
export function calculateCashback(amountPaise, category, tier, rules) {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) throw bad('amountPaise must be a positive integer');
  const tierRule = TIERS[tier];
  const rule = rules[category];
  if (!tierRule || !rule) throw bad('Unsupported tier or merchant category');
  const rateBp = Math.round(rule.ratePercent * 100);            // 1.5% -> 150 bp
  const multPct = Math.round(tierRule.rateMultiplier * 100);    // 1.25x -> 125
  return Math.floor((amountPaise * rateBp * multPct) / (10000 * 100));
}

/**
 * Applies the realistic reward limits on top of the raw amount:
 *   1. minimum payment to qualify      2. per-payment ceiling
 *   3. monthly category cap            4. monthly tier ceiling (all categories)
 * Pure function: callers pass in what the wallet has already earned this month.
 */
export function applyCashbackLimits({ amountPaise, category, tier, rules, earnedCategoryPaise = 0, earnedTotalPaise = 0 }) {
  const rule = rules[category];
  const tierRule = TIERS[tier];
  const rawPaise = calculateCashback(amountPaise, category, tier, rules);
  const done = (cashbackPaise, limit = null, note = null) => ({ rawPaise, cashbackPaise, limit, note });

  if (amountPaise < (rule.minTxnPaise ?? 0)) return done(0, 'BELOW_MINIMUM', `Spend ${inr(rule.minTxnPaise)} or more to earn cashback here`);

  const perTxnCap = Math.floor((rule.perTxnCapPaise ?? Infinity) * tierRule.capMultiplier);
  const categoryLeft = Math.max(0, Math.floor(rule.monthlyCapPaise * tierRule.capMultiplier) - earnedCategoryPaise);
  const ceilingLeft = Math.max(0, tierRule.monthlyCeilingPaise - earnedTotalPaise);

  let cashback = rawPaise, limit = null, note = null;
  if (cashback > perTxnCap) { cashback = perTxnCap; limit = 'PER_TXN_CAP'; note = `Cashback is capped at ${inr(perTxnCap)} per payment`; }
  if (cashback > categoryLeft) {
    cashback = categoryLeft;
    limit = categoryLeft === 0 ? 'CATEGORY_CAP_REACHED' : 'CATEGORY_CAP_PARTIAL';
    note = categoryLeft === 0 ? 'Monthly cashback limit for this category reached' : 'Monthly category limit reached with this payment';
  }
  if (cashback > ceilingLeft) {
    cashback = ceilingLeft;
    limit = 'TIER_CEILING';
    note = ceilingLeft === 0 ? `You have hit your ${inr(tierRule.monthlyCeilingPaise)} monthly cashback ceiling` : 'Monthly cashback ceiling reached with this payment';
  }
  return done(cashback, limit, note);
}
