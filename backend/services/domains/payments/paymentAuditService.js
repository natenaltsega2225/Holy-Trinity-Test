// backend/services/domains/payments/paymentAuditService.js
"use strict";

const crypto = require("crypto");

const db = require("../../../db");

const {
  insertExistingColumns,
  findOne,
  findMany,
} = require("../../../utils/dbHelpers");

const {
  clean,
  nullable,
  mysqlNow,
} = require("../../../utils/financeHelpers");

/* =========================================================
   CONSTANTS
========================================================= */

const AUDIT_SEVERITY = {
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
};

const AUDIT_TYPES = {
  PAYMENT_CREATED: "payment_created",
  PAYMENT_COMPLETED: "payment_completed",
  PAYMENT_FAILED: "payment_failed",
  PAYMENT_REFUNDED: "payment_refunded",
  PAYMENT_REVERSED: "payment_reversed",

  RECEIPT_GENERATED: "receipt_generated",
  RECEIPT_EMAILED: "receipt_emailed",
  RECEIPT_EMAIL_FAILED: "receipt_email_failed",

  INVOICE_CREATED: "invoice_created",
  INVOICE_EMAILED: "invoice_emailed",

  SUBSCRIPTION_CREATED: "subscription_created",
  SUBSCRIPTION_RENEWED: "subscription_renewed",
  SUBSCRIPTION_CANCELLED: "subscription_cancelled",

  STRIPE_WEBHOOK: "stripe_webhook",
  STRIPE_DISPUTE: "stripe_dispute",

  MANUAL_PAYMENT: "manual_payment",
  MANUAL_ADJUSTMENT: "manual_adjustment",

  RECONCILIATION_MATCH: "reconciliation_match",
  RECONCILIATION_UNMATCH: "reconciliation_unmatch",
};

/* =========================================================
   HELPERS
========================================================= */

