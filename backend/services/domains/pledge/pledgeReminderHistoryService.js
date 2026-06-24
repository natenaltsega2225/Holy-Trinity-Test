//backend\services\domains\pledge\pledgeReminderHistoryService.js
"use strict";

const crypto = require("crypto");
const pool = require("../../../db");

const HISTORY_TABLES = [
  "tbl_finance_pledge_reminder_history",
  "tbl_pledge_reminder_history",
];

const tableCache = new Map();
const columnCache = new Map();

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeEmail(value) {
  return clean(value, 190).toLowerCase();
}

function toInt(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function mysqlDateTime(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return mysqlDateTime(new Date());
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function toJson(value) {
  if (value === undefined) return null;
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value ?? null);
  } catch {
    return null;
  }
}

function normalizeStatus(value) {
  const status = clean(value, 40).toLowerCase();

  if (["queued", "pending"].includes(status)) return "queued";
  if (["sent", "send", "success", "successful"].includes(status)) return "sent";
  if (["skipped", "skip", "suppressed"].includes(status)) return "skipped";
  if (["failed", "failure", "error"].includes(status)) return "failed";

  return status || "queued";
}

async function tableExists(conn, tableName) {
  if (tableCache.has(tableName)) return tableCache.get(tableName);

  const [rows] = await conn.query("SHOW TABLES LIKE ?", [tableName]);
  const exists = rows.length > 0;

  tableCache.set(tableName, exists);
  return exists;
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
  const cols = new Set(rows.map((row) => row.Field));

  columnCache.set(tableName, cols);
  return cols;
}

async function resolveHistoryTable(conn) {
  for (const tableName of HISTORY_TABLES) {
    if (await tableExists(conn, tableName)) return tableName;
  }

  return null;
}

async function insertExistingColumns(conn, tableName, data) {
  const cols = await getColumns(conn, tableName);

  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) return null;

  const fields = entries.map(([key]) => `\`${key}\``).join(", ");
  const placeholders = entries.map(() => "?").join(", ");
  const values = entries.map(([, value]) => value);

  const [result] = await conn.query(
    `INSERT INTO \`${tableName}\` (${fields}) VALUES (${placeholders})`,
    values
  );

  return result.insertId;
}

async function updateExistingColumns(conn, tableName, data, whereSql, whereParams) {
  const cols = await getColumns(conn, tableName);

  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) return 0;

  const setSql = entries.map(([key]) => `\`${key}\` = ?`).join(", ");
  const values = entries.map(([, value]) => value);

  const [result] = await conn.query(
    `UPDATE \`${tableName}\` SET ${setSql} WHERE ${whereSql}`,
    [...values, ...whereParams]
  );

  return result.affectedRows || 0;
}

function dateColumn(cols) {
  if (cols.has("created_at")) return "created_at";
  if (cols.has("sent_at")) return "sent_at";
  if (cols.has("occurred_at")) return "occurred_at";
  if (cols.has("updated_at")) return "updated_at";
  return "id";
}

