// A campus wallet settles in Indian Standard Time, so "today" and "this month" are IST boundaries.
const OFFSET_MS = 330 * 60 * 1000;

export const istDateKey = d => new Date(new Date(d).getTime() + OFFSET_MS).toISOString().slice(0, 10);
export const istMonthKey = d => istDateKey(d).slice(0, 7);

export function istDayStart(date = new Date()) {
  const [y, m, d] = istDateKey(date).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - OFFSET_MS).toISOString();
}
export function istMonthStart(date = new Date()) {
  const [y, m] = istDateKey(date).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1) - OFFSET_MS).toISOString();
}
export function istMonthRange(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  const m = match ? Number(match[2]) : 0;
  if (m < 1 || m > 12) throw Object.assign(new Error('Month must use YYYY-MM format'), { status: 400 });
  const y = Number(match[1]);
  return { start: new Date(Date.UTC(y, m - 1, 1) - OFFSET_MS).toISOString(), end: new Date(Date.UTC(y, m, 1) - OFFSET_MS).toISOString() };
}
