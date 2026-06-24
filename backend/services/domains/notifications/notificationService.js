// backend/services/domains/notifications/notificationService.js
"use strict";

const nodemailer = require("nodemailer");
const pool = require("../../../db");

const {
  insertExistingColumns,
  updateExistingColumns,
  findMany,
} = require("../../../utils/dbHelpers");

const { clean } = require("../../../utils/financeHelpers");
const { mysqlNow } = require("../../../utils/dateHelpers");

const SMTP_HOST = process.env.SMTP_HOST || process.env.EMAIL_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || process.env.EMAIL_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || process.env.EMAIL_PASS || "";
const SMTP_FROM =
  process.env.SMTP_FROM ||
  process.env.EMAIL_FROM ||
  `"Holy Trinity Finance" <${SMTP_USER}>`;

let transporter = null;

function cleanText(value, max = 1000) {
  return clean(String(value || "").trim(), max);
}

function safeJson(value) {
  if (!value) return null;

  try {
    return JSON.stringify(value);
  } catch (_err) {
    return JSON.stringify({ value: String(value) });
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeEmailList(value) {
  if (!value) return "";

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join(",");
  }

  return String(value || "").trim();
}

function smtpConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

function getTransporter() {
  if (!smtpConfigured()) {
    throw new Error("SMTP is not configured.");
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      pool: true,
      maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || 3),
      maxMessages: Number(process.env.SMTP_MAX_MESSAGES || 100),
    });
  }

  return transporter;
}

function htmlFromMessage(message = "") {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      ${escapeHtml(message).replace(/\n/g, "<br />")}
    </div>
  `;
}

async function verifyEmailTransport() {
  if (!smtpConfigured()) {
    return {
      success: false,
      configured: false,
      error: "SMTP is not configured.",
    };
  }

  try {
    await getTransporter().verify();

    return {
      success: true,
      configured: true,
    };
  } catch (err) {
    return {
      success: false,
      configured: true,
      error: err.message,
    };
  }
}

async function createNotification(payload = {}) {
  const recipient =
    normalizeEmailList(payload.recipient || payload.to || payload.phone) || null;

  return insertExistingColumns(pool, "tbl_notifications", {
    user_id: payload.user_id || null,
    member_id: payload.member_id || null,

    notification_type: cleanText(
      payload.notification_type || payload.type || "system",
      120
    ),

    channel: cleanText(payload.channel || "email", 80),

    recipient,
    subject: cleanText(payload.subject || "", 255) || null,
    message: payload.message ? cleanText(payload.message, 10000) : null,
    html_body: payload.html || null,
    text_body: payload.text || payload.message || null,

    status: payload.status || "pending",
    priority: payload.priority || "normal",

    provider: payload.provider || null,
    provider_message_id: payload.provider_message_id || null,
    error_message: payload.error_message || null,

    retry_count: Number(payload.retry_count || 0),
    next_retry_at: payload.next_retry_at || null,

    meta_json: safeJson(payload.meta || payload.metadata || null),

    created_at: mysqlNow(),
    updated_at: mysqlNow(),
  });
}

async function markNotificationSent(notificationId, providerMessageId = null) {
  if (!notificationId) return null;

  return updateExistingColumns(
    pool,
    "tbl_notifications",
    {
      status: "sent",
      provider_message_id: providerMessageId,
      sent_at: mysqlNow(),
      updated_at: mysqlNow(),
    },
    "id = ?",
    [notificationId]
  );
}

async function markNotificationFailed(notificationId, error) {
  if (!notificationId) return null;

  return updateExistingColumns(
    pool,
    "tbl_notifications",
    {
      status: "failed",
      error_message: cleanText(error?.message || error || "Send failed", 2000),
      updated_at: mysqlNow(),
    },
    "id = ?",
    [notificationId]
  );
}

async function sendEmail(payload = {}) {
  const to = normalizeEmailList(payload.to || payload.recipient);
  const subject = cleanText(payload.subject || "Notification", 255);
  const message = payload.message || "";
  const html = payload.html || htmlFromMessage(message);

  const notificationId = await createNotification({
    ...payload,
    channel: "email",
    recipient: to,
    subject,
    message,
    html,
    status: "pending",
  });

  try {
    if (!to) {
      throw new Error("Recipient email is required.");
    }

    const info = await getTransporter().sendMail({
      from: payload.from || SMTP_FROM,
      to,
      cc: normalizeEmailList(payload.cc) || undefined,
      bcc: normalizeEmailList(payload.bcc) || undefined,
      replyTo: payload.replyTo || process.env.SMTP_REPLY_TO || undefined,
      subject,
      html,
      text: payload.text || message || undefined,
      attachments: Array.isArray(payload.attachments)
        ? payload.attachments
        : [],
    });

    await markNotificationSent(notificationId, info.messageId);

    return {
      success: true,
      notification_id: notificationId,
      message_id: info.messageId,
    };
  } catch (err) {
    await markNotificationFailed(notificationId, err);

    console.error("sendEmail error:", {
      to,
      subject,
      error: err.message,
    });

    return {
      success: false,
      notification_id: notificationId,
      error: err.message,
    };
  }
}

async function sendSms(payload = {}) {
  const notificationId = await createNotification({
    ...payload,
    channel: "sms",
    recipient: payload.to || payload.phone,
    status: "pending",
  });

  try {
    await markNotificationSent(notificationId);

    return {
      success: true,
      notification_id: notificationId,
      simulated: true,
    };
  } catch (err) {
    await markNotificationFailed(notificationId, err);

    return {
      success: false,
      notification_id: notificationId,
      error: err.message,
    };
  }
}

async function sendPushNotification(payload = {}) {
  const notificationId = await createNotification({
    ...payload,
    channel: "push",
    recipient: payload.user_id || payload.member_id || null,
    subject: payload.title || payload.subject,
    status: "pending",
  });

  try {
    await markNotificationSent(notificationId);

    return {
      success: true,
      notification_id: notificationId,
      simulated: true,
    };
  } catch (err) {
    await markNotificationFailed(notificationId, err);

    return {
      success: false,
      notification_id: notificationId,
      error: err.message,
    };
  }
}

async function sendBulkEmail({ recipients = [], subject, html, message, meta }) {
  const uniqueRecipients = [...new Set(recipients.map(normalizeEmailList))]
    .filter(Boolean);

  const results = [];

  for (const recipient of uniqueRecipients) {
    const result = await sendEmail({
      to: recipient,
      subject,
      html,
      message,
      meta,
    });

    results.push(result);
  }

  return {
    success: true,
    total: results.length,
    sent: results.filter((row) => row.success).length,
    failed: results.filter((row) => !row.success).length,
    results,
  };
}

async function sendInAppNotification(payload = {}) {
  return createNotification({
    ...payload,
    channel: "in_app",
    recipient: payload.user_id || payload.member_id || null,
    status: "sent",
  });
}

async function markNotificationRead(notificationId) {
  return updateExistingColumns(
    pool,
    "tbl_notifications",
    {
      is_read: 1,
      read_at: mysqlNow(),
      updated_at: mysqlNow(),
    },
    "id = ?",
    [notificationId]
  );
}

async function getUserNotifications(userId, filters = {}) {
  const limit = Math.min(100, Math.max(1, Number(filters.limit || 25)));

  return findMany(
    pool,
    `
    SELECT *
    FROM tbl_notifications
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
    `,
    [userId, limit]
  );
}

async function getUnreadNotificationCount(userId) {
  const [[row]] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM tbl_notifications
    WHERE user_id = ?
      AND (is_read = 0 OR is_read IS NULL)
    `,
    [userId]
  );

  return Number(row?.total || 0);
}

