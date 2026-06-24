//backend\services\domains\security\auditService.js
"use strict";

const pool = require("../../../db");

function safeJson(value) {
  if (value === undefined) return null;
  if (value === null) return null;

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function getRequestMeta(req = {}) {
  return {
    ip_address:
      req.ip ||
      req.headers?.["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      null,

    user_agent:
      req.headers?.["user-agent"] || null,

    request_id:
      req.requestId || req.id || null,
  };
}

async function ensureAuditTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tbl_security_audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      actor_user_id BIGINT UNSIGNED NULL,
      target_user_id BIGINT UNSIGNED NULL,
      action VARCHAR(120) NOT NULL,
      entity_type VARCHAR(120) NULL,
      entity_id BIGINT UNSIGNED NULL,
      old_value JSON NULL,
      new_value JSON NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'success',
      ip_address VARCHAR(100) NULL,
      user_agent TEXT NULL,
      request_id VARCHAR(120) NULL,
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_security_audit_actor (actor_user_id),
      KEY idx_security_audit_target (target_user_id),
      KEY idx_security_audit_action (action),
      KEY idx_security_audit_created (created_at)
    )
  `);
}

async function logSecurityEvent({
  req = null,
  actorUserId = null,
  targetUserId = null,
  action,
  entityType = "user",
  entityId = null,
  oldValue = null,
  newValue = null,
  status = "success",
  notes = null,
}) {
  if (!action) return null;

  await ensureAuditTable();

  const meta = getRequestMeta(req || {});

  const actor =
    actorUserId ||
    req?.user?.id ||
    null;

  const [result] = await pool.query(
    `
    INSERT INTO tbl_security_audit_logs
    (
      actor_user_id,
      target_user_id,
      action,
      entity_type,
      entity_id,
      old_value,
      new_value,
      status,
      ip_address,
      user_agent,
      request_id,
      notes
    )
    VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?, ?, ?)
    `,
    [
      actor,
      targetUserId,
      String(action).slice(0, 120),
      entityType,
      entityId,
      safeJson(oldValue),
      safeJson(newValue),
      status,
      meta.ip_address,
      meta.user_agent,
      meta.request_id,
      notes,
    ]
  );

  return result.insertId;
}

async function listSecurityEvents({
  userId = null,
  action = "",
  limit = 100,
  offset = 0,
} = {}) {
  await ensureAuditTable();

  const where = [];
  const params = [];

  if (userId) {
    where.push(
      "(actor_user_id = ? OR target_user_id = ?)"
    );
    params.push(userId, userId);
  }

  if (action) {
    where.push("action = ?");
    params.push(action);
  }

  const whereSql = where.length
    ? `WHERE ${where.join(" AND ")}`
    : "";

  const [rows] = await pool.query(
    `
    SELECT *
    FROM tbl_security_audit_logs
    ${whereSql}
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
    `,
    [
      ...params,
      Math.min(Number(limit) || 100, 500),
      Number(offset) || 0,
    ]
  );

  return rows;
}

module.exports = {
  ensureAuditTable,
  logSecurityEvent,
  listSecurityEvents,
};