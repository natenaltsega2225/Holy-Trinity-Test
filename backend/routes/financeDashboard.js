// backend/routes/financeDashboard.js
"use strict";

const express = require("express");
const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

function optionalRequire(modulePath, fallback = {}) {
  try {
    return require(modulePath);
  } catch (err) {
    console.error(`Optional dashboard dependency not loaded: ${modulePath}`, err.message);
    return fallback;
  }
}

const executiveKpiService = optionalRequire(
  "../services/domains/reports/executiveKpiService"
);

const financeReportService = optionalRequire(
  "../services/domains/reports/financeReportService"
);

const auditReportService = optionalRequire(
  "../services/domains/reports/auditTrailReportingService"
);

const router = express.Router();

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

const dashboardColumnCache = new Map();

function normalizeLimit(value, fallback = 10, max = 100) {
  return Math.min(max, Math.max(1, Number(value || fallback)));
}

function routeError(res, err, fallback) {
  console.error(fallback, err);

  return res.status(err.status || err.statusCode || 500).json({
    ok: false,
    error: err.status || err.statusCode ? err.message : fallback,
  });
}

function dateFilters(req) {
  return {
    date_from: req.query.date_from || req.query.from || req.query.start_date || "",
    date_to: req.query.date_to || req.query.to || req.query.end_date || "",
  };
}

async function dashboardColumnsFor(tableName) {
  const cached = dashboardColumnCache.get(tableName);

  if (cached) return cached;

  const [rows] = await pool.query(
    `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    `,
    [tableName]
  );

  const columns = new Set(rows.map((row) => row.COLUMN_NAME));
  dashboardColumnCache.set(tableName, columns);

  return columns;
}

function dashSqlId(value) {
  if (!/^[a-zA-Z0-9_]+$/.test(String(value || ""))) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }

  return `\`${value}\``;
}

function dashHas(columns, column) {
  return columns && columns.has(column);
}

function dashFirstColumn(columns, candidates = []) {
  return candidates.find((column) => dashHas(columns, column)) || null;
}

function dashTextExpr(columns, alias, candidates = [], fallback = "'--'") {
  const parts = candidates
    .filter((column) => dashHas(columns, column))
    .map((column) => `NULLIF(${alias}.${dashSqlId(column)}, '')`);

  return parts.length
    ? `COALESCE(${parts.join(", ")}, ${fallback})`
    : fallback;
}

function dashNumberExpr(columns, alias, candidates = [], fallback = "0") {
  const parts = candidates
    .filter((column) => dashHas(columns, column))
    .map((column) => `${alias}.${dashSqlId(column)}`);

  return parts.length
    ? `COALESCE(${parts.join(", ")}, ${fallback})`
    : fallback;
}

function dashDateExpr(columns, alias, candidates = []) {
  const column = dashFirstColumn(columns, candidates);
  return column ? `${alias}.${dashSqlId(column)}` : "NULL";
}

function dashDateCoalesceExpr(columns, alias, candidates = []) {
  const parts = candidates
    .filter((column) => dashHas(columns, column))
    .map((column) => `${alias}.${dashSqlId(column)}`);

  if (!parts.length) return "NULL";
  if (parts.length === 1) return parts[0];

  return `COALESCE(${parts.join(", ")})`;
}

function dashMultiTextExpr(sources = [], fallback = "'--'") {
  const parts = [];

  for (const source of sources) {
    for (const column of source.candidates || []) {
      if (dashHas(source.columns, column)) {
        parts.push(`NULLIF(${source.alias}.${dashSqlId(column)}, '')`);
      }
    }
  }

  return parts.length
    ? `COALESCE(${parts.join(", ")}, ${fallback})`
    : fallback;
}

function dashMultiNumberExpr(sources = [], fallback = "0") {
  const parts = [];

  for (const source of sources) {
    for (const column of source.candidates || []) {
      if (dashHas(source.columns, column)) {
        parts.push(`${source.alias}.${dashSqlId(column)}`);
      }
    }
  }

  return parts.length
    ? `COALESCE(${parts.join(", ")}, ${fallback})`
    : fallback;
}

