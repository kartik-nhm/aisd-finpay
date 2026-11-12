import { useEffect, useMemo, useRef, useState } from 'react';
import { Gift, Info, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import { inr, inrShort, uuid } from '../format.js';
import { CATS, CatIcon, Modal, Receipt } from '../ui.jsx';

const QUICK = [20, 50, 100, 250, 500];

export default function Pay({ wallet, merchants, insights, onChanged, notify, preselect }) {
  const [merchantId, setMerchantId] = useState(preselect || merchants[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [preview, setPreview] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [paymentPassword, setPaymentPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const key = useRef(null);

  const merchant = merchants.find(m => m.id === merchantId);
  const rule = insights.categories.find(c => c.category === merchant?.category);
  const value = Number(amount);
  const valid = amount !== '' && value > 0 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
  const paise = valid ? Math.round(value * 100) : 0;
  const tooMuch = paise > wallet.balance_paise;

  const groups = useMemo(() => Object.entries(Object.groupBy ? Object.groupBy(merchants, m => m.category) : merchants.reduce((a, m) => ((a[m.category] ||= []).push(m), a), {})), [merchants]);

  // Live cashback quote from the server (same rules as the real payment).
  useEffect(() => {
    setPreview(null);
    if (!valid || !merchantId) return;
    const t = setTimeout(() => api('/cashback/preview', { method: 'POST', body: { merchantId, amount: value } }).then(setPreview).catch(() => setPreview(null)), 250);
    return () => clearTimeout(t);
  }, [amount, merchantId]);   // eslint-disable-line react-hooks/exhaustive-deps

  function review() { key.current = uuid(); setError(''); setPasswordError(''); setPaymentPassword(''); setConfirming(true); }
  async function confirm() {
    setBusy(true); setError(''); setPasswordError('');
    try {
      if (!paymentPassword || paymentPassword.trim().length < 4) {
        setPasswordError('Enter your payment password to continue.');
        return;
      }
      const tx = await api('/payments', { method: 'POST', body: { merchantId, amount: value, paymentPassword }, idempotencyKey: key.current });
      key.current = null; setConfirming(false); setReceipt(tx); setAmount(''); setPaymentPassword(''); await onChanged();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="pay-layout">
      <section className="stack">
        <h3 className="section-title">Choose where to pay</h3>
        {groups.map(([cat, list]) => {
          const r = insights.categories.find(c => c.category === cat);
          return (
            <div key={cat} className="merchant-group">
              <div className="group-head"><span>{CATS[cat].label}</span><em className="coin-chip">{r.ratePercent}% back, min {inrShort(r.minTxnPaise)}</em></div>
              <div className="merchant-grid">
                {list.map(m => (
                  <button key={m.id} type="button" className={`merchant ${m.id === merchantId ? 'on' : ''}`} onClick={() => setMerchantId(m.id)} aria-pressed={m.id === merchantId}>
                    <CatIcon category={m.category} /><span><b>{m.name}</b><small>{m.tagline}</small></span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <aside className="panel pay-panel">
        <p className="muted small">Paying</p>
        <h3 className="pay-to">{merchant?.name}</h3>
        <label className="amount-field">
          <span>₹</span>
          <input inputMode="decimal" type="number" min="0.01" step="0.01" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} aria-label="Amount in rupees" />
        </label>
        <div className="chips">{QUICK.map(q => <button type="button" key={q} className={`chip ${Number(amount) === q ? 'on' : ''}`} onClick={() => setAmount(String(q))}>₹{q}</button>)}</div>
        <p className="muted small">Wallet balance {inr(wallet.balance_paise)}</p>

        <div className={`quote ${preview?.cashbackPaise > 0 ? 'earn' : ''}`} aria-live="polite">
          {!valid && <><Gift size={18} /><span>Enter an amount to see your cashback. {rule && `${rule.ratePercent}% back at ${merchant.category === 'HOSTEL' ? 'hostel' : 'this merchant'}.`}</span></>}
          {valid && preview && preview.cashbackPaise > 0 && <><Gift size={18} /><span><b>You will earn {inr(preview.cashbackPaise)} cashback</b>{preview.note && <small>{preview.note}</small>}</span></>}
          {valid && preview && preview.cashbackPaise === 0 && <><Info size={18} /><span><b>No cashback on this payment</b><small>{preview.note}</small></span></>}
          {valid && !preview && <><Gift size={18} /><span>Calculating cashback…</span></>}
        </div>

        {tooMuch && <p className="form-error">This is more than your balance. Add money first.</p>}
        <button className="btn primary wide" disabled={!valid || tooMuch} onClick={review}>Review payment</button>
        <p className="fine"><ShieldCheck size={14} /> Limits: {inrShort(insights.limits.maxPaymentPaise)} per payment, {inrShort(insights.limits.dailySpendPaise)} per day.</p>
      </aside>

      {confirming && (
        <Modal onClose={() => !busy && setConfirming(false)} label="Confirm payment">
          <div className="confirm">
            <h2>Confirm payment</h2>
            <dl className="receipt-rows">
              <div><dt>Paying</dt><dd>{merchant.name}</dd></div>
              <div><dt>Amount</dt><dd><b>{inr(paise)}</b></dd></div>
              <div><dt>Cashback</dt><dd className="coin-text">{preview ? `+${inr(preview.cashbackPaise)}` : '…'}</dd></div>
              <div><dt>Balance after</dt><dd>{inr(wallet.balance_paise - paise + (preview?.cashbackPaise || 0))}</dd></div>
            </dl>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="btn-row">
              <button className="btn" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
              <button className="btn primary" onClick={confirm} disabled={busy}>{busy ? 'Paying…' : `Pay ${inr(paise)}`}</button>
            </div>
            <div className="payment-password">
              <label htmlFor="payment-password">Payment password</label>
              <input id="payment-password" type="password" value={paymentPassword} onChange={e => setPaymentPassword(e.target.value)} placeholder="••••" aria-label="Payment password" />
              {passwordError && <p className="form-error">{passwordError}</p>}
            </div>
          </div>
        </Modal>
      )}
      {receipt && <Receipt tx={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
