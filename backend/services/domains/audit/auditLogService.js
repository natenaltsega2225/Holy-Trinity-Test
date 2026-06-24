// backend/services/domains/audit/auditLogService.js
"use strict";

const pool = require("../../../db");

const {
  insertExistingColumns,
} = require("../../../utils/dbHelpers");

const columnCache = new Map();

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

function nullable(value, max = 255) {
  const text = clean(value, max);
  return text || null;
}

function mysqlNow() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function sqlId(name) {
  return `\`${String(name).replaceAll("`", "``")}\``;
}

async function tableColumns(table) {
  if (columnCache.has(table)) return columnCache.get(table);

  try {
    const [rows] = await pool.query(`SHOW COLUMNS FROM ${sqlId(table)}`);
    const columns = new Set(rows.map((row) => row.Field));
    columnCache.set(table, columns);
    return columns;
  } catch (_err) {
    const columns = new Set();
    columnCache.set(table, columns);
    return columns;
  }
}

function pick(columns, names, fallback = "NULL") {
  const column = names.find((name) => columns.has(name));
  return column ? sqlId(column) : fallback;
}

function textExpr(columns, names, fallback = "'--'") {
  const column = pick(columns, names, "NULL");
  return `COALESCE(${column}, ${fallback})`;
}

function dateExpr(columns) {
  return pick(columns, ["created_at", "event_time", "timestamp", "logged_at"], "NULL");
}

function intValue(value, fallback = 100, min = 1, max = 500) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function jsonText(value) {
  if (value == null) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch (_err) {
    return null;
  }
}

function resolveEntity(payload = {}) {
  return clean(
    payload.entity ||
      payload.entity_type ||
      payload.entityType ||
      payload.module ||
      "system",
    120
  );
}

function resolveActor(reqOrPayload = {}) {
  const user = reqOrPayload.user || {};

  return {
    actor_id:
      reqOrPayload.actor_id ||
      reqOrPayload.user_id ||
      user.id ||
      user.user_id ||
      null,
    actor_name:
      reqOrPayload.actor_name ||
      reqOrPayload.user_name ||
      user.full_name ||
      user.name ||
      null,
    actor_role:
      reqOrPayload.actor_role ||
      reqOrPayload.role ||
      user.role ||
      null,
    actor_email:
      reqOrPayload.actor_email ||
      reqOrPayload.email ||
      user.email ||
      null,
  };
}

async function writeAuditLog(conn, payload = {}) {
  const db = conn || pool;
  const actor = resolveActor(payload);
  const entity = resolveEntity(payload);

  const row = {
    actor_id: actor.actor_id,
    user_id: actor.actor_id,
    actor_name: nullable(actor.actor_name, 180),
    user_name: nullable(actor.actor_name, 180),
    actor_role: nullable(actor.actor_role, 80),
    role: nullable(actor.actor_role, 80),
    actor_email: nullable(actor.actor_email, 190),
    user_email: nullable(actor.actor_email, 190),

    action: clean(payload.action || payload.event_type || "unknown", 120),
    event_type: clean(payload.event_type || payload.action || "unknown", 120),

    entity,
    entity_type: entity,
    module: entity,
    entity_id: payload.entity_id || payload.record_id || payload.target_id || null,

    description: nullable(payload.description || payload.message || payload.notes, 1500),
    message: nullable(payload.message || payload.description || payload.notes, 1500),
    notes: nullable(payload.notes || payload.description || payload.message, 1500),
    severity: nullable(payload.severity || "info", 40),
    status: nullable(payload.status || "recorded", 40),

    ip_address: nullable(payload.ip_address, 80),
    user_agent: nullable(payload.user_agent, 500),
    reference_no: nullable(payload.reference_no || payload.reference, 120),

    before_json: jsonText(payload.before),
    after_json: jsonText(payload.after),
    metadata_json: jsonText(payload.metadata || payload.details),
    details_json: jsonText(payload.details || payload.metadata),

    created_at: payload.created_at || mysqlNow(),
    updated_at: payload.updated_at || mysqlNow(),
  };

  return insertExistingColumns(db, "tbl_audit_logs", row).catch((err) => {
    console.error("writeAuditLog failed:", err.message);
    return null;
  });
}

