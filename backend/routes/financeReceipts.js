// backend/routes/financeReceipts.js
"use strict";

const express = require("express");
const fsp = require("fs/promises");
const path = require("path");

const db = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const exportService = require("../services/domains/export/exportService");

function optionalRequire(modulePath) {
  try {
    return require(modulePath);
  } catch (err) {
    if (err?.code !== "MODULE_NOT_FOUND") {
      console.error(`Failed loading ${modulePath}:`, err.message);
    }

    return {};
  }
}

const receiptService = optionalRequire("../services/domains/receipts/receiptService");
const receiptPdfService = optionalRequire("../services/domains/receipts/receiptPdfService");
const receiptEmailService = optionalRequire("../services/domains/receipts/receiptEmailService");

const router = express.Router();

const META_TTL_MS = 60 * 1000;
const metaCache = new Map();

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/receipts/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "financeReceipts",
    version: "enterprise",
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* Security                                                                   */
/* -------------------------------------------------------------------------- */

router.use(authRequired);

router.use(
  requireRole(
    "finance",
    "admin",
    "super_admin",
    "reconciliation"
  )
);

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clean(value, max = 500) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function money(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function actorId(req) {
  return (
    req.user?.id ||
    req.user?.user_id ||
    req.user?.member_id ||
    req.userId ||
    null
  );
}

function actorName(req) {
  return (
    req.user?.full_name ||
    req.user?.name ||
    req.user?.username ||
    req.user?.email ||
    "system"
  );
}

function clientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    ""
  );
}

function sqlId(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(String(name || ""))) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }

  return `\`${name}\``;
}

function has(columns, column) {
  return columns?.has(column);
}

function col(alias, column) {
  return `${alias}.${sqlId(column)}`;
}

function coalesce(parts, fallback = "NULL") {
  const usable = parts.filter(Boolean);

  return usable.length
    ? `COALESCE(${usable.join(", ")}, ${fallback})`
    : fallback;
}

function firstExpr(alias, columns, candidates, fallback = "NULL") {
  return coalesce(
    candidates
      .filter((candidate) => has(columns, candidate))
      .map((candidate) => col(alias, candidate)),
    fallback
  );
}

function amountExpr(alias, columns, candidates, fallback = "0") {
  return `CAST(${firstExpr(alias, columns, candidates, fallback)} AS DECIMAL(18,2))`;
}

