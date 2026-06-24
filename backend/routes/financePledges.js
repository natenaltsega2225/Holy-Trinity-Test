// backend/routes/financePledges.js
"use strict";

const express = require("express");
const crypto = require("crypto");

const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

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

const paymentService = optionalRequire("../services/paymentService");
const exportService = optionalRequire("../services/domains/export/exportService");
const notificationService = optionalRequire("../services/domains/notifications/notificationService");
const invoiceGenerationService = optionalRequire("../services/domains/invoices/invoiceGenerationService");
const invoicePublicAccessService = optionalRequire("../services/domains/invoices/invoicePublicAccessService");

const campaignRollupService = optionalRequire("../services/domains/pledge/campaignRollupService");
const campaignDashboardService = optionalRequire("../services/domains/pledge/campaignDashboardService");
const pledgeAgingService = optionalRequire("../services/domains/pledge/pledgeAgingService");
const pledgeAuditService = optionalRequire("../services/domains/pledge/pledgeAuditService");
const pledgeAutoOverdueProcessor = optionalRequire("../services/domains/pledge/pledgeAutoOverdueProcessor");
const pledgeAutoReminderProcessor = optionalRequire("../services/domains/pledge/pledgeAutoReminderProcessor");
const pledgeCampaignPerformanceService = optionalRequire("../services/domains/pledge/pledgeCampaignPerformanceService");
const pledgeCollectionAnalyticsService = optionalRequire("../services/domains/pledge/pledgeCollectionAnalyticsService");
const pledgeEmailTrackingService = optionalRequire("../services/domains/pledge/pledgeEmailTrackingService");
const pledgeExportService = optionalRequire("../services/domains/pledge/pledgeExportService");
const pledgeForecastService = optionalRequire("../services/domains/pledge/pledgeForecastService");
const pledgeGoalTrackingService = optionalRequire("../services/domains/pledge/pledgeGoalTrackingService");
const pledgeKpiService = optionalRequire("../services/domains/pledge/pledgeKpiService");
const pledgeReceivableService = optionalRequire("../services/domains/pledge/pledgeReceivableService");
const pledgeRecurringService = optionalRequire("../services/domains/pledge/pledgeRecurringService");
const pledgeReminderHistoryService = optionalRequire("../services/domains/pledge/pledgeReminderHistoryService");
const pledgeReminderService = optionalRequire("../services/domains/pledge/pledgeReminderService");
const pledgeScheduleService = optionalRequire("../services/domains/pledge/pledgeScheduleService");
const pledgeStatementService = optionalRequire("../services/domains/pledge/pledgeStatementService");
const pledgeWriteoffService = optionalRequire("../services/domains/pledge/pledgeWriteoffService");

const router = express.Router();

const META_TTL_MS = 60 * 1000;
const columnCache = new Map();
const enumValueCache = new Map();

const FINANCE_ROLES = [
  "finance",
  "admin",
  "super_admin",
  "reconciliation",
];

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "financePledges",
    version: "enterprise",
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* Security                                                                   */
/* -------------------------------------------------------------------------- */

router.use(authRequired);
router.use(requireRole(...FINANCE_ROLES));

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clean(value, max = 255) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function money(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function truthy(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  return ["1", "true", "yes", "y", "on"].includes(
    String(value).trim().toLowerCase()
  );
}

function safeId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function positiveInt(value, fallback = 1, max = 500) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function code(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function actorId(req) {
  return req.user?.id || req.user?.user_id || req.user?.userId || null;
}

function actorName(req) {
  return (
    req.user?.full_name ||
    req.user?.name ||
    req.user?.username ||
    req.user?.email ||
    "Finance User"
  );
}

function clientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    null
  );
}

function appUrl() {
  return (
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:5173"
  ).replace(/\/+$/, "");
}

function safeJson(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value);
  } catch (_err) {
    return null;
  }
}

function normalizePaymentMethod(value) {
  const method = clean(value || "manual", 60).toLowerCase();

  const aliases = {
    stripe_card: "card",
    stripe_ach: "ach",
    bank: "bank_deposit",
    cheque: "check",
    manual_cash: "cash",
    manual_check: "check",
    manual_zelle: "zelle",
  };

  return aliases[method] || method || "manual";
}

function normalizePledgeStatus(value, fallback = "active") {
  const raw = clean(value || "", 40).toLowerCase();

  const aliases = {
    receivable: "active",
    open: "active",
    outstanding: "active",
    pending: "active",
    promised: "active",
    promise_to_pay: "active",
    in_progress: "active",

    partly_paid: "partial",
    partially_paid: "partial",

    complete: "paid",
    completed: "paid",
    fulfilled: "paid",
    closed: "paid",

    canceled: "cancelled",
    void: "cancelled",
    voided: "cancelled",

    writeoff: "written_off",
    writtenoff: "written_off",
  };

  const normalized = aliases[raw] || raw || fallback;

  const allowed = new Set([
    "active",
    "partial",
    "paid",
    "cancelled",
    "written_off",
  ]);

  return allowed.has(normalized) ? normalized : fallback;
}

function pledgeStatus(pledgedAmount, paidAmount, currentStatus = "") {
  const existing = normalizePledgeStatus(currentStatus, "");

  if (["written_off", "cancelled"].includes(existing)) {
    return existing;
  }

  const pledged = money(pledgedAmount);
  const paid = money(paidAmount);

  if (pledged > 0 && paid >= pledged) return "paid";
  if (paid > 0) return "partial";
  return "active";
}

function remainingAmount(pledge = {}) {
  return Math.max(
    money(
      pledge.remaining_balance ??
        pledge.balance_due ??
        money(pledge.pledged_amount || pledge.amount || pledge.total_amount) -
          money(pledge.paid_amount)
    ),
    0
  );
}

function sqlId(value) {
  if (!/^[a-zA-Z0-9_]+$/.test(String(value || ""))) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }

  return `\`${value}\``;
}

function has(columns, column) {
  return columns?.has(column);
}

function col(alias, column) {
  return `${alias}.${sqlId(column)}`;
}

function firstExpr(alias, columns, candidates, fallback = "NULL") {
  const parts = candidates
    .filter((column) => has(columns, column))
    .map((column) => col(alias, column));

  return parts.length ? `COALESCE(${parts.join(", ")}, ${fallback})` : fallback;
}

function numberExpr(alias, columns, candidates, fallback = "0") {
  return `CAST(${firstExpr(alias, columns, candidates, fallback)} AS DECIMAL(18,2))`;
}

function routeError(res, err, fallback, status = 500) {
  console.error(fallback, err);

  return res.status(err.status || err.statusCode || status).json({
    ok: false,
    error: err.status || err.statusCode ? err.message : err.message || fallback,
  });
}

async function columnsFor(tableName) {
  const cached = columnCache.get(tableName);

  if (cached && Date.now() - cached.loadedAt < META_TTL_MS) {
    return cached.columns;
  }

  try {
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

    columnCache.set(tableName, {
      columns,
      loadedAt: Date.now(),
    });

    return columns;
  } catch (_err) {
    const columns = new Set();

    columnCache.set(tableName, {
      columns,
      loadedAt: Date.now(),
    });

    return columns;
  }
}