async function writeRequestAudit(req, payload = {}) {
  return writeAuditLog(null, {
    ...resolveActor(req),
    ip_address:
      req.headers?.["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      req.ip ||
      null,
    user_agent: req.headers?.["user-agent"] || null,
    ...payload,
  });
}

async function listAuditLogs(filters = {}) {
  const columns = await tableColumns("tbl_audit_logs");

  if (!columns.size) {
    return [];
  }

  const where = [];
  const params = [];

  const actionColumn = pick(columns, ["action", "event_type"], null);
  const entityColumn = pick(columns, ["entity", "entity_type", "module"], null);
  const actorIdColumn = pick(columns, ["actor_id", "user_id"], null);
  const createdColumn = dateExpr(columns);

  if (filters.actor_id && actorIdColumn) {
    where.push(`${actorIdColumn} = ?`);
    params.push(filters.actor_id);
  }

  if (filters.action && actionColumn) {
    where.push(`${actionColumn} = ?`);
    params.push(filters.action);
  }

  if ((filters.entity || filters.entity_type) && entityColumn) {
    where.push(`${entityColumn} = ?`);
    params.push(filters.entity || filters.entity_type);
  }

  if (filters.from && createdColumn !== "NULL") {
    where.push(`DATE(${createdColumn}) >= ?`);
    params.push(filters.from);
  }

  if (filters.to && createdColumn !== "NULL") {
    where.push(`DATE(${createdColumn}) <= ?`);
    params.push(filters.to);
  }

  if (filters.search) {
    const q = `%${clean(filters.search, 120)}%`;
    const searchable = [
      "actor_email",
      "user_email",
      "actor_name",
      "user_name",
      "action",
      "event_type",
      "entity",
      "entity_type",
      "description",
      "message",
      "notes",
      "reference_no",
      "ip_address",
    ].filter((column) => columns.has(column));

    if (searchable.length) {
      where.push(`(${searchable.map((column) => `${sqlId(column)} LIKE ?`).join(" OR ")})`);
      params.push(...searchable.map(() => q));
    }
  }

  const limit = intValue(filters.limit || filters.pageSize, 100, 1, 500);
  const page = intValue(filters.page, 1, 1, 100000);
  const offset =
    filters.offset != null
      ? intValue(filters.offset, 0, 0, 1000000)
      : (page - 1) * limit;

  params.push(limit, offset);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
    SELECT
      id,
      ${textExpr(columns, ["action", "event_type"], "'unknown'")} AS action,
      ${textExpr(columns, ["event_type", "action"], "'unknown'")} AS event_type,
      ${textExpr(columns, ["entity", "entity_type", "module"], "'system'")} AS entity,
      ${textExpr(columns, ["entity_type", "entity", "module"], "'system'")} AS entity_type,
      ${pick(columns, ["entity_id", "record_id", "target_id"], "NULL")} AS entity_id,
      ${pick(columns, ["actor_id", "user_id"], "NULL")} AS actor_id,
      ${textExpr(columns, ["actor_name", "user_name"], "'--'")} AS actor_name,
      ${textExpr(columns, ["actor_email", "user_email", "email"], "'--'")} AS actor_email,
      ${textExpr(columns, ["actor_role", "role"], "'--'")} AS actor_role,
      ${textExpr(columns, ["description", "message", "notes"], "'--'")} AS description,
      ${textExpr(columns, ["ip_address", "ip"], "'--'")} AS ip_address,
      ${textExpr(columns, ["user_agent"], "'--'")} AS user_agent,
      ${textExpr(columns, ["severity"], "'info'")} AS severity,
      ${textExpr(columns, ["status"], "'recorded'")} AS status,
      ${textExpr(columns, ["reference_no", "reference"], "'--'")} AS reference_no,
      ${pick(columns, ["metadata_json", "details_json"], "NULL")} AS metadata_json,
      ${createdColumn} AS created_at
    FROM tbl_audit_logs
    ${whereSql}
    ORDER BY
      ${createdColumn === "NULL" ? "id" : createdColumn} DESC,
      id DESC
    LIMIT ?
    OFFSET ?
    `,
    params
  );

  return rows;
}

module.exports = {
  writeAuditLog,
  writeRequestAudit,
  listAuditLogs,
};