function paidStatusWhere(columns, alias) {
  const statusColumn = dashFirstColumn(columns, [
    "status",
    "payment_status",
    "ledger_status",
  ]);

  if (!statusColumn) return "1=1";

  return `
    LOWER(COALESCE(${alias}.${dashSqlId(statusColumn)}, '')) IN
    ('paid', 'completed', 'posted', 'succeeded', 'success', 'approved')
  `;
}

async function safeCall(label, fn, fallback) {
  try {
    if (typeof fn !== "function") return fallback;
    return await fn();
  } catch (err) {
    console.error(`${label} failed:`, err.message);
    return fallback;
  }
}

function emptyKpis() {
  return {
    cards: [],
    revenue: {
      by_category: [],
      by_method: [],
    },
    members: {},
    invoices: {},
    pledges: {},
    programs: {},
    emails: {},
  };
}

function emptyReport() {
  return {
    revenue_by_category: [],
    payment_methods: [],
    unpaid_members: [],
    school_registrations: [],
    trip_registrations: [],
  };
}

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/dashboard/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "financeDashboard",
    version: "enterprise",
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* Recent Activity                                                            */
/* -------------------------------------------------------------------------- */

async function getRecentPayments(limit = 10) {
  const pCols = await dashboardColumnsFor("tbl_finance_payments");
  const rCols = await dashboardColumnsFor("tbl_finance_receipts");
  const iCols = await dashboardColumnsFor("tbl_finance_invoices");

  if (!pCols.size) return [];

  const receiptJoin =
    rCols.size && dashHas(rCols, "payment_id")
      ? "LEFT JOIN tbl_finance_receipts r ON r.payment_id = p.id"
      : "";

  const invoiceJoin =
    iCols.size && dashHas(pCols, "invoice_id")
      ? "LEFT JOIN tbl_finance_invoices i ON i.id = p.invoice_id"
      : iCols.size && dashHas(iCols, "payment_id")
        ? "LEFT JOIN tbl_finance_invoices i ON i.payment_id = p.id"
        : "";

  const amountExpr = dashNumberExpr(pCols, "p", ["amount", "total_amount", "payment_amount"], "0");
  const dateExpr = dashDateCoalesceExpr(pCols, "p", ["paid_at", "payment_date", "created_at", "date"]);

  const [rows] = await pool.query(
    `
    SELECT
      p.id,

      ${dashTextExpr(pCols, "p", ["payment_number", "payment_no", "transaction_number"], "CONCAT('PAY-', p.id)")} AS payment_number,
      ${dashNumberExpr(pCols, "p", ["member_id"], "NULL")} AS member_id,
      ${dashTextExpr(pCols, "p", ["member_no", "member_number"], "'--'")} AS member_no,

      ${dashTextExpr(pCols, "p", ["full_name_snapshot", "payer_name", "donor_name", "guest_name", "full_name"], "'Guest Donor'")} AS payer_name,
      ${dashTextExpr(pCols, "p", ["email_snapshot", "payer_email", "donor_email", "guest_email", "email"], "''")} AS payer_email,

      ${dashTextExpr(pCols, "p", ["category", "payment_type", "donation_category", "type"], "'finance'")} AS category,
      ${dashTextExpr(pCols, "p", ["sub_category", "donation_category", "payment_type"], "''")} AS sub_category,

      ${amountExpr} AS amount,
      ${dashTextExpr(pCols, "p", ["method", "payment_method"], "'--'")} AS method,
      ${dashTextExpr(pCols, "p", ["provider", "payment_provider"], "'--'")} AS provider,
      ${dashTextExpr(pCols, "p", ["status", "payment_status"], "'posted'")} AS status,
      ${dashTextExpr(pCols, "p", ["reference_no", "reference_number", "transaction_reference"], "''")} AS reference_no,

      ${dashDateExpr(pCols, "p", ["created_at", "payment_date", "paid_at"])} AS created_at,
      ${dashDateExpr(pCols, "p", ["paid_at", "payment_date", "created_at"])} AS paid_at,

      ${receiptJoin ? dashTextExpr(rCols, "r", ["receipt_number", "receipt_no"], "NULL") : "NULL"} AS receipt_number,
      ${invoiceJoin ? dashTextExpr(iCols, "i", ["invoice_number", "invoice_no", "number"], "NULL") : "NULL"} AS invoice_number

    FROM tbl_finance_payments p

    ${receiptJoin}
    ${invoiceJoin}

    ORDER BY
      ${dateExpr === "NULL" ? "p.id DESC" : `${dateExpr} IS NULL ASC, ${dateExpr} DESC, p.id DESC`}

    LIMIT ?
    `,
    [limit]
  );

  return rows;
}

