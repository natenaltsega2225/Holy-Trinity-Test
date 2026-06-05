// backend/services/domains/invoices/invoiceService.js
"use strict";

const db = require("../../../db");

const {
  normalizePaymentCategory,
  paymentCategoryLabel,
  donationCategoryLabel,
  paymentMethodLabel,
} = require("../../shared/paymentHelpers");

const {
  buildCoveragePayload,
  buildCoverageChips,
  coverageDisplay,
} = require("../../shared/coverageHelpers");

/* =========================================================
   SAFE JSON
========================================================= */

function safeJson(value, fallback = null) {
  try {
    if (!value) return fallback;

    if (typeof value === "object") {
      return value;
    }

    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/* =========================================================
   MONEY
========================================================= */

function money(value) {
  return Number(value || 0);
}

/* =========================================================
   LOAD INVOICE
========================================================= */

async function loadInvoiceById(id) {

  const [rows] =
    await db.query(
      `
      SELECT *
      FROM tbl_finance_invoices
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

  return rows[0] || null;
}

/* =========================================================
   LOAD BY NUMBER
========================================================= */

async function loadInvoiceByNumber(
  invoiceNumber
) {

  const [rows] =
    await db.query(
      `
      SELECT *
      FROM tbl_finance_invoices
      WHERE invoice_number = ?
      LIMIT 1
      `,
      [invoiceNumber]
    );

  return rows[0] || null;
}

/* =========================================================
   LOAD PAYMENTS
========================================================= */

async function loadInvoicePayments(
  invoiceId
) {

  const [rows] =
    await db.query(
      `
      SELECT *

      FROM tbl_finance_payments

      WHERE invoice_id = ?

      ORDER BY id ASC
      `,
      [invoiceId]
    );

  return rows;
}

/* =========================================================
   LOAD RECEIPTS
========================================================= */

async function loadInvoiceReceipts(
  invoiceId
) {

  const [rows] =
    await db.query(
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

/* =========================================================
   NORMALIZE PAYMENT
========================================================= */

function normalizeInvoicePayment(
  row = {}
) {

  const category =
    normalizePaymentCategory(
      row.payment_type ||
      row.category
    );

  const coverage =
    buildCoveragePayload({
      coverage_year:
        row.coverage_year,

      coverage_start_month:
        row.coverage_start_month,

      months_paid:
        row.months_paid,

      coverage_months_json:
        row.coverage_months_json,
    });

  return {

    id:
      row.id,

    payment_number:
      row.payment_number,

    category,

    category_label:
      paymentCategoryLabel(
        category
      ),

    sub_category:
      row.sub_category,

    amount:
      money(row.amount),

    payment_method:
      row.payment_method,

    payment_method_label:
      paymentMethodLabel(
        row.payment_method
      ),

    payment_provider:
      row.payment_provider,

    payment_status:
      row.payment_status,

    reference_no:
      row.reference_no,

    transaction_reference:
      row.transaction_reference,

    /* =====================================================
       MEMBERSHIP
    ===================================================== */

    membership:
      category === "membership"
        ? {
            plan_name:
              row.plan_name,

            months_paid:
              row.months_paid,

            coverage_label:
              coverageDisplay(
                row
              ),

            coverage_months:
              buildCoverageChips(
                row
              ),
          }
        : null,

    /* =====================================================
       DONATION
    ===================================================== */

    donation:
      category === "donation"
        ? {
            donation_category:
              row.donation_category,

            donation_label:
              donationCategoryLabel(
                row.donation_category
              ),
          }
        : null,

    /* =====================================================
       PROGRAMS
    ===================================================== */

    program:
      ["school", "trip"].includes(
        category
      )
        ? {
            type:
              category,

            program_name:
              row.program_name,

            quantity:
              Number(
                row.quantity || 1
              ),

            participants:
              safeJson(
                row.participants_json,
                []
              ),

            registration_id:
              row.registration_id,

            news_event_id:
              row.news_event_id,
          }
        : null,
  };
}

/* =========================================================
   NORMALIZE INVOICE
========================================================= */

async function normalizeInvoice(
  invoiceRow = {}
) {

  const payments =
    await loadInvoicePayments(
      invoiceRow.id
    );

  const receipts =
    await loadInvoiceReceipts(
      invoiceRow.id
    );

  const normalizedPayments =
    payments.map(
      normalizeInvoicePayment
    );

  return {

    /* =====================================================
       CORE
    ===================================================== */

    id:
      invoiceRow.id,

    invoice_number:
      invoiceRow.invoice_number,

    title:
      invoiceRow.title,

    category:
      invoiceRow.category,

    category_label:
      paymentCategoryLabel(
        invoiceRow.category
      ),

    status:
      invoiceRow.status,

    invoice_status:
      invoiceRow.status,

    /* =====================================================
       PERSON
    ===================================================== */

    member_id:
      invoiceRow.member_id,

    member_no:
      invoiceRow.member_no,

    full_name:
      invoiceRow.full_name_snapshot,

    email:
      invoiceRow.email_snapshot,

    phone:
      invoiceRow.phone_snapshot,

    /* =====================================================
       AMOUNTS
    ===================================================== */

    subtotal:
      money(
        invoiceRow.subtotal
      ),

    tax_amount:
      money(
        invoiceRow.tax_amount
      ),

    discount_amount:
      money(
        invoiceRow.discount_amount
      ),

    total_amount:
      money(
        invoiceRow.total_amount
      ),

    paid_amount:
      money(
        invoiceRow.paid_amount
      ),

    balance_due:
      money(
        invoiceRow.balance_due
      ),

    currency:
      invoiceRow.currency ||
      "USD",

    /* =====================================================
       PAYMENTS
    ===================================================== */

    payments:
      normalizedPayments,

    payment_count:
      normalizedPayments.length,

    /* =====================================================
       RECEIPTS
    ===================================================== */

    receipts:
      receipts.map((r) => ({
        id: r.id,

        receipt_number:
          r.receipt_number,

        amount:
          money(r.amount),

        status:
          r.payment_status,

        created_at:
          r.created_at,
      })),

    receipt_count:
      receipts.length,

    /* =====================================================
       DATES
    ===================================================== */

    invoice_date:
      invoiceRow.invoice_date,

    due_date:
      invoiceRow.due_date,

    paid_at:
      invoiceRow.paid_at,

    created_at:
      invoiceRow.created_at,

    updated_at:
      invoiceRow.updated_at,
  };
}

/* =========================================================
   GET BY ID
========================================================= */

async function getInvoiceById(id) {

  const row =
    await loadInvoiceById(id);

  if (!row) {
    return null;
  }

  return normalizeInvoice(
    row
  );
}

/* =========================================================
   GET BY NUMBER
========================================================= */

async function getInvoiceByNumber(
  invoiceNumber
) {

  const row =
    await loadInvoiceByNumber(
      invoiceNumber
    );

  if (!row) {
    return null;
  }

  return normalizeInvoice(
    row
  );
}

/* =========================================================
   LIST
========================================================= */

async function listInvoices({
  member_id = null,
  category = null,
  status = null,
  search = "",
} = {}) {

  const where = [];
  const params = [];

  if (member_id) {
    where.push(
      "member_id = ?"
    );

    params.push(member_id);
  }

  if (category) {
    where.push(
      "category = ?"
    );

    params.push(category);
  }

  if (status) {
    where.push(
      "status = ?"
    );

    params.push(status);
  }

  if (search) {

    where.push(`
      (
        invoice_number LIKE ?
        OR full_name_snapshot LIKE ?
        OR email_snapshot LIKE ?
      )
    `);

    const s =
      `%${search}%`;

    params.push(
      s,
      s,
      s
    );
  }

  const [rows] =
    await db.query(
      `
      SELECT *

      FROM tbl_finance_invoices

      ${
        where.length
          ? `WHERE ${where.join(" AND ")}`
          : ""
      }

      ORDER BY id DESC
      `,
      params
    );

  const result = [];

  for (const row of rows) {
    result.push(
      await normalizeInvoice(
        row
      )
    );
  }

  return result;
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  getInvoiceById,
  getInvoiceByNumber,
  listInvoices,

  normalizeInvoice,
  normalizeInvoicePayment,
};