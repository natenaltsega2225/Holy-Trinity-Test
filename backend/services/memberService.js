// backend/services/memberService.js
"use strict";

const pool =
  require("../db");

const {
  findOne,
} = require(
  "../utils/dbHelpers"
);

/* =========================================================
   GET MEMBER ID FROM USER
========================================================= */

async function getMemberIdFromUser(
  userId
) {

  if (!userId) {
    return null;
  }

  const row =
    await findOne(

      pool,

      `
      SELECT

        member_id

      FROM tbl_users

      WHERE id = ?

      LIMIT 1
      `,

      [userId]
    );

  return (
    row?.member_id ||
    null
  );
}

/* =========================================================
   GET MEMBER BY USER
========================================================= */

async function getMemberByUser(
  userId
) {

  if (!userId) {
    return null;
  }

  return findOne(

    pool,

    `
    SELECT

      m.*,

      u.id AS user_id,
      u.email,
      u.role

    FROM tbl_members m

    INNER JOIN tbl_users u
      ON u.member_id = m.id

    WHERE u.id = ?

    LIMIT 1
    `,

    [userId]
  );
}

/* =========================================================
   GET MEMBER
========================================================= */

async function getMember(
  memberId
) {

  if (!memberId) {
    return null;
  }

  return findOne(

    pool,

    `
    SELECT *

    FROM tbl_members

    WHERE id = ?

    LIMIT 1
    `,

    [memberId]
  );
}

/* =========================================================
   MEMBER EXISTS
========================================================= */

async function memberExists(
  memberId
) {

  if (!memberId) {
    return false;
  }

  const row =
    await findOne(

      pool,

      `
      SELECT id

      FROM tbl_members

      WHERE id = ?

      LIMIT 1
      `,

      [memberId]
    );

  return !!row;
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  getMemberIdFromUser,

  getMemberByUser,

  getMember,

  memberExists,
};