async function getRecentReceipts(limit = 10) {
  const rCols = await dashboardColumnsFor("tbl_finance_receipts");
  const pCols = await dashboardColumnsFor("tbl_finance_payments");

  if (!rCols.size) return [];

  const paymentJoin =
    pCols.size && dashHas(rCols, "payment_id")
      ? "LEFT JOIN tbl_finance_payments p ON p.id = r.payment_id"
      : "";

  const amountExpr = dashMultiNumberExpr(
    [
      { columns: rCols, alias: "r", candidates: ["amount", "receipt_amount", "total_amount"] },
      { columns: pCols, alias: "p", candidates: ["amount", "payment_amount", "total_amount"] },
    ],
    "0"
  );

  const dateExpr = dashDateCoalesceExpr(rCols, "r", ["issued_at", "created_at", "date"]);

  const [rows] = await pool.query(
    `
    SELECT
      r.id,

      ${dashTextExpr(rCols, "r", ["receipt_number", "receipt_no", "number"], "CONCAT('RCPT-', r.id)")} AS receipt_number,
      ${dashNumberExpr(rCols, "r", ["payment_id"], "NULL")} AS payment_id,
      ${dashNumberExpr(rCols, "r", ["invoice_id"], "NULL")} AS invoice_id,

      ${amountExpr} AS amount,

      ${dashTextExpr(rCols, "r", ["status", "receipt_status"], "'issued'")} AS status,
      ${dashTextExpr(rCols, "r", ["email_status", "receipt_email_status"], "'pending'")} AS email_status,
      ${dashTextExpr(rCols, "r", ["emailed_to", "recipient_email", "email_snapshot"], "''")} AS emailed_to,

      ${dashDateExpr(rCols, "r", ["created_at", "issued_at"])} AS created_at,
      ${dashDateExpr(rCols, "r", ["issued_at", "created_at"])} AS issued_at,

      ${paymentJoin ? dashTextExpr(pCols, "p", ["payment_number", "payment_no"], "NULL") : "NULL"} AS payment_number,

      ${dashMultiTextExpr(
        [
          { columns: rCols, alias: "r", candidates: ["full_name_snapshot", "payer_name", "donor_name", "guest_name"] },
          { columns: pCols, alias: "p", candidates: ["full_name_snapshot", "payer_name", "donor_name", "guest_name"] },
        ],
        "'Guest Donor'"
      )} AS payer_name,

      ${dashMultiTextExpr(
        [
          { columns: rCols, alias: "r", candidates: ["email_snapshot", "payer_email", "recipient_email", "donor_email"] },
          { columns: pCols, alias: "p", candidates: ["email_snapshot", "payer_email", "donor_email"] },
        ],
        "''"
      )} AS payer_email

    FROM tbl_finance_receipts r

    ${paymentJoin}

    ORDER BY
      ${dateExpr === "NULL" ? "r.id DESC" : `${dateExpr} IS NULL ASC, ${dateExpr} DESC, r.id DESC`}

    LIMIT ?
    `,
    [limit]
  );

  return rows;
}

