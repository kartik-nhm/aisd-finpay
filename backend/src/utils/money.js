const bad = message => Object.assign(new Error(message), { status: 400 });

export function rupeesToPaise(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw bad('Amount must be a positive number');
  const paise = Math.round(value * 100);
  if (Math.abs(value * 100 - paise) > 1e-7) throw bad('Amount can have at most two decimal places');
  return paise;
}
export function paiseToRupees(paise) { return (paise / 100).toFixed(2); }
/** Human readable: 1000 -> "₹10", 750 -> "₹7.50". Used in server-generated notes. */
export function inr(paise) { return `₹${paise % 100 === 0 ? paise / 100 : (paise / 100).toFixed(2)}`; }
