//backend\routes\financeCampaigns.js
// backend/routes/financeCampaigns.js
"use strict";

const express = require("express");
const crypto = require("crypto");

const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();

function optionalService(name) {
  try {
    return require(`../services/domains/pledge/${name}`);
  } catch (err) {
    if (err && err.code !== "MODULE_NOT_FOUND") {
      console.error(`Failed loading pledge service ${name}:`, err.message);
    }
    return {};
  }
}

const campaignRollupService = optionalService("campaignRollupService");
const campaignDashboardService = optionalService("campaignDashboardService");
const pledgeForecastService = optionalService("pledgeForecastService");
const pledgeAgingService = optionalService("pledgeAgingService");
const pledgeReceivableService = optionalService("pledgeReceivableService");
const pledgeCampaignPerformanceService = optionalService(
  "pledgeCampaignPerformanceService"
);

router.use(authRequired);
router.use(requireRole("finance", "admin", "super_admin"));

const META_TTL_MS = 60 * 1000;
const metaCache = new Map();

async function columnsFor(tableName) {
  const cached = metaCache.get(tableName);

  if (cached && Date.now() - cached.loadedAt < META_TTL_MS) {
    return cached.columns;
  }

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
  metaCache.set(tableName, {
    loadedAt: Date.now(),
    columns,
  });

  return columns;
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

function has(columns, column) {
  return columns.has(column);
}

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

function toMoney(value) {
  const parsed = Number(value || 0);

  if (!Number.isFinite(parsed)) return 0;

  return Number(parsed.toFixed(2));
}

function positiveInt(value, fallback = 1, max = 500) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) return fallback;

  return Math.min(parsed, max);
}

function code(prefix) {
  return `${prefix}-${Date.now()}-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

function sqlId(name) {
  return `\`${name}\``;
}

function sqlCol(alias, column) {
  return `\`${alias}\`.\`${column}\``;
}

function existingColumns(alias, columns, candidates) {
  return candidates
    .filter((candidate) => has(columns, candidate))
    .map((candidate) => sqlCol(alias, candidate));
}

function textExpr(alias, columns, candidates, fallbackSql = "''") {
  const parts = existingColumns(alias, columns, candidates);
  return parts.length ? `COALESCE(${parts.join(", ")}, ${fallbackSql})` : fallbackSql;
}

function numberExpr(alias, columns, candidates, fallbackSql = "0") {
  const parts = existingColumns(alias, columns, candidates);
  const sql = parts.length ? `COALESCE(${parts.join(", ")}, ${fallbackSql})` : fallbackSql;
  return `CAST(${sql} AS DECIMAL(18,2))`;
}

function dateExpr(alias, columns, candidates) {
  const parts = existingColumns(alias, columns, candidates);
  return parts.length ? `COALESCE(${parts.join(", ")})` : null;
}

function lowerTextExpr(alias, columns, candidates, fallbackSql = "''") {
  return `LOWER(${textExpr(alias, columns, candidates, fallbackSql)})`;
}

function reqUserId(req) {
  return req.user?.id || req.user?.user_id || req.user?.member_id || null;
}

function reqIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    null
  );
}

function allowedCampaignStatus(value, fallback = "active") {
  const status = clean(value || fallback, 40).toLowerCase();

  if (
    [
      "draft",
      "active",
      "inactive",
      "completed",
      "cancelled",
      "canceled",
      "archived",
    ].includes(status)
  ) {
    return status === "canceled" ? "cancelled" : status;
  }

  return fallback;
}

