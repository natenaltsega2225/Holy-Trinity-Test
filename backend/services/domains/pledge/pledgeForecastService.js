// backend/services/domains/pledge/pledgeForecastService.js

"use strict";

const pool = require("../../../db");

class PledgeForecastService {
  money(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
  }

  percent(value, total) {
    const v = Number(value || 0);
    const t = Number(total || 0);

    if (!t) return 0;

    return Number(((v / t) * 100).toFixed(2));
  }

  /* =========================================================
     MONTHLY COLLECTION FORECAST
  ========================================================= */

  async getMonthlyForecast(months = 12) {
    const [history] = await pool.query(
      `
      SELECT
        DATE_FORMAT(paid_at, '%Y-%m') AS period,
        COALESCE(SUM(amount), 0) AS total
      FROM tbl_finance_payments
      WHERE payment_type = 'pledge'
        AND payment_status IN ('paid', 'completed', 'succeeded')
        AND paid_at IS NOT NULL
      GROUP BY DATE_FORMAT(paid_at, '%Y-%m')
      ORDER BY period DESC
      LIMIT 12
      `
    );

    const orderedHistory = [...history].reverse();

    const values = orderedHistory.map((row) =>
      this.money(row.total)
    );

    const average = values.length
      ? this.money(values.reduce((a, b) => a + b, 0) / values.length)
      : 0;

    const first = values[0] || 0;
    const last = values[values.length - 1] || 0;

    const growthRate =
      first > 0
        ? Number((((last - first) / first) * 100).toFixed(2))
        : 0;

    const forecast = [];

    for (let i = 1; i <= Number(months || 12); i += 1) {
      const adjusted =
        average + average * (growthRate / 100) * (i / 12);

      forecast.push({
        month_offset: i,
        projected_amount: this.money(adjusted),
      });
    }

    return {
      historical_months: orderedHistory,
      average_monthly_collection: average,
      growth_rate: growthRate,
      forecast,
    };
  }

  /* =========================================================
     RECURRING PLEDGE FORECAST
  ========================================================= */

  async getRecurringForecast() {
    const [rows] = await pool.query(
      `
      SELECT
        frequency,
        COUNT(*) AS pledge_count,
        COALESCE(SUM(remaining_balance), 0) AS receivable
      FROM tbl_finance_pledges
      WHERE frequency IS NOT NULL
        AND frequency <> ''
        AND frequency <> 'one_time'
        AND status IN ('receivable', 'partial', 'invoiced')
      GROUP BY frequency
      ORDER BY receivable DESC
      `
    );

    return rows.map((row) => ({
      frequency: row.frequency,
      pledge_count: Number(row.pledge_count || 0),
      receivable: this.money(row.receivable),
    }));
  }

  /* =========================================================
     CAMPAIGN COMPLETION FORECAST
  ========================================================= */

  async getCampaignForecast(campaignId) {
    const [[campaign]] = await pool.query(
      `
      SELECT
        p.campaign_id,
        COALESCE(
          c.title,
          c.name,
          p.campaign_name,
          'Campaign'
        ) AS campaign_name,

        COALESCE(c.goal_amount, c.target_amount, 0) AS goal_amount,

        COALESCE(SUM(p.pledged_amount), 0) AS pledged_total,
        COALESCE(SUM(p.paid_amount), 0) AS paid_total,
        COALESCE(SUM(p.remaining_balance), 0) AS receivable_total,

        COUNT(*) AS pledge_count,

        SUM(
          CASE
            WHEN p.status = 'paid'
            THEN 1
            ELSE 0
          END
        ) AS paid_pledges,

        SUM(
          CASE
            WHEN p.status IN ('receivable', 'partial', 'invoiced')
            THEN 1
            ELSE 0
          END
        ) AS open_pledges

      FROM tbl_finance_pledges p

      LEFT JOIN tbl_finance_campaigns c
        ON c.id = p.campaign_id

      WHERE p.campaign_id = ?

      GROUP BY
        p.campaign_id,
        campaign_name,
        goal_amount
      `,
      [campaignId]
    );

    if (!campaign) {
      throw new Error("Campaign not found.");
    }

    const goal = this.money(campaign.goal_amount);
    const pledged = this.money(campaign.pledged_total);
    const paid = this.money(campaign.paid_total);
    const remaining = this.money(campaign.receivable_total);

    const collectionProbability = this.percent(paid, pledged);

    return {
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.campaign_name,

      goal_amount: goal,
      pledged,
      paid,
      remaining,

      pledge_count: Number(campaign.pledge_count || 0),
      paid_pledges: Number(campaign.paid_pledges || 0),
      open_pledges: Number(campaign.open_pledges || 0),

      collection_rate: this.percent(paid, pledged),
      goal_achievement_rate: this.percent(paid, goal),
      pledge_goal_rate: this.percent(pledged, goal),

      projected_final_collection: this.money(
        paid + remaining * (collectionProbability / 100)
      ),

      collection_probability: collectionProbability,
    };
  }

