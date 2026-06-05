// backend\services\domains\pledges\pledgeScheduleService.js
// backend/services/domains/pledge/pledgeScheduleService.js

"use strict";

const pool = require("../../../db");

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

  if (Number.isNaN(d.getTime())) return null;

  return d;
}

function mysqlDate(value) {
  const d = toDate(value);

  if (!d) return null;

  return d.toISOString().slice(0, 10);
}

function addMonths(dateValue, count) {
  const d = toDate(dateValue) || new Date();
  const next = new Date(d);
  next.setMonth(next.getMonth() + Number(count || 0));
  return next;
}

function addDays(dateValue, count) {
  const d = toDate(dateValue) || new Date();
  const next = new Date(d);
  next.setDate(next.getDate() + Number(count || 0));
  return next;
}

function normalizeFrequency(value) {
  const v = clean(value).toLowerCase();

  if (["weekly", "week"].includes(v)) return "weekly";
  if (["biweekly", "bi_weekly", "every_2_weeks"].includes(v)) return "biweekly";
  if (["monthly", "month"].includes(v)) return "monthly";
  if (["quarterly", "quarter"].includes(v)) return "quarterly";
  if (["semiannual", "semi_annual", "half_year"].includes(v)) return "semiannual";
  if (["annual", "yearly", "year"].includes(v)) return "annual";

  return "one_time";
}

function intervalForFrequency(frequency) {
  const f = normalizeFrequency(frequency);

  if (f === "weekly") return { unit: "day", count: 7 };
  if (f === "biweekly") return { unit: "day", count: 14 };
  if (f === "monthly") return { unit: "month", count: 1 };
  if (f === "quarterly") return { unit: "month", count: 3 };
  if (f === "semiannual") return { unit: "month", count: 6 };
  if (f === "annual") return { unit: "month", count: 12 };

  return { unit: "none", count: 0 };
}

function installmentsForFrequency(frequency, fallback = 1) {
  const f = normalizeFrequency(frequency);

  if (f === "weekly") return 52;
  if (f === "biweekly") return 26;
  if (f === "monthly") return 12;
  if (f === "quarterly") return 4;
  if (f === "semiannual") return 2;
  if (f === "annual") return 1;

  return toInt(fallback, 1);
}

async function tableExists(conn, tableName) {
  if (tableCache.has(tableName)) {
    return tableCache.get(tableName);
  }

  try {
    const [rows] = await conn.query(
      `SHOW TABLES LIKE ?`,
      [tableName]
    );

    const exists = rows.length > 0;

    tableCache.set(tableName, exists);

    return exists;
  } catch {
    tableCache.set(tableName, false);
    return false;
  }
}

async function getColumns(conn, tableName) {
  if (columnCache.has(tableName)) {
    return columnCache.get(tableName);
  }

  const exists = await tableExists(conn, tableName);

  if (!exists) {
    const empty = new Set();
    columnCache.set(tableName, empty);
    return empty;
  }

  const [rows] = await conn.query(
    `SHOW COLUMNS FROM \`${tableName}\``
  );

  const cols = new Set(rows.map((r) => r.Field));

  columnCache.set(tableName, cols);

  return cols;
}

async function insertDynamic(conn, tableName, data) {
  const cols = await getColumns(conn, tableName);

  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) {
    return null;
  }

  const fields = entries
    .map(([key]) => `\`${key}\``)
    .join(", ");

  const marks = entries
    .map(() => "?")
    .join(", ");

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

  const setSql = entries
    .map(([key]) => `\`${key}\` = ?`)
    .join(", ");

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

