// backend/routes/financeAuditLogs.js
"use strict";

const express = require("express");

const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();

const FINANCE_ROLES = ["finance", "admin", "super_admin", "reconciliation"];
const columnCache = new Map();

function sqlId(name) {
  return `\`${String(name).replaceAll("`", "``")}\``;
}

function intValue(value, fallback = 25, min = 1, max = 250) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
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
  return `COALESCE(${pick(columns, names, "NULL")}, ${fallback})`;
}

function dateExpr(columns) {
  return pick(columns, ["created_at", "event_time", "timestamp", "logged_at"], "NULL");
}

function jsonResponse(res, payload) {
  return res.json({
    ok: true,
    ...payload,
  });
}

function errorResponse(res, err, fallback) {
  console.error(fallback, err);
  return res.status(err.status || err.statusCode || 500).json({
    ok: false,
    error: err.status || err.statusCode ? err.message : fallback,
  });
}

router.use(authRequired);
router.use(requireRole(...FINANCE_ROLES));

router.get("/health/check", (_req, res) => {
  return jsonResponse(res, {
    module: "financeAuditLogs",
    version: "enterprise",
    protected: true,
    endpoint: "/api/finance/audit-logs",
    timestamp: new Date().toISOString(),
  });
});

async function listAuditRows(req, res) {
  try {
    const columns = await tableColumns("tbl_audit_logs");

    if (!columns.size) {
      return jsonResponse(res, {
        rows: [],
        audit_logs: [],
        total: 0,
        page: 1,
        pageSize: 25,
        message: "Audit table is not available.",
      });
    }

    const page = intValue(req.query.page, 1, 1, 100000);
    const pageSize = intValue(req.query.pageSize || req.query.limit, 25, 1, 250);
    const offset = (page - 1) * pageSize;

    const where = [];
    const params = [];

    const actionColumn = pick(columns, ["action", "event_type"], null);
    const entityColumn = pick(columns, ["entity", "entity_type", "module"], null);
    const actorColumn = pick(columns, ["actor_id", "user_id"], null);
    const createdColumn = dateExpr(columns);

    if (req.query.action && actionColumn) {
      where.push(`${actionColumn} = ?`);
      params.push(clean(req.query.action, 120));
    }

    if ((req.query.entity || req.query.entity_type) && entityColumn) {
      where.push(`${entityColumn} = ?`);
      params.push(clean(req.query.entity || req.query.entity_type, 120));
    }

    if (req.query.actor_id && actorColumn) {
      where.push(`${actorColumn} = ?`);
      params.push(req.query.actor_id);
    }

    if ((req.query.from || req.query.date_from) && createdColumn !== "NULL") {
      where.push(`DATE(${createdColumn}) >= ?`);
      params.push(req.query.from || req.query.date_from);
    }

    if ((req.query.to || req.query.date_to) && createdColumn !== "NULL") {
      where.push(`DATE(${createdColumn}) <= ?`);
      params.push(req.query.to || req.query.date_to);
    }

    const search = clean(req.query.search || req.query.q, 120);

    if (search) {
      const searchable = [
        "actor_email",
        "user_email",
        "actor_name",
        "user_name",
        "action",
        "event_type",
        "entity",
        "entity_type",
        "module",
        "description",
        "message",
        "notes",
        "reference_no",
        "ip_address",
      ].filter((column) => columns.has(column));

      if (searchable.length) {
        where.push(`(${searchable.map((column) => `${sqlId(column)} LIKE ?`).join(" OR ")})`);
        params.push(...searchable.map(() => `%${search}%`));
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const selectSql = `
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
    `;

    const [rows] = await pool.query(
      `
      ${selectSql}
      ORDER BY
        ${createdColumn === "NULL" ? "id" : createdColumn} DESC,
        id DESC
      LIMIT ?
      OFFSET ?
      `,
      [...params, pageSize, offset]
    );

    const [countRows] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_audit_logs
      ${whereSql}
      `,
      params
    );

    const total = Number(countRows?.[0]?.total || rows.length || 0);

    return jsonResponse(res, {
      rows,
      audit_logs: rows,
      total,
      page,
      pageSize,
    });
  } catch (err) {
    return errorResponse(res, err, "Failed to load finance audit logs.");
  }
}

router.get("/", listAuditRows);

/*
  Compatibility paths if this router is mounted at /api/finance instead of
  /api/finance/audit-logs. Keeping these here prevents old frontend builds from
  falling through to 404 while the app is deployed.
*/
router.get("/audit-logs", listAuditRows);
router.get("/audit", listAuditRows);
router.get("/reports/audit", listAuditRows);

router.all("*", (_req, res) => {
  return res.status(405).json({
    ok: false,
    error: "Method Not Allowed",
  });
});

module.exports = router;
