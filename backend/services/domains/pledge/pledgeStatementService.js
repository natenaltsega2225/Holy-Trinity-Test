// backend\services\domains\pledges\pledgeStatementService.js
// backend/services/domains/pledge/pledgeStatementService.js

"use strict";

const pool = require("../../../db");

class PledgeStatementService {
  /* =========================================================
     SINGLE PLEDGE STATEMENT
  ========================================================= */

  async getPledgeStatement(pledgeId) {
    const [[pledge]] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_pledges
      WHERE id = ?
      LIMIT 1
      `,
      [pledgeId]
    );

    if (!pledge) {
      throw new Error("Pledge not found.");
    }

    const [payments] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_payments
      WHERE pledge_id = ?
      ORDER BY paid_at ASC, id ASC
      `,
      [pledgeId]
    );

    const [invoices] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_invoices
      WHERE pledge_id = ?
      ORDER BY invoice_date ASC, id ASC
      `,
      [pledgeId]
    );

    const [receipts] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_receipts
      WHERE pledge_id = ?
      ORDER BY receipt_date ASC, id ASC
      `,
      [pledgeId]
    );

    const [ledger] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_member_ledger
      WHERE pledge_id = ?
      ORDER BY created_at ASC, id ASC
      `,
      [pledgeId]
    ).catch(() => [[]]);

    return {
      pledge,
      payments,
      invoices,
      receipts,
      ledger,

      summary: {
        pledged_amount:
          Number(pledge.pledged_amount || 0),

        paid_amount:
          Number(pledge.paid_amount || 0),

        remaining_balance:
          Number(pledge.remaining_balance || 0),

        status:
          pledge.status,
      },
    };
  }

  /* =========================================================
     MEMBER STATEMENT
  ========================================================= */

  async getMemberPledgeStatement(memberId) {
    const [pledges] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_pledges
      WHERE member_id = ?
      ORDER BY created_at DESC
      `,
      [memberId]
    );

    const totals = pledges.reduce(
      (acc, p) => {
        acc.pledged += Number(p.pledged_amount || 0);
        acc.paid += Number(p.paid_amount || 0);
        acc.remaining += Number(p.remaining_balance || 0);
        return acc;
      },
      {
        pledged: 0,
        paid: 0,
        remaining: 0,
      }
    );

    return {
      member_id: memberId,
      totals,
      pledges,
    };
  }

  /* =========================================================
     CAMPAIGN STATEMENT
  ========================================================= */

  async getCampaignPledgeStatement(campaignId) {
    const [pledges] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_pledges
      WHERE campaign_id = ?
      ORDER BY created_at DESC
      `,
      [campaignId]
    );

    let pledged = 0;
    let paid = 0;
    let remaining = 0;

    for (const row of pledges) {
      pledged += Number(row.pledged_amount || 0);
      paid += Number(row.paid_amount || 0);
      remaining += Number(row.remaining_balance || 0);
    }

    return {
      campaign_id: campaignId,

      totals: {
        pledged,
        paid,
        remaining,
      },

      pledge_count: pledges.length,

      pledges,
    };
  }

  /* =========================================================
     DONOR EMAIL STATEMENT
  ========================================================= */

  async getDonorStatement(email) {
    const [pledges] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_pledges
      WHERE email_snapshot = ?
      ORDER BY created_at DESC
      `,
      [email]
    );

    return {
      email,
      pledge_count: pledges.length,
      pledges,
    };
  }

  /* =========================================================
     OUTSTANDING RECEIVABLES
  ========================================================= */

  async getOutstandingStatements() {
    const [rows] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_pledges
      WHERE remaining_balance > 0
      ORDER BY remaining_balance DESC
      `
    );

    return rows;
  }

  /* =========================================================
     PAYMENTS
  ========================================================= */

  async getStatementPayments(pledgeId) {
    const [rows] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_payments
      WHERE pledge_id = ?
      ORDER BY paid_at DESC
      `,
      [pledgeId]
    );

    return rows;
  }

  /* =========================================================
     INVOICES
  ========================================================= */

  async getStatementInvoices(pledgeId) {
    const [rows] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_invoices
      WHERE pledge_id = ?
      ORDER BY invoice_date DESC
      `,
      [pledgeId]
    );

    return rows;
  }

  /* =========================================================
     RECEIPTS
  ========================================================= */

  async getStatementReceipts(pledgeId) {
    const [rows] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_receipts
      WHERE pledge_id = ?
      ORDER BY receipt_date DESC
      `,
      [pledgeId]
    );

    return rows;
  }

  /* =========================================================
     SUMMARY DASHBOARD
  ========================================================= */

  async getStatementSummary(filters = {}) {
    const where = [];
    const params = [];

    if (filters.campaign_id) {
      where.push("campaign_id = ?");
      params.push(filters.campaign_id);
    }

    if (filters.member_id) {
      where.push("member_id = ?");
      params.push(filters.member_id);
    }

    const sqlWhere =
      where.length
        ? `WHERE ${where.join(" AND ")}`
        : "";

    const [[row]] = await pool.query(
      `
      SELECT
        COUNT(*) AS pledge_count,

        COALESCE(SUM(pledged_amount),0)
          AS pledged_total,

        COALESCE(SUM(paid_amount),0)
          AS paid_total,

        COALESCE(SUM(remaining_balance),0)
          AS receivable_total

      FROM tbl_finance_pledges
      ${sqlWhere}
      `,
      params
    );

    return row;
  }

  /* =========================================================
     AGING SNAPSHOT
  ========================================================= */

  async getAgingSnapshot() {
    const [rows] = await pool.query(
      `
      SELECT

        CASE
          WHEN due_date IS NULL THEN 'no_due_date'
          WHEN DATEDIFF(CURDATE(), due_date) <= 0 THEN 'current'
          WHEN DATEDIFF(CURDATE(), due_date) <= 30 THEN '1_30'
          WHEN DATEDIFF(CURDATE(), due_date) <= 60 THEN '31_60'
          WHEN DATEDIFF(CURDATE(), due_date) <= 90 THEN '61_90'
          ELSE '90_plus'
        END AS bucket,

        COUNT(*) AS total_pledges,

        SUM(remaining_balance)
          AS receivable

      FROM tbl_finance_pledges

      WHERE remaining_balance > 0

      GROUP BY bucket
      `
    );

    return rows;
  }

  /* =========================================================
     FULL EXPORT OBJECT
  ========================================================= */

  async buildStatementData(pledgeId) {
    const statement =
      await this.getPledgeStatement(
        pledgeId
      );

    const aging =
      await this.getAgingSnapshot();

    return {
      generated_at:
        new Date().toISOString(),

      statement,
      aging,
    };
  }
}

module.exports =
  new PledgeStatementService();