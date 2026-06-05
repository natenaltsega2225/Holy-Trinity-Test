// backend\services\domains\pledges\campaignDashboardService.js
// backend/services/domains/pledge/campaignDashboardService.js

"use strict";

const pool = require("../../../db");

const {
  getCampaignRollups,
  getCampaignPerformance,
  refreshCampaignRollups,
} = require("./campaignRollupService");

/* =========================================================
   HELPERS
========================================================= */

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

function clean(value) {
  return String(value ?? "").trim();
}

function toInt(value, fallback = 10) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function safeDateField(field) {
  const allowed = new Set([
    "created_at",
    "updated_at",
    "start_date",
    "end_date",
  ]);

  return allowed.has(field) ? field : "created_at";
}

/* =========================================================
   CAMPAIGN DASHBOARD
========================================================= */

async function getCampaignDashboard(filters = {}) {
  const [
    rollups,
    performance,
    summaryCards,
    monthlyTrend,
    topCampaigns,
    atRiskCampaigns,
    recentActivity,
  ] = await Promise.all([
    getCampaignRollups({
      ...filters,
      page: filters.page || 1,
      limit: filters.limit || 25,
    }),

    getCampaignPerformance({
      ...filters,
      page: 1,
      limit: 50,
    }),

    getCampaignSummaryCards(filters),

    getCampaignMonthlyTrend(filters),

    getTopCampaigns(filters),

    getAtRiskCampaigns(filters),

    getCampaignRecentActivity(filters),
  ]);

  return {
    ok: true,

    summary:
      summaryCards,

    rollups:
      rollups.rows || [],

    performance:
      performance.rows || [],

    monthlyTrend,

    topCampaigns,

    atRiskCampaigns,

    recentActivity,

    pagination:
      rollups.pagination || {
        page: 1,
        limit: 25,
        total: 0,
        pages: 1,
      },
  };
}

/* =========================================================
   SUMMARY CARDS
========================================================= */

async function getCampaignSummaryCards(filters = {}) {
  const rollups = await getCampaignRollups({
    ...filters,
    page: 1,
    limit: 100,
  });

  const summary = rollups.summary || {};

  return {
    campaign_count:
      Number((rollups.rows || []).length),

    goal_amount:
      money(summary.goal_amount),

    pledged_amount:
      money(summary.pledged_amount),

    collected_amount:
      money(summary.collected_amount),

    outstanding_amount:
      money(summary.outstanding_amount),

    written_off_amount:
      money(summary.written_off_amount),

    pledge_count:
      Number(summary.pledge_count || 0),

    open_pledge_count:
      Number(summary.open_pledge_count || 0),

    paid_pledge_count:
      Number(summary.paid_pledge_count || 0),

    overdue_count:
      Number(summary.overdue_count || 0),

    written_off_count:
      Number(summary.written_off_count || 0),

    cancelled_count:
      Number(summary.cancelled_count || 0),

    payment_count:
      Number(summary.payment_count || 0),

    goal_progress_percent:
      pct(summary.collected_amount, summary.goal_amount),

    pledge_goal_percent:
      pct(summary.pledged_amount, summary.goal_amount),

    collection_rate_percent:
      pct(summary.collected_amount, summary.pledged_amount),

    outstanding_rate_percent:
      pct(summary.outstanding_amount, summary.pledged_amount),
  };
}

/* =========================================================
   MONTHLY CAMPAIGN TREND
========================================================= */

async function getCampaignMonthlyTrend(filters = {}) {
  const months = Math.min(36, toInt(filters.months, 12));

  const dateField = safeDateField(
    clean(filters.date_field || "created_at")
  );

  const campaignId = clean(filters.campaign_id);

  const params = [];
  const where = [
    `${dateField} IS NOT NULL`,
    `${dateField} >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)`,
  ];

  params.push(months);

  if (campaignId) {
    where.push("campaign_id = ?");
    params.push(campaignId);
  }

  const [pledgeRows] = await pool.query(
    `
    SELECT
      DATE_FORMAT(${dateField}, '%Y-%m') AS month,

      COUNT(*) AS pledge_count,

      COALESCE(SUM(pledged_amount), 0) AS pledged_amount,
      COALESCE(SUM(paid_amount), 0) AS paid_amount,
      COALESCE(SUM(remaining_balance), 0) AS outstanding_amount,

      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
      SUM(CASE WHEN status IN ('receivable', 'partial', 'invoiced') THEN 1 ELSE 0 END) AS open_count

    FROM tbl_finance_pledges

    WHERE ${where.join(" AND ")}

    GROUP BY DATE_FORMAT(${dateField}, '%Y-%m')

    ORDER BY month ASC
    `,
    params
  );

  const paymentParams = [];
  const paymentWhere = [
    "paid_at IS NOT NULL",
    "paid_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)",
    "category = 'pledge'",
    "(status = 'paid' OR payment_status = 'paid')",
  ];

  paymentParams.push(months);

  if (campaignId) {
    paymentWhere.push("campaign_id = ?");
    paymentParams.push(campaignId);
  }

  const [paymentRows] = await pool
    .query(
      `
      SELECT
        DATE_FORMAT(paid_at, '%Y-%m') AS month,

        COUNT(*) AS payment_count,

        COALESCE(SUM(amount), 0) AS collected_amount

      FROM tbl_finance_payments

      WHERE ${paymentWhere.join(" AND ")}

      GROUP BY DATE_FORMAT(paid_at, '%Y-%m')

      ORDER BY month ASC
      `,
      paymentParams
    )
    .catch(() => [[]]);

  const paymentMap = new Map(
    paymentRows.map((row) => [row.month, row])
  );

  return pledgeRows.map((row) => {
    const payment = paymentMap.get(row.month) || {};

    return {
      month: row.month,

      pledge_count: Number(row.pledge_count || 0),
      payment_count: Number(payment.payment_count || 0),

      pledged_amount: money(row.pledged_amount),
      paid_amount: money(row.paid_amount),
      collected_amount: money(payment.collected_amount),
      outstanding_amount: money(row.outstanding_amount),

      paid_count: Number(row.paid_count || 0),
      open_count: Number(row.open_count || 0),

      collection_rate_percent: pct(
        payment.collected_amount || row.paid_amount,
        row.pledged_amount
      ),
    };
  });
}

