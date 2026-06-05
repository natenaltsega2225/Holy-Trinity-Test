

//backend\middleware\auth.js
"use strict";

const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../db");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is missing in production");
  }
  return secret || "dev_secret";
}

function getAccessTtl() {
  return process.env.ACCESS_TOKEN_TTL || "15m";
}

function getRefreshDays() {
  const d = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 14);
  return Number.isFinite(d) && d > 0 ? d : 14;
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function cookieOptions() {
  const secure =
    String(process.env.COOKIE_SECURE || "false").toLowerCase() === "true";

  const sameSiteRaw = String(process.env.COOKIE_SAMESITE || "Lax").trim();
  const normalizedSameSite =
    sameSiteRaw.toLowerCase() === "none"
      ? "None"
      : sameSiteRaw.toLowerCase() === "strict"
      ? "Strict"
      : "Lax";

  return {
    httpOnly: true,
    secure,
    sameSite: normalizedSameSite,
    path: "/api/auth",
  };
}

function signAccessToken(user) {
  if (!user?.id) {
    throw new Error("Cannot sign access token without user id");
  }

  return jwt.sign(
    {
      id: user.id,
      member_id: user.member_id || null,
      member_no: user.member_no || null,
      email: user.email,
      role: user.role,
      username: user.username || user.email,
      full_name:
        user.full_name ||
        `${user.first_name || ""} ${user.last_name || ""}`.trim(),
      must_change_password: Number(user.must_change_password || 0),
    },
    getJwtSecret(),
    { expiresIn: getAccessTtl() }
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());

    req.user = {
      id: payload.id,
      member_id: payload.member_id || null,
      member_no: payload.member_no || null,
      email: payload.email,
      role: payload.role,
      username: payload.username,
      full_name: payload.full_name || "",
      must_change_password: Number(payload.must_change_password || 0),
    };

    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function insertRefreshTokenWithRetry(userId, tokenHash, expiresAt, retries = 2) {
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await pool.query(
        `
        INSERT INTO tbl_refresh_tokens (user_id, token_hash, expires_at)
        VALUES (?, ?, ?)
        `,
        [userId, tokenHash, expiresAt]
      );
      return;
    } catch (err) {
      lastErr = err;

      const retryable =
        err?.code === "ER_LOCK_WAIT_TIMEOUT" ||
        err?.errno === 1205 ||
        err?.code === "ER_LOCK_DEADLOCK" ||
        err?.errno === 1213;

      if (!retryable || attempt === retries) {
        throw err;
      }

      await sleep(150 * (attempt + 1));
    }
  }

  throw lastErr;
}

async function issueTokens(res, user) {
  if (!user?.id) {
    throw new Error("Cannot issue tokens without user id");
  }

  const accessToken = signAccessToken(user);
  const refreshToken = crypto.randomBytes(48).toString("base64url");
  const tokenHash = sha256Hex(refreshToken);

  const days = getRefreshDays();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await insertRefreshTokenWithRetry(user.id, tokenHash, expiresAt);

  res.cookie("ht_refresh", refreshToken, {
    ...cookieOptions(),
    expires: expiresAt,
  });

  return { accessToken };
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());

    req.user = {
      id: payload.id,
      member_id: payload.member_id || null,
      email: payload.email,
      role: payload.role,
      username: payload.username,
    };

    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

function requireRole(...roles) {
  const allow = new Set(roles);

  return (req, res, next) => {
    const role = req.user?.role;

    // SUPER ADMIN BYPASS
    if (role === "super_admin") return next();

    if (!role || !allow.has(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return next();
  };
}

async function refreshRequired(req, res, next) {
  try {
    const token = req.cookies?.ht_refresh;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tokenHash = sha256Hex(token);

    const [rows] = await pool.query(
      `
      SELECT id, user_id, expires_at, revoked_at
      FROM tbl_refresh_tokens
      WHERE token_hash = ?
      LIMIT 1
      `,
      [tokenHash]
    );

    if (!rows.length) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const row = rows[0];

    if (row.revoked_at) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const exp = new Date(row.expires_at).getTime();
    if (!Number.isFinite(exp) || Date.now() > exp) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.refresh = {
      id: row.id,
      user_id: row.user_id,
      token_hash: tokenHash,
    };

    return next();
  } catch (err) {
    console.error("refreshRequired error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

async function revokeRefreshTokenById(id) {
  await pool.query(
    `
    UPDATE tbl_refresh_tokens
    SET revoked_at = NOW()
    WHERE id = ?
    `,
    [id]
  );
}

async function revokeAllRefreshTokensForUser(userId) {
  await pool.query(
    `
    UPDATE tbl_refresh_tokens
    SET revoked_at = NOW()
    WHERE user_id = ? AND revoked_at IS NULL
    `,
    [userId]
  );
}

function clearRefreshCookie(res) {
  res.clearCookie("ht_refresh", cookieOptions());
}

module.exports = {
  authRequired,
  requireRole,
  issueTokens,
  refreshRequired,
  revokeRefreshTokenById,
  revokeAllRefreshTokensForUser,
  clearRefreshCookie,
  cookieOptions,
  signAccessToken,
  sha256Hex,
  getJwtSecret,
  getAccessTtl,
  getRefreshDays,
};