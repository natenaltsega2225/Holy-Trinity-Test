// backend/services/domains/reconciliation/receiptReconciliationService.js
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
   IMPORT RECEIPTS
========================================================= */

async function importReceipts(
  reconciliationId
) {

  const rows =
    await findMany(

      pool,

      `
      SELECT

        r.id,

        r.receipt_number,

        r.payment_id,

        r.email_status,

        r.emailed_to,

        r.created_at,

        p.payment_number,

        p.full_name_snapshot,

        p.amount,

        p.category,

        p.sub_category

      FROM tbl_finance_receipts r

      INNER JOIN tbl_finance_payments p
        ON p.id = r.payment_id

      ORDER BY r.created_at DESC
      `,

      []
    );

  let imported = 0;

  for (const row of rows) {

    await createReconciliationItem({

      reconciliation_id:
        reconciliationId,

      item_type:
        "receipt",

      source_type:
        "receipt",

      source_id:
        row.id,

      transaction_date:
        row.created_at,

      amount:
        money(
          row.amount
        ),

      description:
        `
        Receipt:
        ${row.receipt_number || ""}
        ${row.payment_number || ""}
        `.trim(),

      status:
        row.email_status === "failed"

          ? "unmatched"

          : "matched",

      notes:
        `
        Category:
        ${row.category || ""}

        Sub Category:
        ${row.sub_category || ""}

        Email Status:
        ${row.email_status || ""}
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
   RECEIPT EMAIL SUMMARY
========================================================= */

async function getReceiptEmailSummary() {

  return findMany(

    pool,

    `
    SELECT

      email_status,

      COUNT(*) AS receipts

    FROM tbl_finance_receipts

    GROUP BY email_status

    ORDER BY receipts DESC
    `,

    []
  );
}

/* =========================================================
   FAILED RECEIPTS
========================================================= */

async function getFailedReceipts() {

  return findMany(

    pool,

    `
    SELECT

      r.*,

      p.payment_number,

      p.full_name_snapshot,

      p.amount

    FROM tbl_finance_receipts r

    LEFT JOIN tbl_finance_payments p
      ON p.id = r.payment_id

    WHERE r.email_status = 'failed'

    ORDER BY r.created_at DESC
    `,

    []
  );
}

/* =========================================================
   RECEIPT DAILY SUMMARY
========================================================= */

async function getReceiptDailySummary() {

  return findMany(

    pool,

    `
    SELECT

      DATE(created_at) AS receipt_day,

      COUNT(*) AS receipts

    FROM tbl_finance_receipts

    GROUP BY DATE(created_at)

    ORDER BY receipt_day DESC
    `,

    []
  );
}

/* =========================================================
   UNMATCHED RECEIPT ITEMS
========================================================= */

async function getUnmatchedReceiptItems(
  reconciliationId
) {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_finance_reconciliation_items

    WHERE reconciliation_id = ?
      AND source_type = 'receipt'
      AND status != 'matched'

    ORDER BY
      transaction_date ASC,
      id ASC
    `,

    [reconciliationId]
  );
}

/* =========================================================
   FIND DUPLICATE RECEIPTS
========================================================= */

async function findDuplicateReceipts() {

  return findMany(

    pool,

    `
    SELECT

      receipt_number,

      COUNT(*) AS total

    FROM tbl_finance_receipts

    GROUP BY receipt_number

    HAVING COUNT(*) > 1

    ORDER BY total DESC
    `,

    []
  );
}

/* =========================================================
   GET RECEIPT ENTRY
========================================================= */

async function getReceiptEntry(
  receiptId
) {

  return findOne(

    pool,

    `
    SELECT *

    FROM tbl_finance_receipts

    WHERE id = ?

    LIMIT 1
    `,

    [receiptId]
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  importReceipts,

  getReceiptEmailSummary,

  getFailedReceipts,

  getReceiptDailySummary,

  getUnmatchedReceiptItems,

  findDuplicateReceipts,

  getReceiptEntry,
};