async function getRecentInvoices(filters = {}) {
  const invoiceColumns = await dashboardColumnsFor("tbl_finance_invoices");

  if (!invoiceColumns.size) return [];

  const dateColumn = dashFirstColumn(invoiceColumns, [
    "invoice_date",
    "issued_at",
    "created_at",
    "date",
  ]);

  const totalExpr = dashNumberExpr(
    invoiceColumns,
    "i",
    ["total_amount", "amount", "invoice_amount", "subtotal"],
    "0"
  );

  const rawPaidExpr = dashNumberExpr(
    invoiceColumns,
    "i",
    ["paid_amount", "amount_paid", "collected_amount"],
    "0"
  );

  const paidExpr = `
    LEAST(
      GREATEST(${rawPaidExpr}, 0),
      GREATEST(${totalExpr}, 0)
    )
  `;

  const storedBalanceColumn = dashFirstColumn(invoiceColumns, [
    "balance_due",
    "remaining_amount",
    "outstanding_amount",
  ]);

  const storedBalanceExpr = storedBalanceColumn
    ? `i.${dashSqlId(storedBalanceColumn)}`
    : "NULL";

  const balanceExpr = `
    CASE
      WHEN ${storedBalanceExpr} IS NULL
      THEN GREATEST(${totalExpr} - ${paidExpr}, 0)
      ELSE GREATEST(
        LEAST(
          ${storedBalanceExpr},
          GREATEST(${totalExpr} - ${paidExpr}, 0)
        ),
        0
      )
    END
  `;

  const where = [];
  const params = [];

  if (dateColumn && filters.from) {
    where.push(`DATE(i.${dashSqlId(dateColumn)}) >= ?`);
    params.push(filters.from);
  }

  if (dateColumn && filters.to) {
    where.push(`DATE(i.${dashSqlId(dateColumn)}) <= ?`);
    params.push(filters.to);
  }

  const limit = normalizeLimit(filters.limit, 10, 50);
  params.push(limit);

  const orderDateExpr = dateColumn ? `i.${dashSqlId(dateColumn)}` : null;

  const [rows] = await pool.query(
    `
    SELECT
      i.id,

      ${dashTextExpr(invoiceColumns, "i", ["invoice_number", "invoice_no", "number"], "CONCAT('INV-', i.id)")} AS invoice_number,
      ${dashNumberExpr(invoiceColumns, "i", ["member_id"], "NULL")} AS member_id,
      ${dashTextExpr(invoiceColumns, "i", ["member_no", "member_number"], "'--'")} AS member_no,

      ${dashTextExpr(
        invoiceColumns,
        "i",
        ["full_name_snapshot", "bill_to", "payer_name", "donor_name", "customer_name", "full_name"],
        "'Guest Donor'"
      )} AS bill_to,

      ${dashTextExpr(
        invoiceColumns,
        "i",
        ["email_snapshot", "recipient_email", "payer_email", "donor_email", "customer_email", "email"],
        "''"
      )} AS email,

      ${dashTextExpr(
        invoiceColumns,
        "i",
        ["invoice_type", "payment_type", "category", "donation_category", "type"],
        "'finance'"
      )} AS invoice_type,

      ${dashTextExpr(
        invoiceColumns,
        "i",
        ["category", "donation_category", "payment_type", "invoice_type", "type"],
        "'finance'"
      )} AS category,

      ${totalExpr} AS total_amount,
      ${paidExpr} AS paid_amount,
      ${balanceExpr} AS balance_due,

      ${dashTextExpr(invoiceColumns, "i", ["status", "invoice_status"], "'open'")} AS status,

      ${dashDateExpr(invoiceColumns, "i", ["invoice_date", "issued_at", "created_at", "date"])} AS invoice_date,
      ${dashDateExpr(invoiceColumns, "i", ["due_date", "invoice_due_date"])} AS due_date,
      ${dashDateExpr(invoiceColumns, "i", ["created_at", "invoice_date", "issued_at"])} AS created_at

    FROM tbl_finance_invoices i

    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}

    ORDER BY
      ${orderDateExpr ? `${orderDateExpr} IS NULL ASC, ${orderDateExpr} DESC,` : ""}
      i.id DESC

    LIMIT ?
    `,
    params
  );

  return rows;
}

