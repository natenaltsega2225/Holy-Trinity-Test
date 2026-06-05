// backend/services/domains/announcements/announcementService.js
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

  mysqlNow,

} = require(
  "../../../utils/financeHelpers"
);

const {

  sendBroadcastNotification,

} = require(
  "../notifications/notificationService"
);

/* =========================================================
   HELPERS
========================================================= */

function normalizeStatus(
  value
) {

  const allowed = [

    "draft",

    "published",

    "archived",
  ];

  const status =
    String(
      value || "draft"
    ).toLowerCase();

  return allowed.includes(
    status
  )
    ? status
    : "draft";
}

function normalizeAudience(
  value
) {

  const allowed = [

    "public",

    "members",

    "finance",

    "admins",

    "volunteers",
  ];

  const audience =
    String(
      value || "public"
    ).toLowerCase();

  return allowed.includes(
    audience
  )
    ? audience
    : "public";
}

/* =========================================================
   CREATE ANNOUNCEMENT
========================================================= */

async function createAnnouncement(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_announcements",

    {

      organization_id:
        payload.organization_id || null,

      title:
        clean(
          payload.title,
          255
        ),

      summary:
        nullable(
          payload.summary,
          1000
        ),

      body:
        nullable(
          payload.body,
          20000
        ),

      audience:
        normalizeAudience(
          payload.audience
        ),

      status:
        normalizeStatus(
          payload.status
        ),

      is_pinned:
        payload.is_pinned
          ? 1
          : 0,

      show_banner:
        payload.show_banner
          ? 1
          : 0,

      banner_color:
        nullable(
          payload.banner_color,
          40
        ),

      start_date:
        payload.start_date || null,

      end_date:
        payload.end_date || null,

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
   UPDATE ANNOUNCEMENT
========================================================= */

async function updateAnnouncement(

  announcementId,

  payload = {}
) {

  return updateExistingColumns(

    pool,

    "tbl_announcements",

    {

      title:
        payload.title,

      summary:
        payload.summary,

      body:
        payload.body,

      audience:
        payload.audience
          ? normalizeAudience(
              payload.audience
            )
          : undefined,

      status:
        payload.status
          ? normalizeStatus(
              payload.status
            )
          : undefined,

      is_pinned:
        payload.is_pinned,

      show_banner:
        payload.show_banner,

      banner_color:
        payload.banner_color,

      start_date:
        payload.start_date,

      end_date:
        payload.end_date,

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [announcementId]
  );
}

/* =========================================================
   GET ANNOUNCEMENT
========================================================= */

async function getAnnouncement(
  announcementId
) {

  return findOne(

    pool,

    `
    SELECT *

    FROM tbl_announcements

    WHERE id = ?

    LIMIT 1
    `,

    [announcementId]
  );
}

/* =========================================================
   LIST ANNOUNCEMENTS
========================================================= */

async function listAnnouncements(
  filters = {}
) {

  const where = [];
  const params = [];

  if (
    filters.status
  ) {

    where.push(
      "status = ?"
    );

    params.push(
      filters.status
    );
  }

  if (
    filters.audience
  ) {

    where.push(
      "audience = ?"
    );

    params.push(
      filters.audience
    );
  }

  if (
    filters.organization_id
  ) {

    where.push(
      "organization_id = ?"
    );

    params.push(
      filters.organization_id
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

    FROM tbl_announcements

    ${whereSql}

    ORDER BY
      is_pinned DESC,
      created_at DESC
    `,

    params
  );
}

/* =========================================================
   ACTIVE ANNOUNCEMENTS
========================================================= */

async function getActiveAnnouncements(
  audience = "public"
) {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_announcements

    WHERE status = 'published'
      AND audience = ?
      AND (
        start_date IS NULL
        OR start_date <= NOW()
      )
      AND (
        end_date IS NULL
        OR end_date >= NOW()
      )

    ORDER BY
      is_pinned DESC,
      created_at DESC
    `,

    [audience]
  );
}

/* =========================================================
   PUBLISH ANNOUNCEMENT
========================================================= */

async function publishAnnouncement(
  announcementId
) {

  return updateExistingColumns(

    pool,

    "tbl_announcements",

    {

      status:
        "published",

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [announcementId]
  );
}

/* =========================================================
   ARCHIVE ANNOUNCEMENT
========================================================= */

async function archiveAnnouncement(
  announcementId
) {

  return updateExistingColumns(

    pool,

    "tbl_announcements",

    {

      status:
        "archived",

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [announcementId]
  );
}

/* =========================================================
   SEND BROADCAST
========================================================= */

async function sendAnnouncementBroadcast(
  announcementId
) {

  const announcement =
    await getAnnouncement(
      announcementId
    );

  if (!announcement) {

    throw new Error(
      "Announcement not found."
    );
  }

  let role = null;

  switch (
    announcement.audience
  ) {

    case "finance":

      role = "finance";
      break;

    case "admins":

      role = "admin";
      break;

    case "members":

      role = "member";
      break;

    default:

      role = null;
  }

  return sendBroadcastNotification({

    role,

    subject:
      announcement.title,

    message:
      announcement.summary,

    html:
      `
      <h2>
        ${announcement.title}
      </h2>

      <div>
        ${announcement.body || ""}
      </div>
      `,
  });
}

/* =========================================================
   ANNOUNCEMENT STATS
========================================================= */

async function getAnnouncementStats() {

  return findMany(

    pool,

    `
    SELECT

      audience,

      status,

      COUNT(*) AS total

    FROM tbl_announcements

    GROUP BY
      audience,
      status

    ORDER BY total DESC
    `,

    []
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  createAnnouncement,

  updateAnnouncement,

  getAnnouncement,

  listAnnouncements,

  getActiveAnnouncements,

  publishAnnouncement,

  archiveAnnouncement,

  sendAnnouncementBroadcast,

  getAnnouncementStats,
};