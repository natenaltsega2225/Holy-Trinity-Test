"use strict";

const db = require("../../../db");

const {
  updateExistingColumns,
  findOne,
} = require("../../../utils/dbHelpers");

const VALID_STATUSES = [
  "draft",
  "open",
  "pending",
  "partial",
  "paid",
  "overdue",
  "cancelled",
  "void",
  "refunded",
  "write_off",
];

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();

  if (status === "unpaid") return "open";
  if (status === "canceled") return "cancelled";
  if (status === "written_off") return "write_off";

  return VALID_STATUSES.includes(status) ? status : "open";
}

function statusFromAmounts(totalAmount, paidAmount, dueDate = null, currentStatus = null) {
  const current = normalizeStatus(currentStatus);

  if (["cancelled", "void", "refunded", "write_off", "draft"].includes(current)) {
    return current;
  }

  const total = money(totalAmount);
  const paid = money(paidAmount);

  if (total <= 0) return "open";
  if (paid >= total) return "paid";
  if (paid > 0) return "partial";

  if (dueDate && new Date(dueDate).getTime() < Date.now()) {
    return "overdue";
  }

  return "open";
}

async function getInvoiceStatus(invoiceId) {
  return findOne(
    db,
    `
    SELECT
      id,
      invoice_number,
      status,
      invoice_status,
      total_amount,
      amount,
      paid_amount,
      balance_due,
      currency,
      due_date,
      invoice_date,
      paid_at,
      cancelled_at,
      voided_at,
      refunded_at,
      created_at,
      updated_at
    FROM tbl_finance_invoices
    WHERE id = ?
    LIMIT 1
    `,
    [invoiceId]
  );
}

async function getInvoiceStatusByNumber(invoiceNumber) {
  return findOne(
    db,
    `
    SELECT
      id,
      invoice_number,
      status,
      invoice_status,
      total_amount,
      amount,
      paid_amount,
      balance_due,
      currency,
      due_date,
      invoice_date,
      paid_at,
      cancelled_at,
      voided_at,
      refunded_at,
      created_at,
      updated_at
    FROM tbl_finance_invoices
    WHERE invoice_number = ?
    LIMIT 1
    `,
    [invoiceNumber]
  );
}

async function getPaidAmountFromPayments(invoiceId, conn = db) {
  const [[row]] = await conn.query(
    `
    SELECT COALESCE(SUM(amount), 0) AS paid_amount
    FROM tbl_finance_payments
    WHERE invoice_id = ?
      AND LOWER(COALESCE(status, payment_status, '')) IN
        ('paid', 'completed', 'posted', 'succeeded')
    `,
    [invoiceId]
  );

  return money(row?.paid_amount || 0);
}

async function syncInvoicePaymentTotals(invoiceId, payload = {}, conn = db) {
  const invoice = await getInvoiceStatus(invoiceId);

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  const total = money(invoice.total_amount || invoice.amount || 0);
  const paidFromRows = await getPaidAmountFromPayments(invoiceId, conn);

  const fallbackPaid =
    payload.fallback_paid_amount !== undefined
      ? money(payload.fallback_paid_amount)
      : money(invoice.paid_amount || 0);

  const rawPaid = paidFromRows > 0 ? paidFromRows : fallbackPaid;
  const paid = Math.min(rawPaid, total);
  const balance = Math.max(money(total - paid), 0);
  const status = statusFromAmounts(total, paid, invoice.due_date, invoice.status);

  await updateExistingColumns(
    conn,
    "tbl_finance_invoices",
    {
      status,
      invoice_status: status,
      paid_amount: paid,
      balance_due: balance,

      payment_id: payload.payment_id || undefined,
      payment_number: payload.payment_number || undefined,
      receipt_id: payload.receipt_id || undefined,
      receipt_number: payload.receipt_number || undefined,
      payment_reference:
        payload.reference_no ||
        payload.reference_number ||
        payload.transaction_reference ||
        undefined,

      paid_at:
        status === "paid"
          ? payload.paid_at || invoice.paid_at || new Date()
          : undefined,

      updated_by: payload.updated_by || payload.user_id || undefined,
      updated_at: new Date(),
    },
    "id = ?",
    [invoiceId]
  );

  return getInvoiceStatus(invoiceId);
}

async function updateInvoiceStatus(invoiceId, status, meta = {}) {
  const normalized = normalizeStatus(status);

  await updateExistingColumns(
    db,
    "tbl_finance_invoices",
    {
      status: normalized,
      invoice_status: normalized,
      paid_at: normalized === "paid" ? meta.paid_at || new Date() : undefined,
      cancelled_at: normalized === "cancelled" ? meta.cancelled_at || new Date() : undefined,
      voided_at: normalized === "void" ? meta.voided_at || new Date() : undefined,
      refunded_at: normalized === "refunded" ? meta.refunded_at || new Date() : undefined,
      status_reason: meta.reason || meta.status_reason || undefined,
      updated_by: meta.updated_by || meta.user_id || undefined,
      updated_at: new Date(),
    },
    "id = ?",
    [invoiceId]
  );

  return getInvoiceStatus(invoiceId);
}

async function recalculateInvoiceStatus(invoiceId, meta = {}) {
  return syncInvoicePaymentTotals(invoiceId, meta);
}

