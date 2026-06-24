// backend/routes/invoices.js
"use strict";

const express = require("express");
const fsp = require("fs/promises");
const db = require("../db");

const { authRequired } = require("../middleware/auth");

const invoiceEmailService = require("../services/domains/invoices/invoiceEmailService");
const invoicePdfService = require("../services/domains/invoices/invoicePdfService");
const publicAccess = require("../services/domains/invoices/invoicePublicAccessService");

const router = express.Router();

function clean(value, max = 255) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function role(req) {
  return String(req.user?.role || "").toLowerCase();
}

function isFinance(req) {
  return ["finance", "admin", "super_admin", "reconciliation"].includes(role(req));
}

function id(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function moneyValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return 0;
}

function amountDue(invoice = {}) {
  const explicit = invoice.balance_due ?? invoice.remaining_amount ?? invoice.outstanding_amount;

  if (explicit !== undefined && explicit !== null && explicit !== "") {
    return Math.max(Number(explicit || 0), 0);
  }

  return Math.max(
    moneyValue(invoice.total_amount, invoice.amount, invoice.invoice_amount) -
      moneyValue(invoice.paid_amount, invoice.amount_paid),
    0
  );
}

function isPayable(invoice = {}) {
  const status = clean(invoice.status).toLowerCase();

  if (["paid", "void", "cancelled", "canceled", "refunded"].includes(status)) {
    return false;
  }

  return amountDue(invoice) > 0;
}

