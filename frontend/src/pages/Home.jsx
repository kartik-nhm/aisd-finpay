import { useState } from 'react';
import { Eye, EyeOff, CreditCard, Plus, Gift } from 'lucide-react';
import { inr, inrShort } from '../format.js';
import { BarChart, Donut, Meter, Modal, TxRow, CATS } from '../ui.jsx';

const mask = id => String([...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 10000, 7)).padStart(4, '0');
const BALANCE_PASSWORD = 'FinPay@2026';

export default function Home({ wallet, insights, txns, go, openTx }) {
  const [hidden, setHidden] = useState(true);
  const [unlockingBalance, setUnlockingBalance] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const cats = insights.categories.filter(c => c.spentPaise > 0).sort((a, b) => b.spentPaise - a.spentPaise);
  const left = Math.max(0, insights.ceilingPaise - insights.cashbackThisMonthPaise);
  const dailyLeft = Math.max(0, insights.limits.dailySpendPaise - insights.spentTodayPaise);

  function toggleBalance() {
    if (hidden) {
      setPassword('');
      setPasswordError('');
      setUnlockingBalance(true);
      return;
    }
    setHidden(true);
  }

  function unlockBalance() {
    if (password !== BALANCE_PASSWORD) {
      setPasswordError('Incorrect password');
      return;
    }
    setHidden(false);
    setUnlockingBalance(false);
    setPassword('');
    setPasswordError('');
  }

  return (
    <div className="stack">
      <section className="hero">
        <article className="wallet-card">
          <header>
            <span className="wc-brand">FinPay Neo • Campus Digital Wallet</span>
            <button className="icon-btn ghost" onClick={toggleBalance} aria-label={hidden ? 'Show balance' : 'Hide balance'}>{hidden ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </header>
          <p className="wc-label">Wallet balance</p>
          <p className="wc-balance">{hidden ? '₹ ••••••' : inr(wallet.balance_paise)}</p>
          <footer>
            <span><b>{wallet.student_name}</b><small>Wallet •••• {mask(wallet.id)}</small></span>
            <em className={`tier-chip on-dark ${wallet.tier.toLowerCase()}`}>{wallet.tier.charAt(0) + wallet.tier.slice(1).toLowerCase()} tier</em>
          </footer>
        </article>

        <article className="panel coin-panel">
          <p className="panel-kicker">Cashback earned in {new Date().toLocaleString('en-IN', { month: 'long' })}</p>
          <p className="big-coin"><span className="coin-dot" />{inr(insights.cashbackThisMonthPaise)}</p>
          <Meter value={insights.cashbackThisMonthPaise} max={insights.ceilingPaise} label="Monthly cashback ceiling used" />
          <p className="muted small">{left > 0 ? `${inr(left)} left before your ${inrShort(insights.ceilingPaise)} monthly ceiling.` : `You have reached your ${inrShort(insights.ceilingPaise)} ceiling. It resets next month.`}</p>
          <button className="link-btn strong" onClick={() => go('rewards')}>See how your rewards work</button>
        </article>
      </section>

      <section className="actions">
        <button className="action" onClick={() => go('pay')}><span><CreditCard size={20} /></span>Pay a merchant</button>
        <button className="action" onClick={() => go('topup')}><span><Plus size={20} /></span>Add money</button>
        <button className="action" onClick={() => go('rewards')}><span><Gift size={20} /></span>My rewards</button>
      </section>

      <section className="kpis">
        <article className="panel kpi"><small>Spent this month</small><b>{inr(insights.spentThisMonthPaise)}</b></article>
        <article className="panel kpi"><small>Spent today</small><b>{inr(insights.spentTodayPaise)}</b><em>{inrShort(dailyLeft)} left of today's limit</em></article>
        <article className="panel kpi"><small>Cashback earned in total</small><b className="coin-text">{inr(insights.lifetimeCashbackPaise)}</b><em>across {insights.lifetimePayments} payments</em></article>
      </section>

      <section className="grid-2">
        <article className="panel">
          <div className="panel-head"><h3>Spending, last 14 days</h3></div>
          <BarChart data={insights.daily} />
        </article>
        <article className="panel">
          <div className="panel-head"><h3>Where it went this month</h3></div>
          {cats.length ? (
            <div className="donut-wrap">
              <Donut items={cats.map(c => ({ category: c.category, value: c.spentPaise }))} total={insights.spentThisMonthPaise} />
              <ul className="legend">{cats.map(c => <li key={c.category}><i style={{ background: CATS[c.category].color }} />{CATS[c.category].label}<b>{inrShort(c.spentPaise)}</b></li>)}</ul>
            </div>
          ) : <p className="empty">No spending yet this month. Your first payment will show up here.</p>}
        </article>
      </section>

      <article className="panel">
        <div className="panel-head"><h3>Recent activity</h3><button className="link-btn strong" onClick={() => go('history')}>View all</button></div>
        {txns.length ? <div className="tx-list">{txns.slice(0, 6).map(t => <TxRow key={t.id} tx={t} onClick={() => openTx(t)} />)}</div> : <p className="empty">No activity yet.</p>}
      </article>

      {unlockingBalance && (
        <Modal onClose={() => { setUnlockingBalance(false); setPasswordError(''); setPassword(''); }} label="Unlock wallet balance">
          <div className="balance-password">
            <h2>Unlock wallet balance</h2>
            <p className="muted small">Enter your payment password to view the balance.</p>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" aria-label="Wallet password" />
            {passwordError && <p className="form-error">{passwordError}</p>}
            <div className="btn-row">
              <button className="btn" onClick={() => { setUnlockingBalance(false); setPasswordError(''); setPassword(''); }}>Cancel</button>
              <button className="btn primary" onClick={unlockBalance}>Show balance</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