async function ensureScheduleTable(conn) {
  if (await tableExists(conn, "tbl_finance_pledge_schedule")) {
    return true;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS tbl_finance_pledge_schedule (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

      pledge_id BIGINT UNSIGNED NOT NULL,
      pledge_number VARCHAR(80) NULL,

      campaign_id BIGINT NULL,
      campaign_name VARCHAR(255) NULL,

      member_id BIGINT NULL,
      member_no VARCHAR(80) NULL,

      full_name_snapshot VARCHAR(255) NULL,
      email_snapshot VARCHAR(255) NULL,

      installment_number INT NOT NULL DEFAULT 1,
      total_installments INT NOT NULL DEFAULT 1,

      due_date DATE NOT NULL,

      amount_due DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      balance_due DECIMAL(12,2) NOT NULL DEFAULT 0.00,

      status VARCHAR(40) NOT NULL DEFAULT 'pending',

      invoice_id BIGINT NULL,
      invoice_number VARCHAR(80) NULL,

      payment_id BIGINT NULL,
      payment_number VARCHAR(80) NULL,

      receipt_id BIGINT NULL,
      receipt_number VARCHAR(80) NULL,

      paid_at DATETIME NULL,
      reminder_sent_at DATETIME NULL,

      notes TEXT NULL,

      created_by BIGINT NULL,
      updated_by BIGINT NULL,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_pledge_schedule_pledge (pledge_id),
      INDEX idx_pledge_schedule_due_date (due_date),
      INDEX idx_pledge_schedule_status (status),
      INDEX idx_pledge_schedule_campaign (campaign_id),
      INDEX idx_pledge_schedule_member (member_id)
    )
  `);

  tableCache.set("tbl_finance_pledge_schedule", true);
  columnCache.delete("tbl_finance_pledge_schedule");

  return true;
}

/* =========================================================
   PLEDGE LOADER
========================================================= */

async function getPledge(conn, pledgeId) {
  const [[pledge]] = await conn.query(
    `
    SELECT *
    FROM tbl_finance_pledges
    WHERE id = ?
    LIMIT 1
    `,
    [pledgeId]
  );

  return pledge || null;
}

/* =========================================================
   INSTALLMENT BUILDER
========================================================= */

function buildInstallments({
  pledge,
  startDate,
  frequency,
  installmentCount,
  amount,
}) {
  const count = Math.max(1, toInt(installmentCount, 1));
  const total = money(amount);
  const base = money(total / count);
  const rows = [];
  const interval = intervalForFrequency(frequency);

  let allocated = 0;

  for (let i = 1; i <= count; i += 1) {
    const isLast = i === count;

    const installmentAmount = isLast
      ? money(total - allocated)
      : base;

    allocated = money(allocated + installmentAmount);

    let dueDate = toDate(startDate) || new Date();

    if (interval.unit === "day") {
      dueDate = addDays(dueDate, (i - 1) * interval.count);
    } else if (interval.unit === "month") {
      dueDate = addMonths(dueDate, (i - 1) * interval.count);
    }

    rows.push({
      pledge_id: pledge.id,
      pledge_number: pledge.pledge_number || null,

      campaign_id: pledge.campaign_id || null,
      campaign_name: pledge.campaign_name || null,

      member_id: pledge.member_id || null,
      member_no: pledge.member_no || null,

      full_name_snapshot: pledge.full_name_snapshot || "Guest Donor",
      email_snapshot: pledge.email_snapshot || null,

      installment_number: i,
      total_installments: count,

      due_date: mysqlDate(dueDate),

      amount_due: installmentAmount,
      amount_paid: 0,
      balance_due: installmentAmount,

      status: "pending",
    });
  }

  return rows;
}

/* =========================================================
   CREATE / REBUILD SCHEDULE
========================================================= */

async function createPaymentSchedule({
  pledgeId,
  startDate = null,
  frequency = null,
  installmentCount = null,
  amount = null,
  replaceExisting = true,
  actorId = null,
  notes = null,
} = {}) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await ensureScheduleTable(conn);

    const pledge = await getPledge(conn, pledgeId);

    if (!pledge) {
      throw new Error("Pledge not found.");
    }

    if (["paid", "written_off", "cancelled"].includes(String(pledge.status))) {
      throw new Error("Closed pledges cannot receive a new schedule.");
    }

    const remaining =
      amount !== null && amount !== undefined
        ? money(amount)
        : money(pledge.remaining_balance);

    if (remaining <= 0) {
      throw new Error("Schedule amount must be greater than zero.");
    }

    const finalFrequency =
      normalizeFrequency(frequency || pledge.frequency || "one_time");

    const finalInstallments =
      installmentCount ||
      installmentsForFrequency(finalFrequency, 1);

    const finalStartDate =
      startDate ||
      pledge.due_date ||
      new Date();

    if (replaceExisting) {
      await conn.query(
        `
        DELETE FROM tbl_finance_pledge_schedule
        WHERE pledge_id = ?
          AND status IN ('pending', 'overdue', 'partial')
        `,
        [pledge.id]
      );
    }

    const scheduleRows = buildInstallments({
      pledge,
      startDate: finalStartDate,
      frequency: finalFrequency,
      installmentCount: finalInstallments,
      amount: remaining,
    });

    const inserted = [];

    for (const row of scheduleRows) {
      const id = await insertDynamic(
        conn,
        "tbl_finance_pledge_schedule",
        {
          ...row,
          notes,
          created_by: actorId,
          updated_by: actorId,
          created_at: new Date(),
          updated_at: new Date(),
        }
      );

      inserted.push({
        id,
        ...row,
      });
    }

    await updateDynamic(
      conn,
      "tbl_finance_pledges",
      {
        frequency: finalFrequency,
        due_date: scheduleRows[0]?.due_date || pledge.due_date,
        reminder_date: scheduleRows[0]?.due_date || pledge.reminder_date,
        updated_by: actorId,
        updated_at: new Date(),
      },
      "id = ?",
      [pledge.id]
    );

    await conn.commit();

    await createAuditLog({
      actorId,
      entityType: "pledge_schedule",
      entityId: pledge.id,
      entityNumber: pledge.pledge_number,
      action: "pledge_schedule_created",
      description: `Payment schedule created for pledge ${pledge.pledge_number}`,
      afterData: {
        pledge_id: pledge.id,
        frequency: finalFrequency,
        installment_count: inserted.length,
        amount: remaining,
      },
    }).catch(() => {});

    return {
      ok: true,
      pledge_id: pledge.id,
      pledge_number: pledge.pledge_number,
      frequency: finalFrequency,
      installment_count: inserted.length,
      rows: inserted,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* =========================================================
   GET SCHEDULE
========================================================= */

async function getPledgeSchedule(pledgeId, options = {}) {
  const conn = await pool.getConnection();

  try {
    await ensureScheduleTable(conn);

    const status = clean(options.status);

    const where = ["pledge_id = ?"];
    const params = [pledgeId];

    if (status) {
      where.push("status = ?");
      params.push(status);
    }

    const [rows] = await conn.query(
      `
      SELECT *
      FROM tbl_finance_pledge_schedule
      WHERE ${where.join(" AND ")}
      ORDER BY installment_number ASC, due_date ASC, id ASC
      `,
      params
    );

    return {
      ok: true,
      rows: rows.map(formatScheduleRow),
      summary: summarizeSchedule(rows),
    };
  } finally {
    conn.release();
  }
}

/* =========================================================
   UPCOMING / DUE SCHEDULES
========================================================= */

async function getUpcomingPayments(options = {}) {
  const conn = await pool.getConnection();

  try {
    await ensureScheduleTable(conn);

    const daysAhead = toInt(options.daysAhead, 30);
    const limit = Math.min(500, toInt(options.limit, 100));

    const [rows] = await conn.query(
      `
      SELECT *
      FROM tbl_finance_pledge_schedule
      WHERE status IN ('pending', 'partial', 'overdue')
        AND due_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY due_date ASC, amount_due DESC
      LIMIT ?
      `,
      [daysAhead, limit]
    );

    return {
      ok: true,
      rows: rows.map(formatScheduleRow),
    };
  } finally {
    conn.release();
  }
}

async function getOverdueScheduleItems(options = {}) {
  const conn = await pool.getConnection();

  try {
    await ensureScheduleTable(conn);

    const limit = Math.min(500, toInt(options.limit, 100));

    const [rows] = await conn.query(
      `
      SELECT *
      FROM tbl_finance_pledge_schedule
      WHERE status IN ('pending', 'partial', 'overdue')
        AND due_date < CURDATE()
        AND balance_due > 0
      ORDER BY due_date ASC, balance_due DESC
      LIMIT ?
      `,
      [limit]
    );

    return {
      ok: true,
      rows: rows.map(formatScheduleRow),
    };
  } finally {
    conn.release();
  }
}

/* =========================================================
   MARK OVERDUE
========================================================= */

async function markOverdueScheduleItems(options = {}) {
  const conn = await pool.getConnection();

  try {
    await ensureScheduleTable(conn);

    const limit = Math.min(1000, toInt(options.limit, 500));

    const [result] = await conn.query(
      `
      UPDATE tbl_finance_pledge_schedule
      SET
        status = 'overdue',
        updated_at = NOW()
      WHERE status IN ('pending', 'partial')
        AND due_date < CURDATE()
        AND balance_due > 0
      LIMIT ?
      `,
      [limit]
    );

    return {
      ok: true,
      updated: result.affectedRows || 0,
    };
  } finally {
    conn.release();
  }
}

/* =========================================================
   APPLY PAYMENT TO SCHEDULE
========================================================= */

async function applyPaymentToSchedule({
  pledgeId,
  paymentId = null,
  paymentNumber = null,
  receiptId = null,
  receiptNumber = null,
  invoiceId = null,
  invoiceNumber = null,
  amount,
  actorId = null,
} = {}) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await ensureScheduleTable(conn);

    let remainingPayment = money(amount);

    if (remainingPayment <= 0) {
      throw new Error("Schedule payment amount must be greater than zero.");
    }

    const [items] = await conn.query(
      `
      SELECT *
      FROM tbl_finance_pledge_schedule
      WHERE pledge_id = ?
        AND status IN ('pending', 'partial', 'overdue')
        AND balance_due > 0
      ORDER BY due_date ASC, installment_number ASC, id ASC
      FOR UPDATE
      `,
      [pledgeId]
    );

    const applied = [];

    for (const item of items) {
      if (remainingPayment <= 0) break;

      const balance = money(item.balance_due);
      const applyAmount = Math.min(balance, remainingPayment);
      const newPaid = money(Number(item.amount_paid || 0) + applyAmount);
      const newBalance = money(Number(item.amount_due || 0) - newPaid);

      const nextStatus =
        newBalance <= 0
          ? "paid"
          : "partial";

      await updateDynamic(
        conn,
        "tbl_finance_pledge_schedule",
        {
          amount_paid: newPaid,
          balance_due: newBalance,
          status: nextStatus,
          payment_id: paymentId,
          payment_number: paymentNumber,
          receipt_id: receiptId,
          receipt_number: receiptNumber,
          invoice_id: invoiceId,
          invoice_number: invoiceNumber,
          paid_at: nextStatus === "paid" ? new Date() : null,
          updated_by: actorId,
          updated_at: new Date(),
        },
        "id = ?",
        [item.id]
      );

      remainingPayment = money(remainingPayment - applyAmount);

      applied.push({
        schedule_id: item.id,
        applied_amount: money(applyAmount),
        balance_due: newBalance,
        status: nextStatus,
      });
    }

    await conn.commit();

    await createAuditLog({
      actorId,
      entityType: "pledge_schedule",
      entityId: pledgeId,
      action: "pledge_schedule_payment_applied",
      description: "Payment applied to pledge schedule.",
      afterData: {
        pledge_id: pledgeId,
        payment_id: paymentId,
        payment_number: paymentNumber,
        applied,
      },
    }).catch(() => {});

    return {
      ok: true,
      applied,
      unapplied_amount: remainingPayment,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* =========================================================
   PROCESS SCHEDULE HEALTH
========================================================= */

async function processSchedule(options = {}) {
  const overdue = await markOverdueScheduleItems(options);

  const upcoming = await getUpcomingPayments({
    daysAhead: options.daysAhead || 30,
    limit: options.limit || 100,
  });

  return {
    ok: true,
    overdue_updated: overdue.updated,
    upcoming: upcoming.rows,
  };
}

/* =========================================================
   CANCEL SCHEDULE
========================================================= */

async function cancelSchedule(pledgeId, options = {}) {
  const conn = await pool.getConnection();

  try {
    await ensureScheduleTable(conn);

    const [result] = await conn.query(
      `
      UPDATE tbl_finance_pledge_schedule
      SET
        status = 'cancelled',
        notes = COALESCE(?, notes),
        updated_by = ?,
        updated_at = NOW()
      WHERE pledge_id = ?
        AND status IN ('pending', 'partial', 'overdue')
      `,
      [
        options.reason || "Schedule cancelled.",
        options.actorId || null,
        pledgeId,
      ]
    );

    await createAuditLog({
      actorId: options.actorId || null,
      entityType: "pledge_schedule",
      entityId: pledgeId,
      action: "pledge_schedule_cancelled",
      description: `Payment schedule cancelled for pledge ${pledgeId}`,
      metadata: {
        reason: options.reason || null,
        affected_rows: result.affectedRows || 0,
      },
    }).catch(() => {});

    return {
      ok: true,
      cancelled: result.affectedRows || 0,
    };
  } finally {
    conn.release();
  }
}

/* =========================================================
   FORMATTERS
========================================================= */

function formatScheduleRow(row = {}) {
  return {
    ...row,
    amount_due: money(row.amount_due),
    amount_paid: money(row.amount_paid),
    balance_due: money(row.balance_due),
    installment_number: Number(row.installment_number || 0),
    total_installments: Number(row.total_installments || 0),
  };
}

function summarizeSchedule(rows = []) {
  const totalDue = rows.reduce(
    (sum, row) => sum + money(row.amount_due),
    0
  );

  const totalPaid = rows.reduce(
    (sum, row) => sum + money(row.amount_paid),
    0
  );

  const balanceDue = rows.reduce(
    (sum, row) => sum + money(row.balance_due),
    0
  );

  return {
    installment_count: rows.length,
    total_due: money(totalDue),
    total_paid: money(totalPaid),
    balance_due: money(balanceDue),
    paid_count: rows.filter((r) => r.status === "paid").length,
    pending_count: rows.filter((r) => r.status === "pending").length,
    partial_count: rows.filter((r) => r.status === "partial").length,
    overdue_count: rows.filter((r) => r.status === "overdue").length,
    cancelled_count: rows.filter((r) => r.status === "cancelled").length,
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  ensureScheduleTable,

  createPaymentSchedule,
  getPledgeSchedule,

  getUpcomingPayments,
  getOverdueScheduleItems,

  markOverdueScheduleItems,
  applyPaymentToSchedule,
  processSchedule,
  cancelSchedule,

  normalizeFrequency,
  installmentsForFrequency,
};