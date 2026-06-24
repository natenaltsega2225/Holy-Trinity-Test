// backend/services/domains/ledger/ledgerService.js
"use strict";

const crypto = require("crypto");

const pool = require("../../../db");

const {
  insertExistingColumns,
  findOne,
} = require("../../../utils/dbHelpers");

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function nullable(value, max = 500) {
  const text = clean(value, max);
  return text || null;
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function intValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function ledgerNumber() {
  return `LED-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function sqlId(name) {
  return `\`${String(name).replaceAll("`", "``")}\``;
}

const COLUMN_CACHE = new Map();

async function tableColumns(table) {
  if (COLUMN_CACHE.has(table)) return COLUMN_CACHE.get(table);

  try {
    const [rows] = await pool.query(`SHOW COLUMNS FROM ${sqlId(table)}`);
    const cols = new Set(rows.map((row) => row.Field));
    COLUMN_CACHE.set(table, cols);
    return cols;
  } catch (_err) {
    const cols = new Set();
    COLUMN_CACHE.set(table, cols);
    return cols;
  }
}

function firstColumn(cols, names = []) {
  return names.find((name) => cols.has(name)) || null;
}

function expr(cols, alias, names, fallback = "NULL") {
  const col = firstColumn(cols, names);
  return col ? `${alias}.${sqlId(col)}` : fallback;
}

function textExpr(cols, alias, names, fallback = "''") {
  return `COALESCE(${expr(cols, alias, names, "NULL")}, ${fallback})`;
}

function numberExpr(cols, alias, names, fallback = "0") {
  return `COALESCE(${expr(cols, alias, names, "NULL")}, ${fallback})`;
}

function dateExpr(cols, alias, names) {
  return `COALESCE(${expr(cols, alias, names, "NULL")}, NOW())`;
}

function normalizeCategory(value) {
  const raw = String(value || "other").toLowerCase();

  if (raw.includes("member")) return "membership";
  if (raw.includes("pledge")) return "pledge";
  if (raw.includes("school") || raw.includes("kids")) return "school";
  if (raw.includes("trip")) return "trip";
  if (
    raw.includes("donation") ||
    raw.includes("fund") ||
    raw.includes("tithe") ||
    raw.includes("vow") ||
    raw.includes("plate") ||
    raw.includes("candle") ||
    raw.includes("baptism") ||
    raw.includes("wedding") ||
    raw.includes("memorial")
  ) {
    return "donation";
  }

  return raw && raw !== "--" ? raw.replace(/[^a-z0-9]+/g, "_") : "other";
}

function normalizeMethod(value) {
  const raw = String(value || "other").toLowerCase();

  if (raw.includes("ach") || raw.includes("bank")) return "ach";
  if (raw.includes("card") || raw.includes("stripe") || raw.includes("visa")) return "card";
  if (raw.includes("cash")) return "cash";
  if (raw.includes("check") || raw.includes("cheque")) return "check";
  if (raw.includes("zelle")) return "zelle";

  return raw && raw !== "--" ? raw.replace(/[^a-z0-9]+/g, "_") : "other";
}

function methodLabel(value) {
  const labels = {
    ach: "ACH",
    card: "Card",
    cash: "Cash",
    check: "Check",
    zelle: "Zelle",
    refund: "Refund",
    other: "Other",
  };

  const key = normalizeMethod(value);

  return labels[key] || clean(value || "Other", 80);
}

function isPaidStatus(status) {
  return ["paid", "posted", "completed", "succeeded", "success", "cleared", "issued"].includes(
    String(status || "").toLowerCase()
  );
}

function isRefundStatus(status) {
  return ["refund", "refunded", "reversed", "void", "cancelled", "failed"].includes(
    String(status || "").toLowerCase()
  );
}

function categoryLabel(value) {
  const labels = {
    membership: "Membership",
    donation: "Donation",
    pledge: "Pledge",
    school: "School Program",
    trip: "Trip Program",
    refund: "Refund",
    invoice: "Invoice",
    adjustment: "Adjustment",
    other: "Other",
  };
  return labels[normalizeCategory(value)] || clean(value || "Other", 80);
}

function paymentCreditSql(statusSql, amountSql) {
  return `
    CASE
      WHEN LOWER(COALESCE(${statusSql}, '')) IN ('paid','posted','completed','succeeded','success','cleared','issued')
      THEN ${amountSql}
      ELSE 0
    END
  `;
}

function paymentDebitSql(statusSql, amountSql) {
  return `
    CASE
      WHEN LOWER(COALESCE(${statusSql}, '')) IN ('refund','refunded','reversed','void','cancelled')
      THEN ${amountSql}
      ELSE 0
    END
  `;
}

function pushDateFilters(where, params, dateSql, filters = {}) {
  if (filters.year) {
    where.push(`YEAR(${dateSql}) = ?`);
    params.push(intValue(filters.year));
  }

  if (filters.from) {
    where.push(`DATE(${dateSql}) >= ?`);
    params.push(filters.from);
  }

  if (filters.to) {
    where.push(`DATE(${dateSql}) <= ?`);
    params.push(filters.to);
  }
}

function filterRows(rows, filters = {}) {
  const search = clean(filters.search || filters.q, 150).toLowerCase();
  const category = clean(filters.category, 80).toLowerCase();
  const method = clean(filters.method, 80).toLowerCase();
  const status = clean(filters.status, 80).toLowerCase();

  return rows.filter((row) => {
    if (category && normalizeCategory(row.category) !== normalizeCategory(category)) return false;
    if (method && normalizeMethod(row.payment_method) !== normalizeMethod(method)) return false;
    if (status && String(row.status || "").toLowerCase() !== status) return false;

    if (!search) return true;

    return [
      row.member_no,
      row.member_name,
      row.email,
      row.reference_no,
      row.payment_number,
      row.invoice_number,
      row.receipt_number,
      row.category,
      row.sub_category,
      row.description,
      row.notes,
    ]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
}

async function getLatestMemberBalance(db, memberId) {
  if (!memberId) return 0;

  const cols = await tableColumns("tbl_finance_member_ledger");
  if (!cols.size || !cols.has("member_id") || !cols.has("running_balance")) return 0;

  const [[row]] = await db.query(
    `
    SELECT running_balance
    FROM tbl_finance_member_ledger
    WHERE member_id = ?
    ORDER BY COALESCE(record_date, created_at, updated_at) DESC, id DESC
    LIMIT 1
    `,
    [memberId]
  );

  return money(row?.running_balance);
}

async function getLedgerEntryById(id) {
  const cols = await tableColumns("tbl_finance_member_ledger");
  if (!cols.size) return null;

  return findOne(pool, `SELECT * FROM tbl_finance_member_ledger WHERE id = ? LIMIT 1`, [id]);
}

async function createLedgerEntry(connOrPayload, maybePayload) {
  const hasConn = connOrPayload && typeof connOrPayload.query === "function";
  const db = hasConn ? connOrPayload : pool;
  const payload = hasConn ? maybePayload || {} : connOrPayload || {};

  const debit = money(payload.debit_amount ?? payload.debit ?? 0);
  const credit = money(payload.credit_amount ?? payload.credit ?? payload.amount ?? 0);
  const amount = money(payload.amount ?? Math.max(debit, credit));

  if (debit <= 0 && credit <= 0 && amount <= 0) {
    throw new Error("Ledger entry requires an amount.");
  }

  const previous = await getLatestMemberBalance(db, payload.member_id);
  const runningBalance = money(previous + credit - debit);
  const entryNo = payload.ledger_uuid || payload.ledger_number || ledgerNumber();

  const id = await insertExistingColumns(db, "tbl_finance_member_ledger", {
    ledger_uuid: entryNo,
    ledger_number: entryNo,
    member_id: payload.member_id || null,
    member_no: payload.member_no || null,
    full_name_snapshot: nullable(payload.full_name_snapshot || payload.full_name, 255),
    email_snapshot: nullable(payload.email_snapshot || payload.email, 190),
    phone_snapshot: nullable(payload.phone_snapshot || payload.phone, 80),
    record_type: payload.record_type || payload.entry_type || "payment",
    entry_type: payload.entry_type || payload.record_type || "payment",
    ledger_type: payload.ledger_type || payload.entry_type || payload.record_type || "payment",
    related_document_type: payload.related_document_type || payload.reference_type || "payment",
    related_document_id: payload.related_document_id || payload.reference_id || null,
    related_document_number: payload.related_document_number || payload.reference_no || null,
    payment_id: payload.payment_id || null,
    invoice_id: payload.invoice_id || null,
    receipt_id: payload.receipt_id || null,
    payment_number: payload.payment_number || null,
    invoice_number: payload.invoice_number || null,
    receipt_number: payload.receipt_number || null,
    record_date: payload.record_date || payload.posted_at || nowSql(),
    posted_at: payload.posted_at || nowSql(),
    category: payload.category || payload.payment_category || null,
    sub_category: payload.sub_category || payload.donation_category || null,
    method: payload.method || payload.payment_method || null,
    payment_method: payload.payment_method || payload.method || null,
    description: nullable(payload.description || payload.memo, 1000),
    debit_amount: debit,
    credit_amount: credit,
    amount,
    running_balance: runningBalance,
    source: payload.source || payload.audit_source || "finance_ledger",
    source_type: payload.source_type || payload.entry_type || payload.record_type || "payment",
    source_reference: payload.source_reference || payload.reference_no || null,
    reference_no: payload.reference_no || payload.source_reference || null,
    status: payload.status || payload.ledger_status || "posted",
    ledger_status: payload.ledger_status || payload.status || "posted",
    reconciliation_status: payload.reconciliation_status || "pending",
    notes: nullable(payload.notes, 2000),
    created_by: payload.created_by || null,
    updated_by: payload.updated_by || payload.created_by || null,
    created_at: nowSql(),
    updated_at: nowSql(),
  });

  return getLedgerEntryById(id);
}

async function postPaymentEntry(connOrPayload, maybePayload) {
  const hasConn = connOrPayload && typeof connOrPayload.query === "function";
  const payload = hasConn ? maybePayload || {} : connOrPayload || {};

  return createLedgerEntry(hasConn ? connOrPayload : {
    ...payload,
    related_document_type: payload.related_document_type || "payment",
    entry_type: payload.entry_type || "payment",
    record_type: payload.record_type || "payment",
    ledger_type: payload.ledger_type || "payment",
    credit_amount: payload.credit_amount ?? payload.amount,
    debit_amount: payload.debit_amount ?? 0,
    status: payload.status || "posted",
  }, hasConn ? {
    ...payload,
    related_document_type: payload.related_document_type || "payment",
    entry_type: payload.entry_type || "payment",
    record_type: payload.record_type || "payment",
    ledger_type: payload.ledger_type || "payment",
    credit_amount: payload.credit_amount ?? payload.amount,
    debit_amount: payload.debit_amount ?? 0,
    status: payload.status || "posted",
  } : undefined);
}

async function queryMembersById(memberId) {
  if (!memberId) return null;
  const cols = await tableColumns("tbl_members");
  if (!cols.size) return null;

  const [rows] = await pool.query(
    `
    SELECT
      m.id,
     COALESCE(
  NULLIF(
    ${textExpr(
      cols,
      "m",
      ["member_no", "member_number"],
      "NULL"
    )},
    ''
  ),
  CONCAT(
    'CM-',
    LPAD(m.id,5,'0')
  )
) AS member_no,
      ${textExpr(cols, "m", ["full_name", "name"], "''")} AS full_name,
      ${textExpr(cols, "m", ["email"], "''")} AS email,
      ${textExpr(cols, "m", ["phone"], "''")} AS phone,
      ${textExpr(cols, "m", ["address", "street_address"], "''")} AS address,
      ${textExpr(cols, "m", ["city"], "''")} AS city,
      ${textExpr(cols, "m", ["state"], "''")} AS state,
      ${textExpr(cols, "m", ["zip", "postal_code"], "''")} AS zip
    FROM tbl_members m
    WHERE m.id = ?
    LIMIT 1
    `,
    [memberId]
  );

  return rows[0] || null;
}

async function queryMembersList(filters = {}) {
  const cols = await tableColumns("tbl_members");

  if (!cols.size) {
    return [];
  }

  const fullNameExpr =
    cols.has("full_name")
      ? "m.full_name"
      : cols.has("first_name") || cols.has("last_name")
      ? `
          TRIM(
            CONCAT(
              COALESCE(${cols.has("first_name") ? "m.first_name" : "''"}, ''),
              ' ',
              COALESCE(${cols.has("last_name") ? "m.last_name" : "''"}, '')
            )
          )
        `
      : "CONCAT('Member ', m.id)";

  const where = ["1=1"];
  const params = [];

  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;

    where.push(`
      (
        CAST(m.id AS CHAR) LIKE ?
        OR ${fullNameExpr} LIKE ?
        OR ${textExpr(
          cols,
          "m",
          ["member_no", "member_number"],
          "''"
        )} LIKE ?
        OR ${textExpr(
          cols,
          "m",
          ["email"],
          "''"
        )} LIKE ?
        OR ${textExpr(
          cols,
          "m",
          ["phone"],
          "''"
        )} LIKE ?
      )
    `);

    params.push(q, q, q, q, q);
  }

  const [rows] = await pool.query(
    `
    SELECT
      m.id,

      ${textExpr(
        cols,
        "m",
        ["member_no", "member_number"],
        "CONCAT('M-',m.id)"
      )} AS member_no,

      ${fullNameExpr} AS full_name,

      ${textExpr(
        cols,
        "m",
        ["email"],
        "''"
      )} AS email,

      ${textExpr(
        cols,
        "m",
        ["phone"],
        "''"
      )} AS phone,

      ${textExpr(
        cols,
        "m",
        ["address","street_address"],
        "''"
      )} AS address,

      ${textExpr(
        cols,
        "m",
        ["city"],
        "''"
      )} AS city,

      ${textExpr(
        cols,
        "m",
        ["state"],
        "''"
      )} AS state,

      ${textExpr(
        cols,
        "m",
        ["zip","postal_code"],
        "''"
      )} AS zip,

      ${textExpr(
        cols,
        "m",
        ["membership_status","status"],
        "'active'"
      )} AS status,

      ${dateExpr(
        cols,
        "m",
        ["created_at","joined_at","registration_date"]
      )} AS created_at

    FROM tbl_members m

    WHERE ${where.join(" AND ")}

    ORDER BY
      full_name ASC,
      m.id ASC

    LIMIT 5000
    `,
    params
  );

  return rows;
}

async function resolveMemberIdForUser(user = {}) {
  if (user.member_id || user.memberId) return Number(user.member_id || user.memberId);

  const users = await tableColumns("tbl_users");
  if (!users.size || !user.id) return null;

  const memberIdCol = firstColumn(users, ["member_id", "memberId"]);
  if (!memberIdCol) return null;

  const [[row]] = await pool.query(
    `SELECT ${sqlId(memberIdCol)} AS member_id FROM tbl_users WHERE id = ? LIMIT 1`,
    [user.id]
  );

  return row?.member_id || null;
}

async function paymentRows(filters = {}) {
  const cols = await tableColumns("tbl_finance_payments");
  if (!cols.size) return [];

  const memberIdSql = numberExpr(cols, "p", ["member_id"], "NULL");
  const dateSql = dateExpr(cols, "p", ["paid_at", "payment_date", "created_at", "date"]);
  const amountSql = numberExpr(cols, "p", ["amount", "total_amount", "payment_amount"], "0");
  const statusSql = textExpr(cols, "p", ["status", "payment_status"], "'paid'");
  const categorySql = textExpr(cols, "p", ["category", "payment_type", "donation_category"], "'other'");

  const where = ["1=1"];
  const params = [];

  if (filters.member_id) {
    where.push(`${memberIdSql} = ?`);
    params.push(filters.member_id);
  }

  pushDateFilters(where, params, dateSql, filters);

  const [rows] = await pool.query(
    `
    SELECT
      CONCAT('payment-', p.id) AS uid,
      p.id AS source_id,
      'payment' AS record_type,
      'payment' AS entry_type,
      ${memberIdSql} AS member_id,
      ${textExpr(cols, "p", ["member_no", "member_number"], "''")} AS member_no,
      ${textExpr(cols, "p", ["full_name_snapshot", "payer_name", "donor_name", "full_name"], "'Guest Donor'")} AS member_name,
      ${textExpr(cols, "p", ["email_snapshot", "payer_email", "donor_email", "email"], "''")} AS email,
      ${dateSql} AS entry_date,
      ${textExpr(cols, "p", ["payment_number", "number"], "CONCAT('PAY-', p.id)")} AS payment_number,
      ${textExpr(cols, "p", ["invoice_number"], "''")} AS invoice_number,
      ${textExpr(cols, "p", ["receipt_number"], "''")} AS receipt_number,
      ${textExpr(cols, "p", ["reference_no", "transaction_reference", "stripe_charge_id"], "''")} AS reference_no,
      ${categorySql} AS category,
      ${textExpr(cols, "p", ["sub_category", "donation_category"], "''")} AS sub_category,
      ${textExpr(cols, "p", ["method", "payment_method"], "''")} AS payment_method,
      ${textExpr(cols, "p", ["provider", "payment_provider"], "''")} AS provider,
      ${amountSql} AS amount,
      ${paymentDebitSql(statusSql, amountSql)} AS debit,
      ${paymentCreditSql(statusSql, amountSql)} AS credit,
      0 AS balance,
      ${statusSql} AS status,
      ${textExpr(cols, "p", ["notes", "description"], "''")} AS notes,
      ${textExpr(cols, "p", ["description", "memo", "sub_category", "category"], "'Payment'")} AS description
    FROM tbl_finance_payments p
    WHERE ${where.join(" AND ")}
    `,
    params
  );

  return rows.map(normalizeLedgerRow);
}

async function invoiceRows(filters = {}) {
  const cols = await tableColumns("tbl_finance_invoices");
  if (!cols.size) return [];

  const memberIdSql = numberExpr(cols, "i", ["member_id"], "NULL");
  const dateSql = dateExpr(cols, "i", ["invoice_date", "issued_at", "created_at", "date"]);
  const totalSql = numberExpr(cols, "i", ["total_amount", "amount", "invoice_amount"], "0");
  const paidSql = numberExpr(cols, "i", ["paid_amount", "amount_paid"], "0");
  const balanceSql = `GREATEST(${totalSql} - LEAST(${paidSql}, ${totalSql}), 0)`;
  const statusSql = textExpr(cols, "i", ["status", "invoice_status"], "'open'");

  const where = ["1=1"];
  const params = [];

  if (filters.member_id) {
    where.push(`${memberIdSql} = ?`);
    params.push(filters.member_id);
  }

  pushDateFilters(where, params, dateSql, filters);

  const [rows] = await pool.query(
    `
    SELECT
      CONCAT('invoice-', i.id) AS uid,
      i.id AS source_id,
      'invoice' AS record_type,
      'invoice' AS entry_type,
      ${memberIdSql} AS member_id,
      ${textExpr(cols, "i", ["member_no", "member_number"], "''")} AS member_no,
      ${textExpr(cols, "i", ["full_name_snapshot", "bill_to", "payer_name", "donor_name"], "'Guest Donor'")} AS member_name,
      ${textExpr(cols, "i", ["email_snapshot", "recipient_email", "payer_email", "donor_email"], "''")} AS email,
      ${dateSql} AS entry_date,
      '' AS payment_number,
      ${textExpr(cols, "i", ["invoice_number", "invoice_no"], "CONCAT('INV-', i.id)")} AS invoice_number,
      '' AS receipt_number,
      ${textExpr(cols, "i", ["reference_no"], "''")} AS reference_no,
      ${textExpr(cols, "i", ["category", "invoice_type", "payment_type"], "'invoice'")} AS category,
      ${textExpr(cols, "i", ["sub_category", "donation_category"], "''")} AS sub_category,
      ${textExpr(cols, "i", ["payment_method", "method"], "''")} AS payment_method,
      '' AS provider,
      ${totalSql} AS amount,
      ${balanceSql} AS debit,
      0 AS credit,
      ${balanceSql} AS balance,
      ${statusSql} AS status,
      ${textExpr(cols, "i", ["notes", "memo"], "''")} AS notes,
      ${textExpr(cols, "i", ["description", "invoice_type", "category"], "'Invoice'")} AS description
    FROM tbl_finance_invoices i
    WHERE ${where.join(" AND ")}
      AND LOWER(COALESCE(${statusSql}, '')) NOT IN ('paid','void','cancelled')
      AND ${balanceSql} > 0
    `,
    params
  );

  return rows.map(normalizeLedgerRow);
}

async function pledgeRows(filters = {}) {
  const cols = await tableColumns("tbl_finance_pledges");
  if (!cols.size) return [];

  const memberIdSql = numberExpr(cols, "pl", ["member_id"], "NULL");
  const dateSql = dateExpr(cols, "pl", ["created_at", "pledge_date", "due_date"]);
  const pledgedSql = numberExpr(cols, "pl", ["pledged_amount", "total_amount", "amount"], "0");
  const paidSql = numberExpr(cols, "pl", ["paid_amount", "amount_paid"], "0");
  const remainingSql = `GREATEST(${pledgedSql} - ${paidSql}, 0)`;

  const where = ["1=1"];
  const params = [];

  if (filters.member_id) {
    where.push(`${memberIdSql} = ?`);
    params.push(filters.member_id);
  }

  pushDateFilters(where, params, dateSql, filters);

  const [rows] = await pool.query(
    `
    SELECT
      CONCAT('pledge-', pl.id) AS uid,
      pl.id AS source_id,
      'pledge' AS record_type,
      'pledge' AS entry_type,
      ${memberIdSql} AS member_id,
      ${textExpr(cols, "pl", ["member_no", "member_number"], "''")} AS member_no,
      ${textExpr(cols, "pl", ["full_name_snapshot", "donor_name", "guest_name"], "'Guest Donor'")} AS member_name,
      ${textExpr(cols, "pl", ["email_snapshot", "email"], "''")} AS email,
      ${dateSql} AS entry_date,
      '' AS payment_number,
      '' AS invoice_number,
      '' AS receipt_number,
      ${textExpr(cols, "pl", ["pledge_number", "number"], "CONCAT('PLG-', pl.id)")} AS reference_no,
      'pledge' AS category,
      ${textExpr(cols, "pl", ["campaign_name"], "'General Pledge'")} AS sub_category,
      '' AS payment_method,
      '' AS provider,
      ${pledgedSql} AS amount,
      ${remainingSql} AS debit,
      ${paidSql} AS credit,
      ${remainingSql} AS balance,
      ${textExpr(cols, "pl", ["status"], "'open'")} AS status,
      ${textExpr(cols, "pl", ["notes"], "''")} AS notes,
      ${textExpr(cols, "pl", ["campaign_name"], "'Pledge'")} AS description
    FROM tbl_finance_pledges pl
    WHERE ${where.join(" AND ")}
    `,
    params
  );

  return rows.map(normalizeLedgerRow);
}

async function manualLedgerRows(filters = {}) {
  const cols = await tableColumns("tbl_finance_member_ledger");
  if (!cols.size) return [];

  const memberIdSql = numberExpr(cols, "l", ["member_id"], "NULL");
  const dateSql = dateExpr(cols, "l", ["record_date", "posted_at", "created_at"]);

  const where = ["1=1"];
  const params = [];

  if (filters.member_id) {
    where.push(`${memberIdSql} = ?`);
    params.push(filters.member_id);
  }

  pushDateFilters(where, params, dateSql, filters);

  if (cols.has("related_document_type")) {
    where.push(`
      (
        l.related_document_type IS NULL
        OR LOWER(l.related_document_type) NOT IN ('payment','invoice','receipt','pledge')
      )
    `);
  }

  const [rows] = await pool.query(
    `
    SELECT
      CONCAT('ledger-', l.id) AS uid,
      l.id AS source_id,
      ${textExpr(cols, "l", ["record_type", "entry_type", "ledger_type"], "'adjustment'")} AS record_type,
      ${textExpr(cols, "l", ["entry_type", "record_type", "ledger_type"], "'adjustment'")} AS entry_type,
      ${memberIdSql} AS member_id,
      ${textExpr(cols, "l", ["member_no", "member_number"], "''")} AS member_no,
      ${textExpr(cols, "l", ["full_name_snapshot", "member_name"], "'Member'")} AS member_name,
      ${textExpr(cols, "l", ["email_snapshot", "email"], "''")} AS email,
      ${dateSql} AS entry_date,
      ${textExpr(cols, "l", ["payment_number"], "''")} AS payment_number,
      ${textExpr(cols, "l", ["invoice_number"], "''")} AS invoice_number,
      ${textExpr(cols, "l", ["receipt_number"], "''")} AS receipt_number,
      ${textExpr(cols, "l", ["reference_no", "related_document_number", "source_reference"], "''")} AS reference_no,
      ${textExpr(cols, "l", ["category"], "'adjustment'")} AS category,
      ${textExpr(cols, "l", ["sub_category"], "''")} AS sub_category,
      ${textExpr(cols, "l", ["payment_method", "method"], "''")} AS payment_method,
      ${textExpr(cols, "l", ["provider"], "''")} AS provider,
      ${numberExpr(cols, "l", ["amount"], "0")} AS amount,
      ${numberExpr(cols, "l", ["debit_amount", "debit"], "0")} AS debit,
      ${numberExpr(cols, "l", ["credit_amount", "credit"], "0")} AS credit,
      ${numberExpr(cols, "l", ["running_balance", "balance"], "0")} AS balance,
      ${textExpr(cols, "l", ["status", "ledger_status"], "'posted'")} AS status,
      ${textExpr(cols, "l", ["notes"], "''")} AS notes,
      ${textExpr(cols, "l", ["description", "memo"], "'Ledger adjustment'")} AS description
    FROM tbl_finance_member_ledger l
    WHERE ${where.join(" AND ")}
    `,
    params
  );

  return rows.map(normalizeLedgerRow);
}

function normalizeLedgerRow(row = {}) {
  const category = normalizeCategory(row.category || row.record_type);
  const method = normalizeMethod(row.payment_method || row.provider);
  const debit = money(row.debit);
  const credit = money(row.credit);

  return {
    ...row,
    id: row.uid || `${row.record_type}-${row.source_id}`,
    source_id: row.source_id,
    entry_date: row.entry_date,
    record_type: clean(row.record_type || row.entry_type || "payment", 80),
    entry_type: clean(row.entry_type || row.record_type || "payment", 80),
    member_id: row.member_id || null,
    member_no: row.member_no || "--",
    member_name: row.member_name || "Guest Donor",
    email: row.email || "",
    category,
    category_label: categoryLabel(category),
    sub_category: row.sub_category || "",
    payment_method: method,
    payment_method_label: methodLabel(method),
    amount: money(row.amount || Math.max(debit, credit)),
    debit,
    credit,
    balance: money(row.balance),
    status: clean(row.status || "posted", 80),
    description: row.description || categoryLabel(category),
    reference_no:
      row.reference_no ||
      row.payment_number ||
      row.invoice_number ||
      row.receipt_number ||
      "--",
  };
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const ad = new Date(a.entry_date || 0).getTime();
    const bd = new Date(b.entry_date || 0).getTime();
    if (bd !== ad) return bd - ad;
    return String(b.id).localeCompare(String(a.id));
  });
}

