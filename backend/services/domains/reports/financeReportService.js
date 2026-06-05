// backend/services/domains/reports/financeReportService.js
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

  clean,

  money,

} = require(
  "../../../utils/financeHelpers"
);

/* =========================================================
   BUILD DATE FILTERS
========================================================= */

function buildDateFilters(
  filters = {}
) {

  const params = [];
  const where = [
    `p.status = 'paid'`,
  ];

  const startDate =
    clean(
      filters.start_date
    );

  const endDate =
    clean(
      filters.end_date
    );

  if (startDate) {

    where.push(
      "DATE(p.paid_at) >= ?"
    );

    params.push(
      startDate
    );
  }

  if (endDate) {

    where.push(
      "DATE(p.paid_at) <= ?"
    );

    params.push(
      endDate
    );
  }

  return {

    whereSql:
      where.length
        ? `WHERE ${where.join(
            " AND "
          )}`
        : "",

    params,
  };
}

/* =========================================================
   REVENUE SUMMARY
========================================================= */

async function getRevenueSummary(
  filters = {}
) {

  const {

    whereSql,

    params,

  } = buildDateFilters(
    filters
  );

  const summary =
    await findOne(

      pool,

      `
      SELECT

        COUNT(*) AS transactions,

        COALESCE(
          SUM(p.amount),
          0
        ) AS totalRevenue,

        COALESCE(
          SUM(
            CASE
              WHEN p.category = 'membership'
              THEN p.amount
              ELSE 0
            END
          ),
          0
        ) AS membershipRevenue,

        COALESCE(
          SUM(
            CASE
              WHEN p.category = 'donation'
              THEN p.amount
              ELSE 0
            END
          ),
          0
        ) AS donationRevenue,

        COALESCE(
          SUM(
            CASE
              WHEN p.category = 'school'
              THEN p.amount
              ELSE 0
            END
          ),
          0
        ) AS schoolRevenue,

        COALESCE(
          SUM(
            CASE
              WHEN p.category = 'trip'
              THEN p.amount
              ELSE 0
            END
          ),
          0
        ) AS tripRevenue

      FROM tbl_finance_payments p

      ${whereSql}
      `,

      params
    );

  return {

    transactions:
      Number(
        summary?.transactions || 0
      ),

    totalRevenue:
      money(
        summary?.totalRevenue || 0
      ),

    membershipRevenue:
      money(
        summary?.membershipRevenue || 0
      ),

    donationRevenue:
      money(
        summary?.donationRevenue || 0
      ),

    schoolRevenue:
      money(
        summary?.schoolRevenue || 0
      ),

    tripRevenue:
      money(
        summary?.tripRevenue || 0
      ),
  };
}

/* =========================================================
   DONATION REPORT
========================================================= */

async function getDonationReport(
  filters = {}
) {

  const {

    whereSql,

    params,

  } = buildDateFilters(
    filters
  );

  return findMany(

    pool,

    `
    SELECT

      p.id,

      p.payment_number,

      p.full_name_snapshot,

      p.email_snapshot,

      p.sub_category AS donation_category,

      p.amount,

      p.method,
      p.provider,

      p.reference_no,

      p.created_at,
      p.paid_at

    FROM tbl_finance_payments p

    ${whereSql}

      AND p.category = 'donation'

    ORDER BY
      p.paid_at DESC,
      p.id DESC
    `,

    params
  );
}

/* =========================================================
   MEMBERSHIP REPORT
========================================================= */

async function getMembershipReport(
  filters = {}
) {

  const {

    whereSql,

    params,

  } = buildDateFilters(
    filters
  );

  return findMany(

    pool,

    `
    SELECT

      p.id,

      p.payment_number,

      p.member_id,
      p.member_no,

      p.full_name_snapshot,

      p.amount,

      p.months_paid,

      p.coverage_start,
      p.coverage_end,
      p.coverage_label,

      p.method,
      p.provider,

      p.created_at,
      p.paid_at

    FROM tbl_finance_payments p

    ${whereSql}

      AND p.category = 'membership'

    ORDER BY
      p.paid_at DESC,
      p.id DESC
    `,

    params
  );
}

/* =========================================================
   PROGRAM REPORT
========================================================= */

async function getProgramReport(
  filters = {}
) {

  const {

    whereSql,

    params,

  } = buildDateFilters(
    filters
  );

  return findMany(

    pool,

    `
    SELECT

      p.id,

      p.payment_number,

      p.category,
      p.sub_category,

      p.full_name_snapshot,

      p.amount,

      p.quantity,

      p.method,
      p.provider,

      p.created_at,
      p.paid_at

    FROM tbl_finance_payments p

    ${whereSql}

      AND p.category IN (
        'school',
        'trip'
      )

    ORDER BY
      p.paid_at DESC,
      p.id DESC
    `,

    params
  );
}

/* =========================================================
   FAILED RECEIPTS REPORT
========================================================= */

async function getFailedReceiptReport() {

  return findMany(

    pool,

    `
    SELECT

      r.id,
      r.receipt_number,

      r.email_status,
      r.email_error,

      r.emailed_to,

      p.payment_number,

      p.full_name_snapshot,

      p.amount,

      r.updated_at

    FROM tbl_finance_receipts r

    INNER JOIN tbl_finance_payments p
      ON p.id = r.payment_id

    WHERE r.email_status = 'failed'

    ORDER BY
      r.updated_at DESC
    `,

    []
  );
}

/* =========================================================
   PAYMENT METHOD REPORT
========================================================= */

async function getPaymentMethodReport(
  filters = {}
) {

  const {

    whereSql,

    params,

  } = buildDateFilters(
    filters
  );

  return findMany(

    pool,

    `
    SELECT

      p.method,

      p.provider,

      COUNT(*) AS transactions,

      COALESCE(
        SUM(p.amount),
        0
      ) AS total

    FROM tbl_finance_payments p

    ${whereSql}

    GROUP BY
      p.method,
      p.provider

    ORDER BY
      total DESC
    `,

    params
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  getRevenueSummary,

  getDonationReport,

  getMembershipReport,

  getProgramReport,

  getFailedReceiptReport,

  getPaymentMethodReport,
};