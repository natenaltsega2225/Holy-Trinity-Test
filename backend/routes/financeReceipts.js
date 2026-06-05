//backend\routes\financeReceipts.js

"use strict";

/* =========================================================
   FINANCE RECEIPTS ROUTES
========================================================= */

const express = require("express");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const {
  listReceipts,
  getReceiptById,
  getReceiptStats,
} = require(
  "../services/domains/receipts/receiptService"
);
const {
  generateReceiptPdf,
} = require("../services/domains/receipts/receiptPdfService");
const {
  sendReceiptEmail,
  resendReceiptEmail,
} = require(
  "../services/domains/receipts/receiptEmailService"
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
    "super_admin",
    "reconciliation"
  )
);

/* =========================================================
   HELPERS
========================================================= */

function safeNumber(v) {
  const n = Number(v);

  return Number.isFinite(n)
    ? n
    : null;
}

/* =========================================================
   LIST RECEIPTS
========================================================= */

router.get("/receipts", async (req, res) => {
  try {
    const result = await listReceipts({
      member_id: req.query.member_id || null,
      category: req.query.category || null,
      status: req.query.status || null,
      email_status: req.query.email_status || null,
      search: req.query.search || req.query.q || "",
      page: req.query.page || 1,
      limit: req.query.limit || req.query.pageSize || 25,
      payment_id: req.query.payment_id || null,
    });

    return res.json({
      ok: true,
      rows: Array.isArray(result?.rows) ? result.rows : [],
      pagination: result?.pagination || {
        page: Number(req.query.page || 1),
        limit: Number(req.query.limit || 25),
        total: 0,
        pages: 1,
      },
      summary: result?.summary || {},
      total: Number(result?.pagination?.total || 0),
      page: Number(result?.pagination?.page || req.query.page || 1),
      limit: Number(result?.pagination?.limit || req.query.limit || 25),
      totalPages: Number(result?.pagination?.pages || 1),
    });
  } catch (err) {
    console.error("finance receipts error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load receipts.",
    });
  }
});
/* =========================================================
   RECEIPT STATS
========================================================= */

router.get(
  "/receipts/stats",
  async (_req, res) => {
    try {

      const stats =
        await getReceiptStats();

      return res.json({
        ok: true,
        stats,
      });

    } catch (err) {

      console.error(
        "receipt stats error:",
        err
      );

      return res.status(500).json({
        ok: false,

        error:
          err.message ||
          "Failed to load receipt stats.",
      });
    }
  }
);

/* =========================================================
   GET SINGLE RECEIPT
========================================================= */

router.get(
  "/receipts/:id",
  async (req, res) => {
    try {

      const id =
        req.params.id;

      const receipt =
        await getReceiptById(id);

      if (!receipt) {

        return res.status(404).json({
          ok: false,

          error:
            "Receipt not found.",
        });
      }

      return res.json({
        ok: true,
        receipt,
      });

    } catch (err) {

      console.error(
        "finance receipt get error:",
        err
      );

      return res.status(500).json({
        ok: false,

        error:
          err.message ||
          "Failed to load receipt.",
      });
    }
  }
);

/* =========================================================
   SEND RECEIPT EMAIL
========================================================= */

router.post(
  "/receipts/:id/send-email",
  async (req, res) => {

    try {

      const receiptId =
        safeNumber(
          req.params.id
        );

      if (!receiptId) {

        return res.status(400).json({
          ok: false,

          error:
            "Invalid receipt ID.",
        });
      }

      const result =
        await sendReceiptEmail(
          receiptId,
          {
            email:
              req.body?.email ||
              null,
          }
        );

      return res.json({
        ok: true,
        result,
      });

    } catch (err) {

      console.error(
        "finance send receipt email error:",
        err
      );

      return res.status(400).json({
        ok: false,

        error:
          err.message ||
          "Failed to send receipt email.",
      });
    }
  }
);

/* =========================================================
   RESEND RECEIPT EMAIL
========================================================= */

router.post(
  "/receipts/payment/:paymentId/resend",
  async (req, res) => {

    try {

      const paymentId =
        safeNumber(
          req.params.paymentId
        );

      if (!paymentId) {

        return res.status(400).json({
          ok: false,

          error:
            "Invalid payment ID.",
        });
      }

      const result =
        await resendReceiptEmail(
          paymentId,
          {
            email:
              req.body?.email ||
              null,
          }
        );

      return res.json({
        ok: true,
        result,
      });

    } catch (err) {

      console.error(
        "finance resend receipt error:",
        err
      );

      return res.status(400).json({
        ok: false,

        error:
          err.message ||
          "Failed to resend receipt.",
      });
    }
  }
);
router.get("/receipts/:id/pdf", async (req, res) => {
  try {
    const receipt = await getReceiptById(req.params.id);

    if (!receipt) {
      return res.status(404).json({
        ok: false,
        error: "Receipt not found.",
      });
    }

    const pdf = await generateReceiptPdf(receipt);

    if (pdf?.pdf_url) {
      return res.redirect(pdf.pdf_url);
    }

    return res.status(404).json({
      ok: false,
      error: "Receipt PDF could not be generated.",
    });
  } catch (err) {
    console.error("finance receipt pdf error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to open receipt PDF.",
    });
  }
});
/* =========================================================
   EXPORTS
========================================================= */

module.exports =
  router;