  /* =========================================================
   CASHFLOW FORECAST
========================================================= */

async getCashFlowForecast() {
  const [[row]] = await pool.query(
    `
    SELECT
      COALESCE(SUM(remaining_balance),0) AS total_receivable,

      COALESCE(
        SUM(
          CASE
            WHEN due_date IS NULL
              OR DATEDIFF(due_date,CURDATE()) <= 30
            THEN remaining_balance
            ELSE 0
          END
        ),0
      ) AS expected_30_days,

      COALESCE(
        SUM(
          CASE
            WHEN due_date IS NULL
              OR DATEDIFF(due_date,CURDATE()) <= 60
            THEN remaining_balance
            ELSE 0
          END
        ),0
      ) AS expected_60_days,

      COALESCE(
        SUM(
          CASE
            WHEN due_date IS NULL
              OR DATEDIFF(due_date,CURDATE()) <= 90
            THEN remaining_balance
            ELSE 0
          END
        ),0
      ) AS expected_90_days

    FROM tbl_finance_pledges
    WHERE status IN ('receivable','partial','invoiced')
      AND remaining_balance > 0
    `
  );

  return {
    total_receivable: this.money(row?.total_receivable),

    days_30: this.money(row?.expected_30_days),
    days_60: this.money(row?.expected_60_days),
    days_90: this.money(row?.expected_90_days),
  };
}

/* =========================================================
   DONOR RETENTION FORECAST
========================================================= */

async getDonorRetentionForecast() {
  const [[row]] = await pool.query(
    `
    SELECT

      COUNT(
        DISTINCT COALESCE(
          NULLIF(email_snapshot,''),
          CONCAT('member:',member_id),
          full_name_snapshot
        )
      ) AS donors,

      COUNT(
        DISTINCT CASE
          WHEN paid_amount > 0
          THEN COALESCE(
            NULLIF(email_snapshot,''),
            CONCAT('member:',member_id),
            full_name_snapshot
          )
        END
      ) AS active_donors

    FROM tbl_finance_pledges
    `
  );

  const donors = Number(row?.donors || 0);
  const active = Number(row?.active_donors || 0);

  return {
    total_donors: donors,
    active_donors: active,
    retention_rate: this.percent(active, donors),
  };
}

/* =========================================================
   GOAL ACHIEVEMENT FORECAST
========================================================= */

async getGoalAchievementForecast() {
  const [rows] = await pool.query(
    `
    SELECT
      p.campaign_id,

      COALESCE(
        p.campaign_name,
        'Unassigned'
      ) AS campaign_name,

      COALESCE(SUM(p.pledged_amount),0) AS pledged,
      COALESCE(SUM(p.paid_amount),0) AS paid,
      COALESCE(SUM(p.remaining_balance),0) AS remaining,

      COUNT(*) AS pledge_count

    FROM tbl_finance_pledges p

    GROUP BY
      p.campaign_id,
      p.campaign_name

    ORDER BY paid DESC
    `
  );

  return rows.map((campaign) => {
    const pledged = this.money(campaign.pledged);
    const paid = this.money(campaign.paid);
    const remaining = this.money(campaign.remaining);

    return {
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.campaign_name,

      pledged,
      paid,
      remaining,

      pledge_count: Number(
        campaign.pledge_count || 0
      ),

      collection_rate: this.percent(
        paid,
        pledged
      ),

      projected_final_collection:
        this.money(
          paid + remaining * 0.82
        ),
    };
  });
}

/* =========================================================
   EXECUTIVE FORECAST KPI
========================================================= */

async getExecutiveForecast() {
  const [[totals]] = await pool.query(
    `
    SELECT

      COUNT(*) AS pledge_count,

      COALESCE(
        SUM(pledged_amount),
        0
      ) AS pledged,

      COALESCE(
        SUM(paid_amount),
        0
      ) AS paid,

      COALESCE(
        SUM(remaining_balance),
        0
      ) AS receivable

    FROM tbl_finance_pledges
    `
  );

  const pledged =
    this.money(totals?.pledged);

  const paid =
    this.money(totals?.paid);

  const receivable =
    this.money(totals?.receivable);

  const probability =
    this.percent(
      paid,
      pledged
    );

  return {
    pledge_count:
      Number(
        totals?.pledge_count || 0
      ),

    pledged,
    paid,
    receivable,

    collection_probability:
      probability,

    projected_final_collection:
      this.money(
        paid +
        receivable *
        (probability / 100)
      ),
  };
}

/* =========================================================
   DASHBOARD FORECAST
========================================================= */

async getDashboardForecast() {
  const [
    executive,
    monthly,
    recurring,
    cashflow,
    retention,
    goals,
  ] = await Promise.all([
    this.getExecutiveForecast(),
    this.getMonthlyForecast(),
    this.getRecurringForecast(),
    this.getCashFlowForecast(),
    this.getDonorRetentionForecast(),
    this.getGoalAchievementForecast(),
  ]);

  return {
    generated_at:
      new Date().toISOString(),

    executive,
    monthly,
    recurring,
    cashflow,
    retention,
    goals,
  };
}

async getExecutiveDashboard() {
  return this.getDashboardForecast();
}}
module.exports = new PledgeForecastService();