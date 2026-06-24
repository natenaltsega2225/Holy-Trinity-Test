// backend/routes/financePayments.js
"use strict";

const express = require("express");
const pool = require("../db");

const paymentService = require("../services/paymentService");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

let receiptEmailService = {};
let invoiceEmailService = {};

try {
  receiptEmailService = require("../services/domains/receipts/receiptEmailService");
} catch {
  receiptEmailService = {};
}

try {
  invoiceEmailService = require("../services/domains/invoices/invoiceEmailService");
} catch {
  invoiceEmailService = {};
}

const router = express.Router();

const PAYMENT_METHODS = new Set([
  "cash",
  "check",
  "zelle",
  "bank_transfer",
  "manual",
  "card",
  "ach",
]);

const ONLINE_METHODS = new Set([
  "card",
  "ach",
]);

const MANUAL_METHODS = new Set([
  "cash",
  "check",
  "zelle",
  "bank_transfer",
  "manual",
]);

const PAYMENT_CATEGORIES = new Set([
  "membership",
  "donation",
  "school",
  "trip",
  "pledge",
  "manual",
  "other",
]);

const TABLES = {
  payments: "tbl_finance_payments",
  receipts: "tbl_finance_receipts",
  invoices: "tbl_finance_invoices",
  coverage: "tbl_member_membership_coverage",
};

const schemaCache = new Map();

/* -------------------------------------------------------------------------- */
/* Basic Helpers                                                              */
/* -------------------------------------------------------------------------- */

function clean(value, max = 500) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function toInt(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function toMoney(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function boolFlag(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["true", "1", "yes", "y", "on"].includes(
    String(value).trim().toLowerCase()
  );
}

function actorId(req) {
  return (
    Number(req.user?.id || 0) ||
    Number(req.user?.user_id || 0) ||
    Number(req.userId || 0) ||
    null
  );
}

function actorName(req) {
  return clean(
    req.user?.full_name ||
      req.user?.name ||
      req.user?.username ||
      req.user?.email ||
      "Finance User",
    190
  );
}

function qn(name) {
  return `\`${String(name).replace(/`/g, "``")}\``;
}

function qc(alias, column) {
  return `${alias}.${qn(column)}`;
}

function normalizeCategory(value) {
  const raw = clean(value || "donation", 60)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  if (["dues", "membership_dues", "registration_fee"].includes(raw)) {
    return "membership";
  }

  if (["giving", "tithe", "offering"].includes(raw)) {
    return "donation";
  }

  if (["kids", "kids_school", "school_program"].includes(raw)) {
    return "school";
  }

  if (raw === "travel") return "trip";
  if (raw === "pledge_payment") return "pledge";

  return PAYMENT_CATEGORIES.has(raw) ? raw : "donation";
}

function normalizeMethod(value) {
  const raw = clean(value || "manual", 60)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  if (["stripe", "stripe_card", "credit_card", "debit_card"].includes(raw)) {
    return "card";
  }

  if (["us_bank_account", "bank", "stripe_ach"].includes(raw)) {
    return "ach";
  }

  if (["wire", "bank_deposit"].includes(raw)) {
    return "bank_transfer";
  }

  if (raw === "cheque") return "check";

  return PAYMENT_METHODS.has(raw) ? raw : "manual";
}

function normalizeProvider(method, value) {
  const raw = clean(value || "", 60).toLowerCase();

  if (raw) return raw;
  if (ONLINE_METHODS.has(method)) return "stripe";
  if (method === "zelle") return "zelle";
  if (method === "check") return "check";
  if (method === "cash") return "cash";
  if (method === "bank_transfer") return "bank_transfer";

  return method || "manual";
}

function normalizeStatus(value, method) {
  const raw = clean(value || "paid", 60).toLowerCase();

  if (["paid", "completed", "posted", "approved", "succeeded"].includes(raw)) {
    return "paid";
  }

  if (["pending", "processing", "unverified"].includes(raw)) {
    return "pending";
  }

  if (["failed", "declined"].includes(raw)) {
    return "failed";
  }

  if (["void", "cancelled", "canceled"].includes(raw)) {
    return "cancelled";
  }

  if (MANUAL_METHODS.has(method)) return "paid";

  return "paid";
}

function referenceFromBody(body = {}, method) {
  const reference = clean(
    body.reference_no ||
      body.reference_number ||
      body.transaction_reference ||
      body.confirmation_number ||
      body.zelle_reference ||
      body.check_number ||
      body.check_no ||
      body.bank_reference ||
      body.stripe_payment_intent_id ||
      body.stripe_charge_id ||
      body.external_transaction_id ||
      body.external_reference ||
      "",
    255
  );

  if (reference) return reference;
  if (method === "cash") return `CASH-${Date.now()}`;

  return "";
}

function hasStripeIdentity(body = {}) {
  return Boolean(
    body.stripe_payment_intent_id ||
      body.stripe_checkout_session_id ||
      body.stripe_charge_id ||
      body.stripe_invoice_id
  );
}

function shouldUseStripeCheckout(method, provider, body = {}) {
  if (!ONLINE_METHODS.has(method)) return false;
  if (provider !== "stripe") return false;
  if (hasStripeIdentity(body)) return false;

  return !boolFlag(body.record_confirmed_external_payment, false);
}

/* -------------------------------------------------------------------------- */
/* Schema Helpers                                                             */
/* -------------------------------------------------------------------------- */

async function tableColumns(table) {
  if (schemaCache.has(table)) {
    return schemaCache.get(table);
  }

  const [rows] = await pool.query(
    `SHOW COLUMNS FROM ${qn(table)}`
  );

  const cols = new Set(
    rows.map((row) => row.Field)
  );

  schemaCache.set(table, cols);

  return cols;
}

