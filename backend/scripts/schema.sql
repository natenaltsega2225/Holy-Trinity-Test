/* =========================================================
   HOLY TRINITY - FINANCE + ACCOUNTING (RUN ONCE)
   MySQL 8+
   ========================================================= */

SET sql_safe_updates = 0;

-- Optional: create a separate schema
-- CREATE DATABASE IF NOT EXISTS holy_trinity_finance CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
-- USE holy_trinity_finance;

START TRANSACTION;

/* =========================================================
   1) MEMBERS (minimal, compatible with your existing design)
   ========================================================= */
CREATE TABLE IF NOT EXISTS members (
  id BIGINT NOT NULL AUTO_INCREMENT,
  username VARCHAR(60) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name  VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(40) NULL,
  address_line1 VARCHAR(200) NULL,
  address_line2 VARCHAR(200) NULL,
  city VARCHAR(100) NULL,
  state VARCHAR(80) NULL,
  zip VARCHAR(20) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('member','finance','admin') NOT NULL DEFAULT 'member',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  last_login_ip VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_members_username (username),
  UNIQUE KEY uq_members_email (email),
  KEY idx_members_role (role),
  KEY idx_members_name (last_name, first_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* =========================================================
   2) AUDIT LOGS (security/compliance)
   ========================================================= */
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  actor_member_id BIGINT NULL,
  actor_role VARCHAR(32) NULL,
  ip VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  method VARCHAR(8) NULL,
  path VARCHAR(255) NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(60) NULL,
  target_id BIGINT NULL,
  details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_actor (actor_member_id),
  KEY idx_audit_action (action),
  KEY idx_audit_created (created_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_member_id)
    REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* =========================================================
   3) CHART OF ACCOUNTS + ACCOUNTING (GL)
   ========================================================= */
CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(140) NOT NULL,
  type ENUM('asset','liability','equity','income','expense') NOT NULL,
  parent_id BIGINT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accounts_code (code),
  KEY idx_accounts_type (type),
  CONSTRAINT fk_accounts_parent FOREIGN KEY (parent_id)
    REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS journal_entries (
  id BIGINT NOT NULL AUTO_INCREMENT,
  entry_date DATE NOT NULL,
  memo VARCHAR(255) NULL,
  source ENUM('payment','expense','invoice','manual','txn') NOT NULL DEFAULT 'manual',
  source_id BIGINT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_je_date (entry_date),
  KEY idx_je_source (source, source_id),
  CONSTRAINT fk_je_created_by FOREIGN KEY (created_by)
    REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS journal_lines (
  id BIGINT NOT NULL AUTO_INCREMENT,
  journal_entry_id BIGINT NOT NULL,
  account_id BIGINT NOT NULL,
  debit_cents BIGINT NOT NULL DEFAULT 0,
  credit_cents BIGINT NOT NULL DEFAULT 0,
  description VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_jl_je (journal_entry_id),
  KEY idx_jl_account (account_id),
  CONSTRAINT fk_jl_je FOREIGN KEY (journal_entry_id)
    REFERENCES journal_entries(id) ON DELETE CASCADE,
  CONSTRAINT fk_jl_account FOREIGN KEY (account_id)
    REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT chk_debit_credit CHECK (
    (debit_cents = 0 AND credit_cents > 0) OR (credit_cents = 0 AND debit_cents > 0)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* =========================================================
   4) UNIFIED TRANSACTIONS (Donation / Membership / Invoice / Other)
   - This is your “business document”
   - A transaction can later be paid by 1+ payments
   ========================================================= */
CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  txn_type ENUM('donation','membership','invoice','other') NOT NULL,
  member_id BIGINT NULL,

  amount_cents BIGINT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'usd',

  purpose VARCHAR(120) NULL,         -- e.g. "General Church Fund", "Membership Dues"
  frequency ENUM('one_time','weekly','monthly','quarterly','semiannual','annual') NOT NULL DEFAULT 'one_time',

  status ENUM('created','pending','succeeded','failed','refunded','canceled','void') NOT NULL DEFAULT 'created',

  external_ref VARCHAR(191) NULL,     -- Stripe PI / Session / Invoice ID etc
  notes TEXT NULL,

  created_by BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_txn_type (txn_type),
  KEY idx_txn_member (member_id),
  KEY idx_txn_status (status),
  KEY idx_txn_created (created_at),
  CONSTRAINT fk_txn_member FOREIGN KEY (member_id)
    REFERENCES members(id) ON DELETE SET NULL,
  CONSTRAINT fk_txn_created_by FOREIGN KEY (created_by)
    REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* =========================================================
   5) PAYMENTS LEDGER (actual money movement)
   - Can pay a transaction (donation/membership/invoice/other)
   - Supports Stripe/manual/bank; card/ach/cash/check
   ========================================================= */
CREATE TABLE IF NOT EXISTS payments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  member_id BIGINT NULL,

  txn_id BIGINT NULL,                -- links to transactions.id (optional but recommended)
  source ENUM('transaction','invoice','expense','other') NOT NULL DEFAULT 'transaction',

  method ENUM('card','ach','cash','check') NOT NULL,
  provider ENUM('stripe','manual','bank') NOT NULL DEFAULT 'stripe',

  amount_cents BIGINT NOT NULL,
  fee_cents BIGINT NOT NULL DEFAULT 0,
  net_cents BIGINT NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'usd',

  provider_ref VARCHAR(191) NULL,    -- Stripe PI / charge id / bank ref
  status ENUM('pending','succeeded','failed','refunded','canceled') NOT NULL DEFAULT 'pending',

  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes VARCHAR(255) NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_pay_member (member_id),
  KEY idx_pay_status (status),
  KEY idx_pay_received (received_at),
  KEY idx_pay_txn (txn_id),
  CONSTRAINT fk_pay_member FOREIGN KEY (member_id)
    REFERENCES members(id) ON DELETE SET NULL,
  CONSTRAINT fk_pay_txn FOREIGN KEY (txn_id)
    REFERENCES transactions(id) ON DELETE SET NULL,
  CONSTRAINT fk_pay_created_by FOREIGN KEY (created_by)
    REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* =========================================================
   6) CHECKS RECEIVED (details only when method=check)
   ========================================================= */