async function retryFailedEmails(limit = 20) {
  const rows = await findMany(
    pool,
    `
    SELECT *
    FROM tbl_notifications
    WHERE channel = 'email'
      AND status = 'failed'
      AND recipient IS NOT NULL
    ORDER BY updated_at ASC, id ASC
    LIMIT ?
    `,
    [Math.min(100, Math.max(1, Number(limit || 20)))]
  );

  const results = [];

  for (const row of rows) {
    const result = await sendEmail({
      to: row.recipient,
      subject: row.subject,
      html: row.html_body || row.message,
      message: row.text_body || row.message,
      meta: {
        retry_of_notification_id: row.id,
      },
    });

    results.push(result);
  }

  return {
    success: true,
    processed: results.length,
    sent: results.filter((row) => row.success).length,
    failed: results.filter((row) => !row.success).length,
    results,
  };
}

async function sendBroadcastNotification({ role = null, subject, message, html }) {
  const params = [];
  let sql = `
    SELECT id, email, role
    FROM tbl_users
    WHERE email IS NOT NULL
  `;

  if (role) {
    sql += " AND role = ?";
    params.push(role);
  }

  const users = await findMany(pool, sql, params);

  return sendBulkEmail({
    recipients: users.map((user) => user.email),
    subject,
    html,
    message,
    meta: {
      broadcast_role: role || "all",
    },
  });
}

async function getNotificationStats() {
  const [[row]] = await pool.query(
    `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN channel = 'email' THEN 1 ELSE 0 END) AS emails,
      SUM(CASE WHEN channel = 'sms' THEN 1 ELSE 0 END) AS sms,
      SUM(CASE WHEN channel = 'push' THEN 1 ELSE 0 END) AS push_total,
      SUM(CASE WHEN channel = 'in_app' THEN 1 ELSE 0 END) AS in_app
    FROM tbl_notifications
    `
  );

  return {
    total: Number(row?.total || 0),
    sent: Number(row?.sent || 0),
    failed: Number(row?.failed || 0),
    pending: Number(row?.pending || 0),
    emails: Number(row?.emails || 0),
    sms: Number(row?.sms || 0),
    push: Number(row?.push_total || 0),
    in_app: Number(row?.in_app || 0),
  };
}

module.exports = {
  createNotification,
  markNotificationSent,
  markNotificationFailed,

  sendEmail,
  sendSms,
  sendPushNotification,
  sendBulkEmail,
  sendInAppNotification,

  markNotificationRead,
  getUserNotifications,
  getUnreadNotificationCount,
  retryFailedEmails,
  sendBroadcastNotification,
  getNotificationStats,
  verifyEmailTransport,
};