function hasColumn(cols, column) {
  return cols instanceof Set && cols.has(column);
}

function columnExpr(alias, cols, candidates, fallback = "NULL") {
  const found = candidates.find((column) => hasColumn(cols, column));
  return found ? qc(alias, found) : fallback;
}

function coalesceExpr(alias, cols, candidates, fallback = "NULL") {
  const parts = candidates
    .filter((column) => hasColumn(cols, column))
    .map((column) => qc(alias, column));

  if (!parts.length) return fallback;

  return `COALESCE(${parts.join(", ")}, ${fallback})`;
}

async function queryContext() {
  const [paymentCols, receiptCols, invoiceCols] = await Promise.all([
    tableColumns(TABLES.payments),
    tableColumns(TABLES.receipts),
    tableColumns(TABLES.invoices),
  ]);

  return {
    paymentCols,
    receiptCols,
    invoiceCols,

    amountExpr: coalesceExpr(
      "p",
      paymentCols,
      ["amount", "paid_amount", "total_amount", "payment_amount"],
      "0"
    ),

    categoryExpr: coalesceExpr(
      "p",
      paymentCols,
      ["category", "payment_type", "finance_category"],
      "''"
    ),

    methodExpr: coalesceExpr(
      "p",
      paymentCols,
      ["method", "payment_method"],
      "''"
    ),

    providerExpr: coalesceExpr(
      "p",
      paymentCols,
      ["provider", "payment_provider"],
      "''"
    ),

    statusExpr: coalesceExpr(
      "p",
      paymentCols,
      ["status", "payment_status"],
      "''"
    ),

    paymentDateExpr: coalesceExpr(
      "p",
      paymentCols,
      ["paid_at", "payment_date", "created_at"],
      "NOW()"
    ),

    paymentNumberExpr: columnExpr(
      "p",
      paymentCols,
      ["payment_number", "payment_no"],
      "NULL"
    ),

    referenceExpr: coalesceExpr(
      "p",
      paymentCols,
      [
        "reference_no",
        "reference_number",
        "transaction_reference",
        "stripe_payment_intent_id",
        "stripe_charge_id",
      ],
      "''"
    ),
  };
}

function baseJoinSql(ctx) {
  const receiptJoin = hasColumn(ctx.receiptCols, "payment_id")
    ? `
      LEFT JOIN (
        SELECT
          payment_id,
          MAX(id) AS receipt_id
        FROM tbl_finance_receipts
        WHERE payment_id IS NOT NULL
        GROUP BY payment_id
      ) latest_r
        ON latest_r.payment_id = p.id

      LEFT JOIN tbl_finance_receipts r
        ON r.id = ${
          hasColumn(ctx.paymentCols, "receipt_id")
            ? "COALESCE(p.receipt_id, latest_r.receipt_id)"
            : "latest_r.receipt_id"
        }
    `
    : `
      LEFT JOIN tbl_finance_receipts r
        ON 1 = 0
    `;

  const invoiceJoin = hasColumn(ctx.invoiceCols, "payment_id")
    ? `
      LEFT JOIN (
        SELECT
          payment_id,
          MAX(id) AS invoice_id
        FROM tbl_finance_invoices
        WHERE payment_id IS NOT NULL
        GROUP BY payment_id
      ) latest_i
        ON latest_i.payment_id = p.id

      LEFT JOIN tbl_finance_invoices i
        ON i.id = ${
          hasColumn(ctx.paymentCols, "invoice_id")
            ? "COALESCE(p.invoice_id, latest_i.invoice_id)"
            : "latest_i.invoice_id"
        }
    `
    : `
      LEFT JOIN tbl_finance_invoices i
        ON 1 = 0
    `;

  return `
    FROM tbl_finance_payments p
    ${receiptJoin}
    ${invoiceJoin}
  `;
}

function selectSql(ctx) {
  return `
    p.*,

    r.id AS receipt_id,
    ${columnExpr("r", ctx.receiptCols, ["receipt_number", "receipt_no"], "NULL")} AS receipt_number,
    ${columnExpr("r", ctx.receiptCols, ["status"], "NULL")} AS receipt_status,
    ${columnExpr("r", ctx.receiptCols, ["email_status"], "NULL")} AS receipt_email_status,
    ${columnExpr("r", ctx.receiptCols, ["emailed_at", "sent_at"], "NULL")} AS receipt_emailed_at,
    ${columnExpr("r", ctx.receiptCols, ["emailed_to", "recipient_email"], "NULL")} AS receipt_emailed_to,

    i.id AS invoice_id,
    ${columnExpr("i", ctx.invoiceCols, ["invoice_number", "invoice_no"], "NULL")} AS invoice_number,
    ${columnExpr("i", ctx.invoiceCols, ["status"], "NULL")} AS invoice_status,
    ${coalesceExpr("i", ctx.invoiceCols, ["balance_due", "remaining_amount"], "NULL")} AS invoice_balance_due
  `;
}

/* -------------------------------------------------------------------------- */
/* Validation / Payload                                                       */
/* -------------------------------------------------------------------------- */

