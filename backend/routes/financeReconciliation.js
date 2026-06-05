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
   SUMMARY
========================================================= */

router.get(
  "/summary",

  async (_req, res) => {

    try {

      /* =====================================
         PAYMENTS
      ===================================== */

      const [[payments]] =
        await pool.query(
          `
          SELECT
            COUNT(*) AS total_payments,
            SUM(amount) AS total_amount
          FROM tbl_finance_payments
          WHERE status = 'paid'
          `
        );

      /* =====================================
         MISSING RECEIPTS
      ===================================== */

      const [[missingReceipts]] =
        await pool.query(
          `
          SELECT COUNT(*) AS count
          FROM tbl_finance_payments p
          LEFT JOIN tbl_finance_receipts r
            ON r.payment_id = p.id
          WHERE r.id IS NULL
          `
        );

      /* =====================================
         MISSING INVOICES
      ===================================== */

      const [[missingInvoices]] =
        await pool.query(
          `
          SELECT COUNT(*) AS count
          FROM tbl_finance_payments p
          LEFT JOIN tbl_finance_invoices i
            ON i.payment_id = p.id
          WHERE i.id IS NULL
          `
        );

      /* =====================================
         MISSING LEDGER
      ===================================== */

      const [[missingLedger]] =
        await pool.query(
          `
          SELECT COUNT(*) AS count
          FROM tbl_finance_payments p
          LEFT JOIN tbl_finance_member_ledger l
            ON l.payment_id = p.id
          WHERE l.id IS NULL
          `
        );

      /* =====================================
         FAILED RECEIPT EMAILS
      ===================================== */

      const [[failedEmails]] =
        await pool.query(
          `
          SELECT COUNT(*) AS count
          FROM tbl_finance_receipts
          WHERE email_status = 'failed'
          `
        );

      /* =====================================
         DUPLICATE STRIPE PAYMENTS
      ===================================== */

      const [duplicates] =
        await pool.query(
          `
          SELECT

            stripe_payment_intent_id,

            COUNT(*) AS duplicate_count,

            SUM(amount) AS total_amount

          FROM tbl_finance_payments

          WHERE stripe_payment_intent_id IS NOT NULL

          GROUP BY stripe_payment_intent_id

          HAVING COUNT(*) > 1
          `
        );

      return res.json({

        ok: true,

        summary: {

          total_payments:
            money(
              payments.total_payments
            ),

          total_amount:
            money(
              payments.total_amount
            ),

          missing_receipts:
            money(
              missingReceipts.count
            ),

          missing_invoices:
            money(
              missingInvoices.count
            ),

          missing_ledger:
            money(
              missingLedger.count
            ),

          failed_receipt_emails:
            money(
              failedEmails.count
            ),

          duplicate_payments:
            duplicates.length,
        },

        duplicates,
      });

    } catch (err) {

      console.error(
        "GET /finance-reconciliation/summary error:",
        err
      );

      return res.status(500).json({

        error:
          "Failed to load reconciliation summary.",
      });
    }
  }
);

/* =========================================================
   MISSING RECEIPTS
========================================================= */

router.get(
  "/missing-receipts",

  async (_req, res) => {

    try {

      const [rows] =
        await pool.query(
          `
          SELECT

            p.id,
            p.payment_number,

            p.full_name_snapshot,

            p.category,
            p.sub_category,

            p.amount,

            p.created_at

          FROM tbl_finance_payments p

          LEFT JOIN tbl_finance_receipts r
            ON r.payment_id = p.id

          WHERE r.id IS NULL

          ORDER BY p.created_at DESC
          `
        );

      return res.json({

        ok: true,

        rows,
      });

    } catch (err) {

      console.error(
        "GET /missing-receipts error:",
        err
      );

      return res.status(500).json({

        error:
          "Failed to load missing receipts.",
      });
    }
  }
);

/* =========================================================
   FAILED EMAILS
========================================================= */

router.get(
  "/failed-emails",

  async (_req, res) => {

    try {

      const [rows] =
        await pool.query(
          `
          SELECT

            r.id,
            r.receipt_number,

            r.email_status,
            r.email_error,

            r.emailed_to,
            r.updated_at,

            p.payment_number,
            p.full_name_snapshot,

            p.amount

          FROM tbl_finance_receipts r

          INNER JOIN tbl_finance_payments p
            ON p.id = r.payment_id

          WHERE r.email_status = 'failed'

          ORDER BY r.updated_at DESC
          `
        );

      return res.json({

        ok: true,

        rows,
      });

    } catch (err) {

      console.error(
        "GET /failed-emails error:",
        err
      );

      return res.status(500).json({

        error:
          "Failed to load failed emails.",
      });
    }
  }
);

module.exports =
  router;