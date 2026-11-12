import { Gift, Check } from 'lucide-react';
import { inr, inrShort } from '../format.js';
import { CATS, CatIcon, Meter } from '../ui.jsx';

export default function Rewards({ insights }) {
  const { tiers, tier } = insights;
  const left = Math.max(0, insights.ceilingPaise - insights.cashbackThisMonthPaise);
  return (
    <div className="stack">
      <section className="kpis">
        <article className="panel kpi"><small>Earned this month</small><b className="coin-text">{inr(insights.cashbackThisMonthPaise)}</b><em>{inr(left)} left to earn</em></article>
        <article className="panel kpi"><small>Monthly ceiling ({tier.toLowerCase()} tier)</small><b>{inrShort(insights.ceilingPaise)}</b><em>across all categories</em></article>
        <article className="panel kpi"><small>Earned in total</small><b>{inr(insights.lifetimeCashbackPaise)}</b><em>{insights.lifetimePayments} payments</em></article>
      </section>

      <article className="panel">
        <div className="panel-head"><h3>Your cashback by category</h3><em className="muted small">Resets on the 1st of every month</em></div>
        <div className="cat-rows">
          {insights.categories.map(c => (
            <div key={c.category} className="cat-row">
              <CatIcon category={c.category} />
              <div className="cat-body">
                <div className="cat-top"><b>{CATS[c.category].label}</b><span><b className="coin-text">{inr(c.earnedPaise)}</b> of {inrShort(c.monthlyCapPaise)}</span></div>
                <Meter value={c.earnedPaise} max={c.monthlyCapPaise} label={`${CATS[c.category].label} monthly cap used`} />
                <small className="muted">{c.ratePercent}% back, spend {inrShort(c.minTxnPaise)}+ to qualify, up to {inrShort(c.perTxnCapPaise)} per payment</small>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="panel">
        <div className="panel-head"><h3>Tiers</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tier</th><th>Cashback rate</th><th>Category caps</th><th>Monthly ceiling</th></tr></thead>
            <tbody>
              {Object.entries(tiers).map(([name, t]) => (
                <tr key={name} className={name === tier ? 'me' : ''}>
                  <td><b>{name.charAt(0) + name.slice(1).toLowerCase()}</b>{name === tier && <em className="tier-chip prime small-chip">You</em>}</td>
                  <td>{t.rateMultiplier}× base rate</td><td>{t.capMultiplier}× base caps</td><td>{inrShort(t.monthlyCeilingPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel">
        <div className="panel-head"><h3>How cashback works</h3></div>
        <ul className="how">
          <li><Check size={16} />Cashback is credited to your wallet instantly with every qualifying payment.</li>
          <li><Check size={16} />Each category has a minimum payment, a per-payment limit and a monthly cap.</li>
          <li><Check size={16} />Your tier multiplies the rate and the caps. A monthly ceiling covers all categories together.</li>
          <li><Check size={16} />Wallet top-ups never earn cashback. Amounts are rounded down to the nearest paisa.</li>
        </ul>
      </article>
    </div>
  );
}
