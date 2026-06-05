// backend/services/domains/reconciliation/zelleReconciliationService.js
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

} = require(
  "../../../utils/dbHelpers"
);

const {

  money,

} = require(
  "../../../utils/financeHelpers"
);

/* =========================================================
   IMPORT ZELLE PAYMENTS
========================================================= */

async function importZellePayments(
  reconciliationId
) {

  const rows =
    await findMany(

      pool,

      `
      SELECT

        id,

        zelle_reference,

        full_name,

        amount,

        payment_date,

        notes

      FROM tbl_finance_zelle_entries

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
        "zelle_payment",

      source_type:
        "zelle",

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
        Zelle:
        ${row.full_name || ""}
        ${row.zelle_reference || ""}
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
   FIND DUPLICATES
========================================================= */

async function detectDuplicateZelleEntries() {

  return findMany(

    pool,

    `
    SELECT

      zelle_reference,

      COUNT(*) AS total,

      SUM(amount) AS total_amount

    FROM tbl_finance_zelle_entries

    WHERE zelle_reference IS NOT NULL
      AND zelle_reference != ''

    GROUP BY zelle_reference

    HAVING COUNT(*) > 1

    ORDER BY total DESC
    `,

    []
  );
}

/* =========================================================
   UNMATCHED ZELLE ENTRIES
========================================================= */

async function getUnmatchedZelleItems(
  reconciliationId
) {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_finance_reconciliation_items

    WHERE reconciliation_id = ?
      AND source_type = 'zelle'
      AND status != 'matched'

    ORDER BY
      transaction_date ASC,
      id ASC
    `,

    [reconciliationId]
  );
}

/* =========================================================
   ZELLE SUMMARY
========================================================= */

async function getZelleSummary() {

  const rows =
    await findMany(

      pool,

      `
      SELECT

        DATE(payment_date) AS payment_day,

        COUNT(*) AS transactions,

        COALESCE(
          SUM(amount),
          0
        ) AS total_amount

      FROM tbl_finance_zelle_entries

      GROUP BY DATE(payment_date)

      ORDER BY payment_day DESC
      `,

      []
    );

  return rows;
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  importZellePayments,

  detectDuplicateZelleEntries,

  getUnmatchedZelleItems,

  getZelleSummary,
};