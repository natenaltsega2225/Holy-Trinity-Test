// backend/routes/receipts.js
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const {
  listReceipts,
  getReceiptById,
  getReceiptByNumber,
  getReceiptStats,
} = require("../services/domains/receipts/receiptService");

const {
  generateReceiptPdf,
} = require("../services/domains/receipts/receiptPdfService");

const {
  sendReceiptEmail,
  resendReceiptEmail,
} = require("../services/domains/receipts/receiptEmailService");

const db = require("../db");

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

function isFinance(req) {
  return [
    "finance",
    "admin",
    "super_admin",
    "reconciliation",
  ].includes(
    String(
      req.user?.role || ""
    ).toLowerCase()
  );
}

function memberId(req) {
  return Number(
    req.user?.member_id ||
    req.user?.memberId ||
    0
  ) || null;
}

async function validateAccess(
  req,
  receipt
) {

  if (!receipt) {
    return false;
  }

  if (isFinance(req)) {
    return true;
  }

  const mid =
    memberId(req);

  if (!mid) {
    return false;
  }

  return (
    Number(receipt.member_id) ===
    Number(mid)
  );
}

function normalizePdfPath(
  pdfUrl
) {

  if (!pdfUrl) {
    return null;
  }

  const cleaned =
    String(pdfUrl)
      .replace(/^\/+/, "")
      .replaceAll("\\", "/");

  const resolved =
    path.resolve(
      process.cwd(),
      cleaned
    );

  const uploadsRoot =
    path.resolve(
      process.cwd(),
      "uploads"
    );

  if (
    !resolved.startsWith(
      uploadsRoot
    )
  ) {
    return null;
  }

  return resolved;
}

/* =========================================================
   SECURITY
========================================================= */

router.use(authRequired);

/* =========================================================
   LIST
========================================================= */

router.get(
  "/",
  async (req, res) => {

    try {

      const finance =
        isFinance(req);

      const rows =
        await listReceipts({

          member_id:
            finance
              ? req.query.member_id
              : memberId(req),

          category:
            req.query.category,

          status:
            req.query.status,

          search:
            req.query.search,

          page:
            req.query.page,

          limit:
            req.query.limit,
        });

      return res.json({
        ok: true,
        rows,
      });

    } catch (err) {

      console.error(
        "list receipts error:",
        err
      );

      return res.status(500).json({
        error:
          "Failed to load receipts.",
      });
    }
  }
);

/* =========================================================
   STATS
========================================================= */

router.get(
  "/stats/overview",

  requireRole(
    "finance",
    "admin",
    "super_admin",
    "reconciliation"
  ),

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
        error:
          "Failed to load receipt stats.",
      });
    }
  }
);

/* =========================================================
   MEMBER RECEIPTS
========================================================= */

router.get(
  "/member/me",
  async (req, res) => {

    try {

      const mid =
        memberId(req);

      if (!mid) {
        return res.status(403).json({
          error:
            "Member profile missing.",
        });
      }

      const rows =
        await listReceipts({
          member_id: mid,
          search:
            req.query.search,
          page:
            req.query.page,
          limit:
            req.query.limit,
        });

      return res.json({
        ok: true,
        rows,
      });

    } catch (err) {

      console.error(
        "member receipts error:",
        err
      );

      return res.status(500).json({
        error:
          "Failed to load member receipts.",
      });
    }
  }
);

/* =========================================================
   GET BY NUMBER
========================================================= */

router.get(
  "/number/:receiptNumber",
  async (req, res) => {

    try {

      const receipt =
        await getReceiptByNumber(
          req.params.receiptNumber
        );

      if (!receipt) {
        return res.status(404).json({
          error:
            "Receipt not found.",
        });
      }

      const allowed =
        await validateAccess(
          req,
          receipt
        );

      if (!allowed) {
        return res.status(403).json({
          error:
            "Access denied.",
        });
      }

      return res.json({
        ok: true,
        receipt,
      });

    } catch (err) {

      console.error(
        "receipt lookup error:",
        err
      );

      return res.status(500).json({
        error:
          "Failed to load receipt.",
      });
    }
  }
);

