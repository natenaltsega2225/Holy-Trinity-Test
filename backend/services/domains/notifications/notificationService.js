// backend/services/domains/notifications/notificationService.js
"use strict";

const nodemailer =
  require("nodemailer");

const pool =
  require("../../../db");

const {

  insertExistingColumns,

  updateExistingColumns,

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

/* =========================================================
   ENV
========================================================= */

const SMTP_HOST =
  process.env.SMTP_HOST;

const SMTP_PORT =
  Number(
    process.env.SMTP_PORT || 587
  );

const SMTP_USER =
  process.env.SMTP_USER;

const SMTP_PASS =
  process.env.SMTP_PASS;

const SMTP_FROM =
  process.env.SMTP_FROM ||

  `"Holy Trinity" <${SMTP_USER}>`;

/* =========================================================
   TRANSPORTER
========================================================= */

function getTransporter() {

  return nodemailer.createTransport({

    host:
      SMTP_HOST,

    port:
      SMTP_PORT,

    secure:
      SMTP_PORT === 465,

    auth: {

      user:
        SMTP_USER,

      pass:
        SMTP_PASS,
    },
  });
}

/* =========================================================
   CREATE NOTIFICATION RECORD
========================================================= */

async function createNotification(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_notifications",

    {

      user_id:
        payload.user_id || null,

      member_id:
        payload.member_id || null,

      notification_type:
        clean(
          payload.notification_type ||
          "system",
          120
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

      subject:
        nullable(
          payload.subject,
          255
        ),

      message:
        nullable(
          payload.message,
          10000
        ),

      status:
        payload.status ||
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

async function markNotificationSent(

  notificationId,

  providerMessageId = null
) {

  return updateExistingColumns(

    pool,

    "tbl_notifications",

    {

      status:
        "sent",

      provider_message_id:
        providerMessageId,

      sent_at:
        mysqlNow(),

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [notificationId]
  );
}

/* =========================================================
   MARK FAILED
========================================================= */

async function markNotificationFailed(

  notificationId,

  error
) {

  return updateExistingColumns(

    pool,

    "tbl_notifications",

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

    [notificationId]
  );
}

/* =========================================================
   SEND EMAIL
========================================================= */

async function sendEmail(
  payload = {}
) {

  const notificationId =
    await createNotification({

      ...payload,

      channel:
        "email",
    });

  try {

    const transporter =
      getTransporter();

    const info =
      await transporter.sendMail({

        from:
          SMTP_FROM,

        to:
          payload.to,

        cc:
          payload.cc || null,

        bcc:
          payload.bcc || null,

        subject:
          payload.subject ||

          "Notification",

        html:
          payload.html ||

          `<p>${payload.message || ""}</p>`,

        attachments:
          payload.attachments || [],
      });

    await markNotificationSent(

      notificationId,

      info.messageId
    );

    return {

      success: true,

      notification_id:
        notificationId,

      message_id:
        info.messageId,
    };

  } catch (err) {

    await markNotificationFailed(

      notificationId,

      err
    );

    console.error(
      "sendEmail error:",
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
   SEND SMS
========================================================= */

async function sendSms(
  payload = {}
) {

  const notificationId =
    await createNotification({

      ...payload,

      channel:
        "sms",
    });

  try {

    /* =====================================
       PLACEHOLDER
    ===================================== */

    console.log(
      "SMS SENT:",
      payload.to,
      payload.message
    );

    await markNotificationSent(
      notificationId
    );

    return {

      success: true,

      notification_id:
        notificationId,
    };

  } catch (err) {

    await markNotificationFailed(

      notificationId,

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
   SEND PUSH
========================================================= */

async function sendPushNotification(
  payload = {}
) {

  const notificationId =
    await createNotification({

      ...payload,

      channel:
        "push",
    });

  try {

    /* =====================================
       PLACEHOLDER
    ===================================== */

    console.log(
      "PUSH NOTIFICATION:",
      payload.title
    );

    await markNotificationSent(
      notificationId
    );

    return {

      success: true,

      notification_id:
        notificationId,
    };

  } catch (err) {

    await markNotificationFailed(

      notificationId,

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
   BULK EMAIL
========================================================= */

async function sendBulkEmail({

  recipients = [],

  subject,

  html,
}) {

  const results = [];

  for (const recipient of recipients) {

    const result =
      await sendEmail({

        to:
          recipient,

        subject,

        html,
      });

    results.push(result);
  }

  return {

    success: true,

    total:
      results.length,

    sent:
      results.filter(
        (r) => r.success
      ).length,

    failed:
      results.filter(
        (r) => !r.success
      ).length,

    results,
  };
}
/* =========================================================
   IN-APP NOTIFICATION
========================================================= */

async function sendInAppNotification(
  payload = {}
) {

  return createNotification({

    ...payload,

    channel:
      "in_app",

    status:
      "sent",
  });
}

/* =========================================================
   MARK READ
========================================================= */

async function markNotificationRead(
  notificationId
) {

  return updateExistingColumns(

    pool,

    "tbl_notifications",

    {

      is_read: 1,

      read_at:
        mysqlNow(),

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [notificationId]
  );
}

/* =========================================================
   USER NOTIFICATIONS
========================================================= */

async function getUserNotifications(

  userId,

  filters = {}
) {

  const limit =
    Math.min(
      100,
      Math.max(
        1,
        Number(filters.limit || 25)
      )
    );

  return pool.query(
    `
    SELECT *

    FROM tbl_notifications

    WHERE user_id = ?

    ORDER BY
      created_at DESC,
      id DESC

    LIMIT ?
    `,
    [userId, limit]
  )
  .then(([rows]) => rows);
}

/* =========================================================
   UNREAD COUNT
========================================================= */

async function getUnreadNotificationCount(
  userId
) {

  const [[row]] =
    await pool.query(
      `
      SELECT

        COUNT(*) AS total

      FROM tbl_notifications

      WHERE user_id = ?
        AND (
          is_read = 0
          OR is_read IS NULL
        )
      `,
      [userId]
    );

  return Number(
    row?.total || 0
  );
}

/* =========================================================
   RETRY FAILED EMAILS
========================================================= */

async function retryFailedEmails(
  limit = 20
) {

  const [rows] =
    await pool.query(
      `
      SELECT *

      FROM tbl_notifications

      WHERE channel = 'email'
        AND status = 'failed'

      ORDER BY
        updated_at ASC

      LIMIT ?
      `,
      [Number(limit)]
    );

  const results = [];

  for (const row of rows) {

    const result =
      await sendEmail({

        to:
          row.recipient,

        subject:
          row.subject,

        html:
          row.message,
      });

    results.push(result);
  }

  return {

    success: true,

    processed:
      results.length,

    sent:
      results.filter(
        (r) => r.success
      ).length,
  };
}

/* =========================================================
   BROADCAST
========================================================= */

async function sendBroadcastNotification({

  role = null,

  subject,

  message,

  html,
}) {

  let sql = `
    SELECT
      id,
      email,
      role
    FROM tbl_users
  `;

  const params = [];

  if (role) {

    sql += `
      WHERE role = ?
    `;

    params.push(role);
  }

  const [users] =
    await pool.query(
      sql,
      params
    );

  const results = [];

  for (const user of users) {

    const result =
      await sendEmail({

        user_id:
          user.id,

        to:
          user.email,

        subject,

        html:
          html ||

          `<p>${message}</p>`,

        message,
      });

    results.push(result);
  }

  return {

    success: true,

    total:
      results.length,

    sent:
      results.filter(
        (r) => r.success
      ).length,
  };
}

/* =========================================================
   NOTIFICATION STATS
========================================================= */

async function getNotificationStats() {

  const [[row]] =
    await pool.query(
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
            WHEN channel = 'email'
            THEN 1
            ELSE 0
          END
        ) AS emails,

        SUM(
          CASE
            WHEN channel = 'sms'
            THEN 1
            ELSE 0
          END
        ) AS sms,

        SUM(
          CASE
            WHEN channel = 'push'
            THEN 1
            ELSE 0
          END
        ) AS push_total

      FROM tbl_notifications
      `
    );

  return {

    total:
      Number(row.total || 0),

    sent:
      Number(row.sent || 0),

    failed:
      Number(row.failed || 0),

    emails:
      Number(row.emails || 0),

    sms:
      Number(row.sms || 0),

    push:
      Number(row.push_total || 0),
  };
}


/* =========================================================
   EXPORTS
========================================================= */

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
};