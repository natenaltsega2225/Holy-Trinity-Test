// backend\services\domains\pledges\pledgeRecurringService.js
// backend/services/domains/pledge/pledgeRecurringService.js

"use strict";

const pool = require("../../../db");

const {
  createPaymentSchedule,
  cancelSchedule,
  normalizeFrequency,
  installmentsForFrequency,
} = require("./pledgeScheduleService");

const {
  createAuditLog,
} = require("./pledgeAuditService");

/* =========================================================
   HELPERS
========================================================= */

const tableCache = new Map();
const columnCache = new Map();

function clean(value) {
  return String(value ?? "").trim();
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function toInt(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mysqlDate(value) {
  const d = toDate(value);
  return d ? d.toISOString().slice(0, 10) : null;
}

function addMonths(value, months) {
  const d = toDate(value) || new Date();
  const next = new Date(d);
  next.setMonth(next.getMonth() + Number(months || 0));
  return next;
}

function addDays(value, days) {
  const d = toDate(value) || new Date();
  const next = new Date(d);
  next.setDate(next.getDate() + Number(days || 0));
  return next;
}

function nextDateFromFrequency(value, frequency) {
  const f = normalizeFrequency(frequency);

  if (f === "weekly") return mysqlDate(addDays(value, 7));
  if (f === "biweekly") return mysqlDate(addDays(value, 14));
  if (f === "monthly") return mysqlDate(addMonths(value, 1));
  if (f === "quarterly") return mysqlDate(addMonths(value, 3));
  if (f === "semiannual") return mysqlDate(addMonths(value, 6));
  if (f === "annual") return mysqlDate(addMonths(value, 12));

  return null;
}

function recurringStatus(status) {
  const s = clean(status).toLowerCase();

  if (["active", "paused", "cancelled", "completed", "failed"].includes(s)) {
    return s;
  }

  return "active";
}

async function tableExists(conn, tableName) {
  if (tableCache.has(tableName)) return tableCache.get(tableName);

  try {
    const [rows] = await conn.query(`SHOW TABLES LIKE ?`, [tableName]);
    const exists = rows.length > 0;
    tableCache.set(tableName, exists);
    return exists;
  } catch {
    tableCache.set(tableName, false);
    return false;
  }
}

async function getColumns(conn, tableName) {
  if (columnCache.has(tableName)) return columnCache.get(tableName);

  const exists = await tableExists(conn, tableName);

  if (!exists) {
    const empty = new Set();
    columnCache.set(tableName, empty);
    return empty;
  }

  const [rows] = await conn.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const cols = new Set(rows.map((r) => r.Field));

  columnCache.set(tableName, cols);
  return cols;
}

async function insertDynamic(conn, tableName, data) {
  const cols = await getColumns(conn, tableName);

  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) return null;

  const fields = entries.map(([key]) => `\`${key}\``).join(", ");
  const marks = entries.map(() => "?").join(", ");
  const values = entries.map(([, value]) => value);

  const [result] = await conn.query(
    `
    INSERT INTO \`${tableName}\`
    (${fields})
    VALUES (${marks})
    `,
    values
  );

  return result.insertId;
}

async function updateDynamic(conn, tableName, data, whereSql, whereParams = []) {
  const cols = await getColumns(conn, tableName);

  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) return;

  const setSql = entries.map(([key]) => `\`${key}\` = ?`).join(", ");
  const values = entries.map(([, value]) => value);

  await conn.query(
    `
    UPDATE \`${tableName}\`
    SET ${setSql}
    WHERE ${whereSql}
    `,
    [...values, ...whereParams]
  );
}

/* =========================================================
   TABLE BOOTSTRAP
========================================================= */

