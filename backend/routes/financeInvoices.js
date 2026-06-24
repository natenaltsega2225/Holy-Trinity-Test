// backend/routes/financeInvoices.js
"use strict";

const express = require("express");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const {
  insertExistingColumns,
  updateExistingColumns,
} = require("../utils/dbHelpers");

const exportService = require("../services/domains/export/exportService");

function optionalRequire(modulePath) {
  try {
    return require(modulePath);
  } catch (err) {
    if (err?.code !== "MODULE_NOT_FOUND") {
      console.error(`Failed loading ${modulePath}:`, err.message);
    }

    return {};
  }
}

const invoicePdfService = optionalRequire("../services/domains/invoices/invoicePdfService");
const invoiceEmailService = optionalRequire("../services/domains/invoices/invoiceEmailService");
const invoiceGenerationService = optionalRequire("../services/domains/invoices/invoiceGenerationService");
const publicAccess = optionalRequire("../services/domains/invoices/invoicePublicAccessService");

const router = express.Router();

const INVOICE_TABLE = "tbl_finance_invoices";
const META_TTL_MS = 60 * 1000;
const metaCache = new Map();

const FINANCE_ROLES = [
  "finance",
  "admin",
  "super_admin",
  "reconciliation",
];

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

router.get(["/invoices/health/check", "/health/check"], (_req, res) => {
  return res.json({
    ok: true,
    module: "financeInvoices",
    version: "enterprise",
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* Security                                                                   */
/* -------------------------------------------------------------------------- */

router.use(authRequired);
router.use(requireRole(...FINANCE_ROLES));

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clean(value, max = 255) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function money(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function safeId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function positiveInt(value, fallback = 1, max = 500) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function code(prefix) {
  return `${prefix}-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

function reqUserId(req) {
  return req.user?.id || req.user?.user_id || null;
}

function reqActorName(req) {
  return (
    req.user?.full_name ||
    req.user?.name ||
    req.user?.username ||
    req.user?.email ||
    "system"
  );
}

function reqIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    null
  );
}

function safeJson(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value);
  } catch (_err) {
    return null;
  }
}

function sqlId(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(String(name || ""))) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }

  return `\`${name}\``;
}

function has(columns, column) {
  return columns?.has(column);
}

function col(alias, column) {
  return `${alias}.${sqlId(column)}`;
}

async function columnsFor(tableName) {
  const cached = metaCache.get(tableName);

  if (cached && Date.now() - cached.loadedAt < META_TTL_MS) {
    return cached.columns;
  }

  const [rows] = await pool.query(
    `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    `,
    [tableName]
  );

  const columns = new Set(rows.map((row) => row.COLUMN_NAME));

  metaCache.set(tableName, {
    columns,
    loadedAt: Date.now(),
  });

  return columns;
}

async function tableExists(tableName) {
  const columns = await columnsFor(tableName);
  return columns.size > 0;
}

async function firstExistingTable(names) {
  for (const name of names) {
    if (await tableExists(name)) return name;
  }

  return null;
}

function textExpr(alias, columns, candidates, fallbackSql = "NULL") {
  const parts = candidates
    .filter((column) => has(columns, column))
    .map((column) => col(alias, column));

  return parts.length
    ? `COALESCE(${parts.join(", ")}, ${fallbackSql})`
    : fallbackSql;
}

function numberExpr(alias, columns, candidates, fallbackSql = "0") {
  return `CAST(${textExpr(alias, columns, candidates, fallbackSql)} AS DECIMAL(18,2))`;
}

function allowedInvoiceStatus(value, fallback = "open") {
  const status = clean(value || fallback, 40).toLowerCase();

  if (status === "canceled") return "cancelled";
  if (status === "voided") return "void";

  if (
    [
      "draft",
      "open",
      "pending",
      "partial",
      "paid",
      "overdue",
      "cancelled",
      "void",
      "refunded",
    ].includes(status)
  ) {
    return status;
  }

  return fallback;
}

function computeStatus(total, paid, requested = "open") {
  const amount = money(total);
  const paidAmount = money(paid);

  if (amount > 0 && paidAmount >= amount) return "paid";
  if (paidAmount > 0 && paidAmount < amount) return "partial";

  return allowedInvoiceStatus(requested, "open");
}

function invoiceAmountDue(invoice = {}) {
  const explicit =
    invoice.balance_due ??
    invoice.remaining_amount ??
    invoice.outstanding_amount;

  if (explicit !== undefined && explicit !== null && explicit !== "") {
    return Math.max(money(explicit), 0);
  }

  return Math.max(
    money(invoice.total_amount ?? invoice.amount ?? invoice.invoice_amount) -
      money(invoice.paid_amount ?? invoice.amount_paid),
    0
  );
}

function isInvoicePayable(invoice = {}) {
  const status = clean(invoice.invoice_status || invoice.status, 40).toLowerCase();

  if (["paid", "void", "cancelled", "canceled", "refunded"].includes(status)) {
    return false;
  }

  return invoiceAmountDue(invoice) > 0;
}

function safePdfFileName(value) {
  return `${clean(value || "invoice", 140)
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")}.pdf`;
}

function routeError(res, err, fallback, status = 500) {
  console.error(fallback, err);

  return res.status(err.status || err.statusCode || status).json({
    ok: false,
    error: err.status || err.statusCode ? err.message : err.message || fallback,
  });
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                      */
/* -------------------------------------------------------------------------- */

async function writeAudit(req, action, entityId, details = {}) {
  try {
    const tableName = await firstExistingTable([
      "tbl_audit_logs",
      "tbl_finance_audit_logs",
      "tbl_finance_audit",
    ]);

    if (!tableName) return;

    const columns = await columnsFor(tableName);
    const insertColumns = [];
    const placeholders = [];
    const values = [];

    function add(column, value) {
      if (!has(columns, column)) return;
      insertColumns.push(sqlId(column));
      placeholders.push("?");
      values.push(value);
    }

    function addNow(column) {
      if (!has(columns, column)) return;
      insertColumns.push(sqlId(column));
      placeholders.push("NOW()");
    }

    add("user_id", reqUserId(req));
    add("actor_id", reqUserId(req));
    add("staff_id", reqUserId(req));
    add("created_by", reqUserId(req));
    add("actor_name", reqActorName(req));
    add("user_name", reqActorName(req));

    add("module", "finance_invoices");
    add("entity_type", "invoice");
    add("record_type", "invoice");
    add("entity_id", entityId);
    add("record_id", entityId);

    add("action", action);
    add("action_type", action);
    add("event_type", action);
    add("description", `Invoice action: ${action}`);
    add("status", "success");
    add("severity", "info");
    add("ip_address", reqIp(req));
    add("ip", reqIp(req));
    add("user_agent", req.headers["user-agent"] || null);

    add("details", JSON.stringify(details));
    add("details_json", JSON.stringify(details));
    add("metadata", JSON.stringify(details));
    add("metadata_json", JSON.stringify(details));

    addNow("created_at");
    addNow("updated_at");

    if (!insertColumns.length) return;

    await pool.query(
      `
      INSERT INTO ${sqlId(tableName)}
      (${insertColumns.join(", ")})
      VALUES (${placeholders.join(", ")})
      `,
      values
    );
  } catch (err) {
    console.error("finance invoice audit failed:", err.message);
  }
}

/* -------------------------------------------------------------------------- */
/* Query Builder                                                              */
/* -------------------------------------------------------------------------- */

function memberNameExpression(memberColumns) {
  if (has(memberColumns, "full_name")) return "m.`full_name`";
  if (has(memberColumns, "name")) return "m.`name`";

  if (has(memberColumns, "first_name") || has(memberColumns, "last_name")) {
    return `NULLIF(TRIM(CONCAT_WS(' ',
      ${has(memberColumns, "first_name") ? "m.`first_name`" : "NULL"},
      ${has(memberColumns, "last_name") ? "m.`last_name`" : "NULL"}
    )), '')`;
  }

  return "NULL";
}

async function invoiceQueryParts() {
  if (!(await tableExists(INVOICE_TABLE))) {
    const error = new Error("Invoice table tbl_finance_invoices does not exist.");
    error.status = 500;
    throw error;
  }

  const invoiceColumns = await columnsFor(INVOICE_TABLE);

  const paymentTable = await firstExistingTable([
    "tbl_finance_payments",
    "tbl_payments",
  ]);

  const receiptTable = await firstExistingTable([
    "tbl_finance_receipts",
    "tbl_receipts",
  ]);

  const memberTable = await firstExistingTable([
    "tbl_members",
    "members",
  ]);

  const campaignTable = await firstExistingTable([
    "tbl_finance_campaigns",
    "tbl_campaigns",
  ]);

  const paymentColumns = paymentTable ? await columnsFor(paymentTable) : new Set();
  const receiptColumns = receiptTable ? await columnsFor(receiptTable) : new Set();
  const memberColumns = memberTable ? await columnsFor(memberTable) : new Set();
  const campaignColumns = campaignTable ? await columnsFor(campaignTable) : new Set();

  const joins = [];
  let paymentJoined = false;
  let memberJoined = false;
  let campaignJoined = false;
  let receiptJoined = false;

  if (paymentTable && has(invoiceColumns, "payment_id") && has(paymentColumns, "id")) {
    paymentJoined = true;
    joins.push(`
      LEFT JOIN ${sqlId(paymentTable)} pay
        ON pay.id = i.payment_id
    `);
  } else if (paymentTable && has(paymentColumns, "invoice_id")) {
    paymentJoined = true;
    joins.push(`
      LEFT JOIN (
        SELECT invoice_id, MAX(id) AS latest_payment_id
        FROM ${sqlId(paymentTable)}
        WHERE invoice_id IS NOT NULL
        GROUP BY invoice_id
      ) pay_pick
        ON pay_pick.invoice_id = i.id

      LEFT JOIN ${sqlId(paymentTable)} pay
        ON pay.id = pay_pick.latest_payment_id
    `);
  }

  if (memberTable && has(invoiceColumns, "member_id")) {
    const memberIdColumn = has(memberColumns, "id")
      ? "id"
      : has(memberColumns, "member_id")
        ? "member_id"
        : null;

    if (memberIdColumn) {
      memberJoined = true;
      joins.push(`
        LEFT JOIN ${sqlId(memberTable)} m
          ON m.${sqlId(memberIdColumn)} = i.member_id
      `);
    }
  }

  if (campaignTable && has(invoiceColumns, "campaign_id") && has(campaignColumns, "id")) {
    campaignJoined = true;
    joins.push(`
      LEFT JOIN ${sqlId(campaignTable)} camp
        ON camp.id = i.campaign_id
    `);
  }

  if (receiptTable && has(receiptColumns, "invoice_id")) {
    receiptJoined = true;
    joins.push(`
      LEFT JOIN (
        SELECT
          r.invoice_id,
          MIN(${textExpr("r", receiptColumns, ["receipt_number", "receipt_no", "number"], "CONCAT('RCPT-', r.id)")}) AS receipt_number,
          COUNT(*) AS receipt_count
        FROM ${sqlId(receiptTable)} r
        WHERE r.invoice_id IS NOT NULL
        GROUP BY r.invoice_id
      ) rec
        ON rec.invoice_id = i.id
    `);
  }

  const invoiceNumber = textExpr(
    "i",
    invoiceColumns,
    ["invoice_number", "invoice_no", "number"],
    "CONCAT('INV-', i.id)"
  );

  const paymentNumber = paymentJoined
    ? textExpr("pay", paymentColumns, ["payment_number", "payment_no", "transaction_reference", "reference_no", "reference_number"], "NULL")
    : "NULL";

  const receiptNumber = receiptJoined ? "rec.receipt_number" : "NULL";
  const receiptCount = receiptJoined ? "COALESCE(rec.receipt_count, 0)" : "0";

  const invoiceName = textExpr(
    "i",
    invoiceColumns,
    [
      "payer_name",
      "donor_name",
      "guest_name",
      "customer_name",
      "member_name",
      "full_name_snapshot",
      "full_name",
      "bill_to",
    ],
    "NULL"
  );

  const memberName = memberJoined ? memberNameExpression(memberColumns) : "NULL";
  const donorName = `COALESCE(${invoiceName}, ${memberName}, 'Guest Donor')`;

  const invoiceEmail = textExpr(
    "i",
    invoiceColumns,
    [
      "payer_email",
      "donor_email",
      "guest_email",
      "customer_email",
      "email_snapshot",
      "recipient_email",
      "member_email",
      "email",
    ],
    "NULL"
  );

  const paymentEmail = paymentJoined
    ? textExpr("pay", paymentColumns, ["email", "email_snapshot", "payer_email", "member_email", "donor_email"], "NULL")
    : "NULL";

  const memberEmail = memberJoined
    ? textExpr("m", memberColumns, ["email", "member_email"], "NULL")
    : "NULL";

  const email = `COALESCE(${invoiceEmail}, ${paymentEmail}, ${memberEmail})`;

  const memberNo = `COALESCE(
    ${textExpr("i", invoiceColumns, ["member_no", "member_number"], "NULL")},
    ${paymentJoined ? textExpr("pay", paymentColumns, ["member_no", "member_number"], "NULL") : "NULL"},
    ${memberJoined ? textExpr("m", memberColumns, ["member_no", "member_number", "member_id"], "NULL") : "NULL"}
  )`;

  const phone = `COALESCE(
    ${textExpr("i", invoiceColumns, ["payer_phone", "donor_phone", "guest_phone", "customer_phone", "phone", "phone_snapshot", "member_phone"], "NULL")},
    ${paymentJoined ? textExpr("pay", paymentColumns, ["phone", "phone_snapshot"], "NULL") : "NULL"},
    ${memberJoined ? textExpr("m", memberColumns, ["phone", "phone_number", "mobile"], "NULL") : "NULL"}
  )`;

  const amount = numberExpr(
    "i",
    invoiceColumns,
    ["total_amount", "amount", "invoice_amount", "subtotal"],
    "0"
  );

  const paidAmount = numberExpr(
    "i",
    invoiceColumns,
    ["paid_amount", "amount_paid", "collected_amount"],
    "0"
  );

  const storedBalance = numberExpr(
    "i",
    invoiceColumns,
    ["balance_due", "remaining_amount", "outstanding_amount"],
    "NULL"
  );

  const balanceDue = `GREATEST(COALESCE(${storedBalance}, ${amount} - ${paidAmount}), 0)`;

  const status = textExpr("i", invoiceColumns, ["status", "invoice_status"], "'open'");
  const emailStatus = textExpr("i", invoiceColumns, ["email_status", "invoice_email_status", "delivery_status"], "'not_sent'");

  const category = textExpr(
    "i",
    invoiceColumns,
    ["category", "invoice_type", "payment_type", "payment_category", "finance_category", "donation_category"],
    "NULL"
  );

  const method = `COALESCE(
    ${textExpr("i", invoiceColumns, ["payment_method", "method"], "NULL")},
    ${paymentJoined ? textExpr("pay", paymentColumns, ["payment_method", "method", "payment_type"], "NULL") : "NULL"}
  )`;

  const referenceNumber = `COALESCE(
    ${textExpr("i", invoiceColumns, ["reference_no", "reference_number", "transaction_reference", "stripe_payment_intent_id"], "NULL")},
    ${paymentJoined ? textExpr("pay", paymentColumns, ["reference_no", "reference_number", "transaction_reference", "stripe_payment_intent_id"], "NULL") : "NULL"}
  )`;

  const invoiceDate = textExpr("i", invoiceColumns, ["invoice_date", "issued_at", "created_at", "date"], "NOW()");
  const dueDate = textExpr("i", invoiceColumns, ["due_date", "invoice_due_date"], "NULL");

  const campaignName = `COALESCE(
    ${textExpr("i", invoiceColumns, ["campaign_name", "pledge_campaign", "campaign"], "NULL")},
    ${campaignJoined ? textExpr("camp", campaignColumns, ["campaign_name", "name", "title"], "NULL") : "NULL"}
  )`;

  return {
    invoiceColumns,
    joins: joins.join("\n"),
    expressions: {
      invoiceNumber,
      paymentNumber,
      receiptNumber,
      receiptCount,
      memberName: donorName,
      memberNo,
      phone,
      email,
      amount,
      paidAmount,
      balanceDue,
      status,
      emailStatus,
      category,
      method,
      referenceNumber,
      invoiceDate,
      dueDate,
      campaignName,
    },
  };
}

function buildInvoiceWhere(query, parts) {
  const clauses = ["1=1"];
  const params = [];
  const q = query || {};
  const columns = parts.invoiceColumns;
  const e = parts.expressions;

  for (const column of [
    "member_id",
    "payment_id",
    "pledge_id",
    "campaign_id",
    "registration_id",
    "news_event_id",
    "program_id",
  ]) {
    if (q[column] != null && q[column] !== "" && has(columns, column)) {
      clauses.push(`i.${sqlId(column)} = ?`);
      params.push(q[column]);
    }
  }

  if (q.status && q.status !== "all") {
    clauses.push(`LOWER(${e.status}) = ?`);
    params.push(clean(q.status, 40).toLowerCase());
  }

  if (q.email_status && q.email_status !== "all") {
    clauses.push(`LOWER(${e.emailStatus}) = ?`);
    params.push(clean(q.email_status, 40).toLowerCase());
  }

  if (q.category && q.category !== "all") {
    clauses.push(`LOWER(${e.category}) LIKE ?`);
    params.push(`%${clean(q.category, 80).toLowerCase()}%`);
  }

  if (q.method && q.method !== "all") {
    clauses.push(`LOWER(${e.method}) = ?`);
    params.push(clean(q.method, 40).toLowerCase());
  }

  if (q.date_from || q.from || q.start_date) {
    clauses.push(`DATE(${e.invoiceDate}) >= DATE(?)`);
    params.push(clean(q.date_from || q.from || q.start_date, 20));
  }

  if (q.date_to || q.to || q.end_date) {
    clauses.push(`DATE(${e.invoiceDate}) <= DATE(?)`);
    params.push(clean(q.date_to || q.to || q.end_date, 20));
  }

  if (q.amount_min || q.min_amount) {
    clauses.push(`${e.amount} >= ?`);
    params.push(money(q.amount_min || q.min_amount));
  }

  if (q.amount_max || q.max_amount) {
    clauses.push(`${e.amount} <= ?`);
    params.push(money(q.amount_max || q.max_amount));
  }

  const search = clean(q.search || q.q || "", 120);

  if (search) {
    clauses.push(`
      (
        ${e.invoiceNumber} LIKE ?
        OR ${e.paymentNumber} LIKE ?
        OR ${e.receiptNumber} LIKE ?
        OR ${e.referenceNumber} LIKE ?
        OR ${e.email} LIKE ?
        OR ${e.memberName} LIKE ?
        OR ${e.memberNo} LIKE ?
      )
    `);

    params.push(
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`
    );
  }

  return {
    sql: `WHERE ${clauses.join(" AND ")}`,
    params,
  };
}

function buildInvoiceOrder(query) {
  const direction =
    String(query.direction || query.dir || "desc").toLowerCase() === "asc"
      ? "ASC"
      : "DESC";

  const sort = clean(query.sort || "date", 40);

  const map = {
    id: "i.id",
    date: "invoice_date",
    invoice_date: "invoice_date",
    due_date: "due_date",
    amount: "amount",
    paid: "paid_amount",
    balance: "balance_due",
    status: "invoice_status",
    email_status: "email_status",
  };

  return `ORDER BY ${map[sort] || "invoice_date"} ${direction}, i.id ${direction}`;
}

/* -------------------------------------------------------------------------- */
/* Core Invoice Operations                                                    */
/* -------------------------------------------------------------------------- */

async function listInvoicesInternal(query = {}) {
  const parts = await invoiceQueryParts();
  const where = buildInvoiceWhere(query, parts);
  const order = buildInvoiceOrder(query);
  const page = positiveInt(query.page, 1, 100000);
  const limit = positiveInt(query.limit || query.pageSize, 25, 500);
  const offset = (page - 1) * limit;
  const e = parts.expressions;

  const [[countRow]] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM ${sqlId(INVOICE_TABLE)} i
    ${parts.joins}
    ${where.sql}
    `,
    where.params
  );

  const [[summary]] = await pool.query(
    `
    SELECT
      COUNT(*) AS total_invoices,
      COALESCE(SUM(${e.amount}), 0) AS total_amount,
      COALESCE(SUM(${e.paidAmount}), 0) AS paid_amount,
      COALESCE(SUM(${e.balanceDue}), 0) AS balance_due,
      COALESCE(SUM(CASE WHEN LOWER(${e.status}) = 'paid' THEN 1 ELSE 0 END), 0) AS paid_count,
      COALESCE(SUM(CASE WHEN LOWER(${e.status}) IN ('open', 'pending', 'partial', 'overdue', 'draft') THEN 1 ELSE 0 END), 0) AS open_count,
      COALESCE(SUM(CASE WHEN LOWER(${e.status}) = 'overdue' OR (${e.dueDate} IS NOT NULL AND DATE(${e.dueDate}) < CURDATE() AND LOWER(${e.status}) NOT IN ('paid', 'cancelled', 'void', 'refunded')) THEN 1 ELSE 0 END), 0) AS overdue_count,
      COALESCE(SUM(CASE WHEN LOWER(${e.emailStatus}) IN ('sent', 'delivered') THEN 1 ELSE 0 END), 0) AS email_sent_count,
      COALESCE(SUM(CASE WHEN LOWER(${e.emailStatus}) IN ('failed', 'bounced') THEN 1 ELSE 0 END), 0) AS email_failed_count
    FROM ${sqlId(INVOICE_TABLE)} i
    ${parts.joins}
    ${where.sql}
    `,
    where.params
  );

  const [rows] = await pool.query(
    `
    SELECT
      i.*,
      ${e.invoiceNumber} AS invoice_number,
      ${e.paymentNumber} AS payment_number,
      ${e.receiptNumber} AS receipt_number,
      ${e.receiptCount} AS receipt_count,
      ${e.memberName} AS member_name,
      ${e.memberName} AS full_name_snapshot,
      ${e.memberNo} AS member_no,
      ${e.phone} AS phone,
      ${e.email} AS email,
      ${e.email} AS email_snapshot,
      ${e.amount} AS amount,
      ${e.amount} AS total_amount,
      ${e.paidAmount} AS paid_amount,
      ${e.balanceDue} AS balance_due,
      ${e.status} AS invoice_status,
      ${e.status} AS status,
      ${e.emailStatus} AS email_status,
      ${e.category} AS category,
      ${e.method} AS payment_method,
      ${e.referenceNumber} AS reference_number,
      ${e.invoiceDate} AS invoice_date,
      ${e.dueDate} AS due_date,
      ${e.campaignName} AS campaign_name
    FROM ${sqlId(INVOICE_TABLE)} i
    ${parts.joins}
    ${where.sql}
    ${order}
    LIMIT ?
    OFFSET ?
    `,
    [...where.params, limit, offset]
  );

  const total = Number(countRow?.total || 0);

  return {
    rows,
    summary: {
      total_invoices: Number(summary?.total_invoices || 0),
      total_amount: money(summary?.total_amount || 0),
      paid_amount: money(summary?.paid_amount || 0),
      balance_due: money(summary?.balance_due || 0),
      paid_count: Number(summary?.paid_count || 0),
      open_count: Number(summary?.open_count || 0),
      overdue_count: Number(summary?.overdue_count || 0),
      email_sent_count: Number(summary?.email_sent_count || 0),
      email_failed_count: Number(summary?.email_failed_count || 0),
    },
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function getInvoiceByIdInternal(idOrNumber) {
  const id = safeId(idOrNumber);
  const parts = await invoiceQueryParts();
  const e = parts.expressions;

  const whereSql = id
    ? "WHERE i.id = ?"
    : `WHERE ${e.invoiceNumber} = ?`;

  const [rows] = await pool.query(
    `
    SELECT
      i.*,
      ${e.invoiceNumber} AS invoice_number,
      ${e.paymentNumber} AS payment_number,
      ${e.receiptNumber} AS receipt_number,
      ${e.receiptCount} AS receipt_count,
      ${e.memberName} AS member_name,
      ${e.memberName} AS full_name_snapshot,
      ${e.memberNo} AS member_no,
      ${e.phone} AS phone,
      ${e.email} AS email,
      ${e.email} AS email_snapshot,
      ${e.amount} AS amount,
      ${e.amount} AS total_amount,
      ${e.paidAmount} AS paid_amount,
      ${e.balanceDue} AS balance_due,
      ${e.status} AS invoice_status,
      ${e.status} AS status,
      ${e.emailStatus} AS email_status,
      ${e.category} AS category,
      ${e.method} AS payment_method,
      ${e.referenceNumber} AS reference_number,
      ${e.invoiceDate} AS invoice_date,
      ${e.dueDate} AS due_date,
      ${e.campaignName} AS campaign_name
    FROM ${sqlId(INVOICE_TABLE)} i
    ${parts.joins}
    ${whereSql}
    LIMIT 1
    `,
    [id || idOrNumber]
  );

  return rows[0] || null;
}

async function updateInvoiceColumns(invoiceId, valuesByColumn = {}) {
  const columns = await columnsFor(INVOICE_TABLE);
  const sets = [];
  const values = [];

  for (const [column, value] of Object.entries(valuesByColumn)) {
    if (!has(columns, column) || value === undefined) continue;

    if (value === "__NOW__") {
      sets.push(`${sqlId(column)} = NOW()`);
    } else {
      sets.push(`${sqlId(column)} = ?`);
      values.push(value);
    }
  }

  if (has(columns, "updated_at")) {
    sets.push("`updated_at` = NOW()");
  }

  if (!sets.length) return false;

  values.push(invoiceId);

  await pool.query(
    `
    UPDATE ${sqlId(INVOICE_TABLE)}
    SET ${sets.join(", ")}
    WHERE id = ?
    `,
    values
  );

  return true;
}

async function getInvoiceItems(invoiceId) {
  if (!(await tableExists("tbl_finance_invoice_items"))) return [];

  const [rows] = await pool.query(
    `
    SELECT *
    FROM tbl_finance_invoice_items
    WHERE invoice_id = ?
    ORDER BY id ASC
    `,
    [invoiceId]
  );

  return rows;
}

async function getInvoiceReceipts(invoiceId) {
  if (!(await tableExists("tbl_finance_receipts"))) return [];

  const [rows] = await pool.query(
    `
    SELECT *
    FROM tbl_finance_receipts
    WHERE invoice_id = ?
    ORDER BY id DESC
    `,
    [invoiceId]
  );

  return rows;
}

async function createInvoiceInternal(req) {
  if (typeof invoiceGenerationService.generateInvoice === "function") {
    const invoiceId = await invoiceGenerationService.generateInvoice(pool, {
      ...req.body,
      created_by: reqUserId(req),
      source: "finance_invoices_route",
    });

    const invoice = await getInvoiceByIdInternal(invoiceId?.id || invoiceId);

    await writeAudit(req, "created_invoice", invoice?.id || invoiceId, {
      invoice_number: invoice?.invoice_number,
      source: "invoiceGenerationService.generateInvoice",
    });

    return invoice || invoiceId;
  }

  if (typeof invoiceGenerationService.createInvoice === "function") {
    const result = await invoiceGenerationService.createInvoice({
      ...req.body,
      created_by: reqUserId(req),
      source: "finance_invoices_route",
    });

    const invoice = await getInvoiceByIdInternal(result?.id || result?.invoice_id || result);

    await writeAudit(req, "created_invoice", invoice?.id || result?.id, {
      invoice_number: invoice?.invoice_number,
      source: "invoiceGenerationService.createInvoice",
    });

    return invoice || result;
  }

  const total = money(req.body.total_amount || req.body.amount || req.body.invoice_amount);
  const paid = money(req.body.paid_amount || 0);
  const balance = Math.max(total - paid, 0);
  const status = computeStatus(total, paid, req.body.status || "open");

  const id = await insertExistingColumns(pool, INVOICE_TABLE, {
    invoice_number: req.body.invoice_number || code("INV"),

    member_id: req.body.member_id || null,
    member_no: clean(req.body.member_no || "", 80) || null,

    full_name_snapshot:
      clean(
        req.body.full_name_snapshot ||
          req.body.full_name ||
          req.body.payer_name ||
          req.body.guest_name ||
          req.body.donor_name ||
          "",
        255
      ) || null,

    email_snapshot:
      clean(
        req.body.email_snapshot ||
          req.body.email ||
          req.body.payer_email ||
          req.body.guest_email ||
          req.body.donor_email ||
          "",
        255
      ) || null,

    phone_snapshot:
      clean(req.body.phone_snapshot || req.body.phone || "", 80) || null,

    category: clean(req.body.category || req.body.invoice_type || req.body.payment_type || "general", 80),
    invoice_type: clean(req.body.invoice_type || req.body.category || req.body.payment_type || "general", 80),

    campaign_id: req.body.campaign_id || null,
    pledge_id: req.body.pledge_id || null,
    registration_id: req.body.registration_id || null,
    program_id: req.body.program_id || req.body.news_event_id || null,

    amount: total,
    total_amount: total,
    paid_amount: paid,
    balance_due: balance,

    status,
    invoice_status: status,

    invoice_date: req.body.invoice_date || new Date(),
    due_date: req.body.due_date || req.body.invoice_due_date || new Date(),

    payment_method: req.body.payment_method || req.body.method || null,
    reference_no: req.body.reference_no || req.body.reference_number || null,

    description: req.body.description || req.body.notes || null,
    notes: req.body.notes || null,

    participants_json: safeJson(req.body.participants || req.body.participants_json),
    metadata_json: safeJson(req.body.metadata || req.body.meta || req.body.metadata_json),

    created_by: reqUserId(req),
    created_at: new Date(),
    updated_at: new Date(),
  });

  const invoice = await getInvoiceByIdInternal(id);

  await writeAudit(req, "created_invoice", id, {
    invoice_number: invoice?.invoice_number,
    total_amount: total,
    balance_due: balance,
  });

  return invoice;
}

async function updateInvoiceInternal(req, invoiceId) {
  const invoice = await getInvoiceByIdInternal(invoiceId);

  if (!invoice) {
    const error = new Error("Invoice not found.");
    error.status = 404;
    throw error;
  }

  const total =
    req.body.total_amount !== undefined || req.body.amount !== undefined
      ? money(req.body.total_amount ?? req.body.amount)
      : money(invoice.total_amount || invoice.amount);

  const paid =
    req.body.paid_amount !== undefined
      ? money(req.body.paid_amount)
      : money(invoice.paid_amount);

  const balance = Math.max(total - paid, 0);
  const status = computeStatus(total, paid, req.body.status || invoice.status || "open");

  await updateInvoiceColumns(invoice.id, {
    member_id: req.body.member_id,
    member_no: req.body.member_no,

    full_name_snapshot:
      req.body.full_name_snapshot ||
      req.body.full_name ||
      req.body.payer_name ||
      req.body.guest_name,

    email_snapshot:
      req.body.email_snapshot ||
      req.body.email ||
      req.body.payer_email ||
      req.body.guest_email,

    phone_snapshot:
      req.body.phone_snapshot ||
      req.body.phone,

    category: req.body.category,
    invoice_type: req.body.invoice_type,

    campaign_id: req.body.campaign_id,
    pledge_id: req.body.pledge_id,
    registration_id: req.body.registration_id,
    program_id: req.body.program_id || req.body.news_event_id,

    amount: total,
    total_amount: total,
    paid_amount: paid,
    balance_due: balance,

    status,
    invoice_status: status,

    invoice_date: req.body.invoice_date,
    due_date: req.body.due_date || req.body.invoice_due_date,

    payment_method: req.body.payment_method || req.body.method,
    reference_no: req.body.reference_no || req.body.reference_number,

    description: req.body.description,
    notes: req.body.notes,

    metadata_json: safeJson(req.body.metadata || req.body.meta || req.body.metadata_json),
    updated_by: reqUserId(req),
  });

  await writeAudit(req, "updated_invoice", invoice.id, {
    invoice_number: invoice.invoice_number,
  });

  return getInvoiceByIdInternal(invoice.id);
}

async function setInvoiceStatus(req, invoiceId, status) {
  const invoice = await getInvoiceByIdInternal(invoiceId);

  if (!invoice) {
    const error = new Error("Invoice not found.");
    error.status = 404;
    throw error;
  }

  const normalized = allowedInvoiceStatus(status, "open");
  const total = money(invoice.total_amount || invoice.amount);
  const existingPaid = money(invoice.paid_amount);

  const paidAmount =
    normalized === "paid"
      ? total
      : existingPaid;

  const balance =
    normalized === "paid"
      ? 0
      : Math.max(total - paidAmount, 0);

  await updateInvoiceColumns(invoice.id, {
    status: normalized,
    invoice_status: normalized,
    paid_amount: paidAmount,
    balance_due: balance,

    paid_at: normalized === "paid" ? "__NOW__" : undefined,
    voided_at: normalized === "void" ? "__NOW__" : undefined,
    cancelled_at: normalized === "cancelled" ? "__NOW__" : undefined,

    void_reason:
      normalized === "void"
        ? clean(req.body?.reason || req.body?.note || "", 1000)
        : undefined,

    cancelled_reason:
      normalized === "cancelled"
        ? clean(req.body?.reason || req.body?.note || "", 1000)
        : undefined,

    updated_by: reqUserId(req),
  });

  await writeAudit(req, `marked_invoice_${normalized}`, invoice.id, {
    invoice_number: invoice.invoice_number,
    reason: req.body?.reason || req.body?.note || null,
  });

  return getInvoiceByIdInternal(invoice.id);
}

async function markInvoiceEmailStatus(req, invoice, status, email = null, errorMessage = null) {
  const normalized = clean(status || "sent", 40).toLowerCase();

  await updateInvoiceColumns(invoice.id, {
    email_status: normalized,
    invoice_email_status: normalized,
    delivery_status: normalized,

    emailed_to: email || invoice.email || invoice.email_snapshot || null,
    last_emailed_to: email || invoice.email || invoice.email_snapshot || null,

    emailed_at: normalized === "sent" ? "__NOW__" : undefined,
    sent_at: normalized === "sent" ? "__NOW__" : undefined,
    last_emailed_at: normalized === "sent" ? "__NOW__" : undefined,

    email_error: normalized === "failed" ? errorMessage || "Email failed." : null,
    last_email_error: normalized === "failed" ? errorMessage || "Email failed." : null,
    updated_by: reqUserId(req),
  });

  return getInvoiceByIdInternal(invoice.id);
}

async function sendInvoiceEmailAction(req, invoice, options = {}) {
  const email = clean(options.email || invoice.email || invoice.email_snapshot || "", 190);

  if (!email) {
    const error = new Error("Invoice email address is required.");
    error.status = 400;
    throw error;
  }

  if (typeof invoiceEmailService.sendInvoiceEmail !== "function") {
    await markInvoiceEmailStatus(req, invoice, "queued", email);

    return {
      queued: true,
      success: true,
      email,
      message: "Invoice email queued. Configure invoiceEmailService to send immediately.",
    };
  }

  const result = await invoiceEmailService.sendInvoiceEmail(invoice.id, {
    email,
    to: email,
    subject: options.subject || undefined,
    attachPdf: options.attachPdf !== false,
    requested_by: reqUserId(req),
    source: options.source || "finance_invoices_route",
  });

  if (result?.success) {
    await markInvoiceEmailStatus(req, invoice, "sent", email);
  } else {
    await markInvoiceEmailStatus(req, invoice, "failed", email, result?.error || "Email failed.");
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* PDF / Public Links                                                         */
/* -------------------------------------------------------------------------- */

async function pdfPayload(invoice) {
  const items = await getInvoiceItems(invoice.id);

  return {
    ...invoice,
    items,
  };
}

async function buildInvoicePdfBuffer(invoice) {
  const payload = await pdfPayload(invoice);

  if (typeof invoicePdfService.generateInvoicePdfBuffer === "function") {
    return invoicePdfService.generateInvoicePdfBuffer(payload);
  }

  if (typeof invoicePdfService.generateInvoicePdf === "function") {
    const result = await invoicePdfService.generateInvoicePdf(payload);

    if (Buffer.isBuffer(result)) return result;
    if (result?.buffer && Buffer.isBuffer(result.buffer)) return result.buffer;
    if (result?.pdfBuffer && Buffer.isBuffer(result.pdfBuffer)) return result.pdfBuffer;
    if (result?.data && Buffer.isBuffer(result.data)) return result.data;

    const filePath = result?.file_path || result?.path;
    if (filePath) return fsp.readFile(filePath);
  }

  const error = new Error("Invoice PDF service is not configured.");
  error.status = 500;
  throw error;
}

async function generateInvoicePdfMeta(req, invoice) {
  if (typeof invoicePdfService.generateInvoicePdf !== "function") {
    const error = new Error("Invoice PDF service is not configured.");
    error.status = 500;
    throw error;
  }

  const result = await invoicePdfService.generateInvoicePdf(await pdfPayload(invoice), {
    requested_by: reqUserId(req),
    user_id: reqUserId(req),
    source: "finance_invoices_route",
  });

  if (result?.pdf_url || result?.file_url) {
    await updateInvoiceColumns(invoice.id, {
      pdf_url: result.pdf_url || result.file_url,
      invoice_pdf_url: result.pdf_url || result.file_url,
    }).catch(() => {});
  }

  await writeAudit(req, "generated_invoice_pdf", invoice.id, {
    invoice_number: invoice.invoice_number,
    pdf_url: result?.pdf_url || result?.file_url || null,
  });

  return result;
}

async function sendPdfResponse(req, res, invoice, download = false) {
  const buffer = await buildInvoicePdfBuffer(invoice);
  const fileName = safePdfFileName(invoice.invoice_number || `invoice-${invoice.id}`);

  await writeAudit(req, download ? "downloaded_invoice_pdf" : "viewed_invoice_pdf", invoice.id, {
    invoice_number: invoice.invoice_number,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${download ? "attachment" : "inline"}; filename="${fileName}"`
  );
  res.setHeader("Cache-Control", "private, no-store");

  return res.send(buffer);
}

function buildPublicLinks(invoice, options = {}) {
  if (typeof publicAccess.buildInvoicePublicLinks !== "function") {
    return null;
  }

  return publicAccess.buildInvoicePublicLinks(invoice, {
    ttl_days: options.ttl_days || options.ttlDays || 30,
    scope: options.scope || ["view", "pdf", "download", "pay", "email"],
  });
}

/* -------------------------------------------------------------------------- */
/* Paths                                                                      */
/* -------------------------------------------------------------------------- */

const collectionPaths = ["/invoices", "/"];
const statsPaths = ["/invoices/stats", "/stats"];
const exportPaths = ["/invoices/export", "/export"];
const csvPaths = ["/invoices/export/csv", "/export/csv"];

const itemPaths = ["/invoices/:id", "/:id"];
const numberPaths = ["/invoices/number/:invoiceNumber", "/number/:invoiceNumber"];
const itemsPaths = ["/invoices/:id/items", "/:id/items"];
const receiptsPaths = ["/invoices/:id/receipts", "/:id/receipts"];
const linksPaths = ["/invoices/:id/public-links", "/:id/public-links"];
const emailPaths = ["/invoices/:id/email", "/:id/email"];
const resendPaths = ["/invoices/:id/resend", "/:id/resend"];
const pdfPostPaths = ["/invoices/:id/pdf", "/:id/pdf"];
const pdfGetPaths = ["/invoices/:id/pdf", "/:id/pdf"];
const downloadPaths = ["/invoices/:id/download", "/:id/download"];
const printPaths = ["/invoices/:id/print", "/:id/print"];
const statusPaths = ["/invoices/:id/status", "/:id/status"];
const markPaidPaths = ["/invoices/:id/mark-paid", "/:id/mark-paid"];
const markSentPaths = ["/invoices/:id/mark-sent", "/:id/mark-sent"];
const voidPaths = ["/invoices/:id/void", "/:id/void"];
const cancelPaths = ["/invoices/:id/cancel", "/:id/cancel"];
const openPaths = ["/invoices/:id/mark-open", "/:id/mark-open"];

/* -------------------------------------------------------------------------- */
/* Routes: List / Stats / Export                                              */
/* -------------------------------------------------------------------------- */

router.get(statsPaths, async (req, res) => {
  try {
    const result = await listInvoicesInternal({
      ...req.query,
      page: 1,
      limit: 1,
    });

    return res.json({
      ok: true,
      stats: result.summary,
      summary: result.summary,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load invoice stats.");
  }
});

router.get(exportPaths, async (req, res) => {
  try {
    const format = clean(req.query.format || "xlsx", 20).toLowerCase();

    const result = await listInvoicesInternal({
      ...req.query,
      page: 1,
      limit: req.query.limit || 5000,
    });

    let exportResult;

    if (format === "csv") {
      exportResult = await exportService.exportCsv({
        rows: result.rows,
        fileName: "finance-invoices",
      });
    } else if (format === "json") {
      exportResult = await exportService.exportJson({
        rows: result.rows,
        fileName: "finance-invoices",
        summary: result.summary,
      });
    } else {
      exportResult = await exportService.exportExcel({
        rows: result.rows,
        fileName: "finance-invoices",
        sheetName: "Invoices",
        summary: result.summary,
      });
    }

    return res.json({
      ok: true,
      export: exportResult,
    });
  } catch (err) {
    return routeError(res, err, "Failed to export invoices.");
  }
});

router.get(csvPaths, async (req, res) => {
  try {
    const result = await listInvoicesInternal({
      ...req.query,
      page: 1,
      limit: 5000,
    });

    const headers = [
      "Invoice #",
      "Payment #",
      "Receipt #",
      "Member",
      "Member #",
      "Email",
      "Amount",
      "Paid",
      "Balance",
      "Date",
      "Due Date",
      "Category",
      "Method",
      "Status",
      "Email Status",
      "Reference #",
    ];

    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

    const lines = [
      headers.join(","),
      ...result.rows.map((row) =>
        [
          row.invoice_number,
          row.payment_number,
          row.receipt_number,
          row.member_name || row.full_name_snapshot,
          row.member_no,
          row.email,
          row.total_amount || row.amount,
          row.paid_amount,
          row.balance_due,
          row.invoice_date,
          row.due_date,
          row.category,
          row.payment_method,
          row.invoice_status || row.status,
          row.email_status,
          row.reference_number,
        ].map(escape).join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="finance-invoices.csv"');

    return res.send(`\uFEFF${lines.join("\n")}`);
  } catch (err) {
    return routeError(res, err, "Failed to export invoice CSV.");
  }
});

router.get(collectionPaths, async (req, res) => {
  try {
    const result = await listInvoicesInternal(req.query);

    return res.json({
      ok: true,
      rows: result.rows,
      invoices: result.rows,
      pagination: result.pagination,
      summary: result.summary,
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit,
      totalPages: result.pagination.pages,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load invoices.");
  }
});

router.post(collectionPaths, async (req, res) => {
  try {
    const invoice = await createInvoiceInternal(req);

    return res.status(201).json({
      ok: true,
      invoice,
      invoice_id: invoice?.id,
      invoice_number: invoice?.invoice_number,
    });
  } catch (err) {
    return routeError(res, err, "Failed to create invoice.", err.status || 500);
  }
});

/* -------------------------------------------------------------------------- */
/* Routes: Specific Lookups                                                   */
/* -------------------------------------------------------------------------- */

router.get(numberPaths, async (req, res) => {
  try {
    const invoice = await getInvoiceByIdInternal(req.params.invoiceNumber);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found.",
      });
    }

    const [items, receipts] = await Promise.all([
      getInvoiceItems(invoice.id),
      getInvoiceReceipts(invoice.id),
    ]);

    return res.json({
      ok: true,
      invoice,
      items,
      receipts,
      public_links: buildPublicLinks(invoice),
      payable: isInvoicePayable(invoice),
      balance_due: invoiceAmountDue(invoice),
    });
  } catch (err) {
    return routeError(res, err, "Failed to load invoice.");
  }
});

router.get(itemsPaths, async (req, res) => {
  try {
    const invoice = await getInvoiceByIdInternal(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found.",
      });
    }

    return res.json({
      ok: true,
      rows: await getInvoiceItems(invoice.id),
    });
  } catch (err) {
    return routeError(res, err, "Failed to load invoice items.");
  }
});

router.get(receiptsPaths, async (req, res) => {
  try {
    const invoice = await getInvoiceByIdInternal(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found.",
      });
    }

    return res.json({
      ok: true,
      rows: await getInvoiceReceipts(invoice.id),
    });
  } catch (err) {
    return routeError(res, err, "Failed to load invoice receipts.");
  }
});

/* -------------------------------------------------------------------------- */
/* Routes: Public Links                                                       */
/* -------------------------------------------------------------------------- */

router.get(linksPaths, async (req, res) => {
  try {
    const invoice = await getInvoiceByIdInternal(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found.",
      });
    }

    return res.json({
      ok: true,
      links: buildPublicLinks(invoice, req.query),
    });
  } catch (err) {
    return routeError(res, err, "Failed to build invoice links.");
  }
});

router.post(linksPaths, async (req, res) => {
  try {
    const invoice = await getInvoiceByIdInternal(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found.",
      });
    }

    const links = buildPublicLinks(invoice, req.body || {});

    await writeAudit(req, "generated_invoice_public_links", invoice.id, {
      invoice_number: invoice.invoice_number,
      links,
    });

    return res.json({
      ok: true,
      links,
    });
  } catch (err) {
    return routeError(res, err, "Failed to build invoice links.");
  }
});

/* -------------------------------------------------------------------------- */
/* Routes: PDF                                                                */
/* -------------------------------------------------------------------------- */

router.post(pdfPostPaths, async (req, res) => {
  try {
    const invoice = await getInvoiceByIdInternal(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found.",
      });
    }

    const pdf = await generateInvoicePdfMeta(req, invoice);

    return res.json({
      ok: true,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      pdf,
      pdf_url: pdf?.pdf_url || pdf?.url || pdf?.file_url || null,
      file_path: pdf?.file_path || pdf?.path || null,
      generated: true,
    });
  } catch (err) {
    return routeError(res, err, "Failed to generate invoice PDF.");
  }
});

router.get(pdfGetPaths, async (req, res) => {
  try {
    const invoice = await getInvoiceByIdInternal(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found.",
      });
    }

    return sendPdfResponse(
      req,
      res,
      invoice,
      String(req.query.download || "") === "1"
    );
  } catch (err) {
    return routeError(res, err, "Failed to open invoice PDF.");
  }
});

router.get(downloadPaths, async (req, res) => {
  try {
    const invoice = await getInvoiceByIdInternal(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found.",
      });
    }

    return sendPdfResponse(req, res, invoice, true);
  } catch (err) {
    return routeError(res, err, "Failed to download invoice PDF.");
  }
});

/* -------------------------------------------------------------------------- */
/* Routes: Email                                                              */
/* -------------------------------------------------------------------------- */

router.post(emailPaths, async (req, res) => {
  try {
    const invoice = await getInvoiceByIdInternal(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found.",
      });
    }

    const result = await sendInvoiceEmailAction(req, invoice, {
      email: req.body?.email || req.body?.to || null,
      subject: req.body?.subject || null,
      attachPdf: req.body?.attach_pdf !== false,
      source: "finance_invoice_email",
    });

    await writeAudit(req, "sent_invoice_email", invoice.id, {
      email: req.body?.email || invoice.email || null,
      result,
    });

    return res.json({
      ok: Boolean(result?.success || result?.queued),
      result,
      invoice: await getInvoiceByIdInternal(invoice.id),
    });
  } catch (err) {
    const invoice = await getInvoiceByIdInternal(req.params.id).catch(() => null);

    if (invoice) {
      await markInvoiceEmailStatus(
        req,
        invoice,
        "failed",
        req.body?.email || invoice.email || null,
        err.message
      ).catch(() => {});
    }

    return routeError(res, err, "Failed to send invoice email.", 400);
  }
});

router.post(resendPaths, async (req, res) => {
  try {
    const invoice = await getInvoiceByIdInternal(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found.",
      });
    }

    const result = await sendInvoiceEmailAction(req, invoice, {
      email: req.body?.email || req.body?.to || null,
      subject: req.body?.subject || null,
      attachPdf: req.body?.attach_pdf !== false,
      source: "finance_invoice_resend",
    });

    await writeAudit(req, "resent_invoice_email", invoice.id, {
      email: req.body?.email || invoice.email || null,
      result,
    });

    return res.json({
      ok: Boolean(result?.success || result?.queued),
      result,
      invoice: await getInvoiceByIdInternal(invoice.id),
    });
  } catch (err) {
    return routeError(res, err, "Failed to resend invoice email.", 400);
  }
});

router.post(markSentPaths, async (req, res) => {
  try {
    const invoice = await getInvoiceByIdInternal(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found.",
      });
    }

    await markInvoiceEmailStatus(
      req,
      invoice,
      "sent",
      req.body?.email || invoice.email || null
    );

    await writeAudit(req, "marked_invoice_email_sent", invoice.id, {
      email: req.body?.email || invoice.email || null,
    });

    return res.json({
      ok: true,
      invoice: await getInvoiceByIdInternal(invoice.id),
    });
  } catch (err) {
    return routeError(res, err, "Failed to mark invoice sent.");
  }
});

/* -------------------------------------------------------------------------- */
/* Routes: Status                                                             */
/* -------------------------------------------------------------------------- */

router.patch(statusPaths, async (req, res) => {
  try {
    const status = allowedInvoiceStatus(req.body?.status);
    const invoice = await setInvoiceStatus(req, req.params.id, status);

    return res.json({
      ok: true,
      invoice,
    });
  } catch (err) {
    return routeError(res, err, "Failed to update invoice status.");
  }
});

async function statusRoute(req, res, status, actionLabel) {
  try {
    const invoice = await setInvoiceStatus(req, req.params.id, status);

    return res.json({
      ok: true,
      invoice,
    });
  } catch (err) {
    return routeError(res, err, `Failed to ${actionLabel} invoice.`);
  }
}

router.post(markPaidPaths, (req, res) => statusRoute(req, res, "paid", "mark paid"));
router.patch(markPaidPaths, (req, res) => statusRoute(req, res, "paid", "mark paid"));

router.post(voidPaths, (req, res) => statusRoute(req, res, "void", "void"));
router.patch(voidPaths, (req, res) => statusRoute(req, res, "void", "void"));

router.post(cancelPaths, (req, res) => statusRoute(req, res, "cancelled", "cancel"));
router.patch(cancelPaths, (req, res) => statusRoute(req, res, "cancelled", "cancel"));

router.post(openPaths, (req, res) => statusRoute(req, res, "open", "mark open"));
router.patch(openPaths, (req, res) => statusRoute(req, res, "open", "mark open"));

router.post(printPaths, async (req, res) => {
  try {
    const invoice = await getInvoiceByIdInternal(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found.",
      });
    }

    await updateInvoiceColumns(invoice.id, {
      printed_at: "__NOW__",
      printed_by: reqUserId(req),
    });

    await writeAudit(req, "printed_invoice", invoice.id, {
      invoice_number: invoice.invoice_number,
    });

    return res.json({
      ok: true,
      invoice: await getInvoiceByIdInternal(invoice.id),
    });
  } catch (err) {
    return routeError(res, err, "Failed to mark invoice printed.");
  }
});

/* -------------------------------------------------------------------------- */
/* Routes: Item CRUD                                                          */
/* -------------------------------------------------------------------------- */

router.get(itemPaths, async (req, res) => {
  try {
    const invoice = await getInvoiceByIdInternal(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found.",
      });
    }

    const [items, receipts] = await Promise.all([
      getInvoiceItems(invoice.id),
      getInvoiceReceipts(invoice.id),
    ]);

    return res.json({
      ok: true,
      invoice,
      items,
      receipts,
      public_links: buildPublicLinks(invoice),
      payable: isInvoicePayable(invoice),
      balance_due: invoiceAmountDue(invoice),
    });
  } catch (err) {
    return routeError(res, err, "Failed to load invoice.");
  }
});

router.put(itemPaths, async (req, res) => {
  try {
    const invoice = await updateInvoiceInternal(req, req.params.id);
    return res.json({ ok: true, invoice });
  } catch (err) {
    return routeError(res, err, "Failed to update invoice.");
  }
});

router.patch(itemPaths, async (req, res) => {
  try {
    const invoice = await updateInvoiceInternal(req, req.params.id);
    return res.json({ ok: true, invoice });
  } catch (err) {
    return routeError(res, err, "Failed to update invoice.");
  }
});

module.exports = router;