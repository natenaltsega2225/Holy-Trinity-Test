// backend\services\domains\pledges\pledgeWriteoffService.js
// backend/services/domains/pledge/pledgeWriteoffService.js

"use strict";

const pool = require("../../../db");

class PledgeWriteoffService {

  /* =========================================================
     CREATE WRITEOFF
  ========================================================= */

  async writeoffPledge({
    pledgeId,
    reason,
    notes,
    approvedBy,
  }) {

    const conn =
      await pool.getConnection();

    try {

      await conn.beginTransaction();

      const [[pledge]] =
        await conn.query(
          `
          SELECT *
          FROM tbl_finance_pledges
          WHERE id = ?
          LIMIT 1
          `,
          [pledgeId]
        );

      if (!pledge) {
        throw new Error(
          "Pledge not found."
        );
      }

      if (
        pledge.status ===
        "written_off"
      ) {
        throw new Error(
          "Pledge already written off."
        );
      }

      const writeoffAmount =
        Number(
          pledge.remaining_balance || 0
        );

      if (
        writeoffAmount <= 0
      ) {
        throw new Error(
          "No balance available to write off."
        );
      }

      await conn.query(
        `
        UPDATE tbl_finance_pledges
        SET
          status = 'written_off',
          remaining_balance = 0,
          writeoff_amount = ?,
          writeoff_reason = ?,
          writeoff_notes = ?,
          written_off_by = ?,
          written_off_at = NOW(),
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          writeoffAmount,
          reason || null,
          notes || null,
          approvedBy || null,
          pledgeId,
        ]
      );

      await this.createWriteoffLedger(
        conn,
        {
          pledge,
          amount:
            writeoffAmount,
          approvedBy,
          reason,
        }
      );

      await this.createAuditLog(
        conn,
        {
          pledge,
          approvedBy,
          reason,
          amount:
            writeoffAmount,
        }
      );

      await conn.commit();

      return {
        success: true,
        pledge_id:
          pledgeId,
        amount:
          writeoffAmount,
      };

    } catch (err) {

      await conn.rollback();

      throw err;

    } finally {

      conn.release();
    }
  }

  /* =========================================================
     LEDGER ENTRY
  ========================================================= */

  async createWriteoffLedger(
    conn,
    {
      pledge,
      amount,
      approvedBy,
      reason,
    }
  ) {

    const tables = [
      "tbl_finance_member_ledger",
      "tbl_finance_ledger",
      "tbl_finance_ledger_entries",
    ];

    for (
      const table
      of tables
    ) {

      try {

        await conn.query(
          `
          INSERT INTO ${table}
          (
            member_id,
            pledge_id,
            pledge_number,
            category,
            entry_type,
            description,
            debit_amount,
            credit_amount,
            amount,
            status,
            created_by,
            created_at
          )
          VALUES
          (
            ?, ?, ?,
            'pledge',
            'writeoff',
            ?,
            0,
            ?,
            ?,
            'posted',
            ?,
            NOW()
          )
          `,
          [
            pledge.member_id,
            pledge.id,
            pledge.pledge_number,

            `Pledge write-off: ${
              reason || ""
            }`,

            amount,
            amount,

            approvedBy,
          ]
        );

        return;

      } catch {
        continue;
      }
    }
  }

  /* =========================================================
     AUDIT LOG
  ========================================================= */

  async createAuditLog(
    conn,
    {
      pledge,
      approvedBy,
      reason,
      amount,
    }
  ) {

    try {

      await conn.query(
        `
        INSERT INTO tbl_audit_logs
        (
          module,
          action,
          record_id,
          user_id,
          details,
          created_at
        )
        VALUES
        (
          'pledges',
          'writeoff',
          ?,
          ?,
          ?,
          NOW()
        )
        `,
        [
          pledge.id,
          approvedBy,

          JSON.stringify({
            pledge_number:
              pledge.pledge_number,
            amount,
            reason,
          }),
        ]
      );

    } catch {
      return;
    }
  }

  /* =========================================================
     RECOVER WRITTEN OFF PLEDGE
  ========================================================= */

  async recoverWriteoff({
    pledgeId,
    userId,
  }) {

    const conn =
      await pool.getConnection();

    try {

      await conn.beginTransaction();

      const [[pledge]] =
        await conn.query(
          `
          SELECT *
          FROM tbl_finance_pledges
          WHERE id = ?
          LIMIT 1
          `,
          [pledgeId]
        );

      if (!pledge) {
        throw new Error(
          "Pledge not found."
        );
      }

      if (
        pledge.status !==
        "written_off"
      ) {
        throw new Error(
          "Pledge is not written off."
        );
      }

      const balance =
        Number(
          pledge.writeoff_amount || 0
        );

      await conn.query(
        `
        UPDATE tbl_finance_pledges
        SET
          status = 'receivable',
          remaining_balance = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          balance,
          pledgeId,
        ]
      );

      await this.createAuditLog(
        conn,
        {
          pledge,
          approvedBy:
            userId,
          reason:
            "Recovery",
          amount:
            balance,
        }
      );

      await conn.commit();

      return {
        success: true,
        recovered_amount:
          balance,
      };

    } catch (err) {

      await conn.rollback();

      throw err;

    } finally {

      conn.release();
    }
  }

  /* =========================================================
     WRITEOFF KPI
  ========================================================= */

  async getWriteoffKpis() {

    const [[row]] =
      await pool.query(
        `
        SELECT

          COUNT(*) AS total_writeoffs,

          COALESCE(
            SUM(writeoff_amount),
            0
          ) AS total_amount,

          AVG(writeoff_amount)
            AS average_amount

        FROM tbl_finance_pledges

        WHERE status =
          'written_off'
        `
      );

    return row;
  }

  /* =========================================================
     WRITEOFF ANALYTICS
  ========================================================= */

  async getWriteoffAnalytics() {

    const [rows] =
      await pool.query(
        `
        SELECT

          campaign_name,

          COUNT(*) AS writeoff_count,

          SUM(writeoff_amount)
            AS writeoff_amount

        FROM tbl_finance_pledges

        WHERE status =
          'written_off'

        GROUP BY campaign_name

        ORDER BY
          writeoff_amount DESC
        `
      );

    return rows;
  }

  /* =========================================================
     WRITEOFF TREND
  ========================================================= */

  async getWriteoffTrend() {

    const [rows] =
      await pool.query(
        `
        SELECT

          DATE_FORMAT(
            written_off_at,
            '%Y-%m'
          ) AS period,

          COUNT(*) AS total,

          SUM(writeoff_amount)
            AS amount

        FROM tbl_finance_pledges

        WHERE status =
          'written_off'

        GROUP BY period

        ORDER BY period DESC

        LIMIT 24
        `
      );

    return rows;
  }

  /* =========================================================
     EXECUTIVE SUMMARY
  ========================================================= */

  async getExecutiveSummary() {

    const [
      kpis,
      analytics,
      trend,
    ] =
      await Promise.all([
        this.getWriteoffKpis(),
        this.getWriteoffAnalytics(),
        this.getWriteoffTrend(),
      ]);

    return {

      generated_at:
        new Date()
          .toISOString(),

      kpis,

      analytics,

      trend,
    };
  }
}

module.exports =
  new PledgeWriteoffService();