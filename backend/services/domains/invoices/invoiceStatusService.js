// backend/services/domains/invoices/invoiceStatusService.js
"use strict";

const db = require("../../../db");

/* =========================================================
   STATUS HELPERS
========================================================= */

const VALID_STATUSES = [
  "draft",
  "pending",
  "partial",
  "paid",
  "overdue",
  "cancelled",
  "refunded",
  "void",
];

function normalizeStatus(value) {

  const status =
    String(value || "")
      .trim()
      .toLowerCase();

  if (
    VALID_STATUSES.includes(status)
  ) {
    return status;
  }

  return "pending";
}

/* =========================================================
   UPDATE STATUS
========================================================= */

async function updateInvoiceStatus(
  invoiceId,
  status,
  meta = {}
) {

  const normalized =
    normalizeStatus(status);

  await db.query(
    `
    UPDATE tbl_finance_invoices
    SET

      status = ?,
      paid_at =
        CASE
          WHEN ? = 'paid'
          THEN NOW()
          ELSE paid_at
        END,

      updated_at = NOW()

    WHERE id = ?
    `,
    [
      normalized,
      normalized,
      invoiceId,
    ]
  );

  return getInvoiceStatus(
    invoiceId
  );
}

/* =========================================================
   MARK PAID
========================================================= */

async function markInvoicePaid(
  invoiceId,
  payload = {}
) {

  await db.query(
    `
    UPDATE tbl_finance_invoices
    SET

      status = 'paid',
      paid_amount =
        total_amount,

      payment_reference = ?,

      paid_at = NOW(),
      updated_at = NOW()

    WHERE id = ?
    `,
    [
      payload.reference_no || null,
      invoiceId,
    ]
  );

  return getInvoiceStatus(
    invoiceId
  );
}

/* =========================================================
   MARK PARTIAL
========================================================= */

async function markInvoicePartial(
  invoiceId,
  amountPaid = 0
) {

  const [[invoice]] =
    await db.query(
      `
      SELECT
        total_amount,
        paid_amount
      FROM tbl_finance_invoices
      WHERE id = ?
      LIMIT 1
      `,
      [invoiceId]
    );

  if (!invoice) {
    throw new Error(
      "Invoice not found."
    );
  }

  const totalPaid =
    Number(invoice.paid_amount || 0) +
    Number(amountPaid || 0);

  const status =
    totalPaid >=
    Number(invoice.total_amount || 0)
      ? "paid"
      : "partial";

  await db.query(
    `
    UPDATE tbl_finance_invoices
    SET

      status = ?,
      paid_amount = ?,

      updated_at = NOW()

    WHERE id = ?
    `,
    [
      status,
      totalPaid,
      invoiceId,
    ]
  );

  return getInvoiceStatus(
    invoiceId
  );
}

/* =========================================================
   GET STATUS
========================================================= */

async function getInvoiceStatus(
  invoiceId
) {

  const [[row]] =
    await db.query(
      `
      SELECT

        id,
        invoice_number,
        status,

        total_amount,
        paid_amount,

        created_at,
        due_date,
        paid_at

      FROM tbl_finance_invoices

      WHERE id = ?
      LIMIT 1
      `,
      [invoiceId]
    );

  return row || null;
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  VALID_STATUSES,

  normalizeStatus,

  updateInvoiceStatus,

  markInvoicePaid,

  markInvoicePartial,

  getInvoiceStatus,
};