function applyRunningBalance(rows) {
  const asc = [...rows].sort((a, b) => {
    const ad = new Date(a.entry_date || 0).getTime();
    const bd = new Date(b.entry_date || 0).getTime();
    if (ad !== bd) return ad - bd;
    return String(a.id).localeCompare(String(b.id));
  });

  let balance = 0;
  const balances = new Map();

  for (const row of asc) {
    balance = money(balance + money(row.credit) - money(row.debit));
    balances.set(row.id, balance);
  }

  return rows.map((row) => ({
    ...row,
    balance: balances.get(row.id) ?? row.balance,
  }));
}


function buildSummary(rows = []) {
  const summary = {
    total_entries: rows.length,
    total_debits: 0,
    total_credits: 0,
    net_balance: 0,

    total_donations: 0,
    total_membership: 0,
    total_pledge: 0,

    total_refunds: 0,
    grand_total: 0,

    by_category: {},
    by_method: {},
  };

  for (const row of rows) {
    const debit = money(row.debit);
    const credit = money(row.credit);
    const category = normalizeCategory(row.category);
    const method = normalizeMethod(row.payment_method);

    summary.total_debits = money(summary.total_debits + debit);
    summary.total_credits = money(summary.total_credits + credit);

    summary.by_category[category] = money(
      (summary.by_category[category] || 0) + credit - debit
    );

    summary.by_method[method] = money(
      (summary.by_method[method] || 0) + credit
    );

    if (category === "donation") {
      summary.total_donations = money(summary.total_donations + credit);
    }

    if (category === "membership") {
      summary.total_membership = money(summary.total_membership + credit);
    }

    if (category === "pledge") {
      summary.total_pledge = money(summary.total_pledge + credit);
    }

    if (debit > 0 || isRefundStatus(row.status)) {
      summary.total_refunds = money(summary.total_refunds + debit);
    }
  }

  summary.net_balance = money(summary.total_credits - summary.total_debits);

  summary.grand_total = money(
    summary.total_donations +
      summary.total_membership +
      summary.total_pledge
  );

  return summary;
}

