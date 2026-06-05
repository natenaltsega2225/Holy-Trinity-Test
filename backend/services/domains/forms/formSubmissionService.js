// backend/services/domains/forms/formSubmissionService.js
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

function safeJson(
  value
) {

  try {

    return JSON.stringify(
      value || {}
    );

  } catch {

    return "{}";
  }
}

function normalizeStatus(
  status
) {

  const allowed = [

    "new",

    "pending",

    "approved",

    "rejected",

    "scheduled",

    "completed",
  ];

  const value =
    String(
      status || "new"
    ).toLowerCase();

  return allowed.includes(
    value
  )
    ? value
    : "new";
}

/* =========================================================
   CREATE SUBMISSION
========================================================= */

async function createFormSubmission(
  payload = {}
) {

  if (
    !payload.form_key
  ) {

    throw new Error(
      "form_key is required."
    );
  }

  const submissionId =
    await insertExistingColumns(

      pool,

      "tbl_form_submissions",

      {

        form_key:
          clean(
            payload.form_key,
            120
          ),

        form_name:
          nullable(
            payload.form_name,
            255
          ),

        category:
          nullable(
            payload.category,
            120
          ),

        user_id:
          payload.user_id || null,

        submitted_by:
          nullable(
            payload.submitted_by,
            180
          ),

        full_name:
          nullable(
            payload.full_name,
            180
          ),

        baptismal_name:
          nullable(
            payload.baptismal_name,
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
            40
          ),

        status:
          normalizeStatus(
            payload.status
          ),

        payload_json:
          safeJson(
            payload.payload ||
            payload.data
          ),

        notes:
          nullable(
            payload.notes,
            3000
          ),

        attachment_url:
          nullable(
            payload.attachment_url,
            500
          ),

        scheduled_date:
          payload.scheduled_date || null,

        reviewed_by:
          payload.reviewed_by || null,

        reviewed_at:
          payload.reviewed_at || null,

        created_at:
          mysqlNow(),

        updated_at:
          mysqlNow(),
      }
    );

  return {

    success: true,

    id:
      submissionId,
  };
}

/* =========================================================
   UPDATE SUBMISSION STATUS
========================================================= */

async function updateSubmissionStatus(

  submissionId,

  payload = {}
) {

  return updateExistingColumns(

    pool,

    "tbl_form_submissions",

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

      scheduled_date:
        payload.scheduled_date,

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [submissionId]
  );
}

/* =========================================================
   GET SUBMISSION
========================================================= */

async function getFormSubmission(
  submissionId
) {

  const row =
    await findOne(

      pool,

      `
      SELECT *

      FROM tbl_form_submissions

      WHERE id = ?

      LIMIT 1
      `,

      [submissionId]
    );

  if (!row) {

    return null;
  }

  try {

    row.payload =
      JSON.parse(
        row.payload_json || "{}"
      );

  } catch {

    row.payload = {};
  }

  return row;
}

/* =========================================================
   LIST SUBMISSIONS
========================================================= */

async function listFormSubmissions(
  filters = {}
) {

  const params = [];
  const where = [];

  if (
    filters.form_key
  ) {

    where.push(
      "form_key = ?"
    );

    params.push(
      filters.form_key
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
    filters.search
  ) {

    where.push(`
      (
        LOWER(full_name) LIKE LOWER(?)
        OR LOWER(email) LIKE LOWER(?)
        OR LOWER(phone) LIKE LOWER(?)
      )
    `);

    const q =
      `%${filters.search}%`;

    params.push(
      q,
      q,
      q
    );
  }

  const whereSql =
    where.length

      ? `WHERE ${where.join(" AND ")}`

      : "";

  const rows =
    await findMany(

      pool,

      `
      SELECT *

      FROM tbl_form_submissions

      ${whereSql}

      ORDER BY
        created_at DESC,
        id DESC
      `,

      params
    );

  return rows.map((row) => {

    try {

      row.payload =
        JSON.parse(
          row.payload_json || "{}"
        );

    } catch {

      row.payload = {};
    }

    return row;
  });
}

/* =========================================================
   DELETE SUBMISSION
========================================================= */

async function deleteFormSubmission(
  submissionId
) {

  return updateExistingColumns(

    pool,

    "tbl_form_submissions",

    {

      deleted_at:
        mysqlNow(),

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [submissionId]
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  createFormSubmission,

  updateSubmissionStatus,

  getFormSubmission,

  listFormSubmissions,

  deleteFormSubmission,
};