function orderBySql(cols) {
  const candidates = ["updated_at", "created_at", "sent_at", "occurred_at"].filter((c) =>
    cols.has(c)
  );

  if (!candidates.length) return "id DESC";

  return `COALESCE(${candidates.map((c) => `\`${c}\``).join(", ")}) DESC, id DESC`;
}

async function createReminderHistoryRecord(input = {}) {
  const conn = await pool.getConnection();

  try {
    const tableName = await resolveHistoryTable(conn);

    if (!tableName) {
      return {
        ok: false,
        skipped: true,
        error: "No pledge reminder history table exists.",
      };
    }

    const status = normalizeStatus(input.status || "queued");
    const now = mysqlDateTime(input.createdAt || new Date());
    const reminderUuid = input.reminder_uuid || input.reminderId || crypto.randomUUID();

    const id = await insertExistingColumns(conn, tableName, {
      reminder_uuid: reminderUuid,
      reminder_id: reminderUuid,
      pledge_id: input.pledge_id || input.pledgeId || null,
      member_id: input.member_id || input.memberId || null,
      campaign_id: input.campaign_id || input.campaignId || null,
      tracking_id: input.tracking_id || input.trackingId || null,

      reminder_type: clean(input.reminder_type || input.reminderType || "manual", 80),
      channel: clean(input.channel || "email", 40),
      status,

      recipient_email: normalizeEmail(input.recipient_email || input.email || input.to),
      email: normalizeEmail(input.recipient_email || input.email || input.to),
      subject: clean(input.subject, 255) || null,
      message_id: clean(input.message_id || input.messageId, 190) || null,

      amount_due: input.amount_due ?? input.amountDue ?? null,
      due_date: input.due_date || input.dueDate || null,
      days_until_due: input.days_until_due ?? input.daysUntilDue ?? null,
      days_overdue: input.days_overdue ?? input.daysOverdue ?? null,

      sent_at: status === "sent" ? now : null,
      skipped_at: status === "skipped" ? now : null,
      failed_at: status === "failed" ? now : null,

      error_message: clean(input.error || input.error_message, 1000) || null,
      skip_reason: clean(input.skip_reason || input.skipReason, 255) || null,
      meta_json: toJson(input.meta || null),

      created_at: now,
      updated_at: now,
    });

    return {
      ok: true,
      id,
      reminder_id: reminderUuid,
      status,
      table: tableName,
    };
  } finally {
    conn.release();
  }
}

async function updateReminderHistoryRecord(input = {}) {
  const conn = await pool.getConnection();

  try {
    const tableName = await resolveHistoryTable(conn);

    if (!tableName) {
      return {
        ok: false,
        skipped: true,
        error: "No pledge reminder history table exists.",
      };
    }

    const cols = await getColumns(conn, tableName);
    const where = [];
    const params = [];

    if (input.id && cols.has("id")) {
      where.push("id = ?");
      params.push(input.id);
    }

    if (input.reminder_id && cols.has("reminder_id")) {
      where.push("reminder_id = ?");
      params.push(input.reminder_id);
    }

    if (input.reminder_uuid && cols.has("reminder_uuid")) {
      where.push("reminder_uuid = ?");
      params.push(input.reminder_uuid);
    }

    if (!where.length) {
      return {
        ok: false,
        error: "Reminder history identifier is required.",
      };
    }

    const status = normalizeStatus(input.status);
    const now = mysqlDateTime(input.updatedAt || new Date());

    const affected = await updateExistingColumns(
      conn,
      tableName,
      {
        status,
        message_id: clean(input.message_id || input.messageId, 190) || undefined,
        sent_at: status === "sent" ? now : undefined,
        skipped_at: status === "skipped" ? now : undefined,
        failed_at: status === "failed" ? now : undefined,
        error_message: clean(input.error || input.error_message, 1000) || undefined,
        skip_reason: clean(input.skip_reason || input.skipReason, 255) || undefined,
        meta_json: input.replaceMeta ? toJson(input.meta || null) : undefined,
        updated_at: now,
      },
      `(${where.join(" OR ")})`,
      params
    );

    return {
      ok: true,
      affected,
      status,
    };
  } finally {
    conn.release();
  }
}

async function recordPledgeReminderQueued(input = {}) {
  return createReminderHistoryRecord({
    ...input,
    status: "queued",
  });
}

async function recordPledgeReminderSent(input = {}) {
  return createReminderHistoryRecord({
    ...input,
    status: "sent",
  });
}

async function recordPledgeReminderSkipped(input = {}) {
  return createReminderHistoryRecord({
    ...input,
    status: "skipped",
  });
}

async function recordPledgeReminderFailed(input = {}) {
  return createReminderHistoryRecord({
    ...input,
    status: "failed",
  });
}

async function getPledgeReminderHistory(filters = {}) {
  const conn = await pool.getConnection();

  try {
    const tableName = await resolveHistoryTable(conn);

    if (!tableName) {
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

    const cols = await getColumns(conn, tableName);
    const page = toInt(filters.page, 1);
    const limit = Math.min(100, toInt(filters.limit || filters.pageSize, 25));
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];

    if (filters.pledge_id && cols.has("pledge_id")) {
      where.push("pledge_id = ?");
      params.push(filters.pledge_id);
    }

    if (filters.member_id && cols.has("member_id")) {
      where.push("member_id = ?");
      params.push(filters.member_id);
    }

    if (filters.campaign_id && cols.has("campaign_id")) {
      where.push("campaign_id = ?");
      params.push(filters.campaign_id);
    }

    if (filters.status && cols.has("status")) {
      where.push("status = ?");
      params.push(normalizeStatus(filters.status));
    }

    if (filters.reminder_type && cols.has("reminder_type")) {
      where.push("reminder_type = ?");
      params.push(clean(filters.reminder_type, 80));
    }

    if (filters.channel && cols.has("channel")) {
      where.push("channel = ?");
      params.push(clean(filters.channel, 40));
    }

    if (filters.email) {
      const q = `%${normalizeEmail(filters.email)}%`;

      if (cols.has("recipient_email")) {
        where.push("recipient_email LIKE ?");
        params.push(q);
      } else if (cols.has("email")) {
        where.push("email LIKE ?");
        params.push(q);
      }
    }

    const dCol = dateColumn(cols);

    if (filters.date_from && dCol !== "id") {
      where.push(`DATE(\`${dCol}\`) >= DATE(?)`);
      params.push(filters.date_from);
    }

    if (filters.date_to && dCol !== "id") {
      where.push(`DATE(\`${dCol}\`) <= DATE(?)`);
      params.push(filters.date_to);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [[countRow]] = await conn.query(
      `
      SELECT COUNT(*) AS total
      FROM \`${tableName}\`
      ${whereSql}
      `,
      params
    );

    const [rows] = await conn.query(
      `
      SELECT *
      FROM \`${tableName}\`
      ${whereSql}
      ORDER BY ${orderBySql(cols)}
      LIMIT ?
      OFFSET ?
      `,
      [...params, limit, offset]
    );

    const total = Number(countRow.total || 0);

    return {
      ok: true,
      rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  } finally {
    conn.release();
  }
}