CREATE TABLE IF NOT EXISTS checks_received (
  id BIGINT NOT NULL AUTO_INCREMENT,
  payment_id BIGINT NOT NULL,
  check_number VARCHAR(60) NOT NULL,
  bank_name VARCHAR(120) NULL,
  memo VARCHAR(191) NULL,
  deposited_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_check_number (check_number),
  KEY idx_check_payment (payment_id),
  CONSTRAINT fk_check_payment FOREIGN KEY (payment_id)
    REFERENCES payments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* =========================================================
   7) DUES PLANS + MEMBERSHIP PERIODS
   - Keep plans for pricing
   - Keep membership_periods for access control (paid through date)
   ========================================================= */
CREATE TABLE IF NOT EXISTS dues_plans (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(32) NOT NULL,
  label VARCHAR(100) NOT NULL,
  months INT NOT NULL,
  min_amount_cents BIGINT NOT NULL,
  default_amount_cents BIGINT NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dues_code (code),
  KEY idx_dues_months (months)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS membership_periods (
  id BIGINT NOT NULL AUTO_INCREMENT,
  member_id BIGINT NOT NULL,
  txn_id BIGINT NULL,                -- the membership transaction that created this period
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  status ENUM('active','expired','canceled') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mp_member (member_id),
  KEY idx_mp_end (end_at),
  CONSTRAINT fk_mp_member FOREIGN KEY (member_id)
    REFERENCES members(id) ON DELETE CASCADE,
  CONSTRAINT fk_mp_txn FOREIGN KEY (txn_id)
    REFERENCES transactions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* =========================================================
   8) INVOICES + ITEMS (AR)
   ========================================================= */
CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT NOT NULL AUTO_INCREMENT,
  member_id BIGINT NULL,
  invoice_no VARCHAR(40) NOT NULL,
  status ENUM('draft','sent','paid','void') NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL,
  due_date DATE NULL,
  subtotal_cents BIGINT NOT NULL DEFAULT 0,
  tax_cents BIGINT NOT NULL DEFAULT 0,
  total_cents BIGINT NOT NULL DEFAULT 0,
  bill_to_name VARCHAR(160) NULL,
  bill_to_email VARCHAR(190) NULL,
  notes TEXT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_no (invoice_no),
  KEY idx_inv_member (member_id),
  KEY idx_inv_status (status),
  CONSTRAINT fk_inv_member FOREIGN KEY (member_id)
    REFERENCES members(id) ON DELETE SET NULL,
  CONSTRAINT fk_inv_created_by FOREIGN KEY (created_by)
    REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGINT NOT NULL AUTO_INCREMENT,
  invoice_id BIGINT NOT NULL,
  description VARCHAR(200) NOT NULL,
  qty DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  unit_cents BIGINT NOT NULL DEFAULT 0,
  line_cents BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_invitem_invoice (invoice_id),
  CONSTRAINT fk_invitem_invoice FOREIGN KEY (invoice_id)
    REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Allows partial payments / multiple payments per invoice
CREATE TABLE IF NOT EXISTS invoice_payments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  invoice_id BIGINT NOT NULL,
  payment_id BIGINT NOT NULL,
  applied_cents BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_payment (invoice_id, payment_id),
  CONSTRAINT fk_ip_invoice FOREIGN KEY (invoice_id)
    REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_ip_payment FOREIGN KEY (payment_id)
    REFERENCES payments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* =========================================================
   9) EXPENSES (workflow: submitted -> approved -> paid)
   ========================================================= */
