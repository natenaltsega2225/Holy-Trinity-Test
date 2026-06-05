// backend/services/domains/pledge/campaignRollupService.js

"use strict";

const pool = require("../../../db");

/* =========================================================
   HELPERS
========================================================= */

const tableCache = new Map();
const columnCache = new Map();

function clean(value) {
  return String(value ?? "").trim();
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function toInt(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function pct(value, total) {
  const v = Number(value || 0);
  const t = Number(total || 0);

  if (!t || t <= 0) return 0;

  return Number(((v / t) * 100).toFixed(2));
}

async function tableExists(conn, tableName) {
  if (tableCache.has(tableName)) {
    return tableCache.get(tableName);
  }

  try {
    const [rows] = await conn.query(
      `SHOW TABLES LIKE ?`,
      [tableName]
    );

    const exists = rows.length > 0;

    tableCache.set(tableName, exists);

    return exists;
  } catch {
    tableCache.set(tableName, false);
    return false;
  }
}

async function getColumns(conn, tableName) {
  if (columnCache.has(tableName)) {
    return columnCache.get(tableName);
  }

  const exists = await tableExists(conn, tableName);

  if (!exists) {
    const empty = new Set();
    columnCache.set(tableName, empty);
    return empty;
  }

  const [rows] = await conn.query(
    `SHOW COLUMNS FROM \`${tableName}\``
  );

  const cols = new Set(rows.map((r) => r.Field));

  columnCache.set(tableName, cols);

  return cols;
}

function campaignNameExpr(cols, alias = "c") {
  if (cols.has("title")) return `${alias}.title`;
  if (cols.has("name")) return `${alias}.name`;
  if (cols.has("campaign_name")) return `${alias}.campaign_name`;

  return `CONCAT('Campaign #', ${alias}.id)`;
}

function campaignCodeExpr(cols, alias = "c") {
  if (cols.has("campaign_code")) return `${alias}.campaign_code`;
  if (cols.has("code")) return `${alias}.code`;

  return `NULL`;
}

function goalAmountExpr(cols, alias = "c") {
  if (cols.has("goal_amount")) return `${alias}.goal_amount`;
  if (cols.has("target_amount")) return `${alias}.target_amount`;

  return `0`;
}

function campaignStatusExpr(cols, alias = "c") {
  if (cols.has("status")) return `${alias}.status`;

  return `'active'`;
}

function campaignDateExpr(cols, column, alias = "c") {
  if (cols.has(column)) return `${alias}.${column}`;

  return `NULL`;
}

/* =========================================================
   BASE ROLLUP SELECT
========================================================= */

async function buildCampaignBaseSql(conn) {
  const hasCampaigns = await tableExists(conn, "tbl_finance_campaigns");
  const hasPledges = await tableExists(conn, "tbl_finance_pledges");
  const hasPayments = await tableExists(conn, "tbl_finance_payments");

  if (!hasCampaigns) {
    return {
      ok: false,
      error: "tbl_finance_campaigns table does not exist.",
    };
  }

  const campaignCols = await getColumns(conn, "tbl_finance_campaigns");

  const nameSql = campaignNameExpr(campaignCols);
  const codeSql = campaignCodeExpr(campaignCols);
  const goalSql = goalAmountExpr(campaignCols);
  const statusSql = campaignStatusExpr(campaignCols);
  const startSql = campaignDateExpr(campaignCols, "start_date");
  const endSql = campaignDateExpr(campaignCols, "end_date");

  const pledgeJoin = hasPledges
    ? `
      LEFT JOIN tbl_finance_pledges p
        ON p.campaign_id = c.id
    `
    : "";

  const paymentJoin = hasPayments
    ? `
      LEFT JOIN tbl_finance_payments fp
        ON fp.campaign_id = c.id
        AND (
          fp.status = 'paid'
          OR fp.payment_status = 'paid'
        )
    `
    : "";

  const pledgeSelect = hasPledges
    ? `
      COUNT(DISTINCT p.id) AS pledge_count,

      COUNT(
        DISTINCT CASE
          WHEN p.status IN ('receivable', 'partial', 'invoiced')
          THEN p.id
          ELSE NULL
        END
      ) AS open_pledge_count,

      COUNT(
        DISTINCT CASE
          WHEN p.status = 'paid'
          THEN p.id
          ELSE NULL
        END
      ) AS paid_pledge_count,

      COUNT(
        DISTINCT CASE
          WHEN p.status = 'written_off'
          THEN p.id
          ELSE NULL
        END
      ) AS written_off_count,

      COUNT(
        DISTINCT CASE
          WHEN p.status = 'cancelled'
          THEN p.id
          ELSE NULL
        END
      ) AS cancelled_count,

      COUNT(
        DISTINCT CASE
          WHEN p.status IN ('receivable', 'partial', 'invoiced')
            AND p.due_date IS NOT NULL
            AND DATE(p.due_date) < CURDATE()
          THEN p.id
          ELSE NULL
        END
      ) AS overdue_count,

      COALESCE(SUM(DISTINCT 0), 0) AS safe_placeholder,

      COALESCE(
        SUM(
          CASE
            WHEN p.status <> 'cancelled'
              OR p.status IS NULL
            THEN p.pledged_amount
            ELSE 0
          END
        ),
        0
      ) AS pledged_amount,

      COALESCE(
        SUM(
          CASE
            WHEN p.status <> 'cancelled'
              OR p.status IS NULL
            THEN p.paid_amount
            ELSE 0
          END
        ),
        0
      ) AS paid_amount,

      COALESCE(
        SUM(
          CASE
            WHEN p.status IN ('receivable', 'partial', 'invoiced')
            THEN p.remaining_balance
            ELSE 0
          END
        ),
        0
      ) AS outstanding_amount,

      COALESCE(
        SUM(
          CASE
            WHEN p.status = 'written_off'
            THEN p.remaining_balance
            ELSE 0
          END
        ),
        0
      ) AS written_off_amount
    `
    : `
      0 AS pledge_count,
      0 AS open_pledge_count,
      0 AS paid_pledge_count,
      0 AS written_off_count,
      0 AS cancelled_count,
      0 AS overdue_count,
      0 AS pledged_amount,
      0 AS paid_amount,
      0 AS outstanding_amount,
      0 AS written_off_amount
    `;

  const paymentSelect = hasPayments
    ? `
      COALESCE(SUM(fp.amount), 0) AS collected_payment_amount,
      COUNT(DISTINCT fp.id) AS payment_count
    `
    : `
      0 AS collected_payment_amount,
      0 AS payment_count
    `;

  return {
    ok: true,
    sql: `
      SELECT
        c.id AS campaign_id,
        ${codeSql} AS campaign_code,
        ${nameSql} AS campaign_name,
        ${goalSql} AS goal_amount,
        ${statusSql} AS status,
        ${startSql} AS start_date,
        ${endSql} AS end_date,

        ${pledgeSelect},

        ${paymentSelect}

      FROM tbl_finance_campaigns c

      ${pledgeJoin}

      ${paymentJoin}
    `,
    campaignCols,
  };
}

/* =========================================================
   GET CAMPAIGN ROLLUPS
========================================================= */

async function getCampaignRollups(filters = {}) {
  const conn = await pool.getConnection();

  try {
    const base = await buildCampaignBaseSql(conn);

    if (!base.ok) {
      return {
        ok: true,
        rows: [],
        summary: emptySummary(),
        pagination: {
          page: 1,
          limit: 25,
          total: 0,
          pages: 1,
        },
      };
    }

    const page = toInt(filters.page, 1);
    const limit = Math.min(
      100,
      toInt(filters.limit || filters.pageSize, 25)
    );
    const offset = (page - 1) * limit;

    const search = clean(filters.search || filters.q);
    const status = clean(filters.status);
    const campaignId = clean(filters.campaign_id);

    const where = [];
    const params = [];

    if (search) {
      const campaignCols = base.campaignCols;

      const searchParts = ["CAST(c.id AS CHAR) LIKE ?"];
      const q = `%${search}%`;

      params.push(q);

      if (campaignCols.has("title")) {
        searchParts.push("c.title LIKE ?");
        params.push(q);
      }

      if (campaignCols.has("name")) {
        searchParts.push("c.name LIKE ?");
        params.push(q);
      }

      if (campaignCols.has("campaign_name")) {
        searchParts.push("c.campaign_name LIKE ?");
        params.push(q);
      }

      if (campaignCols.has("campaign_code")) {
        searchParts.push("c.campaign_code LIKE ?");
        params.push(q);
      }

      if (campaignCols.has("description")) {
        searchParts.push("c.description LIKE ?");
        params.push(q);
      }

      where.push(`(${searchParts.join(" OR ")})`);
    }

    if (status && base.campaignCols.has("status")) {
      where.push("c.status = ?");
      params.push(status);
    }

    if (campaignId) {
      where.push("c.id = ?");
      params.push(campaignId);
    }

    const whereSql = where.length
      ? `WHERE ${where.join(" AND ")}`
      : "";

    const [[countRow]] = await conn.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_finance_campaigns c
      ${whereSql}
      `,
      params
    );

    const [rowsRaw] = await conn.query(
      `
      ${base.sql}

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

    const rows = rowsRaw.map(formatCampaignRollup);

    const summary = summarizeRollups(rows);

    return {
      ok: true,
      rows,
      summary,
      pagination: {
        page,
        limit,
        total: Number(countRow.total || 0),
        pages: Math.max(
          1,
          Math.ceil(Number(countRow.total || 0) / limit)
        ),
      },
    };
  } finally {
    conn.release();
  }
}

/* =========================================================
   GET SINGLE CAMPAIGN ROLLUP
========================================================= */

async function getCampaignRollupById(campaignId) {
  const result = await getCampaignRollups({
    campaign_id: campaignId,
    page: 1,
    limit: 1,
  });

  return result.rows[0] || null;
}

/* =========================================================
   DASHBOARD TOTALS
========================================================= */

async function getCampaignTotals(filters = {}) {
  const result = await getCampaignRollups({
    ...filters,
    page: 1,
    limit: 100,
  });

  return {
    ok: true,
    summary: result.summary,
  };
}

/* =========================================================
   CAMPAIGN PERFORMANCE
========================================================= */

async function getCampaignPerformance(filters = {}) {
  const result = await getCampaignRollups({
    ...filters,
    page: filters.page || 1,
    limit: filters.limit || 50,
  });

  const rows = result.rows.map((row) => ({
    ...row,
    performance_score: calculatePerformanceScore(row),
    risk_level: campaignRiskLevel(row),
  }));

  return {
    ok: true,
    rows,
    summary: result.summary,
    pagination: result.pagination,
  };
}

/* =========================================================
   UPDATE CAMPAIGN STORED ROLLUPS
========================================================= */

async function refreshCampaignRollups(campaignId = null) {
  const conn = await pool.getConnection();

  try {
    const hasCampaigns = await tableExists(conn, "tbl_finance_campaigns");

    if (!hasCampaigns) {
      return {
        ok: true,
        updated: 0,
        skipped: true,
      };
    }

    const cols = await getColumns(conn, "tbl_finance_campaigns");

    const result = await getCampaignRollups({
      campaign_id: campaignId || "",
      page: 1,
      limit: 100,
    });

    let updated = 0;

    for (const row of result.rows) {
      const updates = {};
      const params = [];

      if (cols.has("pledged_amount")) {
        updates.pledged_amount = row.pledged_amount;
      }

      if (cols.has("collected_amount")) {
        updates.collected_amount = row.collected_amount;
      }

      if (cols.has("remaining_amount")) {
        updates.remaining_amount = row.outstanding_amount;
      }

      if (cols.has("donor_count")) {
        updates.donor_count = row.pledge_count;
      }

      if (cols.has("updated_at")) {
        updates.updated_at = new Date();
      }

      const entries = Object.entries(updates);

      if (!entries.length) continue;

      const setSql = entries
        .map(([key]) => `\`${key}\` = ?`)
        .join(", ");

      params.push(...entries.map(([, value]) => value));
      params.push(row.campaign_id);

      await conn.query(
        `
        UPDATE tbl_finance_campaigns
        SET ${setSql}
        WHERE id = ?
        `,
        params
      );

      updated += 1;
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

/* =========================================================
   FORMATTERS
========================================================= */

function formatCampaignRollup(row = {}) {
  const goal = money(row.goal_amount);
  const pledged = money(row.pledged_amount);
  const paid = money(row.paid_amount);
  const collected = money(
    Number(row.collected_payment_amount || 0) || paid
  );
  const outstanding = money(row.outstanding_amount);

  return {
    campaign_id: row.campaign_id,
    campaign_code: row.campaign_code,
    campaign_name: row.campaign_name,
    status: row.status || "active",
    start_date: row.start_date,
    end_date: row.end_date,

    goal_amount: goal,
    pledged_amount: pledged,
    paid_amount: paid,
    collected_amount: collected,
    outstanding_amount: outstanding,
    written_off_amount: money(row.written_off_amount),

    pledge_count: Number(row.pledge_count || 0),
    open_pledge_count: Number(row.open_pledge_count || 0),
    paid_pledge_count: Number(row.paid_pledge_count || 0),
    overdue_count: Number(row.overdue_count || 0),
    written_off_count: Number(row.written_off_count || 0),
    cancelled_count: Number(row.cancelled_count || 0),
    payment_count: Number(row.payment_count || 0),

    goal_progress_percent: pct(collected, goal),
    pledge_goal_percent: pct(pledged, goal),
    collection_rate_percent: pct(collected, pledged),
    outstanding_rate_percent: pct(outstanding, pledged),
  };
}

function summarizeRollups(rows = []) {
  const summary = rows.reduce(
    (acc, row) => {
      acc.goal_amount += money(row.goal_amount);
      acc.pledged_amount += money(row.pledged_amount);
      acc.paid_amount += money(row.paid_amount);
      acc.collected_amount += money(row.collected_amount);
      acc.outstanding_amount += money(row.outstanding_amount);
      acc.written_off_amount += money(row.written_off_amount);

      acc.pledge_count += Number(row.pledge_count || 0);
      acc.open_pledge_count += Number(row.open_pledge_count || 0);
      acc.paid_pledge_count += Number(row.paid_pledge_count || 0);
      acc.overdue_count += Number(row.overdue_count || 0);
      acc.written_off_count += Number(row.written_off_count || 0);
      acc.cancelled_count += Number(row.cancelled_count || 0);
      acc.payment_count += Number(row.payment_count || 0);

      return acc;
    },
    emptySummary()
  );

  summary.goal_progress_percent = pct(
    summary.collected_amount,
    summary.goal_amount
  );

  summary.pledge_goal_percent = pct(
    summary.pledged_amount,
    summary.goal_amount
  );

  summary.collection_rate_percent = pct(
    summary.collected_amount,
    summary.pledged_amount
  );

  summary.outstanding_rate_percent = pct(
    summary.outstanding_amount,
    summary.pledged_amount
  );

  return summary;
}

function emptySummary() {
  return {
    goal_amount: 0,
    pledged_amount: 0,
    paid_amount: 0,
    collected_amount: 0,
    outstanding_amount: 0,
    written_off_amount: 0,

    pledge_count: 0,
    open_pledge_count: 0,
    paid_pledge_count: 0,
    overdue_count: 0,
    written_off_count: 0,
    cancelled_count: 0,
    payment_count: 0,

    goal_progress_percent: 0,
    pledge_goal_percent: 0,
    collection_rate_percent: 0,
    outstanding_rate_percent: 0,
  };
}

function calculatePerformanceScore(row = {}) {
  const collectionScore = Number(row.collection_rate_percent || 0);
  const goalScore = Number(row.goal_progress_percent || 0);
  const overduePenalty = Math.min(
    30,
    Number(row.overdue_count || 0) * 3
  );

  return Math.max(
    0,
    Math.min(
      100,
      Number(
        (
          collectionScore * 0.45 +
          goalScore * 0.45 -
          overduePenalty
        ).toFixed(2)
      )
    )
  );
}

function campaignRiskLevel(row = {}) {
  const overdue = Number(row.overdue_count || 0);
  const outstandingRate = Number(row.outstanding_rate_percent || 0);
  const collectionRate = Number(row.collection_rate_percent || 0);

  if (overdue >= 10 || outstandingRate >= 70) return "high";
  if (overdue >= 3 || outstandingRate >= 40 || collectionRate < 50) {
    return "medium";
  }

  return "low";
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  getCampaignRollups,
  getCampaignRollupById,
  getCampaignTotals,
  getCampaignPerformance,
  refreshCampaignRollups,
};