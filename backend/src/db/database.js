import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORY_RULES } from '../config/rules.js';
import { seedDemoData } from './seed.js';

const SCHEMA_VERSION = 2;
export const DEMO_PAYMENT_PASSWORD = 'FinPay@2026';
const filename = process.env.DATABASE_FILE || './data/finpay.sqlite';
if (filename !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
export const db = new Database(filename);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// This starter is a demo: when the schema version changes, demo tables are rebuilt from scratch.
if (db.pragma('user_version', { simple: true }) < SCHEMA_VERSION) {
  db.exec('DROP TABLE IF EXISTS transactions; DROP TABLE IF EXISTS wallets; DROP TABLE IF EXISTS merchants; DROP TABLE IF EXISTS cashback_rules;');
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
}

const ensureWalletPasswordColumn = () => {
  const cols = db.prepare('PRAGMA table_info(wallets)').all();
  if (!cols.some(c => c.name === 'payment_password')) {
    db.exec(`ALTER TABLE wallets ADD COLUMN payment_password TEXT NOT NULL DEFAULT '${DEMO_PAYMENT_PASSWORD}'`);
  }
};


db.exec(`
CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY, student_id TEXT NOT NULL UNIQUE, student_name TEXT NOT NULL,
  payment_password TEXT NOT NULL DEFAULT '${DEMO_PAYMENT_PASSWORD}',
  tier TEXT NOT NULL CHECK(tier IN ('BASIC','PRIME','PREMIUM')),
  balance_paise INTEGER NOT NULL CHECK(balance_paise >= 0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, tagline TEXT, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS cashback_rules (
  category TEXT PRIMARY KEY, rate_percent REAL NOT NULL, min_txn_paise INTEGER NOT NULL DEFAULT 0,
  per_txn_cap_paise INTEGER NOT NULL, monthly_cap_paise INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY, wallet_id TEXT NOT NULL REFERENCES wallets(id), merchant_id TEXT NOT NULL REFERENCES merchants(id),
  idempotency_key TEXT NOT NULL, reference TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'PAYMENT' CHECK(type IN ('PAYMENT','TOPUP')),
  amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
  cashback_paise INTEGER NOT NULL CHECK(cashback_paise >= 0), raw_cashback_paise INTEGER NOT NULL DEFAULT 0,
  balance_after_paise INTEGER NOT NULL, category TEXT NOT NULL, note TEXT,
  status TEXT NOT NULL CHECK(status IN ('SUCCESS','DECLINED')), created_at TEXT NOT NULL,
  UNIQUE(wallet_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_tx_wallet_date ON transactions(wallet_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_category_date ON transactions(category, created_at);
`);

ensureWalletPasswordColumn();

// The rules file is the source of truth; it is re-applied on every boot.
const upsertRule = db.prepare(`INSERT INTO cashback_rules(category,rate_percent,min_txn_paise,per_txn_cap_paise,monthly_cap_paise) VALUES (?,?,?,?,?)
  ON CONFLICT(category) DO UPDATE SET rate_percent=excluded.rate_percent, min_txn_paise=excluded.min_txn_paise,
  per_txn_cap_paise=excluded.per_txn_cap_paise, monthly_cap_paise=excluded.monthly_cap_paise`);
for (const [c, r] of Object.entries(CATEGORY_RULES)) upsertRule.run(c, r.ratePercent, r.minTxnPaise, r.perTxnCapPaise, r.monthlyCapPaise);

export const MERCHANTS = [
  ['m-canteen', 'Central Canteen', 'CANTEEN', 'Meals, thali & snacks'],
  ['m-cafe', 'Night Owl Café', 'CANTEEN', 'Coffee & late-night bites'],
  ['m-chai', 'Chai Tapri', 'CANTEEN', 'Tea, samosa & maggi'],
  ['m-stationery', 'Campus Stationery', 'STATIONERY', 'Notebooks, pens & lab gear'],
  ['m-xerox', 'Print & Xerox Hub', 'STATIONERY', 'Printouts & photocopies'],
  ['m-transport', 'Campus Shuttle', 'TRANSPORT', 'Bus passes & single rides'],
  ['m-cab', 'Campus Cab Pool', 'TRANSPORT', 'Shared rides to metro & station'],
  ['m-hostel', 'Hostel Mess & Fees', 'HOSTEL', 'Mess, rent & hostel dues'],
  ['m-laundry', 'Hostel Laundry', 'HOSTEL', 'Wash & fold service'],
  ['m-online', 'Campus Online Store', 'ONLINE', 'Merch, books & electronics'],
  ['m-topup', 'Wallet Top-up', 'TOP_UP', 'Add money to wallet']
];
const insertMerchant = db.prepare('INSERT OR IGNORE INTO merchants(id,name,category,tagline,active) VALUES (?,?,?,?,?)');
for (const [id, name, category, tagline] of MERCHANTS) insertMerchant.run(id, name, category, tagline, category === 'TOP_UP' ? 0 : 1);

// Demo students + ~45 days of believable history. In a real deployment, wallets are provisioned from the campus identity system.
if (process.env.SEED_DEMO_DATA !== 'false' && db.prepare('SELECT COUNT(*) AS c FROM wallets').get().c === 0) seedDemoData(db);
