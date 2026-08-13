-- Invoice Generator — local dev seed (idempotent). Populates the E2E_BYPASS_AUTH test user's workspace.
-- Run: bun run seed   (→ wrangler d1 execute invoice_generator --local --file ./seed/seed.sql)
-- NEVER run against --remote / production. Fixed ids + INSERT OR REPLACE = re-runnable.
-- Timestamps are seconds (Drizzle integer mode:"timestamp") → unixepoch('now'); `year` is a
-- plain invoice-year integer, derived from now so the fixtures stay evergreen. Owner is the
-- synthesized bypass user (e2e-test-user). Two clients (a Dhaka creative agency in BDT and an
-- e-commerce brand in USD), each with a couple of monthly invoice entries (mixed is_active).

INSERT OR IGNORE INTO users (id, email, email_verified, name, image, created_at, updated_at)
VALUES ('e2e-test-user', 'e2e@test.local', 1, 'E2E Test User', NULL, unixepoch('now'), unixepoch('now'));

-- Sender identity (one row per user).
INSERT OR REPLACE INTO fixed_settings (user_id, from_name, from_phone, from_email, from_address, selected_client_id, updated_at)
VALUES ('e2e-test-user', 'Dropout Studio', '+8801711000000', 'support@dropoutstudio.co', 'House 7, Road 27, Banani, Dhaka 1213', 'seed-client-1', unixepoch('now'));

-- Payment methods (owner-scoped, reused across clients via client_payment_methods links).
INSERT OR REPLACE INTO payment_methods (id, user_id, kind, label, "values", position, created_at, updated_at)
VALUES ('seed-pm-bank', 'e2e-test-user', 'bank', 'Bank transfer',
	'{"holder":"Rahi Khan","bankName":"BRAC Bank","account":"1501203040506070","branch":"Banani","routing":"060270534","swift":"BRAKBDDH"}',
	0, unixepoch('now'), unixepoch('now'));

INSERT OR REPLACE INTO payment_methods (id, user_id, kind, label, "values", position, created_at, updated_at)
VALUES ('seed-pm-bkash', 'e2e-test-user', 'bkash', 'bKash',
	'{"holder":"Rahi Khan","number":"01711000000","accountType":"Merchant"}',
	1, unixepoch('now'), unixepoch('now'));

-- Client 1 — Dhaka creative agency, billed in BDT.
INSERT OR REPLACE INTO clients (id, user_id, name, invoice_prefix, phone, email, address, service_description, service_amount, service_currency, year, expanded, is_active, position, created_at, updated_at)
VALUES ('seed-client-1', 'e2e-test-user', 'Studio Kophi', 'SK', '+8801712345678', 'accounts@studiokophi.com',
	'["House 41, Road 11","Banani, Dhaka 1213"]',
	'Storefront build + design retainer — {MONTH}', 85000, 'BDT',
	CAST(strftime('%Y', 'now') AS INTEGER), 1, 1, 0, unixepoch('now'), unixepoch('now'));

-- Client 2 — e-commerce brand, billed in USD.
INSERT OR REPLACE INTO clients (id, user_id, name, invoice_prefix, phone, email, address, service_description, service_amount, service_currency, year, expanded, is_active, position, created_at, updated_at)
VALUES ('seed-client-2', 'e2e-test-user', 'Bandhu Bazaar', 'BB', '+8801819876543', 'finance@bandhubazaar.com',
	'["Level 5, Tokyo Square","Gulshan Ave, Dhaka 1212"]',
	'Monthly maintenance & storefront ops — {MONTH}', 1200, 'USD',
	CAST(strftime('%Y', 'now') AS INTEGER), 1, 1, 1, unixepoch('now'), unixepoch('now'));

-- Invoice entries (per-month rows; is_active is the paid/unpaid analog — this schema has no
-- explicit status column). Mixed active/inactive across the two clients.
INSERT OR REPLACE INTO invoice_entries (id, client_id, month, issue_day, due_day, is_active, position, created_at)
VALUES ('seed-inv-1a', 'seed-client-1', 'May',  '01', '07', 1, 0, unixepoch('now'));

INSERT OR REPLACE INTO invoice_entries (id, client_id, month, issue_day, due_day, is_active, position, created_at)
VALUES ('seed-inv-1b', 'seed-client-1', 'June', '01', '07', 0, 1, unixepoch('now'));

INSERT OR REPLACE INTO invoice_entries (id, client_id, month, issue_day, due_day, is_active, position, created_at)
VALUES ('seed-inv-2a', 'seed-client-2', 'May',  '01', '10', 1, 0, unixepoch('now'));

INSERT OR REPLACE INTO invoice_entries (id, client_id, month, issue_day, due_day, is_active, position, created_at)
VALUES ('seed-inv-2b', 'seed-client-2', 'June', '01', '10', 1, 1, unixepoch('now'));

-- Link payment methods to clients (ordered).
INSERT OR REPLACE INTO client_payment_methods (client_id, payment_method_id, position)
VALUES ('seed-client-1', 'seed-pm-bank', 0);

INSERT OR REPLACE INTO client_payment_methods (client_id, payment_method_id, position)
VALUES ('seed-client-1', 'seed-pm-bkash', 1);

INSERT OR REPLACE INTO client_payment_methods (client_id, payment_method_id, position)
VALUES ('seed-client-2', 'seed-pm-bank', 0);
