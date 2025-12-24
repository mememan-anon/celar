import Database from 'better-sqlite3';

const db = new Database('psp.db');
db.pragma('foreign_keys = ON');

db.prepare(`
  CREATE TABLE IF NOT EXISTS psps (
    id TEXT PRIMARY KEY,
    business_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    api_key_hash TEXT NOT NULL UNIQUE,
    webhook_url TEXT,
    wallet_address TEXT,
    registered_country TEXT NOT NULL,
    business_type TEXT NOT NULL,          
    primary_use_case TEXT NOT NULL,              
    expected_monthly_volume TEXT NOT NULL,       
    source_of_funds TEXT NOT NULL,              
    license_number TEXT NOT NULL,
    website TEXT NOT NULL,  
    approval_status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`).run();

// Create merchants table
db.prepare(`
  CREATE TABLE IF NOT EXISTS merchants (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL UNIQUE,
    psp_id TEXT NOT NULL REFERENCES psps(id),
    external_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    business_id TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(psp_id, external_id)
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    psp_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    amount TEXT NOT NULL,
    currency TEXT NOT NULL,
    chain TEXT NOT NULL,
    reference TEXT,
    description TEXT,
    metadata TEXT,
    status TEXT DEFAULT 'pending', -- pending | confirmed | settled | settling |failed | settled_failed | mismatched
    magic_link_url TEXT,    
    confirmed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    token_address TEXT NOT NULL,
    customer_address TEXT,
    intermediary_wallet TEXT NOT NULL,
    psp_wallet TEXT,
    created_block_number INTEGER,
    settled_at TEXT,
    FOREIGN KEY (psp_id) REFERENCES psps(id),
    FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS payment_routes (
    id TEXT PRIMARY KEY,                         
    payment_id TEXT NOT NULL,
    chain TEXT NOT NULL,
    token TEXT NOT NULL,
    estimated_fee TEXT,
    estimated_time INTEGER,
    health_score INTEGER,
    ranking_score REAL,
    tx_hash TEXT,
    was_used BOOLEAN DEFAULT 0,
    decided_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments(id)
  );
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS risk_checks (
    payment_id TEXT PRIMARY KEY,
    psp_id TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    score INTEGER,
    flags TEXT,
    checked_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    payment_id TEXT NOT NULL,
    event TEXT NOT NULL,
    url TEXT NOT NULL,
    status TEXT NOT NULL, -- success | failed
    attempt INTEGER,
    response_code INTEGER,
    response_body TEXT,
    payload TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY,
    psp_id TEXT NOT NULL,
    amount TEXT NOT NULL,
    currency TEXT NOT NULL,
    destination TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending', -- pending | confirmed | failed
    confirmed_at TEXT,  -- Timestamp when funds were actually moved
    tx_hash TEXT,        -- On-chain tx hash
    FOREIGN KEY (psp_id) REFERENCES psps(id)
  )
`).run();

db.prepare(`
 CREATE TABLE IF NOT EXISTS routed_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id TEXT NOT NULL,
  tx_hash TEXT UNIQUE,
  chain TEXT NOT NULL,
  token TEXT NOT NULL,
  amount TEXT NOT NULL,
  target TEXT CHECK (target IN ('psp', 'treasury', 'incoming','failed')) NOT NULL,
  attempt INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  error TEXT,
  routed_at TEXT NOT NULL,
  meta TEXT
);
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS mismatched_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  sender TEXT NOT NULL,
  expected_amount TEXT NOT NULL,
  received_amount TEXT NOT NULL,
  status TEXT CHECK (status IN ('underpaid', 'overpaid', 'sorted')) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`).run();

export default db;
