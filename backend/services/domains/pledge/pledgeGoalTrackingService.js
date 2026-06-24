//backend/services/domains/pledge/pledgeGoalTrackingService.js
"use strict";

const pool = require("../../../db");

const CAMPAIGNS_TABLE = "tbl_finance_campaigns";
const PLEDGES_TABLE = "tbl_finance_pledges";
const PAYMENTS_TABLE = "tbl_finance_payments";
const SNAPSHOT_TABLES = [
  "tbl_finance_pledge_goal_snapshots",
  "tbl_pledge_goal_snapshots",
  "tbl_finance_campaign_goal_snapshots",
];

const tableCache = new Map();
const columnCache = new Map();

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function pct(value, total) {
  const v = Number(value || 0);
  const t = Number(total || 0);
  if (!t || t <= 0) return 0;
  return Number(((v / t) * 100).toFixed(2));
}

function toInt(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function mysqlDateTime(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return mysqlDateTime(new Date());
  return d.toISOString().slice(0, 19).replace("T", " ");
}

async function tableExists(conn, tableName) {
  if (tableCache.has(tableName)) return tableCache.get(tableName);

  const [rows] = await conn.query("SHOW TABLES LIKE ?", [tableName]);
  const exists = rows.length > 0;

  tableCache.set(tableName, exists);
  return exists;
}

async function getColumns(conn, tableName) {
  if (columnCache.has(tableName)) return columnCache.get(tableName);

  const exists = await tableExists(conn, tableName);
  if (!exists) {
    const empty = new Set();
    columnCache.set(tableName, empty);
    return empty;
  }

  const [rows] = await conn.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const cols = new Set(rows.map((row) => row.Field));

  columnCache.set(tableName, cols);
  return cols;
}

function firstColumn(cols, alias, names, fallback = "NULL") {
  for (const name of names) {
    if (cols.has(name)) return `${alias}.\`${name}\``;
  }

  return fallback;
}

async function resolveSnapshotTable(conn) {
  for (const tableName of SNAPSHOT_TABLES) {
    if (await tableExists(conn, tableName)) return tableName;
  }

  return null;
}

async function insertExistingColumns(conn, tableName, data) {
  const cols = await getColumns(conn, tableName);

  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) return null;

  const fields = entries.map(([key]) => `\`${key}\``).join(", ");
  const placeholders = entries.map(() => "?").join(", ");
  const values = entries.map(([, value]) => value);

  const [result] = await conn.query(
    `INSERT INTO \`${tableName}\` (${fields}) VALUES (${placeholders})`,
    values
  );

  return result.insertId;
}

async function updateExistingColumns(conn, tableName, data, whereSql, whereParams) {
  const cols = await getColumns(conn, tableName);

  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) return 0;

  const setSql = entries.map(([key]) => `\`${key}\` = ?`).join(", ");
  const values = entries.map(([, value]) => value);

  const [result] = await conn.query(
    `UPDATE \`${tableName}\` SET ${setSql} WHERE ${whereSql}`,
    [...values, ...whereParams]
  );

  return result.affectedRows || 0;
}

