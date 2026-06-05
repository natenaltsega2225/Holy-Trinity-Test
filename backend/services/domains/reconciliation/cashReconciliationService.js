// backend/services/domains/reconciliation/cashReconciliationService.js
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
   IMPORT CASH ENTRIES
========================================================= */

async function importCashEntries(
  reconciliationId
) {

  const rows =
    await findMany(

      pool,

      `
      SELECT

        id,

        receipt_number,

        full_name,

        category,

        amount,

        payment_date,

        collected_by,

        notes

      FROM tbl_finance_cash_entries

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
        "cash_payment",

      source_type:
        "cash",

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
        Cash:
        ${row.full_name || ""}
        ${row.receipt_number || ""}
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
   CASH DAILY SUMMARY
========================================================= */

async function getCashDailySummary() {

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

    FROM tbl_finance_cash_entries

    GROUP BY DATE(payment_date)

    ORDER BY payment_day DESC
    `,

    []
  );
}

/* =========================================================
   CASH CATEGORY SUMMARY
========================================================= */

async function getCashCategorySummary() {

  return findMany(

    pool,

    `
    SELECT

      category,

      COUNT(*) AS transactions,

      COALESCE(
        SUM(amount),
        0
      ) AS total_amount

    FROM tbl_finance_cash_entries

    GROUP BY category

    ORDER BY total_amount DESC
    `,

    []
  );
}

/* =========================================================
   UNMATCHED CASH ITEMS
========================================================= */

async function getUnmatchedCashItems(
  reconciliationId
) {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_finance_reconciliation_items

    WHERE reconciliation_id = ?
      AND source_type = 'cash'
      AND status != 'matched'

    ORDER BY
      transaction_date ASC,
      id ASC
    `,

    [reconciliationId]
  );
}

/* =========================================================
   CASH VARIANCE REPORT
========================================================= */

async function getCashVarianceReport(
  payload = {}
) {

  const expected =
    money(
      payload.expected_total || 0
    );

  const actual =
    money(
      payload.actual_total || 0
    );

  return {

    expected_total:
      expected,

    actual_total:
      actual,

    variance:
      money(
        actual - expected
      ),

    balanced:
      expected === actual,
  };
}

/* =========================================================
   GET CASH ENTRY
========================================================= */

async function getCashEntry(
  entryId
) {

  return findOne(

    pool,

    `
    SELECT *

    FROM tbl_finance_cash_entries

    WHERE id = ?

    LIMIT 1
    `,

    [entryId]
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  importCashEntries,

  getCashDailySummary,

  getCashCategorySummary,

  getUnmatchedCashItems,

  getCashVarianceReport,

  getCashEntry,
};