/* =========================================================
   TOP CAMPAIGNS
========================================================= */

async function getTopCampaigns(filters = {}) {
  const limit = Math.min(25, toInt(filters.limit, 10));

  const result = await getCampaignRollups({
    ...filters,
    page: 1,
    limit: 100,
  });

  const rows = result.rows || [];

  return {
    by_collected: [...rows]
      .sort(
        (a, b) =>
          Number(b.collected_amount || 0) -
          Number(a.collected_amount || 0)
      )
      .slice(0, limit),

    by_pledged: [...rows]
      .sort(
        (a, b) =>
          Number(b.pledged_amount || 0) -
          Number(a.pledged_amount || 0)
      )
      .slice(0, limit),

    by_goal_progress: [...rows]
      .sort(
        (a, b) =>
          Number(b.goal_progress_percent || 0) -
          Number(a.goal_progress_percent || 0)
      )
      .slice(0, limit),

    by_outstanding: [...rows]
      .sort(
        (a, b) =>
          Number(b.outstanding_amount || 0) -
          Number(a.outstanding_amount || 0)
      )
      .slice(0, limit),
  };
}

/* =========================================================
   AT-RISK CAMPAIGNS
========================================================= */

async function getAtRiskCampaigns(filters = {}) {
  const result = await getCampaignPerformance({
    ...filters,
    page: 1,
    limit: 100,
  });

  return (result.rows || [])
    .filter((row) => {
      const risk = String(row.risk_level || "").toLowerCase();

      return (
        risk === "high" ||
        Number(row.overdue_count || 0) > 0 ||
        Number(row.outstanding_rate_percent || 0) >= 40
      );
    })
    .sort((a, b) => {
      const riskWeight = {
        high: 3,
        medium: 2,
        low: 1,
      };

      return (
        (riskWeight[b.risk_level] || 0) -
          (riskWeight[a.risk_level] || 0) ||
        Number(b.outstanding_amount || 0) -
          Number(a.outstanding_amount || 0)
      );
    })
    .slice(0, Math.min(25, toInt(filters.limit, 10)));
}

/* =========================================================
   RECENT CAMPAIGN ACTIVITY
========================================================= */

async function getCampaignRecentActivity(filters = {}) {
  const limit = Math.min(50, toInt(filters.limit, 15));
  const campaignId = clean(filters.campaign_id);

  const activity = [];

  const pledgeParams = [];
  const pledgeWhere = [];

  if (campaignId) {
    pledgeWhere.push("campaign_id = ?");
    pledgeParams.push(campaignId);
  }

  const pledgeWhereSql = pledgeWhere.length
    ? `WHERE ${pledgeWhere.join(" AND ")}`
    : "";

  const [pledges] = await pool
    .query(
      `
      SELECT
        id,
        pledge_number,
        campaign_id,
        campaign_name,
        full_name_snapshot,
        pledged_amount,
        paid_amount,
        remaining_balance,
        status,
        created_at,
        updated_at
      FROM tbl_finance_pledges

      ${pledgeWhereSql}

      ORDER BY COALESCE(updated_at, created_at) DESC

      LIMIT ?
      `,
      [...pledgeParams, limit]
    )
    .catch(() => [[]]);

  for (const row of pledges) {
    activity.push({
      type: "pledge",
      id: row.id,
      number: row.pledge_number,
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      donor_name: row.full_name_snapshot,
      amount: money(row.pledged_amount),
      status: row.status,
      occurred_at: row.updated_at || row.created_at,
      description: `Pledge ${row.pledge_number || ""} - ${row.status || ""}`,
    });
  }

  const paymentParams = [];
  const paymentWhere = ["category = 'pledge'"];

  if (campaignId) {
    paymentWhere.push("campaign_id = ?");
    paymentParams.push(campaignId);
  }

  const [payments] = await pool
    .query(
      `
      SELECT
        id,
        payment_number,
        campaign_id,
        campaign_name,
        full_name_snapshot,
        amount,
        status,
        paid_at,
        created_at
      FROM tbl_finance_payments

      WHERE ${paymentWhere.join(" AND ")}

      ORDER BY COALESCE(paid_at, created_at) DESC

      LIMIT ?
      `,
      [...paymentParams, limit]
    )
    .catch(() => [[]]);

  for (const row of payments) {
    activity.push({
      type: "payment",
      id: row.id,
      number: row.payment_number,
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      donor_name: row.full_name_snapshot,
      amount: money(row.amount),
      status: row.status,
      occurred_at: row.paid_at || row.created_at,
      description: `Payment ${row.payment_number || ""} received`,
    });
  }

  return activity
    .sort(
      (a, b) =>
        new Date(b.occurred_at || 0) -
        new Date(a.occurred_at || 0)
    )
    .slice(0, limit);
}

