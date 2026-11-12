import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCashback, applyCashbackLimits } from '../src/services/cashback.service.js';
import { TIERS, CATEGORY_RULES } from '../src/config/rules.js';

const rules = {
  CANTEEN: { ratePercent: 2, minTxnPaise: 2000, perTxnCapPaise: 1000, monthlyCapPaise: 5000 },
  HOSTEL: { ratePercent: 0.25, minTxnPaise: 50000, perTxnCapPaise: 5000, monthlyCapPaise: 10000 }
};
const apply = (o) => applyCashbackLimits({ category: 'CANTEEN', tier: 'BASIC', rules, ...o });

test('BASIC canteen: ₹100 at 2% earns ₹2 (200 paise)', () => assert.equal(calculateCashback(10000, 'CANTEEN', 'BASIC', rules), 200));
test('PRIME multiplier is 1.25x on the rate', () => assert.equal(calculateCashback(10000, 'CANTEEN', 'PRIME', rules), 250));
test('PREMIUM multiplier is 1.5x on the rate', () => assert.equal(calculateCashback(10000, 'CANTEEN', 'PREMIUM', rules), 300));
test('cashback floors fractional paise', () => assert.equal(calculateCashback(333, 'CANTEEN', 'BASIC', rules), 6));
test('integer maths avoids float drift (1.5% x 1.25x of ₹10)', () => assert.equal(calculateCashback(1000, 'CANTEEN', 'PRIME', { CANTEEN: { ratePercent: 1.5 } }), 18));
test('unsupported category is rejected', () => assert.throws(() => calculateCashback(10000, 'TOP_UP', 'BASIC', rules), /Unsupported/));
test('tier cap multipliers and ceilings are configured', () => {
  assert.equal(TIERS.PRIME.capMultiplier, 1.5); assert.equal(TIERS.PREMIUM.capMultiplier, 2);
  assert.ok(TIERS.BASIC.monthlyCeilingPaise < TIERS.PRIME.monthlyCeilingPaise && TIERS.PRIME.monthlyCeilingPaise < TIERS.PREMIUM.monthlyCeilingPaise);
});
test('payments below the minimum earn nothing', () => {
  const r = apply({ amountPaise: 1500 });
  assert.equal(r.cashbackPaise, 0); assert.equal(r.limit, 'BELOW_MINIMUM');
});
test('per-payment cap applies', () => {
  const r = apply({ amountPaise: 100000 }); // 2% of ₹1000 = ₹20, capped at ₹10
  assert.equal(r.rawPaise, 2000); assert.equal(r.cashbackPaise, 1000); assert.equal(r.limit, 'PER_TXN_CAP');
});
test('monthly category cap gives a partial award then zero', () => {
  assert.equal(apply({ amountPaise: 40000, earnedCategoryPaise: 4700 }).cashbackPaise, 300);
  assert.equal(apply({ amountPaise: 40000, earnedCategoryPaise: 4700 }).limit, 'CATEGORY_CAP_PARTIAL');
  const none = apply({ amountPaise: 40000, earnedCategoryPaise: 5000 });
  assert.equal(none.cashbackPaise, 0); assert.equal(none.limit, 'CATEGORY_CAP_REACHED');
});
test('tier ceiling limits cashback across categories', () => {
  const r = apply({ amountPaise: 40000, earnedTotalPaise: TIERS.BASIC.monthlyCeilingPaise - 100 });
  assert.equal(r.cashbackPaise, 100); assert.equal(r.limit, 'TIER_CEILING');
});
test('PRIME gets a 1.5x monthly category cap', () => {
  assert.equal(applyCashbackLimits({ amountPaise: 400000, category: 'CANTEEN', tier: 'PRIME', rules, earnedCategoryPaise: 7000 }).cashbackPaise, 500);
});
test('shipped rules give a sensible headline rate (<= 2.5% for BASIC)', () => {
  for (const r of Object.values(CATEGORY_RULES)) assert.ok(r.ratePercent <= 2.5);
});
