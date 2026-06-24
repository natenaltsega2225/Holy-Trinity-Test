// backend/services/domains/security/authService.js

"use strict";

const jwt = require("jsonwebtoken");
const argon2 = require("argon2");

let bcrypt = null;

try {
  bcrypt = require("bcryptjs");
} catch {
  bcrypt = null;
}

const pool = require("../../../db");
const auditService = require("./auditService");
const mfaService = require("./mfaService");

const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.ACCESS_TOKEN_SECRET ||
  "CHANGE_ME_IN_ENV";

const JWT_EXPIRES_IN =
  process.env.JWT_EXPIRES_IN || "15m";

const MAX_FAILED_LOGINS =
  Number(process.env.MAX_FAILED_LOGINS || 5);

const LOCK_MINUTES =
  Number(process.env.ACCOUNT_LOCK_MINUTES || 30);

const MFA_REQUIRED_ROLES =
  new Set([
    "super_admin",
    "admin",
    "it_admin",
    "finance",
  ]);

function toUserId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error("Invalid user ID.");
    err.status = 400;
    throw err;
  }

  return id;
}

function requestIp(req = {}) {
  const forwarded =
    req.headers?.["x-forwarded-for"];

  if (forwarded) {
    return String(forwarded)
      .split(",")[0]
      .trim();
  }

  return (
    req.ip ||
    req.socket?.remoteAddress ||
    null
  );
}

function userAgent(req = {}) {
  return req.headers?.["user-agent"] || null;
}

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase();
}

function isLocked(user) {
  if (!user?.account_locked_until) {
    return false;
  }

  const lockedUntil =
    new Date(
      user.account_locked_until
    ).getTime();

  return (
    Number.isFinite(lockedUntil) &&
    lockedUntil > Date.now()
  );
}

function requiresMfa(user) {
  const role =
    normalizeRole(user?.role);

  return MFA_REQUIRED_ROLES.has(role);
}

function accountIsDisabled(user) {
  return (
    Number(user?.is_active) !== 1 ||
    ["disabled", "inactive", "suspended"].includes(
      String(user?.account_status || "")
        .toLowerCase()
    )
  );
}

function safeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    member_id: user.member_id || null,
    member_no: user.member_no || null,
    username: user.username || null,
    email: user.email || null,
    full_name: user.full_name || null,
    role: user.role || "member",
    is_active: Number(user.is_active || 0),
    account_status:
      user.account_status || null,
    must_change_password: Number(
      user.must_change_password || 0
    ),
    mfa_enabled: Number(
      user.mfa_enabled || 0
    ),
  };
}

function signAccessToken(
  user,
  extra = {}
) {
  if (!user?.id) {
    throw new Error(
      "Cannot sign token without user ID."
    );
  }

  return jwt.sign(
    {
      id: user.id,
      member_id: user.member_id || null,
      member_no: user.member_no || null,
      email: user.email || null,
      username:
        user.username || user.email || null,
      full_name:
        user.full_name || null,
      role: user.role || "member",
      is_active:
        Number(user.is_active || 0),
      account_status:
        user.account_status || null,
      must_change_password:
        Number(
          user.must_change_password || 0
        ),
      mfa_verified:
        Boolean(extra.mfa_verified),
      session_type: "access",
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
    }
  );
}

async function verifyPassword(
  user,
  password
) {
  const hash =
    String(user?.password_hash || "");

  const plain =
    String(password || "");

  if (!hash || !plain) {
    return false;
  }

  if (hash.startsWith("$argon2")) {
    try {
      return await argon2.verify(
        hash,
        plain
      );
    } catch {
      return false;
    }
  }

  if (
    bcrypt &&
    /^\$2[aby]\$/.test(hash)
  ) {
    try {
      return await bcrypt.compare(
        plain,
        hash
      );
    } catch {
      return false;
    }
  }

  return false;
}

