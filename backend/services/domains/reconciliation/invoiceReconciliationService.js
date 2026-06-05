// backend/services/domains/reconciliation/invoiceReconciliationService.js
"use strict";

const pool =
  require("../../../db");

const {

  createReconciliationItem,

} = require(
  "./reconciliationService"
);

const {

  findMany,

  findOne,

} = require(
  "../../../utils/dbHelpers"
);

const {

  money,

} = require(
  "../../../utils/financeHelpers"
);

/* =========================================================
   IMPORT INVOICES
========================================================= */

async function importInvoices(
  reconciliationId
) {

  const rows =
    await findMany(

      pool,

      `
      SELECT

        i.id,

        i.invoice_number,

        i.member_id,

        i.full_name_snapshot,

        i.invoice_type,

        i.total_amount,

        i.balance_due,

        i.status,

        i.issue_date,

        i.due_date

      FROM tbl_finance_invoices i

      ORDER BY i.issue_date DESC
      `,

      []
    );

  let imported = 0;

  for (const row of rows) {

    await createReconciliationItem({

      reconciliation_id:
        reconciliationId,

      item_type:
        "invoice",

      source_type:
        "invoice",

      source_id:
        row.id,

      transaction_date:
        row.issue_date,

      amount:
        money(
          row.total_amount
        ),

      description:
        `
        Invoice:
        ${row.invoice_number || ""}
        ${row.full_name_snapshot || ""}
        `.trim(),

      status:
        row.balance_due > 0

          ? "unmatched"

          : "matched",

      notes:
        `
        Due:
        ${row.due_date || ""}

        Status:
        ${row.status || ""}
        `.trim(),
    });

    imported++;
  }

  return {

    success: true,

    imported,
  };
}

/* =========================================================
   INVOICE STATUS SUMMARY
========================================================= */

async function getInvoiceStatusSummary() {

  return findMany(

    pool,

    `
    SELECT

      status,

      COUNT(*) AS invoices,

      COALESCE(
        SUM(total_amount),
        0
      ) AS total_amount,

      COALESCE(
        SUM(balance_due),
        0
      ) AS total_balance_due

    FROM tbl_finance_invoices

    GROUP BY status

    ORDER BY total_amount DESC
    `,

    []
  );
}

/* =========================================================
   OVERDUE INVOICES
========================================================= */

async function getOverdueInvoices() {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_finance_invoices

    WHERE due_date < CURDATE()
      AND balance_due > 0

    ORDER BY due_date ASC
    `,

    []
  );
}

/* =========================================================
   INVOICE DAILY SUMMARY
========================================================= */

async function getInvoiceDailySummary() {

  return findMany(

    pool,

    `
    SELECT

      DATE(issue_date) AS invoice_day,

      COUNT(*) AS invoices,

      COALESCE(
        SUM(total_amount),
        0
      ) AS total_amount

    FROM tbl_finance_invoices

    GROUP BY DATE(issue_date)

    ORDER BY invoice_day DESC
    `,

    []
  );
}

/* =========================================================
   UNMATCHED INVOICE ITEMS
========================================================= */

async function getUnmatchedInvoiceItems(
  reconciliationId
) {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_finance_reconciliation_items

    WHERE reconciliation_id = ?
      AND source_type = 'invoice'
      AND status != 'matched'

    ORDER BY
      transaction_date ASC,
      id ASC
    `,

    [reconciliationId]
  );
}

/* =========================================================
   FIND DUPLICATE INVOICES
========================================================= */

async function findDuplicateInvoices() {

  return findMany(

    pool,

    `
    SELECT

      invoice_number,

      COUNT(*) AS total,

      COALESCE(
        SUM(total_amount),
        0
      ) AS total_amount

    FROM tbl_finance_invoices

    GROUP BY invoice_number

    HAVING COUNT(*) > 1

    ORDER BY total DESC
    `,

    []
  );
}

/* =========================================================
   GET INVOICE ENTRY
========================================================= */

async function getInvoiceEntry(
  invoiceId
) {

  return findOne(

    pool,

    `
    SELECT *

    FROM tbl_finance_invoices

    WHERE id = ?

    LIMIT 1
    `,

    [invoiceId]
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  importInvoices,

  getInvoiceStatusSummary,

  getOverdueInvoices,

  getInvoiceDailySummary,

  getUnmatchedInvoiceItems,

  findDuplicateInvoices,

  getInvoiceEntry,
};