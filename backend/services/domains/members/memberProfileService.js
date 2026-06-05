// backend/services/domains/members/memberProfileService.js
"use strict";

const pool =
  require("../../../db");

const {

  findOne,

  findMany,

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
   GET MEMBER PROFILE
========================================================= */

async function getMemberProfile(
  memberId
) {

  return findOne(

    pool,

    `
    SELECT

      m.*,

      u.email AS user_email,

      u.role AS user_role,

      u.last_login_at

    FROM tbl_members m

    LEFT JOIN tbl_users u
      ON u.id = m.user_id

    WHERE m.id = ?

    LIMIT 1
    `,

    [memberId]
  );
}

/* =========================================================
   GET MEMBER BY USER
========================================================= */

async function getMemberByUserId(
  userId
) {

  return findOne(

    pool,

    `
    SELECT *

    FROM tbl_members

    WHERE user_id = ?

    LIMIT 1
    `,

    [userId]
  );
}

/* =========================================================
   UPDATE MEMBER PROFILE
========================================================= */

async function updateMemberProfile(

  memberId,

  payload = {}
) {

  return updateExistingColumns(

    pool,

    "tbl_members",

    {

      full_name:
        payload.full_name,

      baptismal_name:
        payload.baptismal_name,

      phone:
        payload.phone,

      alternate_phone:
        payload.alternate_phone,

      address:
        payload.address,

      city:
        payload.city,

      state:
        payload.state,

      zip_code:
        payload.zip_code,

      emergency_contact_name:
        payload.emergency_contact_name,

      emergency_contact_phone:
        payload.emergency_contact_phone,

      occupation:
        payload.occupation,

      marital_status:
        payload.marital_status,

      profile_photo_url:
        payload.profile_photo_url,

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [memberId]
  );
}

/* =========================================================
   MEMBER SEARCH
========================================================= */

async function searchMembers(
  search
) {

  const q =
    `%${String(search || "").trim()}%`;

  return findMany(

    pool,

    `
    SELECT

      id,

      member_no,

      full_name,

      baptismal_name,

      phone,

      email,

      membership_status

    FROM tbl_members

    WHERE

      LOWER(full_name) LIKE LOWER(?)
      OR LOWER(email) LIKE LOWER(?)
      OR LOWER(phone) LIKE LOWER(?)
      OR LOWER(member_no) LIKE LOWER(?)

    ORDER BY full_name ASC

    LIMIT 50
    `,

    [q, q, q, q]
  );
}

/* =========================================================
   MEMBER HOUSEHOLD
========================================================= */

async function getMemberHousehold(
  memberId
) {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_member_household

    WHERE member_id = ?

    ORDER BY relationship ASC
    `,

    [memberId]
  );
}

/* =========================================================
   MEMBER DASHBOARD SUMMARY
========================================================= */

async function getMemberDashboardSummary(
  memberId
) {

  const [

    payments,

    invoices,

    receipts,

    requests,

  ] = await Promise.all([

    findOne(

      pool,

      `
      SELECT
        COUNT(*) AS total
      FROM tbl_finance_payments
      WHERE member_id = ?
      `,

      [memberId]
    ),

    findOne(

      pool,

      `
      SELECT
        COUNT(*) AS total
      FROM tbl_finance_invoices
      WHERE member_id = ?
      `,

      [memberId]
    ),

    findOne(

      pool,

      `
      SELECT
        COUNT(*) AS total
      FROM tbl_finance_receipts r
      INNER JOIN tbl_finance_payments p
        ON p.id = r.payment_id
      WHERE p.member_id = ?
      `,

      [memberId]
    ),

    findOne(

      pool,

      `
      SELECT
        COUNT(*) AS total
      FROM tbl_form_submissions
      WHERE user_id = (
        SELECT user_id
        FROM tbl_members
        WHERE id = ?
        LIMIT 1
      )
      `,

      [memberId]
    ),
  ]);

  return {

    payments:
      Number(
        payments?.total || 0
      ),

    invoices:
      Number(
        invoices?.total || 0
      ),

    receipts:
      Number(
        receipts?.total || 0
      ),

    requests:
      Number(
        requests?.total || 0
      ),
  };
}

/* =========================================================
   ACTIVE MEMBERS
========================================================= */

async function listActiveMembers() {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_members

    WHERE membership_status = 'active'

    ORDER BY full_name ASC
    `,

    []
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  getMemberProfile,

  getMemberByUserId,

  updateMemberProfile,

  searchMembers,

  getMemberHousehold,

  getMemberDashboardSummary,

  listActiveMembers,
};