function safeFileName(value) {
  return clean(value || "invoice", 140)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function resolveMemberId(req) {
  const direct = id(req.user?.member_id || req.user?.memberId);
  if (direct) return direct;

  const userId = id(req.user?.id || req.user?.user_id);
  if (!userId) return null;

  const [[row]] = await db.query(
    "SELECT member_id FROM tbl_users WHERE id = ? LIMIT 1",
    [userId]
  );

  return id(row?.member_id);
}

function buildPayLink(invoice) {
  try {
    const links = publicAccess.buildInvoicePublicLinks(invoice, {
      ttl_days: 30,
      scope: ["view", "pay", "pdf", "download"],
    });

    return links.pay_url || links.payment_url || links.view_url;
  } catch {
    const base = String(
      process.env.FRONTEND_URL ||
        process.env.APP_URL ||
        process.env.PUBLIC_APP_URL ||
        "http://localhost:5173"
    ).replace(/\/+$/, "");

    return `${base}/pay/invoice/${encodeURIComponent(invoice.invoice_number)}`;
  }
}

function publicInvoiceSummary(invoice = {}) {
  return {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    invoice_date: invoice.invoice_date || invoice.created_at || null,
    due_date: invoice.due_date || null,
    status: invoice.status || "open",
    total_amount: moneyValue(invoice.total_amount, invoice.amount, invoice.invoice_amount),
    paid_amount: moneyValue(invoice.paid_amount, invoice.amount_paid),
    balance_due: amountDue(invoice),
    payable: isPayable(invoice),
    payment_number: invoice.payment_number || null,
    receipt_number: invoice.receipt_number || null,
    receipt_count: Number(invoice.receipt_count || 0),
    category:
      invoice.invoice_type ||
      invoice.payment_type ||
      invoice.category ||
      invoice.donation_category ||
      null,
    description: invoice.description || invoice.notes || invoice.memo || null,
    pay_link: isPayable(invoice) ? buildPayLink(invoice) : null,
  };
}

async function getInvoiceById(invoiceId) {
  const [[invoice]] = await db.query(
    `
    SELECT
      i.*,

      p.payment_number,
      p.payment_method AS payment_method_snapshot,
      p.transaction_reference,
      p.reference_no,
      p.card_brand,
      p.card_last4,
      p.bank_last4,

      r.receipt_number,

      (
        SELECT COUNT(*)
        FROM tbl_finance_receipts rx
        WHERE rx.invoice_id = i.id
      ) AS receipt_count

    FROM tbl_finance_invoices i

    LEFT JOIN tbl_finance_payments p
      ON p.id = i.payment_id

    LEFT JOIN (
      SELECT invoice_id, MAX(id) AS latest_receipt_id
      FROM tbl_finance_receipts
      WHERE invoice_id IS NOT NULL
      GROUP BY invoice_id
    ) receipt_pick
      ON receipt_pick.invoice_id = i.id

    LEFT JOIN tbl_finance_receipts r
      ON r.id = receipt_pick.latest_receipt_id

    WHERE i.id = ?
    LIMIT 1
    `,
    [invoiceId]
  );

  return invoice || null;
}

async function getInvoiceByNumber(invoiceNumber) {
  const [[invoice]] = await db.query(
    `
    SELECT
      i.*,

      p.payment_number,
      p.payment_method AS payment_method_snapshot,
      p.transaction_reference,
      p.reference_no,
      p.card_brand,
      p.card_last4,
      p.bank_last4,

      r.receipt_number,

      (
        SELECT COUNT(*)
        FROM tbl_finance_receipts rx
        WHERE rx.invoice_id = i.id
      ) AS receipt_count

    FROM tbl_finance_invoices i

    LEFT JOIN tbl_finance_payments p
      ON p.id = i.payment_id

    LEFT JOIN (
      SELECT invoice_id, MAX(id) AS latest_receipt_id
      FROM tbl_finance_receipts
      WHERE invoice_id IS NOT NULL
      GROUP BY invoice_id
    ) receipt_pick
      ON receipt_pick.invoice_id = i.id

    LEFT JOIN tbl_finance_receipts r
      ON r.id = receipt_pick.latest_receipt_id

    WHERE i.invoice_number = ?
    LIMIT 1
    `,
    [invoiceNumber]
  );

  return invoice || null;
}

async function getInvoiceItems(invoiceId) {
  try {
    const [rows] = await db.query(
      `
      SELECT
        id,
        item_type,
        item_name,
        description,
        quantity,
        unit_price,
        total_price,
        metadata_json
      FROM tbl_finance_invoice_items
      WHERE invoice_id = ?
      ORDER BY id ASC
      `,
      [invoiceId]
    );

    return rows;
  } catch {
    return [];
  }
}

async function getInvoiceReceipts(invoiceId) {
  const [rows] = await db.query(
    `
    SELECT
      id,
      receipt_number,
      payment_id,
      amount,
      payment_method,
      status,
      email_status,
      created_at
    FROM tbl_finance_receipts
    WHERE invoice_id = ?
    ORDER BY id DESC
    `,
    [invoiceId]
  );

  return rows;
}

async function assertInvoiceAccess(req, invoice) {
  if (!invoice) return false;
  if (isFinance(req)) return true;

  const memberId = await resolveMemberId(req);
  return Boolean(memberId && Number(invoice.member_id) === Number(memberId));
}

async function buildInvoicePdfBuffer(invoice) {
  const items = await getInvoiceItems(invoice.id);
  const pdfInvoice = {
    ...invoice,
    items,
  };

  if (typeof invoicePdfService.generateInvoicePdfBuffer === "function") {
    return invoicePdfService.generateInvoicePdfBuffer(pdfInvoice);
  }

  if (typeof invoicePdfService.generateInvoicePdf === "function") {
    const pdf = await invoicePdfService.generateInvoicePdf(pdfInvoice);

    if (Buffer.isBuffer(pdf)) return pdf;
    if (pdf?.buffer && Buffer.isBuffer(pdf.buffer)) return pdf.buffer;
    if (pdf?.data && Buffer.isBuffer(pdf.data)) return pdf.data;

    const filePath = pdf?.file_path || pdf?.path;
    if (filePath) return fsp.readFile(filePath);
  }

  throw new Error("Invoice PDF generation is not configured.");
}

async function sendPdf(req, res, invoice, disposition = "inline") {
  const buffer = await buildInvoicePdfBuffer(invoice);
  const filename = `${safeFileName(invoice.invoice_number || "invoice")}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
  res.setHeader("Cache-Control", "private, no-store");

  return res.send(buffer);
}

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "memberInvoices",
    version: "enterprise",
    timestamp: new Date().toISOString(),
  });
});

router.use(authRequired);

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

async function listInvoices(req, res, forceMine = false) {
  try {
    const memberId = await resolveMemberId(req);
    const finance = isFinance(req);

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
    const offset = (page - 1) * limit;

    const requestedMemberId = id(req.query.member_id);
    const status = clean(req.query.status, 40).toLowerCase();
    const category = clean(req.query.category, 80).toLowerCase();
    const q = clean(req.query.q || req.query.search, 120);
    const dateFrom = clean(req.query.date_from || req.query.from, 40);
    const dateTo = clean(req.query.date_to || req.query.to, 40);

    const where = [];
    const params = [];

    if (!finance || forceMine) {
      if (!memberId) {
        return res.status(403).json({
          error: "Member profile missing.",
        });
      }

      where.push("i.member_id = ?");
      params.push(memberId);
    } else if (requestedMemberId) {
      where.push("i.member_id = ?");
      params.push(requestedMemberId);
    }

    if (status) {
      where.push("LOWER(i.status) = ?");
      params.push(status);
    }

    if (category) {
      where.push(
        `LOWER(COALESCE(i.invoice_type, i.payment_type, i.category, i.donation_category, '')) LIKE ?`
      );
      params.push(`%${category}%`);
    }

    if (dateFrom) {
      where.push("DATE(COALESCE(i.invoice_date, i.created_at)) >= ?");
      params.push(dateFrom);
    }

    if (dateTo) {
      where.push("DATE(COALESCE(i.invoice_date, i.created_at)) <= ?");
      params.push(dateTo);
    }

    if (q) {
      where.push(
        `(
          i.invoice_number LIKE ?
          OR COALESCE(i.full_name_snapshot, '') LIKE ?
          OR COALESCE(i.email_snapshot, '') LIKE ?
          OR COALESCE(i.description, '') LIKE ?
          OR COALESCE(i.notes, '') LIKE ?
        )`
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

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

      LEFT JOIN (
        SELECT invoice_id, MAX(id) AS latest_receipt_id
        FROM tbl_finance_receipts
        WHERE invoice_id IS NOT NULL
        GROUP BY invoice_id
      ) receipt_pick
        ON receipt_pick.invoice_id = i.id

      LEFT JOIN tbl_finance_receipts r
        ON r.id = receipt_pick.latest_receipt_id

      ${whereSql}

      ORDER BY
        COALESCE(i.invoice_date, i.created_at) DESC,
        i.id DESC

      LIMIT ?
      OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [[countRow]] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_finance_invoices i
      ${whereSql}
      `,
      params
    );

    return res.json({
      ok: true,
      page,
      limit,
      total: Number(countRow?.total || rows.length || 0),
      rows: rows.map(publicInvoiceSummary),
    });
  } catch (err) {
    console.error("member invoices list error:", err);
    return res.status(500).json({
      error: "Failed to load invoices.",
    });
  }
}