function emptyStatementTotals() {
  return {
    payment_count: 0,
    total_donations: 0,
    total_membership: 0,
    total_pledge: 0,
    total_refunds: 0,
    grand_total: 0,
    first_contribution_date: null,
    last_contribution_date: null,
  };
}

function addStatementRowAmount(target, row) {
  const credit = money(row.credit || row.amount);
  const debit = money(row.debit);
  const category = normalizeCategory(row.category);

  if (credit > 0) {
    target.payment_count += 1;
    target.grand_total = money(target.grand_total + credit);

    if (category === "donation") target.total_donations = money(target.total_donations + credit);
    if (category === "membership") target.total_membership = money(target.total_membership + credit);
    if (category === "school") target.total_school = money(target.total_school + credit);
    if (category === "trip") target.total_trip = money(target.total_trip + credit);
    if (category === "pledge") target.total_pledge = money(target.total_pledge + credit);
  }

  if (debit > 0 || isRefundStatus(row.status)) {
    target.total_refunds = money(target.total_refunds + debit);
  }

  const date = row.entry_date || row.created_at || row.date || null;

  if (date) {
    if (!target.first_contribution_date || new Date(date) < new Date(target.first_contribution_date)) {
      target.first_contribution_date = date;
    }

    if (!target.last_contribution_date || new Date(date) > new Date(target.last_contribution_date)) {
      target.last_contribution_date = date;
    }
  }
}

