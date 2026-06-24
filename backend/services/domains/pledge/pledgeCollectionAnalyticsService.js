// backend/services/domains/pledge/pledgeCollectionAnalyticsService.js

"use strict";

const pool = require("../../../db");

class PledgeCollectionAnalyticsService {

  /* =========================================================
     COLLECTION EFFECTIVENESS
  ========================================================= */

  async getCollectionEffectiveness() {

    const [[row]] = await pool.query(`
      SELECT
        COUNT(*) AS total_pledges,

        SUM(pledged_amount)
          AS pledged_total,

        SUM(paid_amount)
          AS paid_total,

        SUM(remaining_balance)
          AS receivable_total

      FROM tbl_finance_pledges
    `);

    const pledged =
      Number(row?.pledged_total || 0);

    const paid =
      Number(row?.paid_total || 0);

    return {
      total_pledges:
        Number(row?.total_pledges || 0),

      pledged_total:
        pledged,

      paid_total:
        paid,

      receivable_total:
        Number(row?.receivable_total || 0),

      collection_rate:
        pledged > 0
          ? Number(
              ((paid / pledged) * 100)
                .toFixed(2)
            )
          : 0,
    };
  }

  /* =========================================================
     PROMISE TO PAY CONVERSION
  ========================================================= */

  async getPromiseToPayConversion() {

    const [[row]] = await pool.query(`
      SELECT

        COUNT(*) AS total_promises,

        SUM(
          CASE
            WHEN paid_amount > 0
            THEN 1
            ELSE 0
          END
        ) AS converted

      FROM tbl_finance_pledges

      WHERE pledge_type IN
      (
        'promise_to_pay',
        'partial_upfront',
        'recurring'
      )
    `);

    const total =
      Number(row?.total_promises || 0);

    const converted =
      Number(row?.converted || 0);

    return {

      total_promises: total,

      converted,

      conversion_rate:
        total > 0
          ? Number(
              ((converted / total) * 100)
                .toFixed(2)
            )
          : 0,
    };
  }

  /* =========================================================
     DAYS TO COLLECT
  ========================================================= */

  async getAverageDaysToCollect() {

    const [[row]] = await pool.query(`
      SELECT

        AVG(
          DATEDIFF(
            last_payment_at,
            created_at
          )
        ) AS avg_days

      FROM tbl_finance_pledges

      WHERE paid_amount > 0
        AND last_payment_at IS NOT NULL
    `);

    return {
      average_days:
        Number(
          row?.avg_days || 0
        ).toFixed(2),
    };
  }

  /* =========================================================
     OVERDUE RECOVERY RATE
  ========================================================= */

  async getOverdueRecoveryRate() {

    const [[row]] = await pool.query(`
      SELECT

        COUNT(*) AS overdue_total,

        SUM(
          CASE
            WHEN status='paid'
            THEN 1
            ELSE 0
          END
        ) AS recovered

      FROM tbl_finance_pledges

      WHERE due_date IS NOT NULL
        AND due_date < CURDATE()
    `);

    const total =
      Number(row?.overdue_total || 0);

    const recovered =
      Number(row?.recovered || 0);

    return {

      overdue_total:
        total,

      recovered,

      recovery_rate:
        total > 0
          ? Number(
              ((recovered / total) * 100)
                .toFixed(2)
            )
          : 0,
    };
  }

  /* =========================================================
     REMINDER EFFECTIVENESS
  ========================================================= */

  async getReminderEffectiveness() {

    const [[row]] = await pool.query(`
      SELECT

        COUNT(*) AS reminders_sent,

        SUM(
          CASE
            WHEN paid_amount > 0
            THEN 1
            ELSE 0
          END
        ) AS collected_after_reminder

      FROM tbl_finance_pledges

      WHERE last_reminder_sent_at IS NOT NULL
    `);

    const reminders =
      Number(row?.reminders_sent || 0);

    const converted =
      Number(
        row?.collected_after_reminder || 0
      );

    return {

      reminders_sent:
        reminders,

      collected_after_reminder:
        converted,

      reminder_success_rate:
        reminders > 0
          ? Number(
              ((converted / reminders) * 100)
                .toFixed(2)
            )
          : 0,
    };
  }

  /* =========================================================
     AGING ANALYTICS
  ========================================================= */