async function getRecentPledges(limit = 10) {
  const plCols = await dashboardColumnsFor("tbl_finance_pledges");
  const mCols = await dashboardColumnsFor("tbl_members");
  const cCols = await dashboardColumnsFor("tbl_finance_campaigns");

  if (!plCols.size) return [];

  const memberJoin =
    mCols.size && dashHas(plCols, "member_id")
      ? "LEFT JOIN tbl_members m ON m.id = pl.member_id"
      : "";

  const campaignJoin =
    cCols.size && dashHas(plCols, "campaign_id")
      ? "LEFT JOIN tbl_finance_campaigns c ON c.id = pl.campaign_id"
      : "";

  const pledgedExpr = dashNumberExpr(plCols, "pl", ["pledged_amount", "amount", "total_amount"], "0");
  const paidExpr = dashNumberExpr(plCols, "pl", ["paid_amount", "amount_paid"], "0");
  const dateExpr = dashDateCoalesceExpr(plCols, "pl", ["created_at", "pledge_date", "date"]);

  const [rows] = await pool.query(
    `
    SELECT
      pl.id,

      ${dashTextExpr(plCols, "pl", ["pledge_number", "pledge_no", "number"], "CONCAT('PLG-', pl.id)")} AS pledge_number,
      ${dashNumberExpr(plCols, "pl", ["member_id"], "NULL")} AS member_id,
      ${memberJoin ? dashTextExpr(mCols, "m", ["member_no", "member_number"], "'--'") : "'--'"} AS member_no,

      ${dashMultiTextExpr(
        [
          { columns: mCols, alias: "m", candidates: ["full_name", "name"] },
          { columns: plCols, alias: "pl", candidates: ["guest_name", "donor_name", "full_name_snapshot", "full_name"] },
        ],
        "'Guest Donor'"
      )} AS donor_name,

      ${dashMultiTextExpr(
        [
          { columns: mCols, alias: "m", candidates: ["email"] },
          { columns: plCols, alias: "pl", candidates: ["email", "guest_email", "donor_email", "email_snapshot"] },
        ],
        "''"
      )} AS donor_email,

      ${campaignJoin ? dashTextExpr(cCols, "c", ["title", "name", "campaign_name"], "'--'") : "'--'"} AS campaign_name,

      ${pledgedExpr} AS pledged_amount,
      ${paidExpr} AS paid_amount,
      GREATEST(${pledgedExpr} - ${paidExpr}, 0) AS remaining_amount,

      ${dashTextExpr(plCols, "pl", ["status", "pledge_status"], "'active'")} AS status,
      ${dashDateExpr(plCols, "pl", ["due_date", "pledge_due_date"])} AS due_date,
      ${dashDateExpr(plCols, "pl", ["created_at", "pledge_date", "date"])} AS created_at

    FROM tbl_finance_pledges pl

    ${memberJoin}
    ${campaignJoin}

    ORDER BY
      ${dateExpr === "NULL" ? "pl.id DESC" : `${dateExpr} IS NULL ASC, ${dateExpr} DESC, pl.id DESC`}

    LIMIT ?
    `,
    [limit]
  );

  return rows;
}

async function getRecentAuditAlerts(limit = 10) {
  return safeCall(
    "dashboard audit alerts",
    () =>
      auditReportService.getSuspiciousSecurityEvents({
        limit,
      }),
    []
  );
}

/* -------------------------------------------------------------------------- */
/* Trends                                                                     */
/* -------------------------------------------------------------------------- */

