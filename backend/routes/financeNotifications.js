// backend/routes/financeNotifications.js
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

const {
  sendReceiptEmail,
  sendInvoiceEmail,
} = require(
  "../services/emailService"
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
   GET NOTIFICATIONS
========================================================= */

router.get(
  "/",

  async (
    req,
    res
  ) => {

    try {

      const where =
        [];

      const params =
        [];

      if (
        req.query.status
      ) {

        where.push(
          "status = ?"
        );

        params.push(
          req.query.status
        );
      }

      if (
        req.query.type
      ) {

        where.push(
          "notification_type = ?"
        );

        params.push(
          req.query.type
        );
      }

      if (
        req.query.search
      ) {

        where.push(`
          (
            recipient_email LIKE ?
            OR subject LIKE ?
          )
        `);

        const q =
          `%${req.query.search}%`;

        params.push(
          q,
          q
        );
      }

      const whereSql =
        where.length
          ? `WHERE ${where.join(" AND ")}`
          : "";

      const [rows] =
        await pool.query(
          `
          SELECT *
          FROM tbl_finance_notifications
          ${whereSql}
          ORDER BY created_at DESC
          LIMIT 500
          `,
          params
        );

      return res.json({

        ok: true,

        rows,
      });

    } catch (err) {

      console.error(
        "finance notifications error:",
        err
      );

      return res.status(500).json({

        ok: false,

        error:
          "Failed to load notifications.",
      });
    }
  }
);

/* =========================================================
   RESEND RECEIPT EMAIL
========================================================= */

router.post(
  "/resend-receipt/:receiptId",

  async (
    req,
    res
  ) => {

    try {

      const {
        receiptId,
      } = req.params;

      const [[receipt]] =
        await pool.query(
          `
          SELECT *
          FROM tbl_finance_receipts
          WHERE id = ?
          LIMIT 1
          `,
          [
            receiptId,
          ]
        );

      if (!receipt) {

        return res.status(404).json({

          ok: false,

          error:
            "Receipt not found.",
        });
      }

      await sendReceiptEmail(
        receipt
      );

      await pool.query(
        `
        INSERT INTO tbl_finance_notifications
        (
          notification_type,
          recipient_email,
          subject,
          status,
          reference_type,
          reference_id,
          created_by,
          created_at
        )
        VALUES
        (
          'receipt_email',
          ?,
          ?,
          'sent',
          'receipt',
          ?,
          ?,
          NOW()
        )
        `,
        [
          receipt.emailed_to ||
            receipt.email,

          `Receipt ${receipt.receipt_number}`,

          receipt.id,

          req.user?.id ||
            null,
        ]
      );

      return res.json({

        ok: true,

        message:
          "Receipt email resent successfully.",
      });

    } catch (err) {

      console.error(
        "receipt resend error:",
        err
      );

      return res.status(500).json({

        ok: false,

        error:
          "Failed to resend receipt email.",
      });
    }
  }
);

/* =========================================================
   RESEND INVOICE EMAIL
========================================================= */

router.post(
  "/resend-invoice/:invoiceId",

  async (
    req,
    res
  ) => {

    try {

      const {
        invoiceId,
      } = req.params;

      const [[invoice]] =
        await pool.query(
          `
          SELECT *
          FROM tbl_finance_invoices
          WHERE id = ?
          LIMIT 1
          `,
          [
            invoiceId,
          ]
        );

      if (!invoice) {

        return res.status(404).json({

          ok: false,

          error:
            "Invoice not found.",
        });
      }

      await sendInvoiceEmail(
        invoice
      );

      await pool.query(
        `
        INSERT INTO tbl_finance_notifications
        (
          notification_type,
          recipient_email,
          subject,
          status,
          reference_type,
          reference_id,
          created_by,
          created_at
        )
        VALUES
        (
          'invoice_email',
          ?,
          ?,
          'sent',
          'invoice',
          ?,
          ?,
          NOW()
        )
        `,
        [
          invoice.email,

          `Invoice ${invoice.invoice_number}`,

          invoice.id,

          req.user?.id ||
            null,
        ]
      );

      return res.json({

        ok: true,

        message:
          "Invoice email resent successfully.",
      });

    } catch (err) {

      console.error(
        "invoice resend error:",
        err
      );

      return res.status(500).json({

        ok: false,

        error:
          "Failed to resend invoice email.",
      });
    }
  }
);

/* =========================================================
   MARK FAILED AS RETRY
========================================================= */

router.post(
  "/retry/:id",

  async (
    req,
    res
  ) => {

    try {

      const [result] =
        await pool.query(
          `
          UPDATE tbl_finance_notifications
          SET
            status = 'retrying',
            retry_count =
              COALESCE(retry_count,0) + 1,
            updated_at = NOW()
          WHERE id = ?
          `,
          [
            req.params.id,
          ]
        );

      return res.json({

        ok: true,

        affectedRows:
          result.affectedRows,
      });

    } catch (err) {

      console.error(
        "notification retry error:",
        err
      );

      return res.status(500).json({

        ok: false,

        error:
          "Failed to retry notification.",
      });
    }
  }
);

/* =========================================================
   DELETE NOTIFICATION
========================================================= */

router.delete(
  "/:id",

  async (
    req,
    res
  ) => {

    try {

      const [result] =
        await pool.query(
          `
          DELETE FROM tbl_finance_notifications
          WHERE id = ?
          `,
          [
            req.params.id,
          ]
        );

      return res.json({

        ok: true,

        affectedRows:
          result.affectedRows,
      });

    } catch (err) {

      console.error(
        "notification delete error:",
        err
      );

      return res.status(500).json({

        ok: false,

        error:
          "Failed to delete notification.",
      });
    }
  }
);

module.exports =
  router;