async function listLedgerEntries(filters = {}) {
  const page = Math.max(1, intValue(filters.page, 1));
  const limit = Math.min(250, Math.max(1, intValue(filters.limit || filters.pageSize, 25)));
  const offset = (page - 1) * limit;

  const sourceRows = [
    ...(await paymentRows(filters)),
    ...(await invoiceRows(filters)),
    ...(await pledgeRows(filters)),
    ...(await manualLedgerRows(filters)),
  ];

  const filtered = filterRows(sourceRows, filters);
  const withBalance = filters.member_id ? applyRunningBalance(filtered) : filtered;
  const sorted = sortRows(withBalance);
  const rows = sorted.slice(offset, offset + limit);

  return {
    rows,
    summary: buildSummary(filtered),
    pagination: {
      page,
      limit,
      total: filtered.length,
      total_pages: Math.max(1, Math.ceil(filtered.length / limit)),
    },
  };
}

async function getMemberYearStatement({ member_id, year }) {
  const member = await queryMembersById(member_id);

  const selectedYear =
    intValue(year, new Date().getFullYear());

  const allRows = await paymentRows({
    member_id,
    year: selectedYear,
  });

  const contributionRows = allRows
    .filter((row) => isPaidStatus(row.status))
    .filter((row) => money(row.credit) > 0)
    .filter((row) =>
      ["donation", "membership", "pledge"].includes(
        normalizeCategory(row.category)
      )
    )
    .map((row) => ({
      ...row,
      amount: money(row.credit),
      debit: 0,
      balance: 0,
    }));

  const churchLegalName =
    process.env.CHURCH_LEGAL_NAME ||
    "Debre Berhan Holy Trinity Ethiopian Orthodox Tewahedo Church";

  return {
    year: selectedYear,

    generated_at: new Date().toISOString(),

    statement_no:
      `STM-${selectedYear}-${member?.member_no || member_id}`,

    church: {
      legal_name: churchLegalName,

      name: churchLegalName,

      platform_name:
        process.env.PLATFORM_NAME ||
        "Holy Trinity Finance & Membership Platform",

      address:
        process.env.CHURCH_ADDRESS ||
        "2558 Couchville Pike, Nashville, TN 37217",

      phone:
        process.env.CHURCH_PHONE ||
        "(615) 674-7405",

      email:
        process.env.CHURCH_EMAIL ||
        process.env.FINANCE_EMAIL ||
        "",

      website:
        process.env.CHURCH_WEBSITE ||
        process.env.FRONTEND_URL ||
        "",

      ein:
        process.env.CHURCH_EIN ||
        "XX-XXXXXXX",

      logo_url:
        process.env.CHURCH_LOGO_URL || "",
    },

    member: member || {
      id: member_id,
      member_no: "--",
      full_name: "Member",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zip: "",
    },

    rows: sortRows(contributionRows).reverse(),

    summary: buildSummary(contributionRows),

    certification:
      "This statement certifies the contributions recorded by the church during the tax year shown. No goods or services were provided in exchange for these contributions other than intangible religious benefits.",
  };
}



