// backend/services/domains/reconciliation/donationReconciliationService.js
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
   IMPORT DONATIONS
========================================================= */

async function importDonations(
  reconciliationId
) {

  const rows =
    await findMany(

      pool,

      `
      SELECT

        p.id,

        p.payment_number,

        p.member_id,

        p.full_name_snapshot,

        p.sub_category,

        p.amount,

        p.method,

        p.provider,

        p.status,

        p.paid_at

      FROM tbl_finance_payments p

      WHERE p.category = 'donation'
        AND p.status = 'paid'

      ORDER BY p.paid_at DESC
      `,

      []
    );

  let imported = 0;

  for (const row of rows) {

    await createReconciliationItem({

      reconciliation_id:
        reconciliationId,

      item_type:
        "donation",

      source_type:
        "donation",

      source_id:
        row.id,

      transaction_date:
        row.paid_at,

      amount:
        money(
          row.amount
        ),

      description:
        `
        Donation:
        ${row.full_name_snapshot || ""}
        ${row.payment_number || ""}
        ${row.sub_category || ""}
        `.trim(),

      status:
        "unmatched",

      notes:
        `
        Method:
        ${row.method || ""}

        Provider:
        ${row.provider || ""}
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
   DONATION CATEGORY SUMMARY
========================================================= */

async function getDonationCategorySummary() {

  return findMany(

    pool,

    `
    SELECT

      sub_category,

      COUNT(*) AS transactions,

      COALESCE(
        SUM(amount),
        0
      ) AS total_amount

    FROM tbl_finance_payments

    WHERE category = 'donation'
      AND status = 'paid'

    GROUP BY sub_category

    ORDER BY total_amount DESC
    `,

    []
  );
}

/* =========================================================
   DONATION DAILY SUMMARY
========================================================= */

async function getDonationDailySummary() {

  return findMany(

    pool,

    `
    SELECT

      DATE(paid_at) AS donation_day,

      COUNT(*) AS transactions,

      COALESCE(
        SUM(amount),
        0
      ) AS total_amount

    FROM tbl_finance_payments

    WHERE category = 'donation'
      AND status = 'paid'

    GROUP BY DATE(paid_at)

    ORDER BY donation_day DESC
    `,

    []
  );
}

/* =========================================================
   DONATION PROVIDER SUMMARY
========================================================= */

async function getDonationProviderSummary() {

  return findMany(

    pool,

    `
    SELECT

      provider,

      COUNT(*) AS transactions,

      COALESCE(
        SUM(amount),
        0
      ) AS total_amount

    FROM tbl_finance_payments

    WHERE category = 'donation'
      AND status = 'paid'

    GROUP BY provider

    ORDER BY total_amount DESC
    `,

    []
  );
}

/* =========================================================
   UNMATCHED DONATION ITEMS
========================================================= */

async function getUnmatchedDonationItems(
  reconciliationId
) {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_finance_reconciliation_items

    WHERE reconciliation_id = ?
      AND source_type = 'donation'
      AND status != 'matched'

    ORDER BY
      transaction_date ASC,
      id ASC
    `,

    [reconciliationId]
  );
}

/* =========================================================
   FIND DUPLICATE DONATIONS
========================================================= */

async function findDuplicateDonations() {

  return findMany(

    pool,

    `
    SELECT

      payment_number,

      COUNT(*) AS total,

      COALESCE(
        SUM(amount),
        0
      ) AS total_amount

    FROM tbl_finance_payments

    WHERE category = 'donation'

    GROUP BY payment_number

    HAVING COUNT(*) > 1

    ORDER BY total DESC
    `,

    []
  );
}

/* =========================================================
   GET DONATION ENTRY
========================================================= */

async function getDonationEntry(
  paymentId
) {

  return findOne(

    pool,

    `
    SELECT *

    FROM tbl_finance_payments

    WHERE id = ?
      AND category = 'donation'

    LIMIT 1
    `,

    [paymentId]
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  importDonations,

  getDonationCategorySummary,

  getDonationDailySummary,

  getDonationProviderSummary,

  getUnmatchedDonationItems,

  findDuplicateDonations,

  getDonationEntry,
};