async function getLastPledgeReminder(pledgeId, options = {}) {
  const result = await getPledgeReminderHistory({
    pledge_id: pledgeId,
    status: options.status || undefined,
    page: 1,
    limit: 1,
  });

  return result.rows[0] || null;
}

async function hasRecentPledgeReminder(pledgeId, options = {}) {
  const cooldownDays = Number(options.cooldownDays || 7);
  const last = await getLastPledgeReminder(pledgeId, {
    status: options.status || "sent",
  });

  if (!last) {
    return {
      ok: true,
      recent: false,
    };
  }

  const dateValue =
    last.sent_at ||
    last.created_at ||
    last.updated_at ||
    last.occurred_at;

  if (!dateValue) {
    return {
      ok: true,
      recent: false,
      last,
    };
  }

  const lastDate = new Date(dateValue);
  const nextAllowed = new Date(lastDate);
  nextAllowed.setDate(nextAllowed.getDate() + cooldownDays);

  return {
    ok: true,
    recent: nextAllowed > new Date(),
    last,
    next_allowed_at: mysqlDateTime(nextAllowed),
  };
}

async function getPledgeReminderHistorySummary(filters = {}) {
  const result = await getPledgeReminderHistory({
    ...filters,
    page: 1,
    limit: 100,
  });

  const summary = result.rows.reduce(
    (acc, row) => {
      const status = normalizeStatus(row.status);
      acc.total += 1;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {
      total: 0,
      queued: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    }
  );

  return {
    ok: true,
    summary,
  };
}

module.exports = {
  createReminderHistoryRecord,
  updateReminderHistoryRecord,

  recordPledgeReminderQueued,
  recordPledgeReminderSent,
  recordPledgeReminderSkipped,
  recordPledgeReminderFailed,

  getPledgeReminderHistory,
  getLastPledgeReminder,
  hasRecentPledgeReminder,
  getPledgeReminderHistorySummary,
};