async function enumValuesFor(tableName, columnName) {
  const key = `${tableName}.${columnName}`;
  const cached = enumValueCache.get(key);

  if (cached && Date.now() - cached.loadedAt < META_TTL_MS) {
    return cached.values;
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
      `,
      [tableName, columnName]
    );

    const columnType = String(rows?.[0]?.COLUMN_TYPE || "");
    const values = [];
    const match = columnType.match(/^enum\((.*)\)$/i);

    if (match) {
      const raw = match[1];
      const re = /'((?:[^'\\]|\\.)*)'/g;
      let item = re.exec(raw);

      while (item) {
        values.push(item[1].replace(/\\'/g, "'").toLowerCase());
        item = re.exec(raw);
      }
    }

    enumValueCache.set(key, {
      values,
      loadedAt: Date.now(),
    });

    return values;
  } catch (_err) {
    enumValueCache.set(key, {
      values: [],
      loadedAt: Date.now(),
    });

    return [];
  }
}

async function pledgeStatusForDb(pledgedAmount, paidAmount, currentStatus = "") {
  const desired = pledgeStatus(pledgedAmount, paidAmount, currentStatus);
  const allowed = await enumValuesFor("tbl_finance_pledges", "status");

  if (!allowed.length || allowed.includes(desired)) {
    return desired;
  }

  const pledged = money(pledgedAmount);
  const paid = money(paidAmount);

  const candidates =
    pledged > 0 && paid >= pledged
      ? ["paid", "completed", "complete", "closed"]
      : paid > 0
      ? ["partial", "partially_paid", "partly_paid", "active", "pending", "open"]
      : ["active", "pending", "open", "promised", "unpaid"];

  for (const candidate of candidates) {
    if (allowed.includes(candidate)) {
      return candidate;
    }
  }

  return allowed[0] || desired;
}

async function tableExists(tableName) {
  const columns = await columnsFor(tableName);
  return columns.size > 0;
}

async function insertDynamic(conn, tableName, payload = {}) {
  const columns = await columnsFor(tableName);

  const entries = Object.entries(payload).filter(
    ([key, value]) => columns.has(key) && value !== undefined
  );

  if (!entries.length) {
    throw new Error(`No supported columns for ${tableName}.`);
  }

  const sql = `
    INSERT INTO ${sqlId(tableName)}
    (${entries.map(([key]) => sqlId(key)).join(", ")})
    VALUES (${entries.map(() => "?").join(", ")})
  `;

  const [result] = await conn.query(
    sql,
    entries.map(([, value]) => value)
  );

  return result.insertId;
}

async function updateDynamic(conn, tableName, payload = {}, whereSql, whereParams = []) {
  const columns = await columnsFor(tableName);

  const entries = Object.entries(payload).filter(
    ([key, value]) => columns.has(key) && value !== undefined
  );

  if (!entries.length) return 0;

  const setSql = entries.map(([key]) => `${sqlId(key)} = ?`).join(", ");

  const [result] = await conn.query(
    `
    UPDATE ${sqlId(tableName)}
    SET ${setSql}
    WHERE ${whereSql}
    `,
    [
      ...entries.map(([, value]) => value),
      ...whereParams,
    ]
  );

  return result.affectedRows || 0;
}

function hasMethod(service, method) {
  return service && typeof service[method] === "function";
}

async function callFirst(service, methods, args = [], fallback = null) {
  for (const method of methods) {
    if (hasMethod(service, method)) {
      return service[method](...args);
    }
  }

  if (typeof fallback === "function") {
    return fallback();
  }

  const err = new Error(`Service method unavailable: ${methods.join(" or ")}`);
  err.status = 501;
  throw err;
}

async function optionalCall(service, methods, args = [], label = "service") {
  try {
    for (const method of methods) {
      if (hasMethod(service, method)) {
        return await service[method](...args);
      }
    }

    return {
      ok: true,
      skipped: true,
      label,
      reason: "method_unavailable",
    };
  } catch (err) {
    return {
      ok: false,
      label,
      error: err.message,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                      */
/* -------------------------------------------------------------------------- */

async function audit(req, action, entityId = null, details = {}) {
  try {
    if (!(await tableExists("tbl_audit_logs"))) return;

    const conn = await pool.getConnection();

    try {
      await insertDynamic(conn, "tbl_audit_logs", {
        user_id: actorId(req),
        actor_id: actorId(req),
        actor_name: actorName(req),
        module: "finance_pledges",
        entity: "pledge",
        entity_type: "pledge",
        entity_id: entityId,
        action,
        description: `Pledge action: ${action}`,
        status: "success",
        severity: "info",
        ip_address: clientIp(req),
        user_agent: req.headers["user-agent"] || null,
        details_json: safeJson(details),
        metadata_json: safeJson(details),
        created_at: new Date(),
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("pledge audit failed:", err.message);
  }
}

/* -------------------------------------------------------------------------- */
/* Data Loaders                                                               */
/* -------------------------------------------------------------------------- */

async function getMember(conn, memberId) {
  if (!memberId || !(await tableExists("tbl_members"))) return null;

  const [[row]] = await conn.query(
    `
    SELECT
      id,
      member_no,
      full_name,
      email,
      phone
    FROM tbl_members
    WHERE id = ?
    LIMIT 1
    `,
    [memberId]
  );

  return row || null;
}

async function getCampaign(conn, campaignId) {
  if (!campaignId || !(await tableExists("tbl_finance_campaigns"))) return null;

  const columns = await columnsFor("tbl_finance_campaigns");

  const nameExpr = firstExpr("c", columns, ["title", "name", "campaign_name"], "CONCAT('Campaign ', c.id)");
  const goalExpr = numberExpr("c", columns, ["goal_amount", "goal", "target_amount"], "0");
  const statusExpr = firstExpr("c", columns, ["status"], "'active'");

  const [[row]] = await conn.query(
    `
    SELECT
      c.*,
      ${nameExpr} AS campaign_name,
      ${goalExpr} AS goal_amount,
      ${statusExpr} AS status
    FROM tbl_finance_campaigns c
    WHERE c.id = ?
    LIMIT 1
    `,
    [campaignId]
  );

  return row || null;
}

async function getPledgeById(conn, pledgeId) {
  if (!(await tableExists("tbl_finance_pledges"))) return null;

  const pledgeColumns = await columnsFor("tbl_finance_pledges");
  const memberColumns = await columnsFor("tbl_members");
  const campaignColumns = await columnsFor("tbl_finance_campaigns");

  const joins = [];

  if (has(pledgeColumns, "member_id") && memberColumns.size) {
    joins.push(`
      LEFT JOIN tbl_members m
        ON m.id = p.member_id
    `);
  }

  if (has(pledgeColumns, "campaign_id") && campaignColumns.size) {
    joins.push(`
      LEFT JOIN tbl_finance_campaigns c
        ON c.id = p.campaign_id
    `);
  }

  const pledgeNumber = firstExpr("p", pledgeColumns, ["pledge_number", "pledge_no", "reference_no"], "CONCAT('PLG-', p.id)");
  const pledgedAmount = numberExpr("p", pledgeColumns, ["pledged_amount", "amount", "total_amount"], "0");
  const paidAmount = numberExpr("p", pledgeColumns, ["paid_amount"], "0");
  const storedBalance = numberExpr("p", pledgeColumns, ["remaining_balance", "balance_due", "outstanding_amount"], "NULL");
  const balanceDue = `GREATEST(COALESCE(${storedBalance}, ${pledgedAmount} - ${paidAmount}), 0)`;

  const donorName = `COALESCE(
    ${firstExpr("p", pledgeColumns, ["full_name_snapshot", "donor_name", "guest_name", "payer_name", "full_name"], "NULL")},
    ${memberColumns.size ? firstExpr("m", memberColumns, ["full_name", "name"], "NULL") : "NULL"},
    'Guest Donor'
  )`;

  const donorEmail = `COALESCE(
    ${firstExpr("p", pledgeColumns, ["email_snapshot", "donor_email", "guest_email", "payer_email", "email"], "NULL")},
    ${memberColumns.size ? firstExpr("m", memberColumns, ["email", "member_email"], "NULL") : "NULL"}
  )`;

  const donorPhone = `COALESCE(
    ${firstExpr("p", pledgeColumns, ["phone_snapshot", "donor_phone", "guest_phone", "payer_phone", "phone"], "NULL")},
    ${memberColumns.size ? firstExpr("m", memberColumns, ["phone", "phone_number", "mobile"], "NULL") : "NULL"}
  )`;

  const memberNo = `COALESCE(
    ${firstExpr("p", pledgeColumns, ["member_no", "member_number"], "NULL")},
    ${memberColumns.size ? firstExpr("m", memberColumns, ["member_no", "member_number"], "NULL") : "NULL"}
  )`;

  const campaignName = `COALESCE(
    ${firstExpr("p", pledgeColumns, ["campaign_name", "pledge_campaign"], "NULL")},
    ${campaignColumns.size ? firstExpr("c", campaignColumns, ["title", "name", "campaign_name"], "NULL") : "NULL"}
  )`;

  const statusExpr = firstExpr("p", pledgeColumns, ["status", "pledge_status"], "'active'");
  const dueDateExpr = firstExpr("p", pledgeColumns, ["due_date"], "NULL");

  const [[row]] = await conn.query(
    `
    SELECT
      p.*,
      ${pledgeNumber} AS pledge_number,
      ${pledgedAmount} AS pledged_amount,
      ${paidAmount} AS paid_amount,
      ${balanceDue} AS remaining_balance,
      ${balanceDue} AS balance_due,
      ${donorName} AS donor_name,
      ${donorName} AS full_name_snapshot,
      ${donorEmail} AS donor_email,
      ${donorEmail} AS email_snapshot,
      ${donorPhone} AS donor_phone,
      ${donorPhone} AS phone_snapshot,
      ${memberNo} AS member_no,
      ${campaignName} AS campaign_name,
      ${statusExpr} AS status,
      ${dueDateExpr} AS due_date
    FROM tbl_finance_pledges p
    ${joins.join("\n")}
    WHERE p.id = ?
    LIMIT 1
    `,
    [pledgeId]
  );

  return row || null;
}

/* -------------------------------------------------------------------------- */
/* Pledge Listing                                                             */
/* -------------------------------------------------------------------------- */

async function listPledgesFallback(query = {}) {
  if (!(await tableExists("tbl_finance_pledges"))) {
    return {
      rows: [],
      summary: {},
      pagination: {
        page: 1,
        limit: 25,
        total: 0,
        pages: 1,
      },
    };
  }

  const pledgeColumns = await columnsFor("tbl_finance_pledges");
  const memberColumns = await columnsFor("tbl_members");
  const campaignColumns = await columnsFor("tbl_finance_campaigns");

  const joins = [];

  if (has(pledgeColumns, "member_id") && memberColumns.size) {
    joins.push(`
      LEFT JOIN tbl_members m
        ON m.id = p.member_id
    `);
  }

  if (has(pledgeColumns, "campaign_id") && campaignColumns.size) {
    joins.push(`
      LEFT JOIN tbl_finance_campaigns c
        ON c.id = p.campaign_id
    `);
  }

  const pledgeNumber = firstExpr("p", pledgeColumns, ["pledge_number", "pledge_no", "reference_no"], "CONCAT('PLG-', p.id)");
  const pledgedAmount = numberExpr("p", pledgeColumns, ["pledged_amount", "amount", "total_amount"], "0");
  const paidAmount = numberExpr("p", pledgeColumns, ["paid_amount"], "0");
  const storedBalance = numberExpr("p", pledgeColumns, ["remaining_balance", "balance_due", "outstanding_amount"], "NULL");
  const balanceDue = `GREATEST(COALESCE(${storedBalance}, ${pledgedAmount} - ${paidAmount}), 0)`;
  const dateExpr = firstExpr("p", pledgeColumns, ["created_at", "pledge_date", "date"], "NULL");
  const dueDateExpr = firstExpr("p", pledgeColumns, ["due_date"], "NULL");
  const statusExpr = firstExpr("p", pledgeColumns, ["status", "pledge_status"], "'active'");

  const donorName = `COALESCE(
    ${firstExpr("p", pledgeColumns, ["full_name_snapshot", "donor_name", "guest_name", "payer_name", "full_name"], "NULL")},
    ${memberColumns.size ? firstExpr("m", memberColumns, ["full_name", "name"], "NULL") : "NULL"},
    'Guest Donor'
  )`;

  const donorEmail = `COALESCE(
    ${firstExpr("p", pledgeColumns, ["email_snapshot", "donor_email", "guest_email", "payer_email", "email"], "NULL")},
    ${memberColumns.size ? firstExpr("m", memberColumns, ["email", "member_email"], "NULL") : "NULL"}
  )`;

  const memberNo = `COALESCE(
    ${firstExpr("p", pledgeColumns, ["member_no", "member_number"], "NULL")},
    ${memberColumns.size ? firstExpr("m", memberColumns, ["member_no", "member_number"], "NULL") : "NULL"}
  )`;

  const campaignName = `COALESCE(
    ${firstExpr("p", pledgeColumns, ["campaign_name", "pledge_campaign"], "NULL")},
    ${campaignColumns.size ? firstExpr("c", campaignColumns, ["title", "name", "campaign_name"], "NULL") : "NULL"}
  )`;

  const where = ["1=1"];
  const params = [];

  if (query.search || query.q) {
    const search = `%${clean(query.search || query.q, 190)}%`;

    where.push(`
      (
        ${pledgeNumber} LIKE ?
        OR ${donorName} LIKE ?
        OR ${donorEmail} LIKE ?
        OR ${memberNo} LIKE ?
        OR ${campaignName} LIKE ?
      )
    `);

    params.push(search, search, search, search, search);
  }

  if (query.status && query.status !== "all") {
    where.push(`LOWER(${statusExpr}) = ?`);
    params.push(normalizePledgeStatus(query.status));
  }

  if (query.campaign_id) {
    where.push("p.campaign_id = ?");
    params.push(query.campaign_id);
  }

  if (query.member_id) {
    where.push("p.member_id = ?");
    params.push(query.member_id);
  }

  if (query.donor_type === "member") {
    where.push("p.member_id IS NOT NULL");
  }

  if (query.donor_type === "non_member" || query.donor_type === "guest") {
    where.push("(p.member_id IS NULL OR p.member_id = 0)");
  }

  if (query.date_from || query.from) {
    where.push(`DATE(${dateExpr}) >= DATE(?)`);
    params.push(query.date_from || query.from);
  }

  if (query.date_to || query.to) {
    where.push(`DATE(${dateExpr}) <= DATE(?)`);
    params.push(query.date_to || query.to);
  }

  if (query.due_from) {
    where.push(`DATE(${dueDateExpr}) >= DATE(?)`);
    params.push(query.due_from);
  }

  if (query.due_to) {
    where.push(`DATE(${dueDateExpr}) <= DATE(?)`);
    params.push(query.due_to);
  }

  if (query.overdue === "true" || query.overdue === true) {
    where.push(`${balanceDue} > 0 AND ${dueDateExpr} IS NOT NULL AND DATE(${dueDateExpr}) < CURDATE()`);
  }

  if (query.amount_min) {
    where.push(`${pledgedAmount} >= ?`);
    params.push(money(query.amount_min));
  }

  if (query.amount_max) {
    where.push(`${pledgedAmount} <= ?`);
    params.push(money(query.amount_max));
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const page = positiveInt(query.page, 1, 100000);
  const limit = positiveInt(query.limit || query.pageSize, 25, 500);
  const offset = (page - 1) * limit;

  const [[countRow]] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM tbl_finance_pledges p
    ${joins.join("\n")}
    ${whereSql}
    `,
    params
  );

  const [[summary]] = await pool.query(
    `
    SELECT
      COUNT(*) AS total_pledges,
      COALESCE(SUM(${pledgedAmount}), 0) AS pledged_amount,
      COALESCE(SUM(${paidAmount}), 0) AS paid_amount,
      COALESCE(SUM(${balanceDue}), 0) AS remaining_amount,
      SUM(CASE WHEN LOWER(${statusExpr}) IN ('paid', 'completed', 'closed') THEN 1 ELSE 0 END) AS paid_count,
      SUM(CASE WHEN LOWER(${statusExpr}) IN ('partial') THEN 1 ELSE 0 END) AS partial_count,
      SUM(CASE WHEN ${balanceDue} > 0 THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN ${balanceDue} > 0 AND ${dueDateExpr} IS NOT NULL AND DATE(${dueDateExpr}) < CURDATE() THEN 1 ELSE 0 END) AS overdue_count,
      SUM(CASE WHEN p.member_id IS NOT NULL AND p.member_id <> 0 THEN 1 ELSE 0 END) AS member_count,
      SUM(CASE WHEN p.member_id IS NULL OR p.member_id = 0 THEN 1 ELSE 0 END) AS non_member_count
    FROM tbl_finance_pledges p
    ${joins.join("\n")}
    ${whereSql}
    `,
    params
  );

  const [rows] = await pool.query(
    `
    SELECT
      p.*,
      ${pledgeNumber} AS pledge_number,
      ${donorName} AS donor_name,
      ${donorName} AS full_name_snapshot,
      ${donorEmail} AS donor_email,
      ${donorEmail} AS email_snapshot,
      ${memberNo} AS member_no,
      ${campaignName} AS campaign_name,
      ${pledgedAmount} AS pledged_amount,
      ${paidAmount} AS paid_amount,
      ${balanceDue} AS remaining_balance,
      ${balanceDue} AS balance_due,
      ${statusExpr} AS status,
      ${dateExpr} AS created_at,
      ${dueDateExpr} AS due_date
    FROM tbl_finance_pledges p
    ${joins.join("\n")}
    ${whereSql}
    ORDER BY ${dateExpr} DESC, p.id DESC
    LIMIT ?
    OFFSET ?
    `,
    [...params, limit, offset]
  );

  const total = Number(countRow?.total || 0);

  return {
    rows,
    summary: {
      total_pledges: Number(summary?.total_pledges || 0),
      pledged_amount: money(summary?.pledged_amount || 0),
      paid_amount: money(summary?.paid_amount || 0),
      remaining_amount: money(summary?.remaining_amount || 0),
      paid_count: Number(summary?.paid_count || 0),
      partial_count: Number(summary?.partial_count || 0),
      open_count: Number(summary?.open_count || 0),
      overdue_count: Number(summary?.overdue_count || 0),
      member_count: Number(summary?.member_count || 0),
      non_member_count: Number(summary?.non_member_count || 0),
    },
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Payload Builders                                                           */
/* -------------------------------------------------------------------------- */

async function buildPledgePayload(conn, req, existing = null) {
  const body = req.body || {};
  const member = await getMember(conn, body.member_id || existing?.member_id);
  const campaign = await getCampaign(conn, body.campaign_id || existing?.campaign_id);

  const pledgedAmount = money(
    body.pledged_amount ??
      body.amount ??
      body.total_amount ??
      existing?.pledged_amount ??
      existing?.amount ??
      0
  );

  if (pledgedAmount <= 0) {
    throw new Error("Pledged amount is required.");
  }

  const paidAmount = money(
    body.paid_amount ??
      body.upfront_amount ??
      existing?.paid_amount ??
      0
  );

  const remaining = Math.max(pledgedAmount - paidAmount, 0);

  const fullName =
    clean(
      body.full_name ||
        body.full_name_snapshot ||
        body.donor_name ||
        body.guest_name ||
        member?.full_name ||
        existing?.full_name_snapshot ||
        existing?.donor_name ||
        "",
      255
    ) || null;

  const email =
    clean(
      body.email ||
        body.email_snapshot ||
        body.donor_email ||
        body.guest_email ||
        member?.email ||
        existing?.email_snapshot ||
        existing?.donor_email ||
        "",
      255
    ) || null;

  const phone =
    clean(
      body.phone ||
        body.phone_snapshot ||
        body.donor_phone ||
        body.guest_phone ||
        member?.phone ||
        existing?.phone_snapshot ||
        existing?.donor_phone ||
        "",
      80
    ) || null;

  const status = await pledgeStatusForDb(
    pledgedAmount,
    paidAmount,
    body.status || existing?.status
  );

  return {
    data: {
      pledge_number: body.pledge_number || existing?.pledge_number || code("PLG"),

      member_id: body.member_id || existing?.member_id || null,
      member_no: body.member_no || member?.member_no || existing?.member_no || null,

      campaign_id: body.campaign_id || existing?.campaign_id || null,
      campaign_name: body.campaign_name || campaign?.campaign_name || existing?.campaign_name || null,

      full_name_snapshot: fullName,
      donor_name: fullName,
      guest_name: body.member_id || existing?.member_id ? undefined : fullName,

      email_snapshot: email,
      donor_email: email,
      guest_email: body.member_id || existing?.member_id ? undefined : email,

      phone_snapshot: phone,
      donor_phone: phone,
      guest_phone: body.member_id || existing?.member_id ? undefined : phone,

      pledged_amount: pledgedAmount,
      amount: pledgedAmount,
      total_amount: pledgedAmount,

      upfront_amount: money(body.upfront_amount || 0),
      paid_amount: paidAmount,
      remaining_balance: remaining,
      balance_due: remaining,

      pledge_type: body.pledge_type || body.type || existing?.pledge_type || "promise_to_pay",
      category: body.category || "pledge",
      status,

      due_date: body.due_date || existing?.due_date || null,
      pledge_date: body.pledge_date || existing?.pledge_date || new Date(),

      notes: body.notes || existing?.notes || null,
      description: body.description || body.notes || existing?.description || null,

      metadata_json: safeJson(body.metadata || body.meta || body.metadata_json),

      updated_by: actorId(req),
      updated_at: new Date(),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Invoice / Payment / Reminder                                               */
/* -------------------------------------------------------------------------- */

async function findOpenInvoiceForPledge(pledgeId) {
  if (!(await tableExists("tbl_finance_invoices"))) return null;

  const invoiceColumns = await columnsFor("tbl_finance_invoices");
  const statusColumn = has(invoiceColumns, "status")
    ? "status"
    : has(invoiceColumns, "invoice_status")
    ? "invoice_status"
    : null;
  const statusExpr = statusColumn
    ? `LOWER(COALESCE(${sqlId(statusColumn)}, 'open'))`
    : "'open'";

  const relationPredicates = [];
  const params = [];

  if (has(invoiceColumns, "pledge_id")) {
    relationPredicates.push(`${sqlId("pledge_id")} = ?`);
    params.push(pledgeId);
  }

  if (has(invoiceColumns, "related_pledge_id")) {
    relationPredicates.push(`${sqlId("related_pledge_id")} = ?`);
    params.push(pledgeId);
  }

  if (
    has(invoiceColumns, "related_entity_id") &&
    has(invoiceColumns, "related_entity_type")
  ) {
    relationPredicates.push(
      `(${sqlId("related_entity_id")} = ? AND LOWER(COALESCE(${sqlId(
        "related_entity_type"
      )}, '')) = 'pledge')`
    );
    params.push(pledgeId);
  }

  if (
    has(invoiceColumns, "entity_id") &&
    has(invoiceColumns, "entity_type")
  ) {
    relationPredicates.push(
      `(${sqlId("entity_id")} = ? AND LOWER(COALESCE(${sqlId(
        "entity_type"
      )}, '')) = 'pledge')`
    );
    params.push(pledgeId);
  }

  if (!relationPredicates.length) {
    return null;
  }

  const [rows] = await pool.query(
    `
    SELECT *
    FROM tbl_finance_invoices
    WHERE (${relationPredicates.join(" OR ")})
      AND ${statusExpr} IN ('draft', 'open', 'pending', 'partial', 'overdue')
    ORDER BY id DESC
    LIMIT 1
    `,
    params
  );

  return rows[0] || null;
}

async function rememberPledgeInvoice(pledgeId, invoice = {}) {
  if (!pledgeId || !invoice?.id) return;

  try {
    await updateDynamic(
      pool,
      "tbl_finance_pledges",
      {
        invoice_id: invoice.id,
        last_invoice_id: invoice.id,
        latest_invoice_id: invoice.id,
        invoice_number: invoice.invoice_number || null,
        last_invoice_number: invoice.invoice_number || null,
        latest_invoice_number: invoice.invoice_number || null,
        updated_at: new Date(),
      },
      "id = ?",
      [pledgeId]
    );
  } catch (err) {
    console.warn("rememberPledgeInvoice skipped:", err.message);
  }
}

async function createInvoiceForPledge(req, pledge, options = {}) {
  const amount = money(options.amount || remainingAmount(pledge));

  if (amount <= 0) {
    throw new Error("Invoice amount is required.");
  }

  if (!options.force_new_invoice) {
    const knownInvoiceId =
      pledge.invoice_id ||
      pledge.last_invoice_id ||
      pledge.latest_invoice_id ||
      pledge.open_invoice_id ||
      null;

    if (knownInvoiceId) {
      const invoiceColumns = await columnsFor("tbl_finance_invoices");
      const statusExpr =
        has(invoiceColumns, "status") && has(invoiceColumns, "invoice_status")
          ? `LOWER(COALESCE(${sqlId("status")}, ${sqlId("invoice_status")}, 'open'))`
          : has(invoiceColumns, "status")
          ? `LOWER(COALESCE(${sqlId("status")}, 'open'))`
          : has(invoiceColumns, "invoice_status")
          ? `LOWER(COALESCE(${sqlId("invoice_status")}, 'open'))`
          : "'open'";

      const [[knownInvoice]] = await pool.query(
        `
        SELECT *
        FROM tbl_finance_invoices
        WHERE id = ?
          AND ${statusExpr} IN ('draft', 'open', 'pending', 'partial', 'overdue')
        LIMIT 1
        `,
        [knownInvoiceId]
      );

      if (knownInvoice) return knownInvoice;
    }

    const existing = await findOpenInvoiceForPledge(pledge.id);
    if (existing) return existing;
  }

  if (hasMethod(invoiceGenerationService, "generateInvoice")) {
    try {
      const result = await invoiceGenerationService.generateInvoice(pool, {
        category: "pledge",
        invoice_type: "pledge",
        payment_type: "pledge",

        pledge_id: pledge.id,
        related_pledge_id: pledge.id,
        related_entity_id: pledge.id,
        related_entity_type: "pledge",
        entity_id: pledge.id,
        entity_type: "pledge",
        campaign_id: pledge.campaign_id || null,
        member_id: pledge.member_id || null,
        member_no: pledge.member_no || null,

        full_name_snapshot: pledge.full_name_snapshot || pledge.donor_name || "Guest Donor",
        email_snapshot: pledge.email_snapshot || pledge.donor_email || null,
        phone_snapshot: pledge.phone_snapshot || pledge.donor_phone || null,

        total_amount: amount,
        amount,
        paid_amount: 0,
        balance_due: amount,
        status: "open",

        due_date: options.due_date || pledge.due_date || null,
        description: options.description || `Pledge payment for ${pledge.campaign_name || "church campaign"}`,
        notes: options.notes || null,

        metadata: {
          pledge_id: pledge.id,
          pledge_number: pledge.pledge_number || null,
          campaign_id: pledge.campaign_id || null,
          campaign_name: pledge.campaign_name || null,
          source: "finance_pledge_invoice",
        },
        metadata_json: safeJson({
          pledge_id: pledge.id,
          pledge_number: pledge.pledge_number || null,
          campaign_id: pledge.campaign_id || null,
          campaign_name: pledge.campaign_name || null,
          source: "finance_pledge_invoice",
        }),

        created_by: actorId(req),
        source: "finance_pledges_route",
      });

      const invoiceId = result?.id || result?.invoice_id || result;
      if (invoiceId) {
        const [[invoice]] = await pool.query(
          "SELECT * FROM tbl_finance_invoices WHERE id = ? LIMIT 1",
          [invoiceId]
        );
        if (invoice) {
          await rememberPledgeInvoice(pledge.id, invoice);
          return invoice;
        }
      }
    } catch (err) {
      console.error("invoiceGenerationService.generateInvoice fallback:", err.message);
    }
  }

  const conn = await pool.getConnection();

  try {
    const id = await insertDynamic(conn, "tbl_finance_invoices", {
      invoice_number: code("INV"),

      category: "pledge",
      invoice_type: "pledge",
      payment_type: "pledge",

      pledge_id: pledge.id,
      related_pledge_id: pledge.id,
      related_entity_id: pledge.id,
      related_entity_type: "pledge",
      entity_id: pledge.id,
      entity_type: "pledge",
      campaign_id: pledge.campaign_id || null,
      campaign_name: pledge.campaign_name || null,

      member_id: pledge.member_id || null,
      member_no: pledge.member_no || null,

      full_name_snapshot: pledge.full_name_snapshot || pledge.donor_name || "Guest Donor",
      email_snapshot: pledge.email_snapshot || pledge.donor_email || null,
      phone_snapshot: pledge.phone_snapshot || pledge.donor_phone || null,

      amount,
      total_amount: amount,
      paid_amount: 0,
      balance_due: amount,

      status: "open",
      invoice_status: "open",

      invoice_date: new Date(),
      due_date: options.due_date || pledge.due_date || null,

      description: options.description || `Pledge payment for ${pledge.campaign_name || "church campaign"}`,
      notes: options.notes || null,
      metadata_json: safeJson({
        pledge_id: pledge.id,
        pledge_number: pledge.pledge_number || null,
        campaign_id: pledge.campaign_id || null,
        campaign_name: pledge.campaign_name || null,
        source: "finance_pledge_invoice",
      }),

      created_by: actorId(req),
      created_at: new Date(),
      updated_at: new Date(),
    });

    const [[invoice]] = await conn.query(
      "SELECT * FROM tbl_finance_invoices WHERE id = ? LIMIT 1",
      [id]
    );

    await rememberPledgeInvoice(pledge.id, invoice);

    return invoice;
  } finally {
    conn.release();
  }
}

function publicInvoiceLinks(invoice) {
  if (hasMethod(invoicePublicAccessService, "buildInvoicePublicLinks")) {
    return invoicePublicAccessService.buildInvoicePublicLinks(invoice, {
      ttl_days: 30,
      scope: ["view", "pdf", "download", "pay", "email"],
    });
  }

  return {
    view_url: `${appUrl()}/pay-invoice/${encodeURIComponent(invoice.invoice_number || invoice.id)}`,
    pay_url: `${appUrl()}/pay-invoice/${encodeURIComponent(invoice.invoice_number || invoice.id)}`,
  };
}

function reminderOptions(req, overrides = {}) {
  const body = req.body || {};
  const query = req.query || {};

  return {
    ...query,
    ...body,
    ...overrides,

    pledge_id: overrides.pledge_id || body.pledge_id || req.params.id || null,
    pledgeId: overrides.pledgeId || overrides.pledge_id || body.pledgeId || req.params.id || null,

    email: body.email || body.to || query.email || null,
    to: body.to || body.email || query.to || null,
    subject: body.subject || null,
    message: body.message || null,
    notes: body.notes || null,

    force: body.force === true || body.force === "true" || query.force === "true",
    force_new_invoice:
      body.force_new_invoice === true ||
      body.forceNewInvoice === true ||
      body.force_new_invoice === "true" ||
      body.forceNewInvoice === "true",

    dry_run:
      body.dry_run === true ||
      body.dryRun === true ||
      body.dry_run === "true" ||
      body.dryRun === "true",

    limit: positiveInt(body.limit || query.limit, 100, 1000),
    lookAheadDays: Number(body.lookAheadDays || body.look_ahead_days || query.lookAheadDays || query.look_ahead_days || 14),
    cooldownDays: Number(body.cooldownDays || body.cooldown_days || query.cooldownDays || query.cooldown_days || 7),

    actorId: actorId(req),
    actor: {
      id: actorId(req),
      name: actorName(req),
      role: req.user?.role || null,
    },
    requestInfo: {
      ip: clientIp(req),
      userAgent: req.headers["user-agent"] || null,
    },
    request_id: req.requestId || null,
  };
}

function pledgeActionLinks(pledgeId) {
  const base = `/api/finance/pledges/${encodeURIComponent(pledgeId)}`;

  return {
    actions_url: `${base}/actions`,
    preview_reminder_url: `${base}/reminder/preview`,
    send_reminder_url: `${base}/reminder/send`,
    create_payment_link_url: `${base}/reminder/link`,
    reminder_history_url: `${base}/reminders`,
    record_payment_url: `${base}/payments`,
    create_invoice_url: `${base}/invoice`,
  };
}

function pledgeActionManifest(pledge) {
  const pledgeId = pledge.id || pledge.pledge_id;
  const balance = remainingAmount(pledge);
  const email = pledge.email_snapshot || pledge.donor_email || pledge.email || null;

  return {
    pledge_id: pledgeId,
    donor_type: pledge.member_id ? "member" : "non_member",
    email,
    balance_due: balance,
    can_send_reminder: Boolean(email && balance > 0),
    can_create_payment_link: balance > 0,
    can_record_payment: balance > 0,
    can_mark_paid: balance > 0,
    links: pledgeActionLinks(pledgeId),
    actions: [
      {
        key: "preview_reminder",
        label: "Preview Reminder",
        method: "GET",
        url: `/api/finance/pledges/${pledgeId}/reminder/preview`,
        enabled: true,
      },
      {
        key: "send_reminder",
        label: "Send Reminder",
        method: "POST",
        url: `/api/finance/pledges/${pledgeId}/reminder/send`,
        enabled: Boolean(email && balance > 0),
      },
      {
        key: "create_payment_link",
        label: "Create Payment Link",
        method: "POST",
        url: `/api/finance/pledges/${pledgeId}/reminder/link`,
        enabled: balance > 0,
      },
      {
        key: "record_payment",
        label: "Record Payment",
        method: "POST",
        url: `/api/finance/pledges/${pledgeId}/payments`,
        enabled: balance > 0,
      },
      {
        key: "mark_paid",
        label: "Mark Paid",
        method: "POST",
        url: `/api/finance/pledges/${pledgeId}/mark-paid`,
        enabled: balance > 0,
      },
    ],
  };
}

async function recordReminderHistory(req, pledge, payload = {}) {
  try {
    if (!(await tableExists("tbl_finance_pledge_reminder_history"))) return;

    const conn = await pool.getConnection();

    try {
      await insertDynamic(conn, "tbl_finance_pledge_reminder_history", {
        pledge_id: pledge.id,
        campaign_id: pledge.campaign_id || null,
        member_id: pledge.member_id || null,
        recipient_email: payload.email || pledge.email_snapshot || pledge.donor_email || null,
        subject: payload.subject || null,
        message: payload.message || null,
        status: payload.status || "sent",
        reminder_type: payload.reminder_type || "manual",
        invoice_id: payload.invoice_id || null,
        invoice_number: payload.invoice_number || null,
        payment_link: payload.payment_link || null,
        sent_by: actorId(req),
        sent_at: new Date(),
        created_at: new Date(),
        metadata_json: safeJson(payload),
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("pledge reminder history write failed:", err.message);
  }
}

async function sendPledgePaymentLinkEmail(req, pledge, invoice, links, options = {}) {
  const to =
    options.email ||
    pledge.email_snapshot ||
    pledge.donor_email ||
    pledge.guest_email ||
    null;

  if (!to) {
    throw new Error("Pledge donor email is required.");
  }

  const paymentLink = links?.pay_url || links?.view_url || options.payment_link || null;
  const amountDue = money(options.amount || invoice.balance_due || invoice.total_amount || remainingAmount(pledge));

  if (hasMethod(pledgeReminderService, "sendPledgeReminder")) {
    const result = await pledgeReminderService.sendPledgeReminder({
      ...options,
      pledge_id: pledge.id,
      pledgeId: pledge.id,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      payment_link: paymentLink,
      email: to,
      force: true,
    });

    await recordReminderHistory(req, pledge, {
      email: to,
      subject: options.subject || "Pledge Payment Reminder",
      message: options.message || null,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      payment_link: paymentLink,
      status: result?.success === false || result?.ok === false ? "failed" : "sent",
    });

    return result;
  }

  if (!hasMethod(notificationService, "sendEmail")) {
    return {
      ok: false,
      skipped: true,
      reason: "notificationService.sendEmail unavailable",
    };
  }

  const result = await notificationService.sendEmail({
    to,
    subject:
      options.subject ||
      `Holy Trinity Ethiopian Orthodox Church Pledge Invoice ${invoice.invoice_number || ""}`.trim(),
    html:
      options.message ||
      `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2>Pledge Payment Request</h2>
        <p>Dear ${pledge.full_name_snapshot || pledge.donor_name || "Friend"},</p>
        <p>Thank you for your pledge${pledge.campaign_name ? ` for ${pledge.campaign_name}` : ""}.</p>
        <p><strong>Invoice:</strong> ${invoice.invoice_number || invoice.id}</p>
        <p><strong>Amount due:</strong> $${amountDue.toFixed(2)}</p>
        ${
          paymentLink
            ? `<p><a href="${paymentLink}" style="display:inline-block;background:#0f4c81;color:#ffffff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:700">Pay Securely</a></p>`
            : ""
        }
        <p>Holy Trinity Finance Office</p>
      </div>
      `,
    notification_type: "pledge_invoice",
    member_id: pledge.member_id || null,
    meta: {
      pledge_id: pledge.id,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      payment_link: paymentLink,
    },
  });

  await recordReminderHistory(req, pledge, {
    email: to,
    subject: options.subject || "Pledge Payment Reminder",
    message: options.message || null,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    payment_link: paymentLink,
    status: result?.success === false || result?.ok === false ? "failed" : "sent",
  });

  return result;
}

async function createPledgePayment(req, pledge, amount) {
  const method = normalizePaymentMethod(req.body.method || req.body.payment_method || "manual");
  const provider = clean(req.body.provider || (["card", "ach"].includes(method) ? "stripe" : "manual"), 80);

  const beforePaid = money(pledge.paid_amount || 0);

  let result = null;

  if (hasMethod(paymentService, "createPayment")) {
    result = await paymentService.createPayment({
      category: "pledge",
      payment_type: "pledge",
      pledge_id: pledge.id,
      campaign_id: pledge.campaign_id || null,

      member_id: pledge.member_id || null,
      member_no: pledge.member_no || null,

      full_name_snapshot: pledge.full_name_snapshot || pledge.donor_name || "Guest Donor",
      email_snapshot: pledge.email_snapshot || pledge.donor_email || null,
      phone_snapshot: pledge.phone_snapshot || pledge.donor_phone || null,

      amount,
      method,
      payment_method: method,
      provider,
      reference_no: req.body.reference_no || req.body.reference_number || null,
      notes: req.body.notes || null,

      status: "paid",
      paid_at: req.body.paid_at || req.body.payment_date || new Date(),

      manual_entry: true,
      created_by: actorId(req),
      recorded_by: actorId(req),
      source: "finance_pledges_route",
    });
  } else {
    const conn = await pool.getConnection();

    try {
      const paymentId = await insertDynamic(conn, "tbl_finance_payments", {
        payment_number: code("PAY"),

        category: "pledge",
        payment_type: "pledge",
        pledge_id: pledge.id,
        campaign_id: pledge.campaign_id || null,

        member_id: pledge.member_id || null,
        member_no: pledge.member_no || null,
        full_name_snapshot: pledge.full_name_snapshot || pledge.donor_name || "Guest Donor",
        email_snapshot: pledge.email_snapshot || pledge.donor_email || null,
        phone_snapshot: pledge.phone_snapshot || pledge.donor_phone || null,

        amount,
        method,
        payment_method: method,
        provider,
        reference_no: req.body.reference_no || req.body.reference_number || null,
        status: "paid",
        paid_at: req.body.paid_at || req.body.payment_date || new Date(),
        notes: req.body.notes || null,

        created_by: actorId(req),
        created_at: new Date(),
        updated_at: new Date(),
      });

      result = {
        success: true,
        payment_id: paymentId,
      };
    } finally {
      conn.release();
    }
  }

  const conn = await pool.getConnection();

  try {
    const fresh = await getPledgeById(conn, pledge.id);
    const afterPaid = money(fresh?.paid_amount || 0);

    if (afterPaid <= beforePaid) {
      const nextPaid = money(beforePaid + amount);
      const pledged = money(pledge.pledged_amount || pledge.amount || pledge.total_amount);
      const remaining = Math.max(pledged - nextPaid, 0);
      const status = await pledgeStatusForDb(pledged, nextPaid, pledge.status);

      await updateDynamic(
        conn,
        "tbl_finance_pledges",
        {
          paid_amount: nextPaid,
          remaining_balance: remaining,
          balance_due: remaining,
          status,
          last_payment_at: new Date(),
          updated_by: actorId(req),
          updated_at: new Date(),
        },
        "id = ?",
        [pledge.id]
      );
    }
  } finally {
    conn.release();
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Dashboard / Campaigns                                                      */
/* -------------------------------------------------------------------------- */

router.get("/kpis", async (req, res) => {
  try {
    const kpis = await callFirst(
      pledgeKpiService,
      ["getPledgeDashboardKpis", "getPledgeKpis"],
      [req.query],
      async () => {
        const result = await listPledgesFallback({
          ...req.query,
          page: 1,
          limit: 1,
        });

        return result.summary;
      }
    );

    return res.json({
      ok: true,
      kpis,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load pledge KPIs.");
  }
});

router.get("/campaign-rollups", async (req, res) => {
  try {
    const result = await callFirst(
      campaignRollupService,
      ["getCampaignRollups", "getRollups"],
      [req.query],
      async () => {
        if (!(await tableExists("tbl_finance_campaigns"))) return [];

        const [rows] = await pool.query(
          `
          SELECT
            c.id,
            COALESCE(c.title, c.name, c.campaign_name, CONCAT('Campaign ', c.id)) AS campaign_name,
            COALESCE(c.goal_amount, c.target_amount, c.goal, 0) AS goal_amount,
            COALESCE(SUM(p.pledged_amount), 0) AS pledged_amount,
            COALESCE(SUM(p.paid_amount), 0) AS paid_amount,
            COALESCE(SUM(GREATEST(COALESCE(p.pledged_amount, 0) - COALESCE(p.paid_amount, 0), 0)), 0) AS remaining_amount,
            COUNT(p.id) AS pledge_count
          FROM tbl_finance_campaigns c
          LEFT JOIN tbl_finance_pledges p
            ON p.campaign_id = c.id
          GROUP BY c.id
          ORDER BY c.id DESC
          `
        );

        return rows;
      }
    );

    return res.json({
      ok: true,
      rows: Array.isArray(result) ? result : result.rows || result.rollups || [],
      summary: result.summary || null,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load campaign rollups.");
  }
});

router.get("/campaigns", async (_req, res) => {
  try {
    if (!(await tableExists("tbl_finance_campaigns"))) {
      return res.json({ ok: true, rows: [] });
    }

    const [rows] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_campaigns
      ORDER BY id DESC
      LIMIT 500
      `
    );

    return res.json({
      ok: true,
      rows,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load campaigns.");
  }
});

router.post("/campaigns", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const id = await insertDynamic(conn, "tbl_finance_campaigns", {
      campaign_number: req.body.campaign_number || code("CMP"),
      title: req.body.title || req.body.name || req.body.campaign_name,
      name: req.body.name || req.body.title || req.body.campaign_name,
      campaign_name: req.body.campaign_name || req.body.title || req.body.name,

      description: req.body.description || null,
      goal_amount: money(req.body.goal_amount || req.body.goal || req.body.target_amount),
      target_amount: money(req.body.goal_amount || req.body.goal || req.body.target_amount),

      start_date: req.body.start_date || null,
      end_date: req.body.end_date || null,
      status: req.body.status || "active",
      is_active: req.body.is_active === false ? 0 : 1,

      created_by: actorId(req),
      created_at: new Date(),
      updated_at: new Date(),
    });

    await audit(req, "campaign.created", id, req.body);

    return res.status(201).json({
      ok: true,
      campaign_id: id,
    });
  } catch (err) {
    return routeError(res, err, "Failed to create campaign.", 400);
  } finally {
    conn.release();
  }
});

router.patch("/campaigns/:campaignId", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await updateDynamic(
      conn,
      "tbl_finance_campaigns",
      {
        title: req.body.title || req.body.name || req.body.campaign_name,
        name: req.body.name || req.body.title || req.body.campaign_name,
        campaign_name: req.body.campaign_name || req.body.title || req.body.name,
        description: req.body.description,
        goal_amount: req.body.goal_amount !== undefined ? money(req.body.goal_amount) : undefined,
        target_amount: req.body.target_amount !== undefined ? money(req.body.target_amount) : undefined,
        start_date: req.body.start_date,
        end_date: req.body.end_date,
        status: req.body.status,
        is_active: req.body.is_active,
        updated_by: actorId(req),
        updated_at: new Date(),
      },
      "id = ?",
      [req.params.campaignId]
    );

    await audit(req, "campaign.updated", req.params.campaignId, req.body);

    return res.json({
      ok: true,
      campaign_id: req.params.campaignId,
    });
  } catch (err) {
    return routeError(res, err, "Failed to update campaign.", 400);
  } finally {
    conn.release();
  }
});

/* -------------------------------------------------------------------------- */
/* Analytics / Processors                                                     */
/* -------------------------------------------------------------------------- */

router.get("/aging", async (req, res) => {
  try {
    const result = await callFirst(
      pledgeAgingService,
      ["getPledgeAging", "getAgingReport"],
      [req.query]
    );

    return res.json({ ok: true, result });
  } catch (err) {
    return routeError(res, err, "Failed to load pledge aging.");
  }
});

router.get("/goals", async (req, res) => {
  try {
    const result = await callFirst(
      pledgeGoalTrackingService,
      ["getPledgeGoalTracking", "getGoalTracking"],
      [req.query]
    );

    return res.json({ ok: true, result });
  } catch (err) {
    return routeError(res, err, "Failed to load pledge goals.");
  }
});

router.get("/forecast", async (req, res) => {
  try {
    const result = await callFirst(
      pledgeForecastService,
      ["getPledgeForecast", "getForecast"],
      [req.query]
    );

    return res.json({ ok: true, result });
  } catch (err) {
    return routeError(res, err, "Failed to load pledge forecast.");
  }
});

router.get("/collections", async (req, res) => {
  try {
    const result = await callFirst(
      pledgeCollectionAnalyticsService,
      ["getPledgeCollectionAnalytics", "getCollectionAnalytics"],
      [req.query]
    );

    return res.json({ ok: true, result });
  } catch (err) {
    return routeError(res, err, "Failed to load pledge collections.");
  }
});

router.get("/performance", async (req, res) => {
  try {
    const result = await callFirst(
      pledgeCampaignPerformanceService,
      ["getCampaignPerformance", "getPledgeCampaignPerformance"],
      [req.query]
    );

    return res.json({ ok: true, result });
  } catch (err) {
    return routeError(res, err, "Failed to load campaign performance.");
  }
});

router.get("/reminders/stats", async (req, res) => {
  try {
    const [history, email] = await Promise.all([
      optionalCall(
        pledgeReminderHistoryService,
        ["getPledgeReminderHistorySummary"],
        [req.query],
        "reminderHistory"
      ),
      optionalCall(
        pledgeEmailTrackingService,
        ["getPledgeEmailTrackingSummary"],
        [req.query],
        "emailTracking"
      ),
    ]);

    return res.json({
      ok: true,
      history: history.summary || history,
      email: email.summary || email,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load reminder stats.");
  }
});

router.get("/reminders/candidates", async (req, res) => {
  try {
    const rows = await callFirst(
      pledgeReminderService,
      ["getReminderCandidates"],
      [reminderOptions(req)]
    );

    return res.json({
      ok: true,
      rows,
      summary: {
        total: Array.isArray(rows) ? rows.length : 0,
        members: Array.isArray(rows) ? rows.filter((row) => row.member_id).length : 0,
        non_members: Array.isArray(rows) ? rows.filter((row) => !row.member_id).length : 0,
        with_email: Array.isArray(rows) ? rows.filter((row) => row.email).length : 0,
      },
    });
  } catch (err) {
    return routeError(res, err, "Failed to load reminder candidates.");
  }
});

router.post("/reminders/run", async (req, res) => {
  try {
    const options = reminderOptions(req);

    const result = await callFirst(
      pledgeReminderService,
      ["sendBulkPledgeReminders", "sendPledgeReminderBatch"],
      [options],
      () =>
        callFirst(
          pledgeAutoReminderProcessor,
          ["processAutoReminders", "runPledgeAutoReminderProcessor"],
          [options]
        )
    );

    await audit(req, "pledge.reminders.batch_run", null, {
      result_summary: result?.summary || null,
    });

    return res.json({
      ok: result?.ok !== false,
      result,
    });
  } catch (err) {
    return routeError(res, err, "Failed to run pledge reminders.", 400);
  }
});

router.post("/reminders/send-batch", async (req, res) => {
  return router.handle(
    Object.assign(req, {
      method: "POST",
      url: "/reminders/run",
    }),
    res
  );
});

router.post("/processors/overdue", async (req, res) => {
  try {
    const [autoOverdue, aging, schedule] = await Promise.all([
      optionalCall(
        pledgeAutoOverdueProcessor,
        ["processAutoOverduePledges", "runPledgeAutoOverdueProcessor"],
        [req.body || {}],
        "autoOverdue"
      ),
      optionalCall(
        pledgeAgingService,
        ["markOverduePledges"],
        [req.body || {}],
        "aging"
      ),
      optionalCall(
        pledgeScheduleService,
        ["markOverdueScheduleItems"],
        [req.body || {}],
        "schedule"
      ),
    ]);

    return res.json({
      ok: true,
      autoOverdue,
      aging,
      schedule,
    });
  } catch (err) {
    return routeError(res, err, "Failed to process overdue pledges.");
  }
});

router.post("/processors/reminders", async (req, res) => {
  try {
    const result = await callFirst(
      pledgeAutoReminderProcessor,
      ["processAutoReminders", "runPledgeAutoReminderProcessor"],
      [reminderOptions(req)]
    );

    return res.json({
      ok: true,
      result,
    });
  } catch (err) {
    return routeError(res, err, "Failed to process pledge reminders.", 400);
  }
});

router.post("/processors/recurring", async (req, res) => {
  try {
    const result = await callFirst(
      pledgeRecurringService,
      ["processRecurringPledges"],
      [{ ...(req.body || {}), actorId: actorId(req) }]
    );

    return res.json({
      ok: true,
      result,
    });
  } catch (err) {
    return routeError(res, err, "Failed to process recurring pledges.");
  }
});

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/export", async (req, res) => {
  try {
    const format = clean(req.query.format || "xlsx", 20).toLowerCase();
    const result = await listPledgesFallback({
      ...req.query,
      page: 1,
      limit: req.query.limit || 5000,
    });

    let exportResult;

    if (format === "csv") {
      exportResult = await exportService.exportCsv({
        rows: result.rows,
        fileName: "finance-pledges",
      });
    } else if (format === "json") {
      exportResult = await exportService.exportJson({
        rows: result.rows,
        fileName: "finance-pledges",
        summary: result.summary,
      });
    } else {
      exportResult = await exportService.exportExcel({
        rows: result.rows,
        fileName: "finance-pledges",
        sheetName: "Pledges",
        summary: result.summary,
      });
    }

    return res.json({
      ok: true,
      export: exportResult,
    });
  } catch (err) {
    return routeError(res, err, "Failed to export pledges.");
  }
});

router.get("/export/csv", async (req, res) => {
  try {
    const result = await callFirst(
      pledgeExportService,
      ["exportCsv"],
      [req.query],
      async () =>
        exportService.exportCsv({
          rows: (await listPledgesFallback({ ...req.query, page: 1, limit: 5000 })).rows,
          fileName: "finance-pledges",
        })
    );

    return res.json({ ok: true, ...result });
  } catch (err) {
    return routeError(res, err, "CSV export failed.");
  }
});

router.get("/export/excel", async (req, res) => {
  try {
    const result = await callFirst(
      pledgeExportService,
      ["exportExcel"],
      [req.query],
      async () =>
        exportService.exportExcel({
          rows: (await listPledgesFallback({ ...req.query, page: 1, limit: 5000 })).rows,
          fileName: "finance-pledges",
          sheetName: "Pledges",
        })
    );

    return res.json({ ok: true, ...result });
  } catch (err) {
    return routeError(res, err, "Excel export failed.");
  }
});

/* -------------------------------------------------------------------------- */
/* Pledge Collection                                                          */
/* -------------------------------------------------------------------------- */

router.get("/", async (req, res) => {
  try {
    const result = await callFirst(
      pledgeReceivableService,
      ["getPledges", "listPledges"],
      [req.query],
      () => listPledgesFallback(req.query)
    );

    return res.json({
      ok: true,
      rows: result.rows || result.pledges || result,
      summary: result.summary || {},
      pagination: result.pagination || null,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load pledges.");
  }
});

router.post("/", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    if (!(await tableExists("tbl_finance_pledges"))) {
      throw new Error("tbl_finance_pledges table does not exist.");
    }

    await conn.beginTransaction();

    const payload = await buildPledgePayload(conn, req);

    payload.data.created_by = actorId(req);
    payload.data.created_at = new Date();

    const pledgeId = await insertDynamic(conn, "tbl_finance_pledges", payload.data);

    await conn.commit();

    const pledge = await getPledgeById(conn, pledgeId);

    let payment = null;
    let invoice = null;
    let links = null;
    let email_result = null;
    let workflow_warning = null;

    if (money(req.body.upfront_amount || 0) > 0) {
      payment = await createPledgePayment(req, pledge, money(req.body.upfront_amount));
    }

    const wantsInvoice =
      truthy(req.body.create_invoice) ||
      truthy(req.body.create_payment_link) ||
      truthy(req.body.public_payment_link) ||
      truthy(req.body.include_payment_link) ||
      truthy(req.body.send_invoice_email);

    const invoiceAmount = money(
      req.body.invoice_amount ||
        req.body.remaining_balance ||
        req.body.balance_due ||
        payload.data.remaining_balance
    );

    if (wantsInvoice && invoiceAmount > 0) {
      try {
        invoice = await createInvoiceForPledge(req, pledge, {
          amount: invoiceAmount,
          due_date: req.body.due_date || payload.data.due_date,
          notes: req.body.notes || null,
          force_new_invoice: truthy(req.body.force_new_invoice),
        });

        links = publicInvoiceLinks(invoice);

        await audit(req, "pledge.payment_link.created", pledgeId, {
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          payment_link: links?.pay_url || links?.view_url || null,
          source: "pledge_create",
        });

        if (truthy(req.body.send_invoice_email)) {
          email_result = await sendPledgePaymentLinkEmail(req, pledge, invoice, links, {
            amount: invoiceAmount,
            due_date: req.body.due_date || payload.data.due_date,
            subject: req.body.invoice_subject || req.body.subject,
            message: req.body.invoice_message || req.body.message,
            email: req.body.email || req.body.email_snapshot,
          });
        }
      } catch (workflowErr) {
        workflow_warning =
          workflowErr.message ||
          "Pledge was created, but invoice/payment-link workflow failed.";

        console.error("pledge invoice/payment-link workflow failed:", workflowErr);
      }
    }

    await audit(req, "pledge.created", pledgeId, {
      pledge_number: pledge?.pledge_number || payload.data.pledge_number,
      amount: payload.data.pledged_amount,
      upfront_amount: money(req.body.upfront_amount || 0),
    });

    return res.status(201).json({
      ok: true,
      pledge_id: pledgeId,
      pledge_number: pledge?.pledge_number || payload.data.pledge_number,
      pledge: await getPledgeById(conn, pledgeId),
      payment,
      invoice,
      links,
      payment_link: links?.pay_url || links?.view_url || null,
      email_result,
      warning: workflow_warning,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_rollbackErr) {}

    return routeError(res, err, "Failed to create pledge.", 400);
  } finally {
    conn.release();
  }
});

/* -------------------------------------------------------------------------- */
/* ID-Specific Routes                                                         */
/* -------------------------------------------------------------------------- */

router.get("/:id/actions", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const pledge = await getPledgeById(conn, req.params.id);

    if (!pledge) {
      return res.status(404).json({
        ok: false,
        error: "Pledge not found.",
      });
    }

    return res.json({
      ok: true,
      pledge_id: pledge.id,
      actions: pledgeActionManifest(pledge),
    });
  } catch (err) {
    return routeError(res, err, "Failed to load pledge actions.");
  } finally {
    conn.release();
  }
});

router.get("/:id/statement", async (req, res) => {
  try {
    const statement = await callFirst(
      pledgeStatementService,
      ["getPledgeStatement", "getStatement"],
      [req.params.id, req.query]
    );

    return res.json({
      ok: true,
      ...statement,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load pledge statement.");
  }
});

router.get("/:id/schedule", async (req, res) => {
  try {
    const schedule = await callFirst(
      pledgeScheduleService,
      ["getSchedule", "getPledgeSchedule"],
      [req.params.id, req.query]
    );

    return res.json({
      ok: true,
      schedule,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load pledge schedule.");
  }
});

router.post("/:id/schedule", async (req, res) => {
  try {
    const result = await callFirst(
      pledgeScheduleService,
      ["buildSchedule", "createSchedule"],
      [req.params.id, req.body, actorId(req)]
    );

    return res.json({
      ok: true,
      result,
    });
  } catch (err) {
    return routeError(res, err, "Failed to build pledge schedule.", 400);
  }
});

router.get("/:id/recurring", async (req, res) => {
  try {
    const recurring = await callFirst(
      pledgeRecurringService,
      ["getRecurringPlan", "getPledgeRecurringPlan"],
      [req.params.id]
    );

    return res.json({
      ok: true,
      recurring,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load recurring pledge.");
  }
});

router.post("/:id/recurring", async (req, res) => {
  try {
    const result = await callFirst(
      pledgeRecurringService,
      ["enableRecurring", "createRecurringPlan"],
      [req.params.id, req.body, actorId(req)]
    );

    return res.json({
      ok: true,
      result,
    });
  } catch (err) {
    return routeError(res, err, "Failed to enable recurring pledge.", 400);
  }
});

router.get("/:id/audit", async (req, res) => {
  try {
    const auditTrail = await callFirst(
      pledgeAuditService,
      ["getPledgeAuditTrail", "getAuditTrail"],
      [req.params.id, req.query]
    );

    return res.json({
      ok: true,
      audit: auditTrail,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load pledge audit trail.");
  }
});

router.get("/:id/reminders", async (req, res) => {
  try {
    const history = await callFirst(
      pledgeReminderHistoryService,
      ["getPledgeReminderHistory"],
      [{ ...req.query, pledge_id: req.params.id }]
    );

    return res.json({
      ok: true,
      history,
      actions: pledgeActionLinks(req.params.id),
    });
  } catch (err) {
    return routeError(res, err, "Failed to load reminder history.");
  }
});

router.get("/:id/reminder/preview", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const pledge = await getPledgeById(conn, req.params.id);

    if (!pledge) {
      return res.status(404).json({
        ok: false,
        error: "Pledge not found.",
      });
    }

    const invoice = await findOpenInvoiceForPledge(pledge.id);
    const links = invoice ? publicInvoiceLinks(invoice) : null;

    return res.json({
      ok: true,
      pledge,
      invoice,
      payment_link: links?.pay_url || links?.view_url || null,
      actions: pledgeActionManifest(pledge),
      preview: {
        to: pledge.email_snapshot || pledge.donor_email,
        subject: req.query.subject || "Pledge Payment Reminder",
        amount_due: remainingAmount(pledge),
        campaign_name: pledge.campaign_name,
      },
    });
  } catch (err) {
    return routeError(res, err, "Failed to preview pledge reminder.", 400);
  } finally {
    conn.release();
  }
});

router.post("/:id/reminder/link", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const pledge = await getPledgeById(conn, req.params.id);

    if (!pledge) {
      return res.status(404).json({
        ok: false,
        error: "Pledge not found.",
      });
    }

    const invoice = await createInvoiceForPledge(req, pledge, {
      amount: req.body.amount || remainingAmount(pledge),
      due_date: req.body.due_date,
      force_new_invoice: req.body.force_new_invoice || req.body.forceNewInvoice,
    });

    const links = publicInvoiceLinks(invoice);

    await audit(req, "pledge.payment_link.created", pledge.id, {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      payment_link: links?.pay_url || links?.view_url || null,
    });

    return res.json({
      ok: true,
      message: "Pledge payment link created.",
      pledge,
      invoice,
      links,
      payment_link: links?.pay_url || links?.view_url || null,
    });
  } catch (err) {
    return routeError(res, err, "Failed to create pledge payment link.", 400);
  } finally {
    conn.release();
  }
});

router.post("/:id/reminder/send", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const pledge = await getPledgeById(conn, req.params.id);

    if (!pledge) {
      return res.status(404).json({
        ok: false,
        error: "Pledge not found.",
      });
    }

    const options = reminderOptions(req, {
      pledge_id: pledge.id,
      pledgeId: pledge.id,
      force: req.body?.force !== undefined ? Boolean(req.body.force) : true,
    });

    let result = null;

    if (hasMethod(pledgeReminderService, "sendPledgeReminder")) {
      result = await pledgeReminderService.sendPledgeReminder(options);
    } else {
      const invoice = await createInvoiceForPledge(req, pledge, {
        amount: remainingAmount(pledge),
        force_new_invoice: options.force_new_invoice,
      });

      const links = publicInvoiceLinks(invoice);
      const to = options.email || pledge.email_snapshot || pledge.donor_email;

      if (!to) {
        throw new Error("Pledge donor email is required.");
      }

      result = await notificationService.sendEmail({
        to,
        subject: options.subject || "Pledge Payment Reminder",
        html:
          options.message ||
          `
          <div style="font-family:Arial,sans-serif;line-height:1.6">
            <h2>Pledge Payment Reminder</h2>
            <p>Dear ${pledge.full_name_snapshot || pledge.donor_name || "Friend"},</p>
            <p>This is a friendly reminder for your pledge${pledge.campaign_name ? ` for ${pledge.campaign_name}` : ""}.</p>
            <p><strong>Amount due:</strong> $${remainingAmount(pledge).toFixed(2)}</p>
            <p><a href="${links?.pay_url || links?.view_url}">Pay securely online</a></p>
            <p>Holy Trinity Finance Office</p>
          </div>
          `,
        notification_type: "pledge_reminder",
        member_id: pledge.member_id || null,
        meta: {
          pledge_id: pledge.id,
          invoice_id: invoice.id,
          payment_link: links?.pay_url || links?.view_url || null,
        },
      });

      result.invoice = invoice;
      result.links = links;
      result.payment_link = links?.pay_url || links?.view_url || null;
    }

    await recordReminderHistory(req, pledge, {
      email: result?.to || options.email || pledge.email_snapshot || pledge.donor_email,
      subject: options.subject || "Pledge Payment Reminder",
      message: options.message || null,
      invoice_id: result?.invoice_id || result?.invoice?.id || null,
      invoice_number: result?.invoice_number || result?.invoice?.invoice_number || null,
      payment_link: result?.payment_link || result?.links?.pay_url || result?.links?.view_url || null,
      status: result?.success === false || result?.ok === false ? "failed" : "sent",
    });

    await audit(req, "pledge.reminder.sent", pledge.id, {
      result,
    });

    return res.status(result?.ok === false || result?.success === false ? 400 : 200).json({
      ok: result?.ok !== false && result?.success !== false,
      message:
        result?.ok === false || result?.success === false
          ? "Pledge reminder was not sent."
          : "Pledge reminder sent.",
      result,
    });
  } catch (err) {
    return routeError(res, err, "Failed to send pledge reminder.", 400);
  } finally {
    conn.release();
  }
});

router.post("/:id/reminder", (req, res) => {
  req.url = `/${req.params.id}/reminder/send`;
  return router.handle(req, res);
});

router.post("/:id/actions/send-reminder", (req, res) => {
  req.url = `/${req.params.id}/reminder/send`;
  return router.handle(req, res);
});

router.post("/:id/actions/create-payment-link", (req, res) => {
  req.url = `/${req.params.id}/reminder/link`;
  return router.handle(req, res);
});

router.post("/:id/payments", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const pledge = await getPledgeById(conn, req.params.id);

    if (!pledge) {
      return res.status(404).json({
        ok: false,
        error: "Pledge not found.",
      });
    }

    const amount = money(req.body.amount || req.body.paid_amount);

    if (amount <= 0) {
      throw new Error("Payment amount is required.");
    }

    const result = await createPledgePayment(req, pledge, amount);
    const updated = await getPledgeById(conn, pledge.id);

    await audit(req, "pledge.payment.created", pledge.id, {
      amount,
      payment_result: result,
    });

    return res.json({
      ok: true,
      message: "Pledge payment recorded.",
      result,
      pledge: updated,
    });
  } catch (err) {
    return routeError(res, err, "Failed to record pledge payment.", 400);
  } finally {
    conn.release();
  }
});

router.post("/:id/mark-paid", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const pledge = await getPledgeById(conn, req.params.id);

    if (!pledge) {
      return res.status(404).json({
        ok: false,
        error: "Pledge not found.",
      });
    }

    const amount = remainingAmount(pledge);

    if (amount <= 0) {
      return res.json({
        ok: true,
        message: "Pledge is already paid.",
        pledge,
      });
    }

    req.body.amount = amount;
    req.body.method = req.body.method || req.body.payment_method || "manual";

    const result = await createPledgePayment(req, pledge, amount);
    const updated = await getPledgeById(conn, pledge.id);

    return res.json({
      ok: true,
      message: "Pledge marked paid.",
      result,
      pledge: updated,
    });
  } catch (err) {
    return routeError(res, err, "Failed to mark pledge paid.", 400);
  } finally {
    conn.release();
  }
});

router.post("/:id/invoice", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const pledge = await getPledgeById(conn, req.params.id);

    if (!pledge) {
      return res.status(404).json({
        ok: false,
        error: "Pledge not found.",
      });
    }

    const invoice = await createInvoiceForPledge(req, pledge, {
      amount: req.body.amount || remainingAmount(pledge),
      due_date: req.body.due_date,
      force_new_invoice: req.body.force_new_invoice || req.body.forceNewInvoice,
      description: req.body.description,
      notes: req.body.notes,
    });

    await audit(req, "pledge.invoice.created", pledge.id, {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
    });

    return res.json({
      ok: true,
      message: "Pledge invoice generated.",
      invoice,
      links: publicInvoiceLinks(invoice),
    });
  } catch (err) {
    return routeError(res, err, "Failed to generate pledge invoice.", 400);
  } finally {
    conn.release();
  }
});

router.post("/:id/write-off", async (req, res) => {
  try {
    const result = await callFirst(
      pledgeWriteoffService,
      ["writeoffPledge", "writeOffPledge"],
      [
        {
          pledgeId: req.params.id,
          pledge_id: req.params.id,
          reason: req.body.reason || "Written off by finance.",
          notes: req.body.notes || null,
          approvedBy: actorId(req),
          actorId: actorId(req),
        },
      ]
    );

    await audit(req, "pledge.written_off", req.params.id, {
      reason: req.body.reason || null,
    });

    return res.json({
      ok: true,
      message: "Pledge written off.",
      result,
    });
  } catch (err) {
    return routeError(res, err, "Failed to write off pledge.", 400);
  }
});

router.put("/:id", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const existing = await getPledgeById(conn, req.params.id);

    if (!existing) {
      return res.status(404).json({
        ok: false,
        error: "Pledge not found.",
      });
    }

    await conn.beginTransaction();

    const payload = await buildPledgePayload(conn, req, existing);

    await updateDynamic(conn, "tbl_finance_pledges", payload.data, "id = ?", [
      req.params.id,
    ]);

    await conn.commit();

    await audit(req, "pledge.updated", req.params.id, {
      updates: payload.data,
    });

    return res.json({
      ok: true,
      message: "Pledge updated.",
      pledge: await getPledgeById(conn, req.params.id),
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_rollbackErr) {}

    return routeError(res, err, "Failed to update pledge.", 400);
  } finally {
    conn.release();
  }
});

router.patch("/:id", async (req, res) => {
  return router.handle(
    Object.assign(req, {
      method: "PUT",
      url: `/${req.params.id}`,
    }),
    res
  );
});

router.delete("/:id", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const pledge = await getPledgeById(conn, req.params.id);

    if (!pledge) {
      return res.status(404).json({
        ok: false,
        error: "Pledge not found.",
      });
    }

    await conn.beginTransaction();

    await updateDynamic(
      conn,
      "tbl_finance_pledges",
      {
        status: "cancelled",
        cancelled_at: new Date(),
        updated_by: actorId(req),
        updated_at: new Date(),
      },
      "id = ?",
      [req.params.id]
    );

    await conn.commit();

    await audit(req, "pledge.cancelled", req.params.id, {
      reason: req.body?.reason || "Cancelled by finance.",
    });

    return res.json({
      ok: true,
      message: "Pledge cancelled.",
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_rollbackErr) {}

    return routeError(res, err, "Failed to cancel pledge.", 400);
  } finally {
    conn.release();
  }
});

router.get("/:id", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const pledge = await callFirst(
      pledgeStatementService,
      ["getPledgeOverview"],
      [req.params.id],
      () => getPledgeById(conn, req.params.id)
    );

    if (!pledge) {
      return res.status(404).json({
        ok: false,
        error: "Pledge not found.",
      });
    }

    return res.json({
      ok: true,
      pledge,
      actions: pledgeActionManifest(pledge),
    });
  } catch (err) {
    return routeError(res, err, "Pledge not found.", 404);
  } finally {
    conn.release();
  }
});

module.exports = router;
