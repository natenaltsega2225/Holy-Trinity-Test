// backend\services\domains\pledges\pledgeExportService.js
// backend/services/domains/pledge/pledgeExportService.js

"use strict";

const pool = require("../../../db");

class PledgeExportService {

  /* =========================================================
     GENERIC CSV BUILDER
  ========================================================= */

  toCsv(rows = []) {
    if (!rows.length) return "";

    const headers = Object.keys(rows[0]);

    const csv = [
      headers.join(","),
      ...rows.map(row =>
        headers
          .map(key => {
            const value =
              row[key] === null ||
              row[key] === undefined
                ? ""
                : String(row[key])
                    .replace(/"/g, '""');

            return `"${value}"`;
          })
          .join(",")
      ),
    ];

    return csv.join("\n");
  }

  /* =========================================================
     PLEDGE EXPORT
  ========================================================= */

  async exportPledges(filters = {}) {
    const where = [];
    const params = [];

    if (filters.status) {
      where.push("status = ?");
      params.push(filters.status);
    }

    if (filters.campaign_id) {
      where.push("campaign_id = ?");
      params.push(filters.campaign_id);
    }

    if (filters.member_id) {
      where.push("member_id = ?");
      params.push(filters.member_id);
    }

    const whereSql =
      where.length
        ? `WHERE ${where.join(" AND ")}`
        : "";

    const [rows] = await pool.query(
      `
      SELECT
        pledge_number,
        campaign_name,
        member_no,
        full_name_snapshot,
        email_snapshot,
        pledged_amount,
        paid_amount,
        remaining_balance,
        status,
        due_date,
        reminder_date,
        frequency,
        created_at
      FROM tbl_finance_pledges
      ${whereSql}
      ORDER BY id DESC
      `,
      params
    );

    return {
      total: rows.length,
      rows,
      csv: this.toCsv(rows),
    };
  }

  /* =========================================================
     RECEIVABLE EXPORT
  ========================================================= */

  async exportReceivables() {
    const [rows] = await pool.query(`
      SELECT
        pledge_number,
        campaign_name,
        full_name_snapshot,
        pledged_amount,
        paid_amount,
        remaining_balance,
        due_date,
        status
      FROM tbl_finance_pledges
      WHERE remaining_balance > 0
      ORDER BY remaining_balance DESC
    `);

    return {
      total: rows.length,
      rows,
      csv: this.toCsv(rows),
    };
  }

  /* =========================================================
     AGING EXPORT
  ========================================================= */

  async exportAging() {
    const [rows] = await pool.query(`
      SELECT
        pledge_number,
        campaign_name,
        full_name_snapshot,
        remaining_balance,

        CASE
          WHEN due_date IS NULL THEN 'No Due Date'
          WHEN DATEDIFF(CURDATE(), due_date) <= 0 THEN 'Current'
          WHEN DATEDIFF(CURDATE(), due_date) <= 30 THEN '1-30'
          WHEN DATEDIFF(CURDATE(), due_date) <= 60 THEN '31-60'
          WHEN DATEDIFF(CURDATE(), due_date) <= 90 THEN '61-90'
          ELSE '90+'
        END AS aging_bucket

      FROM tbl_finance_pledges
      WHERE remaining_balance > 0
      ORDER BY remaining_balance DESC
    `);

    return {
      total: rows.length,
      rows,
      csv: this.toCsv(rows),
    };
  }

  /* =========================================================
     CAMPAIGN EXPORT
  ========================================================= */

  async exportCampaigns() {
    const [rows] = await pool.query(`
      SELECT
        campaign_name,

        COUNT(*) AS pledge_count,

        SUM(pledged_amount)
          AS pledged_total,

        SUM(paid_amount)
          AS paid_total,

        SUM(remaining_balance)
          AS remaining_total

      FROM tbl_finance_pledges

      GROUP BY campaign_name

      ORDER BY pledged_total DESC
    `);

    return {
      total: rows.length,
      rows,
      csv: this.toCsv(rows),
    };
  }

  /* =========================================================
     PAYMENT EXPORT
  ========================================================= */

  async exportPayments() {
    const [rows] = await pool.query(`
      SELECT
        payment_number,
        pledge_number,
        campaign_name,
        full_name_snapshot,
        amount,
        method,
        payment_status,
        paid_at
      FROM tbl_finance_payments
      WHERE payment_type = 'pledge'
      ORDER BY paid_at DESC
    `);

    return {
      total: rows.length,
      rows,
      csv: this.toCsv(rows),
    };
  }

  /* =========================================================
     RECEIPT EXPORT
  ========================================================= */

  async exportReceipts() {
    const [rows] = await pool.query(`
      SELECT
        receipt_number,
        pledge_number,
        campaign_name,
        full_name_snapshot,
        amount,
        email_status,
        receipt_date
      FROM tbl_finance_receipts
      WHERE payment_type = 'pledge'
      ORDER BY receipt_date DESC
    `);

    return {
      total: rows.length,
      rows,
      csv: this.toCsv(rows),
    };
  }

  /* =========================================================
     INVOICE EXPORT
  ========================================================= */

  async exportInvoices() {
    const [rows] = await pool.query(`
      SELECT
        invoice_number,
        pledge_number,
        campaign_name,
        full_name_snapshot,
        total_amount,
        paid_amount,
        balance_due,
        status,
        invoice_date
      FROM tbl_finance_invoices
      WHERE payment_type = 'pledge'
      ORDER BY invoice_date DESC
    `);

    return {
      total: rows.length,
      rows,
      csv: this.toCsv(rows),
    };
  }

  /* =========================================================
     KPI EXPORT
  ========================================================= */

  async exportKpis() {
    const [[row]] = await pool.query(`
      SELECT

        COUNT(*) AS pledge_count,

        SUM(pledged_amount)
          AS pledged_total,

        SUM(paid_amount)
          AS paid_total,

        SUM(remaining_balance)
          AS receivable_total,

        SUM(
          CASE
            WHEN status='paid'
            THEN 1 ELSE 0
          END
        ) AS paid_count,

        SUM(
          CASE
            WHEN status='written_off'
            THEN 1 ELSE 0
          END
        ) AS writeoff_count

      FROM tbl_finance_pledges
    `);

    return {
      rows: [row],
      csv: this.toCsv([row]),
    };
  }

  /* =========================================================
     STATEMENT EXPORT
  ========================================================= */

  async exportStatement(pledgeId) {

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
      `,
      [pledgeId]
    );

    const [receipts] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_receipts
      WHERE pledge_id = ?
      `,
      [pledgeId]
    );

    const [invoices] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_invoices
      WHERE pledge_id = ?
      `,
      [pledgeId]
    );

    return {
      pledge,
      payments,
      receipts,
      invoices,
      generated_at:
        new Date().toISOString(),
    };
  }

  /* =========================================================
     DASHBOARD EXPORT PACKAGE
  ========================================================= */

  async exportDashboardPackage() {

    const [
      pledges,
      receivables,
      aging,
      campaigns,
      payments,
      receipts,
      invoices,
      kpis,
    ] = await Promise.all([
      this.exportPledges(),
      this.exportReceivables(),
      this.exportAging(),
      this.exportCampaigns(),
      this.exportPayments(),
      this.exportReceipts(),
      this.exportInvoices(),
      this.exportKpis(),
    ]);

    return {
      generated_at:
        new Date().toISOString(),

      pledges,
      receivables,
      aging,
      campaigns,
      payments,
      receipts,
      invoices,
      kpis,
    };
  }
}

module.exports =
  new PledgeExportService();