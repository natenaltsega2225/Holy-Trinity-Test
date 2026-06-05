// backend\services\domains\pledges\pledgeKpiService.js
"use strict";

const pool = require("../../../db");

/* =========================================================
   HELPERS
========================================================= */

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n)
    ? Number(n.toFixed(2))
    : 0;
}

function pct(value, total) {
  const v = Number(value || 0);
  const t = Number(total || 0);

  if (!t) return 0;

  return Number(
    ((v / t) * 100).toFixed(2)
  );
}

function safeNumber(value) {
  return Number(value || 0);
}

/* =========================================================
   EXECUTIVE KPI DASHBOARD
========================================================= */

async function getExecutiveKpis() {
  const [[summary]] = await pool.query(`
    SELECT
      COUNT(*) AS total_pledges,

      COALESCE(SUM(pledged_amount),0) AS pledged_amount,

      COALESCE(SUM(paid_amount),0) AS paid_amount,

      COALESCE(SUM(remaining_balance),0) AS receivable_amount,

      SUM(
        CASE
          WHEN status='paid'
          THEN 1
          ELSE 0
        END
      ) AS paid_pledges,

      SUM(
        CASE
          WHEN status='partial'
          THEN 1
          ELSE 0
        END
      ) AS partial_pledges,

      SUM(
        CASE
          WHEN status='receivable'
          THEN 1
          ELSE 0
        END
      ) AS receivable_pledges,

      SUM(
        CASE
          WHEN status='written_off'
          THEN 1
          ELSE 0
        END
      ) AS writeoff_pledges

    FROM tbl_finance_pledges
  `);

  const pledged =
    money(summary.pledged_amount);

  const paid =
    money(summary.paid_amount);

  const receivable =
    money(summary.receivable_amount);

  return {
    total_pledges:
      safeNumber(summary.total_pledges),

    pledged_amount:
      pledged,

    paid_amount:
      paid,

    receivable_amount:
      receivable,

    collection_rate:
      pct(
        paid,
        pledged
      ),

    receivable_rate:
      pct(
        receivable,
        pledged
      ),

    paid_pledges:
      safeNumber(summary.paid_pledges),

    partial_pledges:
      safeNumber(summary.partial_pledges),

    receivable_pledges:
      safeNumber(summary.receivable_pledges),

    writeoff_pledges:
      safeNumber(summary.writeoff_pledges),
  };
}

/* =========================================================
   COLLECTION KPI
========================================================= */

async function getCollectionKpis() {

  const [[row]] =
    await pool.query(`
      SELECT

        COALESCE(
          SUM(pledged_amount),
          0
        ) pledged,

        COALESCE(
          SUM(paid_amount),
          0
        ) paid,

        COALESCE(
          SUM(remaining_balance),
          0
        ) receivable

      FROM tbl_finance_pledges
    `);

  const pledged =
    money(row.pledged);

  const paid =
    money(row.paid);

  const receivable =
    money(row.receivable);

  return {
    pledged,
    paid,
    receivable,

    collection_rate:
      pct(
        paid,
        pledged
      ),

    receivable_rate:
      pct(
        receivable,
        pledged
      ),
  };
}

/* =========================================================
   CAMPAIGN KPI
========================================================= */

async function getCampaignKpis() {

  const [rows] =
    await pool.query(`
      SELECT

        campaign_id,

        campaign_name,

        COUNT(*) total_pledges,

        SUM(pledged_amount)
          pledged_amount,

        SUM(paid_amount)
          paid_amount,

        SUM(remaining_balance)
          receivable_amount

      FROM tbl_finance_pledges

      GROUP BY
        campaign_id,
        campaign_name

      ORDER BY
        pledged_amount DESC
    `);

  return rows.map(
    (row) => {

      const pledged =
        money(
          row.pledged_amount
        );

      const paid =
        money(
          row.paid_amount
        );

      return {

        campaign_id:
          row.campaign_id,

        campaign_name:
          row.campaign_name,

        total_pledges:
          safeNumber(
            row.total_pledges
          ),

        pledged_amount:
          pledged,

        paid_amount:
          paid,

        receivable_amount:
          money(
            row.receivable_amount
          ),

        collection_rate:
          pct(
            paid,
            pledged
          ),
      };
    }
  );
}

/* =========================================================
   AGING KPI
========================================================= */