function safeJson(value) {
  try {
    if (!value) return null;

    if (typeof value === "string") {
      JSON.parse(value);
      return value;
    }

    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function auditNumber() {
  return `AUD-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

function normalizeSeverity(value) {
  const allowed = Object.values(AUDIT_SEVERITY);

  return allowed.includes(String(value || "").toLowerCase())
    ? String(value).toLowerCase()
    : AUDIT_SEVERITY.INFO;
}

function normalizeAuditType(value) {
  const allowed = Object.values(AUDIT_TYPES);

  return allowed.includes(String(value || "").toLowerCase())
    ? String(value).toLowerCase()
    : "payment_created";
}

/* =========================================================
   CREATE AUDIT LOG
========================================================= */

async function createPaymentAudit(connOrPayload, maybePayload) {
  const hasConn =
    connOrPayload &&
    typeof connOrPayload.query === "function";

  const dbConn = hasConn ? connOrPayload : db;

  const payload = hasConn
    ? maybePayload || {}
    : connOrPayload || {};

  const auditNo =
    payload.audit_number ||
    payload.audit_no ||
    auditNumber();

  const auditId = await insertExistingColumns(
    dbConn,
    "tbl_finance_payment_audit_logs",
    {
      audit_number: auditNo,

      audit_type: normalizeAuditType(
        payload.audit_type
      ),

      severity: normalizeSeverity(
        payload.severity
      ),

      payment_id:
        payload.payment_id || null,

      payment_number:
        payload.payment_number || null,

      receipt_id:
        payload.receipt_id || null,

      receipt_number:
        payload.receipt_number || null,

      invoice_id:
        payload.invoice_id || null,

      invoice_number:
        payload.invoice_number || null,

      ledger_id:
        payload.ledger_id || null,

      member_id:
        payload.member_id || null,

      member_no:
        payload.member_no || null,

      user_id:
        payload.user_id || null,

      actor_user_id:
        payload.actor_user_id ||
        payload.created_by ||
        null,

      actor_role:
        payload.actor_role || null,

      stripe_event_id:
        payload.stripe_event_id || null,

      stripe_payment_intent_id:
        payload.stripe_payment_intent_id || null,

      stripe_charge_id:
        payload.stripe_charge_id || null,

      stripe_invoice_id:
        payload.stripe_invoice_id || null,

      stripe_subscription_id:
        payload.stripe_subscription_id || null,

      title: clean(
        payload.title ||
          payload.audit_type ||
          "Payment Audit"
      ),

      message: nullable(
        payload.message,
        4000
      ),

      old_value_json: safeJson(
        payload.old_value_json ||
          payload.old_values
      ),

      new_value_json: safeJson(
        payload.new_value_json ||
          payload.new_values
      ),

      request_payload_json: safeJson(
        payload.request_payload_json ||
          payload.request_payload
      ),

      response_payload_json: safeJson(
        payload.response_payload_json ||
          payload.response_payload
      ),

      metadata_json: safeJson(
        payload.metadata_json ||
          payload.metadata
      ),

      ip_address:
        payload.ip_address || null,

      user_agent:
        payload.user_agent || null,

      source:
        payload.source ||
        "finance_system",

      source_reference:
        payload.source_reference || null,

      status:
        payload.status ||
        "logged",

      created_at:
        payload.created_at ||
        mysqlNow(),

      updated_at:
        mysqlNow(),
    }
  );

  return getPaymentAuditById(auditId);
}

/* =========================================================
   QUICK HELPERS
========================================================= */

async function logPaymentCreated(conn, payload = {}) {
  return createPaymentAudit(conn, {
    ...payload,

    audit_type:
      AUDIT_TYPES.PAYMENT_CREATED,

    severity:
      AUDIT_SEVERITY.INFO,

    title:
      "Payment Created",

    message:
      payload.message ||
      `Payment ${payload.payment_number || ""} created.`,
  });
}

async function logPaymentCompleted(conn, payload = {}) {
  return createPaymentAudit(conn, {
    ...payload,

    audit_type:
      AUDIT_TYPES.PAYMENT_COMPLETED,

    severity:
      AUDIT_SEVERITY.SUCCESS,

    title:
      "Payment Completed",

    message:
      payload.message ||
      `Payment ${payload.payment_number || ""} completed successfully.`,
  });
}

async function logPaymentFailed(conn, payload = {}) {
  return createPaymentAudit(conn, {
    ...payload,

    audit_type:
      AUDIT_TYPES.PAYMENT_FAILED,

    severity:
      AUDIT_SEVERITY.ERROR,

    title:
      "Payment Failed",

    message:
      payload.message ||
      `Payment ${payload.payment_number || ""} failed.`,
  });
}

async function logReceiptGenerated(conn, payload = {}) {
  return createPaymentAudit(conn, {
    ...payload,

    audit_type:
      AUDIT_TYPES.RECEIPT_GENERATED,

    severity:
      AUDIT_SEVERITY.SUCCESS,

    title:
      "Receipt Generated",

    message:
      payload.message ||
      `Receipt ${payload.receipt_number || ""} generated.`,
  });
}

async function logReceiptEmailed(conn, payload = {}) {
  return createPaymentAudit(conn, {
    ...payload,

    audit_type:
      AUDIT_TYPES.RECEIPT_EMAILED,

    severity:
      AUDIT_SEVERITY.SUCCESS,

    title:
      "Receipt Emailed",

    message:
      payload.message ||
      `Receipt emailed successfully.`,
  });
}

async function logInvoiceCreated(conn, payload = {}) {
  return createPaymentAudit(conn, {
    ...payload,

    audit_type:
      AUDIT_TYPES.INVOICE_CREATED,

    severity:
      AUDIT_SEVERITY.SUCCESS,

    title:
      "Invoice Created",

    message:
      payload.message ||
      `Invoice ${payload.invoice_number || ""} created.`,
  });
}

async function logStripeWebhook(conn, payload = {}) {
  return createPaymentAudit(conn, {
    ...payload,

    audit_type:
      AUDIT_TYPES.STRIPE_WEBHOOK,

    severity:
      AUDIT_SEVERITY.INFO,

    title:
      "Stripe Webhook",

    message:
      payload.message ||
      `Stripe webhook processed.`,
  });
}

/* =========================================================
   GET AUDIT
========================================================= */

async function getPaymentAuditById(id) {
  return findOne(
    db,
    `
    SELECT *
    FROM tbl_finance_payment_audit_logs
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );
}

/* =========================================================
   LIST AUDITS
========================================================= */

async function listPaymentAudits(filters = {}) {
  const where = [];
  const params = [];

  if (filters.payment_id) {
    where.push("payment_id = ?");
    params.push(filters.payment_id);
  }

  if (filters.payment_number) {
    where.push("payment_number = ?");
    params.push(filters.payment_number);
  }

  if (filters.member_id) {
    where.push("member_id = ?");
    params.push(filters.member_id);
  }

  if (filters.audit_type) {
    where.push("audit_type = ?");
    params.push(filters.audit_type);
  }

  if (filters.severity) {
    where.push("severity = ?");
    params.push(filters.severity);
  }

  if (filters.status) {
    where.push("status = ?");
    params.push(filters.status);
  }

  if (filters.search) {
    const q = `%${clean(filters.search)}%`;

    where.push(`
      (
        payment_number LIKE ?
        OR receipt_number LIKE ?
        OR invoice_number LIKE ?
        OR title LIKE ?
        OR message LIKE ?
      )
    `);

    params.push(q, q, q, q, q);
  }

  const whereSql = where.length
    ? `WHERE ${where.join(" AND ")}`
    : "";

  const limit = Math.min(
    500,
    Math.max(1, Number(filters.limit || 50))
  );

  const page = Math.max(
    1,
    Number(filters.page || 1)
  );

  const offset = (page - 1) * limit;

  const rows = await findMany(
    db,
    `
    SELECT *
    FROM tbl_finance_payment_audit_logs
    ${whereSql}
    ORDER BY id DESC
    LIMIT ?
    OFFSET ?
    `,
    [...params, limit, offset]
  );

  const countRow = await findOne(
    db,
    `
    SELECT COUNT(*) AS total
    FROM tbl_finance_payment_audit_logs
    ${whereSql}
    `,
    params
  );

  return {
    rows,

    pagination: {
      page,
      limit,
      total: Number(countRow?.total || 0),
      pages: Math.max(
        1,
        Math.ceil(
          Number(countRow?.total || 0) / limit
        )
      ),
    },
  };
}

/* =========================================================
   PAYMENT HISTORY
========================================================= */

async function getPaymentAuditHistory(paymentId) {
  const result = await listPaymentAudits({
    payment_id: paymentId,
    limit: 500,
    page: 1,
  });

  return result.rows;
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  AUDIT_SEVERITY,
  AUDIT_TYPES,

  createPaymentAudit,

  logPaymentCreated,
  logPaymentCompleted,
  logPaymentFailed,

  logReceiptGenerated,
  logReceiptEmailed,

  logInvoiceCreated,

  logStripeWebhook,

  getPaymentAuditById,
  listPaymentAudits,
  getPaymentAuditHistory,
};