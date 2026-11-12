import { useCallback, useEffect, useState } from 'react';
import { Wallet, LayoutDashboard, CreditCard, Plus, Gift, History as HistoryIcon, ClipboardList, LogOut, ShieldCheck } from 'lucide-react';
import { api, getToken, setToken } from './api.js';
import { initials } from './format.js';
import { Receipt, Toast } from './ui.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Pay from './pages/Pay.jsx';
import TopUp from './pages/TopUp.jsx';
import Rewards from './pages/Rewards.jsx';
import History from './pages/History.jsx';
import Admin from './pages/Admin.jsx';

const NAV = [
  { id: 'home', label: 'Home', Icon: LayoutDashboard },
  { id: 'pay', label: 'Pay', Icon: CreditCard },
  { id: 'topup', label: 'Add money', Icon: Plus },
  { id: 'rewards', label: 'Rewards', Icon: Gift },
  { id: 'history', label: 'Activity', Icon: HistoryIcon },
  { id: 'recon', label: 'Reconciliation', Icon: ClipboardList, admin: true }
];
const TITLES = { home: 'Your wallet', pay: 'Pay a merchant', topup: 'Add money', rewards: 'Rewards', history: 'Activity', recon: 'Reconciliation' };

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('home');
  const [toast, setToast] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const notify = useCallback((type, text) => setToast({ type, text, id: Date.now() }), []);

  const refresh = useCallback(async () => {
    try {
      const [wallet, merchants, txns, insights, who] = await Promise.all([api('/wallet'), api('/merchants'), api('/transactions?limit=200'), api('/insights'), api('/me')]);
      setData({ wallet, merchants, txns, insights }); setMe(who);
    } catch (e) { notify('error', e.message); }
  }, [notify]);

  useEffect(() => { if (authed) refresh(); }, [authed, refresh]);
  useEffect(() => {
    const out = () => { setAuthed(false); setData(null); setMe(null); setTab('home'); };
    window.addEventListener('finpay:logout', out);
    return () => window.removeEventListener('finpay:logout', out);
  }, []);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  const isAdmin = ['ADMIN', 'FINANCE_ADMIN'].includes(me?.role);
  const items = NAV.filter(n => !n.admin || isAdmin);
  const logout = () => { setToken(''); setAuthed(false); setData(null); setMe(null); setTab('home'); };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Wallet size={19} /></span>FinPay Neo</div>
        <nav aria-label="Main">
          {items.map(({ id, label, Icon }) => <button key={id} className={`nav ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}><Icon size={19} /><span>{label}</span></button>)}
        </nav>
        <div className="side-foot">
          <p className="secure"><ShieldCheck size={16} /> Secured with campus sign-in</p>
          <button className="nav" onClick={logout}><LogOut size={19} /><span>Sign out</span></button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1>{TITLES[tab]}</h1>
          {data && <div className="profile"><span className="avatar">{initials(data.wallet.student_name)}</span><span><b>{data.wallet.student_name}</b><small>{isAdmin ? 'Finance admin' : `${data.wallet.tier.charAt(0)}${data.wallet.tier.slice(1).toLowerCase()} member`}</small></span></div>}
        </header>
        {!data ? <div className="loading"><span className="spinner" />Loading your wallet…</div> : (
          <>
            {tab === 'home' && <Home wallet={data.wallet} insights={data.insights} txns={data.txns} go={setTab} openTx={setReceipt} />}
            {tab === 'pay' && <Pay wallet={data.wallet} merchants={data.merchants} insights={data.insights} onChanged={refresh} notify={notify} />}
            {tab === 'topup' && <TopUp wallet={data.wallet} insights={data.insights} onChanged={refresh} />}
            {tab === 'rewards' && <Rewards insights={data.insights} />}
            {tab === 'history' && <History txns={data.txns} openTx={setReceipt} />}
            {tab === 'recon' && isAdmin && <Admin notify={notify} />}
          </>
        )}
      </main>

      <nav className="tabbar" aria-label="Main">
        {items.map(({ id, label, Icon }) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}><Icon size={20} /><span>{label === 'Add money' ? 'Add' : label === 'Reconciliation' ? 'Admin' : label}</span></button>)}
      </nav>

      {receipt && <Receipt tx={receipt} heading={receipt.type === 'TOPUP' ? 'Money added' : 'Payment receipt'} onClose={() => setReceipt(null)} />}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}