async function getMonthlyRevenueTrend() {
  const pCols = await dashboardColumnsFor("tbl_finance_payments");

  if (!pCols.size) return [];

  const dateExpr = dashDateCoalesceExpr(pCols, "p", ["paid_at", "payment_date", "created_at", "date"]);
  if (dateExpr === "NULL") return [];

  const amountExpr = dashNumberExpr(pCols, "p", ["amount", "payment_amount", "total_amount"], "0");
  const categoryExpr = dashTextExpr(pCols, "p", ["category", "payment_type", "donation_category", "type"], "'finance'");
  const statusWhere = paidStatusWhere(pCols, "p");

  const [rows] = await pool.query(
    `
    SELECT
      DATE_FORMAT(${dateExpr}, '%Y-%m') AS month,
      COUNT(*) AS transactions,
      COALESCE(SUM(${amountExpr}), 0) AS amount,

      COALESCE(SUM(CASE WHEN ${categoryExpr} = 'membership' THEN ${amountExpr} ELSE 0 END), 0) AS membership_amount,
      COALESCE(SUM(CASE WHEN ${categoryExpr} IN ('donation', 'general_donation') THEN ${amountExpr} ELSE 0 END), 0) AS donation_amount,
      COALESCE(SUM(CASE WHEN ${categoryExpr} IN ('school', 'trip', 'kids') THEN ${amountExpr} ELSE 0 END), 0) AS program_amount,
      COALESCE(SUM(CASE WHEN ${categoryExpr} = 'pledge' THEN ${amountExpr} ELSE 0 END), 0) AS pledge_amount

    FROM tbl_finance_payments p

    WHERE ${statusWhere}

    GROUP BY DATE_FORMAT(${dateExpr}, '%Y-%m')

    ORDER BY month DESC

    LIMIT 12
    `
  );

  return rows.reverse();
}

async function getDailyRevenueTrend(days = 30) {
  const pCols = await dashboardColumnsFor("tbl_finance_payments");

  if (!pCols.size) return [];

  const dateExpr = dashDateCoalesceExpr(pCols, "p", ["paid_at", "payment_date", "created_at", "date"]);
  if (dateExpr === "NULL") return [];

  const amountExpr = dashNumberExpr(pCols, "p", ["amount", "payment_amount", "total_amount"], "0");
  const statusWhere = paidStatusWhere(pCols, "p");
  const safeDays = Math.min(90, Math.max(1, Number(days || 30)));

  const [rows] = await pool.query(
    `
    SELECT
      DATE(${dateExpr}) AS day,
      COUNT(*) AS transactions,
      COALESCE(SUM(${amountExpr}), 0) AS amount

    FROM tbl_finance_payments p

    WHERE ${statusWhere}
      AND DATE(${dateExpr}) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)

    GROUP BY DATE(${dateExpr})

    ORDER BY day ASC
    `,
    [safeDays]
  );

  return rows;
}

/* -------------------------------------------------------------------------- */
/* Dashboard Handlers                                                         */
/* -------------------------------------------------------------------------- */