async function writeAudit(req, action, entityId, details = {}) {
  const tableName = await firstExistingTable([
    "tbl_finance_audit_logs",
    "tbl_finance_audit_log",
    "tbl_finance_audit",
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

  add("user_id", reqUserId(req));
  add("staff_id", reqUserId(req));
  add("created_by", reqUserId(req));
  add("module", "finance_campaigns");
  add("entity_type", "campaign");
  add("record_type", "campaign");
  add("entity_id", entityId);
  add("record_id", entityId);
  add("action", action);
  add("action_type", action);
  add("ip_address", reqIp(req));
  add("ip", reqIp(req));
  add("details", JSON.stringify(details));
  add("metadata", JSON.stringify(details));
  addNow("created_at");

  if (!insertColumns.length) return;

  await pool.query(
    `
    INSERT INTO ${sqlId(tableName)}
    (${insertColumns.join(", ")})
    VALUES (${placeholders.join(", ")})
    `,
    values
  );
}

function buildCampaignWhere(query, campaignColumns) {
  const clauses = ["1=1"];
  const params = [];

  const search = clean(query.search || query.q || "", 120);

  if (search) {
    const searchable = [
      "campaign_number",
      "name",
      "title",
      "campaign_name",
      "description",
    ].filter((column) => has(campaignColumns, column));

    if (searchable.length) {
      clauses.push(
        `(${searchable.map((column) => `${sqlCol("c", column)} LIKE ?`).join(" OR ")})`
      );
      searchable.forEach(() => params.push(`%${search}%`));
    }
  }

  const status = clean(query.status || "", 40).toLowerCase();

  if (status && has(campaignColumns, "status")) {
    clauses.push("LOWER(c.`status`) = ?");
    params.push(status);
  }

  if (query.active != null && has(campaignColumns, "is_active")) {
    clauses.push("c.`is_active` = ?");
    params.push(String(query.active) === "false" ? 0 : 1);
  }

  const dateColumn =
    ["created_at", "start_date", "end_date"].find((column) =>
      has(campaignColumns, column)
    ) || null;

  if (dateColumn && query.date_from) {
    clauses.push(`DATE(${sqlCol("c", dateColumn)}) >= ?`);
    params.push(clean(query.date_from, 20));
  }

  if (dateColumn && query.date_to) {
    clauses.push(`DATE(${sqlCol("c", dateColumn)}) <= ?`);
    params.push(clean(query.date_to, 20));
  }

  return {
    sql: `WHERE ${clauses.join(" AND ")}`,
    params,
  };
}

function buildCampaignOrder(query, campaignColumns) {
  const direction = String(query.direction || query.dir || "desc").toLowerCase() === "asc"
    ? "ASC"
    : "DESC";

  const createdOrder = has(campaignColumns, "created_at")
    ? "c.`created_at`"
    : "c.`id`";

  const sortMap = {
    id: "c.`id`",
    name: "campaign_name",
    title: "campaign_name",
    status: "campaign_status",
    goal: "goal_amount",
    raised: "raised_amount",
    remaining: "remaining_amount",
    progress: "progress_percent",
    created: createdOrder,
    created_at: createdOrder,
  };

  return `ORDER BY ${sortMap[clean(query.sort || "created", 40)] || createdOrder} ${direction}`;
}

async function buildCampaignMetricParts() {
  const campaignColumns = await columnsFor("tbl_finance_campaigns");
  const pledgeTableExists = await tableExists("tbl_finance_pledges");
  const paymentTableExists = await tableExists("tbl_finance_payments");

  let pledgeJoin = "";
  let paymentJoin = "";
  let emailJoin = "";

  const metric = {
    totalPledges: "0",
    memberPledges: "0",
    guestPledges: "0",
    paidPledges: "0",
    partialPledges: "0",
    unpaidPledges: "0",
    overduePledges: "0",
    totalPledged: "0",
    storedPaid: "0",
    outstandingPledges: "0",
    paymentRecords: "0",
    raisedAmount: "0",
    cashAmount: "0",
    checkAmount: "0",
    zelleAmount: "0",
    cardAmount: "0",
    achAmount: "0",
    emailSent: "0",
    emailQueued: "0",
    emailFailed: "0",
  };

  if (pledgeTableExists) {
    const pledgeColumns = await columnsFor("tbl_finance_pledges");

    if (has(pledgeColumns, "campaign_id")) {
      const pledged = numberExpr("p", pledgeColumns, [
        "pledged_amount",
        "pledge_amount",
        "amount",
        "total_amount",
      ]);

      const paid = numberExpr("p", pledgeColumns, [
        "paid_amount",
        "amount_paid",
        "collected_amount",
        "received_amount",
      ]);

      const remaining = `GREATEST(${pledged} - ${paid}, 0)`;
      const status = lowerTextExpr("p", pledgeColumns, ["status"]);
      const dueDate = dateExpr("p", pledgeColumns, ["due_date", "pledge_due_date", "end_date"]);

      const closedStatuses = "'paid','completed','fulfilled','closed'";
      const cancelledStatuses = "'cancelled','canceled','void','voided','written_off','writeoff'";

      const memberCondition = has(pledgeColumns, "member_id")
        ? "p.`member_id` IS NOT NULL"
        : `${lowerTextExpr("p", pledgeColumns, ["donor_type", "payer_type"])} = 'member'`;

      const guestCondition = has(pledgeColumns, "member_id")
        ? "p.`member_id` IS NULL"
        : `${lowerTextExpr("p", pledgeColumns, ["donor_type", "payer_type"])} IN ('guest','non_member','non-member')`;

      const overdueCondition = dueDate
        ? `${remaining} > 0 AND DATE(${dueDate}) < CURDATE() AND ${status} NOT IN (${closedStatuses},${cancelledStatuses})`
        : "0";

      pledgeJoin = `
        LEFT JOIN (
          SELECT
            p.campaign_id,
            COUNT(*) AS total_pledges,
            SUM(CASE WHEN ${memberCondition} THEN 1 ELSE 0 END) AS member_pledges,
            SUM(CASE WHEN ${guestCondition} THEN 1 ELSE 0 END) AS guest_pledges,
            SUM(${pledged}) AS total_pledged_amount,
            SUM(${paid}) AS stored_paid_amount,
            SUM(${remaining}) AS outstanding_pledge_amount,
            SUM(CASE WHEN (${remaining} <= 0 AND ${pledged} > 0) OR ${status} IN (${closedStatuses}) THEN 1 ELSE 0 END) AS paid_pledges,
            SUM(CASE WHEN ${paid} > 0 AND ${remaining} > 0 AND ${status} NOT IN (${cancelledStatuses}) THEN 1 ELSE 0 END) AS partial_pledges,
            SUM(CASE WHEN ${paid} <= 0 AND ${remaining} > 0 AND ${status} NOT IN (${cancelledStatuses}) THEN 1 ELSE 0 END) AS unpaid_pledges,
            SUM(CASE WHEN ${overdueCondition} THEN 1 ELSE 0 END) AS overdue_pledges
          FROM tbl_finance_pledges p
          WHERE p.campaign_id IS NOT NULL
          GROUP BY p.campaign_id
        ) pa ON pa.campaign_id = c.id
      `;

      metric.totalPledges = "COALESCE(pa.total_pledges, 0)";
      metric.memberPledges = "COALESCE(pa.member_pledges, 0)";
      metric.guestPledges = "COALESCE(pa.guest_pledges, 0)";
      metric.paidPledges = "COALESCE(pa.paid_pledges, 0)";
      metric.partialPledges = "COALESCE(pa.partial_pledges, 0)";
      metric.unpaidPledges = "COALESCE(pa.unpaid_pledges, 0)";
      metric.overduePledges = "COALESCE(pa.overdue_pledges, 0)";
      metric.totalPledged = "COALESCE(pa.total_pledged_amount, 0)";
      metric.storedPaid = "COALESCE(pa.stored_paid_amount, 0)";
      metric.outstandingPledges = "COALESCE(pa.outstanding_pledge_amount, 0)";
    }
  }

  if (paymentTableExists) {
    const paymentColumns = await columnsFor("tbl_finance_payments");
    const pledgeColumns = pledgeTableExists
      ? await columnsFor("tbl_finance_pledges")
      : new Set();

    const amount = numberExpr("pay", paymentColumns, [
      "amount",
      "payment_amount",
      "total_amount",
      "gross_amount",
    ]);

    const status = lowerTextExpr("pay", paymentColumns, ["status", "payment_status"], "'completed'");
    const method = lowerTextExpr("pay", paymentColumns, [
      "payment_method",
      "method",
      "tender_type",
      "payment_type",
    ]);

    const valid = `${status} NOT IN ('failed','void','voided','cancelled','canceled','refunded')`;

    let fromSql = "";
    let campaignSelect = "";

    if (has(paymentColumns, "campaign_id")) {
      fromSql = "tbl_finance_payments pay";
      campaignSelect = "pay.campaign_id";
    } else if (
      has(paymentColumns, "pledge_id") &&
      pledgeTableExists &&
      has(pledgeColumns, "campaign_id")
    ) {
      fromSql = `
        tbl_finance_payments pay
        INNER JOIN tbl_finance_pledges pp
          ON pp.id = pay.pledge_id
      `;
      campaignSelect = "pp.campaign_id";
    }

    if (fromSql && campaignSelect) {
      paymentJoin = `
        LEFT JOIN (
          SELECT
            ${campaignSelect} AS campaign_id,
            COUNT(*) AS payment_records,
            SUM(CASE WHEN ${valid} THEN ${amount} ELSE 0 END) AS total_paid_amount,
            SUM(CASE WHEN ${valid} AND ${method} IN ('cash') THEN ${amount} ELSE 0 END) AS cash_amount,
            SUM(CASE WHEN ${valid} AND ${method} IN ('check','cheque') THEN ${amount} ELSE 0 END) AS check_amount,
            SUM(CASE WHEN ${valid} AND ${method} IN ('zelle') THEN ${amount} ELSE 0 END) AS zelle_amount,
            SUM(CASE WHEN ${valid} AND ${method} IN ('card','credit_card','debit_card','stripe_card') THEN ${amount} ELSE 0 END) AS card_amount,
            SUM(CASE WHEN ${valid} AND ${method} IN ('ach','bank','bank_account') THEN ${amount} ELSE 0 END) AS ach_amount
          FROM ${fromSql}
          WHERE ${campaignSelect} IS NOT NULL
          GROUP BY ${campaignSelect}
        ) pay ON pay.campaign_id = c.id
      `;

      metric.paymentRecords = "COALESCE(pay.payment_records, 0)";
      metric.raisedAmount = `COALESCE(pay.total_paid_amount, ${metric.storedPaid}, 0)`;
      metric.cashAmount = "COALESCE(pay.cash_amount, 0)";
      metric.checkAmount = "COALESCE(pay.check_amount, 0)";
      metric.zelleAmount = "COALESCE(pay.zelle_amount, 0)";
      metric.cardAmount = "COALESCE(pay.card_amount, 0)";
      metric.achAmount = "COALESCE(pay.ach_amount, 0)";
    } else {
      metric.raisedAmount = metric.storedPaid;
    }
  } else {
    metric.raisedAmount = metric.storedPaid;
  }

  const emailTable = await firstExistingTable([
    "tbl_finance_pledge_email_tracking",
    "tbl_finance_email_tracking",
    "tbl_email_queue",
  ]);

  if (emailTable) {
    const emailColumns = await columnsFor(emailTable);
    const pledgeColumns = pledgeTableExists
      ? await columnsFor("tbl_finance_pledges")
      : new Set();

    const status = lowerTextExpr("e", emailColumns, [
      "status",
      "email_status",
      "delivery_status",
    ]);

    let fromSql = "";
    let campaignSelect = "";

    if (has(emailColumns, "campaign_id")) {
      fromSql = `${sqlId(emailTable)} e`;
      campaignSelect = "e.campaign_id";
    } else if (
      has(emailColumns, "pledge_id") &&
      pledgeTableExists &&
      has(pledgeColumns, "campaign_id")
    ) {
      fromSql = `
        ${sqlId(emailTable)} e
        INNER JOIN tbl_finance_pledges ep
          ON ep.id = e.pledge_id
      `;
      campaignSelect = "ep.campaign_id";
    }

    if (fromSql && campaignSelect) {
      emailJoin = `
        LEFT JOIN (
          SELECT
            ${campaignSelect} AS campaign_id,
            SUM(CASE WHEN ${status} IN ('sent','delivered','success') THEN 1 ELSE 0 END) AS sent_email_count,
            SUM(CASE WHEN ${status} IN ('queued','pending','scheduled') THEN 1 ELSE 0 END) AS queued_email_count,
            SUM(CASE WHEN ${status} IN ('failed','error','bounced') THEN 1 ELSE 0 END) AS failed_email_count
          FROM ${fromSql}
          WHERE ${campaignSelect} IS NOT NULL
          GROUP BY ${campaignSelect}
        ) em ON em.campaign_id = c.id
      `;

      metric.emailSent = "COALESCE(em.sent_email_count, 0)";
      metric.emailQueued = "COALESCE(em.queued_email_count, 0)";
      metric.emailFailed = "COALESCE(em.failed_email_count, 0)";
    }
  }

  const goal = numberExpr("c", campaignColumns, [
    "goal_amount",
    "goal",
    "target_amount",
  ]);

  const name = textExpr("c", campaignColumns, [
    "name",
    "title",
    "campaign_name",
  ], "CONCAT('Campaign ', c.`id`)");

  const number = textExpr("c", campaignColumns, [
    "campaign_number",
    "campaign_no",
    "code",
  ], "CONCAT('CMP-', c.`id`)");

  const status = textExpr("c", campaignColumns, ["status"], "'active'");
  const raised = metric.raisedAmount;
  const remaining = `GREATEST(${goal} - ${raised}, 0)`;
  const progress = `CASE WHEN ${goal} > 0 THEN ROUND((${raised} / ${goal}) * 100, 2) ELSE 0 END`;

  return {
    campaignColumns,
    joins: [pledgeJoin, paymentJoin, emailJoin].filter(Boolean).join("\n"),
    select: `
      c.*,
      ${number} AS campaign_number,
      ${name} AS campaign_name,
      ${name} AS title,
      ${status} AS campaign_status,
      ${goal} AS goal_amount,
      ${raised} AS raised_amount,
      ${remaining} AS remaining_amount,
      ${progress} AS progress_percent,
      ${metric.totalPledges} AS total_pledges,
      ${metric.memberPledges} AS member_pledges,
      ${metric.guestPledges} AS guest_pledges,
      ${metric.paidPledges} AS paid_pledges,
      ${metric.partialPledges} AS partial_pledges,
      ${metric.unpaidPledges} AS unpaid_pledges,
      ${metric.overduePledges} AS overdue_pledges,
      ${metric.totalPledged} AS total_pledged_amount,
      ${metric.outstandingPledges} AS outstanding_pledge_amount,
      ${metric.paymentRecords} AS payment_records,
      ${metric.cashAmount} AS cash_amount,
      ${metric.checkAmount} AS check_amount,
      ${metric.zelleAmount} AS zelle_amount,
      ${metric.cardAmount} AS card_amount,
      ${metric.achAmount} AS ach_amount,
      ${metric.emailSent} AS sent_email_count,
      ${metric.emailQueued} AS queued_email_count,
      ${metric.emailFailed} AS failed_email_count
    `,
  };
}

async function queryCampaignRows(query = {}, options = {}) {
  const parts = await buildCampaignMetricParts();
  const page = positiveInt(query.page, 1, 100000);
  const limit = positiveInt(query.limit, 25, 200);
  const offset = (page - 1) * limit;

  const where = options.where || buildCampaignWhere(query, parts.campaignColumns);
  const order = options.order || buildCampaignOrder(query, parts.campaignColumns);

  const limitSql = options.noLimit ? "" : "LIMIT ? OFFSET ?";
  const params = options.noLimit
    ? [...where.params]
    : [...where.params, limit, offset];

  const [rows] = await pool.query(
    `
    SELECT
      ${parts.select}
    FROM tbl_finance_campaigns c
    ${parts.joins}
    ${where.sql}
    ${order}
    ${limitSql}
    `,
    params
  );

  let total = rows.length;

  if (!options.noCount) {
    const [[count]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_finance_campaigns c
      ${where.sql}
      `,
      where.params
    );

    total = Number(count?.total || 0);
  }

  return {
    rows,
    pagination: {
      page,
      limit,
      total,
    },
  };
}

async function getCampaignWithMetrics(id) {
  const result = await queryCampaignRows(
    {},
    {
      where: {
        sql: "WHERE c.id = ?",
        params: [id],
      },
      order: "ORDER BY c.id DESC",
      noCount: true,
    }
  );

  return result.rows[0] || null;
}

function summarizeCampaignRows(rows) {
  const summary = {
    total_campaigns: rows.length,
    active_campaigns: 0,
    inactive_campaigns: 0,
    completed_campaigns: 0,
    total_goal_amount: 0,
    total_raised_amount: 0,
    total_remaining_amount: 0,
    progress_percent: 0,
    total_pledges: 0,
    member_pledges: 0,
    guest_pledges: 0,
    paid_pledges: 0,
    partial_pledges: 0,
    unpaid_pledges: 0,
    overdue_pledges: 0,
    payment_records: 0,
    cash_amount: 0,
    check_amount: 0,
    zelle_amount: 0,
    card_amount: 0,
    ach_amount: 0,
    sent_email_count: 0,
    queued_email_count: 0,
    failed_email_count: 0,
  };

  for (const row of rows) {
    const status = String(row.campaign_status || row.status || "").toLowerCase();

    if (status === "active") summary.active_campaigns += 1;
    if (status === "inactive") summary.inactive_campaigns += 1;
    if (status === "completed") summary.completed_campaigns += 1;

    summary.total_goal_amount += Number(row.goal_amount || 0);
    summary.total_raised_amount += Number(row.raised_amount || 0);
    summary.total_remaining_amount += Number(row.remaining_amount || 0);
    summary.total_pledges += Number(row.total_pledges || 0);
    summary.member_pledges += Number(row.member_pledges || 0);
    summary.guest_pledges += Number(row.guest_pledges || 0);
    summary.paid_pledges += Number(row.paid_pledges || 0);
    summary.partial_pledges += Number(row.partial_pledges || 0);
    summary.unpaid_pledges += Number(row.unpaid_pledges || 0);
    summary.overdue_pledges += Number(row.overdue_pledges || 0);
    summary.payment_records += Number(row.payment_records || 0);
    summary.cash_amount += Number(row.cash_amount || 0);
    summary.check_amount += Number(row.check_amount || 0);
    summary.zelle_amount += Number(row.zelle_amount || 0);
    summary.card_amount += Number(row.card_amount || 0);
    summary.ach_amount += Number(row.ach_amount || 0);
    summary.sent_email_count += Number(row.sent_email_count || 0);
    summary.queued_email_count += Number(row.queued_email_count || 0);
    summary.failed_email_count += Number(row.failed_email_count || 0);
  }

  summary.progress_percent =
    summary.total_goal_amount > 0
      ? Number(((summary.total_raised_amount / summary.total_goal_amount) * 100).toFixed(2))
      : 0;

  Object.keys(summary).forEach((key) => {
    if (typeof summary[key] === "number") {
      summary[key] = Number(summary[key].toFixed(2));
    }
  });

  return summary;
}

async function insertCampaign(req) {
  const columns = await columnsFor("tbl_finance_campaigns");

  const name = clean(
    req.body.name ||
      req.body.title ||
      req.body.campaign_name,
    190
  );

  const description = clean(req.body.description || "", 2000);
  const goalAmount = toMoney(req.body.goal_amount || req.body.goal || req.body.target_amount);
  const status = allowedCampaignStatus(req.body.status || "active");

  if (!name) {
    const error = new Error("Campaign name is required.");
    error.status = 400;
    throw error;
  }

  if (goalAmount <= 0) {
    const error = new Error("Campaign goal amount must be greater than zero.");
    error.status = 400;
    throw error;
  }

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

  const campaignNumber = code("CMP");

  add("campaign_number", campaignNumber);
  add("campaign_no", campaignNumber);
  add("code", campaignNumber);
  add("name", name);
  add("title", name);
  add("campaign_name", name);
  add("description", description || null);
  add("goal_amount", goalAmount);
  add("goal", goalAmount);
  add("target_amount", goalAmount);
  add("raised_amount", 0);
  add("remaining_amount", goalAmount);
  add("progress_percent", 0);
  add("start_date", req.body.start_date || null);
  add("end_date", req.body.end_date || null);
  add("status", status);
  add("is_active", status === "active" ? 1 : 0);
  add("created_by", reqUserId(req));
  add("created_by_user_id", reqUserId(req));
  addNow("created_at");
  addNow("updated_at");

  const [result] = await pool.query(
    `
    INSERT INTO tbl_finance_campaigns
    (${insertColumns.join(", ")})
    VALUES (${placeholders.join(", ")})
    `,
    values
  );

  await writeAudit(req, "created_campaign", result.insertId, {
    campaign_number: campaignNumber,
    name,
    goal_amount: goalAmount,
    status,
  });

  return getCampaignWithMetrics(result.insertId);
}

async function updateCampaign(req, id) {
  const existing = await getCampaignWithMetrics(id);

  if (!existing) {
    const error = new Error("Campaign not found.");
    error.status = 404;
    throw error;
  }

  const columns = await columnsFor("tbl_finance_campaigns");
  const sets = [];
  const values = [];

  function set(column, value) {
    if (!has(columns, column)) return;
    sets.push(`${sqlId(column)} = ?`);
    values.push(value);
  }

  function setNow(column) {
    if (!has(columns, column)) return;
    sets.push(`${sqlId(column)} = NOW()`);
  }

  const body = req.body || {};

  if (body.name != null || body.title != null || body.campaign_name != null) {
    const name = clean(body.name || body.title || body.campaign_name, 190);

    if (!name) {
      const error = new Error("Campaign name is required.");
      error.status = 400;
      throw error;
    }

    set("name", name);
    set("title", name);
    set("campaign_name", name);
  }

  if (body.description != null) {
    set("description", clean(body.description, 2000) || null);
  }

  if (body.goal_amount != null || body.goal != null || body.target_amount != null) {
    const goalAmount = toMoney(body.goal_amount || body.goal || body.target_amount);

    if (goalAmount <= 0) {
      const error = new Error("Campaign goal amount must be greater than zero.");
      error.status = 400;
      throw error;
    }

    set("goal_amount", goalAmount);
    set("goal", goalAmount);
    set("target_amount", goalAmount);
  }

  if (body.start_date !== undefined) set("start_date", body.start_date || null);
  if (body.end_date !== undefined) set("end_date", body.end_date || null);

  if (body.status != null) {
    const status = allowedCampaignStatus(body.status);
    set("status", status);
    set("is_active", status === "active" ? 1 : 0);
  }

  set("updated_by", reqUserId(req));
  set("updated_by_user_id", reqUserId(req));
  setNow("updated_at");

  if (!sets.length) return existing;

  values.push(id);

  await pool.query(
    `
    UPDATE tbl_finance_campaigns
    SET ${sets.join(", ")}
    WHERE id = ?
    `,
    values
  );

  await writeAudit(req, "updated_campaign", id, {
    changes: body,
  });

  return getCampaignWithMetrics(id);
}

async function setCampaignState(req, id, status) {
  const existing = await getCampaignWithMetrics(id);

  if (!existing) {
    const error = new Error("Campaign not found.");
    error.status = 404;
    throw error;
  }

  const columns = await columnsFor("tbl_finance_campaigns");
  const sets = [];
  const values = [];

  function set(column, value) {
    if (!has(columns, column)) return;
    sets.push(`${sqlId(column)} = ?`);
    values.push(value);
  }

  function setNow(column) {
    if (!has(columns, column)) return;
    sets.push(`${sqlId(column)} = NOW()`);
  }

  set("status", status);
  set("is_active", status === "active" ? 1 : 0);

  if (status !== "active") {
    setNow("deactivated_at");
    set("deactivated_by", reqUserId(req));
  }

  set("updated_by", reqUserId(req));
  setNow("updated_at");

  values.push(id);

  await pool.query(
    `
    UPDATE tbl_finance_campaigns
    SET ${sets.join(", ")}
    WHERE id = ?
    `,
    values
  );

  await writeAudit(req, `${status}_campaign`, id, {
    previous_status: existing.campaign_status || existing.status,
    new_status: status,
  });

  return getCampaignWithMetrics(id);
}

async function listCampaignRelated(tableName, campaignId, query) {
  if (!(await tableExists(tableName))) {
    return {
      rows: [],
      pagination: {
        page: 1,
        limit: 25,
        total: 0,
      },
    };
  }

  const columns = await columnsFor(tableName);
  const pledgeExists = await tableExists("tbl_finance_pledges");
  const pledgeColumns = pledgeExists ? await columnsFor("tbl_finance_pledges") : new Set();

  const page = positiveInt(query.page, 1, 100000);
  const limit = positiveInt(query.limit, 25, 200);
  const offset = (page - 1) * limit;
  const clauses = [];
  const params = [];
  let fromSql = `${sqlId(tableName)} r`;

  if (has(columns, "campaign_id")) {
    clauses.push("r.`campaign_id` = ?");
    params.push(campaignId);
  } else if (has(columns, "pledge_id") && pledgeExists && has(pledgeColumns, "campaign_id")) {
    fromSql += " INNER JOIN tbl_finance_pledges p ON p.id = r.`pledge_id`";
    clauses.push("p.`campaign_id` = ?");
    params.push(campaignId);
  } else {
    return {
      rows: [],
      pagination: {
        page,
        limit,
        total: 0,
      },
    };
  }

  const search = clean(query.search || query.q || "", 120);

  if (search) {
    const searchable = [
      "receipt_number",
      "invoice_number",
      "payment_number",
      "reference_number",
      "transaction_reference",
      "email",
      "member_email",
      "status",
    ].filter((column) => has(columns, column));

    if (searchable.length) {
      clauses.push(
        `(${searchable.map((column) => `r.${sqlId(column)} LIKE ?`).join(" OR ")})`
      );
      searchable.forEach(() => params.push(`%${search}%`));
    }
  }

  const whereSql = `WHERE ${clauses.join(" AND ")}`;
  const orderColumn =
    ["created_at", "payment_date", "invoice_date", "receipt_date", "date", "id"].find((column) =>
      has(columns, column)
    ) || "id";

  const [rows] = await pool.query(
    `
    SELECT r.*
    FROM ${fromSql}
    ${whereSql}
    ORDER BY r.${sqlId(orderColumn)} DESC
    LIMIT ?
    OFFSET ?
    `,
    [...params, limit, offset]
  );

  const [[count]] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM ${fromSql}
    ${whereSql}
    `,
    params
  );

  return {
    rows,
    pagination: {
      page,
      limit,
      total: Number(count?.total || 0),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Portfolio dashboard                                                        */
/* -------------------------------------------------------------------------- */

router.get("/summary/kpis", async (req, res) => {
  try {
    const { rows } = await queryCampaignRows(
      {
        ...req.query,
        limit: 5000,
      },
      {
        noLimit: true,
        noCount: true,
      }
    );

    return res.json({
      ok: true,
      kpis: summarizeCampaignRows(rows),
    });
  } catch (err) {
    console.error("campaign summary kpis error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load campaign KPIs.",
    });
  }
});

router.get("/summary/dashboard", async (req, res) => {
  try {
    const { rows } = await queryCampaignRows(
      {
        ...req.query,
        limit: 5000,
      },
      {
        noLimit: true,
        noCount: true,
      }
    );

    return res.json({
      ok: true,
      kpis: summarizeCampaignRows(rows),
      campaigns: rows.slice(0, 20),
    });
  } catch (err) {
    console.error("campaign dashboard error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load campaign dashboard.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Campaign CRUD                                                              */
/* -------------------------------------------------------------------------- */

router.get("/", async (req, res) => {
  try {
    const result = await queryCampaignRows(req.query);

    return res.json({
      ok: true,
      rows: result.rows,
      campaigns: result.rows,
      pagination: result.pagination,
    });
  } catch (err) {
    console.error("list campaigns error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load campaigns.",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const campaign = await insertCampaign(req);

    return res.status(201).json({
      ok: true,
      campaign,
      campaign_id: campaign.id,
      campaign_number: campaign.campaign_number,
    });
  } catch (err) {
    console.error("create campaign error:", err);
    return res.status(err.status || 500).json({
      ok: false,
      error: err.status ? err.message : "Failed to create campaign.",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const campaign = await getCampaignWithMetrics(req.params.id);

    if (!campaign) {
      return res.status(404).json({
        ok: false,
        error: "Campaign not found.",
      });
    }

    return res.json({
      ok: true,
      campaign,
      rollup: campaign,
    });
  } catch (err) {
    console.error("campaign detail error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load campaign.",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const campaign = await updateCampaign(req, req.params.id);

    return res.json({
      ok: true,
      campaign,
    });
  } catch (err) {
    console.error("update campaign error:", err);
    return res.status(err.status || 500).json({
      ok: false,
      error: err.status ? err.message : "Failed to update campaign.",
    });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const campaign = await updateCampaign(req, req.params.id);

    return res.json({
      ok: true,
      campaign,
    });
  } catch (err) {
    console.error("patch campaign error:", err);
    return res.status(err.status || 500).json({
      ok: false,
      error: err.status ? err.message : "Failed to update campaign.",
    });
  }
});

router.patch("/:id/deactivate", async (req, res) => {
  try {
    const campaign = await setCampaignState(req, req.params.id, "inactive");

    return res.json({
      ok: true,
      campaign,
    });
  } catch (err) {
    console.error("deactivate campaign error:", err);
    return res.status(err.status || 500).json({
      ok: false,
      error: err.status ? err.message : "Failed to deactivate campaign.",
    });
  }
});

router.patch("/:id/activate", async (req, res) => {
  try {
    const campaign = await setCampaignState(req, req.params.id, "active");

    return res.json({
      ok: true,
      campaign,
    });
  } catch (err) {
    console.error("activate campaign error:", err);
    return res.status(err.status || 500).json({
      ok: false,
      error: err.status ? err.message : "Failed to activate campaign.",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const campaign = await setCampaignState(req, req.params.id, "inactive");

    return res.json({
      ok: true,
      campaign,
    });
  } catch (err) {
    console.error("delete campaign error:", err);
    return res.status(err.status || 500).json({
      ok: false,
      error: err.status ? err.message : "Failed to deactivate campaign.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Campaign pledge/payment visibility                                         */
/* -------------------------------------------------------------------------- */

router.get("/:id/pledges", async (req, res) => {
  try {
    if (!(await tableExists("tbl_finance_pledges"))) {
      return res.json({
        ok: true,
        rows: [],
        pagination: {
          page: 1,
          limit: 25,
          total: 0,
        },
      });
    }

    const pledgeColumns = await columnsFor("tbl_finance_pledges");
    const paymentExists = await tableExists("tbl_finance_payments");
    const paymentColumns = paymentExists ? await columnsFor("tbl_finance_payments") : new Set();

    const memberTable = await firstExistingTable([
      "tbl_members",
      "tbl_member",
      "members",
      "tbl_church_members",
    ]);

    const memberColumns = memberTable ? await columnsFor(memberTable) : new Set();

    const page = positiveInt(req.query.page, 1, 100000);
    const limit = positiveInt(req.query.limit, 25, 200);
    const offset = (page - 1) * limit;

    const pledged = numberExpr("p", pledgeColumns, [
      "pledged_amount",
      "pledge_amount",
      "amount",
      "total_amount",
    ]);

    const storedPaid = numberExpr("p", pledgeColumns, [
      "paid_amount",
      "amount_paid",
      "collected_amount",
      "received_amount",
    ]);

    const status = textExpr("p", pledgeColumns, ["status"], "'active'");
    const dueDate = dateExpr("p", pledgeColumns, ["due_date", "pledge_due_date", "end_date"]) || "NULL";

    let paymentJoin = "";
    let paid = storedPaid;
    let lastPaymentDate = "NULL";
    let paymentCount = "0";

    if (paymentExists && has(paymentColumns, "pledge_id")) {
      const paymentAmount = numberExpr("pp", paymentColumns, [
        "amount",
        "payment_amount",
        "total_amount",
      ]);

      const paymentStatus = lowerTextExpr("pp", paymentColumns, ["status", "payment_status"], "'completed'");
      const paymentDate = dateExpr("pp", paymentColumns, [
        "payment_date",
        "paid_at",
        "created_at",
        "date",
      ]) || "pp.`id`";

      paymentJoin = `
        LEFT JOIN (
          SELECT
            pp.pledge_id,
            COUNT(*) AS payment_count,
            SUM(CASE WHEN ${paymentStatus} NOT IN ('failed','void','voided','cancelled','canceled','refunded') THEN ${paymentAmount} ELSE 0 END) AS paid_amount,
            MAX(${paymentDate}) AS last_payment_date
          FROM tbl_finance_payments pp
          GROUP BY pp.pledge_id
        ) ppay ON ppay.pledge_id = p.id
      `;

      paid = `COALESCE(ppay.paid_amount, ${storedPaid}, 0)`;
      lastPaymentDate = "ppay.last_payment_date";
      paymentCount = "COALESCE(ppay.payment_count, 0)";
    }

    const emailTable = await firstExistingTable([
      "tbl_finance_pledge_email_tracking",
      "tbl_finance_email_tracking",
      "tbl_email_queue",
    ]);

    let emailJoin = "";
    let sentEmail = "0";
    let queuedEmail = "0";
    let failedEmail = "0";

    if (emailTable) {
      const emailColumns = await columnsFor(emailTable);

      if (has(emailColumns, "pledge_id")) {
        const emailStatus = lowerTextExpr("emx", emailColumns, [
          "status",
          "email_status",
          "delivery_status",
        ]);

        emailJoin = `
          LEFT JOIN (
            SELECT
              emx.pledge_id,
              SUM(CASE WHEN ${emailStatus} IN ('sent','delivered','success') THEN 1 ELSE 0 END) AS sent_email_count,
              SUM(CASE WHEN ${emailStatus} IN ('queued','pending','scheduled') THEN 1 ELSE 0 END) AS queued_email_count,
              SUM(CASE WHEN ${emailStatus} IN ('failed','error','bounced') THEN 1 ELSE 0 END) AS failed_email_count
            FROM ${sqlId(emailTable)} emx
            GROUP BY emx.pledge_id
          ) pem ON pem.pledge_id = p.id
        `;

        sentEmail = "COALESCE(pem.sent_email_count, 0)";
        queuedEmail = "COALESCE(pem.queued_email_count, 0)";
        failedEmail = "COALESCE(pem.failed_email_count, 0)";
      }
    }

    let memberJoin = "";
    let memberName = "NULL";
    let memberEmail = "NULL";
    let memberNo = "NULL";

    if (memberTable && has(pledgeColumns, "member_id")) {
      const memberIdColumn = has(memberColumns, "id") ? "id" : "member_id";

      memberJoin = `
        LEFT JOIN ${sqlId(memberTable)} m
          ON m.${sqlId(memberIdColumn)} = p.\`member_id\`
      `;

      if (has(memberColumns, "full_name")) {
        memberName = "m.`full_name`";
      } else if (has(memberColumns, "first_name") || has(memberColumns, "last_name")) {
        memberName = `CONCAT_WS(' ', ${has(memberColumns, "first_name") ? "m.`first_name`" : "NULL"}, ${has(memberColumns, "last_name") ? "m.`last_name`" : "NULL"})`;
      } else if (has(memberColumns, "name")) {
        memberName = "m.`name`";
      }

      memberEmail = textExpr("m", memberColumns, ["email", "member_email"], "NULL");
      memberNo = textExpr("m", memberColumns, [
        "member_no",
        "member_number",
        "member_id",
      ], "NULL");
    }

    const donorName = `COALESCE(${memberName}, ${textExpr("p", pledgeColumns, [
      "full_name",
      "donor_name",
      "guest_name",
      "name",
      "full_name_snapshot",
    ], "NULL")}, 'Guest Donor')`;

    const donorEmail = `COALESCE(${memberEmail}, ${textExpr("p", pledgeColumns, [
      "email",
      "donor_email",
      "guest_email",
      "email_snapshot",
    ], "NULL")})`;

    const donorPhone = textExpr("p", pledgeColumns, [
      "phone",
      "donor_phone",
      "guest_phone",
      "phone_snapshot",
    ], "NULL");

    const donorType = has(pledgeColumns, "member_id")
      ? "CASE WHEN p.`member_id` IS NULL THEN 'guest' ELSE 'member' END"
      : textExpr("p", pledgeColumns, ["donor_type", "payer_type"], "'guest'");

    const clauses = ["p.`campaign_id` = ?"];
    const params = [req.params.id];

    const search = clean(req.query.search || req.query.q || "", 120);

    if (search) {
      clauses.push(
        `(${donorName} LIKE ? OR ${donorEmail} LIKE ? OR ${textExpr("p", pledgeColumns, [
          "pledge_number",
          "reference_number",
        ], "''")} LIKE ?)`
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (req.query.status && has(pledgeColumns, "status")) {
      clauses.push("LOWER(p.`status`) = ?");
      params.push(clean(req.query.status, 40).toLowerCase());
    }

    const remaining = `GREATEST(${pledged} - ${paid}, 0)`;

    const [rows] = await pool.query(
      `
      SELECT
        p.*,
        ${donorType} AS donor_type,
        ${memberNo} AS member_no,
        ${donorName} AS donor_name,
        ${donorName} AS full_name,
        ${donorEmail} AS email,
        ${donorPhone} AS phone,
        ${pledged} AS pledged_amount,
        ${paid} AS paid_amount,
        ${remaining} AS remaining_amount,
        ${status} AS pledge_status,
        ${dueDate} AS due_date,
        ${paymentCount} AS payment_count,
        ${lastPaymentDate} AS last_payment_date,
        ${sentEmail} AS sent_email_count,
        ${queuedEmail} AS queued_email_count,
        ${failedEmail} AS failed_email_count
      FROM tbl_finance_pledges p
      ${memberJoin}
      ${paymentJoin}
      ${emailJoin}
      WHERE ${clauses.join(" AND ")}
      ORDER BY p.id DESC
      LIMIT ?
      OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [[count]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_finance_pledges p
      ${memberJoin}
      WHERE ${clauses.join(" AND ")}
      `,
      params
    );

    return res.json({
      ok: true,
      rows,
      pledges: rows,
      pagination: {
        page,
        limit,
        total: Number(count?.total || 0),
      },
    });
  } catch (err) {
    console.error("campaign pledges error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load campaign pledges.",
    });
  }
});

router.get("/:id/payments", async (req, res) => {
  try {
    const result = await listCampaignRelated(
      "tbl_finance_payments",
      req.params.id,
      req.query
    );

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("campaign payments error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load campaign payments.",
    });
  }
});

router.get("/:id/invoices", async (req, res) => {
  try {
    const result = await listCampaignRelated(
      "tbl_finance_invoices",
      req.params.id,
      req.query
    );

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("campaign invoices error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load campaign invoices.",
    });
  }
});

router.get("/:id/receipts", async (req, res) => {
  try {
    const result = await listCampaignRelated(
      "tbl_finance_receipts",
      req.params.id,
      req.query
    );

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("campaign receipts error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load campaign receipts.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Enterprise analytics                                                       */
/* -------------------------------------------------------------------------- */

router.get("/:id/rollup", async (req, res) => {
  try {
    const data =
      typeof campaignRollupService.getCampaignRollup === "function"
        ? await campaignRollupService.getCampaignRollup(req.params.id)
        : await getCampaignWithMetrics(req.params.id);

    return res.json({
      ok: true,
      data,
      rollup: data,
    });
  } catch (err) {
    console.error("campaign rollup error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load campaign rollup.",
    });
  }
});

router.get("/:id/dashboard", async (req, res) => {
  try {
    const campaign = await getCampaignWithMetrics(req.params.id);

    if (!campaign) {
      return res.status(404).json({
        ok: false,
        error: "Campaign not found.",
      });
    }

    const serviceDashboard =
      typeof campaignDashboardService.getCampaignDashboard === "function"
        ? await campaignDashboardService.getCampaignDashboard(req.params.id)
        : null;

    return res.json({
      ok: true,
      campaign,
      dashboard: serviceDashboard || campaign,
    });
  } catch (err) {
    console.error("campaign dashboard detail error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load campaign dashboard.",
    });
  }
});

router.get("/:id/performance", async (req, res) => {
  try {
    const data =
      typeof pledgeCampaignPerformanceService.getCampaignPerformance === "function"
        ? await pledgeCampaignPerformanceService.getCampaignPerformance(req.params.id)
        : await getCampaignWithMetrics(req.params.id);

    return res.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error("campaign performance error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load campaign performance.",
    });
  }
});

router.get("/:id/aging", async (req, res) => {
  try {
    const data =
      typeof pledgeAgingService.getCampaignAging === "function"
        ? await pledgeAgingService.getCampaignAging(req.params.id)
        : [];

    return res.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error("campaign aging error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load campaign aging.",
    });
  }
});

router.get("/:id/receivables", async (req, res) => {
  try {
    const data =
      typeof pledgeReceivableService.getCampaignReceivables === "function"
        ? await pledgeReceivableService.getCampaignReceivables(req.params.id)
        : await getCampaignWithMetrics(req.params.id);

    return res.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error("campaign receivables error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load campaign receivables.",
    });
  }
});

router.get("/:id/forecast", async (req, res) => {
  try {
    const data =
      typeof pledgeForecastService.getCampaignForecast === "function"
        ? await pledgeForecastService.getCampaignForecast(req.params.id)
        : [];

    return res.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error("campaign forecast error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load campaign forecast.",
    });
  }
});

router.get("/:id/kpis", async (req, res) => {
  try {
    const campaign = await getCampaignWithMetrics(req.params.id);

    if (!campaign) {
      return res.status(404).json({
        ok: false,
        error: "Campaign not found.",
      });
    }

    return res.json({
      ok: true,
      kpis: campaign,
      campaign,
    });
  } catch (err) {
    console.error("campaign kpis error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load campaign KPIs.",
    });
  }
});

router.post("/:id/recalculate", async (req, res) => {
  try {
    const campaign = await getCampaignWithMetrics(req.params.id);

    if (!campaign) {
      return res.status(404).json({
        ok: false,
        error: "Campaign not found.",
      });
    }

    const columns = await columnsFor("tbl_finance_campaigns");
    const sets = [];
    const values = [];

    function set(column, value) {
      if (!has(columns, column)) return;
      sets.push(`${sqlId(column)} = ?`);
      values.push(value);
    }

    function setNow(column) {
      if (!has(columns, column)) return;
      sets.push(`${sqlId(column)} = NOW()`);
    }

    set("raised_amount", toMoney(campaign.raised_amount));
    set("collected_amount", toMoney(campaign.raised_amount));
    set("remaining_amount", toMoney(campaign.remaining_amount));
    set("progress_percent", Number(campaign.progress_percent || 0));
    set("pledge_count", Number(campaign.total_pledges || 0));
    set("updated_by", reqUserId(req));
    setNow("updated_at");

    if (sets.length) {
      values.push(req.params.id);

      await pool.query(
        `
        UPDATE tbl_finance_campaigns
        SET ${sets.join(", ")}
        WHERE id = ?
        `,
        values
      );
    }

    await writeAudit(req, "recalculated_campaign", req.params.id, {
      raised_amount: campaign.raised_amount,
      remaining_amount: campaign.remaining_amount,
      progress_percent: campaign.progress_percent,
      total_pledges: campaign.total_pledges,
    });

    return res.json({
      ok: true,
      campaign: await getCampaignWithMetrics(req.params.id),
    });
  } catch (err) {
    console.error("campaign recalculate error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to recalculate campaign.",
    });
  }
});

module.exports = router;