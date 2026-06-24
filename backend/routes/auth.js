
// backend/routes/auth.js
"use strict";

const express = require("express");
const crypto = require("crypto");
const argon2 = require("argon2");

let bcrypt = null;
try {
  bcrypt = require("bcryptjs");
} catch {
  bcrypt = null;
}

const pool = require("../db");

const {
  insertExistingColumns,
  updateExistingColumns,
  findOne,
} = require("../utils/dbHelpers");

const emailService = require("../services/emailService");
const mfaService = require(
  "../services/domains/security/mfaService"
);

const auditService = require(
  "../services/domains/security/auditService"
);
const {
  issueTokens,
  refreshRequired,
  revokeRefreshTokenById,
  cookieOptions,
} = require("../middleware/auth");

const router = express.Router();

const MEMBER_NUMBER_PREFIX = process.env.MEMBER_NUMBER_PREFIX || "M";
const MEMBER_NUMBER_WIDTH = Number(process.env.MEMBER_NUMBER_WIDTH || 5);
const PASSWORD_RESET_MINUTES = Number(process.env.PASSWORD_RESET_MINUTES || 30);

/* -------------------------------------------------------------------------- */
/* Optional notifications + audit                                              */
/* -------------------------------------------------------------------------- */

let notifications = {};
try {
  notifications = require("../utils/notifications");
} catch {
  notifications = {};
}

let auditUtils = {};
try {
  auditUtils = require("../utils/audit");
} catch {
  auditUtils = {};
}

async function safeNotify(fnName, payload) {
  try {
    if (typeof notifications[fnName] === "function") {
      await notifications[fnName](payload);
    }
  } catch (err) {
    console.error(`notification ${fnName} error:`, err);
  }
}

async function safeAudit(payload) {
  try {
    if (typeof auditUtils.writeAuditLog === "function") {
      await auditUtils.writeAuditLog(payload);
    } else if (typeof auditUtils.queueAuditLog === "function") {
      await auditUtils.queueAuditLog(payload);
    }
  } catch (err) {
    console.error("audit log error:", err);
  }
}

/* -------------------------------------------------------------------------- */
/* General helpers                                                             */
/* -------------------------------------------------------------------------- */

function clean(value, max = 255) {
  return String(value || "").trim().slice(0, max);
}

function nullable(value, max = 255) {
  const s = clean(value, max);
  return s || null;
}

