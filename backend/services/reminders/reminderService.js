// backend/services/domains/reminders/reminderService.js
"use strict";

/*
  Compatibility wrapper.

  Canonical enterprise reminder service lives at:
  backend/services/domains/notifications/reminderService.js

  Keep this file only so older imports continue working while all logic flows
  through the single production reminder engine.
*/

const pool = require("../../../db");

const {
  updateExistingColumns,
  findMany,
} = require("../../../utils/dbHelpers");

const { mysqlNow } = require("../../../utils/dateHelpers");

const reminderService = require("../notifications/reminderService");

function normalizeLegacyType(type) {
  const value = String(type || "system").toLowerCase();

  const map = {
    membership: "membership_renewal",
    membership_renewal: "membership_renewal",
    invoice: "invoice_due",
    invoice_due: "invoice_due",
    payment: "payment_due",
    payment_due: "payment_due",
    pledge: "pledge_due",
    pledge_due: "pledge_due",
    event: "event",
    volunteer: "volunteer",
    system: "system",
  };

  return map[value] || value || "system";
}

function adaptPayload(payload = {}) {
  return {
    ...payload,

    reminder_type: normalizeLegacyType(payload.reminder_type || payload.type),

    subject:
      payload.subject ||
      payload.title ||
      "Reminder",

    recipient_email:
      payload.recipient_email ||
      payload.recipient ||
      payload.email ||
      payload.to ||
      null,

    recipient_name:
      payload.recipient_name ||
      payload.full_name ||
      payload.name ||
      null,

    scheduled_for:
      payload.scheduled_for ||
      payload.scheduled_at ||
      null,

    payment_link:
      payload.payment_link ||
      payload.paymentLink ||
      null,

    meta: {
      ...(payload.meta || {}),
      legacy_wrapper: true,
      legacy_channel: payload.channel || null,
    },
  };
}

function adaptReminderRow(row = {}) {
  return {
    ...row,

    reminder_type: normalizeLegacyType(row.reminder_type),

    subject:
      row.subject ||
      row.title ||
      "Reminder",

    recipient_email:
      row.recipient_email ||
      row.recipient ||
      row.email ||
      null,

    scheduled_for:
      row.scheduled_for ||
      row.scheduled_at ||
      null,
  };
}

async function createReminder(payload = {}) {
  return reminderService.createReminder(adaptPayload(payload));
}

async function updateReminderStatus(reminderId, status, extra = {}) {
  const normalized = String(status || "pending").toLowerCase();

  if (normalized === "sent") {
    return reminderService.markReminderSent(reminderId, extra);
  }

  if (normalized === "failed") {
    return reminderService.markReminderFailed(
      reminderId,
      extra.error_message || extra.error || "Reminder failed."
    );
  }

  return updateExistingColumns(
    pool,
    "tbl_reminders",
    {
      status: normalized,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [reminderId]
  );
}

async function getPendingReminders(limit = 50) {
  return findMany(
    pool,
    `
    SELECT *
    FROM tbl_reminders
    WHERE status = 'pending'
      AND scheduled_for <= NOW()
    ORDER BY scheduled_for ASC, id ASC
    LIMIT ?
    `,
    [Math.min(250, Math.max(1, Number(limit || 50)))]
  );
}

async function sendReminder(reminder = {}) {
  return reminderService.sendReminder(adaptReminderRow(reminder));
}

async function processPendingReminders(options = {}) {
  return reminderService.processPendingReminders(options);
}

async function createMembershipRenewalReminder(payload = {}) {
  return reminderService.createMembershipRenewalReminder(adaptPayload(payload));
}

async function createInvoiceReminder(payload = {}) {
  return reminderService.createInvoiceReminder(adaptPayload(payload));
}

async function createEventReminder(payload = {}) {
  return reminderService.createEventReminder(adaptPayload(payload));
}

async function createVolunteerReminder(payload = {}) {
  return reminderService.createReminder({
    ...adaptPayload(payload),
    reminder_type: "volunteer",
    subject: payload.subject || payload.title || "Volunteer Reminder",
    message:
      payload.message ||
      "This is a reminder for your upcoming volunteer activity.",
  });
}

async function createPledgeReminder(payload = {}) {
  return reminderService.createPledgeReminder(adaptPayload(payload));
}

async function createPaymentReminder(payload = {}) {
  return reminderService.createPaymentReminder(adaptPayload(payload));
}

async function getReminderStats() {
  return reminderService.getReminderStats();
}

module.exports = {
  createReminder,
  updateReminderStatus,
  getPendingReminders,
  sendReminder,
  processPendingReminders,

  createMembershipRenewalReminder,
  createInvoiceReminder,
  createEventReminder,
  createVolunteerReminder,
  createPledgeReminder,
  createPaymentReminder,

  getReminderStats,
};