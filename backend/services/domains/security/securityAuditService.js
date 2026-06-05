// backend/services/domains/security/securityAuditService.js
"use strict";

const pool = require("../../../db");

const {
  insertExistingColumns,
  findMany,
  findOne,
} = require("../../../utils/dbHelpers");

const {
  clean,
  nullable,
  mysqlNow,
} = require("../../../utils/financeHelpers");

/* =========================================================
   REQUEST HELPERS
========================================================= */

function getRequestIp(req) {
  const forwarded = req?.headers?.["x-forwarded-for"];

  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }

  return req?.ip || req?.socket?.remoteAddress || null;
}

function getUserAgent(req) {
  return req?.headers?.["user-agent"] || null;
}

/* =========================================================
   LOG SECURITY EVENT
========================================================= */

async function logSecurityEvent(payload = {}) {
  try {
    return await insertExistingColumns(pool, "tbl_security_audit_logs", {
      user_id: payload.user_id || null,
      email: nullable(payload.email, 190),

      event_type: clean(payload.event_type || "security_event", 120),
      severity: clean(payload.severity || "info", 40),

      success: payload.success === false ? 0 : 1,

      ip_address: nullable(payload.ip_address, 80),
      user_agent: nullable(payload.user_agent, 500),

      message: nullable(payload.message, 1000),

      meta_json: payload.meta ? JSON.stringify(payload.meta) : null,

      created_at: mysqlNow(),
    });
  } catch (err) {
    console.error("logSecurityEvent failed:", err.message);
    return null;
  }
}

/* =========================================================
   LOG FROM REQUEST
========================================================= */

async function logRequestSecurityEvent(req, payload = {}) {
  return logSecurityEvent({
    user_id: req?.user?.id || payload.user_id || null,
    email: req?.user?.email || payload.email || null,
    ip_address: getRequestIp(req),
    user_agent: getUserAgent(req),
    ...payload,
  });
}

/* =========================================================
   AUTH EVENTS
========================================================= */

async function logLoginSuccess(req, user = {}) {
  return logSecurityEvent({
    user_id: user.id,
    email: user.email,
    event_type: "login_success",
    severity: "info",
    success: true,
    ip_address: getRequestIp(req),
    user_agent: getUserAgent(req),
    message: "User login successful.",
  });
}

async function logLoginFailure(req, payload = {}) {
  return logSecurityEvent({
    user_id: null,
    email: payload.email,
    event_type: "login_failed",
    severity: "warning",
    success: false,
    ip_address: getRequestIp(req),
    user_agent: getUserAgent(req),
    message: payload.message || "User login failed.",
    meta: {
      reason: payload.reason || null,
    },
  });
}

async function logLogout(req, user = {}) {
  return logSecurityEvent({
    user_id: user.id,
    email: user.email,
    event_type: "logout",
    severity: "info",
    success: true,
    ip_address: getRequestIp(req),
    user_agent: getUserAgent(req),
    message: "User logged out.",
  });
}

async function logPasswordResetRequested(req, payload = {}) {
  return logSecurityEvent({
    user_id: payload.user_id || null,
    email: payload.email,
    event_type: "password_reset_requested",
    severity: "info",
    success: true,
    ip_address: getRequestIp(req),
    user_agent: getUserAgent(req),
    message: "Password reset requested.",
  });
}

async function logPasswordResetCompleted(req, payload = {}) {
  return logSecurityEvent({
    user_id: payload.user_id || null,
    email: payload.email,
    event_type: "password_reset_completed",
    severity: "info",
    success: true,
    ip_address: getRequestIp(req),
    user_agent: getUserAgent(req),
    message: "Password reset completed.",
  });
}

/* =========================================================
   RBAC / SUSPICIOUS EVENTS
========================================================= */

async function logAccessDenied(req, payload = {}) {
  return logRequestSecurityEvent(req, {
    event_type: "access_denied",
    severity: "warning",
    success: false,
    message: payload.message || "Access denied.",
    meta: {
      route: req?.originalUrl || req?.url || null,
      method: req?.method || null,
      required_role: payload.required_role || null,
    },
  });
}

async function logSuspiciousActivity(req, payload = {}) {
  return logRequestSecurityEvent(req, {
    event_type: payload.event_type || "suspicious_activity",
    severity: payload.severity || "critical",
    success: false,
    message: payload.message || "Suspicious activity detected.",
    meta: payload.meta || {},
  });
}

/* =========================================================
   LIST EVENTS
========================================================= */

async function listSecurityEvents(filters = {}) {
  const params = [];
  const where = [];

  if (filters.user_id) {
    where.push("user_id = ?");
    params.push(filters.user_id);
  }

  if (filters.email) {
    where.push("LOWER(email) = LOWER(?)");
    params.push(filters.email);
  }

  if (filters.event_type) {
    where.push("event_type = ?");
    params.push(filters.event_type);
  }

  if (filters.severity) {
    where.push("severity = ?");
    params.push(filters.severity);
  }

  if (filters.success !== undefined) {
    where.push("success = ?");
    params.push(filters.success ? 1 : 0);
  }

  if (filters.search) {
    const q = `%${filters.search}%`;
    where.push(`
      (
        email LIKE ?
        OR event_type LIKE ?
        OR severity LIKE ?
        OR ip_address LIKE ?
        OR message LIKE ?
      )
    `);
    params.push(q, q, q, q, q);
  }

  const limit = Math.min(500, Math.max(1, Number(filters.limit || 100)));
  const offset = Math.max(0, Number(filters.offset || 0));

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  return findMany(
    pool,
    `
    SELECT *
    FROM tbl_security_audit_logs
    ${whereSql}
    ORDER BY created_at DESC, id DESC
    LIMIT ?
    OFFSET ?
    `,
    [...params, limit, offset]
  );
}

/* =========================================================
   SUMMARY
========================================================= */

async function getSecuritySummary() {
  const summary = await findOne(
    pool,
    `
    SELECT
      COUNT(*) AS total_events,
      SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) AS critical_events,
      SUM(CASE WHEN event_type = 'login_failed' THEN 1 ELSE 0 END) AS failed_logins,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed_events
    FROM tbl_security_audit_logs
    `,
    []
  );

  return {
    total_events: Number(summary?.total_events || 0),
    critical_events: Number(summary?.critical_events || 0),
    failed_logins: Number(summary?.failed_logins || 0),
    failed_events: Number(summary?.failed_events || 0),
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  getRequestIp,
  getUserAgent,

  logSecurityEvent,
  logRequestSecurityEvent,

  logLoginSuccess,
  logLoginFailure,
  logLogout,

  logPasswordResetRequested,
  logPasswordResetCompleted,

  logAccessDenied,
  logSuspiciousActivity,

  listSecurityEvents,
  getSecuritySummary,
};