//backend\services\passwordResetService.js

"use strict";

const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const pool = require("../db");

const {
  insertExistingColumns,
  updateExistingColumns,
} = require("../utils/dbHelpers");

const {
  mysqlNow,
} = require("../utils/financeHelpers");

/* =========================================================
   CONFIG
========================================================= */

const RESET_EXPIRATION_HOURS = 24;

/* =========================================================
   HELPERS
========================================================= */

function buildExpiryDate() {
  const d = new Date();

  d.setHours(
    d.getHours() + RESET_EXPIRATION_HOURS
  );

  return d;
}

function buildResetUrl(rawToken) {

  const base =
    process.env.FRONTEND_URL ||
    "http://18.224.63.249";

  return `${base}/reset-password?token=${rawToken}`;
}

/* =========================================================
   INVALIDATE OLD TOKENS
========================================================= */

async function invalidateExistingTokens(
  conn,
  userId
) {

  await conn.query(
    `
    UPDATE password_reset_tokens

    SET
      used_at = ?,
      updated_at = ?

    WHERE user_id = ?
      AND used_at IS NULL
    `,
    [
      mysqlNow(),
      mysqlNow(),
      userId,
    ]
  );
}

/* =========================================================
   CREATE RESET TOKEN
========================================================= */

async function createPasswordResetToken(
  userId
) {

  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  const conn =
    await pool.getConnection();

  try {

    await conn.beginTransaction();

    await invalidateExistingTokens(
      conn,
      userId
    );

    const rawToken =
      crypto
        .randomBytes(48)
        .toString("hex");

    const hashedToken =
      await bcrypt.hash(
        rawToken,
        10
      );

    const expiresAt =
      buildExpiryDate();

    const tokenId =
      await insertExistingColumns(
        conn,
        "password_reset_tokens",
        {

          user_id:
            userId,

          token_hash:
            hashedToken,

          expires_at:
            expiresAt,

          created_at:
            mysqlNow(),

          updated_at:
            mysqlNow(),
        }
      );

    await conn.commit();

    return {

      id:
        tokenId,

      raw_token:
        rawToken,

      reset_url:
        buildResetUrl(
          rawToken
        ),

      expires_at:
        expiresAt,
    };

  } catch (err) {

    await conn.rollback();

    throw err;

  } finally {

    conn.release();
  }
}

/* =========================================================
   VALIDATE TOKEN
========================================================= */

async function validateResetToken(
  rawToken
) {

  if (!rawToken) {

    return {
      valid: false,
      error:
        "Reset token is required.",
    };
  }

  const conn =
    await pool.getConnection();

  try {

    const [rows] =
      await conn.query(
        `
        SELECT *

        FROM password_reset_tokens

        WHERE used_at IS NULL

        ORDER BY id DESC
        `
      );

    for (const row of rows) {

      const isMatch =
        await bcrypt.compare(
          rawToken,
          row.token_hash
        );

      if (!isMatch) {
        continue;
      }

      const expires =
        new Date(
          row.expires_at
        );

      if (
        Number.isNaN(
          expires.getTime()
        )
      ) {

        return {
          valid: false,
          error:
            "Invalid reset token.",
        };
      }

      if (
        expires <
        new Date()
      ) {

        return {
          valid: false,
          error:
            "Reset token expired.",
        };
      }

      return {
        valid: true,
        token: row,
      };
    }

    return {
      valid: false,
      error:
        "Invalid reset token.",
    };

  } finally {

    conn.release();
  }
}

/* =========================================================
   MARK TOKEN USED
========================================================= */

async function markResetTokenUsed(
  conn,
  tokenId
) {

  await updateExistingColumns(
    conn,
    "password_reset_tokens",
    {

      used_at:
        mysqlNow(),

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [tokenId]
  );

  return true;
}

/* =========================================================
   RESET PASSWORD
========================================================= */

async function resetPassword({
  token,
  newPassword,
}) {

  if (!token) {
    throw new Error(
      "Reset token required."
    );
  }

  if (
    !newPassword ||
    String(newPassword)
      .length < 8
  ) {

    throw new Error(
      "Password must be at least 8 characters."
    );
  }

  const validation =
    await validateResetToken(
      token
    );

  if (!validation.valid) {

    throw new Error(
      validation.error
    );
  }

  const conn =
    await pool.getConnection();

  try {

    await conn.beginTransaction();

    const passwordHash =
      await bcrypt.hash(
        newPassword,
        12
      );

    await updateExistingColumns(
      conn,
      "tbl_users",
      {

        password:
          passwordHash,

        updated_at:
          mysqlNow(),
      },

      "id = ?",

      [
        validation.token
          .user_id,
      ]
    );

    await markResetTokenUsed(
      conn,
      validation.token.id
    );

    await conn.commit();

    return {
      success: true,
    };

  } catch (err) {

    await conn.rollback();

    throw err;

  } finally {

    conn.release();
  }
}

/* =========================================================
   CREATE TEMP PASSWORD
========================================================= */

function generateTemporaryPassword() {

  return `${crypto
    .randomBytes(8)
    .toString("base64url")}Aa1!`;
}

module.exports = {

  createPasswordResetToken,

  validateResetToken,

  resetPassword,

  markResetTokenUsed,

  generateTemporaryPassword,
};