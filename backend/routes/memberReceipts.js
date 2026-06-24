// backend/routes/memberReceipts.js
"use strict";

const express = require("express");
const fsp = require("fs/promises");
const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const receiptService = require("../services/domains/receipts/receiptService");

let receiptPdfService = {};
let receiptEmailService = {};

try {
  receiptPdfService = require("../services/domains/receipts/receiptPdfService");
} catch {
  receiptPdfService = {};
}

try {
  receiptEmailService = require("../services/domains/receipts/receiptEmailService");
} catch {
  receiptEmailService = {};
}

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clean(value, max = 255) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function toInt(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function id(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function userRole(req) {
  return String(req.user?.role || "").toLowerCase();
}

function isFinance(req) {
  return [
    "finance",
    "admin",
    "super_admin",
    "reconciliation",
  ].includes(userRole(req));
}

function actorId(req) {
  return (
    Number(req.user?.id || 0) ||
    Number(req.user?.user_id || 0) ||
    null
  );
}

function userEmail(req) {
  return clean(req.user?.email || "", 190).toLowerCase();
}

function memberNo(req) {
  return clean(
    req.user?.member_no ||
      req.user?.memberNo ||
      "",
    80
  );
}

async function resolveMemberId(req) {
  const direct =
    id(req.user?.member_id) ||
    id(req.user?.memberId);

  if (direct) return direct;

  const userId =
    id(req.user?.id) ||
    id(req.user?.user_id);

  if (!userId) return null;

  const [[row]] = await pool.query(
    "SELECT member_id FROM tbl_users WHERE id = ? LIMIT 1",
    [userId]
  );

  return id(row?.member_id);
}

function normalizeListResult(result) {
  if (Array.isArray(result)) {
    return {
      rows: result,
      pagination: null,
      summary: null,
    };
  }

  return {
    rows: result?.rows || [],
    pagination: result?.pagination || null,
    summary: result?.summary || null,
  };
}

async function buildMemberFilters(req) {
  const limit = Math.min(100, toInt(req.query.limit, 25));
  const page = toInt(req.query.page, 1);

  const filters = {
    category: clean(req.query.category || req.query.payment_type || ""),
    status: clean(req.query.status || ""),
    search: clean(req.query.search || req.query.q || ""),
    date_from: clean(req.query.date_from || req.query.from || ""),
    date_to: clean(req.query.date_to || req.query.to || ""),
    page,
    limit,
  };

  if (isFinance(req)) {
    filters.member_id = req.query.member_id || null;
    filters.member_no = clean(req.query.member_no || "");
    filters.email = clean(req.query.email || "");
  } else {
    filters.member_id = await resolveMemberId(req);
  }

  return filters;
}

function safeFileName(value) {
  return clean(value || "receipt", 140)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/* -------------------------------------------------------------------------- */
/* Receipt Loading                                                            */
/* -------------------------------------------------------------------------- */

async function getReceiptById(idValue) {
  if (typeof receiptService.getReceiptById === "function") {
    return receiptService.getReceiptById(idValue);
  }

  const [[receipt]] = await pool.query(
    `
    SELECT *
    FROM tbl_finance_receipts
    WHERE id = ?
    LIMIT 1
    `,
    [idValue]
  );

  return receipt || null;
}

async function getReceiptByNumber(receiptNumber) {
  if (typeof receiptService.getReceiptByNumber === "function") {
    return receiptService.getReceiptByNumber(receiptNumber);
  }

  const [[receipt]] = await pool.query(
    `
    SELECT *
    FROM tbl_finance_receipts
    WHERE receipt_number = ?
    LIMIT 1
    `,
    [receiptNumber]
  );

  return receipt || null;
}

async function listReceipts(filters) {
  if (typeof receiptService.listReceipts === "function") {
    return receiptService.listReceipts(filters);
  }

  const where = [];
  const params = [];

  if (filters.member_id) {
    where.push("member_id = ?");
    params.push(filters.member_id);
  }

  if (filters.member_no) {
    where.push("member_no = ?");
    params.push(filters.member_no);
  }

  if (filters.email) {
    where.push("LOWER(email_snapshot) = LOWER(?)");
    params.push(filters.email);
  }

  if (filters.category) {
    where.push("(category = ? OR payment_type = ? OR donation_category = ?)");
    params.push(filters.category, filters.category, filters.category);
  }

  if (filters.status) {
    where.push("(status = ? OR receipt_status = ?)");
    params.push(filters.status, filters.status);
  }

  if (filters.search) {
    where.push(`
      (
        receipt_number LIKE ?
        OR payment_number LIKE ?
        OR invoice_number LIKE ?
        OR full_name_snapshot LIKE ?
        OR email_snapshot LIKE ?
      )
    `);

    const like = `%${filters.search}%`;
    params.push(like, like, like, like, like);
  }

  if (filters.date_from) {
    where.push("DATE(COALESCE(issued_at, created_at)) >= ?");
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push("DATE(COALESCE(issued_at, created_at)) <= ?");
    params.push(filters.date_to);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(100, toInt(filters.limit, 25));
  const page = toInt(filters.page, 1);
  const offset = (page - 1) * limit;

  const [[countRow]] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM tbl_finance_receipts
    ${whereSql}
    `,
    params
  );

  const [rows] = await pool.query(
    `
    SELECT *
    FROM tbl_finance_receipts
    ${whereSql}
    ORDER BY COALESCE(issued_at, created_at) DESC, id DESC
    LIMIT ?
    OFFSET ?
    `,
    [...params, limit, offset]
  );

  const total = Number(countRow?.total || 0);

  return {
    rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function loadReceiptDetails(receipt) {
  let payment = null;
  let invoice = null;

  if (receipt.payment_id) {
    const [[row]] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_payments
      WHERE id = ?
      LIMIT 1
      `,
      [receipt.payment_id]
    );

    payment = row || null;
  }

  const invoiceId =
    receipt.invoice_id ||
    payment?.invoice_id ||
    null;

  if (invoiceId) {
    const [[row]] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_invoices
      WHERE id = ?
      LIMIT 1
      `,
      [invoiceId]
    );

    invoice = row || null;
  }

  return {
    receipt,
    payment,
    invoice,
  };
}

async function buildReceiptPdfData(receipt) {
  const details = await loadReceiptDetails(receipt);
  const payment = details.payment || {};
  const invoice = details.invoice || {};

  return {
    ...invoice,
    ...payment,
    ...receipt,

    id: receipt.id,
    receipt_id: receipt.id,
    receipt_number: receipt.receipt_number,

    payment_id: receipt.payment_id || payment.id || null,
    invoice_id: receipt.invoice_id || payment.invoice_id || invoice.id || null,

    payment_number:
      receipt.payment_number ||
      payment.payment_number ||
      null,

    invoice_number:
      receipt.invoice_number ||
      invoice.invoice_number ||
      null,

    member_id:
      receipt.member_id ||
      payment.member_id ||
      invoice.member_id ||
      null,

    member_no:
      receipt.member_no ||
      payment.member_no ||
      invoice.member_no ||
      null,

    full_name_snapshot:
      receipt.full_name_snapshot ||
      payment.full_name_snapshot ||
      invoice.full_name_snapshot ||
      "Guest Donor",

    email_snapshot:
      receipt.email_snapshot ||
      payment.email_snapshot ||
      invoice.email_snapshot ||
      null,

    phone_snapshot:
      receipt.phone_snapshot ||
      payment.phone_snapshot ||
      invoice.phone_snapshot ||
      null,

    amount:
      receipt.amount ||
      receipt.receipt_amount ||
      payment.amount ||
      invoice.paid_amount ||
      invoice.total_amount ||
      0,

    reference_no:
      receipt.reference_no ||
      payment.reference_no ||
      payment.transaction_reference ||
      invoice.reference_no ||
      null,
  };
}

/* -------------------------------------------------------------------------- */
/* Access                                                                     */
/* -------------------------------------------------------------------------- */

async function validateAccess(req, receipt) {
  if (!receipt) return false;
  if (isFinance(req)) return true;

  const mid = await resolveMemberId(req);
  const mno = memberNo(req);

  if (mid && Number(receipt.member_id) === Number(mid)) {
    return true;
  }

  if (mno && receipt.member_no && clean(receipt.member_no, 80) === mno) {
    return true;
  }

  return false;
}

async function requireReceiptAccess(req, res, receipt) {
  if (!receipt) {
    res.status(404).json({
      ok: false,
      error: "Receipt not found.",
    });
    return false;
  }

  const allowed = await validateAccess(req, receipt);

  if (!allowed) {
    res.status(403).json({
      ok: false,
      error: "Access denied.",
    });
    return false;
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* PDF                                                                        */
/* -------------------------------------------------------------------------- */

async function buildReceiptPdfBuffer(req, receipt) {
  const pdfData = await buildReceiptPdfData(receipt);

  if (typeof receiptPdfService.generateReceiptPdfBuffer === "function") {
    return receiptPdfService.generateReceiptPdfBuffer(pdfData, {
      requested_by: actorId(req),
      source: "member_receipts",
    });
  }

  if (typeof receiptPdfService.generateReceiptPdf === "function") {
    const result = await receiptPdfService.generateReceiptPdf(pdfData, {
      requested_by: actorId(req),
      source: "member_receipts",
    });

    if (Buffer.isBuffer(result)) return result;
    if (result?.buffer && Buffer.isBuffer(result.buffer)) return result.buffer;
    if (result?.pdfBuffer && Buffer.isBuffer(result.pdfBuffer)) return result.pdfBuffer;
    if (result?.data && Buffer.isBuffer(result.data)) return result.data;

    const filePath = result?.file_path || result?.path;
    if (filePath) return fsp.readFile(filePath);
  }

  throw new Error("Receipt PDF service is not available.");
}

async function sendReceiptPdf(req, res, receipt, download = false) {
  const buffer = await buildReceiptPdfBuffer(req, receipt);
  const fileName = `${safeFileName(receipt.receipt_number || `receipt-${receipt.id}`)}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${download ? "attachment" : "inline"}; filename="${fileName}"`
  );
  res.setHeader("Cache-Control", "private, no-store");

  return res.send(buffer);
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "memberReceipts",
    version: "enterprise",
    timestamp: new Date().toISOString(),
  });
});

router.use(authRequired);

router.use(
  requireRole(
    "member",
    "finance",
    "admin",
    "super_admin",
    "reconciliation"
  )
);

async function listMyReceipts(req, res) {
  try {
    const mid = await resolveMemberId(req);

    if (!isFinance(req) && !mid) {
      return res.status(403).json({
        ok: false,
        error: "Member profile missing.",
      });
    }

    const result = await listReceipts(await buildMemberFilters(req));
    const normalized = normalizeListResult(result);

    return res.json({
      ok: true,
      rows: normalized.rows,
      pagination: normalized.pagination,
      summary: normalized.summary,
    });
  } catch (err) {
    console.error("member receipts list error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to load receipts.",
    });
  }
}

router.get("/", listMyReceipts);
router.get("/me", listMyReceipts);
router.get("/receipts", listMyReceipts);

router.get("/number/:receiptNumber", async (req, res) => {
  try {
    const receipt = await getReceiptByNumber(req.params.receiptNumber);

    if (!(await requireReceiptAccess(req, res, receipt))) return;

    const details = await loadReceiptDetails(receipt);

    return res.json({
      ok: true,
      ...details,
    });
  } catch (err) {
    console.error("member receipt lookup error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to load receipt.",
    });
  }
});

router.get("/number/:receiptNumber/pdf", async (req, res) => {
  try {
    const receipt = await getReceiptByNumber(req.params.receiptNumber);

    if (!(await requireReceiptAccess(req, res, receipt))) return;

    return sendReceiptPdf(req, res, receipt, false);
  } catch (err) {
    console.error("member receipt pdf error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to generate receipt PDF.",
    });
  }
});

router.get("/number/:receiptNumber/download", async (req, res) => {
  try {
    const receipt = await getReceiptByNumber(req.params.receiptNumber);

    if (!(await requireReceiptAccess(req, res, receipt))) return;

    return sendReceiptPdf(req, res, receipt, true);
  } catch (err) {
    console.error("member receipt download error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to download receipt PDF.",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const receipt = await getReceiptById(req.params.id);

    if (!(await requireReceiptAccess(req, res, receipt))) return;

    const details = await loadReceiptDetails(receipt);

    return res.json({
      ok: true,
      ...details,
    });
  } catch (err) {
    console.error("member receipt get error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to load receipt.",
    });
  }
});

router.get("/:id/pdf", async (req, res) => {
  try {
    const receipt = await getReceiptById(req.params.id);

    if (!(await requireReceiptAccess(req, res, receipt))) return;

    return sendReceiptPdf(req, res, receipt, false);
  } catch (err) {
    console.error("member receipt pdf error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to generate receipt PDF.",
    });
  }
});

router.get("/:id/download", async (req, res) => {
  try {
    const receipt = await getReceiptById(req.params.id);

    if (!(await requireReceiptAccess(req, res, receipt))) return;

    return sendReceiptPdf(req, res, receipt, true);
  } catch (err) {
    console.error("member receipt download error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to download receipt PDF.",
    });
  }
});

router.post("/:id/resend", async (req, res) => {
  try {
    const receipt = await getReceiptById(req.params.id);

    if (!(await requireReceiptAccess(req, res, receipt))) return;

    if (typeof receiptEmailService.sendReceiptEmail !== "function") {
      return res.status(501).json({
        ok: false,
        error: "Receipt email service is not available.",
      });
    }

    const targetEmail =
      clean(req.body?.email, 190) ||
      receipt.email_snapshot ||
      (!isFinance(req) ? userEmail(req) : "");

    if (!targetEmail) {
      return res.status(400).json({
        ok: false,
        error: "Receipt email address is required.",
      });
    }

    if (!isFinance(req)) {
      const allowedEmail = userEmail(req);
      const receiptEmail = clean(receipt.email_snapshot || "", 190).toLowerCase();

      if (
        targetEmail.toLowerCase() !== allowedEmail &&
        targetEmail.toLowerCase() !== receiptEmail
      ) {
        return res.status(403).json({
          ok: false,
          error: "Members can only resend receipts to their account or receipt email.",
        });
      }
    }

    const result = await receiptEmailService.sendReceiptEmail(receipt.id, {
      email: targetEmail,
      to: targetEmail,
      resent_by: actorId(req),
      source: "member_receipts",
    });

    return res.json({
      ok: true,
      message: "Receipt email sent.",
      result,
    });
  } catch (err) {
    console.error("member receipt resend error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to resend receipt.",
    });
  }
});

module.exports = router;