import { useEffect, useState } from 'react';
import { Utensils, BookOpen, Bus, Building2, ShoppingBag, Wallet, X, Check, Copy, Gift, Info } from 'lucide-react';
import { inr, inrShort, when, longWhen } from './format.js';

export const CATS = {
  CANTEEN: { label: 'Food & Dining', Icon: Utensils, color: '#F97316' },
  STATIONERY: { label: 'Stationery & Xerox', Icon: BookOpen, color: '#8B5CF6' },
  TRANSPORT: { label: 'Campus Transit', Icon: Bus, color: '#0EA5E9' },
  HOSTEL: { label: 'Hostel & Housing', Icon: Building2, color: '#10B981' },
  ONLINE: { label: 'Campus Store', Icon: ShoppingBag, color: '#EC4899' },
  TOP_UP: { label: 'Wallet Top-Up', Icon: Wallet, color: '#6366F1' }
};

export function CatIcon({ category, size = 20 }) {
  const { Icon, color } = CATS[category] || CATS.TOP_UP;
  return <span className="cat-icon" style={{ '--c': color }}><Icon size={size} strokeWidth={2} /></span>;
}

export function Modal({ onClose, label, children }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <button className="icon-btn close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        {children}
      </div>
    </div>
  );
}

export function Meter({ value, max, label }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return <div className={`meter ${pct >= 100 ? 'full' : ''}`} role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin="0" aria-valuemax="100"><i style={{ width: `${pct}%` }} /></div>;
}

export function Toast({ toast, onDone }) {
  useEffect(() => { if (!toast) return; const t = setTimeout(onDone, 4200); return () => clearTimeout(t); }, [toast, onDone]);
  if (!toast) return null;
  return <div className={`toast ${toast.type}`} role="status">{toast.type === 'error' ? <Info size={17} /> : <Check size={17} />}<span>{toast.text}</span></div>;
}

export function BarChart({ data }) {
  const w = 560, h = 176, base = h - 26, top = 14;
  const max = Math.max(1, ...data.map(d => d.amountPaise));
  const step = w / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label="Daily spending over the last 14 days">
      {[0.5, 1].map(f => <line key={f} x1="0" x2={w} y1={base - (base - top) * f} y2={base - (base - top) * f} className="grid-line" />)}
      {data.map((d, i) => {
        const bh = d.amountPaise ? Math.max(5, (d.amountPaise / max) * (base - top)) : 0;
        const x = i * step + step * 0.18, day = new Date(d.date + 'T12:00:00Z');
        const isToday = i === data.length - 1;
        return (
          <g key={d.date}>
            <rect x={i * step} y="0" width={step} height={h} fill="transparent"><title>{`${d.date}: ${inr(d.amountPaise)}`}</title></rect>
            {bh > 0 ? <rect x={x} y={base - bh} width={step * 0.64} height={bh} rx="6" className={isToday ? 'bar today' : 'bar'} /> : <rect x={x} y={base - 3} width={step * 0.64} height="3" rx="1.5" className="bar empty" />}
            <text x={i * step + step / 2} y={h - 6} textAnchor="middle" className="axis">{day.getUTCDate()}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({ items, total }) {
  const R = 54, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="donut" role="img" aria-label="Spending by category this month">
      <circle cx="70" cy="70" r={R} fill="none" stroke="var(--line)" strokeWidth="16" />
      {total > 0 && items.map(it => {
        const len = (it.value / total) * C;
        const el = <circle key={it.category} cx="70" cy="70" r={R} fill="none" stroke={CATS[it.category].color} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />;
        offset += len;
        return el;
      })}
      <text x="70" y="68" textAnchor="middle" className="donut-num">{inrShort(total)}</text>
      <text x="70" y="86" textAnchor="middle" className="donut-sub">this month</text>
    </svg>
  );
}

export function TxRow({ tx, onClick }) {
  const topUp = tx.type === 'TOPUP';
  return (
    <button className="tx" onClick={onClick}>
      <CatIcon category={tx.category} />
      <span className="tx-main"><b>{tx.merchant_name}</b><small>{topUp ? `${tx.note}, ${when(tx.created_at)}` : when(tx.created_at)}</small></span>
      <span className="tx-amt">
        <b className={topUp ? 'in' : ''}>{topUp ? '+' : '−'}{inr(tx.amount_paise)}</b>
        {tx.cashback_paise > 0 && <small className="coin-text">+{inrShort(tx.cashback_paise)} cashback</small>}
      </span>
    </button>
  );
}

export function Receipt({ tx, heading, onClose }) {
  const [copied, setCopied] = useState(false);
  const topUp = tx.type === 'TOPUP';
  const copy = async () => { try { await navigator.clipboard.writeText(tx.reference); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } };
  return (
    <Modal onClose={onClose} label="Receipt">
      <div className="receipt">
        <span className="check-ring"><Check size={30} strokeWidth={3} /></span>
        <p className="receipt-kicker">{heading || (topUp ? 'Money added' : 'Payment successful')}</p>
        <h2 className="receipt-amt">{inr(tx.amount_paise)}</h2>
        <p className="muted">{topUp ? tx.note : `Paid to ${tx.merchant_name}`}</p>
        {tx.cashback_paise > 0 && <div className="coin-note"><Gift size={18} /><span><b>{inr(tx.cashback_paise)} cashback</b> added to your wallet{tx.note && <small>{tx.note}</small>}</span></div>}
        {!topUp && tx.cashback_paise === 0 && tx.note && <div className="info-note"><Info size={16} /><span>{tx.note}</span></div>}
        <dl className="receipt-rows">
          <div><dt>Reference</dt><dd>{tx.reference}<button className="link-btn" onClick={copy}>{copied ? 'Copied' : <Copy size={13} />}</button></dd></div>
          <div><dt>Date</dt><dd>{longWhen(tx.created_at)}</dd></div>
          {!topUp && <div><dt>Category</dt><dd>{CATS[tx.category]?.label}</dd></div>}
          <div><dt>Wallet balance after</dt><dd>{inr(tx.balance_after_paise)}</dd></div>
        </dl>
        <button className="btn primary wide" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}
