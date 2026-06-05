// backend/routes/invoices.js
"use strict";

const express = require("express");

const {
  authRequired,
} = require("../middleware/auth");

const db = require("../db");

const router = express.Router();

router.use(authRequired);

function memberId(req) {
  return Number(
    req.user?.member_id ||
    req.user?.memberId ||
    0
  ) || null;
}

function isFinance(req) {
  return [
    "finance",
    "admin",
    "super_admin",
    "reconciliation",
  ].includes(String(req.user?.role || "").toLowerCase());
}

async function listMyInvoices(req, res) {
  try {
    const mid = memberId(req);

    if (!mid && !isFinance(req)) {
      return res.status(403).json({
        error: "Member profile missing.",
      });
    }

    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit || 25))
    );

    const [rows] = await db.query(
      `
      SELECT
        i.*,
        p.payment_number,
        r.receipt_number,

        (
          SELECT COUNT(*)
          FROM tbl_finance_receipts rx
          WHERE rx.invoice_id = i.id
        ) AS receipt_count

      FROM tbl_finance_invoices i

      LEFT JOIN tbl_finance_payments p
        ON p.id = i.payment_id

      LEFT JOIN tbl_finance_receipts r
        ON r.invoice_id = i.id

      WHERE i.member_id = ?

      ORDER BY
        COALESCE(i.invoice_date, i.created_at) DESC,
        i.id DESC

      LIMIT ?
      `,
      [mid, limit]
    );

    return res.json({
      ok: true,
      rows,
    });
  } catch (err) {
    console.error("member invoices error:", err);

    return res.status(500).json({
      error: "Failed to load invoices.",
    });
  }
}

router.get("/", listMyInvoices);
router.get("/me", listMyInvoices);

router.get("/number/:invoiceNumber", async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT *
      FROM tbl_finance_invoices
      WHERE invoice_number = ?
      LIMIT 1
      `,
      [req.params.invoiceNumber]
    );

    const invoice = rows[0];

    if (!invoice) {
      return res.status(404).json({
        error: "Invoice not found.",
      });
    }

    const finance = isFinance(req);
    const mid = memberId(req);

    if (!finance && Number(invoice.member_id) !== Number(mid)) {
      return res.status(403).json({
        error: "Access denied.",
      });
    }

    return res.json({
      ok: true,
      invoice,
    });
  } catch (err) {
    console.error("invoice lookup error:", err);

    return res.status(500).json({
      error: "Failed to load invoice.",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT *
      FROM tbl_finance_invoices
      WHERE id = ?
      LIMIT 1
      `,
      [req.params.id]
    );

    const invoice = rows[0];

    if (!invoice) {
      return res.status(404).json({
        error: "Invoice not found.",
      });
    }

    const finance = isFinance(req);
    const mid = memberId(req);

    if (!finance && Number(invoice.member_id) !== Number(mid)) {
      return res.status(403).json({
        error: "Access denied.",
      });
    }

    const [receipts] = await db.query(
      `
      SELECT
        id,
        receipt_number,
        amount,
        status,
        email_status,
        created_at

      FROM tbl_finance_receipts

      WHERE invoice_id = ?

      ORDER BY id DESC
      `,
      [invoice.id]
    );

    return res.json({
      ok: true,
      invoice,
      receipts,
    });
  } catch (err) {
    console.error("invoice get error:", err);

    return res.status(500).json({
      error: "Failed to load invoice.",
    });
  }
});

module.exports = router;