async function getCampaignGoalRows(filters = {}) {
  const conn = await pool.getConnection();

  try {
    const hasCampaigns = await tableExists(conn, CAMPAIGNS_TABLE);

    if (!hasCampaigns) {
      return [];
    }

    const hasPledges = await tableExists(conn, PLEDGES_TABLE);
    const hasPayments = await tableExists(conn, PAYMENTS_TABLE);

    const campaignCols = await getColumns(conn, CAMPAIGNS_TABLE);
    const pledgeCols = hasPledges ? await getColumns(conn, PLEDGES_TABLE) : new Set();
    const paymentCols = hasPayments ? await getColumns(conn, PAYMENTS_TABLE) : new Set();

    const nameExpr = firstColumn(campaignCols, "c", [
      "campaign_name",
      "title",
      "name",
    ], "CONCAT('Campaign #', c.id)");

    const codeExpr = firstColumn(campaignCols, "c", [
      "campaign_code",
      "code",
    ]);

    const goalExpr = firstColumn(campaignCols, "c", [
      "goal_amount",
      "target_amount",
      "goal",
    ], "0");

    const statusExpr = firstColumn(campaignCols, "c", ["status"], "'active'");
    const startExpr = firstColumn(campaignCols, "c", ["start_date"], "NULL");
    const endExpr = firstColumn(campaignCols, "c", ["end_date"], "NULL");

    const pledgeAmountExpr = firstColumn(pledgeCols, "p", [
      "pledged_amount",
      "amount",
      "total_amount",
    ], "0");

    const pledgePaidExpr = firstColumn(pledgeCols, "p", [
      "paid_amount",
      "amount_paid",
      "collected_amount",
    ], "0");

    const pledgeBalanceExpr = firstColumn(pledgeCols, "p", [
      "remaining_balance",
      "balance_due",
      "outstanding_amount",
    ], `GREATEST(COALESCE(${pledgeAmountExpr}, 0) - COALESCE(${pledgePaidExpr}, 0), 0)`);

    const paymentAmountExpr = firstColumn(paymentCols, "fp", [
      "amount",
      "paid_amount",
      "total_amount",
    ], "0");

    const pledgeJoin =
      hasPledges && pledgeCols.has("campaign_id")
        ? "LEFT JOIN tbl_finance_pledges p ON p.campaign_id = c.id"
        : "";

    const paymentJoin =
      hasPayments && paymentCols.has("campaign_id")
        ? `
          LEFT JOIN tbl_finance_payments fp
            ON fp.campaign_id = c.id
            ${
              paymentCols.has("status")
                ? "AND LOWER(fp.status) IN ('paid', 'successful', 'completed', 'posted')"
                : ""
            }
        `
        : "";

    const pledgeSelect =
      hasPledges && pledgeCols.has("campaign_id")
        ? `
          COUNT(DISTINCT p.id) AS pledge_count,

          COALESCE(SUM(
            CASE
              ${
                pledgeCols.has("status")
                  ? "WHEN LOWER(COALESCE(p.status, 'receivable')) <> 'cancelled'"
                  : "WHEN 1 = 1"
              }
              THEN COALESCE(${pledgeAmountExpr}, 0)
              ELSE 0
            END
          ), 0) AS pledged_amount,

          COALESCE(SUM(
            CASE
              ${
                pledgeCols.has("status")
                  ? "WHEN LOWER(COALESCE(p.status, 'receivable')) <> 'cancelled'"
                  : "WHEN 1 = 1"
              }
              THEN COALESCE(${pledgePaidExpr}, 0)
              ELSE 0
            END
          ), 0) AS pledge_paid_amount,

          COALESCE(SUM(
            CASE
              ${
                pledgeCols.has("status")
                  ? "WHEN LOWER(COALESCE(p.status, 'receivable')) IN ('receivable', 'partial', 'invoiced', 'open', 'pending', 'overdue')"
                  : "WHEN 1 = 1"
              }
              THEN COALESCE(${pledgeBalanceExpr}, 0)
              ELSE 0
            END
          ), 0) AS outstanding_amount
        `
        : `
          0 AS pledge_count,
          0 AS pledged_amount,
          0 AS pledge_paid_amount,
          0 AS outstanding_amount
        `;

    const paymentSelect =
      hasPayments && paymentCols.has("campaign_id")
        ? `
          COUNT(DISTINCT fp.id) AS payment_count,
          COALESCE(SUM(COALESCE(${paymentAmountExpr}, 0)), 0) AS collected_payment_amount
        `
        : `
          0 AS payment_count,
          0 AS collected_payment_amount
        `;

    const where = [];
    const params = [];

    if (filters.campaign_id) {
      where.push("c.id = ?");
      params.push(filters.campaign_id);
    }

    if (filters.status && campaignCols.has("status")) {
      where.push("LOWER(c.status) = ?");
      params.push(clean(filters.status, 40).toLowerCase());
    }

    if (filters.search) {
      const q = `%${clean(filters.search, 100)}%`;
      const parts = ["CAST(c.id AS CHAR) LIKE ?"];
      params.push(q);

      for (const col of ["campaign_name", "title", "name", "campaign_code", "code"]) {
        if (campaignCols.has(col)) {
          parts.push(`c.\`${col}\` LIKE ?`);
          params.push(q);
        }
      }

      where.push(`(${parts.join(" OR ")})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const page = toInt(filters.page, 1);
    const limit = Math.min(100, toInt(filters.limit || filters.pageSize, 25));
    const offset = (page - 1) * limit;

    const [[countRow]] = await conn.query(
      `
      SELECT COUNT(*) AS total
      FROM ${CAMPAIGNS_TABLE} c
      ${whereSql}
      `,
      params
    );

    const [rows] = await conn.query(
      `
      SELECT
        c.id AS campaign_id,
        ${codeExpr} AS campaign_code,
        ${nameExpr} AS campaign_name,
        ${goalExpr} AS goal_amount,
        ${statusExpr} AS status,
        ${startExpr} AS start_date,
        ${endExpr} AS end_date,

        ${pledgeSelect},

        ${paymentSelect}

      FROM ${CAMPAIGNS_TABLE} c

      ${pledgeJoin}
      ${paymentJoin}

      ${whereSql}

      GROUP BY c.id

      ORDER BY
        status = 'active' DESC,
        campaign_name ASC

      LIMIT ?
      OFFSET ?
      `,
      [...params, limit, offset]
    );

    const total = Number(countRow.total || 0);

    return {
      rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  } finally {
    conn.release();
  }
}

function formatGoalRow(row = {}) {
  const goal = money(row.goal_amount);
  const pledged = money(row.pledged_amount);
  const pledgePaid = money(row.pledge_paid_amount);
  const collectedPayment = money(row.collected_payment_amount);
  const collected = collectedPayment > 0 ? collectedPayment : pledgePaid;
  const outstanding = money(row.outstanding_amount);
  const remainingToGoal = Math.max(0, money(goal - collected));

  return {
    campaign_id: row.campaign_id,
    campaign_code: row.campaign_code,
    campaign_name: row.campaign_name,
    status: row.status || "active",
    start_date: row.start_date,
    end_date: row.end_date,

    goal_amount: goal,
    pledged_amount: pledged,
    collected_amount: collected,
    outstanding_amount: outstanding,
    remaining_to_goal: remainingToGoal,

    pledge_count: Number(row.pledge_count || 0),
    payment_count: Number(row.payment_count || 0),

    pledged_goal_percent: pct(pledged, goal),
    collected_goal_percent: pct(collected, goal),
    collection_rate_percent: pct(collected, pledged),
    outstanding_rate_percent: pct(outstanding, pledged),

    goal_status: goalStatus({
      goal,
      pledged,
      collected,
      outstanding,
      end_date: row.end_date,
    }),
  };
}

function goalStatus(row = {}) {
  if (row.goal > 0 && row.collected >= row.goal) return "met";
  if (row.goal > 0 && row.pledged >= row.goal) return "pledged";

  if (row.end_date) {
    const end = new Date(row.end_date);
    const today = new Date();

    if (!Number.isNaN(end.getTime()) && end < today && row.collected < row.goal) {
      return "missed";
    }

    const daysLeft = Math.ceil((end.getTime() - today.getTime()) / 86400000);
    if (daysLeft <= 14 && pct(row.collected, row.goal) < 80) return "at_risk";
  }

  return "in_progress";
}

function summarizeGoalRows(rows = []) {
  const summary = rows.reduce(
    (acc, row) => {
      acc.goal_amount += money(row.goal_amount);
      acc.pledged_amount += money(row.pledged_amount);
      acc.collected_amount += money(row.collected_amount);
      acc.outstanding_amount += money(row.outstanding_amount);
      acc.remaining_to_goal += money(row.remaining_to_goal);
      acc.pledge_count += Number(row.pledge_count || 0);
      acc.payment_count += Number(row.payment_count || 0);

      acc.status_counts[row.goal_status] =
        (acc.status_counts[row.goal_status] || 0) + 1;

      return acc;
    },
    {
      goal_amount: 0,
      pledged_amount: 0,
      collected_amount: 0,
      outstanding_amount: 0,
      remaining_to_goal: 0,
      pledge_count: 0,
      payment_count: 0,
      status_counts: {},
    }
  );

  summary.pledged_goal_percent = pct(summary.pledged_amount, summary.goal_amount);
  summary.collected_goal_percent = pct(summary.collected_amount, summary.goal_amount);
  summary.collection_rate_percent = pct(summary.collected_amount, summary.pledged_amount);
  summary.outstanding_rate_percent = pct(summary.outstanding_amount, summary.pledged_amount);

  return summary;
}

async function getPledgeGoalTracking(filters = {}) {
  const result = await getCampaignGoalRows(filters);

  if (Array.isArray(result)) {
    return {
      ok: true,
      rows: [],
      summary: summarizeGoalRows([]),
      pagination: {
        page: 1,
        limit: 25,
        total: 0,
        pages: 1,
      },
    };
  }

  const rows = result.rows.map(formatGoalRow);

  return {
    ok: true,
    rows,
    summary: summarizeGoalRows(rows),
    pagination: result.pagination,
  };
}

async function getPledgeGoalTrackingByCampaign(campaignId) {
  const result = await getPledgeGoalTracking({
    campaign_id: campaignId,
    page: 1,
    limit: 1,
  });

  return result.rows[0] || null;
}

async function refreshCampaignGoalTracking(campaignId = null) {
  const conn = await pool.getConnection();

  try {
    if (!(await tableExists(conn, CAMPAIGNS_TABLE))) {
      return {
        ok: true,
        updated: 0,
        skipped: true,
      };
    }

    const campaignCols = await getColumns(conn, CAMPAIGNS_TABLE);
    const result = await getPledgeGoalTracking({
      campaign_id: campaignId || undefined,
      page: 1,
      limit: 100,
    });

    let updated = 0;

    for (const row of result.rows) {
      const data = {
        pledged_amount: campaignCols.has("pledged_amount") ? row.pledged_amount : undefined,
        collected_amount: campaignCols.has("collected_amount") ? row.collected_amount : undefined,
        remaining_amount: campaignCols.has("remaining_amount") ? row.remaining_to_goal : undefined,
        outstanding_amount: campaignCols.has("outstanding_amount") ? row.outstanding_amount : undefined,
        donor_count: campaignCols.has("donor_count") ? row.pledge_count : undefined,
        pledge_count: campaignCols.has("pledge_count") ? row.pledge_count : undefined,
        goal_status: campaignCols.has("goal_status") ? row.goal_status : undefined,
        goal_progress_percent: campaignCols.has("goal_progress_percent")
          ? row.collected_goal_percent
          : undefined,
        updated_at: campaignCols.has("updated_at") ? new Date() : undefined,
      };

      const affected = await updateExistingColumns(
        conn,
        CAMPAIGNS_TABLE,
        data,
        "id = ?",
        [row.campaign_id]
      );

      updated += affected ? 1 : 0;
    }

    return {
      ok: true,
      updated,
      summary: result.summary,
    };
  } finally {
    conn.release();
  }
}

async function createGoalSnapshot(input = {}) {
  const conn = await pool.getConnection();

  try {
    const snapshotTable = await resolveSnapshotTable(conn);

    if (!snapshotTable) {
      return {
        ok: false,
        skipped: true,
        error: "No campaign goal snapshot table exists.",
      };
    }

    const campaign =
      input.campaign ||
      (input.campaign_id
        ? await getPledgeGoalTrackingByCampaign(input.campaign_id)
        : null);

    if (!campaign) {
      return {
        ok: false,
        error: "Campaign goal data not found.",
      };
    }

    const now = mysqlDateTime(input.createdAt || new Date());

    const id = await insertExistingColumns(conn, snapshotTable, {
      campaign_id: campaign.campaign_id,
      snapshot_date: input.snapshot_date || now.slice(0, 10),
      goal_amount: campaign.goal_amount,
      pledged_amount: campaign.pledged_amount,
      collected_amount: campaign.collected_amount,
      outstanding_amount: campaign.outstanding_amount,
      remaining_to_goal: campaign.remaining_to_goal,
      pledge_count: campaign.pledge_count,
      payment_count: campaign.payment_count,
      pledged_goal_percent: campaign.pledged_goal_percent,
      collected_goal_percent: campaign.collected_goal_percent,
      collection_rate_percent: campaign.collection_rate_percent,
      outstanding_rate_percent: campaign.outstanding_rate_percent,
      goal_status: campaign.goal_status,
      meta_json: JSON.stringify({
        campaign_code: campaign.campaign_code,
        campaign_name: campaign.campaign_name,
      }),
      created_at: now,
      updated_at: now,
    });

    return {
      ok: true,
      id,
      table: snapshotTable,
      campaign_id: campaign.campaign_id,
    };
  } finally {
    conn.release();
  }
}

module.exports = {
  getPledgeGoalTracking,
  getPledgeGoalTrackingByCampaign,
  refreshCampaignGoalTracking,
  createGoalSnapshot,
};