async function getAgingKpis() {

  const [[row]] =
    await pool.query(`
      SELECT

        SUM(
          CASE
            WHEN due_date < CURDATE()
            THEN 1
            ELSE 0
          END
        ) overdue_count,

        SUM(
          CASE
            WHEN due_date < CURDATE()
            THEN remaining_balance
            ELSE 0
          END
        ) overdue_amount

      FROM tbl_finance_pledges

      WHERE status IN (
        'receivable',
        'partial',
        'invoiced'
      )
    `);

  return {
    overdue_count:
      safeNumber(
        row.overdue_count
      ),

    overdue_amount:
      money(
        row.overdue_amount
      ),
  };
}

/* =========================================================
   WRITE OFF KPI
========================================================= */

async function getWriteoffKpis() {

  const [[row]] =
    await pool.query(`
      SELECT

        COUNT(*) total_writeoffs,

        COALESCE(
          SUM(pledged_amount),
          0
        ) writeoff_amount

      FROM tbl_finance_pledges

      WHERE status='written_off'
    `);

  return {
    total_writeoffs:
      safeNumber(
        row.total_writeoffs
      ),

    writeoff_amount:
      money(
        row.writeoff_amount
      ),
  };
}

/* =========================================================
   REMINDER KPI
========================================================= */

async function getReminderKpis() {

  try {

    const [[row]] =
      await pool.query(`
        SELECT

          COUNT(*) total,

          SUM(
            CASE
              WHEN status='sent'
              THEN 1
              ELSE 0
            END
          ) sent,

          SUM(
            CASE
              WHEN status='failed'
              THEN 1
              ELSE 0
            END
          ) failed

        FROM tbl_finance_pledge_reminders
      `);

    return {
      total:
        safeNumber(
          row.total
        ),

      sent:
        safeNumber(
          row.sent
        ),

      failed:
        safeNumber(
          row.failed
        ),
    };

  } catch {

    return {
      total: 0,
      sent: 0,
      failed: 0,
    };
  }
}

/* =========================================================
   DONOR CONVERSION KPI
========================================================= */

async function getDonorConversionKpis() {

  const [[row]] =
    await pool.query(`
      SELECT

        COUNT(*) total_pledges,

        SUM(
          CASE
            WHEN paid_amount > 0
            THEN 1
            ELSE 0
          END
        ) converted

      FROM tbl_finance_pledges
    `);

  return {
    total_pledges:
      safeNumber(
        row.total_pledges
      ),

    converted:
      safeNumber(
        row.converted
      ),

    conversion_rate:
      pct(
        row.converted,
        row.total_pledges
      ),
  };
}

/* =========================================================
   FORECAST KPI
========================================================= */

async function getForecastKpis() {

  const [[row]] =
    await pool.query(`
      SELECT

        COALESCE(
          SUM(
            remaining_balance
          ),
          0
        ) future_receivable

      FROM tbl_finance_pledges

      WHERE status IN (
        'receivable',
        'partial',
        'invoiced'
      )
    `);

  return {
    projected_collection:
      money(
        row.future_receivable
      ),
  };
}

/* =========================================================
   MONTHLY TREND
========================================================= */

async function getMonthlyTrend() {

  const [rows] =
    await pool.query(`
      SELECT

        DATE_FORMAT(
          created_at,
          '%Y-%m'
        ) month,

        COUNT(*) pledges,

        SUM(
          pledged_amount
        ) pledged,

        SUM(
          paid_amount
        ) paid

      FROM tbl_finance_pledges

      GROUP BY
        DATE_FORMAT(
          created_at,
          '%Y-%m'
        )

      ORDER BY
        month DESC

      LIMIT 12
    `);

  return rows;
}

/* =========================================================
   COMPLETE KPI DASHBOARD
========================================================= */

async function getPledgeDashboardKpis() {

  const [
    executive,
    collection,
    campaigns,
    aging,
    writeoff,
    reminders,
    conversion,
    forecast,
    monthlyTrend,
  ] = await Promise.all([
    getExecutiveKpis(),
    getCollectionKpis(),
    getCampaignKpis(),
    getAgingKpis(),
    getWriteoffKpis(),
    getReminderKpis(),
    getDonorConversionKpis(),
    getForecastKpis(),
    getMonthlyTrend(),
  ]);

  return {
    executive,
    collection,
    campaigns,
    aging,
    writeoff,
    reminders,
    conversion,
    forecast,
    monthlyTrend,
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  getExecutiveKpis,
  getCollectionKpis,
  getCampaignKpis,
  getAgingKpis,
  getWriteoffKpis,
  getReminderKpis,
  getDonorConversionKpis,
  getForecastKpis,
  getMonthlyTrend,
  getPledgeDashboardKpis,
};