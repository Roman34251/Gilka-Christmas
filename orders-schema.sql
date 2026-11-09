CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY,
 token_hash TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 webhook_hash TEXT NOT NULL,
 amount INTEGER NOT NULL,
 payment TEXT NOT NULL,
 status TEXT NOT NULL,
 payload TEXT NOT NULL,
 invoice_id TEXT,
 page_url TEXT,
 bank_modified INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at);