CREATE TABLE IF NOT EXISTS expenses (
  id BIGINT NOT NULL AUTO_INCREMENT,
  expense_date DATE NOT NULL,
  category VARCHAR(100) NOT NULL,
  vendor VARCHAR(150) NULL,

  amount_cents BIGINT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'usd',

  method ENUM('ach','check','card','cash') NOT NULL,
  ref_number VARCHAR(120) NULL,
  notes TEXT NULL,

  status ENUM('draft','submitted','approved','paid','void') NOT NULL DEFAULT 'submitted',

  receipt_url VARCHAR(500) NULL,

  created_by BIGINT NULL,
  approved_by BIGINT NULL,
  approved_at DATETIME NULL,
  paid_at DATETIME NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_expense_category (category),
  KEY idx_expense_date (expense_date),
  KEY idx_expense_status (status),
  CONSTRAINT fk_exp_created_by FOREIGN KEY (created_by)
    REFERENCES members(id) ON DELETE SET NULL,
  CONSTRAINT fk_exp_approved_by FOREIGN KEY (approved_by)
    REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* =========================================================
   10) PAYOUTS + payout_items (Stripe payouts / bank deposits)
   ========================================================= */
CREATE TABLE IF NOT EXISTS payouts (
  id BIGINT NOT NULL AUTO_INCREMENT,
  provider ENUM('stripe','bank') NOT NULL DEFAULT 'stripe',
  provider_ref VARCHAR(120) NOT NULL,
  amount_cents BIGINT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'usd',
  status ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
  expected_on DATE NULL,
  paid_on DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payout_ref (provider, provider_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payout_items (
  id BIGINT NOT NULL AUTO_INCREMENT,
  payout_id BIGINT NOT NULL,
  payment_id BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payout_payment (payout_id, payment_id),
  CONSTRAINT fk_pi_payout FOREIGN KEY (payout_id)
    REFERENCES payouts(id) ON DELETE CASCADE,
  CONSTRAINT fk_pi_payment FOREIGN KEY (payment_id)
    REFERENCES payments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* =========================================================
   11) FAMILY + NEWS/EVENTS (keep compatible)
   ========================================================= */
CREATE TABLE IF NOT EXISTS family_members (
  id BIGINT NOT NULL AUTO_INCREMENT,
  member_id BIGINT NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  relationship VARCHAR(50) NOT NULL,
  birthdate DATE NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_family_member (member_id),
  CONSTRAINT fk_family_member FOREIGN KEY (member_id)
    REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS news_events (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category ENUM('kids','holiday','trip','news') NOT NULL DEFAULT 'news',
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255) NULL,
  summary MEDIUMTEXT NULL,
  body_html MEDIUMTEXT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  location VARCHAR(255) NULL,
  flyer_url VARCHAR(500) NULL,
  pdf_url VARCHAR(500) NULL,
  pdf_title VARCHAR(255) NULL,
  audience VARCHAR(255) NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_dates (start_date, end_date),
  INDEX idx_pub (is_published),
  CONSTRAINT fk_news_created_by FOREIGN KEY (created_by)
    REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* =========================================================
   12) SEED: DEFAULT CHART OF ACCOUNTS (starter set)
   You can expand later.
   ========================================================= */
INSERT INTO accounts (code, name, type)
SELECT * FROM (
  SELECT '1000','Cash - Bank','asset' UNION ALL
  SELECT '1010','Cash - Undeposited Funds','asset' UNION ALL
  SELECT '1100','Accounts Receivable','asset' UNION ALL

  SELECT '2000','Accounts Payable','liability' UNION ALL
  SELECT '2100','Deferred Revenue - Membership','liability' UNION ALL
  SELECT '2200','Sales Tax Payable','liability' UNION ALL

  SELECT '3000','Net Assets','equity' UNION ALL

  SELECT '4000','Contributions - Donations','income' UNION ALL
  SELECT '4100','Membership Dues Income','income' UNION ALL
  SELECT '4200','Program / Event Income','income' UNION ALL

  SELECT '5000','Office / Admin Expense','expense' UNION ALL
  SELECT '5100','Facilities / Rent Expense','expense' UNION ALL
  SELECT '5200','Utilities Expense','expense' UNION ALL
  SELECT '5300','Ministry / Program Expense','expense' UNION ALL
  SELECT '5400','Payment Processing Fees','expense'
) s
WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.code = s.code);

/* =========================================================
   13) SEED: dues plans (your existing defaults)
   ========================================================= */
INSERT INTO dues_plans (code, label, months, min_amount_cents, default_amount_cents, active)
SELECT * FROM (
  SELECT 'monthly','Month-to-Month (1 month)',1,2500,2500,1 UNION ALL
  SELECT 'semi_annual','6 Months (one-time total)',6,15000,15000,1 UNION ALL
  SELECT 'annual','12 Months (one-time total)',12,30000,30000,1
) p
WHERE NOT EXISTS (SELECT 1 FROM dues_plans d WHERE d.code = p.code);

COMMIT;

/* =========================================================
   DONE
   ========================================================= */
SELECT 'Finance + Accounting schema installed successfully.' AS message;

-- users table (example)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  role VARCHAR(30) NOT NULL DEFAULT 'member',
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- password reset tokens (store HASHED token)
CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id),
  INDEX (token_hash),
  CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- refresh tokens (store HASHED token)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id),
  INDEX (token_hash),
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