router.get("/", (req, res) => listInvoices(req, res, false));
router.get("/me", (req, res) => listInvoices(req, res, true));

/* -------------------------------------------------------------------------- */
/* Number Lookup                                                              */
/* -------------------------------------------------------------------------- */

router.get("/number/:invoiceNumber", async (req, res) => {
  try {
    const invoice = await getInvoiceByNumber(req.params.invoiceNumber);

    if (!invoice) {
      return res.status(404).json({
        error: "Invoice not found.",
      });
    }

    if (!(await assertInvoiceAccess(req, invoice))) {
      return res.status(403).json({
        error: "Access denied.",
      });
    }

    const [items, receipts] = await Promise.all([
      getInvoiceItems(invoice.id),
      getInvoiceReceipts(invoice.id),
    ]);

    return res.json({
      ok: true,
      invoice,
      summary: publicInvoiceSummary(invoice),
      items,
      receipts,
      pay_link: isPayable(invoice) ? buildPayLink(invoice) : null,
    });
  } catch (err) {
    console.error("invoice number lookup error:", err);
    return res.status(500).json({
      error: "Failed to load invoice.",
    });
  }
});

router.get("/number/:invoiceNumber/pdf", async (req, res) => {
  try {
    const invoice = await getInvoiceByNumber(req.params.invoiceNumber);

    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    if (!(await assertInvoiceAccess(req, invoice))) {
      return res.status(403).json({ error: "Access denied." });
    }

    return sendPdf(req, res, invoice, "inline");
  } catch (err) {
    console.error("member invoice number pdf error:", err);
    return res.status(500).json({ error: "Failed to generate invoice PDF." });
  }
});

