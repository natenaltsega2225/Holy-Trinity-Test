// backend/services/domains/pledge/pledgeCampaignPerformanceService.js

"use strict";

const pool = require("../../../db");

class PledgeCampaignPerformanceService {

  /* =========================================================
     SINGLE CAMPAIGN PERFORMANCE
  ========================================================= */

  async getCampaignPerformance(campaignId) {

    const [[row]] = await pool.query(
      `
      SELECT

        campaign_id,
        campaign_name,

        COUNT(*) AS pledge_count,

        COALESCE(
          SUM(pledged_amount),
          0
        ) AS pledged_total,

        COALESCE(
          SUM(paid_amount),
          0
        ) AS paid_total,

        COALESCE(
          SUM(remaining_balance),
          0
        ) AS receivable_total,

        SUM(
          CASE
            WHEN status = 'paid'
            THEN 1
            ELSE 0
          END
        ) AS completed_pledges,

        SUM(
          CASE
            WHEN status IN
            (
              'receivable',
              'partial',
              'invoiced'
            )
            THEN 1
            ELSE 0
          END
        ) AS open_pledges

      FROM tbl_finance_pledges

      WHERE campaign_id = ?

      GROUP BY
        campaign_id,
        campaign_name
      `,
      [campaignId]
    );

    if (!row) {
      throw new Error(
        "Campaign not found."
      );
    }

    const pledged =
      Number(
        row.pledged_total || 0
      );

    const paid =
      Number(
        row.paid_total || 0
      );

    const collectionRate =
      pledged > 0
        ? (paid / pledged) * 100
        : 0;

    return {
      ...row,

      collection_rate:
        Number(
          collectionRate.toFixed(2)
        ),
    };
  }

  /* =========================================================
     ALL CAMPAIGN PERFORMANCE
  ========================================================= */

