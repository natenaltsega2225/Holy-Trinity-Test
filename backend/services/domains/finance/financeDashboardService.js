// backend/services/domains/finance/financeDashboardService.js
"use strict";

const pool =
  require("../../../db");

const {

  findOne,

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
   KPI SUMMARY
========================================================= */

async function getFinanceKpis() {

  const row =
    await findOne(

      pool,

      `
      SELECT

        COUNT(*) AS total_transactions,

        COALESCE(
          SUM(amount),
          0
        ) AS total_revenue,

        COALESCE(
          SUM(
            CASE
              WHEN category = 'membership'
              THEN amount
              ELSE 0
            END
          ),
          0
        ) AS membership_total,

        COALESCE(
          SUM(
            CASE
              WHEN category = 'donation'
              THEN amount
              ELSE 0
            END
          ),
          0
        ) AS donation_total,

        COALESCE(
          SUM(
            CASE
              WHEN category IN (
                'school',
                'trip'
              )
              THEN amount
              ELSE 0
            END
          ),
          0
        ) AS program_total

      FROM tbl_finance_payments

      WHERE status = 'paid'
      `,

      []
    );

  return {

    total_transactions:
      Number(
        row?.total_transactions || 0
      ),

    total_revenue:
      money(
        row?.total_revenue || 0
      ),

    membership_total:
      money(
        row?.membership_total || 0
      ),

    donation_total:
      money(
        row?.donation_total || 0
      ),

    program_total:
      money(
        row?.program_total || 0
      ),
  };
}

/* =========================================================
   PAYMENT METHOD SUMMARY
========================================================= */

async function getPaymentMethodSummary() {

  return findMany(

    pool,

    `
    SELECT

      method,

      provider,

      COUNT(*) AS transactions,

      COALESCE(
        SUM(amount),
        0
      ) AS total_amount

    FROM tbl_finance_payments

    WHERE status = 'paid'

    GROUP BY
      method,
      provider

    ORDER BY total_amount DESC
    `,

    []
  );
}

/* =========================================================
   MONTHLY REVENUE
========================================================= */

async function getMonthlyRevenue() {

  return findMany(

    pool,

    `
    SELECT

      DATE_FORMAT(
        paid_at,
        '%Y-%m'
      ) AS month_key,

      COUNT(*) AS transactions,

      COALESCE(
        SUM(amount),
        0
      ) AS total_amount

    FROM tbl_finance_payments

    WHERE status = 'paid'

    GROUP BY
      DATE_FORMAT(
        paid_at,
        '%Y-%m'
      )

    ORDER BY month_key DESC
    `,

    []
  );
}

/* =========================================================
   CATEGORY BREAKDOWN
========================================================= */

async function getCategoryBreakdown() {

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

    FROM tbl_finance_payments

    WHERE status = 'paid'

    GROUP BY category

    ORDER BY total_amount DESC
    `,

    []
  );
}

/* =========================================================
   RECENT PAYMENTS
========================================================= */

async function getRecentPayments(
  limit = 10
) {

  return findMany(

    pool,

    `
    SELECT

      id,

      payment_number,

      category,

      sub_category,

      full_name_snapshot,

      amount,

      method,

      provider,

      paid_at

    FROM tbl_finance_payments

    WHERE status = 'paid'

    ORDER BY
      paid_at DESC,
      id DESC

    LIMIT ?
    `,

    [Number(limit)]
  );
}

/* =========================================================
   FAILED RECEIPTS
========================================================= */

async function getFailedReceiptCount() {

  const row =
    await findOne(

      pool,

      `
      SELECT

        COUNT(*) AS total

      FROM tbl_finance_receipts

      WHERE email_status = 'failed'
      `,

      []
    );

  return Number(
    row?.total || 0
  );
}

/* =========================================================
   OVERDUE INVOICES
========================================================= */

async function getOverdueInvoiceSummary() {

  const row =
    await findOne(

      pool,

      `
      SELECT

        COUNT(*) AS invoices,

        COALESCE(
          SUM(balance_due),
          0
        ) AS total_balance_due

      FROM tbl_finance_invoices

      WHERE due_date < CURDATE()
        AND balance_due > 0
      `,

      []
    );

  return {

    invoices:
      Number(
        row?.invoices || 0
      ),

    total_balance_due:
      money(
        row?.total_balance_due || 0
      ),
  };
}

/* =========================================================
   DASHBOARD SUMMARY
========================================================= */

async function getFinanceDashboardSummary() {

  const [

    kpis,

    methods,

    monthly,

    categories,

    recent,

    failedReceipts,

    overdueInvoices,

  ] = await Promise.all([

    getFinanceKpis(),

    getPaymentMethodSummary(),

    getMonthlyRevenue(),

    getCategoryBreakdown(),

    getRecentPayments(),

    getFailedReceiptCount(),

    getOverdueInvoiceSummary(),
  ]);

  return {

    kpis,

    methods,

    monthly,

    categories,

    recent,

    failed_receipts:
      failedReceipts,

    overdue_invoices:
      overdueInvoices,
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  getFinanceKpis,

  getPaymentMethodSummary,

  getMonthlyRevenue,

  getCategoryBreakdown,

  getRecentPayments,

  getFailedReceiptCount,

  getOverdueInvoiceSummary,

  getFinanceDashboardSummary,
};