function validatePaymentInput(body = {}) {
  const category = normalizeCategory(
    body.category ||
      body.payment_type ||
      body.type
  );

  const method = normalizeMethod(
    body.method ||
      body.payment_method
  );

  const provider = normalizeProvider(
    method,
    body.provider ||
      body.payment_provider
  );

  const amount = toMoney(
    body.amount ||
      body.total_amount ||
      body.paid_amount ||
      body.payment_amount
  );

  const status = normalizeStatus(
    body.status ||
      body.payment_status,
    method
  );

  const referenceNo = referenceFromBody(body, method);

  if (amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  if (category === "membership" && !body.member_id && !body.member_no) {
    throw new Error("Membership payment requires a selected member.");
  }

  if (shouldUseStripeCheckout(method, provider, body)) {
    const err = new Error(
      "Card and ACH Stripe payments must use checkout before a finance payment record is created."
    );

    err.statusCode = 409;
    err.requires_checkout = true;
    throw err;
  }

  if (method === "check" && !referenceNo) {
    throw new Error("Check payment requires a check number or reference number.");
  }

  if (method === "zelle" && !referenceNo) {
    throw new Error("Zelle payment requires a confirmation/reference number.");
  }

  if (method === "bank_transfer" && !referenceNo) {
    throw new Error("Bank transfer payment requires a reference number.");
  }

  if (ONLINE_METHODS.has(method) && provider !== "stripe" && !referenceNo) {
    throw new Error("External card/ACH payment requires a transaction reference.");
  }

  return {
    category,
    method,
    provider,
    amount,
    status,
    referenceNo,
  };
}

function buildPaymentPayload(req) {
  const body = req.body || {};
  const normalized = validatePaymentInput(body);
  const userId = actorId(req);

  const payerName = clean(
    body.full_name ||
      body.full_name_snapshot ||
      body.member_name ||
      body.donor_name ||
      body.guest_name ||
      body.payer_name ||
      "",
    255
  );

  const payerEmail = clean(
    body.email ||
      body.email_snapshot ||
      body.member_email ||
      body.donor_email ||
      body.guest_email ||
      body.payer_email ||
      "",
    255
  );

  const payerPhone = clean(
    body.phone ||
      body.phone_snapshot ||
      body.member_phone ||
      body.donor_phone ||
      body.guest_phone ||
      body.payer_phone ||
      "",
    80
  );

  const source =
    body.source ||
    body.created_from ||
    (MANUAL_METHODS.has(normalized.method)
      ? "finance_manual_payment"
      : "finance_external_payment");

  return {
    ...body,

    actor_id: userId,
    created_by: userId,
    recorded_by: userId,
    finance_created_by: userId,
    staff_id: userId,
    staff_name: actorName(req),

    payment_type: normalized.category,
    category: normalized.category,

    method: normalized.method,
    payment_method: normalized.method,

    provider: normalized.provider,
    payment_provider: normalized.provider,

    status: normalized.status,
    payment_status: normalized.status,

    amount: normalized.amount,
    total_amount: normalized.amount,
    paid_amount: normalized.amount,
    payment_amount: normalized.amount,

    reference_no: normalized.referenceNo || null,
    reference_number: normalized.referenceNo || null,
    transaction_reference:
      body.transaction_reference ||
      normalized.referenceNo ||
      null,

    check_number:
      normalized.method === "check"
        ? normalized.referenceNo
        : body.check_number || null,

    zelle_reference:
      normalized.method === "zelle"
        ? normalized.referenceNo
        : body.zelle_reference || null,

    member_id: body.member_id || null,
    member_no: body.member_no || null,

    payer_type:
      body.payer_type ||
      (body.member_id || body.member_no ? "member" : "non_member"),

    full_name: payerName || null,
    email: payerEmail || null,
    phone: payerPhone || null,

    full_name_snapshot: payerName || null,
    email_snapshot: payerEmail || null,
    phone_snapshot: payerPhone || null,

    invoice_id: body.invoice_id || null,
    invoice_number: body.invoice_number || null,

    pledge_id: body.pledge_id || null,
    pledge_number: body.pledge_number || null,
    campaign_id: body.campaign_id || null,
    campaign_name: body.campaign_name || null,

    registration_id: body.registration_id || null,
    news_event_id: body.news_event_id || body.program_id || null,
    program_id: body.program_id || body.news_event_id || null,
    program_name: body.program_name || body.program_title || null,
    program_title: body.program_title || body.program_name || null,

    donation_category:
      body.donation_category ||
      body.sub_category ||
      null,

    sub_category:
      body.sub_category ||
      body.donation_category ||
      body.program_name ||
      body.campaign_name ||
      null,

    coverage_year: body.coverage_year || null,
    coverage_start_month: body.coverage_start_month || null,
    coverage_end_month: body.coverage_end_month || null,
    coverage_label: body.coverage_label || null,
    coverage_months_json:
      body.coverage_months_json ||
      body.coverage_months ||
      null,
    months_paid:
      body.months_paid ||
      body.duration_months ||
      null,

    plan_id:
      body.plan_id ||
      body.dues_plan_id ||
      body.membership_plan_id ||
      null,
    dues_plan_id: body.dues_plan_id || body.plan_id || null,
    membership_plan_id:
      body.membership_plan_id ||
      body.plan_id ||
      null,
    plan_name: body.plan_name || null,

    participants: body.participants || null,
    participants_json: body.participants_json || null,
    pricing_tier_id: body.pricing_tier_id || null,
    pricing_tier_label: body.pricing_tier_label || null,

    create_invoice: boolFlag(body.create_invoice, true),
    create_receipt: boolFlag(body.create_receipt, true),
    create_ledger_entry: boolFlag(body.create_ledger_entry, true),

    send_receipt_email: boolFlag(body.send_receipt_email, true),
    send_invoice_email: boolFlag(body.send_invoice_email, false),
    send_welcome_email: boolFlag(body.send_welcome_email, false),

    source,
    created_from: source,

    notes: body.notes || body.note || null,
    description:
      body.description ||
      body.notes ||
      body.note ||
      null,

    metadata: {
      ...(body.metadata || {}),
      source,
      finance_route: "financePayments",
      manual_entry: MANUAL_METHODS.has(normalized.method),
      recorded_by: userId,
      staff_name: actorName(req),
      reference_no: normalized.referenceNo || null,
      invoice_id: body.invoice_id || null,
      invoice_number: body.invoice_number || null,
      pledge_id: body.pledge_id || null,
      pledge_number: body.pledge_number || null,
      campaign_id: body.campaign_id || null,
      campaign_name: body.campaign_name || null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Filtering                                                                  */
/* -------------------------------------------------------------------------- */

function addAnyLike(where, params, expressions, value) {
  const usable = expressions.filter(Boolean);

  if (!usable.length || !value) return;

  where.push(
    `(${usable.map((expr) => `${expr} LIKE ?`).join(" OR ")})`
  );

  for (let i = 0; i < usable.length; i += 1) {
    params.push(`%${value}%`);
  }
}

function buildWhere(req, ctx) {
  const q = clean(req.query.q || req.query.search);
  const paymentType = clean(req.query.payment_type || req.query.category || req.query.type);
  const status = clean(req.query.status);
  const method = clean(req.query.method || req.query.payment_method);
  const provider = clean(req.query.provider || req.query.payment_provider);
  const source = clean(req.query.source);
  const donationCategory = clean(req.query.donation_category);
  const coverageYear = clean(req.query.coverage_year);
  const dateFrom = clean(req.query.date_from || req.query.from);
  const dateTo = clean(req.query.date_to || req.query.to);
  const invoiceNumber = clean(req.query.invoice_number);
  const receiptNumber = clean(req.query.receipt_number);
  const paymentNumber = clean(req.query.payment_number);
  const referenceNo = clean(req.query.reference_no || req.query.reference);
  const memberId = clean(req.query.member_id);
  const memberNo = clean(req.query.member_no);
  const campaignId = clean(req.query.campaign_id);
  const pledgeId = clean(req.query.pledge_id);
  const amountFrom = clean(req.query.amount_from || req.query.min_amount);
  const amountTo = clean(req.query.amount_to || req.query.max_amount);

  const where = [];
  const params = [];

  if (q) {
    addAnyLike(
      where,
      params,
      [
        columnExpr("p", ctx.paymentCols, ["payment_number", "payment_no"], null),
        columnExpr("p", ctx.paymentCols, ["full_name_snapshot", "full_name", "payer_name"], null),
        columnExpr("p", ctx.paymentCols, ["email_snapshot", "email", "payer_email"], null),
        columnExpr("p", ctx.paymentCols, ["phone_snapshot", "phone", "payer_phone"], null),
        columnExpr("p", ctx.paymentCols, ["member_no", "member_number"], null),
        ctx.referenceExpr,
        columnExpr("r", ctx.receiptCols, ["receipt_number", "receipt_no"], null),
        columnExpr("i", ctx.invoiceCols, ["invoice_number", "invoice_no"], null),
      ],
      q
    );
  }

  if (memberId && hasColumn(ctx.paymentCols, "member_id")) {
    where.push(`${qc("p", "member_id")} = ?`);
    params.push(memberId);
  }

  if (memberNo) {
    addAnyLike(
      where,
      params,
      [
        columnExpr("p", ctx.paymentCols, ["member_no", "member_number"], null),
      ],
      memberNo
    );
  }

  if (campaignId && hasColumn(ctx.paymentCols, "campaign_id")) {
    where.push(`${qc("p", "campaign_id")} = ?`);
    params.push(campaignId);
  }

  if (pledgeId && hasColumn(ctx.paymentCols, "pledge_id")) {
    where.push(`${qc("p", "pledge_id")} = ?`);
    params.push(pledgeId);
  }

  if (paymentNumber) {
    addAnyLike(
      where,
      params,
      [
        columnExpr("p", ctx.paymentCols, ["payment_number", "payment_no"], null),
      ],
      paymentNumber
    );
  }

  if (paymentType) {
    where.push(`LOWER(${ctx.categoryExpr}) = ?`);
    params.push(normalizeCategory(paymentType));
  }

  if (status) {
    where.push(`LOWER(${ctx.statusExpr}) = ?`);
    params.push(status.toLowerCase());
  }

  if (method) {
    where.push(`LOWER(${ctx.methodExpr}) = ?`);
    params.push(normalizeMethod(method));
  }

  if (provider) {
    where.push(`LOWER(${ctx.providerExpr}) = ?`);
    params.push(provider.toLowerCase());
  }

  if (donationCategory) {
    addAnyLike(
      where,
      params,
      [
        columnExpr("p", ctx.paymentCols, ["donation_category"], null),
        columnExpr("p", ctx.paymentCols, ["sub_category"], null),
      ],
      donationCategory
    );
  }

  if (coverageYear && hasColumn(ctx.paymentCols, "coverage_year")) {
    where.push(`${qc("p", "coverage_year")} = ?`);
    params.push(coverageYear);
  }

  if (referenceNo) {
    addAnyLike(where, params, [ctx.referenceExpr], referenceNo);
  }

  if (invoiceNumber) {
    addAnyLike(
      where,
      params,
      [
        columnExpr("i", ctx.invoiceCols, ["invoice_number", "invoice_no"], null),
        columnExpr("p", ctx.paymentCols, ["invoice_number", "invoice_no"], null),
      ],
      invoiceNumber
    );
  }

  if (receiptNumber) {
    addAnyLike(
      where,
      params,
      [
        columnExpr("r", ctx.receiptCols, ["receipt_number", "receipt_no"], null),
        columnExpr("p", ctx.paymentCols, ["receipt_number", "receipt_no"], null),
      ],
      receiptNumber
    );
  }

  if (source === "online") {
    where.push(`
      (
        LOWER(${ctx.providerExpr}) = 'stripe'
        OR LOWER(${ctx.methodExpr}) IN ('card', 'ach')
      )
    `);
  }

  if (source === "manual" || source === "in_person") {
    where.push(`
      LOWER(${ctx.methodExpr}) IN
      ('cash', 'check', 'zelle', 'manual', 'bank_transfer')
    `);
  }

  if (dateFrom) {
    where.push(`DATE(${ctx.paymentDateExpr}) >= ?`);
    params.push(dateFrom);
  }

  if (dateTo) {
    where.push(`DATE(${ctx.paymentDateExpr}) <= ?`);
    params.push(dateTo);
  }

  if (amountFrom) {
    where.push(`${ctx.amountExpr} >= ?`);
    params.push(Number(amountFrom));
  }

  if (amountTo) {
    where.push(`${ctx.amountExpr} <= ?`);
    params.push(Number(amountTo));
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

/* -------------------------------------------------------------------------- */
/* Duplicate Protection / Lookup                                              */
/* -------------------------------------------------------------------------- */

async function assertReferenceNotDuplicate({
  method,
  provider,
  referenceNo,
  allowDuplicate,
}) {
  if (allowDuplicate || !referenceNo) return;

  if (!["zelle", "check", "bank_transfer", "card", "ach"].includes(method)) {
    return;
  }

  const ctx = await queryContext();

  const referenceColumns = [
    "reference_no",
    "reference_number",
    "transaction_reference",
    "stripe_payment_intent_id",
    "stripe_charge_id",
  ].filter((column) => hasColumn(ctx.paymentCols, column));

  if (!referenceColumns.length) return;

  const methodColumns = [
    "method",
    "payment_method",
    "provider",
    "payment_provider",
  ].filter((column) => hasColumn(ctx.paymentCols, column));

  const refSql = referenceColumns
    .map((column) => `${qc("p", column)} = ?`)
    .join(" OR ");

  const params = referenceColumns.map(() => referenceNo);

  let methodSql = "";

  if (methodColumns.length) {
    methodSql = `
      AND (
        ${methodColumns.map((column) => `${qc("p", column)} = ?`).join(" OR ")}
      )
    `;

    for (let i = 0; i < methodColumns.length; i += 1) {
      params.push(i < 2 ? method : provider);
    }
  }

  const [rows] = await pool.query(
    `
    SELECT
      p.id,
      ${ctx.paymentNumberExpr} AS payment_number,
      ${ctx.amountExpr} AS amount,
      ${ctx.statusExpr} AS status,
      ${columnExpr("p", ctx.paymentCols, ["created_at"], "NULL")} AS created_at
    FROM tbl_finance_payments p
    WHERE (${refSql})
      ${methodSql}
      AND LOWER(${ctx.statusExpr}) NOT IN
        ('cancelled', 'canceled', 'void', 'reversed', 'refunded')
    LIMIT 1
    `,
    params
  );

  if (rows.length) {
    const existing = rows[0];

    const err = new Error(
      `Duplicate payment reference blocked. Existing payment: ${existing.payment_number || existing.id}.`
    );

    err.statusCode = 409;
    err.duplicate_payment = existing;

    throw err;
  }
}

async function loadPaymentById(id) {
  if (typeof paymentService.getPaymentById === "function") {
    const payment = await paymentService.getPaymentById(id);
    if (payment) return payment;
  }

  const ctx = await queryContext();

  const [rows] = await pool.query(
    `
    SELECT
      ${selectSql(ctx)}
    ${baseJoinSql(ctx)}
    WHERE p.id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

async function getReceiptIdForPayment(payment = {}) {
  if (payment.receipt_id) return payment.receipt_id;
  if (payment.resolved_receipt_id) return payment.resolved_receipt_id;

  try {
    const [rows] = await pool.query(
      `
      SELECT id
      FROM tbl_finance_receipts
      WHERE payment_id = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [payment.id]
    );

    return rows[0]?.id || null;
  } catch {
    return null;
  }
}

async function getInvoiceIdForPayment(payment = {}) {
  if (payment.invoice_id) return payment.invoice_id;
  if (payment.resolved_invoice_id) return payment.resolved_invoice_id;

  try {
    const [rows] = await pool.query(
      `
      SELECT id
      FROM tbl_finance_invoices
      WHERE payment_id = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [payment.id]
    );

    return rows[0]?.id || null;
  } catch {
    return null;
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

/* -------------------------------------------------------------------------- */
/* Public Health                                                              */
/* -------------------------------------------------------------------------- */

router.get("/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "financePayments",
    version: "enterprise",
    manual_payments_use_payment_service: true,
    payment_service_create_available:
      typeof paymentService.createPayment === "function",
    supported_manual_methods: Array.from(MANUAL_METHODS),
    supported_online_methods: Array.from(ONLINE_METHODS),
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* Security                                                                   */
/* -------------------------------------------------------------------------- */

router.use(authRequired);

router.use(
  requireRole(
    "finance",
    "admin",
    "super_admin",
    "reconciliation"
  )
);

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

router.get("/methods", (_req, res) => {
  return res.json({
    ok: true,
    methods: [
      {
        value: "cash",
        label: "Cash",
        requires_reference: false,
        creates_invoice: true,
        creates_receipt: true,
        service: "paymentService.createPayment",
      },
      {
        value: "check",
        label: "Check",
        requires_reference: true,
        reference_label: "Check Number",
        creates_invoice: true,
        creates_receipt: true,
        service: "paymentService.createPayment",
      },
      {
        value: "zelle",
        label: "Zelle",
        requires_reference: true,
        reference_label: "Zelle Confirmation Number",
        creates_invoice: true,
        creates_receipt: true,
        service: "paymentService.createPayment",
      },
      {
        value: "bank_transfer",
        label: "Bank Transfer",
        requires_reference: true,
        creates_invoice: true,
        creates_receipt: true,
        service: "paymentService.createPayment",
      },
      {
        value: "manual",
        label: "Manual",
        requires_reference: false,
        creates_invoice: true,
        creates_receipt: true,
        service: "paymentService.createPayment",
      },
      {
        value: "card",
        label: "Card",
        requires_checkout: true,
        provider: "stripe",
        creates_invoice: true,
        creates_receipt: true,
      },
      {
        value: "ach",
        label: "ACH",
        requires_checkout: true,
        provider: "stripe",
        creates_invoice: true,
        creates_receipt: true,
      },
    ],
    categories: Array.from(PAYMENT_CATEGORIES),
  });
});

router.get("/filters", async (_req, res) => {
  try {
    const ctx = await queryContext();

    const [rows] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_records,
        COALESCE(SUM(${ctx.amountExpr}), 0) AS total_amount,

        COALESCE(SUM(CASE WHEN LOWER(${ctx.categoryExpr}) = 'membership' THEN ${ctx.amountExpr} ELSE 0 END), 0) AS membership_amount,
        COALESCE(SUM(CASE WHEN LOWER(${ctx.categoryExpr}) = 'donation' THEN ${ctx.amountExpr} ELSE 0 END), 0) AS donation_amount,
        COALESCE(SUM(CASE WHEN LOWER(${ctx.categoryExpr}) = 'pledge' THEN ${ctx.amountExpr} ELSE 0 END), 0) AS pledge_amount,

        COALESCE(SUM(CASE WHEN LOWER(${ctx.methodExpr}) = 'cash' THEN ${ctx.amountExpr} ELSE 0 END), 0) AS cash_amount,
        COALESCE(SUM(CASE WHEN LOWER(${ctx.methodExpr}) = 'check' THEN ${ctx.amountExpr} ELSE 0 END), 0) AS check_amount,
        COALESCE(SUM(CASE WHEN LOWER(${ctx.methodExpr}) = 'zelle' THEN ${ctx.amountExpr} ELSE 0 END), 0) AS zelle_amount,
        COALESCE(SUM(CASE WHEN LOWER(${ctx.methodExpr}) = 'card' THEN ${ctx.amountExpr} ELSE 0 END), 0) AS card_amount,
        COALESCE(SUM(CASE WHEN LOWER(${ctx.methodExpr}) = 'ach' THEN ${ctx.amountExpr} ELSE 0 END), 0) AS ach_amount
      FROM tbl_finance_payments p
      `
    );

    return res.json({
      ok: true,
      methods: Array.from(PAYMENT_METHODS),
      manual_methods: Array.from(MANUAL_METHODS),
      categories: Array.from(PAYMENT_CATEGORIES),
      summary: rows[0] || {},
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load payment filters.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Stats / List / Export                                                      */
/* -------------------------------------------------------------------------- */

router.get("/stats", async (req, res) => {
  try {
    const ctx = await queryContext();
    const { whereSql, params } = buildWhere(req, ctx);

    const [rows] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_transactions,
        COALESCE(SUM(${ctx.amountExpr}), 0) AS total_amount,

        COALESCE(SUM(CASE WHEN LOWER(${ctx.categoryExpr}) = 'membership' THEN ${ctx.amountExpr} ELSE 0 END), 0) AS membership_amount,
        COALESCE(SUM(CASE WHEN LOWER(${ctx.categoryExpr}) = 'donation' THEN ${ctx.amountExpr} ELSE 0 END), 0) AS donation_amount,
        COALESCE(SUM(CASE WHEN LOWER(${ctx.categoryExpr}) IN ('school', 'trip') THEN ${ctx.amountExpr} ELSE 0 END), 0) AS program_amount,
        COALESCE(SUM(CASE WHEN LOWER(${ctx.categoryExpr}) = 'pledge' THEN ${ctx.amountExpr} ELSE 0 END), 0) AS pledge_amount,

        COALESCE(SUM(CASE WHEN LOWER(${ctx.methodExpr}) = 'cash' THEN ${ctx.amountExpr} ELSE 0 END), 0) AS cash_amount,
        COALESCE(SUM(CASE WHEN LOWER(${ctx.methodExpr}) = 'check' THEN ${ctx.amountExpr} ELSE 0 END), 0) AS check_amount,
        COALESCE(SUM(CASE WHEN LOWER(${ctx.methodExpr}) = 'zelle' THEN ${ctx.amountExpr} ELSE 0 END), 0) AS zelle_amount,
        COALESCE(SUM(CASE WHEN LOWER(${ctx.methodExpr}) = 'bank_transfer' THEN ${ctx.amountExpr} ELSE 0 END), 0) AS bank_transfer_amount,
        COALESCE(SUM(CASE WHEN LOWER(${ctx.methodExpr}) = 'card' THEN ${ctx.amountExpr} ELSE 0 END), 0) AS card_amount,
        COALESCE(SUM(CASE WHEN LOWER(${ctx.methodExpr}) = 'ach' THEN ${ctx.amountExpr} ELSE 0 END), 0) AS ach_amount,

        COALESCE(SUM(CASE WHEN LOWER(${ctx.statusExpr}) = 'paid' THEN 1 ELSE 0 END), 0) AS paid_count,
        COALESCE(SUM(CASE WHEN LOWER(${ctx.statusExpr}) = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count,
        COALESCE(SUM(CASE WHEN LOWER(${ctx.statusExpr}) = 'failed' THEN 1 ELSE 0 END), 0) AS failed_count,

        COALESCE(SUM(CASE WHEN r.email_status = 'sent' THEN 1 ELSE 0 END), 0) AS receipt_emails_sent,
        COALESCE(SUM(CASE WHEN r.email_status = 'failed' THEN 1 ELSE 0 END), 0) AS receipt_emails_failed,
        COALESCE(SUM(CASE WHEN r.email_status IN ('pending', 'queued') THEN 1 ELSE 0 END), 0) AS receipt_emails_queued

      ${baseJoinSql(ctx)}
      ${whereSql}
      `,
      params
    );

    return res.json({
      ok: true,
      summary: rows[0] || {},
    });
  } catch (err) {
    console.error("GET /finance/payments/stats error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load payment stats.",
    });
  }
});

router.get("/campaigns", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_campaigns
      ORDER BY
        CASE WHEN status = 'active' THEN 0 ELSE 1 END,
        created_at DESC,
        id DESC
      `
    );

    return res.json({
      ok: true,
      rows,
    });
  } catch {
    return res.json({
      ok: true,
      rows: [],
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const ctx = await queryContext();

    const page = toInt(req.query.page, 1);
    const limit = Math.min(
      200,
      toInt(req.query.limit || req.query.pageSize, 25)
    );
    const offset = (page - 1) * limit;

    const { whereSql, params } = buildWhere(req, ctx);

    const [countRows] = await pool.query(
      `
      SELECT COUNT(*) AS total
      ${baseJoinSql(ctx)}
      ${whereSql}
      `,
      params
    );

    const [rows] = await pool.query(
      `
      SELECT
        ${selectSql(ctx)}
      ${baseJoinSql(ctx)}
      ${whereSql}
      ORDER BY
        ${ctx.paymentDateExpr} DESC,
        p.id DESC
      LIMIT ?
      OFFSET ?
      `,
      [...params, limit, offset]
    );

    const total = Number(countRows[0]?.total || 0);

    return res.json({
      ok: true,
      rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error("GET /finance/payments error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load payments.",
    });
  }
});

router.get("/export.csv", async (req, res) => {
  try {
    const ctx = await queryContext();
    const { whereSql, params } = buildWhere(req, ctx);

    const [rows] = await pool.query(
      `
      SELECT
        ${selectSql(ctx)}
      ${baseJoinSql(ctx)}
      ${whereSql}
      ORDER BY
        ${ctx.paymentDateExpr} DESC,
        p.id DESC
      LIMIT 5000
      `,
      params
    );

    const headers = [
      "Date",
      "Payment #",
      "Member #",
      "Payer",
      "Email",
      "Category",
      "Method",
      "Amount",
      "Status",
      "Reference",
      "Invoice #",
      "Receipt #",
    ];

    const lines = [
      headers.join(","),
      ...rows.map((row) => [
        row.paid_at || row.payment_date || row.created_at || "",
        row.payment_number || row.payment_no || "",
        row.member_no || "",
        row.full_name_snapshot || row.full_name || row.payer_name || "",
        row.email_snapshot || row.email || row.payer_email || "",
        row.category || row.payment_type || "",
        row.method || row.payment_method || "",
        row.amount || row.paid_amount || row.total_amount || "",
        row.status || row.payment_status || "",
        row.reference_no || row.reference_number || row.transaction_reference || "",
        row.invoice_number || "",
        row.receipt_number || "",
      ].map(csvEscape).join(",")),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="finance-payments-${Date.now()}.csv"`
    );

    return res.send(lines.join("\n"));
  } catch (err) {
    console.error("GET /finance/payments/export.csv error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to export payments.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Create Manual / Confirmed External Payment                                 */
/* -------------------------------------------------------------------------- */

async function createFinancePayment(req, res) {
  try {
    if (typeof paymentService.createPayment !== "function") {
      return res.status(501).json({
        ok: false,
        error: "paymentService.createPayment is not available.",
      });
    }

    const payload = buildPaymentPayload(req);

    await assertReferenceNotDuplicate({
      method: payload.method,
      provider: payload.provider,
      referenceNo: payload.reference_no,
      allowDuplicate: boolFlag(req.body?.allow_duplicate_reference, false),
    });

    const result = await paymentService.createPayment(payload);

    return res.status(201).json({
      ok: true,
      message: "Payment created successfully.",
      service: "paymentService.createPayment",
      payment: result.payment || result,
      payment_id: result.payment_id || result.payment?.id || null,
      invoice: result.invoice || null,
      receipt: result.receipt || null,
      member: result.member || null,
      user: result.user || null,
      receipt_email_sent: Boolean(
        result.receipt_email_sent ||
          result.receiptEmailResult?.success ||
          result.emailResult?.success
      ),
      invoice_email_sent: Boolean(
        result.invoice_email_sent ||
          result.invoiceEmailResult?.success
      ),
    });
  } catch (err) {
    console.error("POST /finance/payments error:", {
      message: err.message,
      code: err.code,
      sqlMessage: err.sqlMessage,
    });

    return res.status(err.statusCode || 400).json({
      ok: false,
      error: err.message || "Failed to create payment.",
      requires_checkout: Boolean(err.requires_checkout),
      duplicate_payment: err.duplicate_payment || null,
      checkout_hint: err.requires_checkout
        ? {
            endpoint: "/api/checkout/create-session",
            methods: ["card", "ach"],
          }
        : null,
    });
  }
}

router.post("/", createFinancePayment);
router.post("/manual", createFinancePayment);
router.post("/record", createFinancePayment);

/* -------------------------------------------------------------------------- */
/* Detail                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/:id", async (req, res) => {
  try {
    const payment = await loadPaymentById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        ok: false,
        error: "Payment not found.",
      });
    }

    let coverage = [];

    try {
      const coverageCols = await tableColumns(TABLES.coverage);

      if (
        hasColumn(coverageCols, "payment_number") ||
        hasColumn(coverageCols, "payment_id")
      ) {
        const where = [];
        const params = [];

        if (hasColumn(coverageCols, "payment_number")) {
          where.push("payment_number = ?");
          params.push(payment.payment_number || payment.payment_no || "");
        }

        if (hasColumn(coverageCols, "payment_id")) {
          where.push("payment_id = ?");
          params.push(payment.id);
        }

        const [coverageRows] = await pool.query(
          `
          SELECT *
          FROM tbl_member_membership_coverage
          WHERE ${where.join(" OR ")}
          ORDER BY
            coverage_year,
            month_number,
            id
          `,
          params
        );

        coverage = coverageRows || [];
      }
    } catch {
      coverage = [];
    }

    return res.json({
      ok: true,
      payment,
      receipt: payment.receipt_number
        ? {
            id: payment.receipt_id || null,
            receipt_number: payment.receipt_number,
          }
        : null,
      invoice: payment.invoice_number
        ? {
            id: payment.invoice_id || null,
            invoice_number: payment.invoice_number,
          }
        : null,
      coverage,
    });
  } catch (err) {
    console.error("GET /finance/payments/:id error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load payment.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Email Actions                                                              */
/* -------------------------------------------------------------------------- */

router.post("/:id/receipt/resend", async (req, res) => {
  try {
    const payment = await loadPaymentById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        ok: false,
        error: "Payment not found.",
      });
    }

    const receiptId = await getReceiptIdForPayment(payment);

    if (!receiptId) {
      return res.status(404).json({
        ok: false,
        error: "Receipt not found for this payment.",
      });
    }

    if (typeof receiptEmailService.sendReceiptEmail !== "function") {
      return res.status(501).json({
        ok: false,
        error: "Receipt email service is not available.",
      });
    }

    const email =
      clean(req.body?.email) ||
      payment.email_snapshot ||
      payment.email ||
      payment.payer_email ||
      null;

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "Receipt email address is required.",
      });
    }

    const result = await receiptEmailService.sendReceiptEmail(receiptId, {
      email,
      to: email,
      resent_by: actorId(req),
      source: "financePayments",
    });

    return res.json({
      ok: true,
      message: "Receipt email sent.",
      result,
    });
  } catch (err) {
    console.error("POST /finance/payments/:id/receipt/resend error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to resend receipt.",
    });
  }
});

router.post("/:id/invoice/resend", async (req, res) => {
  try {
    const payment = await loadPaymentById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        ok: false,
        error: "Payment not found.",
      });
    }

    const invoiceId = await getInvoiceIdForPayment(payment);

    if (!invoiceId) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found for this payment.",
      });
    }

    if (typeof invoiceEmailService.sendInvoiceEmail !== "function") {
      return res.status(501).json({
        ok: false,
        error: "Invoice email service is not available.",
      });
    }

    const email =
      clean(req.body?.email) ||
      payment.email_snapshot ||
      payment.email ||
      payment.payer_email ||
      null;

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "Invoice email address is required.",
      });
    }

    const result = await invoiceEmailService.sendInvoiceEmail(invoiceId, {
      email,
      to: email,
      resent_by: actorId(req),
      source: "financePayments",
    });

    return res.json({
      ok: true,
      message: "Invoice email sent.",
      result,
    });
  } catch (err) {
    console.error("POST /finance/payments/:id/invoice/resend error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to resend invoice.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Accounting Actions                                                         */
/* -------------------------------------------------------------------------- */

router.post("/:id/reconcile", async (req, res) => {
  try {
    if (typeof paymentService.reconcilePayment !== "function") {
      return res.status(501).json({
        ok: false,
        error: "Payment reconciliation service is not available.",
      });
    }

    const payment = await paymentService.reconcilePayment({
      payment_id: req.params.id,
      reconciliation_batch: req.body?.reconciliation_batch || null,
      reconciled_by: actorId(req),
    });

    return res.json({
      ok: true,
      payment,
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: err.message || "Failed to reconcile payment.",
    });
  }
});

router.post("/:id/unreconcile", async (req, res) => {
  try {
    if (typeof paymentService.unreconcilePayment !== "function") {
      return res.status(501).json({
        ok: false,
        error: "Payment unreconciliation service is not available.",
      });
    }

    const payment = await paymentService.unreconcilePayment({
      payment_id: req.params.id,
      unreconciled_by: actorId(req),
    });

    return res.json({
      ok: true,
      payment,
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: err.message || "Failed to unreconcile payment.",
    });
  }
});

router.post("/:id/refund", async (req, res) => {
  try {
    if (typeof paymentService.refundPayment !== "function") {
      return res.status(501).json({
        ok: false,
        error: "Payment refund service is not available.",
      });
    }

    const payment = await paymentService.refundPayment({
      payment_id: req.params.id,
      amount: req.body?.amount || null,
      reason: req.body?.reason || req.body?.notes || null,
      refunded_by: actorId(req),
    });

    return res.json({
      ok: true,
      payment,
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: err.message || "Failed to refund payment.",
    });
  }
});

router.post("/:id/reverse", async (req, res) => {
  try {
    if (typeof paymentService.reversePayment !== "function") {
      return res.status(501).json({
        ok: false,
        error: "Payment reversal service is not available.",
      });
    }

    const payment = await paymentService.reversePayment({
      payment_id: req.params.id,
      reason: req.body?.reason || req.body?.notes || null,
      reversed_by: actorId(req),
    });

    return res.json({
      ok: true,
      payment,
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: err.message || "Failed to reverse payment.",
    });
  }
});

module.exports = router;