  async getAgingAnalytics() {

    const [rows] = await pool.query(`
      SELECT

        CASE

          WHEN due_date IS NULL
            THEN 'NO_DUE_DATE'

          WHEN DATEDIFF(
            CURDATE(),
            due_date
          ) <= 0
            THEN 'CURRENT'

          WHEN DATEDIFF(
            CURDATE(),
            due_date
          ) <= 30
            THEN '1_30'

          WHEN DATEDIFF(
            CURDATE(),
            due_date
          ) <= 60
            THEN '31_60'

          WHEN DATEDIFF(
            CURDATE(),
            due_date
          ) <= 90
            THEN '61_90'

          ELSE '90_PLUS'

        END AS aging_bucket,

        COUNT(*) AS total_pledges,

        SUM(remaining_balance)
          AS receivable

      FROM tbl_finance_pledges

      WHERE remaining_balance > 0

      GROUP BY aging_bucket
    `);

    return rows;
  }

  /* =========================================================
     CAMPAIGN COLLECTION EFFICIENCY
  ========================================================= */

  async getCampaignCollectionEfficiency() {

    const [rows] = await pool.query(`
      SELECT

        campaign_id,
        campaign_name,

        COUNT(*) AS pledge_count,

        SUM(pledged_amount)
          AS pledged_total,

        SUM(paid_amount)
          AS paid_total

      FROM tbl_finance_pledges

      GROUP BY
        campaign_id,
        campaign_name

      ORDER BY paid_total DESC
    `);

    return rows.map(row => {

      const pledged =
        Number(
          row.pledged_total || 0
        );

      const paid =
        Number(
          row.paid_total || 0
        );

      return {

        ...row,

        collection_efficiency:
          pledged > 0
            ? Number(
                (
                  (paid / pledged) * 100
                ).toFixed(2)
              )
            : 0,
      };
    });
  }

  /* =========================================================
     FORECAST ACCURACY
  ========================================================= */

  async getForecastAccuracy() {

    const [[row]] = await pool.query(`
      SELECT

        SUM(pledged_amount)
          AS pledged,

        SUM(paid_amount)
          AS actual

      FROM tbl_finance_pledges
    `);

    const pledged =
      Number(row?.pledged || 0);

    const actual =
      Number(row?.actual || 0);

    return {

      forecast:
        pledged,

      actual,

      accuracy:
        pledged > 0
          ? Number(
              ((actual / pledged) * 100)
                .toFixed(2)
            )
          : 0,
    };
  }

  /* =========================================================
     COLLECTION TREND
  ========================================================= */

  async getCollectionTrend() {

    const [rows] = await pool.query(`
      SELECT

        DATE_FORMAT(
          paid_at,
          '%Y-%m'
        ) AS period,

        COUNT(*) AS payments,

        SUM(amount)
          AS amount

      FROM tbl_finance_payments

      WHERE payment_type='pledge'
        AND payment_status='paid'

      GROUP BY period

      ORDER BY period ASC
    `);

    return rows;
  }

  /* =========================================================
     EXECUTIVE DASHBOARD
  ========================================================= */

  async getExecutiveDashboard() {

    const [
      effectiveness,
      conversion,
      collectionDays,
      recovery,
      reminders,
      aging,
      campaignEfficiency,
      forecastAccuracy,
      trend,
    ] = await Promise.all([

      this.getCollectionEffectiveness(),

      this.getPromiseToPayConversion(),

      this.getAverageDaysToCollect(),

      this.getOverdueRecoveryRate(),

      this.getReminderEffectiveness(),

      this.getAgingAnalytics(),

      this.getCampaignCollectionEfficiency(),

      this.getForecastAccuracy(),

      this.getCollectionTrend(),
    ]);

    return {

      generated_at:
        new Date().toISOString(),

      effectiveness,

      conversion,

      collectionDays,

      recovery,

      reminders,

      aging,

      campaignEfficiency,

      forecastAccuracy,

      trend,
    };
  }

  /* =========================================================
     KPI SUMMARY
  ========================================================= */

  async getKpiSummary() {

    const [
      effectiveness,
      conversion,
      recovery,
    ] = await Promise.all([

      this.getCollectionEffectiveness(),

      this.getPromiseToPayConversion(),

      this.getOverdueRecoveryRate(),
    ]);

    return {

      collection_rate:
        effectiveness.collection_rate,

      conversion_rate:
        conversion.conversion_rate,

      overdue_recovery_rate:
        recovery.recovery_rate,

      total_receivable:
        effectiveness.receivable_total,

      total_collected:
        effectiveness.paid_total,
    };
  }
}

module.exports =
  new PledgeCollectionAnalyticsService();