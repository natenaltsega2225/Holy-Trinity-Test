// backend\services\domains\pledges\pledgeReceivableService.js
// backend/services/domains/pledge/pledgeReceivableService.js

"use strict";

const pool = require("../../../db");

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

function pct(value, total) {
  const v = Number(value || 0);
  const t = Number(total || 0);
  if (!t) return 0;
  return Number(((v / t) * 100).toFixed(2));
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

/* =========================================================
   RECEIVABLE LIST
========================================================= */

async function getReceivables(filters = {}) {
  const page = toInt(filters.page, 1);
  const limit = Math.min(100, toInt(filters.limit || filters.pageSize, 25));
  const offset = (page - 1) * limit;

  const search = clean(filters.search || filters.q);
  const campaignId = clean(filters.campaign_id);
  const memberId = clean(filters.member_id);
  const status = clean(filters.status);
  const agingBucket = clean(filters.aging_bucket || filters.bucket);

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

  if (memberId) {
    where.push("p.member_id = ?");
    params.push(memberId);
  }

  if (status) {
    where.push("p.status = ?");
    params.push(status);
  }

  if (agingBucket) {
    where.push(`${agingBucketSql()} = ?`);
    params.push(agingBucket);
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

  const [rows] = await pool.query(
    `
    SELECT
      p.id,
      p.pledge_number,
      p.campaign_id,
      p.campaign_name,

      p.member_id,
      p.member_no,
      p.full_name_snapshot AS full_name,
      p.email_snapshot AS email,
      p.phone_snapshot AS phone,

      p.pledge_type,
      p.pledge_type_label,

      p.pledged_amount,
      p.paid_amount,
      p.remaining_balance,

      p.status,
      p.due_date,
      p.reminder_date,
      p.last_reminder_sent_at,
      p.last_payment_at,

      ${agingBucketSql()} AS aging_bucket,

      CASE
        WHEN p.due_date IS NULL THEN 0
        ELSE GREATEST(DATEDIFF(CURDATE(), DATE(p.due_date)), 0)
      END AS days_overdue,

      p.created_at,
      p.updated_at

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

  return {
    ok: true,
    rows: rows.map(formatReceivableRow),
    pagination: {
      page,
      limit,
      total: Number(countRow.total || 0),
      pages: Math.max(1, Math.ceil(Number(countRow.total || 0) / limit)),
    },
  };
}

/* =========================================================
   RECEIVABLE DASHBOARD
========================================================= */

async function getReceivableDashboard(filters = {}) {
  const campaignId = clean(filters.campaign_id);

  const where = [
    "p.remaining_balance > 0",
    "p.status IN ('receivable', 'partial', 'invoiced')",
  ];

  const params = [];

  if (campaignId) {
    where.push("p.campaign_id = ?");
    params.push(campaignId);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const [[summary]] = await pool.query(
    `
    SELECT
      COUNT(*) AS receivable_count,

      COALESCE(SUM(p.pledged_amount), 0) AS pledged_amount,
      COALESCE(SUM(p.paid_amount), 0) AS paid_amount,
      COALESCE(SUM(p.remaining_balance), 0) AS receivable_amount,

      SUM(CASE WHEN p.status = 'receivable' THEN 1 ELSE 0 END) AS receivable_status_count,
      SUM(CASE WHEN p.status = 'partial' THEN 1 ELSE 0 END) AS partial_count,
      SUM(CASE WHEN p.status = 'invoiced' THEN 1 ELSE 0 END) AS invoiced_count,

      SUM(
        CASE
          WHEN p.due_date IS NOT NULL
            AND DATE(p.due_date) < CURDATE()
          THEN 1
          ELSE 0
        END
      ) AS overdue_count,

      COALESCE(
        SUM(
          CASE
            WHEN p.due_date IS NOT NULL
              AND DATE(p.due_date) < CURDATE()
            THEN p.remaining_balance
            ELSE 0
          END
        ),
        0
      ) AS overdue_amount,

      COALESCE(
        SUM(
          CASE
            WHEN ${agingBucketSql()} = 'current'
            THEN p.remaining_balance
            ELSE 0
          END
        ),
        0
      ) AS current_amount,

      COALESCE(
        SUM(
          CASE
            WHEN ${agingBucketSql()} = '1_30'
            THEN p.remaining_balance
            ELSE 0
          END
        ),
        0
      ) AS bucket_1_30_amount,

      COALESCE(
        SUM(
          CASE
            WHEN ${agingBucketSql()} = '31_60'
            THEN p.remaining_balance
            ELSE 0
          END
        ),
        0
      ) AS bucket_31_60_amount,

      COALESCE(
        SUM(
          CASE
            WHEN ${agingBucketSql()} = '61_90'
            THEN p.remaining_balance
            ELSE 0
          END
        ),
        0
      ) AS bucket_61_90_amount,

      COALESCE(
        SUM(
          CASE
            WHEN ${agingBucketSql()} = '90_plus'
            THEN p.remaining_balance
            ELSE 0
          END
        ),
        0
      ) AS bucket_90_plus_amount

    FROM tbl_finance_pledges p
    ${whereSql}
    `,
    params
  );

  const [topReceivables] = await pool.query(
    `
    SELECT
      p.id,
      p.pledge_number,
      p.full_name_snapshot AS full_name,
      p.campaign_name,
      p.pledged_amount,
      p.paid_amount,
      p.remaining_balance,
      p.status,
      p.due_date,

      ${agingBucketSql()} AS aging_bucket,

      CASE
        WHEN p.due_date IS NULL THEN 0
        ELSE GREATEST(DATEDIFF(CURDATE(), DATE(p.due_date)), 0)
      END AS days_overdue

    FROM tbl_finance_pledges p

    ${whereSql}

    ORDER BY
      p.remaining_balance DESC,
      days_overdue DESC

    LIMIT 10
    `,
    params
  );

  const receivableAmount = money(summary.receivable_amount);
  const pledgedAmount = money(summary.pledged_amount);
  const paidAmount = money(summary.paid_amount);

  return {
    ok: true,
    summary: {
      receivable_count: Number(summary.receivable_count || 0),

      pledged_amount: pledgedAmount,
      paid_amount: paidAmount,
      receivable_amount: receivableAmount,

      receivable_status_count: Number(summary.receivable_status_count || 0),
      partial_count: Number(summary.partial_count || 0),
      invoiced_count: Number(summary.invoiced_count || 0),

      overdue_count: Number(summary.overdue_count || 0),
      overdue_amount: money(summary.overdue_amount),

      collection_rate_percent: pct(paidAmount, pledgedAmount),
      receivable_rate_percent: pct(receivableAmount, pledgedAmount),

      aging: {
        current_amount: money(summary.current_amount),
        bucket_1_30_amount: money(summary.bucket_1_30_amount),
        bucket_31_60_amount: money(summary.bucket_31_60_amount),
        bucket_61_90_amount: money(summary.bucket_61_90_amount),
        bucket_90_plus_amount: money(summary.bucket_90_plus_amount),
      },
    },

    topReceivables: topReceivables.map(formatReceivableRow),
  };
}

/* =========================================================
   MEMBER RECEIVABLES
========================================================= */

async function getMemberReceivables(memberId, options = {}) {
  return getReceivables({
    ...options,
    member_id: memberId,
  });
}

/* =========================================================
   CAMPAIGN RECEIVABLES
========================================================= */

async function getCampaignReceivables(campaignId, options = {}) {
  return getReceivables({
    ...options,
    campaign_id: campaignId,
  });
}

/* =========================================================
   RECEIVABLE RECONCILIATION
========================================================= */

async function reconcilePledgeReceivables(options = {}) {
  const limit = Math.min(1000, toInt(options.limit, 500));

  const [rows] = await pool.query(
    `
    SELECT
      p.id,
      p.pledged_amount,

      COALESCE(
        (
          SELECT SUM(fp.amount)
          FROM tbl_finance_payments fp
          WHERE fp.pledge_id = p.id
            AND (
              fp.status = 'paid'
              OR fp.payment_status = 'paid'
            )
        ),
        0
      ) AS actual_paid

    FROM tbl_finance_pledges p

    WHERE p.status NOT IN ('written_off', 'cancelled')
    LIMIT ?
    `,
    [limit]
  );

  let updated = 0;

  for (const row of rows) {
    const paid = money(row.actual_paid);
    const pledged = money(row.pledged_amount);
    const remaining = money(pledged - paid);

    const nextStatus =
      remaining <= 0
        ? "paid"
        : paid > 0
        ? "partial"
        : "receivable";

    await pool.query(
      `
      UPDATE tbl_finance_pledges
      SET
        paid_amount = ?,
        remaining_balance = ?,
        status = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        paid,
        remaining,
        nextStatus,
        row.id,
      ]
    );

    updated += 1;
  }

  return {
    ok: true,
    checked: rows.length,
    updated,
  };
}

/* =========================================================
   FORMATTER
========================================================= */

function formatReceivableRow(row = {}) {
  const pledged = money(row.pledged_amount);
  const paid = money(row.paid_amount);
  const balance = money(row.remaining_balance);

  return {
    ...row,

    pledged_amount: pledged,
    paid_amount: paid,
    remaining_balance: balance,

    collection_rate_percent: pct(paid, pledged),
    receivable_rate_percent: pct(balance, pledged),

    days_overdue: Number(row.days_overdue || 0),

    risk_level:
      Number(row.days_overdue || 0) >= 90 || balance >= 5000
        ? "high"
        : Number(row.days_overdue || 0) >= 30 || balance >= 1000
        ? "medium"
        : "low",
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  getReceivables,
  getReceivableDashboard,
  getMemberReceivables,
  getCampaignReceivables,
  reconcilePledgeReceivables,
};