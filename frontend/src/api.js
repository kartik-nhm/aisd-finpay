const API = import.meta.env.VITE_API_URL || '/api';
let token = localStorage.getItem('finpay_token') || '';

export const getToken = () => token;
export function setToken(value) {
  token = value || '';
  token ? localStorage.setItem('finpay_token', token) : localStorage.removeItem('finpay_token');
}

export async function api(path, { method = 'GET', body, idempotencyKey } = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new Error('Cannot reach the FinPay server. Make sure the backend is running on port 4000.');
  }
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (res.status === 401 && token) { setToken(''); window.dispatchEvent(new Event('finpay:logout')); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
