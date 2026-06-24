//backend\services\domains\pledge\pledgeEmailTrackingService.js

"use strict";

const crypto = require("crypto");
const pool = require("../../../db");

const TRACKING_TABLES = [
  "tbl_finance_pledge_email_tracking",
  "tbl_pledge_email_tracking",
  "tbl_finance_pledge_emails",
];

const EVENT_TABLES = [
  "tbl_finance_pledge_email_events",
  "tbl_pledge_email_events",
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

function normalizeStatus(status) {
  const value = clean(status, 40).toLowerCase();

  if (["queued", "pending"].includes(value)) return "queued";
  if (["sent", "send", "accepted"].includes(value)) return "sent";
  if (["delivered", "delivery"].includes(value)) return "delivered";
  if (["opened", "open"].includes(value)) return "opened";
  if (["clicked", "click"].includes(value)) return "clicked";
  if (["bounced", "bounce"].includes(value)) return "bounced";
  if (["complained", "complaint", "spam"].includes(value)) return "complained";
  if (["unsubscribed", "unsubscribe"].includes(value)) return "unsubscribed";
  if (["failed", "error"].includes(value)) return "failed";

  return value || "queued";
}

function statusTimestampColumn(status) {
  const normalized = normalizeStatus(status);

  return {
    queued: "queued_at",
    sent: "sent_at",
    delivered: "delivered_at",
    opened: "opened_at",
    clicked: "clicked_at",
    bounced: "bounced_at",
    complained: "complained_at",
    unsubscribed: "unsubscribed_at",
    failed: "failed_at",
  }[normalized];
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

async function resolveTable(conn, candidates) {
  for (const tableName of candidates) {
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

async function findTrackingRecord(conn, tableName, input = {}) {
  const cols = await getColumns(conn, tableName);

  const where = [];
  const params = [];

  if (input.id && cols.has("id")) {
    where.push("id = ?");
    params.push(input.id);
  }

  if (input.tracking_id && cols.has("tracking_id")) {
    where.push("tracking_id = ?");
    params.push(input.tracking_id);
  }

  if (input.messageId && cols.has("message_id")) {
    where.push("message_id = ?");
    params.push(input.messageId);
  }

  if (input.message_id && cols.has("message_id")) {
    where.push("message_id = ?");
    params.push(input.message_id);
  }

  if (!where.length) return null;

  const [rows] = await conn.query(
    `
    SELECT *
    FROM \`${tableName}\`
    WHERE ${where.join(" OR ")}
    ORDER BY id DESC
    LIMIT 1
    `,
    params
  );

  return rows[0] || null;
}

async function recordEmailEvent(conn, event) {
  const eventTable = await resolveTable(conn, EVENT_TABLES);
  if (!eventTable) return null;

  const status = normalizeStatus(event.status || event.event_type);
  const now = mysqlDateTime(event.occurredAt || event.occurred_at || new Date());

  return insertExistingColumns(conn, eventTable, {
    tracking_id: event.tracking_id || event.trackingId || null,
    pledge_id: event.pledge_id || event.pledgeId || null,
    member_id: event.member_id || event.memberId || null,
    campaign_id: event.campaign_id || event.campaignId || null,
    event_uuid: event.event_uuid || crypto.randomUUID(),
    event_type: status,
    status,
    channel: "email",
    provider: clean(event.provider || "smtp", 80),
    provider_event_id: clean(event.provider_event_id || event.providerEventId, 190) || null,
    message_id: clean(event.message_id || event.messageId, 190) || null,
    recipient_email: normalizeEmail(event.recipient_email || event.email || event.to),
    email: normalizeEmail(event.recipient_email || event.email || event.to),
    subject: clean(event.subject, 255) || null,
    url: clean(event.url, 1000) || null,
    ip_address: clean(event.ip_address || event.ipAddress, 80) || null,
    user_agent: clean(event.user_agent || event.userAgent, 500) || null,
    error_message: clean(event.error || event.error_message, 1000) || null,
    meta_json: toJson(event.meta || event.raw || null),
    occurred_at: now,
    created_at: now,
    updated_at: now,
  });
}

async function createEmailTrackingRecord(input = {}) {
  const conn = await pool.getConnection();

  try {
    const trackingTable = await resolveTable(conn, TRACKING_TABLES);

    if (!trackingTable) {
      return {
        ok: false,
        skipped: true,
        error: "No pledge email tracking table exists.",
      };
    }

    const status = normalizeStatus(input.status || "queued");
    const now = mysqlDateTime(input.createdAt || new Date());
    const trackingUuid = input.tracking_uuid || input.trackingId || crypto.randomUUID();
    const messageId = clean(input.message_id || input.messageId, 190) || null;
    const recipientEmail = normalizeEmail(input.recipient_email || input.email || input.to);

    const id = await insertExistingColumns(conn, trackingTable, {
      tracking_uuid: trackingUuid,
      tracking_id: trackingUuid,
      pledge_id: input.pledge_id || input.pledgeId || null,
      member_id: input.member_id || input.memberId || null,
      campaign_id: input.campaign_id || input.campaignId || null,
      reminder_id: input.reminder_id || input.reminderId || null,
      email_type: clean(input.email_type || input.emailType || "pledge_reminder", 80),
      reminder_type: clean(input.reminder_type || input.reminderType || "manual", 80),
      channel: "email",
      provider: clean(input.provider || "smtp", 80),
      message_id: messageId,
      recipient_email: recipientEmail,
      email: recipientEmail,
      subject: clean(input.subject, 255) || null,
      status,
      queued_at: status === "queued" ? now : null,
      sent_at: status === "sent" ? now : null,
      delivered_at: status === "delivered" ? now : null,
      opened_at: status === "opened" ? now : null,
      clicked_at: status === "clicked" ? now : null,
      failed_at: status === "failed" ? now : null,
      error_message: clean(input.error || input.error_message, 1000) || null,
      meta_json: toJson(input.meta || null),
      created_at: now,
      updated_at: now,
    });

    await recordEmailEvent(conn, {
      ...input,
      tracking_id: id || trackingUuid,
      status,
      occurredAt: now,
    });

    return {
      ok: true,
      id,
      tracking_id: trackingUuid,
      table: trackingTable,
      status,
    };
  } finally {
    conn.release();
  }
}

async function updateEmailTrackingStatus(input = {}) {
  const conn = await pool.getConnection();

  try {
    const trackingTable = await resolveTable(conn, TRACKING_TABLES);

    if (!trackingTable) {
      return {
        ok: false,
        skipped: true,
        error: "No pledge email tracking table exists.",
      };
    }

    const existing = await findTrackingRecord(conn, trackingTable, input);
    if (!existing) {
      return {
        ok: false,
        error: "Email tracking record not found.",
      };
    }

    const status = normalizeStatus(input.status);
    const now = mysqlDateTime(input.occurredAt || input.occurred_at || new Date());
    const timestampCol = statusTimestampColumn(status);

    const updateData = {
      status,
      updated_at: now,
      last_event_at: now,
      last_event_type: status,
      error_message: status === "failed" || status === "bounced"
        ? clean(input.error || input.error_message, 1000)
        : undefined,
      provider_event_id: clean(input.provider_event_id || input.providerEventId, 190) || undefined,
      meta_json: input.replaceMeta ? toJson(input.meta || null) : undefined,
    };

    if (timestampCol) {
      updateData[timestampCol] = now;
    }

    const affected = await updateExistingColumns(
      conn,
      trackingTable,
      updateData,
      "id = ?",
      [existing.id]
    );

    await recordEmailEvent(conn, {
      ...input,
      tracking_id: existing.id,
      pledge_id: existing.pledge_id,
      member_id: existing.member_id,
      campaign_id: existing.campaign_id,
      recipient_email: existing.recipient_email || existing.email,
      message_id: existing.message_id,
      subject: existing.subject,
      status,
      occurredAt: now,
    });

    return {
      ok: true,
      id: existing.id,
      status,
      affected,
    };
  } finally {
    conn.release();
  }
}

async function recordPledgeEmailQueued(input = {}) {
  return createEmailTrackingRecord({
    ...input,
    status: "queued",
  });
}

async function recordPledgeEmailSent(input = {}) {
  return createEmailTrackingRecord({
    ...input,
    status: "sent",
  });
}

async function recordPledgeEmailFailed(input = {}) {
  const target = input.id || input.tracking_id || input.message_id || input.messageId;

  if (target) {
    return updateEmailTrackingStatus({
      ...input,
      status: "failed",
    });
  }

  return createEmailTrackingRecord({
    ...input,
    status: "failed",
  });
}

async function markPledgeEmailDelivered(input = {}) {
  return updateEmailTrackingStatus({
    ...input,
    status: "delivered",
  });
}

async function markPledgeEmailOpened(input = {}) {
  return updateEmailTrackingStatus({
    ...input,
    status: "opened",
  });
}

async function markPledgeEmailClicked(input = {}) {
  return updateEmailTrackingStatus({
    ...input,
    status: "clicked",
  });
}

async function markPledgeEmailBounced(input = {}) {
  return updateEmailTrackingStatus({
    ...input,
    status: "bounced",
  });
}

async function markPledgeEmailComplained(input = {}) {
  return updateEmailTrackingStatus({
    ...input,
    status: "complained",
  });
}

async function markPledgeEmailUnsubscribed(input = {}) {
  return updateEmailTrackingStatus({
    ...input,
    status: "unsubscribed",
  });
}

async function getPledgeEmailTracking(filters = {}) {
  const conn = await pool.getConnection();

  try {
    const trackingTable = await resolveTable(conn, TRACKING_TABLES);

    if (!trackingTable) {
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

    const cols = await getColumns(conn, trackingTable);
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 25)));
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

    if (filters.email) {
      const email = `%${normalizeEmail(filters.email)}%`;

      if (cols.has("recipient_email")) {
        where.push("recipient_email LIKE ?");
        params.push(email);
      } else if (cols.has("email")) {
        where.push("email LIKE ?");
        params.push(email);
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [[countRow]] = await conn.query(
      `
      SELECT COUNT(*) AS total
      FROM \`${trackingTable}\`
      ${whereSql}
      `,
      params
    );

    const [rows] = await conn.query(
      `
      SELECT *
      FROM \`${trackingTable}\`
      ${whereSql}
      ORDER BY COALESCE(updated_at, created_at, sent_at) DESC, id DESC
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

async function getPledgeEmailTrackingSummary(filters = {}) {
  const result = await getPledgeEmailTracking({
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
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      unsubscribed: 0,
      failed: 0,
    }
  );

  return {
    ok: true,
    summary,
  };
}

module.exports = {
  createEmailTrackingRecord,
  updateEmailTrackingStatus,
  recordEmailEvent,

  recordPledgeEmailQueued,
  recordPledgeEmailSent,
  recordPledgeEmailFailed,

  markPledgeEmailDelivered,
  markPledgeEmailOpened,
  markPledgeEmailClicked,
  markPledgeEmailBounced,
  markPledgeEmailComplained,
  markPledgeEmailUnsubscribed,

  getPledgeEmailTracking,
  getPledgeEmailTrackingSummary,
};