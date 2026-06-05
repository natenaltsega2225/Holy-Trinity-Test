// backend/services/domains/volunteer/volunteerService.js
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

/* =========================================================
   HELPERS
========================================================= */

function normalizeStatus(
  status
) {

  const allowed = [

    "draft",

    "published",

    "closed",

    "cancelled",

    "pending",

    "approved",

    "rejected",

    "completed",
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

/* =========================================================
   CREATE VOLUNTEER POST
========================================================= */

async function createVolunteerPost(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_serve_posts",

    {

      category:
        clean(
          payload.category,
          120
        ),

      role_name:
        clean(
          payload.role_name,
          180
        ),

      title:
        clean(
          payload.title,
          255
        ),

      description:
        nullable(
          payload.description,
          10000
        ),

      location:
        nullable(
          payload.location,
          255
        ),

      activity_date:
        payload.activity_date || null,

      start_time:
        payload.start_time || null,

      end_time:
        payload.end_time || null,

      required_volunteers:
        payload.required_volunteers || 0,

      status:
        normalizeStatus(
          payload.status ||
          "draft"
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
   UPDATE VOLUNTEER POST
========================================================= */

async function updateVolunteerPost(

  postId,

  payload = {}
) {

  return updateExistingColumns(

    pool,

    "tbl_serve_posts",

    {

      category:
        payload.category,

      role_name:
        payload.role_name,

      title:
        payload.title,

      description:
        payload.description,

      location:
        payload.location,

      activity_date:
        payload.activity_date,

      start_time:
        payload.start_time,

      end_time:
        payload.end_time,

      required_volunteers:
        payload.required_volunteers,

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

    [postId]
  );
}

/* =========================================================
   LIST VOLUNTEER POSTS
========================================================= */

async function listVolunteerPosts(
  filters = {}
) {

  const params = [];
  const where = [];

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
    filters.category
  ) {

    where.push(
      "category = ?"
    );

    params.push(
      filters.category
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

    FROM tbl_serve_posts

    ${whereSql}

    ORDER BY
      activity_date DESC,
      id DESC
    `,

    params
  );
}

/* =========================================================
   CREATE APPLICATION
========================================================= */

async function createVolunteerApplication(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_volunteer_applications",

    {

      post_id:
        payload.post_id,

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

      notes:
        nullable(
          payload.notes,
          5000
        ),

      status:
        normalizeStatus(
          payload.status
        ),

      created_at:
        mysqlNow(),

      updated_at:
        mysqlNow(),
    }
  );
}

/* =========================================================
   UPDATE APPLICATION STATUS
========================================================= */

async function updateVolunteerApplicationStatus(

  applicationId,

  payload = {}
) {

  return updateExistingColumns(

    pool,

    "tbl_volunteer_applications",

    {

      status:
        normalizeStatus(
          payload.status
        ),

      reviewed_by:
        payload.reviewed_by || null,

      reviewed_at:
        mysqlNow(),

      notes:
        payload.notes,

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [applicationId]
  );
}

/* =========================================================
   LIST APPLICATIONS
========================================================= */

async function listVolunteerApplications(
  filters = {}
) {

  const params = [];
  const where = [];

  if (
    filters.post_id
  ) {

    where.push(
      "a.post_id = ?"
    );

    params.push(
      filters.post_id
    );
  }

  if (
    filters.status
  ) {

    where.push(
      "a.status = ?"
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
    SELECT

      a.*,

      p.title AS post_title,

      p.activity_date

    FROM tbl_volunteer_applications a

    LEFT JOIN tbl_serve_posts p
      ON p.id = a.post_id

    ${whereSql}

    ORDER BY
      a.created_at DESC
    `,

    params
  );
}

/* =========================================================
   LOG VOLUNTEER HOURS
========================================================= */

async function logVolunteerHours(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_volunteer_hours",

    {

      member_id:
        payload.member_id || null,

      user_id:
        payload.user_id || null,

      application_id:
        payload.application_id || null,

      category:
        nullable(
          payload.category,
          120
        ),

      activity_name:
        clean(
          payload.activity_name,
          255
        ),

      service_date:
        payload.service_date,

      start_time:
        payload.start_time || null,

      end_time:
        payload.end_time || null,

      total_hours:
        payload.total_hours || 0,

      notes:
        nullable(
          payload.notes,
          5000
        ),

      approved_by:
        payload.approved_by || null,

      approved_at:
        payload.approved_at || null,

      created_at:
        mysqlNow(),

      updated_at:
        mysqlNow(),
    }
  );
}

/* =========================================================
   VOLUNTEER HOURS SUMMARY
========================================================= */

async function getVolunteerHoursSummary() {

  return findMany(

    pool,

    `
    SELECT

      member_id,

      COUNT(*) AS entries,

      COALESCE(
        SUM(total_hours),
        0
      ) AS total_hours

    FROM tbl_volunteer_hours

    GROUP BY member_id

    ORDER BY total_hours DESC
    `,

    []
  );
}

/* =========================================================
   TOP VOLUNTEERS
========================================================= */

async function getTopVolunteers(
  limit = 10
) {

  return findMany(

    pool,

    `
    SELECT

      v.member_id,

      m.full_name,

      COUNT(*) AS activities,

      COALESCE(
        SUM(v.total_hours),
        0
      ) AS total_hours

    FROM tbl_volunteer_hours v

    LEFT JOIN tbl_members m
      ON m.id = v.member_id

    GROUP BY v.member_id

    ORDER BY total_hours DESC

    LIMIT ?
    `,

    [Number(limit)]
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  createVolunteerPost,

  updateVolunteerPost,

  listVolunteerPosts,

  createVolunteerApplication,

  updateVolunteerApplicationStatus,

  listVolunteerApplications,

  logVolunteerHours,

  getVolunteerHoursSummary,

  getTopVolunteers,
};