/* =========================================================
   GET RECEIPT
========================================================= */

router.get(
  "/:id",
  async (req, res) => {

    try {

      const receipt =
        await getReceiptById(
          req.params.id
        );

      if (!receipt) {
        return res.status(404).json({
          error:
            "Receipt not found.",
        });
      }

      const allowed =
        await validateAccess(
          req,
          receipt
        );

      if (!allowed) {
        return res.status(403).json({
          error:
            "Access denied.",
        });
      }

      return res.json({
        ok: true,
        receipt,
      });

    } catch (err) {

      console.error(
        "receipt get error:",
        err
      );

      return res.status(500).json({
        error:
          "Failed to load receipt.",
      });
    }
  }
);

/* =========================================================
   GENERATE PDF
========================================================= */

router.post(
  "/:id/generate-pdf",

  requireRole(
    "finance",
    "admin",
    "super_admin"
  ),

  async (req, res) => {

    try {

      const receipt =
        await getReceiptById(
          req.params.id
        );

      if (!receipt) {
        return res.status(404).json({
          error:
            "Receipt not found.",
        });
      }

      const pdf =
        await generateReceiptPdf(
          receipt
        );

      await db.query(
        `
        UPDATE tbl_finance_receipts
        SET
          pdf_url = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          pdf.pdf_url,
          receipt.id,
        ]
      );

      return res.json({
        ok: true,
        pdf,
      });

    } catch (err) {

      console.error(
        "generate receipt pdf error:",
        err
      );

      return res.status(400).json({
        error:
          err.message ||
          "Failed to generate receipt PDF.",
      });
    }
  }
);

/* =========================================================
   VIEW PDF
========================================================= */

router.get(
  "/:id/pdf",
  async (req, res) => {

    try {

      const receipt =
        await getReceiptById(
          req.params.id
        );

      if (!receipt) {
        return res.status(404).json({
          error:
            "Receipt not found.",
        });
      }

      const allowed =
        await validateAccess(
          req,
          receipt
        );

      if (!allowed) {
        return res.status(403).json({
          error:
            "Access denied.",
        });
      }

      let pdfUrl =
        receipt.pdf_url;

      if (!pdfUrl) {

        const pdf =
          await generateReceiptPdf(
            receipt
          );

        pdfUrl =
          pdf.pdf_url;

        await db.query(
          `
          UPDATE tbl_finance_receipts
          SET
            pdf_url = ?,
            updated_at = NOW()
          WHERE id = ?
          `,
          [
            pdfUrl,
            receipt.id,
          ]
        );
      }

      const filePath =
        normalizePdfPath(
          pdfUrl
        );

      if (
        !filePath ||
        !fs.existsSync(
          filePath
        )
      ) {
        return res.status(404).json({
          error:
            "Receipt PDF missing.",
        });
      }

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );

      return fs
        .createReadStream(
          filePath
        )
        .pipe(res);

    } catch (err) {

      console.error(
        "receipt pdf error:",
        err
      );

      return res.status(500).json({
        error:
          "Failed to open receipt PDF.",
      });
    }
  }
);

/* =========================================================
   SEND EMAIL
========================================================= */

router.post(
  "/:id/send-email",

  requireRole(
    "finance",
    "admin",
    "super_admin"
  ),

  async (req, res) => {

    try {

      const result =
        await sendReceiptEmail(
          req.params.id,
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
        "send receipt email error:",
        err
      );

      return res.status(400).json({
        error:
          err.message ||
          "Failed to send receipt.",
      });
    }
  }
);

/* =========================================================
   RESEND EMAIL
========================================================= */

router.post(
  "/payment/:paymentId/resend",

  requireRole(
    "finance",
    "admin",
    "super_admin"
  ),

  async (req, res) => {

    try {

      const result =
        await resendReceiptEmail(
          req.params.paymentId,
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
        "resend receipt error:",
        err
      );

      return res.status(400).json({
        error:
          err.message ||
          "Failed to resend receipt.",
      });
    }
  }
);

module.exports = router;