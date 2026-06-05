// backend/services/domains/activity/activityFeedService.js
"use strict";

const pool =
  require("../../../db");

const {

  insertExistingColumns,

  findMany,

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
   HELPERS
========================================================= */

function normalizeType(
  value
) {

  const allowed = [

    "payment",

    "invoice",

    "receipt",

    "member",

    "event",

    "volunteer",

    "security",

    "system",

    "reconciliation",

    "notification",
  ];

  const type =
    String(
      value || "system"
    ).toLowerCase();

  return allowed.includes(
    type
  )
    ? type
    : "system";
}

function normalizeSeverity(
  value
) {

  const allowed = [

    "info",

    "success",

    "warning",

    "danger",
  ];

  const severity =
    String(
      value || "info"
    ).toLowerCase();

  return allowed.includes(
    severity
  )
    ? severity
    : "info";
}

/* =========================================================
   CREATE ACTIVITY
========================================================= */

async function createActivity(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_activity_feed",

    {

      activity_type:
        normalizeType(
          payload.activity_type
        ),

      severity:
        normalizeSeverity(
          payload.severity
        ),

      title:
        clean(
          payload.title,
          255
        ),

      message:
        nullable(
          payload.message,
          5000
        ),

      user_id:
        payload.user_id || null,

      member_id:
        payload.member_id || null,

      entity_type:
        nullable(
          payload.entity_type,
          120
        ),

      entity_id:
        payload.entity_id || null,

      icon:
        nullable(
          payload.icon,
          120
        ),

      route_url:
        nullable(
          payload.route_url,
          500
        ),

      meta_json:
        payload.meta
          ? JSON.stringify(
              payload.meta
            )
          : null,

      created_at:
        mysqlNow(),
    }
  );
}

/* =========================================================
   PAYMENT ACTIVITY
========================================================= */

async function logPaymentActivity(
  payload = {}
) {

  return createActivity({

    activity_type:
      "payment",

    severity:
      "success",

    title:
      "Payment Received",

    message:
      `
      ${payload.full_name || "Member"}
      made a payment of
      $${payload.amount || 0}
      `.trim(),

    user_id:
      payload.user_id,

    member_id:
      payload.member_id,

    entity_type:
      "payment",

    entity_id:
      payload.payment_id,

    icon:
      "credit-card",

    route_url:
      payload.route_url,
  });
}

/* =========================================================
   INVOICE ACTIVITY
========================================================= */

async function logInvoiceActivity(
  payload = {}
) {

  return createActivity({

    activity_type:
      "invoice",

    severity:
      "info",

    title:
      "Invoice Created",

    message:
      `
      Invoice
      ${payload.invoice_number || ""}
      was created.
      `.trim(),

    user_id:
      payload.user_id,

    entity_type:
      "invoice",

    entity_id:
      payload.invoice_id,

    icon:
      "file-text",
  });
}

/* =========================================================
   MEMBER ACTIVITY
========================================================= */

async function logMemberActivity(
  payload = {}
) {

  return createActivity({

    activity_type:
      "member",

    severity:
      "success",

    title:
      payload.title ||
      "Member Activity",

    message:
      payload.message,

    user_id:
      payload.user_id,

    member_id:
      payload.member_id,

    entity_type:
      "member",

    entity_id:
      payload.member_id,

    icon:
      "users",
  });
}

/* =========================================================
   SECURITY ACTIVITY
========================================================= */

async function logSecurityActivity(
  payload = {}
) {

  return createActivity({

    activity_type:
      "security",

    severity:
      payload.severity ||
      "warning",

    title:
      payload.title ||
      "Security Event",

    message:
      payload.message,

    user_id:
      payload.user_id,

    icon:
      "shield-alert",
  });
}

/* =========================================================
   VOLUNTEER ACTIVITY
========================================================= */

async function logVolunteerActivity(
  payload = {}
) {

  return createActivity({

    activity_type:
      "volunteer",

    severity:
      "success",

    title:
      payload.title ||
      "Volunteer Activity",

    message:
      payload.message,

    user_id:
      payload.user_id,

    member_id:
      payload.member_id,

    entity_type:
      "volunteer",

    entity_id:
      payload.entity_id,

    icon:
      "heart-handshake",
  });
}

/* =========================================================
   RECONCILIATION ACTIVITY
========================================================= */

async function logReconciliationActivity(
  payload = {}
) {

  return createActivity({

    activity_type:
      "reconciliation",

    severity:
      payload.severity ||
      "info",

    title:
      payload.title ||
      "Reconciliation Activity",

    message:
      payload.message,

    user_id:
      payload.user_id,

    entity_type:
      "reconciliation",

    entity_id:
      payload.entity_id,

    icon:
      "scale",
  });
}

/* =========================================================
   LIST ACTIVITIES
========================================================= */

async function listActivities(
  filters = {}
) {

  const where = [];
  const params = [];

  if (
    filters.activity_type
  ) {

    where.push(
      "activity_type = ?"
    );

    params.push(
      filters.activity_type
    );
  }

  if (
    filters.user_id
  ) {

    where.push(
      "user_id = ?"
    );

    params.push(
      filters.user_id
    );
  }

  if (
    filters.member_id
  ) {

    where.push(
      "member_id = ?"
    );

    params.push(
      filters.member_id
    );
  }

  const limit =
    Math.min(
      200,
      Math.max(
        1,
        Number(filters.limit || 50)
      )
    );

  const whereSql =
    where.length

      ? `WHERE ${where.join(" AND ")}`

      : "";

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_activity_feed

    ${whereSql}

    ORDER BY
      created_at DESC,
      id DESC

    LIMIT ?
    `,

    [...params, limit]
  );
}

/* =========================================================
   RECENT ACTIVITIES
========================================================= */

async function getRecentActivities(
  limit = 20
) {

  return listActivities({
    limit,
  });
}

/* =========================================================
   ACTIVITY STATS
========================================================= */

async function getActivityStats() {

  const rows =
    await findMany(

      pool,

      `
      SELECT

        activity_type,

        COUNT(*) AS total

      FROM tbl_activity_feed

      GROUP BY activity_type

      ORDER BY total DESC
      `,

      []
    );

  return rows;
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  createActivity,

  logPaymentActivity,

  logInvoiceActivity,

  logMemberActivity,

  logSecurityActivity,

  logVolunteerActivity,

  logReconciliationActivity,

  listActivities,

  getRecentActivities,

  getActivityStats,
};