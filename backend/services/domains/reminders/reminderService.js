// backend/services/domains/reminders/reminderService.js
"use strict";

const pool =
  require("../../../db");

const {

  insertExistingColumns,

  updateExistingColumns,

  findMany,

  findOne,

} = require(
  "../../../utils/dbHelpers"
);

const {

  clean,

  nullable,

  mysqlNow,

} = require(
  "../../../utils/financeHelpers"
);

const {

  sendEmail,

  sendInAppNotification,

} = require(
  "../notifications/notificationService"
);

/* =========================================================
   HELPERS
========================================================= */

function normalizeStatus(
  status
) {

  const allowed = [

    "pending",

    "processing",

    "sent",

    "failed",

    "cancelled",
  ];

  const value =
    String(
      status || "pending"
    ).toLowerCase();

  return allowed.includes(
    value
  )
    ? value
    : "pending";
}

function normalizeType(
  type
) {

  const allowed = [

    "membership",

    "invoice",

    "event",

    "volunteer",

    "payment",

    "system",
  ];

  const value =
    String(
      type || "system"
    ).toLowerCase();

  return allowed.includes(
    value
  )
    ? value
    : "system";
}

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
        normalizeType(
          payload.reminder_type
        ),

      title:
        clean(
          payload.title,
          255
        ),

      message:
        nullable(
          payload.message,
          10000
        ),

      channel:
        clean(
          payload.channel ||
          "email",
          80
        ),

      recipient:
        nullable(
          payload.recipient,
          255
        ),

      scheduled_at:
        payload.scheduled_at,

      status:
        normalizeStatus(
          payload.status
        ),

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
   UPDATE STATUS
========================================================= */

async function updateReminderStatus(

  reminderId,

  status,

  extra = {}
) {

  return updateExistingColumns(

    pool,

    "tbl_reminders",

    {

      status:
        normalizeStatus(
          status
        ),

      processed_at:
        status === "sent"

          ? mysqlNow()

          : undefined,

      error_message:
        extra.error_message,

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [reminderId]
  );
}

/* =========================================================
   PENDING REMINDERS
========================================================= */

async function getPendingReminders(
  limit = 50
) {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_reminders

    WHERE status = 'pending'
      AND scheduled_at <= NOW()

    ORDER BY
      scheduled_at ASC

    LIMIT ?
    `,

    [Number(limit)]
  );
}

/* =========================================================
   SEND REMINDER
========================================================= */

async function sendReminder(
  reminder = {}
) {

  try {

    await updateReminderStatus(
      reminder.id,
      "processing"
    );

    /* =====================================
       EMAIL
    ===================================== */

    if (
      reminder.channel === "email"
    ) {

      const result =
        await sendEmail({

          user_id:
            reminder.user_id,

          member_id:
            reminder.member_id,

          to:
            reminder.recipient,

          subject:
            reminder.title,

          html:
            `
            <div>
              <h2>
                ${reminder.title}
              </h2>

              <p>
                ${reminder.message}
              </p>
            </div>
            `,

          message:
            reminder.message,
        });

      if (!result.success) {

        throw new Error(
          result.error
        );
      }
    }

    /* =====================================
       IN APP
    ===================================== */

    if (
      reminder.channel === "in_app"
    ) {

      await sendInAppNotification({

        user_id:
          reminder.user_id,

        member_id:
          reminder.member_id,

        notification_type:
          "reminder",

        subject:
          reminder.title,

        message:
          reminder.message,
      });
    }

    await updateReminderStatus(
      reminder.id,
      "sent"
    );

    return {

      success: true,
    };

  } catch (err) {

    await updateReminderStatus(

      reminder.id,

      "failed",

      {

        error_message:
          err.message,
      }
    );

    console.error(
      "sendReminder error:",
      err
    );

    return {

      success: false,

      error:
        err.message,
    };
  }
}

/* =========================================================
   PROCESS REMINDERS
========================================================= */

async function processPendingReminders() {

  const reminders =
    await getPendingReminders();

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const reminder of reminders) {

    processed++;

    const result =
      await sendReminder(
        reminder
      );

    if (result.success) {

      sent++;

    } else {

      failed++;
    }
  }

  return {

    success: true,

    processed,

    sent,

    failed,
  };
}

/* =========================================================
   MEMBERSHIP REMINDER
========================================================= */

async function createMembershipRenewalReminder(
  payload = {}
) {

  return createReminder({

    user_id:
      payload.user_id,

    member_id:
      payload.member_id,

    reminder_type:
      "membership",

    title:
      payload.title ||

      "Membership Renewal Reminder",

    message:
      payload.message ||

      "Your membership renewal is coming due.",

    recipient:
      payload.recipient,

    channel:
      payload.channel || "email",

    scheduled_at:
      payload.scheduled_at,
  });
}

/* =========================================================
   INVOICE REMINDER
========================================================= */

async function createInvoiceReminder(
  payload = {}
) {

  return createReminder({

    user_id:
      payload.user_id,

    member_id:
      payload.member_id,

    reminder_type:
      "invoice",

    title:
      payload.title ||

      "Invoice Reminder",

    message:
      payload.message ||

      "You have an outstanding invoice.",

    recipient:
      payload.recipient,

    channel:
      payload.channel || "email",

    scheduled_at:
      payload.scheduled_at,
  });
}

/* =========================================================
   EVENT REMINDER
========================================================= */

async function createEventReminder(
  payload = {}
) {

  return createReminder({

    user_id:
      payload.user_id,

    member_id:
      payload.member_id,

    reminder_type:
      "event",

    title:
      payload.title ||

      "Event Reminder",

    message:
      payload.message ||

      "Upcoming church event reminder.",

    recipient:
      payload.recipient,

    channel:
      payload.channel || "email",

    scheduled_at:
      payload.scheduled_at,
  });
}

/* =========================================================
   VOLUNTEER REMINDER
========================================================= */

async function createVolunteerReminder(
  payload = {}
) {

  return createReminder({

    user_id:
      payload.user_id,

    member_id:
      payload.member_id,

    reminder_type:
      "volunteer",

    title:
      payload.title ||

      "Volunteer Reminder",

    message:
      payload.message ||

      "Volunteer activity reminder.",

    recipient:
      payload.recipient,

    channel:
      payload.channel || "email",

    scheduled_at:
      payload.scheduled_at,
  });
}

/* =========================================================
   REMINDER STATS
========================================================= */

async function getReminderStats() {

  const row =
    await findOne(

      pool,

      `
      SELECT

        COUNT(*) AS total,

        SUM(
          CASE
            WHEN status = 'sent'
            THEN 1
            ELSE 0
          END
        ) AS sent,

        SUM(
          CASE
            WHEN status = 'failed'
            THEN 1
            ELSE 0
          END
        ) AS failed,

        SUM(
          CASE
            WHEN status = 'pending'
            THEN 1
            ELSE 0
          END
        ) AS pending

      FROM tbl_reminders
      `,

      []
    );

  return {

    total:
      Number(row?.total || 0),

    sent:
      Number(row?.sent || 0),

    failed:
      Number(row?.failed || 0),

    pending:
      Number(row?.pending || 0),
  };
}

/* =========================================================
   EXPORTS
========================================================= */

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

  getReminderStats,
};