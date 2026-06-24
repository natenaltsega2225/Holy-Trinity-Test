"use strict";

const crypto = require("crypto");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");

const pool = require("../../../db");
const auditService = require("./auditService");

const APP_NAME = process.env.APP_NAME || "Holy Trinity";

function cleanToken(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .trim();
}

function toUserId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error("Invalid user ID.");
    err.status = 400;
    throw err;
  }

  return id;
}

async function getUserById(userId) {
  const id = toUserId(userId);

  const [rows] = await pool.query(
    `
    SELECT
      id,
      email,
      username,
      full_name,
      role,
      mfa_enabled,
      mfa_secret,
      mfa_backup_codes
    FROM tbl_users
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

function generateMfaSecret(user) {
  return speakeasy.generateSecret({
    name: `${APP_NAME} (${user.email || user.username || user.id})`,
    issuer: APP_NAME,
    length: 32,
  });
}

function generateBackupCodes(count = 10) {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );
}

async function getMfaStatus(userId) {
  const user = await getUserById(userId);

  if (!user) {
    const err = new Error("User not found.");
    err.status = 404;
    throw err;
  }

  const mfaEnabled =
    Number(user.mfa_enabled || 0) === 1;

  const hasSecret =
    Boolean(user.mfa_secret);

  return {
    ok: true,
    user_id: user.id,
    role: user.role,

    mfa_enabled: mfaEnabled,

    has_mfa_secret: hasSecret,

    enrollment_required:
      !mfaEnabled,

    verification_required:
      mfaEnabled,
  };
}
async function createMfaSetup(userId) {
  const user = await getUserById(userId);

  if (!user) {
    const err = new Error("User not found.");
    err.status = 404;
    throw err;
  }

  let secretValue = user.mfa_secret;

  if (!secretValue) {
    const generated = generateMfaSecret(user);
    secretValue = generated.base32;

    await pool.query(
      `
      UPDATE tbl_users
      SET
        mfa_secret = ?,
        mfa_enabled = 0,
        updated_at = NOW()
      WHERE id = ?
      `,
      [secretValue, user.id]
    );
  }

  const otpauthUrl =
  speakeasy.otpauthURL({
    secret: secretValue,
    label: user.email || user.username,
    issuer: APP_NAME,
    encoding: "base32",
  });

const qrCode =
  await QRCode.toDataURL(
    otpauthUrl
  );
  return {
    ok: true,
    user_id: user.id,
    mfa_enabled: Number(user.mfa_enabled || 0) === 1,
    secret: secretValue,
    otpauth_url: otpauthUrl,
    qr_code: qrCode,
  };
}
function verifyTotpToken({
  secret,
  token,
}) {
  try {
    if (!secret || !token) {
      return false;
    }

    const cleaned = cleanToken(token);

    if (!/^\d{6}$/.test(cleaned)) {
      return false;
    }

    return speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token: cleaned,

      // 1 previous + current + 1 next
      window: 1,
    });
  } catch (err) {
    console.error(
      "verifyTotpToken error:",
      err
    );

    return false;
  }
}

async function enableMfa({ userId, token, req = null }) {
  const user = await getUserById(userId);

  if (!user) {
    const err = new Error("User not found.");
    err.status = 404;
    throw err;
  }

  if (!user.mfa_secret) {
    const err = new Error(
      "MFA setup has not been initialized."
    );
    err.status = 400;
    throw err;
  }

  const cleanedToken = cleanToken(token);

  if (!/^\d{6}$/.test(cleanedToken)) {
    const err = new Error(
      "Authentication code must be 6 digits."
    );
    err.status = 400;
    throw err;
  }

  /*
  ==========================================
  DEBUG TOTP WINDOWS
  ==========================================
  */

  const now = Math.floor(Date.now() / 1000);

  const previous = speakeasy.totp({
    secret: user.mfa_secret,
    encoding: "base32",
    time: now - 30,
  });

  const current = speakeasy.totp({
    secret: user.mfa_secret,
    encoding: "base32",
    time: now,
  });

  const next = speakeasy.totp({
    secret: user.mfa_secret,
    encoding: "base32",
    time: now + 30,
  });

  console.log("MFA ENABLE DEBUG", {
    supplied: cleanedToken,
    previous,
    current,
    next,
    secret: user.mfa_secret,
    serverTime: new Date().toISOString(),
  });

  const valid = speakeasy.totp.verify({
    secret: user.mfa_secret,
    encoding: "base32",
    token: cleanedToken,

    // allow clock drift
    window: 2,
  });

  if (!valid) {
    await auditService
      .logSecurityEvent({
        req,
        actorUserId:
          req?.user?.id || user.id,
        targetUserId: user.id,
        action: "MFA_ENABLE_FAILED",
        status: "failed",
        entityType: "user",
        entityId: user.id,
        notes:
          "Invalid MFA code during enablement.",
      })
      .catch(() => null);

    const err = new Error(
      "Invalid MFA code."
    );
    err.status = 400;
    throw err;
  }

  await pool.query(
    `
    UPDATE tbl_users
    SET
      mfa_enabled = 1,
      mfa_enabled_at = COALESCE(
        mfa_enabled_at,
        NOW()
      ),
      mfa_enabled_by = COALESCE(
        mfa_enabled_by,
        ?
      ),
      updated_at = NOW()
    WHERE id = ?
    `,
    [
      req?.user?.id || user.id,
      user.id,
    ]
  );

  await auditService
    .logSecurityEvent({
      req,
      actorUserId:
        req?.user?.id || user.id,
      targetUserId: user.id,
      action: "MFA_ENABLED",
      entityType: "user",
      entityId: user.id,
      newValue: {
        mfa_enabled: 1,
      },
    })
    .catch(() => null);

  return {
    ok: true,
    mfa_enabled: true,
    user_id: user.id,
  };
}

async function disableMfa({ userId, req = null }) {
  const id = toUserId(userId);

  await pool.query(
    `
    UPDATE tbl_users
    SET
      mfa_enabled = 0,
      mfa_secret = NULL,
      mfa_backup_codes = NULL,
      updated_at = NOW()
    WHERE id = ?
    `,
    [id]
  );

  await auditService.logSecurityEvent({
    req,
    actorUserId: req?.user?.id || id,
    targetUserId: id,
    action: "MFA_DISABLED",
    entityType: "user",
    entityId: id,
    newValue: { mfa_enabled: 0 },
  }).catch(() => null);

  return { ok: true };
}

async function verifyBackupCode({ userId, code }) {
  const user = await getUserById(userId);

  if (!user) return false;

  let codes = [];

  try {
    codes = JSON.parse(user.mfa_backup_codes || "[]");
  } catch {
    codes = [];
  }

  const normalized = String(code || "").trim().toUpperCase();
  const idx = codes.indexOf(normalized);

  if (idx === -1) return false;

  codes.splice(idx, 1);

  await pool.query(
    `
    UPDATE tbl_users
    SET
      mfa_backup_codes = ?,
      updated_at = NOW()
    WHERE id = ?
    `,
    [JSON.stringify(codes), user.id]
  );

  return true;
}

async function verifyUserMfa({
  userId,
  token,
  req = null,
}) {
  const user = await getUserById(userId);

  if (!user) {
    const err = new Error("User not found.");
    err.status = 404;
    throw err;
  }

  if (Number(user.mfa_enabled || 0) !== 1) {
    const err = new Error(
      "MFA is not enabled for this account."
    );
    err.status = 400;
    throw err;
  }

  if (!user.mfa_secret) {
    const err = new Error(
      "MFA secret is missing."
    );
    err.status = 400;
    throw err;
  }

  const cleanedToken = cleanToken(token);

  const now = Math.floor(Date.now() / 1000);

  const minus60 = speakeasy.totp({
    secret: user.mfa_secret,
    encoding: "base32",
    time: now - 60,
  });

  const minus30 = speakeasy.totp({
    secret: user.mfa_secret,
    encoding: "base32",
    time: now - 30,
  });

  const current = speakeasy.totp({
    secret: user.mfa_secret,
    encoding: "base32",
    time: now,
  });

  const plus30 = speakeasy.totp({
    secret: user.mfa_secret,
    encoding: "base32",
    time: now + 30,
  });

  const plus60 = speakeasy.totp({
    secret: user.mfa_secret,
    encoding: "base32",
    time: now + 60,
  });

  console.log("MFA VERIFY DEBUG", {
    supplied: cleanedToken,
    minus60,
    minus30,
    current,
    plus30,
    plus60,
    secret: user.mfa_secret,
    serverTime: new Date().toISOString(),
  });

  const validTotp = speakeasy.totp.verify({
    secret: user.mfa_secret,
    encoding: "base32",
    token: cleanedToken,

    // Accept ±60 seconds
    window: 2,
  });

  const validBackup =
    await verifyBackupCode({
      userId: user.id,
      code: cleanedToken,
    });

  const valid =
    validTotp || validBackup;

  console.log("MFA VERIFY RESULT", {
    supplied: cleanedToken,
    validTotp,
    validBackup,
    valid,
  });

  await auditService
    .logSecurityEvent({
      req,
      actorUserId: user.id,
      targetUserId: user.id,
      action: valid
        ? "MFA_VERIFIED"
        : "MFA_VERIFY_FAILED",
      status: valid
        ? "success"
        : "failed",
      entityType: "user",
      entityId: user.id,
    })
    .catch(() => null);

  if (!valid) {
    const err = new Error(
      "Invalid MFA code."
    );

    err.status = 401;

    throw err;
  }

  return {
    ok: true,
    mfa_required: true,
    mfa_verified: true,
    user_id: user.id,
  };
}

module.exports = {
  getMfaStatus,
  createMfaSetup,
  enableMfa,
  disableMfa,
  verifyTotpToken,
  verifyUserMfa,
  generateBackupCodes,
  verifyBackupCode,
};