async function dashboardHandler(req, res) {
  try {
    const limit = normalizeLimit(req.query.limit, 10, 50);
    const filters = dateFilters(req);

    const invoiceFilters = {
      from: filters.date_from,
      to: filters.date_to,
      limit,
    };

    const [
      kpis,
      report,
      recentPayments,
      recentReceipts,
      recentInvoices,
      recentPledges,
      monthlyTrend,
      dailyTrend,
      auditAlerts,
    ] = await Promise.all([
      safeCall(
        "dashboard kpis",
        () => executiveKpiService.getExecutiveKpis(filters),
        emptyKpis()
      ),
      safeCall(
        "dashboard enterprise report",
        () =>
          financeReportService.getEnterpriseReportDashboard({
            ...filters,
            limit: 20,
          }),
        emptyReport()
      ),
      safeCall("dashboard recent payments", () => getRecentPayments(limit), []),
      safeCall("dashboard recent receipts", () => getRecentReceipts(limit), []),
      safeCall("dashboard recent invoices", () => getRecentInvoices(invoiceFilters), []),
      safeCall("dashboard recent pledges", () => getRecentPledges(limit), []),
      safeCall("dashboard monthly trend", () => getMonthlyRevenueTrend(), []),
      safeCall("dashboard daily trend", () => getDailyRevenueTrend(req.query.days || 30), []),
      getRecentAuditAlerts(limit),
    ]);

    return res.json({
      ok: true,
      dashboard: {
        kpis,
        cards: kpis.cards || [],

        summary: {
          revenue: kpis.revenue || {},
          members: kpis.members || {},
          invoices: kpis.invoices || {},
          pledges: kpis.pledges || {},
          programs: kpis.programs || {},
          emails: kpis.emails || {},
        },

        breakdowns: {
          revenue_by_category: kpis.revenue?.by_category || [],
          payment_methods: kpis.revenue?.by_method || [],
          report_revenue_by_category: report.revenue_by_category || [],
          report_payment_methods: report.payment_methods || [],
        },

        recent: {
          payments: recentPayments,
          receipts: recentReceipts,
          invoices: recentInvoices,
          pledges: recentPledges,
          audit_alerts: auditAlerts,
        },

        trends: {
          monthly_revenue: monthlyTrend,
          daily_revenue: dailyTrend,
        },

        lists: {
          unpaid_members: report.unpaid_members || [],
          school_registrations: report.school_registrations || [],
          trip_registrations: report.trip_registrations || [],
        },

        generated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    return routeError(res, err, "Failed to load finance dashboard.");
  }
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/dashboard", dashboardHandler);
router.get("/dashboard/overview", dashboardHandler);

router.get("/dashboard/summary", async (req, res) => {
  try {
    const kpis = await safeCall(
      "dashboard summary",
      () => executiveKpiService.getExecutiveKpis(dateFilters(req)),
      emptyKpis()
    );

    return res.json({
      ok: true,
      cards: kpis.cards || [],
      summary: {
        revenue: kpis.revenue || {},
        members: kpis.members || {},
        invoices: kpis.invoices || {},
        pledges: kpis.pledges || {},
        programs: kpis.programs || {},
        emails: kpis.emails || {},
      },
      generated_at: kpis.generated_at || new Date().toISOString(),
    });
  } catch (err) {
    return routeError(res, err, "Failed to load dashboard summary.");
  }
});

router.get("/dashboard/recent", async (req, res) => {
  try {
    const limit = normalizeLimit(req.query.limit, 10, 50);
    const filters = dateFilters(req);

    const [
      payments,
      receipts,
      invoices,
      pledges,
      auditAlerts,
    ] = await Promise.all([
      safeCall("dashboard recent payments", () => getRecentPayments(limit), []),
      safeCall("dashboard recent receipts", () => getRecentReceipts(limit), []),
      safeCall(
        "dashboard recent invoices",
        () =>
          getRecentInvoices({
            from: filters.date_from,
            to: filters.date_to,
            limit,
          }),
        []
      ),
      safeCall("dashboard recent pledges", () => getRecentPledges(limit), []),
      getRecentAuditAlerts(limit),
    ]);

    return res.json({
      ok: true,
      recent: {
        payments,
        receipts,
        invoices,
        pledges,
        audit_alerts: auditAlerts,
      },
    });
  } catch (err) {
    return routeError(res, err, "Failed to load recent dashboard activity.");
  }
});

router.get("/dashboard/trends", async (req, res) => {
  try {
    const [monthly, daily] = await Promise.all([
      safeCall("dashboard monthly trend", () => getMonthlyRevenueTrend(), []),
      safeCall("dashboard daily trend", () => getDailyRevenueTrend(req.query.days || 30), []),
    ]);

    return res.json({
      ok: true,
      trends: {
        monthly_revenue: monthly,
        daily_revenue: daily,
      },
    });
  } catch (err) {
    return routeError(res, err, "Failed to load dashboard trends.");
  }
});

module.exports = router;