router.get("/number/:invoiceNumber/download", async (req, res) => {
  try {
    const invoice = await getInvoiceByNumber(req.params.invoiceNumber);

    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    if (!(await assertInvoiceAccess(req, invoice))) {
      return res.status(403).json({ error: "Access denied." });
    }

    return sendPdf(req, res, invoice, "attachment");
  } catch (err) {
    console.error("member invoice number download error:", err);
    return res.status(500).json({ error: "Failed to download invoice." });
  }
});

/* -------------------------------------------------------------------------- */
/* ID Routes                                                                  */
/* -------------------------------------------------------------------------- */

router.get("/:id/pdf", async (req, res) => {
  try {
    const invoice = await getInvoiceById(req.params.id);

    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    if (!(await assertInvoiceAccess(req, invoice))) {
      return res.status(403).json({ error: "Access denied." });
    }

    return sendPdf(req, res, invoice, "inline");
  } catch (err) {
    console.error("member invoice pdf error:", err);
    return res.status(500).json({ error: "Failed to generate invoice PDF." });
  }
});

router.get("/:id/download", async (req, res) => {
  try {
    const invoice = await getInvoiceById(req.params.id);

    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    if (!(await assertInvoiceAccess(req, invoice))) {
      return res.status(403).json({ error: "Access denied." });
    }

    return sendPdf(req, res, invoice, "attachment");
  } catch (err) {
    console.error("member invoice download error:", err);
    return res.status(500).json({ error: "Failed to download invoice." });
  }
});

router.post("/:id/email", async (req, res) => {
  try {
    const invoice = await getInvoiceById(req.params.id);

    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    if (!(await assertInvoiceAccess(req, invoice))) {
      return res.status(403).json({ error: "Access denied." });
    }

    const result = await invoiceEmailService.sendInvoiceEmail(invoice.id, {
      requested_by: req.user?.id || null,
      recipient_email: isFinance(req) ? req.body?.email : undefined,
      source: isFinance(req) ? "finance_member_invoice_route" : "member_invoice_route",
    });

    return res.json({
      ok: true,
      result,
    });
  } catch (err) {
    console.error("member invoice email error:", err);
    return res.status(500).json({
      error: "Failed to send invoice email.",
    });
  }
});

router.get("/:id/receipts", async (req, res) => {
  try {
    const invoice = await getInvoiceById(req.params.id);

    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    if (!(await assertInvoiceAccess(req, invoice))) {
      return res.status(403).json({ error: "Access denied." });
    }

    const receipts = await getInvoiceReceipts(invoice.id);

    return res.json({
      ok: true,
      rows: receipts,
    });
  } catch (err) {
    console.error("member invoice receipts error:", err);
    return res.status(500).json({
      error: "Failed to load receipts.",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const invoice = await getInvoiceById(req.params.id);

    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    if (!(await assertInvoiceAccess(req, invoice))) {
      return res.status(403).json({ error: "Access denied." });
    }

    const [items, receipts] = await Promise.all([
      getInvoiceItems(invoice.id),
      getInvoiceReceipts(invoice.id),
    ]);

    return res.json({
      ok: true,
      invoice,
      summary: publicInvoiceSummary(invoice),
      items,
      receipts,
      pay_link: isPayable(invoice) ? buildPayLink(invoice) : null,
    });
  } catch (err) {
    console.error("member invoice get error:", err);
    return res.status(500).json({
      error: "Failed to load invoice.",
    });
  }
});

module.exports = router;