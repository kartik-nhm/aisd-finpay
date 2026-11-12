import { randomBytes } from 'node:crypto';
import { istDateKey } from './time.js';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Receipt reference such as FP261106K7M2QX (prefix + IST date + 6 random chars). */
export function makeReference(prefix = 'FP', date = new Date()) {
  const day = istDateKey(date).replaceAll('-', '').slice(2);
  return prefix + day + [...randomBytes(6)].map(b => ALPHABET[b % ALPHABET.length]).join('');
}
