// backend/services/domains/reconciliation/checkReconciliationService.js
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
   IMPORT CHECK PAYMENTS
========================================================= */

async function importCheckPayments(
  reconciliationId
) {

  const rows =
    await findMany(

      pool,

      `
      SELECT

        id,

        check_number,

        bank_name,

        full_name,

        amount,

        payment_date,

        status,

        notes

      FROM tbl_finance_checks

      ORDER BY payment_date DESC
      `,

      []
    );

  let imported = 0;

  for (const row of rows) {

    await createReconciliationItem({

      reconciliation_id:
        reconciliationId,

      item_type:
        "check_payment",

      source_type:
        "check",

      source_id:
        row.id,

      transaction_date:
        row.payment_date,

      amount:
        money(
          row.amount
        ),

      description:
        `
        Check:
        ${row.full_name || ""}
        ${row.check_number || ""}
        `.trim(),

      status:
        "unmatched",

      notes:
        row.notes || null,
    });

    imported++;
  }

  return {

    success: true,

    imported,
  };
}

/* =========================================================
   CHECK STATUS SUMMARY
========================================================= */

async function getCheckStatusSummary() {

  return findMany(

    pool,

    `
    SELECT

      status,

      COUNT(*) AS total_checks,

      COALESCE(
        SUM(amount),
        0
      ) AS total_amount

    FROM tbl_finance_checks

    GROUP BY status

    ORDER BY total_amount DESC
    `,

    []
  );
}

/* =========================================================
   CHECK DAILY SUMMARY
========================================================= */

async function getCheckDailySummary() {

  return findMany(

    pool,

    `
    SELECT

      DATE(payment_date) AS payment_day,

      COUNT(*) AS transactions,

      COALESCE(
        SUM(amount),
        0
      ) AS total_amount

    FROM tbl_finance_checks

    GROUP BY DATE(payment_date)

    ORDER BY payment_day DESC
    `,

    []
  );
}

/* =========================================================
   DETECT DUPLICATE CHECKS
========================================================= */

async function detectDuplicateChecks() {

  return findMany(

    pool,

    `
    SELECT

      check_number,

      COUNT(*) AS total,

      COALESCE(
        SUM(amount),
        0
      ) AS total_amount

    FROM tbl_finance_checks

    WHERE check_number IS NOT NULL
      AND check_number != ''

    GROUP BY check_number

    HAVING COUNT(*) > 1

    ORDER BY total DESC
    `,

    []
  );
}

/* =========================================================
   UNMATCHED CHECK ITEMS
========================================================= */

async function getUnmatchedCheckItems(
  reconciliationId
) {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_finance_reconciliation_items

    WHERE reconciliation_id = ?
      AND source_type = 'check'
      AND status != 'matched'

    ORDER BY
      transaction_date ASC,
      id ASC
    `,

    [reconciliationId]
  );
}

/* =========================================================
   GET CHECK ENTRY
========================================================= */

async function getCheckEntry(
  checkId
) {

  return findOne(

    pool,

    `
    SELECT *

    FROM tbl_finance_checks

    WHERE id = ?

    LIMIT 1
    `,

    [checkId]
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  importCheckPayments,

  getCheckStatusSummary,

  getCheckDailySummary,

  detectDuplicateChecks,

  getUnmatchedCheckItems,

  getCheckEntry,
};