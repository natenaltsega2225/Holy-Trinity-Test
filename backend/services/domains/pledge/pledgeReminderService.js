// backend/services/domains/pledge/pledgeReminderService.js
// backend/services/domains/pledge/pledgeReminderService.js

"use strict";

const pool = require("../../../db");

let sendEmail = null;

try {
  ({ sendEmail } = require("../../emailService"));
} catch {
  sendEmail = null;
}

const {
  logReminderSent,
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

function formatMoney(value) {
  return `$${money(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeEmail(value) {
  const email = clean(value).toLowerCase();
  return email || null;
}

function defaultSubject(pledge = {}) {
  return `Pledge Reminder - ${pledge.campaign_name || "Holy Trinity"}`;
}

function defaultMessage(pledge = {}) {
  const name =
    pledge.full_name_snapshot ||
    pledge.full_name ||
    "Donor";

  return `
Dear ${name},

This is a friendly reminder regarding your pledge commitment.

Campaign: ${pledge.campaign_name || "Pledge Campaign"}
Pledge Number: ${pledge.pledge_number || "--"}
Pledged Amount: ${formatMoney(pledge.pledged_amount)}
Paid Amount: ${formatMoney(pledge.paid_amount)}
Remaining Balance: ${formatMoney(pledge.remaining_balance)}
Due Date: ${pledge.due_date || "--"}

Thank you for your faithful support.

Holy Trinity Finance Office
  `.trim();
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
   LOAD PLEDGE
========================================================= */

async function getPledgeById(conn, pledgeId) {
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
   CREATE REMINDER LOG
========================================================= */

async function createReminderLog(conn, payload = {}) {
  if (!(await tableExists(conn, "tbl_finance_pledge_reminders"))) {
    return null;
  }

  return insertDynamic(
    conn,
    "tbl_finance_pledge_reminders",
    {
      pledge_id: payload.pledge_id,
      pledge_number: payload.pledge_number || null,

      reminder_type: payload.reminder_type || "email",

      email_to: payload.email_to || null,
      subject: payload.subject || null,
      message: payload.message || null,

      status: payload.status || "queued",
      sent_at: payload.sent_at || null,
      error_message: payload.error_message || null,

      created_by: payload.created_by || null,
      created_at: new Date(),
      updated_at: new Date(),
    }
  );
}

/* =========================================================
   SEND REMINDER
========================================================= */

async function sendPledgeReminder({
  pledgeId,
  email = null,
  subject = null,
  message = null,
  user = {},
  requestInfo = {},
} = {}) {
  const conn = await pool.getConnection();

  try {
    const pledge = await getPledgeById(conn, pledgeId);

    if (!pledge) {
      throw new Error("Pledge not found.");
    }

    if (["paid", "written_off", "cancelled"].includes(String(pledge.status))) {
      throw new Error("This pledge is closed and cannot receive reminders.");
    }

    const recipient =
      normalizeEmail(email) ||
      normalizeEmail(pledge.email_snapshot) ||
      normalizeEmail(pledge.email);

    if (!recipient) {
      throw new Error("Pledge donor email is missing.");
    }

    const finalSubject = subject || defaultSubject(pledge);
    const finalMessage = message || defaultMessage(pledge);

    let status = "sent";
    let errorMessage = null;
    let reminderId = null;

    reminderId = await createReminderLog(conn, {
      pledge_id: pledge.id,
      pledge_number: pledge.pledge_number,
      reminder_type: "email",
      email_to: recipient,
      subject: finalSubject,
      message: finalMessage,
      status: "queued",
      created_by: user.id || user.user_id || null,
    });

    try {
      if (sendEmail) {
        await sendEmail({
          to: recipient,
          subject: finalSubject,
          text: finalMessage,
          html: finalMessage.replace(/\n/g, "<br />"),
        });
      } else {
        console.warn(
          "sendEmail service not available; reminder marked as recorded."
        );
      }
    } catch (err) {
      status = "failed";
      errorMessage = err.message || "Failed to send reminder email.";
    }

    if (reminderId) {
      await updateDynamic(
        conn,
        "tbl_finance_pledge_reminders",
        {
          status,
          sent_at: status === "sent" ? new Date() : null,
          error_message: errorMessage,
          updated_at: new Date(),
        },
        "id = ?",
        [reminderId]
      );
    }

    await updateDynamic(
      conn,
      "tbl_finance_pledges",
      {
        last_reminder_sent_at: new Date(),
        last_reminder_subject: finalSubject,
        last_reminder_message: finalMessage,
        updated_at: new Date(),
      },
      "id = ?",
      [pledge.id]
    );

    await logReminderSent({
      pledge,
      email: recipient,
      subject: finalSubject,
      status,
      user,
      requestInfo,
    }).catch(() => {});

    if (status === "failed") {
      throw new Error(errorMessage);
    }

    return {
      ok: true,
      reminder_id: reminderId,
      status,
      email_to: recipient,
      subject: finalSubject,
    };
  } finally {
    conn.release();
  }
}

/* =========================================================
   REMINDER HISTORY
========================================================= */

async function getReminderHistory(pledgeId, options = {}) {
  const conn = await pool.getConnection();

  try {
    if (!(await tableExists(conn, "tbl_finance_pledge_reminders"))) {
      return {
        ok: true,
        rows: [],
        pagination: {
          page: 1,
          limit: 25,
          total: 0,
          pages: 1,
        },
      };
    }

    const page = toInt(options.page, 1);
    const limit = Math.min(
      100,
      toInt(options.limit || options.pageSize, 25)
    );
    const offset = (page - 1) * limit;

    const [[countRow]] = await conn.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_finance_pledge_reminders
      WHERE pledge_id = ?
      `,
      [pledgeId]
    );

    const [rows] = await conn.query(
      `
      SELECT *
      FROM tbl_finance_pledge_reminders
      WHERE pledge_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
      OFFSET ?
      `,
      [pledgeId, limit, offset]
    );

    return {
      ok: true,
      rows,
      pagination: {
        page,
        limit,
        total: Number(countRow.total || 0),
        pages: Math.max(
          1,
          Math.ceil(Number(countRow.total || 0) / limit)
        ),
      },
    };
  } finally {
    conn.release();
  }
}