async function ensureRecurringTable(conn) {
  if (await tableExists(conn, "tbl_finance_pledge_recurring")) {
    return true;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS tbl_finance_pledge_recurring (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

      pledge_id BIGINT UNSIGNED NOT NULL,
      pledge_number VARCHAR(80) NULL,

      campaign_id BIGINT NULL,
      campaign_name VARCHAR(255) NULL,

      member_id BIGINT NULL,
      member_no VARCHAR(80) NULL,

      full_name_snapshot VARCHAR(255) NULL,
      email_snapshot VARCHAR(255) NULL,
      phone_snapshot VARCHAR(80) NULL,

      frequency VARCHAR(40) NOT NULL DEFAULT 'monthly',

      recurring_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,

      start_date DATE NULL,
      next_run_date DATE NULL,
      end_date DATE NULL,

      total_cycles INT NULL,
      completed_cycles INT NOT NULL DEFAULT 0,

      status VARCHAR(40) NOT NULL DEFAULT 'active',

      auto_generate_schedule TINYINT(1) NOT NULL DEFAULT 1,

      last_schedule_generated_at DATETIME NULL,
      last_processed_at DATETIME NULL,

      cancelled_at DATETIME NULL,
      paused_at DATETIME NULL,
      resumed_at DATETIME NULL,

      failure_count INT NOT NULL DEFAULT 0,
      last_failure_message TEXT NULL,

      notes TEXT NULL,

      created_by BIGINT NULL,
      updated_by BIGINT NULL,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_recurring_pledge (pledge_id),
      INDEX idx_recurring_next_run (next_run_date),
      INDEX idx_recurring_status (status),
      INDEX idx_recurring_campaign (campaign_id),
      INDEX idx_recurring_member (member_id)
    )
  `);

  tableCache.set("tbl_finance_pledge_recurring", true);
  columnCache.delete("tbl_finance_pledge_recurring");

  return true;
}

/* =========================================================
   LOADERS
========================================================= */

async function getPledge(conn, pledgeId) {
  const [[row]] = await conn.query(
    `
    SELECT *
    FROM tbl_finance_pledges
    WHERE id = ?
    LIMIT 1
    `,
    [pledgeId]
  );

  return row || null;
}

async function getRecurringById(conn, recurringId) {
  const [[row]] = await conn.query(
    `
    SELECT *
    FROM tbl_finance_pledge_recurring
    WHERE id = ?
    LIMIT 1
    `,
    [recurringId]
  );

  return row || null;
}

/* =========================================================
   CREATE RECURRING PLEDGE
========================================================= */

async function createRecurringPledge({
  pledgeId,
  frequency = "monthly",
  recurringAmount = null,
  startDate = null,
  endDate = null,
  totalCycles = null,
  autoGenerateSchedule = true,
  actorId = null,
  notes = null,
} = {}) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await ensureRecurringTable(conn);

    const pledge = await getPledge(conn, pledgeId);

    if (!pledge) {
      throw new Error("Pledge not found.");
    }

    if (["paid", "written_off", "cancelled"].includes(String(pledge.status))) {
      throw new Error("Closed pledges cannot be recurring.");
    }

    const finalFrequency = normalizeFrequency(frequency || pledge.frequency || "monthly");

    if (finalFrequency === "one_time") {
      throw new Error("Recurring pledge frequency cannot be one_time.");
    }

    const amount = money(
      recurringAmount ||
        pledge.recurring_amount ||
        pledge.remaining_balance ||
        pledge.pledged_amount
    );

    if (amount <= 0) {
      throw new Error("Recurring amount must be greater than zero.");
    }

    const firstDate = mysqlDate(startDate || pledge.due_date || new Date());
    const nextRunDate = firstDate;

    const recurringId = await insertDynamic(
      conn,
      "tbl_finance_pledge_recurring",
      {
        pledge_id: pledge.id,
        pledge_number: pledge.pledge_number || null,

        campaign_id: pledge.campaign_id || null,
        campaign_name: pledge.campaign_name || null,

        member_id: pledge.member_id || null,
        member_no: pledge.member_no || null,

        full_name_snapshot: pledge.full_name_snapshot || "Guest Donor",
        email_snapshot: pledge.email_snapshot || null,
        phone_snapshot: pledge.phone_snapshot || null,

        frequency: finalFrequency,
        recurring_amount: amount,

        start_date: firstDate,
        next_run_date: nextRunDate,
        end_date: mysqlDate(endDate),

        total_cycles: totalCycles ? toInt(totalCycles, 1) : null,
        completed_cycles: 0,

        status: "active",

        auto_generate_schedule: autoGenerateSchedule ? 1 : 0,

        notes,
        created_by: actorId,
        updated_by: actorId,

        created_at: new Date(),
        updated_at: new Date(),
      }
    );

    await updateDynamic(
      conn,
      "tbl_finance_pledges",
      {
        pledge_type: "recurring",
        frequency: finalFrequency,
        due_date: nextRunDate,
        updated_by: actorId,
        updated_at: new Date(),
      },
      "id = ?",
      [pledge.id]
    );

    await conn.commit();

    await createAuditLog({
      actorId,
      entityType: "pledge_recurring",
      entityId: recurringId,
      entityNumber: pledge.pledge_number,
      action: "recurring_pledge_created",
      description: `Recurring pledge created for ${pledge.pledge_number}`,
      afterData: {
        recurring_id: recurringId,
        pledge_id: pledge.id,
        frequency: finalFrequency,
        recurring_amount: amount,
        next_run_date: nextRunDate,
      },
    }).catch(() => {});

    return {
      ok: true,
      recurring_id: recurringId,
      pledge_id: pledge.id,
      pledge_number: pledge.pledge_number,
      frequency: finalFrequency,
      recurring_amount: amount,
      next_run_date: nextRunDate,
      status: "active",
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* =========================================================
   LIST RECURRING PLEDGES
========================================================= */

async function getRecurringPledges(filters = {}) {
  const conn = await pool.getConnection();

  try {
    await ensureRecurringTable(conn);

    const page = toInt(filters.page, 1);
    const limit = Math.min(100, toInt(filters.limit || filters.pageSize, 25));
    const offset = (page - 1) * limit;

    const status = clean(filters.status);
    const campaignId = clean(filters.campaign_id);
    const memberId = clean(filters.member_id);
    const search = clean(filters.search || filters.q);

    const where = [];
    const params = [];

    if (status) {
      where.push("status = ?");
      params.push(status);
    }

    if (campaignId) {
      where.push("campaign_id = ?");
      params.push(campaignId);
    }

    if (memberId) {
      where.push("member_id = ?");
      params.push(memberId);
    }

    if (search) {
      where.push(`
        (
          pledge_number LIKE ?
          OR full_name_snapshot LIKE ?
          OR email_snapshot LIKE ?
          OR campaign_name LIKE ?
        )
      `);

      const q = `%${search}%`;
      params.push(q, q, q, q);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [[countRow]] = await conn.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_finance_pledge_recurring
      ${whereSql}
      `,
      params
    );

    const [rows] = await conn.query(
      `
      SELECT *
      FROM tbl_finance_pledge_recurring
      ${whereSql}
      ORDER BY
        status = 'active' DESC,
        next_run_date ASC,
        id DESC
      LIMIT ?
      OFFSET ?
      `,
      [...params, limit, offset]
    );

    return {
      ok: true,
      rows: rows.map(formatRecurringRow),
      pagination: {
        page,
        limit,
        total: Number(countRow.total || 0),
        pages: Math.max(1, Math.ceil(Number(countRow.total || 0) / limit)),
      },
    };
  } finally {
    conn.release();
  }
}

