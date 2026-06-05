// backend/routes/financeReports.js
"use strict";

const express =
  require("express");

const {
  authRequired,
  requireRole,
} = require(
  "../middleware/auth"
);

const pool =
  require("../db");

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
    "super_admin",
    "reconciliation"
  )
);

/* =========================================================
   HELPERS
========================================================= */

function buildDateFilter(
  field,
  from,
  to,
  params
) {

  const where = [];

  if (from) {

    where.push(
      `DATE(${field}) >= DATE(?)`
    );

    params.push(from);
  }

  if (to) {

    where.push(
      `DATE(${field}) <= DATE(?)`
    );

    params.push(to);
  }

  return where.length
    ? ` AND ${where.join(" AND ")} `
    : "";
}

/* =========================================================
   OVERVIEW REPORT
========================================================= */

router.get(
  "/overview",

  async (
    req,
    res
  ) => {

    try {

      const {
        date_from,
        date_to,
        category,
      } = req.query;

      /* ================================
         PAYMENTS
      ================================= */

      const paymentParams =
        [];

      let paymentWhere =
        `
          WHERE 1=1
        `;

      paymentWhere +=
        buildDateFilter(
          "created_at",
          date_from,
          date_to,
          paymentParams
        );

      if (category) {

        paymentWhere +=
          `
            AND category = ?
          `;

        paymentParams.push(
          category
        );
      }

      const [[paymentSummary]] =
        await pool.query(
          `
          SELECT
            COALESCE(SUM(amount),0) AS totalPayments
          FROM tbl_finance_payments
          ${paymentWhere}
          `,
          paymentParams
        );

      /* ================================
         RECEIPTS
      ================================= */

      const [[receiptSummary]] =
        await pool.query(
          `
          SELECT
            COALESCE(SUM(amount),0) AS totalReceipts
          FROM tbl_finance_receipts
          ${paymentWhere.replaceAll(
            "category",
            "receipt_type"
          )}
          `,
          paymentParams
        );

      /* ================================
         INVOICES
      ================================= */

      const [[invoiceSummary]] =
        await pool.query(
          `
          SELECT
            COALESCE(SUM(total_amount),0) AS totalInvoices
          FROM tbl_finance_invoices
          ${paymentWhere.replaceAll(
            "category",
            "invoice_type"
          )}
          `,
          paymentParams
        );

      /* ================================
         LEDGER
      ================================= */

      const [[ledgerSummary]] =
        await pool.query(
          `
          SELECT
            COALESCE(SUM(credit_amount),0) AS ledgerCredits,
            COALESCE(SUM(debit_amount),0) AS ledgerDebits,
            COALESCE(SUM(credit_amount - debit_amount),0) AS totalLedger
          FROM tbl_finance_member_ledger
          WHERE 1=1
          `,
          []
        );

      /* ================================
         REVENUE BY CATEGORY
      ================================= */

      const [revenueByCategory] =
        await pool.query(
          `
          SELECT
            category,
            COALESCE(SUM(amount),0) AS total
          FROM tbl_finance_payments
          ${paymentWhere}
          GROUP BY category
          ORDER BY total DESC
          `,
          paymentParams
        );

      /* ================================
         PAYMENT METHODS
      ================================= */

      const [paymentMethods] =
        await pool.query(
          `
          SELECT
            method,
            COALESCE(SUM(amount),0) AS total
          FROM tbl_finance_payments
          ${paymentWhere}
          GROUP BY method
          ORDER BY total DESC
          `,
          paymentParams
        );

      /* ================================
         LEDGER STATS
      ================================= */

      const [[ledgerStats]] =
        await pool.query(
          `
          SELECT
            COUNT(*) AS total_entries,
            COALESCE(SUM(credit_amount),0) AS total_credits,
            COALESCE(SUM(debit_amount),0) AS total_debits,
            SUM(CASE WHEN reconciliation_status='matched' THEN 1 ELSE 0 END) AS matched_entries,
            SUM(CASE WHEN reconciliation_status<>'matched' OR reconciliation_status IS NULL THEN 1 ELSE 0 END) AS unmatched_entries,
            SUM(CASE WHEN status='reversed' THEN 1 ELSE 0 END) AS reversed_entries
          FROM tbl_finance_member_ledger
          `,
          []
        );

      const [ledgerRows] =
        await pool.query(
          `
          SELECT *
          FROM tbl_finance_member_ledger
          ORDER BY created_at DESC
          LIMIT 50
          `
        );

      return res.json({

        ok: true,

        summary: {

          totalPayments:
            Number(
              paymentSummary?.totalPayments || 0
            ),

          totalReceipts:
            Number(
              receiptSummary?.totalReceipts || 0
            ),

          totalInvoices:
            Number(
              invoiceSummary?.totalInvoices || 0
            ),

          totalLedger:
            Number(
              ledgerSummary?.totalLedger || 0
            ),

          ledgerCredits:
            Number(
              ledgerSummary?.ledgerCredits || 0
            ),

          ledgerDebits:
            Number(
              ledgerSummary?.ledgerDebits || 0
            ),
        },

        revenueByCategory,

        paymentMethods,

        ledgerStats,

        ledgerRows,
      });

    } catch (err) {

      console.error(
        "finance reports overview error:",
        err
      );

      return res.status(500).json({

        ok: false,

        error:
          "Failed to load finance reports.",
      });
    }
  }
);

/* =========================================================
   EXPORT REPORTS
========================================================= */

router.get(
  "/export",

  async (
    req,
    res
  ) => {

    try {

      const [rows] =
        await pool.query(
          `
          SELECT
            payment_number,
            category,
            method,
            amount,
            status,
            created_at
          FROM tbl_finance_payments
          ORDER BY created_at DESC
          LIMIT 5000
          `
        );

      return res.json({

        ok: true,

        exported_at:
          new Date().toISOString(),

        total:
          rows.length,

        rows,
      });

    } catch (err) {

      console.error(
        "finance reports export error:",
        err
      );

      return res.status(500).json({

        ok: false,

        error:
          "Failed to export reports.",
      });
    }
  }
);

module.exports =
  router;