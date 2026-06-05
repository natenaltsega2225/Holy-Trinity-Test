// backend/services/domains/reports/memberStatementService.js
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
   MEMBER SUMMARY
========================================================= */

async function getMemberFinancialSummary(
  memberId
) {

  const summary =
    await findOne(

      pool,

      `
      SELECT

        COUNT(*) AS transactions,

        COALESCE(
          SUM(amount),
          0
        ) AS totalPaid,

        COALESCE(
          SUM(
            CASE
              WHEN category = 'donation'
              THEN amount
              ELSE 0
            END
          ),
          0
        ) AS donations,

        COALESCE(
          SUM(
            CASE
              WHEN category = 'membership'
              THEN amount
              ELSE 0
            END
          ),
          0
        ) AS membershipPayments,

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
        ) AS programPayments

      FROM tbl_finance_payments

      WHERE member_id = ?
        AND status = 'paid'
      `,

      [memberId]
    );

  return {

    transactions:
      Number(
        summary?.transactions || 0
      ),

    totalPaid:
      money(
        summary?.totalPaid || 0
      ),

    donations:
      money(
        summary?.donations || 0
      ),

    membershipPayments:
      money(
        summary?.membershipPayments || 0
      ),

    programPayments:
      money(
        summary?.programPayments || 0
      ),
  };
}

/* =========================================================
   MEMBER PAYMENTS
========================================================= */

async function getMemberPayments(
  memberId
) {

  return findMany(

    pool,

    `
    SELECT

      p.id,

      p.payment_number,

      p.category,
      p.sub_category,

      p.amount,

      p.method,
      p.provider,

      p.status,

      p.coverage_label,

      p.paid_at,

      r.receipt_number,

      i.invoice_number

    FROM tbl_finance_payments p

    LEFT JOIN tbl_finance_receipts r
      ON r.payment_id = p.id

    LEFT JOIN tbl_finance_invoices i
      ON i.payment_id = p.id

    WHERE p.member_id = ?

    ORDER BY
      p.paid_at DESC,
      p.id DESC
    `,

    [memberId]
  );
}

/* =========================================================
   DONATION HISTORY
========================================================= */

async function getMemberDonationHistory(
  memberId
) {

  return findMany(

    pool,

    `
    SELECT

      p.id,

      p.payment_number,

      p.sub_category AS donation_category,

      p.amount,

      p.method,

      p.paid_at,

      r.receipt_number

    FROM tbl_finance_payments p

    LEFT JOIN tbl_finance_receipts r
      ON r.payment_id = p.id

    WHERE p.member_id = ?
      AND p.category = 'donation'
      AND p.status = 'paid'

    ORDER BY
      p.paid_at DESC
    `,

    [memberId]
  );
}

/* =========================================================
   MEMBERSHIP HISTORY
========================================================= */

async function getMembershipHistory(
  memberId
) {

  return findMany(

    pool,

    `
    SELECT

      payment_number,

      amount,

      months_paid,

      coverage_start,
      coverage_end,
      coverage_label,

      paid_at

    FROM tbl_finance_payments

    WHERE member_id = ?
      AND category = 'membership'
      AND status = 'paid'

    ORDER BY
      paid_at DESC
    `,

    [memberId]
  );
}

/* =========================================================
   ANNUAL GIVING
========================================================= */

async function getAnnualGivingStatement(

  memberId,

  year
) {

  const safeYear =
    Number(year);

  return findMany(

    pool,

    `
    SELECT

      p.payment_number,

      p.sub_category,

      p.amount,

      p.paid_at,

      r.receipt_number

    FROM tbl_finance_payments p

    LEFT JOIN tbl_finance_receipts r
      ON r.payment_id = p.id

    WHERE p.member_id = ?
      AND p.category = 'donation'
      AND p.status = 'paid'
      AND YEAR(p.paid_at) = ?

    ORDER BY
      p.paid_at ASC
    `,

    [
      memberId,
      safeYear,
    ]
  );
}

/* =========================================================
   FULL MEMBER STATEMENT
========================================================= */

async function getFullMemberStatement(
  memberId
) {

  const [

    summary,

    payments,

    donations,

    memberships,

  ] = await Promise.all([

    getMemberFinancialSummary(
      memberId
    ),

    getMemberPayments(
      memberId
    ),

    getMemberDonationHistory(
      memberId
    ),

    getMembershipHistory(
      memberId
    ),
  ]);

  return {

    summary,

    payments,

    donations,

    memberships,
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  getMemberFinancialSummary,

  getMemberPayments,

  getMemberDonationHistory,

  getMembershipHistory,

  getAnnualGivingStatement,

  getFullMemberStatement,
};