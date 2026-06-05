// backend/services/domains/receipts/receiptService.js
"use strict";

const db = require("../../../db");

const {
  donationCategoryLabel,
  paymentCategoryLabel,
  paymentMethodLabel,
  buildCardLabel,
  normalizePaymentCategory,
  isMembershipPayment,
  isDonationPayment,
  isProgramPayment,
} = require("../../shared/paymentHelpers");

const {
  buildCoveragePayload,
  coverageDisplay,
  buildCoverageChips,
} = require("../../shared/coverageHelpers");

/* =========================================================
   HELPERS
========================================================= */

function safeJson(value, fallback = null) {
  try {
    if (!value) return fallback;
    if (typeof value === "object") return value;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function money(value) {
  return Number(value || 0);
}

function normalizeReceiptRow(row = {}) {
  const category = normalizePaymentCategory(
    row.payment_type ||
      row.category ||
      row.payment_category
  );

  const participants = safeJson(
    row.participants_json ||
      row.payment_participants_json,
    []
  );

  const snapshot = safeJson(
    row.receipt_snapshot_json,
    {}
  );

  const coverage = buildCoveragePayload({
    coverage_year: row.coverage_year,
    coverage_start_month: row.coverage_start_month,
    coverage_end_month:
  row.coverage_end_month ||
  snapshot.coverage_end_month ||
  null,
    months_paid: row.months_paid,
    coverage_months_json:
      row.coverage_months_json ||
      row.payment_coverage_months_json,
  });

  return {
    id: row.id,

    receipt_number: row.receipt_number,
    invoice_number: row.invoice_number,
    payment_number: row.payment_number,

    title: row.title || "Payment Receipt",

    category,
    category_label: paymentCategoryLabel(category),

    sub_category: row.sub_category,

    amount: money(row.amount),
    currency: row.currency || "USD",

    status: row.status || "issued",
    payment_status: row.payment_status || row.status || "paid",

    member_id: row.member_id,
    member_no: row.member_no,

    full_name:
      row.full_name_snapshot ||
      row.payment_full_name ||
      "Member / Guest",

    email:
      row.email_snapshot ||
      row.payment_email ||
      "",

    phone:
      row.phone_snapshot ||
      row.payment_phone ||
      "",

    payment_method:
      row.payment_method ||
      row.method,

    payment_method_label: paymentMethodLabel(
      row.payment_method ||
        row.method
    ),

    payment_provider:
      row.payment_provider ||
      row.provider,

    card_brand: row.card_brand,
    card_last4: row.card_last4,

    card_label: buildCardLabel({
      card_brand: row.card_brand,
      card_last4: row.card_last4,
    }),

    reference_no: row.reference_no,
    transaction_reference: row.transaction_reference,

   membership: isMembershipPayment(category)
  ? {

      plan_name:
        row.plan_name ||
        row.payment_plan_name ||
        snapshot.plan_name ||
        null,

      months_paid:
        row.months_paid ||
        snapshot.months_paid ||
        coverage.months_paid,

      coverage_label:
        row.coverage_label ||
        snapshot.coverage_label ||
        coverageDisplay(row),

      coverage_end_month:
        row.coverage_end_month ||
        snapshot.coverage_end_month ||
        null,

      coverage_months:
        buildCoverageChips({
          ...row,

          coverage_months_json:
            row.coverage_months_json ||
            snapshot.coverage_months_json ||
            coverage.coverage_months_json,
        }),

      coverage_months_json:
        row.coverage_months_json ||
        snapshot.coverage_months_json ||
        coverage.coverage_months_json,
    }

  : null,
    donation: isDonationPayment(category)
      ? {
          donation_category:
            row.donation_category ||
            snapshot.donation_category ||
            row.sub_category,

          donation_label:
            row.donation_category_label ||
            snapshot.donation_category_label ||
            donationCategoryLabel(
              row.donation_category ||
                snapshot.donation_category ||
                row.sub_category ||
                "general_donation"
            ),
        }
      : null,

    program: isProgramPayment(category)
      ? {
          type: category,

          program_name:
            row.program_name ||
            row.payment_program_name ||
            row.program_title ||
            snapshot.program_name ||
            row.sub_category,

          quantity: Number(
            row.quantity ||
              snapshot.quantity ||
              1
          ),

          price_per_person: Number(
            row.price_per_person ||
              snapshot.price_per_person ||
              0
          ),

          participants,

          registration_id:
            row.registration_id ||
            snapshot.registration_id ||
            null,

          news_event_id:
            row.news_event_id ||
            snapshot.news_event_id ||
            null,
        }
      : null,

    email_status: row.email_status || "pending",
    emailed_to: row.emailed_to || row.email_snapshot || "",
    emailed_at: row.emailed_at,
    email_error: row.email_error,

    pdf_url: row.pdf_url,

    issued_at: row.issued_at,
    receipt_date: row.receipt_date,
    created_at: row.created_at,
    updated_at: row.updated_at,

    snapshot,
  };
}

/* =========================================================
   LOAD RECEIPT
========================================================= */

async function loadReceiptById(id) {
  const [rows] = await db.query(
    `
    SELECT
      r.*,

      p.payment_number,
      p.payment_type,
      p.category AS payment_category,
      p.sub_category AS payment_sub_category,

      p.full_name_snapshot AS payment_full_name,
      p.email_snapshot AS payment_email,
      p.phone_snapshot AS payment_phone,

      p.method,
      p.provider,

      p.card_brand,
      p.card_last4,

     p.sub_category AS plan_name,
      p.sub_category AS program_name,
      p.program_title,

      p.coverage_months_json AS coverage_months_json,
NULL AS payment_participants_json,

      i.invoice_number

    FROM tbl_finance_receipts r

    LEFT JOIN tbl_finance_payments p
      ON p.id = r.payment_id

    LEFT JOIN tbl_finance_invoices i
      ON i.id = r.invoice_id

    WHERE r.id = ?

    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

async function loadReceiptByNumber(receiptNumber) {
  const [rows] = await db.query(
    `
    SELECT
      r.*,

      p.payment_number,
      p.payment_type,
      p.category AS payment_category,
      p.sub_category AS payment_sub_category,

      p.full_name_snapshot AS payment_full_name,
      p.email_snapshot AS payment_email,
      p.phone_snapshot AS payment_phone,

      p.method,
      p.provider,

      p.card_brand,
      p.card_last4,

      p.sub_category AS plan_name,
      p.sub_category AS program_name,
      p.program_title,
 p.coverage_months_json AS coverage_months_json,
NULL AS payment_participants_json,
      i.invoice_number

    FROM tbl_finance_receipts r

    LEFT JOIN tbl_finance_payments p
      ON p.id = r.payment_id

    LEFT JOIN tbl_finance_invoices i
      ON i.id = r.invoice_id

    WHERE r.receipt_number = ?

    LIMIT 1
    `,
    [receiptNumber]
  );

  return rows[0] || null;
}

/* =========================================================
   PUBLIC GETTERS
========================================================= */

async function getReceiptById(id) {
  const row = await loadReceiptById(id);
  return row ? normalizeReceiptRow(row) : null;
}

async function getReceiptByNumber(receiptNumber) {
  const row = await loadReceiptByNumber(receiptNumber);
  return row ? normalizeReceiptRow(row) : null;
}

/* =========================================================
   LIST RECEIPTS
========================================================= */

async function listReceipts({
  member_id = null,
  payment_id = null,
  invoice_id = null,
  category = null,
  status = null,
  email_status = null,
  search = "",
  page = 1,
  limit = 25,
} = {}) {
  const where = [];
  const params = [];

  if (member_id) {
    where.push("r.member_id = ?");
    params.push(member_id);
  }

  if (payment_id) {
    where.push("r.payment_id = ?");
    params.push(payment_id);
  }

  if (invoice_id) {
    where.push("r.invoice_id = ?");
    params.push(invoice_id);
  }

  if (category) {
    where.push("(r.category = ? OR r.payment_type = ?)");
    params.push(category, category);
  }

  if (status) {
    where.push("r.status = ?");
    params.push(status);
  }

  if (email_status) {
    where.push("r.email_status = ?");
    params.push(email_status);
  }

  if (search) {
    const s = `%${String(search).trim()}%`;

    where.push(`
      (
        r.receipt_number LIKE ?
        OR r.payment_number LIKE ?
        OR r.full_name_snapshot LIKE ?
        OR r.email_snapshot LIKE ?
        OR r.phone_snapshot LIKE ?
      )
    `);

    params.push(s, s, s, s, s);
  }

  const pageNum = Math.max(1, Number(page || 1));
  const pageSize = Math.min(200, Math.max(1, Number(limit || 25)));
  const offset = (pageNum - 1) * pageSize;

  const whereSql = where.length
    ? `WHERE ${where.join(" AND ")}`
    : "";

  const [[countRow]] = await db.query(
    `
    SELECT COUNT(*) AS total
    FROM tbl_finance_receipts r
    ${whereSql}
    `,
    params
  );

  const [[summary]] = await db.query(
    `
    SELECT
      COUNT(*) AS total_receipts,
      COALESCE(SUM(r.amount), 0) AS total_amount,
      SUM(CASE WHEN r.email_status = 'sent' THEN 1 ELSE 0 END) AS sent_count,
      SUM(CASE WHEN r.email_status = 'failed' THEN 1 ELSE 0 END) AS failed_count
    FROM tbl_finance_receipts r
    ${whereSql}
    `,
    params
  );

  const [rows] = await db.query(
    `
    SELECT
      r.*,

      p.card_brand,
      p.card_last4,
      p.sub_category AS plan_name,
      p.sub_category AS program_name,
     p.coverage_months_json AS coverage_months_json,
NULL AS payment_participants_json,

      i.invoice_number

    FROM tbl_finance_receipts r

    LEFT JOIN tbl_finance_payments p
      ON p.id = r.payment_id

    LEFT JOIN tbl_finance_invoices i
      ON i.id = r.invoice_id

    ${whereSql}

    ORDER BY r.id DESC

    LIMIT ?
    OFFSET ?
    `,
    [...params, pageSize, offset]
  );

  return {
    rows: rows.map(normalizeReceiptRow),

    pagination: {
      page: pageNum,
      limit: pageSize,
      total: Number(countRow?.total || 0),
      pages: Math.max(
        1,
        Math.ceil(Number(countRow?.total || 0) / pageSize)
      ),
    },

    summary: {
      total_receipts: Number(summary?.total_receipts || 0),
      total_amount: Number(summary?.total_amount || 0),
      sent_count: Number(summary?.sent_count || 0),
      failed_count: Number(summary?.failed_count || 0),
    },
  };
}

/* =========================================================
   STATS
========================================================= */

async function getReceiptStats() {
  const [rows] = await db.query(
    `
    SELECT
      COUNT(*) AS total_receipts,
      COALESCE(SUM(amount), 0) AS total_amount,

      SUM(CASE WHEN category = 'membership' OR payment_type = 'membership' THEN 1 ELSE 0 END) AS membership_receipts,
      SUM(CASE WHEN category = 'donation' OR payment_type = 'donation' THEN 1 ELSE 0 END) AS donation_receipts,
      SUM(CASE WHEN category IN ('school','trip') OR payment_type IN ('school','trip') THEN 1 ELSE 0 END) AS program_receipts,

      SUM(CASE WHEN email_status = 'sent' THEN 1 ELSE 0 END) AS sent_emails,
      SUM(CASE WHEN email_status = 'failed' THEN 1 ELSE 0 END) AS failed_emails
    FROM tbl_finance_receipts
    `
  );

  return rows[0] || {};
}

/* =========================================================
   SERVICE WRAPPERS
========================================================= */

async function generateReceiptPdf(receiptId, options = {}) {
  const receipt = await getReceiptById(receiptId);

  if (!receipt) {
    throw new Error("Receipt not found.");
  }

  const {
    generateReceiptPdf: buildPdf,
  } = require("./receiptPdfService");

  const pdf = await buildPdf(receipt);

  await db.query(
    `
    UPDATE tbl_finance_receipts
    SET
      pdf_url = ?,
      updated_at = NOW()
    WHERE id = ?
    `,
    [
      pdf.pdf_url,
      receipt.id,
    ]
  );

  return pdf;
}

async function sendReceiptEmail(receiptId, options = {}) {
  const {
    sendReceiptEmail: sendEmail,
  } = require("./receiptEmailService");

  return sendEmail(receiptId, options);
}

async function resendReceiptEmail(paymentId, options = {}) {
  const {
    resendReceiptEmail: resendEmail,
  } = require("./receiptEmailService");

  return resendEmail(paymentId, options);
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  listReceipts,

  getReceiptById,
  getReceiptByNumber,

  getReceiptStats,

  generateReceiptPdf,
  sendReceiptEmail,
  resendReceiptEmail,

  normalizeReceipt: normalizeReceiptRow,
};