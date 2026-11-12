import { useState } from 'react';
import { Wallet, Gift, ShieldCheck, Zap } from 'lucide-react';
import { setToken } from '../api.js';

const STUDENTS = [
  { id: 'student-rahul', name: 'Rahul Sharma', usn: '1RV21CS001', tier: 'Basic', note: 'Regular canteen & transit transactions' },
  { id: 'student-priya', name: 'Priya Rao', usn: '1RV21IS045', tier: 'Prime', note: 'Stationery, campus cafés & bookshop' },
  { id: 'student-aman', name: 'Aman Das', usn: '1RV21EC089', tier: 'Premium', note: 'Campus shuttles, hostel dues & store' }
];

export default function Login({ onLogin }) {
  const [student, setStudent] = useState('student-rahul');
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/dev/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: student, role: admin ? 'ADMIN' : 'STUDENT' }) });
      const data = await res.json();
      if (!data.token) throw new Error(data.error || 'Could not sign in');
      setToken(data.token); onLogin();
    } catch (err) {
      setError(err instanceof TypeError ? 'Cannot reach the FinPay server. Make sure the backend is running on port 4000.' : err.message);
    } finally { setBusy(false); }
  }

  return (
    <main className="login">
      <section className="login-hero">
        <div className="brand"><span className="brand-mark"><Wallet size={20} /></span>FinPay Neo</div>
        <h1>Smart campus payments.<br />Tiered cashback on every rupee.</h1>
        <ul className="pitch">
          <li><Gift size={18} /><span><b>Realistic Multi-Tier Cashback Engine</b>Earn up to 2% base reward boosted up to 1.5x by your membership tier.</span></li>
          <li><Zap size={18} /><span><b>Instant Frictionless Payments</b>Pay campus canteens, stationery, shuttles, hostel fees, and store.</span></li>
          <li><ShieldCheck size={18} /><span><b>Enterprise Financial Guardrails</b>Strict daily limits, idempotency protection, and automated reconciliation.</span></li>
        </ul>
      </section>
      <section className="login-card">
        <h2>Sign in to Campus Wallet</h2>
        <p className="muted">Demo mode: select an academic persona to open wallet. In production, authentication integrates with university single sign-on.</p>
        <form onSubmit={submit}>
          <div className="student-list" role="radiogroup" aria-label="Demo student">
            {STUDENTS.map(s => (
              <label key={s.id} className={`student ${student === s.id ? 'on' : ''}`}>
                <input type="radio" name="student" value={s.id} checked={student === s.id} onChange={() => setStudent(s.id)} />
                <span className="avatar">{s.name.split(' ').map(x => x[0]).join('')}</span>
                <span><b>{s.name}</b><small>{s.usn} • {s.note}</small></span>
                <em className={`tier-chip ${s.tier.toLowerCase()}`}>{s.tier}</em>
              </label>
            ))}
          </div>
          <label className="check-row"><input type="checkbox" checked={admin} onChange={e => setAdmin(e.target.checked)} /> Sign in as Finance Administrator (Reconciliation Suite)</label>
          <button className="btn primary wide" disabled={busy}>{busy ? 'Authenticating…' : 'Open Wallet'}</button>
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
