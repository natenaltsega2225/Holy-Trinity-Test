// backend/services/domains/reconciliation/ledgerReconciliationService.js
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
   IMPORT LEDGER ENTRIES
========================================================= */

async function importLedgerEntries(
  reconciliationId
) {

  const rows =
    await findMany(

      pool,

      `
      SELECT

        id,

        member_id,

        ledger_type,

        reference_number,

        description,

        debit_amount,

        credit_amount,

        balance_after,

        transaction_date

      FROM tbl_finance_member_ledger

      ORDER BY transaction_date DESC
      `,

      []
    );

  let imported = 0;

  for (const row of rows) {

    const amount =

      Number(
        row.credit_amount || 0
      ) > 0

        ? row.credit_amount

        : row.debit_amount;

    await createReconciliationItem({

      reconciliation_id:
        reconciliationId,

      item_type:
        "ledger_entry",

      source_type:
        "ledger",

      source_id:
        row.id,

      transaction_date:
        row.transaction_date,

      amount:
        money(amount),

      description:
        `
        Ledger:
        ${row.reference_number || ""}
        ${row.description || ""}
        `.trim(),

      status:
        "unmatched",

      notes:
        `Balance After: ${row.balance_after || 0}`,
    });

    imported++;
  }

  return {

    success: true,

    imported,
  };
}

/* =========================================================
   LEDGER BALANCE SUMMARY
========================================================= */

async function getLedgerBalanceSummary() {

  return findOne(

    pool,

    `
    SELECT

      COUNT(*) AS total_entries,

      COALESCE(
        SUM(debit_amount),
        0
      ) AS total_debits,

      COALESCE(
        SUM(credit_amount),
        0
      ) AS total_credits

    FROM tbl_finance_member_ledger
    `,

    []
  );
}

/* =========================================================
   LEDGER DAILY SUMMARY
========================================================= */

async function getLedgerDailySummary() {

  return findMany(

    pool,

    `
    SELECT

      DATE(transaction_date) AS transaction_day,

      COUNT(*) AS total_entries,

      COALESCE(
        SUM(debit_amount),
        0
      ) AS total_debits,

      COALESCE(
        SUM(credit_amount),
        0
      ) AS total_credits

    FROM tbl_finance_member_ledger

    GROUP BY DATE(transaction_date)

    ORDER BY transaction_day DESC
    `,

    []
  );
}

/* =========================================================
   UNMATCHED LEDGER ITEMS
========================================================= */

async function getUnmatchedLedgerItems(
  reconciliationId
) {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_finance_reconciliation_items

    WHERE reconciliation_id = ?
      AND source_type = 'ledger'
      AND status != 'matched'

    ORDER BY
      transaction_date ASC,
      id ASC
    `,

    [reconciliationId]
  );
}

/* =========================================================
   FIND BALANCE DISCREPANCIES
========================================================= */

async function findLedgerDiscrepancies() {

  return findMany(

    pool,

    `
    SELECT

      member_id,

      COUNT(*) AS entries,

      COALESCE(
        SUM(credit_amount),
        0
      ) -
      COALESCE(
        SUM(debit_amount),
        0
      ) AS calculated_balance,

      MAX(balance_after) AS latest_balance

    FROM tbl_finance_member_ledger

    GROUP BY member_id

    HAVING calculated_balance != latest_balance

    ORDER BY member_id ASC
    `,

    []
  );
}

/* =========================================================
   GET LEDGER ENTRY
========================================================= */

async function getLedgerEntry(
  ledgerId
) {

  return findOne(

    pool,

    `
    SELECT *

    FROM tbl_finance_member_ledger

    WHERE id = ?

    LIMIT 1
    `,

    [ledgerId]
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  importLedgerEntries,

  getLedgerBalanceSummary,

  getLedgerDailySummary,

  getUnmatchedLedgerItems,

  findLedgerDiscrepancies,

  getLedgerEntry,
};