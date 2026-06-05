
// //backend\routes\financeDashboard.js
"use strict";

const express =
  require("express");

const pool =
  require("../db");

const {

  authRequired,
  requireRole,

} = require(
  "../middleware/auth"
);

const router =
  express.Router();

/* =========================================================
   SECURITY
========================================================= */

router.use(
  authRequired
);

router.use(

  requireRole(
    "finance",
    "admin",
    "super_admin"
  )
);

/* =========================================================
   HELPERS
========================================================= */

function money(
  value
) {

  return Number(
    value || 0
  );
}

/* =========================================================
   DASHBOARD SUMMARY
========================================================= */

router.get(
  "/dashboard",
  async (_req, res) => {

    try {

      /* =====================================
         TOTAL PAYMENTS
      ===================================== */

      const [[payments]] =
        await pool.query(
          `
          SELECT

            COUNT(*) AS total_transactions,

            COALESCE(
              SUM(amount),
              0
            ) AS total_amount

          FROM tbl_finance_payments

          WHERE status = 'paid'
          `
        );

      /* =====================================
         MEMBERSHIP
      ===================================== */

      const [[membership]] =
        await pool.query(
          `
          SELECT

            COUNT(*) AS total_membership_payments,

            COALESCE(
              SUM(amount),
              0
            ) AS membership_amount

          FROM tbl_finance_payments

          WHERE category = 'membership'
            AND status = 'paid'
          `
        );

      /* =====================================
         DONATIONS
      ===================================== */

      const [[donations]] =
        await pool.query(
          `
          SELECT

            COUNT(*) AS total_donations,

            COALESCE(
              SUM(amount),
              0
            ) AS donation_amount

          FROM tbl_finance_payments

          WHERE category = 'donation'
            AND status = 'paid'
          `
        );

      /* =====================================
         SCHOOL
      ===================================== */

      const [[school]] =
        await pool.query(
          `
          SELECT

            COUNT(*) AS total_school_payments,

            COALESCE(
              SUM(amount),
              0
            ) AS school_amount

          FROM tbl_finance_payments

          WHERE category = 'school'
            AND status = 'paid'
          `
        );

      /* =====================================
         TRIP
      ===================================== */

      const [[trip]] =
        await pool.query(
          `
          SELECT

            COUNT(*) AS total_trip_payments,

            COALESCE(
              SUM(amount),
              0
            ) AS trip_amount

          FROM tbl_finance_payments

          WHERE category = 'trip'
            AND status = 'paid'
          `
        );

      /* =====================================
         RECEIPTS
      ===================================== */

      const [[receipts]] =
        await pool.query(
          `
          SELECT

            COUNT(*) AS total_receipts,

            SUM(
              CASE
                WHEN email_status = 'sent'
                THEN 1
                ELSE 0
              END
            ) AS emailed_receipts,

            SUM(
              CASE
                WHEN email_status = 'failed'
                THEN 1
                ELSE 0
              END
            ) AS failed_receipts

          FROM tbl_finance_receipts
          `
        );

      /* =====================================
         OUTSTANDING BALANCE
      ===================================== */

      const [[balances]] =
        await pool.query(
          `
          SELECT

            COALESCE(
              SUM(balance_due),
              0
            ) AS outstanding_balance

          FROM tbl_finance_invoices

          WHERE balance_due > 0
          `
        );

      /* =====================================
         MONTHLY TREND
      ===================================== */

      const [monthlyTrend] =
        await pool.query(
          `
          SELECT

            DATE_FORMAT(
              paid_at,
              '%Y-%m'
            ) AS month,

            COUNT(*) AS transactions,

            SUM(amount) AS amount

          FROM tbl_finance_payments

          WHERE status = 'paid'

          GROUP BY
            DATE_FORMAT(
              paid_at,
              '%Y-%m'
            )

          ORDER BY month DESC

          LIMIT 12
          `
        );

      /* =====================================
         RECENT PAYMENTS
      ===================================== */

      const [recentPayments] =
        await pool.query(
          `
          SELECT

            p.id,

            p.payment_number,

            p.full_name_snapshot,

            p.category,
            p.sub_category,

            p.amount,

            p.method,
            p.provider,

            p.created_at,

            r.receipt_number

          FROM tbl_finance_payments p

          LEFT JOIN tbl_finance_receipts r
            ON r.payment_id = p.id

          ORDER BY
            p.created_at DESC

          LIMIT 10
          `
        );

      return res.json({

        ok: true,

        summary: {

          total_transactions:
            money(
              payments.total_transactions
            ),

          total_amount:
            money(
              payments.total_amount
            ),

          outstanding_balance:
            money(
              balances.outstanding_balance
            ),

          membership: {

            transactions:
              money(
                membership.total_membership_payments
              ),

            amount:
              money(
                membership.membership_amount
              ),
          },

          donations: {

            transactions:
              money(
                donations.total_donations
              ),

            amount:
              money(
                donations.donation_amount
              ),
          },

          school: {

            transactions:
              money(
                school.total_school_payments
              ),

            amount:
              money(
                school.school_amount
              ),
          },

          trip: {

            transactions:
              money(
                trip.total_trip_payments
              ),

            amount:
              money(
                trip.trip_amount
              ),
          },

          receipts: {

            total:
              money(
                receipts.total_receipts
              ),

            emailed:
              money(
                receipts.emailed_receipts
              ),

            failed:
              money(
                receipts.failed_receipts
              ),
          },
        },

        monthlyTrend,

        recentPayments,
      });

    } catch (err) {

      console.error(
        "GET /finance-dashboard/summary error:",
        err
      );

      return res.status(500).json({

        error:
          "Failed to load finance dashboard.",
      });
    }
  }
);

module.exports =
  router;