/* =========================================================
   PAUSE / RESUME / CANCEL
========================================================= */

async function pauseRecurringPledge(recurringId, options = {}) {
  return updateRecurringStatus(recurringId, "paused", {
    ...options,
    dateField: "paused_at",
    action: "recurring_pledge_paused",
  });
}

async function resumeRecurringPledge(recurringId, options = {}) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await ensureRecurringTable(conn);

    const recurring = await getRecurringById(conn, recurringId);

    if (!recurring) throw new Error("Recurring pledge not found.");

    if (String(recurring.status) === "cancelled") {
      throw new Error("Cancelled recurring pledge cannot be resumed.");
    }

    const nextRunDate =
      recurring.next_run_date && new Date(recurring.next_run_date) >= new Date()
        ? mysqlDate(recurring.next_run_date)
        : mysqlDate(new Date());

    await updateDynamic(
      conn,
      "tbl_finance_pledge_recurring",
      {
        status: "active",
        next_run_date: nextRunDate,
        resumed_at: new Date(),
        updated_by: options.actorId || null,
        updated_at: new Date(),
      },
      "id = ?",
      [recurringId]
    );

    await conn.commit();

    await createAuditLog({
      actorId: options.actorId || null,
      entityType: "pledge_recurring",
      entityId: recurringId,
      entityNumber: recurring.pledge_number,
      action: "recurring_pledge_resumed",
      description: `Recurring pledge resumed for ${recurring.pledge_number}`,
      metadata: {
        reason: options.reason || null,
      },
    }).catch(() => {});

    return {
      ok: true,
      recurring_id: recurringId,
      status: "active",
      next_run_date: nextRunDate,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function cancelRecurringPledge(recurringId, options = {}) {
  const result = await updateRecurringStatus(recurringId, "cancelled", {
    ...options,
    dateField: "cancelled_at",
    action: "recurring_pledge_cancelled",
  });

  if (options.cancelSchedule !== false && result.pledge_id) {
    await cancelSchedule(result.pledge_id, {
      reason: options.reason || "Recurring pledge cancelled.",
      actorId: options.actorId || null,
    }).catch(() => {});
  }

  return result;
}

async function updateRecurringStatus(recurringId, status, options = {}) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await ensureRecurringTable(conn);

    const recurring = await getRecurringById(conn, recurringId);

    if (!recurring) {
      throw new Error("Recurring pledge not found.");
    }

    await updateDynamic(
      conn,
      "tbl_finance_pledge_recurring",
      {
        status: recurringStatus(status),
        [options.dateField || "updated_at"]: new Date(),
        updated_by: options.actorId || null,
        updated_at: new Date(),
      },
      "id = ?",
      [recurringId]
    );

    await conn.commit();

    await createAuditLog({
      actorId: options.actorId || null,
      entityType: "pledge_recurring",
      entityId: recurringId,
      entityNumber: recurring.pledge_number,
      action: options.action || `recurring_pledge_${status}`,
      description: `Recurring pledge status changed to ${status}`,
      metadata: {
        reason: options.reason || null,
        previous_status: recurring.status,
        next_status: status,
      },
    }).catch(() => {});

    return {
      ok: true,
      recurring_id: recurringId,
      pledge_id: recurring.pledge_id,
      status,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* =========================================================
   GENERATE NEXT SCHEDULE
========================================================= */

async function generateNextInstallment(recurringId, options = {}) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await ensureRecurringTable(conn);

    const recurring = await getRecurringById(conn, recurringId);

    if (!recurring) throw new Error("Recurring pledge not found.");
    if (String(recurring.status) !== "active") {
      throw new Error("Recurring pledge is not active.");
    }

    if (
      recurring.total_cycles &&
      Number(recurring.completed_cycles || 0) >= Number(recurring.total_cycles)
    ) {
      await updateDynamic(
        conn,
        "tbl_finance_pledge_recurring",
        {
          status: "completed",
          updated_at: new Date(),
        },
        "id = ?",
        [recurring.id]
      );

      await conn.commit();

      return {
        ok: true,
        recurring_id: recurring.id,
        status: "completed",
        generated: false,
      };
    }

    if (
      recurring.end_date &&
      mysqlDate(recurring.next_run_date) > mysqlDate(recurring.end_date)
    ) {
      await updateDynamic(
        conn,
        "tbl_finance_pledge_recurring",
        {
          status: "completed",
          updated_at: new Date(),
        },
        "id = ?",
        [recurring.id]
      );

      await conn.commit();

      return {
        ok: true,
        recurring_id: recurring.id,
        status: "completed",
        generated: false,
      };
    }

    await conn.commit();

    const schedule = await createPaymentSchedule({
      pledgeId: recurring.pledge_id,
      startDate: recurring.next_run_date || new Date(),
      frequency: "one_time",
      installmentCount: 1,
      amount: recurring.recurring_amount,
      replaceExisting: false,
      actorId: options.actorId || null,
      notes: `Auto-generated recurring installment #${
        Number(recurring.completed_cycles || 0) + 1
      }`,
    });

    const nextRunDate = nextDateFromFrequency(
      recurring.next_run_date || new Date(),
      recurring.frequency
    );

    const conn2 = await pool.getConnection();

    try {
      await updateDynamic(
        conn2,
        "tbl_finance_pledge_recurring",
        {
          completed_cycles: Number(recurring.completed_cycles || 0) + 1,
          next_run_date: nextRunDate,
          last_schedule_generated_at: new Date(),
          last_processed_at: new Date(),
          updated_by: options.actorId || null,
          updated_at: new Date(),
        },
        "id = ?",
        [recurring.id]
      );
    } finally {
      conn2.release();
    }

    await createAuditLog({
      actorId: options.actorId || null,
      entityType: "pledge_recurring",
      entityId: recurring.id,
      entityNumber: recurring.pledge_number,
      action: "recurring_installment_generated",
      description: `Recurring installment generated for ${recurring.pledge_number}`,
      afterData: {
        recurring_id: recurring.id,
        pledge_id: recurring.pledge_id,
        amount: recurring.recurring_amount,
        next_run_date: nextRunDate,
      },
    }).catch(() => {});

    return {
      ok: true,
      recurring_id: recurring.id,
      pledge_id: recurring.pledge_id,
      generated: true,
      schedule,
      next_run_date: nextRunDate,
    };
  } catch (err) {
    await conn.rollback().catch(() => {});
    await recordRecurringFailure(recurringId, err.message);
    throw err;
  } finally {
    conn.release();
  }
}

