// backend/services/domains/notifications/reminderService.js
"use strict";

const pool =
  require("../../../db");

const {

  insertExistingColumns,

  updateExistingColumns,

  findMany,

} = require(
  "../../../utils/dbHelpers"
);

const {

  mysqlNow,

  addDays,

} = require(
  "../../../utils/dateHelpers"
);

const {

  clean,

} = require(
  "../../../utils/financeHelpers"
);

const {

  sendEmail,

} = require(
  "./notificationService"
);

/* =========================================================
   CREATE REMINDER
========================================================= */

async function createReminder(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_reminders",

    {

      user_id:
        payload.user_id || null,

      member_id:
        payload.member_id || null,

      reminder_type:
        clean(
          payload.reminder_type ||
          "system",
          120
        ),

      subject:
        clean(
          payload.subject ||
          "Reminder",
          255
        ),

      message:
        clean(
          payload.message ||
          "",
          10000
        ),

      recipient_email:
        payload.recipient_email || null,

      scheduled_for:
        payload.scheduled_for ||

        mysqlNow(),

      status:
        "pending",

      meta_json:
        payload.meta
          ? JSON.stringify(
              payload.meta
            )
          : null,

      created_at:
        mysqlNow(),

      updated_at:
        mysqlNow(),
    }
  );
}

/* =========================================================
   MARK SENT
========================================================= */

async function markReminderSent(
  reminderId
) {

  return updateExistingColumns(

    pool,

    "tbl_reminders",

    {

      status:
        "sent",

      sent_at:
        mysqlNow(),

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [reminderId]
  );
}

/* =========================================================
   MARK FAILED
========================================================= */

async function markReminderFailed(

  reminderId,

  error
) {

  return updateExistingColumns(

    pool,

    "tbl_reminders",

    {

      status:
        "failed",

      error_message:
        String(
          error?.message ||
          error
        ),

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [reminderId]
  );
}

/* =========================================================
   PROCESS PENDING REMINDERS
========================================================= */

async function processPendingReminders() {

  const reminders =
    await findMany(

      pool,

      `
      SELECT *

      FROM tbl_reminders

      WHERE status = 'pending'
        AND scheduled_for <= NOW()

      ORDER BY scheduled_for ASC

      LIMIT 100
      `,

      []
    );

  const results = [];

  for (const reminder of reminders) {

    try {

      await sendEmail({

        to:
          reminder.recipient_email,

        subject:
          reminder.subject,

        html:
          `
          <div style="font-family: Arial;">

            <h2>
              ${reminder.subject}
            </h2>

            <p>
              ${reminder.message}
            </p>

          </div>
          `,
      });

      await markReminderSent(
        reminder.id
      );

      results.push({

        id:
          reminder.id,

        success:
          true,
      });

    } catch (err) {

      await markReminderFailed(

        reminder.id,

        err
      );

      results.push({

        id:
          reminder.id,

        success:
          false,

        error:
          err.message,
      });
    }
  }

  return {

    success: true,

    processed:
      results.length,

    results,
  };
}

/* =========================================================
   MEMBERSHIP RENEWAL REMINDER
========================================================= */

async function createMembershipRenewalReminder(
  payload = {}
) {

  return createReminder({

    reminder_type:
      "membership_renewal",

    user_id:
      payload.user_id,

    member_id:
      payload.member_id,

    recipient_email:
      payload.email,

    subject:
      "Membership Renewal Reminder",

    message:
      `
      Dear ${payload.full_name || "Member"},

      Your membership coverage will expire on:

      ${payload.membership_end_date}

      Please renew your membership to continue uninterrupted access and support.

      Thank you.
      `,

    scheduled_for:

      payload.scheduled_for ||

      mysqlNow(),
  });
}

/* =========================================================
   INVOICE REMINDER
========================================================= */

async function createInvoiceReminder(
  payload = {}
) {

  return createReminder({

    reminder_type:
      "invoice_due",

    user_id:
      payload.user_id,

    member_id:
      payload.member_id,

    recipient_email:
      payload.email,

    subject:
      "Invoice Payment Reminder",

    message:
      `
      Dear ${payload.full_name || "Member"},

      Your invoice:

      ${payload.invoice_number}

      with balance:

      ${payload.balance_due}

      is currently due.

      Please submit payment at your earliest convenience.
      `,

    scheduled_for:

      payload.scheduled_for ||

      mysqlNow(),
  });
}

/* =========================================================
   EVENT REMINDER
========================================================= */

async function createEventReminder(
  payload = {}
) {

  return createReminder({

    reminder_type:
      "event",

    user_id:
      payload.user_id,

    member_id:
      payload.member_id,

    recipient_email:
      payload.email,

    subject:
      payload.subject ||
      "Event Reminder",

    message:
      payload.message ||

      `
      Reminder for your upcoming event:

      ${payload.event_name}
      `,

    scheduled_for:

      payload.scheduled_for ||

      mysqlNow(),
  });
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  createReminder,

  markReminderSent,

  markReminderFailed,

  processPendingReminders,

  createMembershipRenewalReminder,

  createInvoiceReminder,

  createEventReminder,
};