  async getAllCampaignPerformance() {

    const [rows] =
      await pool.query(
        `
        SELECT

          campaign_id,
          campaign_name,

          COUNT(*) AS pledge_count,

          SUM(pledged_amount)
            AS pledged_total,

          SUM(paid_amount)
            AS paid_total,

          SUM(remaining_balance)
            AS receivable_total

        FROM tbl_finance_pledges

        GROUP BY
          campaign_id,
          campaign_name

        ORDER BY
          pledged_total DESC
        `
      );

    return rows.map(
      row => {

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

          collection_rate:
            pledged > 0
              ? Number(
                  (
                    (paid /
                      pledged) *
                    100
                  ).toFixed(2)
                )
              : 0,
        };
      }
    );
  }

  /* =========================================================
     TOP CAMPAIGNS
  ========================================================= */

  async getTopCampaigns(
    limit = 10
  ) {

    const campaigns =
      await this.getAllCampaignPerformance();

    return campaigns
      .sort(
        (a, b) =>
          Number(
            b.paid_total
          ) -
          Number(
            a.paid_total
          )
      )
      .slice(
        0,
        limit
      );
  }

  /* =========================================================
     UNDERPERFORMING CAMPAIGNS
  ========================================================= */

  async getUnderperformingCampaigns() {

    const campaigns =
      await this.getAllCampaignPerformance();

    return campaigns.filter(
      c =>
        Number(
          c.collection_rate
        ) < 50
    );
  }

  /* =========================================================
     CAMPAIGN GOAL TRACKING
  ========================================================= */

  async getGoalTracking() {

    const [rows] =
      await pool.query(
        `
        SELECT

          c.id,

          c.title,

          c.goal_amount,

          COALESCE(
            SUM(
              p.paid_amount
            ),
            0
          ) AS collected

        FROM tbl_finance_campaigns c

        LEFT JOIN tbl_finance_pledges p
          ON p.campaign_id = c.id

        GROUP BY
          c.id,
          c.title,
          c.goal_amount

        ORDER BY
          c.title
        `
      );

    return rows.map(
      row => {

        const goal =
          Number(
            row.goal_amount || 0
          );

        const collected =
          Number(
            row.collected || 0
          );

        return {

          ...row,

          remaining_to_goal:
            Math.max(
              goal -
                collected,
              0
            ),

          goal_completion_percent:
            goal > 0
              ? Number(
                  (
                    (collected /
                      goal) *
                    100
                  ).toFixed(2)
                )
              : 0,
        };
      }
    );
  }

  /* =========================================================
     CAMPAIGN TREND
  ========================================================= */

  async getCampaignTrend(
    campaignId
  ) {

    const [rows] =
      await pool.query(
        `
        SELECT

          DATE_FORMAT(
            paid_at,
            '%Y-%m'
          ) AS period,

          SUM(amount)
            AS collected

        FROM tbl_finance_payments

        WHERE campaign_id = ?
          AND payment_type = 'pledge'

        GROUP BY period

        ORDER BY period ASC
        `,
        [campaignId]
      );

    return rows;
  }

  /* =========================================================
     CAMPAIGN FORECAST SNAPSHOT
  ========================================================= */

  async getCampaignForecast(
    campaignId
  ) {

    const campaign =
      await this.getCampaignPerformance(
        campaignId
      );

    const paid =
      Number(
        campaign.paid_total || 0
      );

    const receivable =
      Number(
        campaign.receivable_total || 0
      );

    return {

      projected_collection:
        Number(
          (
            paid +
            receivable *
              0.82
          ).toFixed(2)
        ),

      collection_probability:
        82,

      current_collection:
        paid,

      outstanding:
        receivable,
    };
  }

  /* =========================================================
     CAMPAIGN LEADERBOARD
  ========================================================= */

  async getCampaignLeaderboard() {

    const campaigns =
      await this.getAllCampaignPerformance();

    return campaigns
      .sort(
        (a, b) =>
          Number(
            b.collection_rate
          ) -
          Number(
            a.collection_rate
          )
      )
      .map(
        (
          campaign,
          index
        ) => ({
          rank:
            index + 1,
          ...campaign,
        })
      );
  }

  /* =========================================================
     CAMPAIGN EXECUTIVE SUMMARY
  ========================================================= */

  async getExecutiveSummary() {

    const [
      leaderboard,
      goals,
      topCampaigns,
      underperforming,
    ] =
      await Promise.all([
        this.getCampaignLeaderboard(),
        this.getGoalTracking(),
        this.getTopCampaigns(),
        this.getUnderperformingCampaigns(),
      ]);

    return {

      generated_at:
        new Date()
          .toISOString(),

      leaderboard,

      goals,

      top_campaigns:
        topCampaigns,

      underperforming_campaigns:
        underperforming,
    };
  }

  /* =========================================================
     CAMPAIGN KPI DASHBOARD
  ========================================================= */

  async getCampaignKpis() {

    const [[row]] =
      await pool.query(
        `
        SELECT

          COUNT(
            DISTINCT campaign_id
          ) AS total_campaigns,

          SUM(
            pledged_amount
          ) AS pledged_total,

          SUM(
            paid_amount
          ) AS paid_total,

          SUM(
            remaining_balance
          ) AS receivable_total

        FROM tbl_finance_pledges
        `
      );

    const pledged =
      Number(
        row?.pledged_total || 0
      );

    const paid =
      Number(
        row?.paid_total || 0
      );

    return {

      total_campaigns:
        Number(
          row?.total_campaigns || 0
        ),

      pledged_total:
        pledged,

      paid_total:
        paid,

      receivable_total:
        Number(
          row?.receivable_total || 0
        ),

      overall_collection_rate:
        pledged > 0
          ? Number(
              (
                (paid /
                  pledged) *
                100
              ).toFixed(2)
            )
          : 0,
    };
  }
}

module.exports =
  new PledgeCampaignPerformanceService();