async function listMemberYearStatements(filters = {}) {
  const selectedYear = intValue(
    filters.year,
    new Date().getFullYear()
  );

  const page = Math.max(
    1,
    intValue(filters.page, 1)
  );

  const limit = Math.min(
    500,
    Math.max(
      1,
      intValue(
        filters.limit || filters.pageSize,
        100
      )
    )
  );

  const offset = (page - 1) * limit;

  const categoryFilter =
    normalizeCategory(filters.category || "");

  const searchText =
    (filters.search || filters.q || "")
      .trim();

  const [members, rows] = await Promise.all([
    queryMembersList({
      search: searchText,
    }),

    paymentRows({
      year: selectedYear,
      from:
        filters.from ||
        filters.date_from ||
        "",
      to:
        filters.to ||
        filters.date_to ||
        "",
    }),
  ]);

  const paidRows = rows
    .filter((row) =>
      isPaidStatus(row.status)
    )
    .filter(
      (row) => Number(row.credit || 0) > 0
    )
    .filter((row) =>
      ["membership", "donation", "pledge"].includes(
        normalizeCategory(row.category)
      )
    );

  const byMember = new Map();

  for (const member of members) {
    const memberId = Number(member.id);

    byMember.set(memberId, {
      member_id: memberId,

      member_no:
        member.member_no ||
        `CM-${String(memberId).padStart(5, "0")}`,

      full_name:
        member.full_name ||
        `Member ${memberId}`,

      email: member.email || "",
      phone: member.phone || "",

      address: [
        member.address,
        member.city,
        member.state,
        member.zip,
      ]
        .filter(Boolean)
        .join(", "),

      status: member.status || "",

      year: selectedYear,

      payment_count: 0,
      last_payment_at: null,

      ...emptyStatementTotals(),
    });
  }

  for (const row of paidRows) {
    const memberId = Number(
      row.member_id || 0
    );

    if (!memberId) continue;

    if (!byMember.has(memberId)) {
      byMember.set(memberId, {
        member_id: memberId,

        member_no:
          row.member_no ||
          `CM-${String(memberId).padStart(5, "0")}`,

        full_name:
          row.member_name ||
          "Guest Donor",

        email: row.email || "",
        phone: "",
        address: "",
        status: "",

        year: selectedYear,

        payment_count: 0,
        last_payment_at: null,

        ...emptyStatementTotals(),
      });
    }

    const target =
      byMember.get(memberId);

    addStatementRowAmount(
      target,
      row
    );

    target.payment_count =
      Number(target.payment_count || 0) + 1;

    if (
      row.entry_date &&
      (
        !target.last_payment_at ||
        new Date(row.entry_date) >
          new Date(target.last_payment_at)
      )
    ) {
      target.last_payment_at =
        row.entry_date;
    }
  }

  let statementRows =
    Array.from(byMember.values());

  if (
    filters.only_with_activity ||
    filters.with_activity_only
  ) {
    statementRows =
      statementRows.filter(
        (row) =>
          Number(row.payment_count || 0) > 0
      );
  }

  if (
    categoryFilter &&
    categoryFilter !== "all"
  ) {
    statementRows =
      statementRows.filter((row) => {
        if (
          categoryFilter === "donation"
        ) {
          return row.total_donations > 0;
        }

        if (
          categoryFilter === "membership"
        ) {
          return row.total_membership > 0;
        }

        if (
          categoryFilter === "pledge"
        ) {
          return row.total_pledge > 0;
        }

        return row.grand_total > 0;
      });
  }

  if (searchText) {
    const q =
      searchText.toLowerCase();

    statementRows =
      statementRows.filter((row) =>
        String(row.member_no || "")
          .toLowerCase()
          .includes(q) ||

        String(row.full_name || "")
          .toLowerCase()
          .includes(q) ||

        String(row.email || "")
          .toLowerCase()
          .includes(q) ||

        String(row.phone || "")
          .toLowerCase()
          .includes(q)
      );
  }

  statementRows.sort((a, b) => {
    return (
      Number(a.member_id || 0) -
      Number(b.member_id || 0)
    );
  });

  const summary =
    statementRows.reduce(
      (acc, row) => {
        acc.total_members++;

        if (
          Number(row.payment_count || 0) > 0
        ) {
          acc.members_with_contributions++;
        }

        acc.total_donations +=
          Number(row.total_donations || 0);

        acc.total_membership +=
          Number(row.total_membership || 0);

        acc.total_pledge +=
          Number(row.total_pledge || 0);

        acc.total_refunds +=
          Number(row.total_refunds || 0);

        acc.grand_total +=
          Number(row.grand_total || 0);

        return acc;
      },
      {
        year: selectedYear,

        total_members: 0,
        members_with_contributions: 0,

        total_donations: 0,
        total_membership: 0,
        total_pledge: 0,
        total_refunds: 0,
        grand_total: 0,
      }
    );

  return {
    rows: statementRows.slice(
      offset,
      offset + limit
    ),

    summary,

    pagination: {
      page,
      limit,

      total:
        statementRows.length,

      total_pages:
        Math.max(
          1,
          Math.ceil(
            statementRows.length / limit
          )
        ),
    },
  };
}


