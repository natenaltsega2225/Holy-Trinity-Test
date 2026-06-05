"use strict";

/*
=========================================================
 ENTERPRISE LEDGER SERVICE
=========================================================
*/

const crypto = require("crypto");

const pool = require("../../../db");

const {
  insertExistingColumns,
  findOne,
  findMany,
  updateExistingColumns,
} = require("../../../utils/dbHelpers");

const {
  clean,
  nullable,
  mysqlNow,
} = require("../../../utils/financeHelpers");

/* =========================================================
   HELPERS
========================================================= */

function ledgerNumber() {
  return `LED-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

function toMoney(value) {
  const n = Number(value || 0);

  return Number.isFinite(n)
    ? Number(n.toFixed(2))
    : 0;
}

function normalizeEntryType(value) {
  const allowed = [
    "payment",
    "invoice",
    "receipt",
    "refund",
    "adjustment",
    "donation",
    "membership",
    "pledge",
    "expense",
    "reimbursement",
    "registration",
    "reversal",
    "school",
    "trip",
  ];

  const type = String(value || "").toLowerCase();

  return allowed.includes(type)
    ? type
    : "payment";
}

function normalizeStatus(value) {
  const allowed = [
    "posted",
    "draft",
    "pending",
    "reversed",
    "void",
    "matched",
  ];

  const status = String(value || "").toLowerCase();

  return allowed.includes(status)
    ? status
    : "posted";
}

/* =========================================================
   BALANCE
========================================================= */

async function getLatestMemberBalance(
  db,
  memberId
) {
  if (!memberId) {
    return 0;
  }

  const [[row]] = await db.query(
    `
    SELECT running_balance
    FROM tbl_finance_member_ledger
    WHERE member_id = ?
    ORDER BY record_date DESC, id DESC
    LIMIT 1
    `,
    [memberId]
  );

  return toMoney(
    row?.running_balance || 0
  );
}

/* =========================================================
   CREATE LEDGER ENTRY
========================================================= */

async function createLedgerEntry(
  connOrPayload,
  maybePayload
) {
  const hasConn =
    connOrPayload &&
    typeof connOrPayload.query === "function";

  const db = hasConn
    ? connOrPayload
    : pool;

  const payload = hasConn
    ? maybePayload || {}
    : connOrPayload || {};

  const debit = toMoney(
    payload.debit_amount ??
      payload.debit ??
      0
  );

  const credit = toMoney(
    payload.credit_amount ??
      payload.credit ??
      0
  );

  const amount = toMoney(
    payload.amount ??
      Math.max(debit, credit)
  );

  if (
    debit <= 0 &&
    credit <= 0 &&
    amount <= 0
  ) {
    throw new Error(
      "Ledger entry requires debit, credit, or amount."
    );
  }

  const memberId =
    payload.member_id || null;

  const previousBalance =
    await getLatestMemberBalance(
      db,
      memberId
    );

  const runningBalance =
    toMoney(
      previousBalance +
        credit -
        debit
    );

  const entryNo =
    payload.ledger_uuid ||
    payload.ledger_number ||
    ledgerNumber();

  const id =
    await insertExistingColumns(
      db,
      "tbl_finance_member_ledger",
      {
        ledger_uuid: entryNo,
        ledger_number: entryNo,

        member_id: memberId,

        member_no:
          payload.member_no ||
          null,

        full_name_snapshot:
          nullable(
            payload.full_name_snapshot ||
              payload.full_name,
            255
          ),

        phone_snapshot:
          nullable(
            payload.phone_snapshot ||
              payload.phone,
            80
          ),

        record_type:
          normalizeEntryType(
            payload.record_type ||
              payload.entry_type
          ),

        ledger_type:
          normalizeEntryType(
            payload.ledger_type ||
              payload.entry_type
          ),

        entry_type:
          normalizeEntryType(
            payload.entry_type ||
              payload.record_type
          ),

        related_document_type:
          payload.related_document_type ||
          payload.reference_type ||
          null,

        related_document_id:
          payload.related_document_id ||
          payload.reference_id ||
          null,

        related_document_number:
          payload.related_document_number ||
          payload.reference_no ||
          null,

        payment_id:
          payload.payment_id ||
          null,

        invoice_id:
          payload.invoice_id ||
          null,

        receipt_id:
          payload.receipt_id ||
          null,

        payment_number:
          payload.payment_number ||
          null,

        invoice_number:
          payload.invoice_number ||
          null,

        receipt_number:
          payload.receipt_number ||
          null,

        record_date:
          payload.record_date ||
          payload.posted_at ||
          mysqlNow(),

        posted_at:
          payload.posted_at ||
          mysqlNow(),

        description:
          nullable(
            payload.description,
            1000
          ),

        debit_amount: debit,
        credit_amount: credit,
        amount,

        running_balance:
          runningBalance,

        source:
          payload.source ||
          payload.audit_source ||
          "finance_ledger",

        source_type:
          payload.source_type ||
          payload.entry_type ||
          null,

        source_reference:
          payload.source_reference ||
          payload.reference_no ||
          null,

        reference_no:
          payload.reference_no ||
          payload.source_reference ||
          null,

        status:
          normalizeStatus(
            payload.status ||
              payload.ledger_status
          ),

        ledger_status:
          normalizeStatus(
            payload.ledger_status ||
              payload.status
          ),

        reconciliation_status:
          payload.reconciliation_status ||
          "pending",

        reconciliation_batch:
          payload.reconciliation_batch ||
          null,

        reconciled_by:
          payload.reconciled_by ||
          null,

        reconciled_at:
          payload.reconciled_at ||
          null,

        plan_type:
          payload.plan_type ||
          null,

        months_paid:
          payload.months_paid ||
          null,

        coverage_start:
          payload.coverage_start ||
          null,

        coverage_end:
          payload.coverage_end ||
          null,

        dues_subscription_id:
          payload.dues_subscription_id ||
          null,

        notes:
          nullable(
            payload.notes,
            2000
          ),

        created_by:
          payload.created_by ||
          null,

        created_at:
          mysqlNow(),

        updated_at:
          mysqlNow(),
      }
    );

  return getLedgerEntryById(id);
}

/* =========================================================
   PAYMENT ENTRY
========================================================= */

async function postPaymentEntry(
  connOrPayload,
  maybePayload
) {
  const hasConn =
    connOrPayload &&
    typeof connOrPayload.query === "function";

  const payload = hasConn
    ? maybePayload || {}
    : connOrPayload || {};

  return createLedgerEntry(
    hasConn
      ? connOrPayload
      : payload,

    hasConn
      ? {
          ...payload,

          entry_type:
            payload.entry_type ||
            "payment",

          record_type:
            payload.record_type ||
            "payment",

          ledger_type:
            payload.ledger_type ||
            "payment",

          credit_amount:
            payload.credit_amount ??
            payload.amount,

          debit_amount:
            payload.debit_amount ??
            0,

          status:
            payload.status ||
            "posted",
        }
      : undefined
  );
}

/* =========================================================
   GET ENTRY
========================================================= */

async function getLedgerEntryById(
  ledgerId
) {
  return findOne(
    pool,
    `
    SELECT
      l.*,

      p.payment_number
      AS linked_payment_number,

      i.invoice_number
      AS linked_invoice_number,

      r.receipt_number
      AS linked_receipt_number

    FROM tbl_finance_member_ledger l

    LEFT JOIN tbl_finance_payments p
      ON p.id = l.payment_id

    LEFT JOIN tbl_finance_invoices i
      ON i.id = l.invoice_id

    LEFT JOIN tbl_finance_receipts r
      ON r.id = l.receipt_id

    WHERE l.id = ?

    LIMIT 1
    `,
    [ledgerId]
  );
}

/* =========================================================
   LIST
========================================================= */

async function listLedgerEntries(
  filters = {}
) {
  const rows = await findMany(
    pool,
    `
    SELECT
      l.*,

      p.payment_number
      AS linked_payment_number,

      i.invoice_number
      AS linked_invoice_number,

      r.receipt_number
      AS linked_receipt_number

    FROM tbl_finance_member_ledger l

    LEFT JOIN tbl_finance_payments p
      ON p.id = l.payment_id

    LEFT JOIN tbl_finance_invoices i
      ON i.id = l.invoice_id

    LEFT JOIN tbl_finance_receipts r
      ON r.id = l.receipt_id

    ORDER BY
      l.record_date DESC,
      l.id DESC

    LIMIT 500
    `,
    []
  );

  return rows;
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  createLedgerEntry,
  postPaymentEntry,
  getLedgerEntryById,
  listLedgerEntries,
  getLatestMemberBalance,
};