//backend\services\domains\finance\financeReminderScheduleService.js
"use strict";

const pool = require("../../../db");

function normalizeFrequency(value = "") {
  const v = String(value || "").toLowerCase();

  if (v === "weekly") return "weekly";
  if (v === "biweekly") return "biweekly";
  if (v === "monthly") return "monthly";

  return "monthly";
}

function calculateNextRunDate(frequency, currentDate = new Date()) {
  const next = new Date(currentDate);

  switch (normalizeFrequency(frequency)) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "biweekly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }

  return next;
}

function requireValue(value, message) {
  if (value === undefined || value === null || String(value).trim() === "") {
    const err = new Error(message);
    err.status = 400;
    throw err;
  }
}

function normalizeId(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function dateOnly(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

async function createSchedule(payload = {}) {
  requireValue(payload.schedule_name, "Schedule name is required.");
  requireValue(payload.frequency, "Frequency is required.");
  requireValue(payload.start_date, "Start date is required.");
  requireValue(payload.email_subject, "Email subject is required.");
  requireValue(payload.email_template, "Email template is required.");

  const [result] = await pool.query(
    `
    INSERT INTO tbl_finance_reminder_schedules
    (
      schedule_name,
      frequency,
      campaign_id,
      start_date,
      end_date,
      email_subject,
      email_template,
      active,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      String(payload.schedule_name).trim(),
      normalizeFrequency(payload.frequency),
      normalizeId(payload.campaign_id),
      dateOnly(payload.start_date),
      dateOnly(payload.end_date),
      String(payload.email_subject || "").trim(),
      String(payload.email_template || "").trim(),
      payload.active === 0 || payload.active === false ? 0 : 1,
      normalizeId(payload.created_by),
    ]
  );

  return {
    ok: true,
    id: result.insertId,
  };
}

async function updateSchedule(id, payload = {}) {
  requireValue(id, "Schedule id is required.");
  requireValue(payload.schedule_name, "Schedule name is required.");
  requireValue(payload.frequency, "Frequency is required.");
  requireValue(payload.start_date, "Start date is required.");
  requireValue(payload.email_subject, "Email subject is required.");
  requireValue(payload.email_template, "Email template is required.");

  const [result] = await pool.query(
    `
    UPDATE tbl_finance_reminder_schedules
    SET
      schedule_name = ?,
      frequency = ?,
      campaign_id = ?,
      start_date = ?,
      end_date = ?,
      email_subject = ?,
      email_template = ?,
      updated_at = NOW()
    WHERE id = ?
    `,
    [
      String(payload.schedule_name).trim(),
      normalizeFrequency(payload.frequency),
      normalizeId(payload.campaign_id),
      dateOnly(payload.start_date),
      dateOnly(payload.end_date),
      String(payload.email_subject || "").trim(),
      String(payload.email_template || "").trim(),
      normalizeId(id),
    ]
  );

  if (!result.affectedRows) {
    const err = new Error("Reminder schedule not found.");
    err.status = 404;
    throw err;
  }

  return { ok: true };
}

async function setScheduleStatus(id, active = true) {
  const [result] = await pool.query(
    `
    UPDATE tbl_finance_reminder_schedules
    SET active = ?, updated_at = NOW()
    WHERE id = ?
    `,
    [active ? 1 : 0, normalizeId(id)]
  );

  if (!result.affectedRows) {
    const err = new Error("Reminder schedule not found.");
    err.status = 404;
    throw err;
  }

  return { ok: true };
}

async function deleteSchedule(id) {
  const scheduleId = normalizeId(id);

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      `
      DELETE FROM tbl_finance_reminder_schedule_runs
      WHERE schedule_id = ?
      `,
      [scheduleId]
    );

    const [result] = await conn.query(
      `
      DELETE FROM tbl_finance_reminder_schedules
      WHERE id = ?
      `,
      [scheduleId]
    );

    if (!result.affectedRows) {
      const err = new Error("Reminder schedule not found.");
      err.status = 404;
      throw err;
    }

    await conn.commit();

    return { ok: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getScheduleById(id) {
  const [rows] = await pool.query(
    `
    SELECT
      s.*,

      MAX(r.run_date) AS last_run_at,

      COALESCE(SUM(r.emails_sent), 0) AS total_emails_sent,

      COALESCE(SUM(r.emails_failed), 0) AS total_emails_failed,

      COUNT(r.id) AS total_runs

    FROM tbl_finance_reminder_schedules s
    LEFT JOIN tbl_finance_reminder_schedule_runs r
      ON r.schedule_id = s.id
    WHERE s.id = ?
    GROUP BY s.id
    LIMIT 1
    `,
    [normalizeId(id)]
  );

  return rows[0] || null;
}

async function getSchedules() {
  const [rows] = await pool.query(`
    SELECT
      s.*,

      MAX(r.run_date) AS last_run_at,

      COALESCE(SUM(r.emails_sent), 0) AS total_emails_sent,

      COALESCE(SUM(r.emails_failed), 0) AS total_emails_failed,

      COUNT(r.id) AS total_runs

    FROM tbl_finance_reminder_schedules s
    LEFT JOIN tbl_finance_reminder_schedule_runs r
      ON r.schedule_id = s.id
    GROUP BY s.id
    ORDER BY s.id DESC
  `);

  return rows;
}

async function getScheduleRuns(scheduleId, limit = 50) {
  const [rows] = await pool.query(
    `
    SELECT *
    FROM tbl_finance_reminder_schedule_runs
    WHERE schedule_id = ?
    ORDER BY run_date DESC
    LIMIT ?
    `,
    [
      normalizeId(scheduleId),
      Math.min(Math.max(Number(limit) || 50, 1), 200),
    ]
  );

  return rows;
}

async function getDueSchedules() {
  const [rows] = await pool.query(`
    SELECT *
    FROM tbl_finance_reminder_schedules
    WHERE active = 1
      AND start_date <= CURDATE()
      AND (
        end_date IS NULL
        OR end_date >= CURDATE()
      )
    ORDER BY id ASC
  `);

  return rows;
}

module.exports = {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  setScheduleStatus,
  getScheduleById,
  getSchedules,
  getScheduleRuns,
  getDueSchedules,
  calculateNextRunDate,
};