/* =========================================================
   PROCESS DUE RECURRING PLEDGES
========================================================= */

async function processRecurringPledges(options = {}) {
  const conn = await pool.getConnection();

  try {
    await ensureRecurringTable(conn);

    const limit = Math.min(500, toInt(options.limit, 100));

    const [rows] = await conn.query(
      `
      SELECT *
      FROM tbl_finance_pledge_recurring
      WHERE status = 'active'
        AND auto_generate_schedule = 1
        AND next_run_date IS NOT NULL
        AND DATE(next_run_date) <= CURDATE()
      ORDER BY next_run_date ASC, id ASC
      LIMIT ?
      `,
      [limit]
    );

    const results = [];

    for (const row of rows) {
      try {
        const result = await generateNextInstallment(row.id, {
          actorId: options.actorId || null,
        });

        results.push({
          recurring_id: row.id,
          pledge_id: row.pledge_id,
          ok: true,
          result,
        });
      } catch (err) {
        results.push({
          recurring_id: row.id,
          pledge_id: row.pledge_id,
          ok: false,
          error: err.message,
        });
      }
    }

    return {
      ok: true,
      processed: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  } finally {
    conn.release();
  }
}

/* =========================================================
   FAILURE TRACKING
========================================================= */

async function recordRecurringFailure(recurringId, message) {
  const conn = await pool.getConnection();

  try {
    await ensureRecurringTable(conn);

    await conn.query(
      `
      UPDATE tbl_finance_pledge_recurring
      SET
        failure_count = COALESCE(failure_count, 0) + 1,
        last_failure_message = ?,
        last_processed_at = NOW(),
        status = CASE
          WHEN COALESCE(failure_count, 0) + 1 >= 5 THEN 'failed'
          ELSE status
        END,
        updated_at = NOW()
      WHERE id = ?
      `,
      [message || "Recurring processing failed.", recurringId]
    );
  } finally {
    conn.release();
  }
}

/* =========================================================
   KPI / SUMMARY
========================================================= */

async function getRecurringSummary(filters = {}) {
  const conn = await pool.getConnection();

  try {
    await ensureRecurringTable(conn);

    const where = [];
    const params = [];

    if (filters.campaign_id) {
      where.push("campaign_id = ?");
      params.push(filters.campaign_id);
    }

    if (filters.status) {
      where.push("status = ?");
      params.push(filters.status);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [[row]] = await conn.query(
      `
      SELECT
        COUNT(*) AS total_recurring,

        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) AS paused_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,

        COALESCE(SUM(CASE WHEN status = 'active' THEN recurring_amount ELSE 0 END), 0) AS active_recurring_amount,

        COALESCE(SUM(recurring_amount), 0) AS total_recurring_amount

      FROM tbl_finance_pledge_recurring

      ${whereSql}
      `,
      params
    );

    return {
      ok: true,
      summary: {
        total_recurring: Number(row.total_recurring || 0),
        active_count: Number(row.active_count || 0),
        paused_count: Number(row.paused_count || 0),
        cancelled_count: Number(row.cancelled_count || 0),
        completed_count: Number(row.completed_count || 0),
        failed_count: Number(row.failed_count || 0),
        active_recurring_amount: money(row.active_recurring_amount),
        total_recurring_amount: money(row.total_recurring_amount),
      },
    };
  } finally {
    conn.release();
  }
}

/* =========================================================
   FORECAST FROM RECURRING
========================================================= */

async function getRecurringForecast(options = {}) {
  const conn = await pool.getConnection();

  try {
    await ensureRecurringTable(conn);

    const months = Math.min(36, toInt(options.months, 12));

    const [rows] = await conn.query(
      `
      SELECT *
      FROM tbl_finance_pledge_recurring
      WHERE status = 'active'
        AND recurring_amount > 0
      `
    );

    const forecastMap = new Map();

    for (const row of rows) {
      let date = toDate(row.next_run_date || row.start_date || new Date());

      for (let i = 0; i < months; i += 1) {
        if (!date) break;

        if (row.end_date && date > toDate(row.end_date)) break;

        const monthKey = date.toISOString().slice(0, 7);

        const existing = forecastMap.get(monthKey) || {
          month: monthKey,
          recurring_count: 0,
          projected_amount: 0,
        };

        existing.recurring_count += 1;
        existing.projected_amount = money(
          existing.projected_amount + money(row.recurring_amount)
        );

        forecastMap.set(monthKey, existing);

        const nextDate = nextDateFromFrequency(date, row.frequency);
        if (!nextDate) break;
        date = toDate(nextDate);
      }
    }

    return {
      ok: true,
      rows: [...forecastMap.values()].sort((a, b) =>
        a.month.localeCompare(b.month)
      ),
    };
  } finally {
    conn.release();
  }
}

/* =========================================================
   FORMATTER
========================================================= */

function formatRecurringRow(row = {}) {
  return {
    ...row,
    recurring_amount: money(row.recurring_amount),
    completed_cycles: Number(row.completed_cycles || 0),
    total_cycles: row.total_cycles === null ? null : Number(row.total_cycles || 0),
    failure_count: Number(row.failure_count || 0),
    auto_generate_schedule:
      row.auto_generate_schedule === true ||
      Number(row.auto_generate_schedule || 0) === 1,
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  ensureRecurringTable,

  createRecurringPledge,
  getRecurringPledges,

  pauseRecurringPledge,
  resumeRecurringPledge,
  cancelRecurringPledge,

  generateNextInstallment,
  processRecurringPledges,
  recordRecurringFailure,

  getRecurringSummary,
  getRecurringForecast,
};