/* =========================================================
   SINGLE CAMPAIGN DASHBOARD
========================================================= */

async function getSingleCampaignDashboard(campaignId, filters = {}) {
  const [
    rollups,
    monthlyTrend,
    recentActivity,
    atRiskCampaigns,
  ] = await Promise.all([
    getCampaignRollups({
      ...filters,
      campaign_id: campaignId,
      page: 1,
      limit: 1,
    }),

    getCampaignMonthlyTrend({
      ...filters,
      campaign_id: campaignId,
    }),

    getCampaignRecentActivity({
      ...filters,
      campaign_id: campaignId,
    }),

    getAtRiskCampaigns({
      ...filters,
      campaign_id: campaignId,
    }),
  ]);

  return {
    ok: true,
    campaign: rollups.rows?.[0] || null,
    monthlyTrend,
    recentActivity,
    atRiskCampaigns,
  };
}

/* =========================================================
   CAMPAIGN DONOR LEADERBOARD
========================================================= */

async function getCampaignDonorLeaderboard(filters = {}) {
  const campaignId = clean(filters.campaign_id);
  const limit = Math.min(100, toInt(filters.limit, 25));

  const params = [];
  const where = [];

  if (campaignId) {
    where.push("campaign_id = ?");
    params.push(campaignId);
  }

  const whereSql = where.length
    ? `WHERE ${where.join(" AND ")}`
    : "";

  const [rows] = await pool.query(
    `
    SELECT
      member_id,
      member_no,
      full_name_snapshot AS donor_name,
      email_snapshot AS email,

      COUNT(*) AS pledge_count,

      COALESCE(SUM(pledged_amount), 0) AS pledged_amount,
      COALESCE(SUM(paid_amount), 0) AS paid_amount,
      COALESCE(SUM(remaining_balance), 0) AS outstanding_amount,

      MAX(last_payment_at) AS last_payment_at,
      MAX(created_at) AS last_pledge_at

    FROM tbl_finance_pledges

    ${whereSql}

    GROUP BY
      member_id,
      member_no,
      full_name_snapshot,
      email_snapshot

    ORDER BY pledged_amount DESC

    LIMIT ?
    `,
    [...params, limit]
  );

  return {
    ok: true,
    rows: rows.map((row) => ({
      ...row,
      pledge_count: Number(row.pledge_count || 0),
      pledged_amount: money(row.pledged_amount),
      paid_amount: money(row.paid_amount),
      outstanding_amount: money(row.outstanding_amount),
      collection_rate_percent: pct(row.paid_amount, row.pledged_amount),
    })),
  };
}

/* =========================================================
   CAMPAIGN HEALTH CHECK
========================================================= */

async function getCampaignHealth(filters = {}) {
  const result = await getCampaignPerformance({
    ...filters,
    page: 1,
    limit: 100,
  });

  const rows = result.rows || [];

  const highRisk = rows.filter((r) => r.risk_level === "high").length;
  const mediumRisk = rows.filter((r) => r.risk_level === "medium").length;
  const lowRisk = rows.filter((r) => r.risk_level === "low").length;

  return {
    ok: true,
    summary: {
      campaign_count: rows.length,
      high_risk_count: highRisk,
      medium_risk_count: mediumRisk,
      low_risk_count: lowRisk,
      average_performance_score:
        rows.length > 0
          ? Number(
              (
                rows.reduce(
                  (sum, row) =>
                    sum + Number(row.performance_score || 0),
                  0
                ) / rows.length
              ).toFixed(2)
            )
          : 0,
    },
    rows,
  };
}

/* =========================================================
   REFRESH DASHBOARD CACHE / ROLLUPS
========================================================= */

async function refreshCampaignDashboard(campaignId = null) {
  return refreshCampaignRollups(campaignId);
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  getCampaignDashboard,
  getCampaignSummaryCards,
  getCampaignMonthlyTrend,
  getTopCampaigns,
  getAtRiskCampaigns,
  getCampaignRecentActivity,
  getSingleCampaignDashboard,
  getCampaignDonorLeaderboard,
  getCampaignHealth,
  refreshCampaignDashboard,
};