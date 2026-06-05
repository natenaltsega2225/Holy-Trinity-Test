// backend/services/domains/audit/auditLogService.js
"use strict";

const pool = require("../../../db");

const {
  insertExistingColumns,
  findMany,
} = require("../../../utils/dbHelpers");

const {
  clean,
  nullable,
  mysqlNow,
} = require("../../../utils/financeHelpers");

/* =========================================================
   WRITE AUDIT LOG
========================================================= */

async function writeAuditLog(conn, payload = {}) {
  return insertExistingColumns(conn || pool, "tbl_audit_logs", {
    actor_id: payload.actor_id || payload.user_id || null,
    actor_role: nullable(payload.actor_role || payload.role, 80),
    actor_email: nullable(payload.actor_email || payload.email, 180),

    action: clean(payload.action || "unknown", 120),
    entity_type: clean(payload.entity_type || "system", 120),
    entity_id: payload.entity_id || null,

    description: nullable(payload.description, 1000),

    ip_address: nullable(payload.ip_address, 80),
    user_agent: nullable(payload.user_agent, 500),

    before_json: payload.before ? JSON.stringify(payload.before) : null,
    after_json: payload.after ? JSON.stringify(payload.after) : null,
    metadata_json: payload.metadata ? JSON.stringify(payload.metadata) : null,

    created_at: mysqlNow(),
  }).catch((err) => {
    console.error("writeAuditLog failed:", err.message);
    return null;
  });
}

/* =========================================================
   REQUEST AUDIT HELPER
========================================================= */

async function writeRequestAudit(req, payload = {}) {
  return writeAuditLog(null, {
    actor_id: req.user?.id || null,
    actor_role: req.user?.role || null,
    actor_email: req.user?.email || null,

    ip_address:
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      null,

    user_agent: req.headers["user-agent"] || null,

    ...payload,
  });
}

/* =========================================================
   LIST AUDIT LOGS
========================================================= */

async function listAuditLogs(filters = {}) {
  const params = [];
  const where = [];

  if (filters.actor_id) {
    where.push("actor_id = ?");
    params.push(filters.actor_id);
  }

  if (filters.action) {
    where.push("action = ?");
    params.push(filters.action);
  }

  if (filters.entity_type) {
    where.push("entity_type = ?");
    params.push(filters.entity_type);
  }

  if (filters.search) {
    const q = `%${filters.search}%`;

    where.push(`
      (
        actor_email LIKE ?
        OR action LIKE ?
        OR entity_type LIKE ?
        OR description LIKE ?
      )
    `);

    params.push(q, q, q, q);
  }

  const limit = Math.min(200, Number(filters.limit || 100));
  const offset = Math.max(0, Number(filters.offset || 0));

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  return findMany(
    pool,
    `
    SELECT *
    FROM tbl_audit_logs
    ${whereSql}
    ORDER BY created_at DESC, id DESC
    LIMIT ?
    OFFSET ?
    `,
    [...params, limit, offset]
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  writeAuditLog,
  writeRequestAudit,
  listAuditLogs,
};