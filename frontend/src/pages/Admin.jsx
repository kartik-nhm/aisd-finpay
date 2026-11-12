import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { inr, inrShort } from '../format.js';
import { CATS } from '../ui.jsx';

export default function Admin({ notify }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [recon, setRecon] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [busy, setBusy] = useState(false);

  async function run(m = month) {
    setBusy(true);
    try { setRecon(await api(`/admin/reconciliation/${m}`)); } catch (e) { notify('error', e.message); } finally { setBusy(false); }
  }
  useEffect(() => { run(); api('/admin/wallets').then(setWallets).catch(() => {}); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  function downloadCsv() {
    if (!recon) return;
    let csv = 'Category,Transactions,Volume (INR),Cashback (INR),Effective Rate (%)\n';
    for (const c of recon.categories) {
      const vol = (c.amount_paise / 100).toFixed(2);
      const cb = (c.cashback_paise / 100).toFixed(2);
      const rate = c.amount_paise ? ((c.cashback_paise / c.amount_paise) * 100).toFixed(2) : '0.00';
      csv += `"${c.category}",${c.transaction_count},${vol},${cb},${rate}%\n`;
    }
    const totVol = (recon.totals.amountPaise / 100).toFixed(2);
    const totCb = (recon.totals.cashbackPaise / 100).toFixed(2);
    csv += `\n"TOTAL",${recon.totals.transactions},${totVol},${totCb},${recon.totals.effectiveCashbackPercent}%\n`;
    csv += `"TOPUPS",${recon.totals.topUpCount},${(recon.totals.topUpPaise / 100).toFixed(2)},0.00,0.00%\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finpay-reconciliation-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="stack">
      <article className="panel">
        <div className="panel-head"><h3>Monthly reconciliation</h3><em className="muted small">IST calendar month</em></div>
        <div className="recon-controls">
          <label>Month<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>
          <button className="btn primary" onClick={() => run()} disabled={busy}>{busy ? 'Loading…' : 'Generate report'}</button>
          <button className="btn" onClick={downloadCsv} disabled={busy || !recon}>Export CSV</button>
        </div>
        {recon && <>
          <div className="kpis tight">
            <div className="kpi flat"><small>Payments</small><b>{recon.totals.transactions}</b></div>
            <div className="kpi flat"><small>Payment volume</small><b>{inr(recon.totals.amountPaise)}</b></div>
            <div className="kpi flat"><small>Cashback paid out</small><b className="coin-text">{inr(recon.totals.cashbackPaise)}</b><em>{recon.totals.effectiveCashbackPercent}% of volume</em></div>
            <div className="kpi flat"><small>Money added</small><b>{inr(recon.totals.topUpPaise)}</b><em>{recon.totals.topUpCount} top-ups</em></div>
          </div>
          {recon.categories.length ? (
            <div className="table-wrap"><table>
              <thead><tr><th>Category</th><th>Payments</th><th>Volume</th><th>Cashback</th><th>Effective rate</th></tr></thead>
              <tbody>{recon.categories.map(r => <tr key={r.category}><td><b>{CATS[r.category]?.label || r.category}</b></td><td>{r.transaction_count}</td><td>{inr(r.amount_paise)}</td><td>{inr(r.cashback_paise)}</td><td>{r.amount_paise ? ((r.cashback_paise / r.amount_paise) * 100).toFixed(2) : '0.00'}%</td></tr>)}</tbody>
            </table></div>
          ) : <p className="empty">No payments in this month.</p>}
          <p className="fine">Generated {new Date(recon.generatedAt).toLocaleString('en-IN')}. Top-ups are reported separately and are not part of payment volume.</p>
        </>}
      </article>
      <article className="panel">
        <div className="panel-head"><h3>Wallets</h3></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Student</th><th>Tier</th><th>Balance</th></tr></thead>
          <tbody>{wallets.map(w => <tr key={w.id}><td><b>{w.student_name}</b><br /><small className="muted">{w.student_id}</small></td><td>{w.tier}</td><td>{inrShort(w.balance_paise)}</td></tr>)}</tbody>
        </table></div>
      </article>
    </div>
  );
}