async function markInvoicePaid(invoiceId, payload = {}) {
  const invoice = await getInvoiceStatus(invoiceId);

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  const total = money(invoice.total_amount || invoice.amount || 0);

  return syncInvoicePaymentTotals(invoiceId, {
    ...payload,
    fallback_paid_amount: total,
    paid_at: payload.paid_at || new Date(),
  });
}

async function markInvoicePartial(invoiceId, amountPaid = 0, payload = {}) {
  const invoice = await getInvoiceStatus(invoiceId);

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  const currentPaid = money(invoice.paid_amount || 0);
  const fallbackPaid = money(currentPaid + money(amountPaid));

  return syncInvoicePaymentTotals(invoiceId, {
    ...payload,
    fallback_paid_amount: fallbackPaid,
  });
}

async function applyInvoicePayment(invoiceId, payload = {}) {
  const amountPaid = money(payload.amount || payload.paid_amount || 0);

  if (amountPaid <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  return markInvoicePartial(invoiceId, amountPaid, payload);
}

async function markInvoiceOpen(invoiceId, payload = {}) {
  await updateExistingColumns(
    db,
    "tbl_finance_invoices",
    {
      status: "open",
      invoice_status: "open",
      paid_amount: payload.paid_amount !== undefined ? money(payload.paid_amount) : undefined,
      balance_due: payload.balance_due !== undefined ? money(payload.balance_due) : undefined,
      paid_at: null,
      updated_by: payload.updated_by || payload.user_id || undefined,
      updated_at: new Date(),
    },
    "id = ?",
    [invoiceId]
  );

  return getInvoiceStatus(invoiceId);
}

async function markInvoiceOverdue(invoiceId, payload = {}) {
  await updateExistingColumns(
    db,
    "tbl_finance_invoices",
    {
      status: "overdue",
      invoice_status: "overdue",
      overdue_at: payload.overdue_at || new Date(),
      updated_by: payload.updated_by || payload.user_id || undefined,
      updated_at: new Date(),
    },
    "id = ? AND LOWER(COALESCE(status, '')) NOT IN ('paid', 'cancelled', 'void', 'refunded', 'write_off')",
    [invoiceId]
  );

  return getInvoiceStatus(invoiceId);
}

async function cancelInvoice(invoiceId, payload = {}) {
  await updateExistingColumns(
    db,
    "tbl_finance_invoices",
    {
      status: "cancelled",
      invoice_status: "cancelled",
      cancellation_reason: payload.reason || payload.cancellation_reason || null,
      cancelled_by: payload.cancelled_by || payload.user_id || null,
      cancelled_at: payload.cancelled_at || new Date(),
      updated_at: new Date(),
    },
    "id = ?",
    [invoiceId]
  );

  return getInvoiceStatus(invoiceId);
}

async function voidInvoice(invoiceId, payload = {}) {
  await updateExistingColumns(
    db,
    "tbl_finance_invoices",
    {
      status: "void",
      invoice_status: "void",
      void_reason: payload.reason || payload.void_reason || null,
      voided_by: payload.voided_by || payload.user_id || null,
      voided_at: payload.voided_at || new Date(),
      updated_at: new Date(),
    },
    "id = ?",
    [invoiceId]
  );

  return getInvoiceStatus(invoiceId);
}

async function refundInvoice(invoiceId, payload = {}) {
  const invoice = await getInvoiceStatus(invoiceId);

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  const refundAmount = money(payload.refund_amount || payload.amount || invoice.paid_amount || 0);

  await updateExistingColumns(
    db,
    "tbl_finance_invoices",
    {
      status: "refunded",
      invoice_status: "refunded",
      refund_amount: refundAmount,
      refund_reason: payload.reason || payload.refund_reason || null,
      refunded_by: payload.refunded_by || payload.user_id || null,
      refunded_at: payload.refunded_at || new Date(),
      updated_at: new Date(),
    },
    "id = ?",
    [invoiceId]
  );

  return getInvoiceStatus(invoiceId);
}

async function refreshOverdueInvoices() {
  const [result] = await db.query(
    `
    UPDATE tbl_finance_invoices
    SET
      status = 'overdue',
      invoice_status = 'overdue',
      overdue_at = COALESCE(overdue_at, NOW()),
      updated_at = NOW()
    WHERE due_date IS NOT NULL
      AND DATE(due_date) < CURDATE()
      AND LOWER(COALESCE(status, 'open')) IN ('open', 'pending', 'partial')
      AND COALESCE(balance_due, total_amount, amount, 0) > 0
    `
  );

  return {
    success: true,
    affectedRows: result.affectedRows || 0,
  };
}

module.exports = {
  VALID_STATUSES,

  normalizeStatus,
  statusFromAmounts,

  updateInvoiceStatus,
  recalculateInvoiceStatus,
  syncInvoicePaymentTotals,

  markInvoicePaid,
  markInvoicePartial,
  applyInvoicePayment,
  markInvoiceOpen,
  markInvoiceOverdue,

  cancelInvoice,
  voidInvoice,
  refundInvoice,
  refreshOverdueInvoices,

  getInvoiceStatus,
  getInvoiceStatusByNumber,
};