function statementHtml(statement) {
  const m = statement.member || {};
  const c = statement.church || {};
  const s = statement.summary || {};
  const sourceRows = statement.rows || [];

  const taxCategories = new Set([
    "donation",
    "membership",
    "pledge",
  ]);

  const rows = sourceRows.filter((row) =>
    taxCategories.has(
      String(row.category || "").toLowerCase()
    )
  );

  const fmt = (v) =>
    Number(v || 0).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

  const esc = (v) =>
    String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const date = (v) => {
    if (!v) return "--";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "--";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const generatedAt =
    statement.generated_at || new Date();

  
  const donorAddress = [
    m.address,
    m.address_line1,
    m.city,
    m.state,
    m.zip,
  ]
    .filter(Boolean)
    .join(", ");

  const totalDonations = Number(s.total_donations || 0);
  const totalMembership = Number(s.total_membership || 0);
  const totalPledge = Number(s.total_pledge || 0);
  const grandTotal =
    Number(s.grand_total || 0) ||
    rows.reduce(
      (sum, row) =>
        sum + Number(row.credit || row.amount || 0),
      0
    );

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(statement.year)} Official Contribution Statement</title>

<style>
  @page {
    size: Letter;
    margin: 0.55in;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #0f172a;
    background: #ffffff;
    font-size: 12px;
    line-height: 1.45;
  }

  .page {
    width: 100%;
    max-width: 8.5in;
    margin: 0 auto;
    background: #ffffff;
  }

  .top-bar {
    height: 8px;
    background: #0f3d32;
    border-radius: 999px;
    margin-bottom: 18px;
  }

  .church-header {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 24px;
    padding-bottom: 18px;
    border-bottom: 2px solid #0f3d32;
  }

  .church-name {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #0f3d32;
    margin: 0 0 6px;
  }

  .church-meta {
    color: #334155;
    font-size: 12px;
  }

  .statement-badge {
    text-align: right;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    padding: 14px 16px;
    min-width: 220px;
    background: #f8fafc;
  }

  .statement-badge .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #64748b;
    font-weight: 700;
  }

  .statement-badge .year {
    font-size: 28px;
    font-weight: 800;
    color: #0f172a;
    margin-top: 4px;
  }

  .title-row {
    padding: 22px 0 16px;
  }

  .title-row h1 {
    margin: 0;
    font-size: 21px;
    color: #0f172a;
  }

  .title-row p {
    margin: 6px 0 0;
    color: #475569;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 16px;
    margin-bottom: 18px;
  }

  .panel {
    border: 1px solid #dbe3ee;
    border-radius: 12px;
    padding: 16px;
    background: #ffffff;
  }

  .panel-title {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #0f3d32;
  }

  .field {
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 12px;
    margin: 6px 0;
  }

  .field .k {
    color: #64748b;
    font-weight: 700;
  }

  .field .v {
    color: #0f172a;
    font-weight: 700;
  }

  .total-box {
    background: #0f3d32;
    color: #ffffff;
    border-radius: 12px;
    padding: 18px;
    margin-top: 10px;
  }

  .total-box .label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #bbf7d0;
    font-weight: 800;
  }

  .total-box .amount {
    font-size: 30px;
    font-weight: 900;
    margin-top: 6px;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin: 18px 0;
  }

  .summary-card {
    border: 1px solid #dbe3ee;
    border-radius: 10px;
    padding: 12px;
    background: #f8fafc;
  }

  .summary-card span {
    display: block;
    color: #64748b;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.09em;
  }

  .summary-card strong {
    display: block;
    margin-top: 6px;
    font-size: 16px;
    color: #0f172a;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
    border: 1px solid #dbe3ee;
  }

  thead {
    display: table-header-group;
  }

  th {
    background: #0f3d32;
    color: #ffffff;
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 9px 8px;
  }

  td {
    padding: 9px 8px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
    font-size: 11px;
  }

  tr:nth-child(even) td {
    background: #f8fafc;
  }

  .right {
    text-align: right;
  }

  .amount {
    font-weight: 800;
  }

  .certification {
    margin-top: 18px;
    padding: 14px 16px;
    border: 1px solid #bbf7d0;
    background: #f0fdf4;
    border-radius: 12px;
    color: #14532d;
    font-weight: 700;
  }

  


td:nth-child(5) {
  max-width: 160px;
  overflow-wrap: anywhere;
  word-break: break-word;
  font-size: 10px;
}

td:nth-child(6) {
  white-space: nowrap;
  text-align: right;
  font-weight: 700;
}
  
  .footer {
    margin-top: 26px;
    padding-top: 12px;
    border-top: 1px solid #cbd5e1;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 16px;
    color: #64748b;
    font-size: 10px;
  }

  .muted {
    color: #64748b;
  }

  @media print {
    body {
      background: #ffffff;
    }

    .page {
      margin: 0;
      max-width: none;
    }

    .panel,
    .summary-card,
    .total-box {
      break-inside: avoid;
    }

    tr {
      break-inside: avoid;
    }
  }
</style>
</head>

<body>
<main class="page">

  <div class="top-bar"></div>

  <header class="church-header">
    <div>
      <h1 class="church-name">
        ${esc(c.name || "Debre Berhan Holy Trinity Ethiopian Orthodox Tewahedo Church")}
      </h1>


<div class="church-meta">

  <div>
    <strong>
      ${esc(
        c.legal_name ||
        c.name
      )}
    </strong>
  </div>

  <div>
    ${esc(c.address || "")}
  </div>

  <div>
    Phone:
    ${esc(c.phone || "--")}
    |
    Email:
    ${esc(c.email || "--")}
  </div>

  <div>
    Website:
    ${esc(c.website || "--")}
  </div>

  <div>
    EIN:
    ${esc(c.ein || "12-3456789")}
  </div>

</div>
    </div>

    <div class="statement-badge">
      <div class="label">Official Statement</div>
      <div class="year">${esc(statement.year)}</div>
      <div class="muted">Contribution Record</div>
    </div>
  </header>

  <section class="title-row">
    <h1>${esc(statement.year)} Year-End Contribution Statement</h1>
    <p>
      This document summarizes eligible recorded contributions received by the church
      during the calendar year shown.
    </p>
  </section>

  <section class="info-grid">
    <div class="panel">
      <h2 class="panel-title">Member / Donor Information</h2>

      <div class="field">
        <div class="k">Full Name</div>
        <div class="v">${esc(m.full_name || "--")}</div>
      </div>

      <div class="field">
        <div class="k">Member ID</div>
        <div class="v">${esc(m.member_no || "--")}</div>
      </div>

      <div class="field">
        <div class="k">Email</div>
        <div class="v">${esc(m.email || "--")}</div>
      </div>

      <div class="field">
        <div class="k">Phone</div>
        <div class="v">${esc(m.phone || "--")}</div>
      </div>

      <div class="field">
        <div class="k">Address</div>
        <div class="v">${esc(donorAddress || "--")}</div>
      </div>
    </div>

    <div class="panel">
      <h2 class="panel-title">Statement Details</h2>

     
      <div class="field">
        <div class="k">Tax Year</div>
        <div class="v">${esc(statement.year)}</div>
      </div>

      
      <div class="total-box">
        <div class="label">Total Contributions</div>
        <div class="amount">${fmt(grandTotal)}</div>
      </div>
    </div>
  </section>

  <section class="summary-grid">
    <div class="summary-card">
      <span>Donations</span>
      <strong>${fmt(totalDonations)}</strong>
    </div>

    <div class="summary-card">
      <span>Membership</span>
      <strong>${fmt(totalMembership)}</strong>
    </div>

    <div class="summary-card">
      <span>Pledge</span>
      <strong>${fmt(totalPledge)}</strong>
    </div>

    <div class="summary-card">
      <span>Total</span>
      <strong>${fmt(grandTotal)}</strong>
    </div>
  </section>

  <section>
    <h2 class="panel-title">Contribution Detail</h2>

    <table>
      <thead>
        <tr>
          <th style="width: 90px;">Date</th>
          <th>Category</th>
          <th>Description</th>
          <th style="width: 90px;">Method</th>
          <th style="width: 180px;">Reference</th>
          <th class="right" style="width: 110px;">Amount</th>
        </tr>
      </thead>

      <tbody>
        ${
          rows.length
            ? rows
                .map((row) => {
                  const category =
                    row.category_label ||
                    categoryLabel(row.category);

                  const description =
                    row.description ||
                    row.sub_category ||
                    row.notes ||
                    "--";

                  const method =
                    row.payment_method_label ||
                    row.payment_method ||
                    row.method ||
                    "--";

                  const ref =
                    row.receipt_number ||
                    row.reference_no ||
                    row.payment_number ||
                    "--";

                  const amount =
                    row.credit ||
                    row.amount ||
                    0;

                  return `
        <tr>
          <td>${esc(date(row.entry_date || row.paid_at || row.created_at))}</td>
          <td>${esc(category)}</td>
          <td>${esc(description)}</td>
          <td>${esc(method)}</td>
          <td>${esc(ref)}</td>
          <td class="right amount">${fmt(amount)}</td>
        </tr>`;
                })
                .join("")
            : `
        <tr>
          <td colspan="6">No eligible paid contributions were found for this year.</td>
        </tr>`
        }
      </tbody>
    </table>
  </section>

  <section class="certification">
    ${
      esc(
        statement.certification ||
          "No goods or services were provided in exchange for these contributions except intangible religious benefits."
      )
    }
  </section>