/* ================= DROP TABLES (ORDER MATTERS) ================= */
DROP TABLE IF EXISTS tbl_volunteer_applications;
DROP TABLE IF EXISTS tbl_volunteer_recognition;
DROP TABLE IF EXISTS tbl_volunteer_hours;
DROP TABLE IF EXISTS tbl_serve_posts;

/* ================= SERVE POSTS ================= */
CREATE TABLE tbl_serve_posts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category VARCHAR(180) NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  activity_date DATE NOT NULL,
  start_time VARCHAR(20) NOT NULL,
  end_time VARCHAR(20) NOT NULL,
  location VARCHAR(255) NOT NULL,
  notes TEXT,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_serve_posts_category (category),
  KEY idx_serve_posts_date (activity_date),
  KEY idx_serve_posts_published (is_published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ================= VOLUNTEER HOURS ================= */
CREATE TABLE tbl_volunteer_hours (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  volunteer_name VARCHAR(180) NOT NULL,
  email VARCHAR(190) DEFAULT NULL,
  category VARCHAR(180) NOT NULL,
  serve_post_id BIGINT UNSIGNED DEFAULT NULL,
  date_served DATE NOT NULL,
  start_time VARCHAR(20) DEFAULT NULL,
  end_time VARCHAR(20) DEFAULT NULL,
  total_hours DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  source ENUM('public','admin') NOT NULL DEFAULT 'public',
  approved TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hours_name (volunteer_name),
  KEY idx_hours_email (email),
  KEY idx_hours_category (category),
  KEY idx_hours_date (date_served),
  KEY idx_hours_post (serve_post_id),
  KEY idx_hours_source (source),
  KEY idx_hours_approved (approved),
  CONSTRAINT fk_hours_post
    FOREIGN KEY (serve_post_id)
    REFERENCES tbl_serve_posts(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ================= VOLUNTEER RECOGNITION ================= */
CREATE TABLE tbl_volunteer_recognition (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  volunteer_name VARCHAR(180) NOT NULL,
  email VARCHAR(190) DEFAULT NULL,
  total_hours DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  recognition_level VARCHAR(80) NOT NULL,
  board_approved TINYINT(1) NOT NULL DEFAULT 0,
  approval_date DATE DEFAULT NULL,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_recognition_name (volunteer_name),
  KEY idx_recognition_email (email),
  KEY idx_recognition_level (recognition_level),
  KEY idx_recognition_approved (board_approved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ================= VOLUNTEER APPLICATIONS ================= */
CREATE TABLE tbl_volunteer_applications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  member_id BIGINT UNSIGNED DEFAULT NULL,
  full_name VARCHAR(180) NOT NULL,
  email VARCHAR(190) DEFAULT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  category VARCHAR(180) DEFAULT NULL,
  role VARCHAR(180) NOT NULL,
  activity_title VARCHAR(180) DEFAULT NULL,
  activity_date DATE DEFAULT NULL,
  activity_start_time VARCHAR(20) DEFAULT NULL,
  activity_end_time VARCHAR(20) DEFAULT NULL,
  activity_location VARCHAR(255) DEFAULT NULL,
  availability VARCHAR(255) DEFAULT NULL,
  experience TEXT,
  additional_notes TEXT,
  status ENUM('new','in_review','approved','declined','request_info') NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  decline_reason TEXT,
  ministry_leader_name VARCHAR(180) DEFAULT NULL,
  ministry_leader_email VARCHAR(190) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_app_status (status),
  KEY idx_app_member (member_id),
  KEY idx_app_role (role),
  KEY idx_app_category (category),
  KEY idx_app_date (activity_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;