function normEmail(value) {
  return clean(value, 190).toLowerCase();
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePhone(value) {
  const raw = clean(value, 80);
  if (!raw) return null;

  if (raw.startsWith("+")) return raw.replace(/\s+/g, "");

  const digits = onlyDigits(raw);
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8) return `+${digits}`;

  return raw;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

function isStrongPassword(password) {
  const s = String(password || "");
  return (
    s.length >= 12 &&
    /[a-z]/.test(s) &&
    /[A-Z]/.test(s) &&
    /\d/.test(s) &&
    /[^A-Za-z0-9]/.test(s)
  );
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function buildMemberNo(memberId) {
  return `${MEMBER_NUMBER_PREFIX}-${String(Number(memberId)).padStart(
    MEMBER_NUMBER_WIDTH,
    "0"
  )}`;
}

function tempMemberNo() {
  return `TMP-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

function frontendUrl() {
  return String(
    process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      "http://localhost:5173"
  ).replace(/\/+$/, "");
}

function resultId(result) {
  return Number(result?.insertId || result || 0);
}

function requestMeta(req) {
  return {
    ip:
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      null,
    user_agent: req.headers["user-agent"] || null,
  };
}

function safeUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    member_id: row.member_id ?? null,
    username: row.username ?? null,
    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,
    full_name:
      row.full_name || `${row.first_name || ""} ${row.last_name || ""}`.trim(),
    email: row.email ?? null,
    phone: row.phone ?? null,
    role: row.role,
    is_active: Number(row.is_active ?? 1),
    account_status: row.account_status ?? null,
    must_change_password: Number(row.must_change_password ?? 0),
    member_no: row.member_no ?? null,
    membership_status: row.membership_status ?? null,
    status: row.status ?? null,
    registration_fee_status: row.registration_fee_status ?? null,
    next_due_at: row.next_due_at ?? null,
    last_payment_at: row.last_payment_at ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Table helpers                                                               */
/* -------------------------------------------------------------------------- */

const columnCache = new Map();

async function tableExists(connOrPool, tableName) {
  const [rows] = await connOrPool.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function tableColumns(connOrPool, tableName) {
  if (columnCache.has(tableName)) return columnCache.get(tableName);

  if (!(await tableExists(connOrPool, tableName))) {
    const empty = new Set();
    columnCache.set(tableName, empty);
    return empty;
  }

  const [rows] = await connOrPool.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const columns = new Set(rows.map((row) => row.Field));
  columnCache.set(tableName, columns);
  return columns;
}

async function assignMemberNo(conn, memberId) {
  const memberNo = buildMemberNo(memberId);

  const existing = await findOne(
    conn,
    `
    SELECT id
    FROM tbl_members
    WHERE member_no = ?
      AND id <> ?
    LIMIT 1
    `,
    [memberNo, memberId]
  );

  if (existing) {
    throw new Error(`Member number ${memberNo} already exists.`);
  }

  await updateExistingColumns(
    conn,
    "tbl_members",
    {
      member_no: memberNo,
      updated_at: new Date(),
    },
    "id = ?",
    [memberId]
  );

  return memberNo;
}

/* -------------------------------------------------------------------------- */
/* Password helpers                                                            */
/* -------------------------------------------------------------------------- */

async function hashPassword(password) {
  return argon2.hash(String(password), {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

function isBcryptHash(hash) {
  return /^\$2[aby]\$/.test(String(hash || ""));
}

function isArgonHash(hash) {
  return /^\$argon2/.test(String(hash || ""));
}

async function verifyPassword(row, password) {
  const hash = String(row?.password_hash || "");
  const plain = String(password || "");

  if (!hash || !plain) {
    return {
      valid: false,
      needsRehash: false,
    };
  }

  if (isArgonHash(hash)) {
    try {
      return {
        valid: await argon2.verify(hash, plain),
        needsRehash: false,
      };
    } catch {
      return {
        valid: false,
        needsRehash: false,
      };
    }
  }

  if (bcrypt && isBcryptHash(hash)) {
    try {
      return {
        valid: await bcrypt.compare(plain, hash),
        needsRehash: true,
      };
    } catch {
      return {
        valid: false,
        needsRehash: false,
      };
    }
  }

  try {
    return {
      valid: await argon2.verify(hash, plain),
      needsRehash: false,
    };
  } catch {
    if (!bcrypt) {
      return {
        valid: false,
        needsRehash: false,
      };
    }

    try {
      return {
        valid: await bcrypt.compare(plain, hash),
        needsRehash: true,
      };
    } catch {
      return {
        valid: false,
        needsRehash: false,
      };
    }
  }
}

async function migratePasswordToArgon(userId, password) {
  const passwordHash = await hashPassword(password);

  await updateExistingColumns(
    pool,
    "tbl_users",
    {
      password_hash: passwordHash,
      password_algo: "argon2id",
      updated_at: new Date(),
    },
    "id = ?",
    [userId]
  );
}

/* -------------------------------------------------------------------------- */
/* User loading                                                                */
/* -------------------------------------------------------------------------- */

async function loadUserByIdentifier(identifierRaw, connOrPool = pool) {
  const identifier = clean(identifierRaw, 190).toLowerCase();

  if (!identifier) return null;

  const [rows] = await connOrPool.query(
    `
    SELECT
      u.id,
      u.member_id,
      u.username,
      u.first_name,
      u.last_name,
      u.full_name,
      u.email,
      u.phone,
      u.role,
      u.password_hash,
      u.password_algo,
      u.is_active,
      u.account_status,
      u.must_change_password,
u.mfa_enabled,
u.mfa_secret,
      m.member_no,
      m.membership_status,
      m.status,
      m.registration_fee_status,
      m.next_due_at,
      m.last_payment_at

    FROM tbl_users u

    LEFT JOIN tbl_members m
      ON m.id = u.member_id

    WHERE LOWER(u.email) = ?
       OR LOWER(u.username) = ?
       OR LOWER(m.member_no) = ?
       OR CAST(u.id AS CHAR) = ?
       OR CAST(m.id AS CHAR) = ?

    LIMIT 1
    `,
    [identifier, identifier, identifier, identifier, identifier]
  );

  return rows[0] || null;
}

async function loadUserById(userId, connOrPool = pool) {
  const [rows] = await connOrPool.query(
    `
    SELECT
      u.id,
      u.member_id,
      u.username,
      u.first_name,
      u.last_name,
      u.full_name,
      u.email,
      u.phone,
      u.role,
      u.password_hash,
      u.password_algo,
      u.is_active,
      u.account_status,
      u.must_change_password,
     u.mfa_enabled,
      u.mfa_secret,
      m.member_no,
      m.membership_status,
      m.status,
      m.registration_fee_status,
      m.next_due_at,
      m.last_payment_at

    FROM tbl_users u

    LEFT JOIN tbl_members m
      ON m.id = u.member_id

    WHERE u.id = ?

    LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

async function tryAttachMemberIfMissing(user) {
  if (!user) return user;
  if (user.member_id) return user;
  if (String(user.role || "").toLowerCase() !== "member") return user;
  if (!user.email) return user;

  const member = await findOne(
    pool,
    `
    SELECT
      id,
      member_no,
      membership_status,
      status,
      registration_fee_status,
      next_due_at,
      last_payment_at
    FROM tbl_members
    WHERE LOWER(email) = ?
    LIMIT 1
    `,
    [normEmail(user.email)]
  );

  if (!member) return user;

  await updateExistingColumns(
    pool,
    "tbl_users",
    {
      member_id: member.id,
      updated_at: new Date(),
    },
    "id = ? AND (member_id IS NULL OR member_id = 0)",
    [user.id]
  );

  return {
    ...user,
    member_id: member.id,
    member_no: member.member_no,
    membership_status: member.membership_status,
    status: member.status,
    registration_fee_status: member.registration_fee_status,
    next_due_at: member.next_due_at,
    last_payment_at: member.last_payment_at,
  };
}

function accountIsBlocked(user) {
  if (Number(user.is_active) !== 1) return true;

  const userStatus = String(user.account_status || "").toLowerCase();
  if (["disabled", "inactive", "suspended", "locked"].includes(userStatus)) {
    return true;
  }

  const memberStatus = String(user.status || "").toLowerCase();
  if (String(user.role || "").toLowerCase() === "member") {
    if (["disabled", "inactive", "suspended", "locked"].includes(memberStatus)) {
      return true;
    }
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/* Register                                                                    */
/* -------------------------------------------------------------------------- */

router.post("/register", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const firstName = clean(req.body.first_name, 100);
    const lastName = clean(req.body.last_name, 100);
    const fullName = clean(
      req.body.full_name || `${firstName} ${lastName}`.trim(),
      255
    );
    const email = normEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);

    const password = String(req.body.password || "");
    const confirmPassword = String(
      req.body.confirm_password || req.body.confirmPassword || ""
    );

    const memberType = clean(req.body.member_type || "new", 20).toLowerCase();

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error:
          "Password must be at least 12 characters and include uppercase, lowercase, number, and special character.",
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    if (!["existing", "new"].includes(memberType)) {
      return res.status(400).json({ error: "Member type must be existing or new." });
    }

    const existingUser = await findOne(
      conn,
      `
      SELECT id
      FROM tbl_users
      WHERE LOWER(email) = ?
         OR LOWER(username) = ?
      LIMIT 1
      `,
      [email, email]
    );

    if (existingUser) {
      return res.status(409).json({
        error: "An account with this email already exists.",
      });
    }

    const existingMember = await findOne(
      conn,
      `
      SELECT id
      FROM tbl_members
      WHERE LOWER(email) = ?
      LIMIT 1
      `,
      [email]
    );

    if (existingMember) {
      return res.status(409).json({
        error: "A member with this email already exists.",
      });
    }

    const passwordHash = await hashPassword(password);

    await conn.beginTransaction();

    const memberStatus = memberType === "existing" ? "active" : "pending";
    const registrationFeeStatus = memberType === "existing" ? "waived" : "unpaid";

    const memberResult = await insertExistingColumns(conn, "tbl_members", {
      member_no: tempMemberNo(),

      first_name: firstName || null,
      last_name: lastName || null,
      full_name: fullName,

      email,
      phone,

      address_line1: nullable(req.body.address_line1 || req.body.address_line_1, 200),
      address_line2: nullable(req.body.address_line2 || req.body.address_line_2, 200),
      address_line_1: nullable(req.body.address_line_1 || req.body.address_line1, 200),
      address_line_2: nullable(req.body.address_line_2 || req.body.address_line2, 200),
      city: nullable(req.body.city, 100),
      state: nullable(req.body.state, 80),
      zip: nullable(req.body.zip || req.body.zip_code, 20),
      zip_code: nullable(req.body.zip_code || req.body.zip, 20),

      member_type: memberType,
      registration_fee_status: registrationFeeStatus,
      status: memberStatus,
      membership_status: memberStatus,
      is_active: 1,

      open_balance: 0,
      total_paid: 0,
      joined_at: new Date(),

      created_at: new Date(),
      updated_at: new Date(),
    });

    const memberId = resultId(memberResult);
    const memberNo = await assignMemberNo(conn, memberId);

    const userResult = await insertExistingColumns(conn, "tbl_users", {
      member_id: memberId,
      username: email,

      first_name: firstName || null,
      last_name: lastName || null,
      full_name: fullName,

      email,
      phone,

      role: "member",
      password_hash: passwordHash,
      password_algo: "argon2id",

      is_active: 1,
      account_status: "active",
      must_change_password: 0,
      email_verified: 1,

      created_at: new Date(),
      updated_at: new Date(),
    });

    const userId = resultId(userResult);

    await conn.commit();

    const authUser = await loadUserById(userId);
    const { accessToken } = await issueTokens(res, authUser);

    await safeAudit({
      req,
      actorId: userId,
      action: memberType === "existing" ? "member_register_existing" : "member_register_new",
      entity: "member",
      entityId: memberId,
      meta: {
        email,
        member_type: memberType,
        registration_fee_status: registrationFeeStatus,
      },
    });

    await safeNotify("sendRegistrationWelcomeEmail", {
      to: email,
      memberId,
      memberNo,
      fullName,
      memberType,
      status: memberStatus,
      membershipStatus: memberStatus,
      registrationFeeStatus,
    });

    return res.status(201).json({
      ok: true,
      token: accessToken,
      user: safeUser(authUser),
      requires_plan_selection: memberType === "new",
      member_id: memberId,
      user_id: userId,
      member_no: memberNo,
      member_type: memberType,
      registration_fee_status: registrationFeeStatus,
      membership_status: memberStatus,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}

    console.error("register error:", err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Email, username, or member ID already exists." });
    }

    return res.status(500).json({ error: "Server error" });
  } finally {
    conn.release();
  }
});

/* -------------------------------------------------------------------------- */
/* Login                                                                       */
/* -------------------------------------------------------------------------- */

router.post("/login", async (req, res) => {
  try {
    const identifier = clean(
      req.body.identifier || req.body.email || req.body.username || req.body.member_no,
      190
    );

    const password = String(req.body.password || "");

    if (!identifier || !password) {
      return res.status(400).json({
        error: "Email, username, member ID, and password are required.",
      });
    }

    let user = await loadUserByIdentifier(identifier);

    if (!user) {
      return res.status(401).json({
        error: "Incorrect login or password.",
      });
    }

    const verified = await verifyPassword(user, password);

    if (!verified.valid) {
      await safeAudit({
        req,
        actorId: user.id,
        action: "login_failed",
        entity: "auth",
        entityId: user.id,
        meta: {
          identifier,
          reason: "invalid_password",
        },
      });

      return res.status(401).json({
        error: "Incorrect login or password.",
      });
    }

    if (verified.needsRehash) {
      await migratePasswordToArgon(user.id, password);
      user = await loadUserById(user.id);
    }

    user = await tryAttachMemberIfMissing(user);

    if (accountIsBlocked(user)) {
      return res.status(403).json({
        error: "This account is disabled or not active.",
      });
    }
/*
====================================================
ENTERPRISE MFA CHECK
- Sensitive roles must always go through MFA flow.
- If MFA is not enrolled, frontend will show QR setup.
- If MFA is enrolled, frontend will ask for TOTP code.
====================================================
*/

const sensitiveRoles = [
  "super_admin",
  "admin",
  "finance",
  "it_admin",
  "reconciliation",
];

const userRole = String(user.role || "")
  .trim()
  .toLowerCase();

if (sensitiveRoles.includes(userRole)) {
  await safeAudit({
    req,
    actorId: user.id,
    action: "mfa_required",
    entity: "auth",
    entityId: user.id,
    meta: {
      role: user.role,
      member_id: user.member_id || null,
      mfa_enabled: Number(user.mfa_enabled || 0),
      has_mfa_secret: Boolean(user.mfa_secret),
    },
  });

  return res.json({
    ok: true,
    mfa_required: true,
    user_id: user.id,
    mfa_enabled: Number(user.mfa_enabled || 0) === 1,
    has_mfa_secret: Boolean(user.mfa_secret),
    message: "Multi-factor authentication required.",
  });
}
    const { accessToken } = await issueTokens(res, user);

    if (Number(user.must_change_password || 0) === 1) {
      await safeAudit({
        req,
        actorId: user.id,
        action: "temporary_password_login",
        entity: "auth",
        entityId: user.id,
        meta: {
          role: user.role,
          member_id: user.member_id || null,
        },
      });

      return res.json({
        ok: true,
        token: accessToken,
        requires_password_reset: true,
        requires_password_change: true,
        must_change_password: true,
        reset_endpoint: "/api/auth/reset-temp-password",
        next: {
          type: "password_change_required",
          path: "/reset-required",
        },
        identifier: user.email || user.username || user.member_no || identifier,
        user: safeUser(user),
      });
    }

    await safeAudit({
      req,
      actorId: user.id,
      action: "login_success",
      entity: "auth",
      entityId: user.id,
      meta: {
        role: user.role,
        member_id: user.member_id || null,
      },
    });

    return res.json({
      ok: true,
      token: accessToken,
      user: safeUser(user),
      must_change_password: false,
      next: {
        type: "dashboard",
        path:
          String(user.role || "").toLowerCase() === "member"
            ? "/dash/member"
            : "/dash",
      },
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* -------------------------------------------------------------------------- */
/* Reset temporary password                                                     */
/* -------------------------------------------------------------------------- */

router.post("/reset-temp-password", async (req, res) => {
  try {
    const identifier = clean(
      req.body.identifier || req.body.email || req.body.username || req.body.member_no,
      190
    );

    const tempPassword = String(
      req.body.temp_password ||
        req.body.temporary_password ||
        req.body.current_password ||
        req.body.currentPassword ||
        ""
    );

    const newPassword = String(
      req.body.new_password || req.body.newPassword || req.body.password || ""
    );

    const confirmPassword = String(
      req.body.confirm_password || req.body.confirmPassword || ""
    );

    if (!identifier || !tempPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        error: "All fields are required.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        error: "Passwords do not match.",
      });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        error:
          "Password must be at least 12 characters and include uppercase, lowercase, number, and special character.",
      });
    }

    let user = await loadUserByIdentifier(identifier);

    if (!user) {
      return res.status(404).json({
        error: "Account not found.",
      });
    }

    if (accountIsBlocked(user)) {
      return res.status(403).json({
        error: "This account is disabled.",
      });
    }

    if (Number(user.must_change_password || 0) !== 1) {
      return res.status(400).json({
        error: "Password reset is not required for this account.",
      });
    }

    const verified = await verifyPassword(user, tempPassword);

    if (!verified.valid) {
      return res.status(401).json({
        error: "Temporary password is incorrect.",
      });
    }

    const sameAsTemporary = await verifyPassword(user, newPassword);
    if (sameAsTemporary.valid) {
      return res.status(400).json({
        error: "New password cannot be the same as the temporary password.",
      });
    }

    const newHash = await hashPassword(newPassword);

    await updateExistingColumns(
      pool,
      "tbl_users",
      {
        password_hash: newHash,
        password_algo: "argon2id",
        must_change_password: 0,
        password_changed_at: new Date(),
        last_password_change_at: new Date(),
        updated_at: new Date(),
      },
      "id = ?",
      [user.id]
    );

    await updateExistingColumns(
      pool,
      "tbl_refresh_tokens",
      {
        revoked_at: new Date(),
      },
      "user_id = ? AND revoked_at IS NULL",
      [user.id]
    ).catch(() => null);

    user = await loadUserById(user.id);

    const { accessToken } = await issueTokens(res, user);

    await safeAudit({
      req,
      actorId: user.id,
      action: "temporary_password_changed",
      entity: "auth",
      entityId: user.id,
      meta: {
        role: user.role,
        member_id: user.member_id || null,
      },
    });

    return res.json({
      ok: true,
      token: accessToken,
      user: safeUser(user),
      must_change_password: false,
      next: {
        type: "dashboard",
        path:
          String(user.role || "").toLowerCase() === "member"
            ? "/dash/member"
            : "/dash",
      },
    });
  } catch (err) {
    console.error("reset-temp-password error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* -------------------------------------------------------------------------- */
/* Refresh / Logout                                                            */
/* -------------------------------------------------------------------------- */

router.post("/refresh", refreshRequired, async (req, res) => {
  try {
    await revokeRefreshTokenById(req.refresh.id);

    let user = await loadUserById(req.refresh.user_id);

    if (!user) {
      res.clearCookie("ht_refresh", cookieOptions());
      return res.status(401).json({ error: "Unauthorized" });
    }

    user = await tryAttachMemberIfMissing(user);

    if (accountIsBlocked(user)) {
      res.clearCookie("ht_refresh", cookieOptions());
      return res.status(403).json({ error: "This account is disabled." });
    }

    const { accessToken } = await issueTokens(res, user);

    return res.json({
      ok: true,
      token: accessToken,
      user: safeUser(user),
      must_change_password: Number(user.must_change_password || 0) === 1,
      requires_password_change: Number(user.must_change_password || 0) === 1,
    });
  } catch (err) {
    console.error("refresh error:", err);
    res.clearCookie("ht_refresh", cookieOptions());
    return res.status(401).json({ error: "Unauthorized" });
  }
});

router.post("/logout", refreshRequired, async (req, res) => {
  try {
    await revokeRefreshTokenById(req.refresh.id);
    res.clearCookie("ht_refresh", cookieOptions());

    await safeAudit({
      req,
      actorId: req.refresh.user_id,
      action: "logout",
      entity: "auth",
      entityId: req.refresh.user_id,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("logout error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* -------------------------------------------------------------------------- */
/* Forgot password                                                             */
/* -------------------------------------------------------------------------- */

router.post("/forgot-password", async (req, res) => {
  try {
    const identifier = clean(
      req.body.identifier || req.body.email || req.body.username || req.body.member_no,
      190
    ).toLowerCase();

    if (!identifier) {
      return res.json({ ok: true });
    }

    const user = await loadUserByIdentifier(identifier);

    if (!user || !user.email) {
      return res.json({ ok: true });
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_MINUTES * 60 * 1000);
    const meta = requestMeta(req);

    await insertExistingColumns(pool, "tbl_password_resets", {
      user_id: user.id,
      member_id: user.member_id || null,
      token_hash: tokenHash,
      expires_at: expiresAt,
      ip_address: meta.ip,
      user_agent: meta.user_agent,
      created_at: new Date(),
    });

    const resetLink = `${frontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;

    if (typeof emailService.sendPasswordResetEmail === "function") {
      const result = await emailService.sendPasswordResetEmail({
        to: user.email,
        fullName: user.full_name,
        resetLink,
      });

      if (!result?.success) {
        console.error("Forgot password email failed:", result?.error);
      }
    } else {
      console.error("Forgot password email skipped: sendPasswordResetEmail missing");
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("RESET LINK:", resetLink);
    } else {
      console.log("Password reset requested:", {
        user_id: user.id,
        email: user.email,
      });
    }

    await safeAudit({
      req,
      actorId: user.id,
      action: "password_reset_requested",
      entity: "auth",
      entityId: user.id,
      meta: {
        member_id: user.member_id || null,
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("forgot-password error:", err);
    return res.json({ ok: true });
  }
});

/* -------------------------------------------------------------------------- */
/* Reset password                                                              */
/* -------------------------------------------------------------------------- */

router.post("/reset-password", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const token = String(req.body.token || "");
    const newPassword = String(req.body.new_password || req.body.password || "");
    const confirmPassword = String(
      req.body.confirm_password || req.body.confirmPassword || ""
    );

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Invalid request." });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        error:
          "Password must be at least 12 characters and include uppercase, lowercase, number, and special character.",
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    const tokenHash = sha256Hex(token);

    const [rows] = await conn.query(
      `
      SELECT *
      FROM tbl_password_resets
      WHERE token_hash = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [tokenHash]
    );

    if (!rows.length) {
      return res.status(400).json({ error: "Invalid or expired token." });
    }

    const resetRow = rows[0];

    if (resetRow.used_at) {
      return res.status(400).json({ error: "Invalid or expired token." });
    }

    if (Date.now() > new Date(resetRow.expires_at).getTime()) {
      return res.status(400).json({ error: "Invalid or expired token." });
    }

    let user = null;

    if (resetRow.user_id) {
      user = await loadUserById(resetRow.user_id, conn);
    }

    if (!user && resetRow.member_id) {
      user = await findOne(
        conn,
        `
        SELECT
          u.id,
          u.member_id,
          u.username,
          u.first_name,
          u.last_name,
          u.full_name,
          u.email,
          u.phone,
          u.role,
          u.password_hash,
          u.password_algo,
          u.is_active,
          u.account_status,
          u.must_change_password,
          m.member_no,
          m.membership_status,
          m.status,
          m.registration_fee_status,
          m.next_due_at,
          m.last_payment_at
        FROM tbl_users u
        LEFT JOIN tbl_members m
          ON m.id = u.member_id
        WHERE u.member_id = ?
        LIMIT 1
        `,
        [resetRow.member_id]
      );
    }

    if (!user?.id) {
      return res.status(400).json({ error: "Invalid or expired token." });
    }

    const sameAsOld = await verifyPassword(user, newPassword);
    if (sameAsOld.valid) {
      return res.status(400).json({
        error: "New password cannot be the same as your current password.",
      });
    }

    const passwordHash = await hashPassword(newPassword);

    await conn.beginTransaction();

    await updateExistingColumns(
      conn,
      "tbl_users",
      {
        password_hash: passwordHash,
        password_algo: "argon2id",
        must_change_password: 0,
        password_changed_at: new Date(),
        last_password_change_at: new Date(),
        updated_at: new Date(),
      },
      "id = ?",
      [user.id]
    );

    await updateExistingColumns(
      conn,
      "tbl_password_resets",
      {
        used_at: new Date(),
      },
      "id = ?",
      [resetRow.id]
    );

    await updateExistingColumns(
      conn,
      "tbl_refresh_tokens",
      {
        revoked_at: new Date(),
      },
      "user_id = ? AND revoked_at IS NULL",
      [user.id]
    ).catch(() => null);

    await conn.commit();

    res.clearCookie("ht_refresh", cookieOptions());

    await safeNotify("sendPasswordResetConfirmationEmail", {
      to: user.email,
      fullName: user.full_name,
    });

    const refreshedUser = await loadUserById(user.id);
    const { accessToken } = await issueTokens(res, refreshedUser);

    await safeAudit({
      req,
      actorId: user.id,
      action: "password_reset_completed",
      entity: "auth",
      entityId: user.id,
      meta: {
        member_id: user.member_id || null,
      },
    });

    return res.json({
      ok: true,
      token: accessToken,
      user: safeUser(refreshedUser),
      must_change_password: false,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}

    console.error("reset-password error:", err);
    return res.status(500).json({ error: "Server error" });
  } finally {
    conn.release();
  }
});
router.get("/mfa/status/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    const result =
      await mfaService.getMfaStatus(userId);

    return res.json(result);
  } catch (err) {
    console.error("mfa status error:", err);

    return res.status(err.status || 500).json({
      ok: false,
      error:
        err.message ||
        "Failed to load MFA status.",
    });
  }
});

router.get("/mfa/setup/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    const result = await mfaService.createMfaSetup(userId, req);

    return res.json(result);
  } catch (err) {
    console.error("mfa setup get error:", err);

    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Failed to load MFA setup.",
    });
  }
});

router.post("/mfa/setup", async (req, res) => {
  try {
    const userId = Number(
      req.body.user_id ||
      req.body.userId
    );

    const result = await mfaService.createMfaSetup(userId, req);

    return res.json(result);
  } catch (err) {
    console.error("mfa setup error:", err);

    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Failed to setup MFA.",
    });
  }
});

router.post("/mfa/enable", async (req, res) => {
  try {
    const userId = Number(
      req.body.user_id ||
      req.body.userId
    );

    const token = String(req.body.token || "");

    const result = await mfaService.enableMfa({
      userId,
      token,
      req,
    });

    return res.json(result);
  } catch (err) {
    console.error("mfa enable error:", err);

    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Failed to enable MFA.",
    });
  }
});

router.post("/mfa/verify", async (req, res) => {
  try {
    const userId = Number(
      req.body.user_id ||
      req.body.userId
    );

    const token = String(req.body.token || "");

    await mfaService.verifyUserMfa({
      userId,
      token,
      req,
    });

    const user = await loadUserById(userId);

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "User not found.",
      });
    }

    const { accessToken } = await issueTokens(res, user);

    await safeAudit({
      req,
      actorId: user.id,
      action: "mfa_login_success",
      entity: "auth",
      entityId: user.id,
      meta: {
        role: user.role,
        member_id: user.member_id || null,
      },
    });

    return res.json({
      ok: true,
      token: accessToken,
      user: safeUser(user),
    });
  } catch (err) {
    console.error("mfa verify error:", err);

    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || "MFA verification failed.",
    });
  }
});

module.exports = router;