/* =========================================================
   REMINDER STATS
========================================================= */

async function getReminderStats(filters = {}) {
  const conn = await pool.getConnection();

  try {
    if (!(await tableExists(conn, "tbl_finance_pledge_reminders"))) {
      return {
        ok: true,
        summary: {
          total: 0,
          sent: 0,
          failed: 0,
          queued: 0,
          today: 0,
          this_month: 0,
        },
      };
    }

    const params = [];
    const where = [];

    if (filters.date_from) {
      where.push("DATE(created_at) >= DATE(?)");
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      where.push("DATE(created_at) <= DATE(?)");
      params.push(filters.date_to);
    }

    if (filters.status) {
      where.push("status = ?");
      params.push(filters.status);
    }

    const whereSql = where.length
      ? `WHERE ${where.join(" AND ")}`
      : "";

    const [[summary]] = await conn.query(
      `
      SELECT
        COUNT(*) AS total,

        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) AS queued,

        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today,

        SUM(
          CASE
            WHEN YEAR(created_at) = YEAR(CURDATE())
              AND MONTH(created_at) = MONTH(CURDATE())
            THEN 1
            ELSE 0
          END
        ) AS this_month

      FROM tbl_finance_pledge_reminders

      ${whereSql}
      `,
      params
    );

    return {
      ok: true,
      summary: {
        total: Number(summary.total || 0),
        sent: Number(summary.sent || 0),
        failed: Number(summary.failed || 0),
        queued: Number(summary.queued || 0),
        today: Number(summary.today || 0),
        this_month: Number(summary.this_month || 0),
      },
    };
  } finally {
    conn.release();
  }
}

/* =========================================================
   AUTO REMINDER CANDIDATES
========================================================= */

async function getReminderCandidates(options = {}) {
  const conn = await pool.getConnection();

  try {
    const daysPastDue = toInt(options.daysPastDue, 0);
    const limit = Math.min(500, toInt(options.limit, 100));

    const [rows] = await conn.query(
      `
      SELECT *
      FROM tbl_finance_pledges
      WHERE status IN ('receivable', 'partial', 'invoiced')
        AND remaining_balance > 0
        AND email_snapshot IS NOT NULL
        AND email_snapshot <> ''
        AND due_date IS NOT NULL
        AND DATE(due_date) <= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND (
          last_reminder_sent_at IS NULL
          OR DATE(last_reminder_sent_at) <= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        )
      ORDER BY due_date ASC, id ASC
      LIMIT ?
      `,
      [daysPastDue, limit]
    );

    return {
      ok: true,
      rows,
    };
  } finally {
    conn.release();
  }
}

/* =========================================================
   AUTO REMINDER PROCESSOR
========================================================= */

async function processAutoReminders(options = {}) {
  const candidates = await getReminderCandidates(options);

  const results = [];

  for (const pledge of candidates.rows) {
    try {
      const result = await sendPledgeReminder({
        pledgeId: pledge.id,
        user: options.user || {
          id: null,
          name: "System",
          role: "system",
        },
      });

      results.push({
        pledge_id: pledge.id,
        pledge_number: pledge.pledge_number,
        ok: true,
        result,
      });
    } catch (err) {
      results.push({
        pledge_id: pledge.id,
        pledge_number: pledge.pledge_number,
        ok: false,
        error: err.message,
      });
    }
  }

  return {
    ok: true,
    processed: results.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  sendPledgeReminder,
  createReminderLog,
  getReminderHistory,
  getReminderStats,
  getReminderCandidates,
  processAutoReminders,
};