// backend/services/domains/events/eventService.js
"use strict";

const pool =
  require("../../../db");

const {

  insertExistingColumns,

  updateExistingColumns,

  findOne,

  findMany,

} = require(
  "../../../utils/dbHelpers"
);

const {

  clean,

  nullable,

  money,

  mysqlNow,

} = require(
  "../../../utils/financeHelpers"
);

/* =========================================================
   HELPERS
========================================================= */

function normalizeStatus(
  status
) {

  const allowed = [

    "draft",

    "published",

    "cancelled",

    "completed",

    "closed",
  ];

  const value =
    String(
      status || "draft"
    ).toLowerCase();

  return allowed.includes(
    value
  )
    ? value
    : "draft";
}

/* =========================================================
   CREATE EVENT
========================================================= */

async function createEvent(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_news_events",

    {

      category:
        clean(
          payload.category,
          120
        ),

      title:
        clean(
          payload.title,
          255
        ),

      subtitle:
        nullable(
          payload.subtitle,
          255
        ),

      summary:
        nullable(
          payload.summary,
          3000
        ),

      body_html:
        nullable(
          payload.body_html,
          50000
        ),

      start_date:
        payload.start_date || null,

      end_date:
        payload.end_date || null,

      time_text:
        nullable(
          payload.time_text,
          255
        ),

      location:
        nullable(
          payload.location,
          255
        ),

      audience:
        nullable(
          payload.audience,
          255
        ),

      flyer_url:
        nullable(
          payload.flyer_url,
          500
        ),

      pdf_url:
        nullable(
          payload.pdf_url,
          500
        ),

      registration_required:
        payload.registration_required
          ? 1
          : 0,

      registration_fee:
        money(
          payload.registration_fee || 0
        ),

      max_capacity:
        payload.max_capacity || null,

      status:
        normalizeStatus(
          payload.status
        ),

      is_published:
        payload.is_published
          ? 1
          : 0,

      created_by:
        payload.created_by || null,

      created_at:
        mysqlNow(),

      updated_at:
        mysqlNow(),
    }
  );
}

/* =========================================================
   UPDATE EVENT
========================================================= */

async function updateEvent(

  eventId,

  payload = {}
) {

  return updateExistingColumns(

    pool,

    "tbl_news_events",

    {

      category:
        payload.category,

      title:
        payload.title,

      subtitle:
        payload.subtitle,

      summary:
        payload.summary,

      body_html:
        payload.body_html,

      start_date:
        payload.start_date,

      end_date:
        payload.end_date,

      time_text:
        payload.time_text,

      location:
        payload.location,

      audience:
        payload.audience,

      flyer_url:
        payload.flyer_url,

      pdf_url:
        payload.pdf_url,

      registration_required:
        payload.registration_required,

      registration_fee:
        payload.registration_fee,

      max_capacity:
        payload.max_capacity,

      status:
        payload.status
          ? normalizeStatus(
              payload.status
            )
          : undefined,

      is_published:
        payload.is_published,

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [eventId]
  );
}

/* =========================================================
   GET EVENT
========================================================= */

async function getEvent(
  eventId
) {

  return findOne(

    pool,

    `
    SELECT *

    FROM tbl_news_events

    WHERE id = ?

    LIMIT 1
    `,

    [eventId]
  );
}

/* =========================================================
   LIST EVENTS
========================================================= */

async function listEvents(
  filters = {}
) {

  const params = [];
  const where = [];

  if (
    filters.category
  ) {

    where.push(
      "category = ?"
    );

    params.push(
      filters.category
    );
  }

  if (
    filters.is_published !== undefined
  ) {

    where.push(
      "is_published = ?"
    );

    params.push(
      filters.is_published
        ? 1
        : 0
    );
  }

  if (
    filters.status
  ) {

    where.push(
      "status = ?"
    );

    params.push(
      normalizeStatus(
        filters.status
      )
    );
  }

  const whereSql =
    where.length

      ? `WHERE ${where.join(" AND ")}`

      : "";

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_news_events

    ${whereSql}

    ORDER BY
      start_date DESC,
      id DESC
    `,

    params
  );
}

/* =========================================================
   REGISTER ATTENDEE
========================================================= */

async function registerEventAttendee(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_event_program_registrations",

    {

      event_id:
        payload.event_id,

      member_id:
        payload.member_id || null,

      user_id:
        payload.user_id || null,

      full_name:
        clean(
          payload.full_name,
          180
        ),

      email:
        nullable(
          payload.email,
          180
        ),

      phone:
        nullable(
          payload.phone,
          50
        ),

      participants:
        payload.participants || 1,

      amount_paid:
        money(
          payload.amount_paid || 0
        ),

      payment_status:
        payload.payment_status ||
        "pending",

      attendance_status:
        payload.attendance_status ||
        "registered",

      notes:
        nullable(
          payload.notes,
          3000
        ),

      created_at:
        mysqlNow(),

      updated_at:
        mysqlNow(),
    }
  );
}

/* =========================================================
   EVENT REGISTRATIONS
========================================================= */

async function listEventRegistrations(
  eventId
) {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_event_program_registrations

    WHERE event_id = ?

    ORDER BY
      created_at DESC
    `,

    [eventId]
  );
}

/* =========================================================
   EVENT SUMMARY
========================================================= */

async function getEventSummary(
  eventId
) {

  return findOne(

    pool,

    `
    SELECT

      COUNT(*) AS registrations,

      COALESCE(
        SUM(participants),
        0
      ) AS participants,

      COALESCE(
        SUM(amount_paid),
        0
      ) AS revenue

    FROM tbl_event_program_registrations

    WHERE event_id = ?
    `,

    [eventId]
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  createEvent,

  updateEvent,

  getEvent,

  listEvents,

  registerEventAttendee,

  listEventRegistrations,

  getEventSummary,
};