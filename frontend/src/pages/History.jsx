import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { dayLabel } from '../format.js';
import { TxRow } from '../ui.jsx';

const FILTERS = [['all', 'All'], ['PAYMENT', 'Payments'], ['TOPUP', 'Top-ups'], ['cashback', 'With cashback']];

export default function History({ txns, openTx }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = txns.filter(t => (filter === 'all' || (filter === 'cashback' ? t.cashback_paise > 0 : t.type === filter))
      && (!term || t.merchant_name.toLowerCase().includes(term) || t.reference.toLowerCase().includes(term)));
    const map = new Map();
    for (const t of rows) { const k = dayLabel(t.created_at); map.set(k, [...(map.get(k) || []), t]); }
    return [...map.entries()];
  }, [txns, filter, q]);

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="chips">{FILTERS.map(([id, label]) => <button key={id} className={`chip ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>{label}</button>)}</div>
        <label className="search"><Search size={16} /><input placeholder="Search merchant or reference" value={q} onChange={e => setQ(e.target.value)} aria-label="Search transactions" /></label>
      </div>
      {groups.length ? groups.map(([day, rows]) => (
        <section key={day} className="panel tx-group"><h4>{day}</h4><div className="tx-list">{rows.map(t => <TxRow key={t.id} tx={t} onClick={() => openTx(t)} />)}</div></section>
      )) : <p className="empty panel">Nothing matches. Try another filter or search.</p>}
    </div>
  );
}
