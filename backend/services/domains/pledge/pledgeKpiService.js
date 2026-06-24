// backend\services\domains\pledges\pledgeKpiService.js
"use strict";

const pool = require("../../../db");

const PLEDGES_TABLE = "tbl_finance_pledges";
const CAMPAIGNS_TABLE = "tbl_finance_campaigns";
const PAYMENTS_TABLE = "tbl_finance_payments";

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

function sqlDate(value) {
  const s = clean(value, 20);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
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

function buildFilters(cols, filters = {}, alias = "p") {
  const where = [];
  const params = [];

  if (filters.campaign_id && cols.has("campaign_id")) {
    where.push(`${alias}.campaign_id = ?`);
    params.push(filters.campaign_id);
  }

  if (filters.member_id && cols.has("member_id")) {
    where.push(`${alias}.member_id = ?`);
    params.push(filters.member_id);
  }

  if (filters.status && cols.has("status")) {
    where.push(`LOWER(${alias}.status) = ?`);
    params.push(clean(filters.status, 40).toLowerCase());
  }

  const from = sqlDate(filters.date_from || filters.from);
  const to = sqlDate(filters.date_to || filters.to);
  const dateCol = cols.has("created_at")
    ? "created_at"
    : cols.has("pledge_date")
    ? "pledge_date"
    : cols.has("due_date")
    ? "due_date"
    : null;

  if (from && dateCol) {
    where.push(`DATE(${alias}.\`${dateCol}\`) >= DATE(?)`);
    params.push(from);
  }

  if (to && dateCol) {
    where.push(`DATE(${alias}.\`${dateCol}\`) <= DATE(?)`);
    params.push(to);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

async function getPledgeKpis(filters = {}) {
  const conn = await pool.getConnection();

  try {
    if (!(await tableExists(conn, PLEDGES_TABLE))) {
      return {
        ok: true,
        kpis: emptyKpis(),
      };
    }

    const cols = await getColumns(conn, PLEDGES_TABLE);

    const pledgedExpr = firstColumn(cols, "p", [
      "pledged_amount",
      "amount",
      "total_amount",
    ], "0");

    const paidExpr = firstColumn(cols, "p", [
      "paid_amount",
      "amount_paid",
      "collected_amount",
    ], "0");

    const balanceExpr = firstColumn(cols, "p", [
      "remaining_balance",
      "balance_due",
      "outstanding_amount",
    ], `GREATEST(COALESCE(${pledgedExpr}, 0) - COALESCE(${paidExpr}, 0), 0)`);

    const dueExpr = firstColumn(cols, "p", [
      "due_date",
      "next_due_at",
      "pledge_due_date",
      "scheduled_date",
    ]);

    const statusExpr = firstColumn(cols, "p", ["status"], "'receivable'");

    const filtersSql = buildFilters(cols, filters);
    const activeStatusCondition = cols.has("status")
      ? "LOWER(COALESCE(p.status, 'receivable')) <> 'cancelled'"
      : "1 = 1";

    const [[row]] = await conn.query(
      `
      SELECT
        COUNT(*) AS total_pledges,

        COUNT(
          CASE
            WHEN LOWER(${statusExpr}) IN ('receivable', 'partial', 'invoiced', 'open', 'pending')
            THEN 1
            ELSE NULL
          END
        ) AS open_pledges,

        COUNT(
          CASE
            WHEN LOWER(${statusExpr}) = 'overdue'
              OR (${dueExpr} IS NOT NULL AND DATE(${dueExpr}) < CURDATE() AND COALESCE(${balanceExpr}, 0) > 0)
            THEN 1
            ELSE NULL
          END
        ) AS overdue_pledges,

        COUNT(
          CASE
            WHEN LOWER(${statusExpr}) IN ('paid', 'completed', 'fulfilled')
            THEN 1
            ELSE NULL
          END
        ) AS paid_pledges,

        COUNT(
          CASE
            WHEN LOWER(${statusExpr}) IN ('cancelled', 'canceled')
            THEN 1
            ELSE NULL
          END
        ) AS cancelled_pledges,

        COALESCE(SUM(CASE WHEN ${activeStatusCondition} THEN COALESCE(${pledgedExpr}, 0) ELSE 0 END), 0)
          AS pledged_amount,

        COALESCE(SUM(CASE WHEN ${activeStatusCondition} THEN COALESCE(${paidExpr}, 0) ELSE 0 END), 0)
          AS paid_amount,

        COALESCE(SUM(CASE WHEN ${activeStatusCondition} THEN COALESCE(${balanceExpr}, 0) ELSE 0 END), 0)
          AS outstanding_amount,

        COALESCE(AVG(CASE WHEN ${activeStatusCondition} THEN COALESCE(${pledgedExpr}, 0) ELSE NULL END), 0)
          AS average_pledge_amount

      FROM ${PLEDGES_TABLE} p

      ${filtersSql.whereSql}
      `,
      filtersSql.params
    );

    const kpis = formatKpis(row);

    return {
      ok: true,
      kpis,
    };
  } finally {
    conn.release();
  }
}

function formatKpis(row = {}) {
  const pledged = money(row.pledged_amount);
  const paid = money(row.paid_amount);
  const outstanding = money(row.outstanding_amount);
  const total = Number(row.total_pledges || 0);

  return {
    total_pledges: total,
    open_pledges: Number(row.open_pledges || 0),
    overdue_pledges: Number(row.overdue_pledges || 0),
    paid_pledges: Number(row.paid_pledges || 0),
    cancelled_pledges: Number(row.cancelled_pledges || 0),

    pledged_amount: pledged,
    paid_amount: paid,
    outstanding_amount: outstanding,
    average_pledge_amount: money(row.average_pledge_amount),

    collection_rate_percent: pct(paid, pledged),
    outstanding_rate_percent: pct(outstanding, pledged),
    paid_pledge_rate_percent: pct(row.paid_pledges, total),
    overdue_pledge_rate_percent: pct(row.overdue_pledges, total),
  };
}

function emptyKpis() {
  return {
    total_pledges: 0,
    open_pledges: 0,
    overdue_pledges: 0,
    paid_pledges: 0,
    cancelled_pledges: 0,
    pledged_amount: 0,
    paid_amount: 0,
    outstanding_amount: 0,
    average_pledge_amount: 0,
    collection_rate_percent: 0,
    outstanding_rate_percent: 0,
    paid_pledge_rate_percent: 0,
    overdue_pledge_rate_percent: 0,
  };
}

async function getCampaignPledgeKpis(filters = {}) {
  const conn = await pool.getConnection();

  try {
    if (!(await tableExists(conn, PLEDGES_TABLE))) {
      return {
        ok: true,
        rows: [],
        pagination: {
          page: 1,
          limit: 25,
          total: 0,
          pages: 1,
        },
      };
    }

    const pledgeCols = await getColumns(conn, PLEDGES_TABLE);
    const hasCampaigns = await tableExists(conn, CAMPAIGNS_TABLE);
    const campaignCols = hasCampaigns
      ? await getColumns(conn, CAMPAIGNS_TABLE)
      : new Set();

    const pledgedExpr = firstColumn(pledgeCols, "p", [
      "pledged_amount",
      "amount",
      "total_amount",
    ], "0");

    const paidExpr = firstColumn(pledgeCols, "p", [
      "paid_amount",
      "amount_paid",
      "collected_amount",
    ], "0");

    const balanceExpr = firstColumn(pledgeCols, "p", [
      "remaining_balance",
      "balance_due",
      "outstanding_amount",
    ], `GREATEST(COALESCE(${pledgedExpr}, 0) - COALESCE(${paidExpr}, 0), 0)`);

    const campaignNameExpr =
      hasCampaigns && campaignCols.has("campaign_name")
        ? "c.campaign_name"
        : hasCampaigns && campaignCols.has("title")
        ? "c.title"
        : hasCampaigns && campaignCols.has("name")
        ? "c.name"
        : "CONCAT('Campaign #', p.campaign_id)";

    const join =
      hasCampaigns && pledgeCols.has("campaign_id")
        ? "LEFT JOIN tbl_finance_campaigns c ON c.id = p.campaign_id"
        : "";

    const groupExpr = pledgeCols.has("campaign_id") ? "p.campaign_id" : "NULL";
    const page = toInt(filters.page, 1);
    const limit = Math.min(100, toInt(filters.limit || filters.pageSize, 25));
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];

    if (filters.search && hasCampaigns) {
      const q = `%${clean(filters.search, 100)}%`;
      const parts = [];

      for (const col of ["campaign_name", "title", "name", "campaign_code", "code"]) {
        if (campaignCols.has(col)) {
          parts.push(`c.\`${col}\` LIKE ?`);
          params.push(q);
        }
      }

      if (parts.length) where.push(`(${parts.join(" OR ")})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [[countRow]] = await conn.query(
      `
      SELECT COUNT(*) AS total
      FROM (
        SELECT ${groupExpr} AS campaign_id
        FROM ${PLEDGES_TABLE} p
        ${join}
        ${whereSql}
        GROUP BY ${groupExpr}
      ) x
      `,
      params
    );

    const [rowsRaw] = await conn.query(
      `
      SELECT
        ${groupExpr} AS campaign_id,
        ${campaignNameExpr} AS campaign_name,
        COUNT(*) AS pledge_count,
        COALESCE(SUM(${pledgedExpr}), 0) AS pledged_amount,
        COALESCE(SUM(${paidExpr}), 0) AS paid_amount,
        COALESCE(SUM(${balanceExpr}), 0) AS outstanding_amount

      FROM ${PLEDGES_TABLE} p

      ${join}

      ${whereSql}

      GROUP BY ${groupExpr}

      ORDER BY pledged_amount DESC, campaign_name ASC

      LIMIT ?
      OFFSET ?
      `,
      [...params, limit, offset]
    );

    const rows = rowsRaw.map((row) => {
      const pledged = money(row.pledged_amount);
      const paid = money(row.paid_amount);
      const outstanding = money(row.outstanding_amount);

      return {
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name || "Unassigned Campaign",
        pledge_count: Number(row.pledge_count || 0),
        pledged_amount: pledged,
        paid_amount: paid,
        outstanding_amount: outstanding,
        collection_rate_percent: pct(paid, pledged),
        outstanding_rate_percent: pct(outstanding, pledged),
      };
    });

    const total = Number(countRow.total || 0);

    return {
      ok: true,
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

async function getMemberPledgeKpis(filters = {}) {
  const conn = await pool.getConnection();

  try {
    if (!(await tableExists(conn, PLEDGES_TABLE))) {
      return {
        ok: true,
        rows: [],
      };
    }

    const pledgeCols = await getColumns(conn, PLEDGES_TABLE);
    const hasMembers = await tableExists(conn, "tbl_members");
    const memberCols = hasMembers ? await getColumns(conn, "tbl_members") : new Set();

    const pledgedExpr = firstColumn(pledgeCols, "p", [
      "pledged_amount",
      "amount",
      "total_amount",
    ], "0");

    const paidExpr = firstColumn(pledgeCols, "p", [
      "paid_amount",
      "amount_paid",
      "collected_amount",
    ], "0");

    const balanceExpr = firstColumn(pledgeCols, "p", [
      "remaining_balance",
      "balance_due",
      "outstanding_amount",
    ], `GREATEST(COALESCE(${pledgedExpr}, 0) - COALESCE(${paidExpr}, 0), 0)`);

    const memberJoin =
      hasMembers && pledgeCols.has("member_id")
        ? "LEFT JOIN tbl_members m ON m.id = p.member_id"
        : "";

    const memberNameExpr =
      hasMembers && memberCols.has("full_name")
        ? "m.full_name"
        : "CONCAT('Member #', p.member_id)";

    const limit = Math.min(100, toInt(filters.limit, 25));

    const [rowsRaw] = await conn.query(
      `
      SELECT
        ${firstColumn(pledgeCols, "p", ["member_id"], "NULL")} AS member_id,
        ${memberNameExpr} AS full_name,
        COUNT(*) AS pledge_count,
        COALESCE(SUM(${pledgedExpr}), 0) AS pledged_amount,
        COALESCE(SUM(${paidExpr}), 0) AS paid_amount,
        COALESCE(SUM(${balanceExpr}), 0) AS outstanding_amount

      FROM ${PLEDGES_TABLE} p

      ${memberJoin}

      GROUP BY member_id

      ORDER BY outstanding_amount DESC, pledged_amount DESC

      LIMIT ?
      `,
      [limit]
    );

    return {
      ok: true,
      rows: rowsRaw.map((row) => ({
        member_id: row.member_id,
        full_name: row.full_name || "Unassigned Member",
        pledge_count: Number(row.pledge_count || 0),
        pledged_amount: money(row.pledged_amount),
        paid_amount: money(row.paid_amount),
        outstanding_amount: money(row.outstanding_amount),
        collection_rate_percent: pct(row.paid_amount, row.pledged_amount),
      })),
    };
  } finally {
    conn.release();
  }
}

async function getPledgeDashboardKpis(filters = {}) {
  const [summary, campaigns, members] = await Promise.all([
    getPledgeKpis(filters),
    getCampaignPledgeKpis({ ...filters, page: 1, limit: 10 }),
    getMemberPledgeKpis({ ...filters, limit: 10 }),
  ]);

  return {
    ok: true,
    kpis: summary.kpis,
    top_campaigns: campaigns.rows,
    top_members: members.rows,
  };
}

module.exports = {
  getPledgeKpis,
  getPledgeDashboardKpis,
  getCampaignPledgeKpis,
  getMemberPledgeKpis,
};