<footer class="footer">
  <div>
    ${esc(c.legal_name || c.name)}
    ·
    ${esc(c.address || "")}
  </div>

  <div>
    ${esc(c.website || "")}
  </div>
</footer>

</main>
</body>
</html>`;
}




async function statementPdfBuffer(statement) {
  let PDFDocument = null;

  try {
    PDFDocument = require("pdfkit");
  } catch (_err) {}

  if (!PDFDocument) {
    return {
      buffer: Buffer.from(statementHtml(statement), "utf8"),
      contentType: "text/html; charset=utf-8",
      extension: "html",
    };
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margin: 42,
      info: {
        Title: `${statement.year} Contribution Statement`,
        Author:
          statement.church?.name ||
          "Debre Berhan Holy Trinity Ethiopian Orthodox Tewahedo Church",
        Subject: "Official Year-End Contribution Statement",
      },
    });

    const chunks = [];

    const m = statement.member || {};
    const c = statement.church || {};
    const s = statement.summary || {};

    const rows = (statement.rows || []).filter((row) =>
      ["donation", "membership", "pledge"].includes(
        String(row.category || "").toLowerCase()
      )
    );

    const green = "#0f3d32";
    const lightGreen = "#f0fdf4";
    const border = "#dbe3ee";
    const muted = "#64748b";
    const text = "#0f172a";

    const fmt = (v) =>
      Number(v || 0).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      });

    const date = (v) => {
      if (!v) return "--";
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return "--";
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
    };

    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const left = doc.page.margins.left;
    let y = doc.page.margins.top;



  const churchLegalName =
  c.legal_name ||
  c.name ||
  "Debre Berhan Holy Trinity Ethiopian Orthodox Tewahedo Church";

const churchAddress =
  c.address ||
  "2558 Couchville Pike, Nashville, TN 37217";

const churchWebsite =
  c.website ||
  "www.holytrinityeotc.org";

const churchEin =
  c.ein ||
  "123-Test";
    
    const generatedAt =
      statement.generated_at || new Date();

    const grandTotal =
      Number(s.grand_total || 0) ||
      rows.reduce(
        (sum, row) => sum + Number(row.credit || row.amount || 0),
        0
      );

function drawFooter() {
  const footerY =
  doc.page.height - 70;
  doc
    .moveTo(left, footerY)
    .lineTo(left + pageWidth, footerY)
    .strokeColor("#d1d5db")
    .stroke();

  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor("#64748b")
    doc.text(churchLegalName, left, footerY, {
      width: pageWidth - 160,
      lineBreak: false,
    });

  doc.text(churchWebsite || "", left + pageWidth - 150, footerY, {
    width: 150,
    align: "right",
    lineBreak: false,
  });
}

let newPageStarted = false;



let pageBreak = false;

function ensureSpace(height) {
  const bottomLimit =
    doc.page.height -
    doc.page.margins.bottom -
    40;

  if (y + height > bottomLimit) {
    drawFooter();
    doc.addPage();
    y = doc.page.margins.top;
    pageBreak = true;
  }
} 
 function labelValue(label, value, x, yPos, width) {

      doc
        .fontSize(8)
        .fillColor(muted)
        .font("Helvetica-Bold")
        .text(label.toUpperCase(), x, yPos, { width });

      doc
        .fontSize(10)
        .fillColor(text)
        .font("Helvetica-Bold")
        .text(value || "--", x, yPos + 14, { width });
    }

    doc.on("data", (chunk) => chunks.push(chunk));

    doc.on("end", () =>
      resolve({
        buffer: Buffer.concat(chunks),
        contentType: "application/pdf",
        extension: "pdf",
      })
    );

doc.on("error", reject);

// =====================================================
// TOP BAR
// =====================================================

doc
  .roundedRect(left, y, pageWidth, 8, 4)
  .fillColor(green)
  .fill();

y += 22;

// =====================================================
// CHURCH HEADER
// =====================================================

const headerWidth = pageWidth - 190;

doc
  .font("Helvetica-Bold")
  .fontSize(18)
  .fillColor(green);

doc.text(
  churchLegalName,
  left,
  y,
  {
    width: headerWidth
  }
);

const nameHeight = doc.heightOfString(
  churchLegalName,
  {
    width: headerWidth
  }
);

let infoY = y + nameHeight + 8;

doc
  .font("Helvetica")
  .fontSize(9)
  .fillColor("#334155");

doc.text(
  churchAddress,
  left,
  infoY
);

infoY += 14;

doc.text(
  `Phone: ${c.phone || "--"} | Email: ${c.email || "--"}`,
  left,
  infoY
);

infoY += 14;

doc.text(
  `Website: ${churchWebsite}`,
  left,
  infoY
);

infoY += 14;

doc.text(
  `Federal Tax ID (EIN): ${churchEin}`,
  left,
  infoY
);

// =====================================================
// RIGHT HEADER BADGE
// =====================================================

doc
  .roundedRect(
    left + pageWidth - 160,
    y,
    160,
    58,
    10
  )
  .fillColor("#f8fafc")
  .fill()
  .strokeColor(border)
  .stroke();

doc
  .font("Helvetica-Bold")
  .fontSize(8)
  .fillColor(muted)
  .text(
    "OFFICIAL YEAR-END CONTRIBUTION STATEMENT",
    left + pageWidth - 145,
    y + 12,
    {
      width: 130,
      align: "right"
    }
  );

doc
  .font("Helvetica-Bold")
  .fontSize(24)
  .fillColor(text)
  .text(
    String(statement.year),
    left + pageWidth - 145,
    y + 27,
    {
      width: 130,
      align: "right"
    }
  );

// =====================================================
// HEADER BOTTOM POSITION
// =====================================================

const bottomOfHeader = Math.max(
  infoY + 14,
  y + 58
);

y = bottomOfHeader + 25;

// =====================================================
// DIVIDER
// =====================================================

doc
  .moveTo(left, y)
  .lineTo(left + pageWidth, y)
  .strokeColor(green)
  .lineWidth(1.5)
  .stroke();

y += 18;

// =====================================================
// DOCUMENT TITLE
// =====================================================

doc
  .font("Helvetica-Bold")
  .fontSize(18)
  .fillColor(text)
  .text(
    `${statement.year} OFFICIAL YEAR-END CONTRIBUTION STATEMENT`,
    left,
    y
  );

y += 26;

doc
  .font("Helvetica")
  .fontSize(10)
  .fillColor("#334155")
  .text(
    "This official statement summarizes eligible recorded contributions received by the church during the calendar year shown.",
    left,
    y,
    {
      width: pageWidth
    }
  );

y += 32;

// =====================================================
// MEMBER + STATEMENT PANELS
// =====================================================

const panelGap = 14;
const panelW = (pageWidth - panelGap) / 2;
const panelH = 150;

doc
  .roundedRect(
    left,
    y,
    panelW,
    panelH,
    10
  )
  .strokeColor(border)
  .stroke();

doc
  .roundedRect(
    left + panelW + panelGap,
    y,
    panelW,
    panelH,
    10
  )
  .strokeColor(border)
  .stroke();

doc
  .font("Helvetica-Bold")
  .fontSize(11)
  .fillColor(green)
  .text(
    "MEMBER / DONOR INFORMATION",
    left + 14,
    y + 14
  );

labelValue(
  "Full Name",
  m.full_name || "--",
  left + 14,
  y + 38,
  panelW - 28
);

labelValue(
  "Member ID",
  m.member_no || "--",
  left + 14,
  y + 72,
  panelW - 28
);

labelValue(
  "Email",
  m.email || "--",
  left + 14,
  y + 106,
  panelW - 28
);

doc
  .font("Helvetica-Bold")
  .fontSize(11)
  .fillColor(green)
  .text(
    "STATEMENT DETAILS",
    left + panelW + panelGap + 14,
    y + 14
  );

labelValue(
  "Tax Year",
  String(statement.year),
  left + panelW + panelGap + 14,
  y + 38,
  panelW - 28
);


labelValue(
  "Official Statement",
  "Church Contribution Record",
  left + panelW + panelGap + 14,
  y + 72,
  panelW - 28
);
y += panelH + 18;

  
    // Summary cards
    const cardGap = 10;
    const cardW = (pageWidth - cardGap * 3) / 4;
    const cardH = 62;

    const cards = [
      ["Donations", fmt(s.total_donations)],
      ["Membership", fmt(s.total_membership)],
      ["Pledge", fmt(s.total_pledge)],
      ["Total Contributions", fmt(grandTotal)],
    ];

    cards.forEach(([label, value], index) => {
      const x = left + index * (cardW + cardGap);

      doc
        .roundedRect(x, y, cardW, cardH, 9)
        .fillColor(index === 3 ? green : "#f8fafc")
        .fill()
        .strokeColor(index === 3 ? green : border)
        .stroke();

      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(index === 3 ? "#bbf7d0" : muted)
        .text(label.toUpperCase(), x + 10, y + 12, {
          width: cardW - 20,
        });

      doc
        .fontSize(14)
        .fillColor(index === 3 ? "#ffffff" : text)
        .text(value, x + 10, y + 32, {
          width: cardW - 20,
        });
    });

    y += cardH + 24;

    // Contribution detail
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(green)
      .text("CONTRIBUTION DETAIL", left, y);

    y += 18;

const col = {
  date: left,
  cat: left + 65,
  desc: left + 125,
  method: left + 315,
  ref: left + 385,
  amount: left + pageWidth - 70,
};
function tableHeader() {
  doc
    .rect(left, y, pageWidth, 24)
    .fillColor(green)
    .fill();

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#ffffff");

  doc.text(
    "DATE",
    col.date + 6,
    y + 8,
    { width: 60 }
  );

  doc.text(
    "CATEGORY",
    col.cat,
    y + 8,
    { width: 70 }
  );

  doc.text(
    "DESCRIPTION",
    col.desc,
    y + 8,
    { width: 180 }
  );

  doc.text(
    "METHOD",
    col.method,
    y + 8,
    { width: 60 }
  );

  doc.text(
    "REFERENCE",
    col.ref,
    y + 8,
    { width: 115 }
  );

  doc.text(
    "AMOUNT",
    col.amount,
    y + 8,
    {
      width: 78,
      align: "right",
    }
  );

  y += 24;
}
    tableHeader();

    if (!rows.length) {
      doc
        .rect(left, y, pageWidth, 28)
        .fillColor("#ffffff")
        .fill()
        .strokeColor(border)
        .stroke();

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(text)
        .text("No eligible paid contributions were found for this year.", left + 8, y + 9);

      y += 28;
    } else {
      rows.forEach((row, index) => {
        ensureSpace(36);
if (pageBreak) {
  tableHeader();
  pageBreak = false;
}

        const bg = index % 2 === 0 ? "#ffffff" : "#f8fafc";

        doc
          .rect(left, y, pageWidth, 30)
          .fillColor(bg)
          .fill();

        doc
          .moveTo(left, y + 30)
          .lineTo(left + pageWidth, y + 30)
          .strokeColor("#e2e8f0")
          .lineWidth(1)
          .stroke();

        const category =
          row.category_label ||
          categoryLabel(row.category);

        const description =
          row.description ||
          row.sub_category ||
          row.notes ||
          "--";

        const method =
          row.payment_method_label ||
          row.payment_method ||
          row.method ||
          "--";

        let reference =
  row.receipt_number ||
  row.reference_no ||
  row.payment_number ||
  "--";

if (
  typeof reference === "string" &&
  reference.length > 18
) {
  reference =
    reference.substring(0, 15) + "...";
}
        const amount =
          row.credit ||
          row.amount ||
          0;

        doc
          .font("Helvetica")
          .fontSize(8.5)
          .fillColor(text);

        doc.text(date(row.entry_date || row.paid_at || row.created_at), col.date + 6, y + 9, {
          width: 62,
        });

        doc.text(category, col.cat, y + 9, {
          width: 70,
        });

        doc.text(description, col.desc, y + 9, {
          width: 150,
          ellipsis: true,
        });

        doc.text(method, col.method, y + 9, {
          width: 55,
        });

      doc.text(reference, col.ref, y + 9, {
  width: 65,
  ellipsis: true,
});

doc
  .font("Helvetica-Bold")
  .text(
    fmt(amount),
    col.amount,
    y + 9,
    {
      width: 80,
      align: "right",
    }
  );
        y += 30;
      });
    }

    y += 10;

    ensureSpace(80);

  doc
  .roundedRect(left, y, pageWidth, 60, 9)
  .fillColor(lightGreen)
  .fill()
  .strokeColor("#bbf7d0")
  .stroke();

doc
  .font("Helvetica-Bold")
  .fontSize(10)
  .fillColor("#14532d")
  .text(
    "OFFICIAL CHURCH CERTIFICATION",
    left + 12,
    y + 12
  );

doc
  .font("Helvetica")
  .fontSize(9)
  .fillColor("#14532d")
  .text(
    "This statement certifies the contributions recorded by the church during the tax year shown. No goods or services were provided in exchange for these contributions other than intangible religious benefits.",
    left + 12,
    y + 28,
    {
      width: pageWidth - 24,
    }
  );
y += 70;
    
console.log(
  "Final PDF page count:",
  doc.bufferedPageRange().count
);
    // drawFooter();
drawFooter();
doc.end();
  });

}




function optionalEmailSender() {
  const candidates = [
    "../../emailService",
    "../../mailService",
    "../../mailer",
    "../../../services/emailService",
    "../../../services/mailService",
    "../../../services/mailer",
  ];

  for (const candidate of candidates) {
    try {
      const mod = require(candidate);
      if (typeof mod?.sendEmail === "function") return mod.sendEmail;
      if (typeof mod?.sendMail === "function") return mod.sendMail;
      if (typeof mod?.transporter?.sendMail === "function") {
        return (message) => mod.transporter.sendMail(message);
      }
    } catch (_err) {}
  }

  return null;
}

function optionalAuditWriter() {
  try {
    const audit = require("../audit/auditLogService");

    if (audit && typeof audit.writeAuditLog === "function") {
      return audit.writeAuditLog;
    }
  } catch (_err) {}

  return null;
}

async function emailMemberYearStatement({ member_id, year, to, actor_id }) {
  const statement = await getMemberYearStatement({ member_id, year });
  const recipient = to || statement.member.email;

  if (!recipient) {
    const err = new Error("Member email is required to send a statement.");
    err.status = 400;
    throw err;
  }

  const sendMail = optionalEmailSender();
  if (!sendMail) {
    const err = new Error("Email service is not configured.");
    err.status = 500;
    throw err;
  }

  const pdf = await statementPdfBuffer(statement);
  const filename = `${statement.year}-contribution-statement-${statement.member.member_no || member_id}.${pdf.extension}`;

  const result = await sendMail({
    to: recipient,
    subject: `${statement.year} Holy Trinity Contribution Statement`,
    html: statementHtml(statement),
    attachments: [
      {
        filename,
        content: pdf.buffer,
        contentType: pdf.contentType,
      },
    ],
  });

  const writeAuditLog = optionalAuditWriter();

  if (writeAuditLog) {
    await writeAuditLog(null, {
      actor_id: actor_id || null,
      action: "ledger.statement_emailed",
      entity_type: "member_ledger_statement",
      entity_id: member_id,
      description: `${statement.year} contribution statement emailed to ${recipient}.`,
      metadata: {
        year: statement.year,
        member_id,
        member_no: statement.member.member_no,
        recipient,
      },
    }).catch(() => null);
  }

  return { ok: true, result, statement };
}

module.exports = {
  createLedgerEntry,
  postPaymentEntry,
  getLedgerEntryById,
  getLatestMemberBalance,
  listLedgerEntries,
  listMemberYearStatements,
  getMemberYearStatement,
  statementHtml,
  statementPdfBuffer,
  emailMemberYearStatement,
  resolveMemberIdForUser,
};