async function columnsFor(tableName) {
  const cached = metaCache.get(tableName);

  if (cached && Date.now() - cached.loadedAt < META_TTL_MS) {
    return cached.columns;
  }

  try {
    const [rows] = await db.query(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      `,
      [tableName]
    );

    const columns = new Set(rows.map((row) => row.COLUMN_NAME));

    metaCache.set(tableName, {
      columns,
      loadedAt: Date.now(),
    });

    return columns;
  } catch {
    const columns = new Set();

    metaCache.set(tableName, {
      columns,
      loadedAt: Date.now(),
    });

    return columns;
  }
}

async function tableExists(tableName) {
  const columns = await columnsFor(tableName);
  return columns.size > 0;
}

async function firstExistingTable(names) {
  for (const name of names) {
    if (await tableExists(name)) return name;
  }

  return null;
}

function safePdfFileName(value) {
  return `${clean(value || "receipt", 140)
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")}.pdf`;
}

function paginationFrom(result, req) {
  const page = Number(result?.pagination?.page || req.query.page || 1);
  const limit = Number(result?.pagination?.limit || req.query.limit || req.query.pageSize || 25);
  const total = Number(result?.pagination?.total || result?.total || 0);
  const pages = Number(result?.pagination?.pages || Math.max(Math.ceil(total / Math.max(limit, 1)), 1));

  return {
    page,
    limit,
    total,
    pages,
  };
}

function routeError(res, err, fallback, status = 500) {
  console.error(fallback, err);

  return res.status(err.status || err.statusCode || status).json({
    ok: false,
    error: err.status || err.statusCode ? err.message : err.message || fallback,
  });
}

/* -------------------------------------------------------------------------- */
/* Dynamic Updates / Audit                                                    */
/* -------------------------------------------------------------------------- */

async function updateReceiptDynamic(receiptId, valuesByColumn) {
  const columns = await columnsFor("tbl_finance_receipts");
  const sets = [];
  const values = [];

  for (const [column, value] of Object.entries(valuesByColumn || {})) {
    if (!has(columns, column) || value === undefined) continue;

    if (value === "__NOW__") {
      sets.push(`${sqlId(column)} = NOW()`);
    } else {
      sets.push(`${sqlId(column)} = ?`);
      values.push(value);
    }
  }

  if (has(columns, "updated_at")) {
    sets.push("`updated_at` = NOW()");
  }

  if (!sets.length) return false;

  values.push(receiptId);

  await db.query(
    `
    UPDATE tbl_finance_receipts
    SET ${sets.join(", ")}
    WHERE id = ?
    `,
    values
  );

  return true;
}

async function writeAudit(req, action, receipt, details = {}) {
  try {
    const tableName = await firstExistingTable([
      "tbl_audit_logs",
      "tbl_finance_audit_logs",
      "tbl_finance_audit_log",
    ]);

    if (!tableName) return;

    const columns = await columnsFor(tableName);
    const insertColumns = [];
    const placeholders = [];
    const values = [];

    function add(column, value) {
      if (!has(columns, column)) return;
      insertColumns.push(sqlId(column));
      placeholders.push("?");
      values.push(value);
    }

    function addNow(column) {
      if (!has(columns, column)) return;
      insertColumns.push(sqlId(column));
      placeholders.push("NOW()");
    }

    add("user_id", actorId(req));
    add("actor_id", actorId(req));
    add("created_by", actorId(req));
    add("actor_name", actorName(req));
    add("user_name", actorName(req));
    add("created_by_name", actorName(req));

    add("module", "finance_receipts");
    add("entity_type", "receipt");
    add("entity_id", receipt?.id || receipt?.receipt_id || null);
    add("receipt_id", receipt?.id || receipt?.receipt_id || null);
    add("invoice_id", receipt?.invoice_id || null);
    add("payment_id", receipt?.payment_id || null);

    add("action", action);
    add("event_type", action);
    add("description", `Receipt action: ${action}`);
    add("status", "success");
    add("severity", "info");
    add("ip_address", clientIp(req));
    add("user_agent", req.headers["user-agent"] || null);

    add("details", JSON.stringify(details));
    add("details_json", JSON.stringify(details));
    add("metadata_json", JSON.stringify(details));

    addNow("created_at");
    addNow("updated_at");

    if (!insertColumns.length) return;

    await db.query(
      `
      INSERT INTO ${sqlId(tableName)}
      (${insertColumns.join(", ")})
      VALUES (${placeholders.join(", ")})
      `,
      values
    );
  } catch (err) {
    console.error("receipt audit write failed:", err.message);
  }
}

/* -------------------------------------------------------------------------- */
/* Load Receipt                                                               */
/* -------------------------------------------------------------------------- */

async function getReceiptByIdSafe(receiptId) {
  if (typeof receiptService.getReceiptById === "function") {
    const row = await receiptService.getReceiptById(receiptId);
    if (row) return row;
  }

  const [[receipt]] = await db.query(
    `
    SELECT *
    FROM tbl_finance_receipts
    WHERE id = ?
    LIMIT 1
    `,
    [receiptId]
  );

  return receipt || null;
}

async function getReceiptByNumberSafe(receiptNumber) {
  if (typeof receiptService.getReceiptByNumber === "function") {
    const row = await receiptService.getReceiptByNumber(receiptNumber);
    if (row) return row;
  }

  const [[receipt]] = await db.query(
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

async function loadReceiptOr404(req, res) {
  const receiptId = safeNumber(req.params.id);

  if (!receiptId) {
    res.status(400).json({
      ok: false,
      error: "Invalid receipt ID.",
    });
    return null;
  }

  const receipt = await getReceiptByIdSafe(receiptId);

  if (!receipt) {
    res.status(404).json({
      ok: false,
      error: "Receipt not found.",
    });
    return null;
  }

  return receipt;
}

async function loadReceiptDetails(receipt) {
  let payment = null;
  let invoice = null;

  if (receipt.payment_id) {
    const [[row]] = await db.query(
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
    const [[row]] = await db.query(
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
  const { payment, invoice } = await loadReceiptDetails(receipt);

  return {
    ...(invoice || {}),
    ...(payment || {}),
    ...receipt,

    id: receipt.id,
    receipt_id: receipt.id,
    receipt_number: receipt.receipt_number,

    payment_id: receipt.payment_id || payment?.id || null,
    invoice_id: receipt.invoice_id || payment?.invoice_id || invoice?.id || null,

    payment_number:
      receipt.payment_number ||
      payment?.payment_number ||
      null,

    invoice_number:
      receipt.invoice_number ||
      invoice?.invoice_number ||
      null,

    member_id:
      receipt.member_id ||
      payment?.member_id ||
      invoice?.member_id ||
      null,

    member_no:
      receipt.member_no ||
      payment?.member_no ||
      invoice?.member_no ||
      null,

    full_name_snapshot:
      receipt.full_name_snapshot ||
      payment?.full_name_snapshot ||
      invoice?.full_name_snapshot ||
      receipt.paid_by ||
      payment?.payer_name ||
      invoice?.payer_name ||
      "Guest Donor",

    email_snapshot:
      receipt.email_snapshot ||
      payment?.email_snapshot ||
      invoice?.email_snapshot ||
      receipt.emailed_to ||
      payment?.payer_email ||
      invoice?.payer_email ||
      null,

    phone_snapshot:
      receipt.phone_snapshot ||
      payment?.phone_snapshot ||
      invoice?.phone_snapshot ||
      payment?.payer_phone ||
      invoice?.payer_phone ||
      null,

    amount:
      receipt.amount ||
      receipt.receipt_amount ||
      payment?.amount ||
      invoice?.paid_amount ||
      invoice?.total_amount ||
      0,

    payment_method:
      receipt.payment_method ||
      receipt.method ||
      payment?.method ||
      payment?.payment_method ||
      null,

    reference_no:
      receipt.reference_no ||
      receipt.reference_number ||
      payment?.reference_no ||
      payment?.transaction_reference ||
      invoice?.reference_no ||
      null,
  };
}

/* -------------------------------------------------------------------------- */
/* Listing / Stats                                                            */
/* -------------------------------------------------------------------------- */

function buildFallbackFilterSql(columns, query) {
  const where = [];
  const params = [];

  function addId(column, value) {
    if (!has(columns, column) || !value) return;
    where.push(`r.${sqlId(column)} = ?`);
    params.push(value);
  }

  addId("member_id", query.member_id);
  addId("payment_id", query.payment_id);
  addId("invoice_id", query.invoice_id);
  addId("pledge_id", query.pledge_id);
  addId("campaign_id", query.campaign_id);

  const categoryExpr = firstExpr("r", columns, ["category", "payment_type", "donation_category", "receipt_type"], "NULL");
  const methodExpr = firstExpr("r", columns, ["payment_method", "method"], "NULL");
  const statusExpr = firstExpr("r", columns, ["status", "receipt_status"], "NULL");
  const emailStatusExpr = firstExpr("r", columns, ["email_status", "delivery_status"], "NULL");
  const dateSql = firstExpr("r", columns, ["issued_at", "receipt_date", "sent_at", "created_at"], "NULL");
  const amountSql = amountExpr("r", columns, ["amount", "receipt_amount", "total_amount"], "0");

  if (query.category) {
    where.push(`LOWER(${categoryExpr}) = ?`);
    params.push(clean(query.category, 80).toLowerCase());
  }

  if (query.method) {
    where.push(`LOWER(${methodExpr}) = ?`);
    params.push(clean(query.method, 80).toLowerCase());
  }

  if (query.status) {
    where.push(`LOWER(${statusExpr}) = ?`);
    params.push(clean(query.status, 80).toLowerCase());
  }

  if (query.email_status) {
    where.push(`LOWER(${emailStatusExpr}) = ?`);
    params.push(clean(query.email_status, 80).toLowerCase());
  }

  if (query.date_from && dateSql !== "NULL") {
    where.push(`DATE(${dateSql}) >= DATE(?)`);
    params.push(query.date_from);
  }

  if (query.date_to && dateSql !== "NULL") {
    where.push(`DATE(${dateSql}) <= DATE(?)`);
    params.push(query.date_to);
  }

  if (query.amount_min) {
    where.push(`${amountSql} >= ?`);
    params.push(money(query.amount_min));
  }

  if (query.amount_max) {
    where.push(`${amountSql} <= ?`);
    params.push(money(query.amount_max));
  }

  if (query.search) {
    const expressions = [
      firstExpr("r", columns, ["receipt_number", "receipt_no"], "NULL"),
      firstExpr("r", columns, ["payment_number"], "NULL"),
      firstExpr("r", columns, ["invoice_number"], "NULL"),
      firstExpr("r", columns, ["reference_no", "reference_number", "transaction_reference"], "NULL"),
      firstExpr("r", columns, ["full_name_snapshot", "full_name", "paid_by", "member_name", "donor_name", "guest_name"], "NULL"),
      firstExpr("r", columns, ["email_snapshot", "email", "emailed_to", "recipient_email"], "NULL"),
      firstExpr("r", columns, ["member_no", "member_number"], "NULL"),
    ].filter((expr) => expr !== "NULL");

    if (expressions.length) {
      where.push(`(${expressions.map((expr) => `${expr} LIKE ?`).join(" OR ")})`);
      expressions.forEach(() => params.push(`%${query.search}%`));
    }
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
    amountSql,
    dateSql,
    emailStatusExpr,
  };
}

async function listReceiptsFallback(filters = {}) {
  const columns = await columnsFor("tbl_finance_receipts");

  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.min(500, Math.max(1, Number(filters.limit || 25)));
  const offset = (page - 1) * limit;

  const {
    whereSql,
    params,
    amountSql,
    dateSql,
    emailStatusExpr,
  } = buildFallbackFilterSql(columns, filters);

  const receiptNumberSql = firstExpr("r", columns, ["receipt_number", "receipt_no"], "CONCAT('RCPT-', r.id)");
  const paymentNumberSql = firstExpr("r", columns, ["payment_number"], "NULL");
  const invoiceNumberSql = firstExpr("r", columns, ["invoice_number"], "NULL");
  const payerNameSql = firstExpr("r", columns, ["full_name_snapshot", "full_name", "paid_by", "member_name", "donor_name", "guest_name"], "'Guest Donor'");
  const payerEmailSql = firstExpr("r", columns, ["email_snapshot", "email", "emailed_to", "recipient_email"], "NULL");
  const memberNoSql = firstExpr("r", columns, ["member_no", "member_number"], "NULL");
  const methodSql = firstExpr("r", columns, ["payment_method", "method"], "NULL");
  const categorySql = firstExpr("r", columns, ["category", "payment_type", "donation_category", "receipt_type"], "NULL");
  const statusSql = firstExpr("r", columns, ["status", "receipt_status"], "'issued'");
  const referenceSql = firstExpr("r", columns, ["reference_no", "reference_number", "transaction_reference"], "NULL");

  const [[countRow]] = await db.query(
    `
    SELECT COUNT(*) AS total
    FROM tbl_finance_receipts r
    ${whereSql}
    `,
    params
  );

  const [[summary]] = await db.query(
    `
    SELECT
      COUNT(*) AS total_receipts,
      COALESCE(SUM(${amountSql}), 0) AS total_amount,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(${emailStatusExpr}, '')) IN ('sent', 'delivered') THEN 1 ELSE 0 END), 0) AS email_sent_count,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(${emailStatusExpr}, '')) IN ('failed', 'bounced') THEN 1 ELSE 0 END), 0) AS email_failed_count
    FROM tbl_finance_receipts r
    ${whereSql}
    `,
    params
  );

  const [rows] = await db.query(
    `
    SELECT
      r.*,
      ${receiptNumberSql} AS receipt_number,
      ${paymentNumberSql} AS payment_number,
      ${invoiceNumberSql} AS invoice_number,
      ${payerNameSql} AS full_name_snapshot,
      ${payerEmailSql} AS email_snapshot,
      ${memberNoSql} AS member_no,
      ${amountSql} AS amount,
      ${methodSql} AS payment_method,
      ${categorySql} AS category,
      ${statusSql} AS status,
      ${emailStatusExpr} AS email_status,
      ${dateSql} AS issued_at,
      ${referenceSql} AS reference_no
    FROM tbl_finance_receipts r
    ${whereSql}
    ORDER BY ${dateSql} DESC, r.id DESC
    LIMIT ?
    OFFSET ?
    `,
    [...params, limit, offset]
  );

  const total = Number(countRow?.total || 0);

  return {
    rows,
    summary: {
      total_receipts: Number(summary?.total_receipts || 0),
      total_amount: money(summary?.total_amount || 0),
      email_sent_count: Number(summary?.email_sent_count || 0),
      email_failed_count: Number(summary?.email_failed_count || 0),
    },
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function listReceiptsEnterprise(filters = {}) {
  if (typeof receiptService.listReceipts === "function") {
    return receiptService.listReceipts(filters);
  }

  return listReceiptsFallback(filters);
}

async function getReceiptStatsEnterprise(filters = {}) {
  if (typeof receiptService.getReceiptStats === "function") {
    return receiptService.getReceiptStats(filters);
  }

  const result = await listReceiptsFallback({
    ...filters,
    page: 1,
    limit: 1,
  });

  return result.summary || {};
}

function requestFilters(req) {
  return {
    member_id: req.query.member_id || req.query.memberId || null,
    payment_id: req.query.payment_id || req.query.paymentId || null,
    invoice_id: req.query.invoice_id || req.query.invoiceId || null,
    pledge_id: req.query.pledge_id || req.query.pledgeId || null,
    campaign_id: req.query.campaign_id || req.query.campaignId || null,

    category: req.query.category || null,
    method: req.query.method || req.query.payment_method || null,
    status: req.query.status || null,
    email_status: req.query.email_status || req.query.emailStatus || null,

    date_from: req.query.date_from || req.query.dateFrom || req.query.from || null,
    date_to: req.query.date_to || req.query.dateTo || req.query.to || null,
    amount_min: req.query.amount_min || req.query.amountMin || null,
    amount_max: req.query.amount_max || req.query.amountMax || null,

    search: req.query.search || req.query.q || "",
    page: req.query.page || 1,
    limit: req.query.limit || req.query.pageSize || 25,
    sort: req.query.sort || null,
    direction: req.query.direction || req.query.order || null,
  };
}

/* -------------------------------------------------------------------------- */
/* PDF                                                                        */
/* -------------------------------------------------------------------------- */

async function buildPdfResult(req, receipt, options = {}) {
  const pdfData = await buildReceiptPdfData(receipt);

  let result = null;

  if (typeof receiptPdfService.generateReceiptPdfBuffer === "function") {
    const buffer = await receiptPdfService.generateReceiptPdfBuffer(pdfData, {
      requested_by: actorId(req),
      source: "finance_receipts",
      ...options,
    });

    result = {
      buffer,
      filename: safePdfFileName(receipt.receipt_number || `receipt-${receipt.id}`),
    };
  } else if (typeof receiptPdfService.generateReceiptPdf === "function") {
    result = await receiptPdfService.generateReceiptPdf(pdfData, {
      requested_by: actorId(req),
      source: "finance_receipts",
      ...options,
    });
  } else {
    throw new Error("Receipt PDF service is not available.");
  }

  if (result?.pdf_url) {
    await updateReceiptDynamic(receipt.id, {
      pdf_url: result.pdf_url,
      receipt_pdf_url: result.pdf_url,
    }).catch((err) => {
      console.error("receipt pdf url update failed:", err.message);
    });
  }

  return result;
}

async function sendPdfResponse(req, res, receipt, disposition = "inline") {
  const result = await buildPdfResult(req, receipt, {
    download: disposition === "attachment",
  });

  const filename =
    result?.filename ||
    safePdfFileName(receipt.receipt_number || `receipt-${receipt.id}`);

  const buffer =
    Buffer.isBuffer(result)
      ? result
      : result?.buffer ||
        result?.pdfBuffer ||
        result?.data ||
        null;

  if (buffer) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(buffer);
  }

  const filePath = result?.file_path || result?.path;

  if (filePath) {
    const resolved = path.resolve(filePath);
    const fileBuffer = await fsp.readFile(resolved);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${result?.filename || path.basename(resolved)}"`);
    res.setHeader("Cache-Control", "private, no-store");

    return res.send(fileBuffer);
  }

  throw new Error("Receipt PDF could not be generated.");
}

/* -------------------------------------------------------------------------- */
/* Routes: List / Stats / Export                                              */
/* -------------------------------------------------------------------------- */

router.get("/receipts", async (req, res) => {
  try {
    const result = await listReceiptsEnterprise(requestFilters(req));
    const pagination = paginationFrom(result, req);

    return res.json({
      ok: true,
      rows: Array.isArray(result?.rows) ? result.rows : [],
      receipts: Array.isArray(result?.rows) ? result.rows : [],
      summary: result?.summary || {},
      stats: result?.summary || {},
      pagination,
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: pagination.pages,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load receipts.");
  }
});

router.get("/receipts/stats", async (req, res) => {
  try {
    const stats = await getReceiptStatsEnterprise(requestFilters(req));

    return res.json({
      ok: true,
      stats,
      summary: stats,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load receipt stats.");
  }
});

router.get("/receipts/export", async (req, res) => {
  try {
    const format = clean(req.query.format || "xlsx", 20).toLowerCase();
    const result = await listReceiptsEnterprise({
      ...requestFilters(req),
      page: 1,
      limit: req.query.limit || 5000,
    });

    const rows = Array.isArray(result?.rows) ? result.rows : [];

    let exportResult;

    if (format === "csv") {
      exportResult = await exportService.exportCsv({
        rows,
        fileName: "finance-receipts",
      });
    } else if (format === "json") {
      exportResult = await exportService.exportJson({
        rows,
        fileName: "finance-receipts",
        summary: result.summary || {},
      });
    } else {
      exportResult = await exportService.exportExcel({
        rows,
        fileName: "finance-receipts",
        sheetName: "Receipts",
        summary: result.summary || {},
      });
    }

    return res.json({
      ok: true,
      export: exportResult,
    });
  } catch (err) {
    return routeError(res, err, "Failed to export receipts.");
  }
});

router.get("/receipts/export/csv", async (req, res) => {
  try {
    const result = await listReceiptsEnterprise({
      ...requestFilters(req),
      page: 1,
      limit: req.query.limit || 5000,
    });

    const rows = Array.isArray(result?.rows) ? result.rows : [];

    const headers = [
      "Receipt #",
      "Payment #",
      "Invoice #",
      "Payer",
      "Member #",
      "Email",
      "Amount",
      "Method",
      "Category",
      "Status",
      "Email Status",
      "Date",
      "Reference #",
    ];

    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

    const lines = [
      headers.join(","),
      ...rows.map((row) =>
        [
          row.receipt_number,
          row.payment_number,
          row.invoice_number,
          row.full_name_snapshot || row.full_name || row.member_name,
          row.member_no,
          row.email_snapshot || row.email,
          row.amount,
          row.payment_method || row.method,
          row.category || row.payment_type || row.donation_category,
          row.status || row.receipt_status,
          row.email_status || row.delivery_status,
          row.issued_at || row.created_at,
          row.reference_no || row.reference_number || row.transaction_reference,
        ].map(escape).join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="finance-receipts.csv"');

    return res.send(`\uFEFF${lines.join("\n")}`);
  } catch (err) {
    return routeError(res, err, "Failed to export receipt CSV.");
  }
});

/* -------------------------------------------------------------------------- */
/* Routes: Single Receipt                                                     */
/* -------------------------------------------------------------------------- */

router.get("/receipts/number/:receiptNumber", async (req, res) => {
  try {
    const receipt = await getReceiptByNumberSafe(req.params.receiptNumber);

    if (!receipt) {
      return res.status(404).json({
        ok: false,
        error: "Receipt not found.",
      });
    }

    const details = await loadReceiptDetails(receipt);

    return res.json({
      ok: true,
      ...details,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load receipt.");
  }
});

router.get("/receipts/:id", async (req, res) => {
  try {
    const receipt = await loadReceiptOr404(req, res);
    if (!receipt) return;

    const details = await loadReceiptDetails(receipt);

    return res.json({
      ok: true,
      ...details,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load receipt.");
  }
});

/* -------------------------------------------------------------------------- */
/* Routes: PDF                                                                */
/* -------------------------------------------------------------------------- */

router.post("/receipts/:id/pdf", async (req, res) => {
  try {
    const receipt = await loadReceiptOr404(req, res);
    if (!receipt) return;

    const pdf = await buildPdfResult(req, receipt, {
      download: Boolean(req.body?.download),
    });

    await writeAudit(req, "generated_receipt_pdf", receipt, {
      receipt_id: receipt.id,
      receipt_number: receipt.receipt_number,
      pdf_url: pdf?.pdf_url || null,
      filename: pdf?.filename || null,
    });

    return res.json({
      ok: true,
      pdf,
      receipt_id: receipt.id,
      receipt_number: receipt.receipt_number,
    });
  } catch (err) {
    return routeError(res, err, "Failed to generate receipt PDF.");
  }
});

router.get("/receipts/:id/pdf", async (req, res) => {
  try {
    const receipt = await loadReceiptOr404(req, res);
    if (!receipt) return;

    await writeAudit(req, "viewed_receipt_pdf", receipt, {
      receipt_id: receipt.id,
      receipt_number: receipt.receipt_number,
    });

    const disposition =
      String(req.query.download || "").toLowerCase() === "1" ||
      String(req.query.disposition || "").toLowerCase() === "attachment"
        ? "attachment"
        : "inline";

    return sendPdfResponse(req, res, receipt, disposition);
  } catch (err) {
    return routeError(res, err, "Failed to open receipt PDF.");
  }
});

router.get("/receipts/:id/download", async (req, res) => {
  try {
    const receipt = await loadReceiptOr404(req, res);
    if (!receipt) return;

    await writeAudit(req, "downloaded_receipt_pdf", receipt, {
      receipt_id: receipt.id,
      receipt_number: receipt.receipt_number,
    });

    return sendPdfResponse(req, res, receipt, "attachment");
  } catch (err) {
    return routeError(res, err, "Failed to download receipt PDF.");
  }
});

router.get("/receipts/:id/print", async (req, res) => {
  try {
    const receipt = await loadReceiptOr404(req, res);
    if (!receipt) return;

    await writeAudit(req, "printed_receipt_pdf", receipt, {
      receipt_id: receipt.id,
      receipt_number: receipt.receipt_number,
    });

    return sendPdfResponse(req, res, receipt, "inline");
  } catch (err) {
    return routeError(res, err, "Failed to print receipt.");
  }
});

/* -------------------------------------------------------------------------- */
/* Routes: Email                                                              */
/* -------------------------------------------------------------------------- */

async function sendReceiptEmailAction(req, receipt, options = {}) {
  if (typeof receiptEmailService.sendReceiptEmail !== "function") {
    throw new Error("Receipt email service is not available.");
  }

  const result = await receiptEmailService.sendReceiptEmail(receipt.id, {
    email: options.email || null,
    to: options.email || null,
    cc: options.cc || null,
    bcc: options.bcc || null,
    subject: options.subject || null,
    resend: Boolean(options.resend),
    source: options.source || "finance_receipts_route",
    requested_by: actorId(req),
  });

  await updateReceiptDynamic(receipt.id, {
    email_status: result?.success ? "sent" : "failed",
    delivery_status: result?.success ? "sent" : "failed",
    emailed_to: result?.to || options.email || receipt.email_snapshot || null,
    last_emailed_to: result?.to || options.email || receipt.email_snapshot || null,
    emailed_at: result?.success ? "__NOW__" : undefined,
    sent_at: result?.success ? "__NOW__" : undefined,
    last_emailed_at: result?.success ? "__NOW__" : undefined,
    email_error: result?.success ? null : result?.error || "Email failed.",
    last_email_error: result?.success ? null : result?.error || "Email failed.",
  }).catch((err) => {
    console.error("receipt email status update failed:", err.message);
  });

  return result;
}

router.post("/receipts/:id/send-email", async (req, res) => {
  try {
    const receipt = await loadReceiptOr404(req, res);
    if (!receipt) return;

    const result = await sendReceiptEmailAction(req, receipt, {
      email: req.body?.email || req.body?.to || null,
      cc: req.body?.cc || null,
      bcc: req.body?.bcc || null,
      subject: req.body?.subject || null,
      source: "finance_receipts_route_send",
    });

    await writeAudit(req, "sent_receipt_email", receipt, {
      receipt_id: receipt.id,
      receipt_number: receipt.receipt_number,
      emailed_to: result?.to || req.body?.email || req.body?.to || null,
      message_id: result?.messageId || result?.message_id || null,
    });

    return res.json({
      ok: Boolean(result?.success),
      result,
    });
  } catch (err) {
    return routeError(res, err, "Failed to send receipt email.", 400);
  }
});

router.post("/receipts/:id/resend", async (req, res) => {
  try {
    const receipt = await loadReceiptOr404(req, res);
    if (!receipt) return;

    const result = await sendReceiptEmailAction(req, receipt, {
      email: req.body?.email || req.body?.to || null,
      cc: req.body?.cc || null,
      bcc: req.body?.bcc || null,
      subject: req.body?.subject || null,
      resend: true,
      source: "finance_receipts_route_resend",
    });

    await writeAudit(req, "resent_receipt_email", receipt, {
      receipt_id: receipt.id,
      receipt_number: receipt.receipt_number,
      emailed_to: result?.to || req.body?.email || req.body?.to || null,
      message_id: result?.messageId || result?.message_id || null,
    });

    return res.json({
      ok: Boolean(result?.success),
      result,
    });
  } catch (err) {
    return routeError(res, err, "Failed to resend receipt.", 400);
  }
});

router.post("/receipts/payment/:paymentId/resend", async (req, res) => {
  try {
    const paymentId = safeNumber(req.params.paymentId);

    if (!paymentId) {
      return res.status(400).json({
        ok: false,
        error: "Invalid payment ID.",
      });
    }

    if (typeof receiptEmailService.sendReceiptEmailByPayment !== "function") {
      throw new Error("Receipt email by payment is not available.");
    }

    const result = await receiptEmailService.sendReceiptEmailByPayment(paymentId, {
      email: req.body?.email || req.body?.to || null,
      to: req.body?.email || req.body?.to || null,
      cc: req.body?.cc || null,
      bcc: req.body?.bcc || null,
      subject: req.body?.subject || null,
      resend: true,
      source: "finance_receipts_route_payment_resend",
      requested_by: actorId(req),
    });

    await writeAudit(
      req,
      "resent_receipt_email_by_payment",
      { payment_id: paymentId },
      {
        payment_id: paymentId,
        emailed_to: result?.to || req.body?.email || req.body?.to || null,
        message_id: result?.messageId || result?.message_id || null,
      }
    );

    return res.json({
      ok: Boolean(result?.success),
      result,
    });
  } catch (err) {
    return routeError(res, err, "Failed to resend receipt.", 400);
  }
});

router.post("/receipts/:id/mark-sent", async (req, res) => {
  try {
    const receipt = await loadReceiptOr404(req, res);
    if (!receipt) return;

    const emailedTo =
      clean(req.body?.email || req.body?.emailed_to || receipt.emailed_to || receipt.email_snapshot || "") ||
      null;

    await updateReceiptDynamic(receipt.id, {
      email_status: "sent",
      delivery_status: "sent",
      emailed_to: emailedTo,
      last_emailed_to: emailedTo,
      emailed_at: "__NOW__",
      sent_at: "__NOW__",
      last_emailed_at: "__NOW__",
      email_error: null,
      last_email_error: null,
      updated_by: actorId(req),
    });

    await writeAudit(req, "marked_receipt_email_sent", receipt, {
      receipt_id: receipt.id,
      receipt_number: receipt.receipt_number,
      emailed_to: emailedTo,
      note: clean(req.body?.note || req.body?.notes || "", 1000),
    });

    return res.json({
      ok: true,
      receipt_id: receipt.id,
      email_status: "sent",
      emailed_to: emailedTo,
    });
  } catch (err) {
    return routeError(res, err, "Failed to mark receipt as sent.", 400);
  }
});

/* -------------------------------------------------------------------------- */
/* Routes: Status                                                             */
/* -------------------------------------------------------------------------- */

router.patch("/receipts/:id/status", async (req, res) => {
  try {
    const receipt = await loadReceiptOr404(req, res);
    if (!receipt) return;

    const status = clean(req.body?.status, 40).toLowerCase();

    const allowed = new Set([
      "issued",
      "sent",
      "paid",
      "void",
      "voided",
      "cancelled",
      "canceled",
      "failed",
    ]);

    if (!allowed.has(status)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid receipt status.",
      });
    }

    const normalized = status === "canceled" ? "cancelled" : status;

    await updateReceiptDynamic(receipt.id, {
      status: normalized,
      receipt_status: normalized,
      void_reason:
        normalized === "void" || normalized === "voided"
          ? clean(req.body?.reason || req.body?.note || "", 1000)
          : undefined,
      cancelled_reason:
        normalized === "cancelled"
          ? clean(req.body?.reason || req.body?.note || "", 1000)
          : undefined,
      updated_by: actorId(req),
    });

    await writeAudit(req, "updated_receipt_status", receipt, {
      receipt_id: receipt.id,
      receipt_number: receipt.receipt_number,
      status: normalized,
      reason: clean(req.body?.reason || req.body?.note || "", 1000),
    });

    return res.json({
      ok: true,
      receipt_id: receipt.id,
      status: normalized,
    });
  } catch (err) {
    return routeError(res, err, "Failed to update receipt status.", 400);
  }
});

module.exports = router;