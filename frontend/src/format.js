const IST = 'Asia/Kolkata';
const fmt = (paise, min) => (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: min, maximumFractionDigits: 2 });

/** 125296 -> ₹1,252.96 */
export const inr = paise => `₹${fmt(paise || 0, 2)}`;
/** 1000 -> ₹10, 750 -> ₹7.50 */
export const inrShort = paise => `₹${fmt(paise || 0, (paise || 0) % 100 === 0 ? 0 : 2)}`;
export const when = iso => new Date(iso).toLocaleString('en-IN', { timeZone: IST, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const longWhen = iso => new Date(iso).toLocaleString('en-IN', { timeZone: IST, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const dayKey = d => new Date(d).toLocaleDateString('en-CA', { timeZone: IST });
export function dayLabel(iso) {
  const k = dayKey(iso);
  if (k === dayKey(Date.now())) return 'Today';
  if (k === dayKey(Date.now() - 86400000)) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: IST, weekday: 'short', day: 'numeric', month: 'short' });
}
export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`);
export const initials = name => (name || '').split(' ').map(x => x[0]).join('').slice(0, 2);
