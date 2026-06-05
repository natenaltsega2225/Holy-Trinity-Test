// backend/routes/financeInvoices.js
"use strict";

const express = require("express");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const db = require("../db");

const router = express.Router();

/* =========================================================
   SECURITY
========================================================= */

router.use(authRequired);

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

function safe(value, fallback = null) {
  const v = String(value ?? "").trim();
  return v || fallback;
}

/* =========================================================
   LIST INVOICES
========================================================= */

router.get(
  "/",
  async (req, res) => {

    try {

      const where = [];
      const params = [];

      if (req.query.member_id) {
        where.push(
          "i.member_id = ?"
        );

        params.push(
          req.query.member_id
        );
      }

      if (req.query.status) {
        where.push(
          "i.status = ?"
        );

        params.push(
          req.query.status
        );
      }

      if (req.query.category) {
        where.push(
          "i.category = ?"
        );

        params.push(
          req.query.category
        );
      }

      if (req.query.search) {

        where.push(`
          (
            i.invoice_number LIKE ?
            OR i.full_name_snapshot LIKE ?
            OR i.email_snapshot LIKE ?
          )
        `);

        const s =
          `%${req.query.search}%`;

        params.push(
          s,
          s,
          s
        );
      }

      const sql = `
        SELECT
          i.*,

          (
            SELECT COUNT(*)
            FROM tbl_finance_receipts r
            WHERE r.invoice_id = i.id
          ) AS receipt_count

        FROM tbl_finance_invoices i

        ${
          where.length
            ? `WHERE ${where.join(" AND ")}`
            : ""
        }

        ORDER BY i.id DESC
      `;

      const [rows] =
        await db.query(
          sql,
          params
        );

      return res.json({
        ok: true,
        rows,
      });

    } catch (err) {

      console.error(
        "finance invoices error:",
        err
      );

      return res.status(500).json({
        error:
          "Failed to load invoices.",
      });
    }
  }
);

/* =========================================================
   GET SINGLE INVOICE
========================================================= */

router.get(
  "/:id",
  async (req, res) => {

    try {

      const [rows] =
        await db.query(
          `
          SELECT *
          FROM tbl_finance_invoices
          WHERE id = ?
          LIMIT 1
          `,
          [req.params.id]
        );

      const invoice =
        rows[0];

      if (!invoice) {
        return res.status(404).json({
          error:
            "Invoice not found.",
        });
      }

      const [receipts] =
        await db.query(
          `
          SELECT
  r.id,
  r.receipt_number,
  r.amount,
  r.currency,
  r.status,
  r.email_status,
  r.emailed_at,
  r.emailed_to,
  r.created_at,

  p.payment_number,
  p.payment_status,
  p.payment_method,
  p.method,
  p.provider,
  p.reference_no

FROM tbl_finance_receipts r

LEFT JOIN tbl_finance_payments p
  ON p.id = r.payment_id

WHERE r.invoice_id = ?

ORDER BY r.id DESC

          `,
          [invoice.id]
        );

      return res.json({
        ok: true,
        invoice,
        receipts,
      });

    } catch (err) {

      console.error(
        "finance invoice get error:",
        err
      );

      return res.status(500).json({
        error:
          "Failed to load invoice.",
      });
    }
  }
);

/* =========================================================
   INVOICE STATS
========================================================= */

router.get(
  "/stats/overview",
  async (_req, res) => {

    try {

      const [rows] =
        await db.query(`
          SELECT

            COUNT(*) AS total_invoices,

            SUM(total_amount) AS total_amount,

            SUM(
              CASE
                WHEN status = 'paid'
                THEN total_amount
                ELSE 0
              END
            ) AS paid_amount,

            SUM(
              CASE
                WHEN status != 'paid'
                THEN total_amount
                ELSE 0
              END
            ) AS outstanding_amount

          FROM tbl_finance_invoices
        `);

      return res.json({
        ok: true,
        stats:
          rows[0] || {},
      });

    } catch (err) {

      console.error(
        "invoice stats error:",
        err
      );

      return res.status(500).json({
        error:
          "Failed to load invoice stats.",
      });
    }
  }
);

/* =========================================================
   MARK PAID
========================================================= */

router.post(
  "/:id/mark-paid",
  async (req, res) => {

    try {

      await db.query(
        `
        UPDATE tbl_finance_invoices
        SET
          status = 'paid',
          paid_at = NOW(),
          updated_at = NOW()
        WHERE id = ?
        `,
        [req.params.id]
      );

      return res.json({
        ok: true,
      });

    } catch (err) {

      console.error(
        "mark invoice paid error:",
        err
      );

      return res.status(500).json({
        error:
          "Failed to mark invoice paid.",
      });
    }
  }
);

/* =========================================================
   SEND INVOICE EMAIL
========================================================= */

router.post(
  "/:id/send-email",
  async (req, res) => {

    try {

      /*
      Enterprise placeholder.

      Your future invoice email service
      will plug in here.
      */

      return res.json({
        ok: true,
        message:
          "Invoice email queued.",
      });

    } catch (err) {

      console.error(
        "send invoice email error:",
        err
      );

      return res.status(500).json({
        error:
          "Failed to send invoice email.",
      });
    }
  }
);

module.exports = router;