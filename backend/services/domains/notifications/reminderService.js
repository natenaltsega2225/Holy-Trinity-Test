// backend/services/domains/notifications/reminderService.js
"use strict";

const pool = require("../../../db");

const {
  insertExistingColumns,
  updateExistingColumns,
  findMany,
} = require("../../../utils/dbHelpers");

const { mysqlNow, addDays } = require("../../../utils/dateHelpers");
const { clean } = require("../../../utils/financeHelpers");

const { sendEmail } = require("./notificationService");

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

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function appUrl() {
  return (
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:5173"
  ).replace(/\/+$/, "");
}

function scheduledDate(payload = {}) {
  if (payload.scheduled_for) return payload.scheduled_for;

  if (payload.days_from_now !== undefined) {
    return addDays(new Date(), Number(payload.days_from_now || 0));
  }

  return mysqlNow();
}

function buildReminderHtml(payload = {}) {
  const title = escapeHtml(payload.subject || "Reminder");
  const message = escapeHtml(payload.message || "").replace(/\n/g, "<br />");
  const paymentLink = payload.payment_link || payload.paymentLink || "";

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 12px;color:#0f3f68">${title}</h2>
      <div>${message}</div>

      ${
        paymentLink
          ? `
            <p style="margin-top:24px">
              <a href="${escapeHtml(paymentLink)}"
                 style="background:#0f3f68;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;display:inline-block">
                Pay Online
              </a>
            </p>
          `
          : ""
      }

      <p style="margin-top:24px;color:#64748b;font-size:12px">
        Holy Trinity Finance & Membership Platform
      </p>
    </div>
  `;
}

function buildIdempotencyKey(payload = {}) {
  if (payload.idempotency_key) return cleanText(payload.idempotency_key, 255);

  return [
    payload.reminder_type || "system",
    payload.member_id || "guest",
    payload.invoice_id || "",
    payload.pledge_id || "",
    payload.registration_id || "",
    payload.recipient_email || payload.email || "",
    payload.scheduled_for || "",
  ]
    .filter(Boolean)
    .join(":")
    .slice(0, 255);
}

async function findReminderByIdempotencyKey(idempotencyKey) {
  if (!idempotencyKey) return null;

  try {
    const rows = await findMany(
      pool,
      `
      SELECT id, status
      FROM tbl_reminders
      WHERE idempotency_key = ?
      LIMIT 1
      `,
      [idempotencyKey]
    );

    return rows[0] || null;
  } catch (_err) {
    return null;
  }
}

async function createReminder(payload = {}) {
  const recipientEmail =
    payload.recipient_email ||
    payload.email ||
    payload.to ||
    null;

  const idempotencyKey = buildIdempotencyKey({
    ...payload,
    recipient_email: recipientEmail,
  });

  const existing = await findReminderByIdempotencyKey(idempotencyKey);

  if (existing) {
    return existing.id;
  }

  return insertExistingColumns(pool, "tbl_reminders", {
    user_id: payload.user_id || null,
    member_id: payload.member_id || null,

    reminder_type: cleanText(payload.reminder_type || "system", 120),
    subject: cleanText(payload.subject || "Reminder", 255),
    message: cleanText(payload.message || "", 10000),
    html_body: payload.html || buildReminderHtml(payload),

    recipient_email: recipientEmail,
    recipient_name:
      payload.recipient_name ||
      payload.full_name ||
      payload.guest_name ||
      payload.donor_name ||
      null,

    phone: payload.phone || null,

    invoice_id: payload.invoice_id || null,
    invoice_number: payload.invoice_number || null,
    pledge_id: payload.pledge_id || null,
    campaign_id: payload.campaign_id || null,
    registration_id: payload.registration_id || null,

    payment_link: payload.payment_link || payload.paymentLink || null,
    balance_due: payload.balance_due || payload.remaining_balance || null,
    due_date: payload.due_date || null,

    scheduled_for: scheduledDate(payload),
    status: payload.status || "pending",

    attempts: Number(payload.attempts || 0),
    max_attempts: Number(payload.max_attempts || 3),
    idempotency_key: idempotencyKey,

    meta_json: safeJson(payload.meta || payload.metadata || null),

    created_at: mysqlNow(),
    updated_at: mysqlNow(),
  });
}

async function markReminderSent(reminderId, result = {}) {
  return updateExistingColumns(
    pool,
    "tbl_reminders",
    {
      status: "sent",
      notification_id: result.notification_id || null,
      provider_message_id: result.message_id || null,
      sent_at: mysqlNow(),
      updated_at: mysqlNow(),
    },
    "id = ?",
    [reminderId]
  );
}

async function markReminderFailed(reminderId, error) {
  return updateExistingColumns(
    pool,
    "tbl_reminders",
    {
      status: "failed",
      last_error: cleanText(error?.message || error || "Reminder failed", 2000),
      error_message: cleanText(error?.message || error || "Reminder failed", 2000),
      updated_at: mysqlNow(),
    },
    "id = ?",
    [reminderId]
  );
}

async function sendReminder(reminder = {}) {
  if (!reminder.recipient_email) {
    throw new Error("Reminder recipient email is required.");
  }

  return sendEmail({
    user_id: reminder.user_id,
    member_id: reminder.member_id,
    to: reminder.recipient_email,
    subject: reminder.subject,
    html: reminder.html_body || buildReminderHtml(reminder),
    message: reminder.message,
    notification_type: `reminder.${reminder.reminder_type || "system"}`,
    meta: {
      reminder_id: reminder.id,
      reminder_type: reminder.reminder_type,
      invoice_id: reminder.invoice_id,
      pledge_id: reminder.pledge_id,
      campaign_id: reminder.campaign_id,
      registration_id: reminder.registration_id,
      payment_link: reminder.payment_link,
    },
  });
}

async function processPendingReminders(options = {}) {
  const limit = Math.min(250, Math.max(1, Number(options.limit || 100)));

  let reminders = [];

  try {
    reminders = await findMany(
      pool,
      `
      SELECT *
      FROM tbl_reminders
      WHERE status = 'pending'
        AND scheduled_for <= NOW()
      ORDER BY scheduled_for ASC, id ASC
      LIMIT ?
      `,
      [limit]
    );
  } catch (err) {
    return {
      success: false,
      processed: 0,
      error: err.message,
    };
  }

  const results = [];

  for (const reminder of reminders) {
    try {
      await updateExistingColumns(
        pool,
        "tbl_reminders",
        {
          status: "processing",
          updated_at: mysqlNow(),
        },
        "id = ?",
        [reminder.id]
      );

      const result = await sendReminder(reminder);

      if (!result.success) {
        throw new Error(result.error || "Email send failed.");
      }

      await markReminderSent(reminder.id, result);

      results.push({
        id: reminder.id,
        success: true,
        notification_id: result.notification_id,
      });
    } catch (err) {
      await markReminderFailed(reminder.id, err);

      results.push({
        id: reminder.id,
        success: false,
        error: err.message,
      });
    }
  }

  return {
    success: true,
    processed: results.length,
    sent: results.filter((row) => row.success).length,
    failed: results.filter((row) => !row.success).length,
    results,
  };
}

async function createMembershipRenewalReminder(payload = {}) {
  const paymentLink =
    payload.payment_link ||
    `${appUrl()}/membership/renew?member=${encodeURIComponent(
      payload.member_no || payload.member_id || ""
    )}`;

  return createReminder({
    ...payload,
    reminder_type: "membership_renewal",
    recipient_email: payload.email,
    subject: payload.subject || "Membership Renewal Reminder",
    payment_link: paymentLink,
    message:
      payload.message ||
      `
Dear ${payload.full_name || "Member"},

Your membership coverage will expire on ${payload.membership_end_date || payload.due_date || "the upcoming due date"}.

Please renew your membership to keep your account current.

Thank you,
Holy Trinity Finance Office
      `.trim(),
    meta: {
      ...(payload.meta || {}),
      membership_end_date: payload.membership_end_date,
      coverage_label: payload.coverage_label,
      payment_link: paymentLink,
    },
  });
}

async function createInvoiceReminder(payload = {}) {
  const paymentLink =
    payload.payment_link ||
    payload.public_payment_link ||
    `${appUrl()}/pay-invoice/${encodeURIComponent(payload.invoice_number || "")}`;

  return createReminder({
    ...payload,
    reminder_type: "invoice_due",
    recipient_email: payload.email || payload.recipient_email,
    subject: payload.subject || `Invoice Payment Reminder ${payload.invoice_number || ""}`.trim(),
    payment_link: paymentLink,
    balance_due: payload.balance_due,
    message:
      payload.message ||
      `
Dear ${payload.full_name || payload.guest_name || "Friend"},

This is a reminder that invoice ${payload.invoice_number || ""} has a balance due of ${money(payload.balance_due || payload.amount || 0)}.

You can pay securely online using the payment link below.

Thank you,
Holy Trinity Finance Office
      `.trim(),
    meta: {
      ...(payload.meta || {}),
      invoice_id: payload.invoice_id,
      invoice_number: payload.invoice_number,
      balance_due: payload.balance_due,
      payment_link: paymentLink,
    },
  });
}

async function createPledgeReminder(payload = {}) {
  const paymentLink =
    payload.payment_link ||
    `${appUrl()}/pledges/pay/${encodeURIComponent(
      payload.public_token || payload.pledge_id || ""
    )}`;

  return createReminder({
    ...payload,
    reminder_type: "pledge_due",
    recipient_email: payload.email || payload.recipient_email,
    subject: payload.subject || "Pledge Payment Reminder",
    payment_link: paymentLink,
    balance_due: payload.remaining_balance || payload.balance_due,
    message:
      payload.message ||
      `
Dear ${payload.full_name || payload.guest_name || "Friend"},

This is a friendly reminder for your pledge${payload.campaign_name ? ` for ${payload.campaign_name}` : ""}.

Remaining balance: ${money(payload.remaining_balance || payload.balance_due || 0)}

You can make a secure payment using the link below.

Thank you,
Holy Trinity Finance Office
      `.trim(),
    meta: {
      ...(payload.meta || {}),
      pledge_id: payload.pledge_id,
      campaign_id: payload.campaign_id,
      campaign_name: payload.campaign_name,
      remaining_balance: payload.remaining_balance || payload.balance_due,
      payment_link: paymentLink,
    },
  });
}

async function createPaymentReminder(payload = {}) {
  return createInvoiceReminder({
    ...payload,
    reminder_type: "payment_due",
    subject: payload.subject || "Payment Reminder",
  });
}

async function createEventReminder(payload = {}) {
  return createReminder({
    ...payload,
    reminder_type: "event",
    recipient_email: payload.email || payload.recipient_email,
    subject: payload.subject || "Event Reminder",
    message:
      payload.message ||
      `
Dear ${payload.full_name || "Friend"},

This is a reminder for your upcoming event:

${payload.event_name || payload.title || "Church Event"}

Thank you,
Holy Trinity
      `.trim(),
  });
}

async function getReminderStats() {
  const [[row]] = await pool.query(
    `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
    FROM tbl_reminders
    `
  );

  return {
    total: Number(row?.total || 0),
    pending: Number(row?.pending || 0),
    processing: Number(row?.processing || 0),
    sent: Number(row?.sent || 0),
    failed: Number(row?.failed || 0),
  };
}

module.exports = {
  createReminder,
  markReminderSent,
  markReminderFailed,
  processPendingReminders,
  sendReminder,

  createMembershipRenewalReminder,
  createInvoiceReminder,
  createPledgeReminder,
  createPaymentReminder,
  createEventReminder,

  getReminderStats,
};