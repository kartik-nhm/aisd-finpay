import { useRef, useState } from 'react';
import { Landmark, Smartphone, CreditCard, Info } from 'lucide-react';
import { api } from '../api.js';
import { inr, inrShort, uuid } from '../format.js';
import { Receipt } from '../ui.jsx';

const METHODS = [
  { id: 'UPI', label: 'UPI', hint: 'Pay with any UPI app', Icon: Smartphone },
  { id: 'CARD', label: 'Debit card', hint: 'Visa, Mastercard, RuPay', Icon: CreditCard },
  { id: 'NETBANKING', label: 'Net banking', hint: 'Most Indian banks', Icon: Landmark }
];
const QUICK = [200, 500, 1000, 2000, 5000];

export default function TopUp({ wallet, insights, onChanged }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('UPI');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const key = useRef(null);
  const { minTopUpPaise, maxTopUpPaise, maxBalancePaise } = insights.limits;
  const value = Number(amount), paise = Math.round(value * 100);
  const valid = amount !== '' && paise >= minTopUpPaise && paise <= maxTopUpPaise && Math.abs(value * 100 - paise) < 1e-7;
  const room = maxBalancePaise - wallet.balance_paise;

  async function submit(e) {
    e.preventDefault(); if (!valid) return;
    setBusy(true); setError('');
    key.current ||= uuid();
    try {
      const tx = await api('/wallet/topup', { method: 'POST', body: { amount: value, method }, idempotencyKey: key.current });
      key.current = null; setReceipt(tx); setAmount(''); await onChanged();
    } catch (err) { setError(err.message); key.current = null; } finally { setBusy(false); }
  }

  return (
    <div className="narrow">
      <form className="panel stack" onSubmit={submit}>
        <div>
          <h3 className="section-title">Add money to your wallet</h3>
          <p className="muted small">Current balance {inr(wallet.balance_paise)}. You can add up to {inrShort(Math.min(maxTopUpPaise, room))} right now.</p>
        </div>
        <label className="amount-field big">
          <span>₹</span>
          <input inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} aria-label="Top-up amount in rupees" />
        </label>
        <div className="chips">{QUICK.map(q => <button type="button" key={q} className={`chip ${Number(amount) === q ? 'on' : ''}`} onClick={() => setAmount(String(q))}>+₹{q}</button>)}</div>
        <fieldset className="methods">
          <legend>Pay with</legend>
          {METHODS.map(({ id, label, hint, Icon }) => (
            <label key={id} className={`method ${method === id ? 'on' : ''}`}>
              <input type="radio" name="method" checked={method === id} onChange={() => setMethod(id)} />
              <span className="cat-icon" style={{ '--c': '#0b8f7e' }}><Icon size={19} /></span>
              <span><b>{label}</b><small>{hint}</small></span>
            </label>
          ))}
        </fieldset>
        {amount !== '' && !valid && <p className="form-error">Enter between {inrShort(minTopUpPaise)} and {inrShort(maxTopUpPaise)}, with at most two decimals.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary wide" disabled={!valid || busy}>{busy ? 'Adding…' : valid ? `Add ${inr(paise)}` : 'Add money'}</button>
        <p className="fine"><Info size={14} /> Demo mode: the payment gateway is simulated and no real money moves. Top-ups do not earn cashback.</p>
      </form>
      {receipt && <Receipt tx={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