async function findUserByLogin(
  identifier
) {
  const value =
    String(identifier || "")
      .trim()
      .toLowerCase();

  if (!value) return null;

  const [rows] = await pool.query(
    `
    SELECT
      u.*,
      m.member_no
    FROM tbl_users u
    LEFT JOIN tbl_members m
      ON m.id = u.member_id
    WHERE
      LOWER(u.email) = ?
      OR LOWER(u.username) = ?
      OR LOWER(m.member_no) = ?
      OR CAST(u.id AS CHAR) = ?
    LIMIT 1
    `,
    [
      value,
      value,
      value,
      value,
    ]
  );

  return rows[0] || null;
}

async function getUserById(userId) {
  const id = toUserId(userId);

  const [rows] = await pool.query(
    `
    SELECT
      u.*,
      m.member_no
    FROM tbl_users u
    LEFT JOIN tbl_members m
      ON m.id = u.member_id
    WHERE u.id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

async function recordLoginSuccess({
  user,
  req = null,
  mfaVerified = false,
}) {
  await pool.query(
    `
    UPDATE tbl_users
    SET
      failed_login_attempts = 0,
      account_locked_until = NULL,
      account_status =
        CASE
          WHEN account_status = 'locked'
          THEN 'active'
          ELSE account_status
        END,
      last_login_at = NOW(),
      last_login_ip = ?,
      updated_at = NOW()
    WHERE id = ?
    `,
    [
      requestIp(req),
      user.id,
    ]
  );

  await auditService
    .logSecurityEvent({
      req,
      actorUserId: user.id,
      targetUserId: user.id,
      action: mfaVerified
        ? "LOGIN_SUCCESS_MFA"
        : "LOGIN_SUCCESS",
      status: "success",
      entityType: "user",
      entityId: user.id,
      newValue: {
        ip: requestIp(req),
        user_agent: userAgent(req),
      },
    })
    .catch(() => null);
}

async function recordLoginFailure({
  user = null,
  identifier = "",
  req = null,
  reason = "invalid_credentials",
}) {
  if (!user) {
    await auditService
      .logSecurityEvent({
        req,
        action: "LOGIN_FAILED",
        status: "failed",
        entityType: "auth",
        notes:
          "Unknown login identifier.",
        newValue: {
          identifier:
            String(identifier || "")
              .slice(0, 190),
          reason,
          ip: requestIp(req),
        },
      })
      .catch(() => null);

    return;
  }

  const attempts =
    Number(
      user.failed_login_attempts || 0
    ) + 1;

  const lockedUntil =
    attempts >= MAX_FAILED_LOGINS
      ? new Date(
          Date.now() +
            LOCK_MINUTES *
              60 *
              1000
        )
      : null;

  await pool.query(
    `
    UPDATE tbl_users
    SET
      failed_login_attempts = ?,
      account_locked_until = ?,
      account_status =
        CASE
          WHEN ? IS NULL
          THEN account_status
          ELSE 'locked'
        END,
      updated_at = NOW()
    WHERE id = ?
    `,
    [
      attempts,
      lockedUntil,
      lockedUntil,
      user.id,
    ]
  );

  await auditService
    .logSecurityEvent({
      req,
      actorUserId: user.id,
      targetUserId: user.id,
      action: lockedUntil
        ? "ACCOUNT_LOCKED"
        : "LOGIN_FAILED",
      status: "failed",
      entityType: "user",
      entityId: user.id,
      newValue: {
        failed_login_attempts:
          attempts,
        account_locked_until:
          lockedUntil,
        reason,
        ip: requestIp(req),
      },
    })
    .catch(() => null);
}

async function login({
  identifier,
  password,
  req = null,
}) {
  const user =
    await findUserByLogin(
      identifier
    );

  if (!user) {
    await recordLoginFailure({
      identifier,
      req,
      reason: "user_not_found",
    });

    const err = new Error(
      "Invalid login credentials."
    );
    err.status = 401;
    throw err;
  }

  if (accountIsDisabled(user)) {
    const err = new Error(
      "Account is disabled."
    );
    err.status = 403;
    throw err;
  }

  if (isLocked(user)) {
    const err = new Error(
      "Account is temporarily locked."
    );
    err.status = 423;
    throw err;
  }

  const validPassword =
    await verifyPassword(
      user,
      password
    );

  if (!validPassword) {
    await recordLoginFailure({
      user,
      identifier,
      req,
      reason: "bad_password",
    });

    const err = new Error(
      "Invalid login credentials."
    );
    err.status = 401;
    throw err;
  }

  if (requiresMfa(user)) {
    await auditService
      .logSecurityEvent({
        req,
        actorUserId: user.id,
        targetUserId: user.id,
        action: "MFA_REQUIRED",
        status: "success",
        entityType: "user",
        entityId: user.id,
      })
      .catch(() => null);

    return {
      ok: true,
      mfa_required: true,
      user_id: user.id,
      message:
        "MFA verification required.",
    };
  }

  await recordLoginSuccess({
    user,
    req,
    mfaVerified: false,
  });

  return {
    ok: true,
    mfa_required: false,
    token: signAccessToken(user, {
      mfa_verified: false,
    }),
    user: safeUser(user),
  };
}

async function verifyMfaLogin({
  userId,
  token,
  req = null,
}) {
  const user =
    await getUserById(userId);

  if (!user) {
    const err = new Error(
      "User not found."
    );
    err.status = 404;
    throw err;
  }

  if (accountIsDisabled(user)) {
    const err = new Error(
      "Account is disabled."
    );
    err.status = 403;
    throw err;
  }

  if (isLocked(user)) {
    const err = new Error(
      "Account is temporarily locked."
    );
    err.status = 423;
    throw err;
  }

  await mfaService.verifyUserMfa({
    userId: user.id,
    token,
    req,
  });

  await recordLoginSuccess({
    user,
    req,
    mfaVerified: true,
  });

  return {
    ok: true,
    token: signAccessToken(user, {
      mfa_verified: true,
    }),
    user: safeUser(user),
  };
}

async function unlockAccount({
  userId,
  req = null,
}) {
  const id = toUserId(userId);

  await pool.query(
    `
    UPDATE tbl_users
    SET
      failed_login_attempts = 0,
      account_locked_until = NULL,
      account_status = 'active',
      updated_at = NOW()
    WHERE id = ?
    `,
    [id]
  );

  await auditService
    .logSecurityEvent({
      req,
      actorUserId:
        req?.user?.id || null,
      targetUserId: id,
      action: "ACCOUNT_UNLOCKED",
      status: "success",
      entityType: "user",
      entityId: id,
    })
    .catch(() => null);

  return { ok: true };
}

async function forcePasswordReset({
  userId,
  req = null,
}) {
  const id = toUserId(userId);

  await pool.query(
    `
    UPDATE tbl_users
    SET
      must_change_password = 1,
      password_reset_required = 1,
      updated_at = NOW()
    WHERE id = ?
    `,
    [id]
  );

  await auditService
    .logSecurityEvent({
      req,
      actorUserId:
        req?.user?.id || null,
      targetUserId: id,
      action:
        "PASSWORD_RESET_REQUIRED",
      status: "success",
      entityType: "user",
      entityId: id,
    })
    .catch(() => null);

  return { ok: true };
}

async function revokeUserSessions(
  userId,
  req = null
) {
  const id = toUserId(userId);

  await pool.query(
    `
    UPDATE tbl_refresh_tokens
    SET revoked_at = NOW()
    WHERE user_id = ?
      AND revoked_at IS NULL
    `,
    [id]
  );

  await auditService
    .logSecurityEvent({
      req,
      actorUserId:
        req?.user?.id || null,
      targetUserId: id,
      action: "SESSIONS_REVOKED",
      status: "success",
      entityType: "user",
      entityId: id,
    })
    .catch(() => null);

  return { ok: true };
}

module.exports = {
  login,
  verifyMfaLogin,

  recordLoginSuccess,
  recordLoginFailure,

  unlockAccount,
  forcePasswordReset,
  revokeUserSessions,

  requiresMfa,
  signAccessToken,
  safeUser,
  getUserById,
};