// backend\services\domains\pledges\pledgeAgingService.js
// backend/services/domains/pledge/pledgeAgingService.js

"use strict";

const pool = require("../../../db");

/* =========================================================
   HELPERS
========================================================= */

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function clean(value) {
  return String(value ?? "").trim();
}

function toInt(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function agingBucketSql() {
  return `
    CASE
      WHEN p.status IN ('paid', 'written_off', 'cancelled') THEN 'closed'
      WHEN p.due_date IS NULL THEN 'no_due_date'
      WHEN DATEDIFF(CURDATE(), DATE(p.due_date)) <= 0 THEN 'current'
      WHEN DATEDIFF(CURDATE(), DATE(p.due_date)) <= 30 THEN '1_30'
      WHEN DATEDIFF(CURDATE(), DATE(p.due_date)) <= 60 THEN '31_60'
      WHEN DATEDIFF(CURDATE(), DATE(p.due_date)) <= 90 THEN '61_90'
      ELSE '90_plus'
    END
  `;
}

function agingDaysSql() {
  return `
    CASE
      WHEN p.due_date IS NULL THEN 0
      ELSE GREATEST(DATEDIFF(CURDATE(), DATE(p.due_date)), 0)
    END
  `;
}

function riskLevel(row = {}) {
  const days = Number(row.days_overdue || 0);
  const balance = Number(row.remaining_balance || 0);

  if (days >= 90 || balance >= 5000) return "high";
  if (days >= 31 || balance >= 1000) return "medium";
  return "low";
}

/* =========================================================
   AGING LIST
========================================================= */

async function getAgingRows(filters = {}) {
  const page = toInt(filters.page, 1);
  const limit = Math.min(100, toInt(filters.limit || filters.pageSize, 25));
  const offset = (page - 1) * limit;

  const search = clean(filters.search || filters.q);
  const bucket = clean(filters.bucket || filters.aging_bucket);
  const campaignId = clean(filters.campaign_id);
  const status = clean(filters.status);
  const memberId = clean(filters.member_id);

  const where = [
    "p.remaining_balance > 0",
    "p.status IN ('receivable', 'partial', 'invoiced')",
  ];

  const params = [];

  if (search) {
    where.push(`
      (
        p.pledge_number LIKE ?
        OR p.full_name_snapshot LIKE ?
        OR p.email_snapshot LIKE ?
        OR p.phone_snapshot LIKE ?
        OR p.member_no LIKE ?
        OR p.campaign_name LIKE ?
      )
    `);

    const q = `%${search}%`;
    params.push(q, q, q, q, q, q);
  }

  if (campaignId) {
    where.push("p.campaign_id = ?");
    params.push(campaignId);
  }

  if (status) {
    where.push("p.status = ?");
    params.push(status);
  }

  if (memberId) {
    where.push("p.member_id = ?");
    params.push(memberId);
  }

  if (bucket) {
    where.push(`${agingBucketSql()} = ?`);
    params.push(bucket);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const [[countRow]] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM tbl_finance_pledges p
    ${whereSql}
    `,
    params
  );

  const [rowsRaw] = await pool.query(
    `
    SELECT
      p.*,

      p.full_name_snapshot AS full_name,
      p.email_snapshot AS email,
      p.phone_snapshot AS phone,

      ${agingDaysSql()} AS days_overdue,
      ${agingBucketSql()} AS aging_bucket,

      CASE
        WHEN p.due_date IS NOT NULL
          AND DATE(p.due_date) < CURDATE()
        THEN 'overdue'
        ELSE 'current'
      END AS aging_status

    FROM tbl_finance_pledges p

    ${whereSql}

    ORDER BY
      days_overdue DESC,
      p.remaining_balance DESC,
      p.due_date ASC,
      p.id DESC

    LIMIT ?
    OFFSET ?
    `,
    [...params, limit, offset]
  );

  const rows = rowsRaw.map((row) => ({
    ...row,
    pledged_amount: money(row.pledged_amount),
    paid_amount: money(row.paid_amount),
    remaining_balance: money(row.remaining_balance),
    days_overdue: Number(row.days_overdue || 0),
    risk_level: riskLevel(row),
  }));

  return {
    ok: true,
    rows,
    pagination: {
      page,
      limit,
      total: Number(countRow.total || 0),
      pages: Math.max(1, Math.ceil(Number(countRow.total || 0) / limit)),
    },
  };
}

/* =========================================================
   AGING SUMMARY
========================================================= */

async function getAgingSummary(filters = {}) {
  const campaignId = clean(filters.campaign_id);
  const status = clean(filters.status);

  const where = [
    "p.remaining_balance > 0",
    "p.status IN ('receivable', 'partial', 'invoiced')",
  ];

  const params = [];

  if (campaignId) {
    where.push("p.campaign_id = ?");
    params.push(campaignId);
  }

  if (status) {
    where.push("p.status = ?");
    params.push(status);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const [[summary]] = await pool.query(
    `
    SELECT
      COUNT(*) AS total_open_pledges,

      COALESCE(SUM(p.pledged_amount), 0) AS total_pledged,
      COALESCE(SUM(p.paid_amount), 0) AS total_paid,
      COALESCE(SUM(p.remaining_balance), 0) AS total_outstanding,

      SUM(CASE WHEN ${agingBucketSql()} = 'current' THEN 1 ELSE 0 END) AS current_count,
      SUM(CASE WHEN ${agingBucketSql()} = '1_30' THEN 1 ELSE 0 END) AS bucket_1_30_count,
      SUM(CASE WHEN ${agingBucketSql()} = '31_60' THEN 1 ELSE 0 END) AS bucket_31_60_count,
      SUM(CASE WHEN ${agingBucketSql()} = '61_90' THEN 1 ELSE 0 END) AS bucket_61_90_count,
      SUM(CASE WHEN ${agingBucketSql()} = '90_plus' THEN 1 ELSE 0 END) AS bucket_90_plus_count,
      SUM(CASE WHEN ${agingBucketSql()} = 'no_due_date' THEN 1 ELSE 0 END) AS no_due_date_count,

      COALESCE(SUM(CASE WHEN ${agingBucketSql()} = 'current' THEN p.remaining_balance ELSE 0 END), 0) AS current_amount,
      COALESCE(SUM(CASE WHEN ${agingBucketSql()} = '1_30' THEN p.remaining_balance ELSE 0 END), 0) AS bucket_1_30_amount,
      COALESCE(SUM(CASE WHEN ${agingBucketSql()} = '31_60' THEN p.remaining_balance ELSE 0 END), 0) AS bucket_31_60_amount,
      COALESCE(SUM(CASE WHEN ${agingBucketSql()} = '61_90' THEN p.remaining_balance ELSE 0 END), 0) AS bucket_61_90_amount,
      COALESCE(SUM(CASE WHEN ${agingBucketSql()} = '90_plus' THEN p.remaining_balance ELSE 0 END), 0) AS bucket_90_plus_amount,
      COALESCE(SUM(CASE WHEN ${agingBucketSql()} = 'no_due_date' THEN p.remaining_balance ELSE 0 END), 0) AS no_due_date_amount

    FROM tbl_finance_pledges p
    ${whereSql}
    `,
    params
  );

  return {
    ok: true,
    summary: {
      total_open_pledges: Number(summary.total_open_pledges || 0),

      total_pledged: money(summary.total_pledged),
      total_paid: money(summary.total_paid),
      total_outstanding: money(summary.total_outstanding),

      current: {
        count: Number(summary.current_count || 0),
        amount: money(summary.current_amount),
      },

      bucket_1_30: {
        count: Number(summary.bucket_1_30_count || 0),
        amount: money(summary.bucket_1_30_amount),
      },

      bucket_31_60: {
        count: Number(summary.bucket_31_60_count || 0),
        amount: money(summary.bucket_31_60_amount),
      },

      bucket_61_90: {
        count: Number(summary.bucket_61_90_count || 0),
        amount: money(summary.bucket_61_90_amount),
      },

      bucket_90_plus: {
        count: Number(summary.bucket_90_plus_count || 0),
        amount: money(summary.bucket_90_plus_amount),
      },

      no_due_date: {
        count: Number(summary.no_due_date_count || 0),
        amount: money(summary.no_due_date_amount),
      },
    },
  };
}

/* =========================================================
   CAMPAIGN AGING
========================================================= */

async function getCampaignAging(filters = {}) {
  const where = [
    "p.remaining_balance > 0",
    "p.status IN ('receivable', 'partial', 'invoiced')",
  ];

  const params = [];

  if (filters.campaign_id) {
    where.push("p.campaign_id = ?");
    params.push(filters.campaign_id);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const [rows] = await pool.query(
    `
    SELECT
      p.campaign_id,
      COALESCE(p.campaign_name, 'Unassigned Campaign') AS campaign_name,

      COUNT(*) AS open_count,
      COALESCE(SUM(p.remaining_balance), 0) AS outstanding_amount,

      SUM(CASE WHEN ${agingBucketSql()} = 'current' THEN 1 ELSE 0 END) AS current_count,
      SUM(CASE WHEN ${agingBucketSql()} = '1_30' THEN 1 ELSE 0 END) AS bucket_1_30_count,
      SUM(CASE WHEN ${agingBucketSql()} = '31_60' THEN 1 ELSE 0 END) AS bucket_31_60_count,
      SUM(CASE WHEN ${agingBucketSql()} = '61_90' THEN 1 ELSE 0 END) AS bucket_61_90_count,
      SUM(CASE WHEN ${agingBucketSql()} = '90_plus' THEN 1 ELSE 0 END) AS bucket_90_plus_count,

      COALESCE(SUM(CASE WHEN ${agingBucketSql()} = 'current' THEN p.remaining_balance ELSE 0 END), 0) AS current_amount,
      COALESCE(SUM(CASE WHEN ${agingBucketSql()} = '1_30' THEN p.remaining_balance ELSE 0 END), 0) AS bucket_1_30_amount,
      COALESCE(SUM(CASE WHEN ${agingBucketSql()} = '31_60' THEN p.remaining_balance ELSE 0 END), 0) AS bucket_31_60_amount,
      COALESCE(SUM(CASE WHEN ${agingBucketSql()} = '61_90' THEN p.remaining_balance ELSE 0 END), 0) AS bucket_61_90_amount,
      COALESCE(SUM(CASE WHEN ${agingBucketSql()} = '90_plus' THEN p.remaining_balance ELSE 0 END), 0) AS bucket_90_plus_amount

    FROM tbl_finance_pledges p

    ${whereSql}

    GROUP BY
      p.campaign_id,
      p.campaign_name

    ORDER BY outstanding_amount DESC
    `,
    params
  );

  return {
    ok: true,
    rows: rows.map((row) => ({
      ...row,
      open_count: Number(row.open_count || 0),
      outstanding_amount: money(row.outstanding_amount),
      current_amount: money(row.current_amount),
      bucket_1_30_amount: money(row.bucket_1_30_amount),
      bucket_31_60_amount: money(row.bucket_31_60_amount),
      bucket_61_90_amount: money(row.bucket_61_90_amount),
      bucket_90_plus_amount: money(row.bucket_90_plus_amount),
    })),
  };
}

/* =========================================================
   OVERDUE PROCESSOR
========================================================= */

async function markOverduePledges(options = {}) {
  const limit = Math.min(1000, toInt(options.limit, 500));

  const [result] = await pool.query(
    `
    UPDATE tbl_finance_pledges
    SET
      aging_status = 'overdue',
      updated_at = NOW()
    WHERE status IN ('receivable', 'partial', 'invoiced')
      AND remaining_balance > 0
      AND due_date IS NOT NULL
      AND DATE(due_date) < CURDATE()
    LIMIT ?
    `,
    [limit]
  );

  return {
    ok: true,
    updated: result.affectedRows || 0,
  };
}

/* =========================================================
   RISK QUEUE
========================================================= */

async function getHighRiskPledges(options = {}) {
  const result = await getAgingRows({
    ...options,
    bucket: "90_plus",
    limit: options.limit || 50,
  });

  return {
    ok: true,
    rows: result.rows.filter((row) => row.risk_level === "high"),
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  getAgingRows,
  getAgingSummary,
  getCampaignAging,
  markOverduePledges,
  getHighRiskPledges,
};