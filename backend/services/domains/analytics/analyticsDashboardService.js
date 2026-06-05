// backend/services/domains/analytics/analyticsDashboardService.js
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
   DATE HELPERS
========================================================= */

function currentYear() {

  return new Date()
    .getFullYear();
}

function currentMonth() {

  return new Date()
    .getMonth() + 1;
}

/* =========================================================
   REVENUE KPI
========================================================= */

async function getRevenueKpis() {

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
          AVG(amount),
          0
        ) AS average_payment,

        COALESCE(
          MAX(amount),
          0
        ) AS largest_payment

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

    average_payment:
      money(
        row?.average_payment || 0
      ),

    largest_payment:
      money(
        row?.largest_payment || 0
      ),
  };
}

/* =========================================================
   MONTHLY REVENUE TREND
========================================================= */

async function getMonthlyRevenueTrend() {

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

    ORDER BY month_key ASC
    `,

    []
  );
}

/* =========================================================
   PAYMENT METHOD ANALYTICS
========================================================= */

async function getPaymentMethodAnalytics() {

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
   DONATION ANALYTICS
========================================================= */

async function getDonationAnalytics() {

  return findMany(

    pool,

    `
    SELECT

      sub_category,

      COUNT(*) AS donations,

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
   MEMBERSHIP ANALYTICS
========================================================= */

async function getMembershipAnalytics() {

  const row =
    await findOne(

      pool,

      `
      SELECT

        COUNT(*) AS total_members,

        SUM(
          CASE
            WHEN membership_status = 'active'
            THEN 1
            ELSE 0
          END
        ) AS active_members,

        SUM(
          CASE
            WHEN membership_status = 'expired'
            THEN 1
            ELSE 0
          END
        ) AS expired_members

      FROM tbl_members
      `,

      []
    );

  return {

    total_members:
      Number(
        row?.total_members || 0
      ),

    active_members:
      Number(
        row?.active_members || 0
      ),

    expired_members:
      Number(
        row?.expired_members || 0
      ),
  };
}

/* =========================================================
   MEMBER GROWTH TREND
========================================================= */

async function getMemberGrowthTrend() {

  return findMany(

    pool,

    `
    SELECT

      DATE_FORMAT(
        created_at,
        '%Y-%m'
      ) AS month_key,

      COUNT(*) AS registrations

    FROM tbl_members

    GROUP BY
      DATE_FORMAT(
        created_at,
        '%Y-%m'
      )

    ORDER BY month_key ASC
    `,

    []
  );
}

/* =========================================================
   EVENT ANALYTICS
========================================================= */

async function getEventAnalytics() {

  return findMany(

    pool,

    `
    SELECT

      e.category,

      COUNT(r.id) AS registrations,

      COALESCE(
        SUM(r.amount_paid),
        0
      ) AS revenue

    FROM tbl_news_events e

    LEFT JOIN tbl_event_program_registrations r
      ON r.event_id = e.id

    GROUP BY e.category

    ORDER BY revenue DESC
    `,

    []
  );
}

/* =========================================================
   VOLUNTEER ANALYTICS
========================================================= */

async function getVolunteerAnalytics() {

  return findOne(

    pool,

    `
    SELECT

      COUNT(*) AS entries,

      COALESCE(
        SUM(total_hours),
        0
      ) AS total_hours,

      COALESCE(
        AVG(total_hours),
        0
      ) AS avg_hours

    FROM tbl_volunteer_hours
    `,

    []
  );
}

/* =========================================================
   INVOICE ANALYTICS
========================================================= */

async function getInvoiceAnalytics() {

  return findOne(

    pool,

    `
    SELECT

      COUNT(*) AS invoices,

      COALESCE(
        SUM(total_amount),
        0
      ) AS total_invoiced,

      COALESCE(
        SUM(balance_due),
        0
      ) AS total_balance_due

    FROM tbl_finance_invoices
    `,

    []
  );
}

/* =========================================================
   RECEIPT ANALYTICS
========================================================= */

async function getReceiptAnalytics() {

  return findMany(

    pool,

    `
    SELECT

      email_status,

      COUNT(*) AS total

    FROM tbl_finance_receipts

    GROUP BY email_status
    `,

    []
  );
}

/* =========================================================
   EXECUTIVE DASHBOARD
========================================================= */

async function getExecutiveDashboard() {

  const [

    revenue,

    paymentMethods,

    donations,

    membership,

    growth,

    events,

    volunteers,

    invoices,

    receipts,

  ] = await Promise.all([

    getRevenueKpis(),

    getPaymentMethodAnalytics(),

    getDonationAnalytics(),

    getMembershipAnalytics(),

    getMemberGrowthTrend(),

    getEventAnalytics(),

    getVolunteerAnalytics(),

    getInvoiceAnalytics(),

    getReceiptAnalytics(),
  ]);

  return {

    revenue,

    payment_methods:
      paymentMethods,

    donations,

    membership,

    member_growth:
      growth,

    events,

    volunteers,

    invoices,

    receipts,
  };
}

/* =========================================================
   CURRENT MONTH SUMMARY
========================================================= */

async function getCurrentMonthSummary() {

  const row =
    await findOne(

      pool,

      `
      SELECT

        COUNT(*) AS transactions,

        COALESCE(
          SUM(amount),
          0
        ) AS revenue

      FROM tbl_finance_payments

      WHERE status = 'paid'
        AND YEAR(paid_at) = ?
        AND MONTH(paid_at) = ?
      `,

      [

        currentYear(),

        currentMonth(),
      ]
    );

  return {

    transactions:
      Number(
        row?.transactions || 0
      ),

    revenue:
      money(
        row?.revenue || 0
      ),
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  getRevenueKpis,

  getMonthlyRevenueTrend,

  getPaymentMethodAnalytics,

  getDonationAnalytics,

  getMembershipAnalytics,

  getMemberGrowthTrend,

  getEventAnalytics,

  getVolunteerAnalytics,

  getInvoiceAnalytics,

  getReceiptAnalytics,

  getExecutiveDashboard,

  getCurrentMonthSummary,
};