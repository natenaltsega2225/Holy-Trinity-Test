
// backend/routes/adminAudit.js
"use strict";

const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");

function toInt(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function clean(v, max = 120) {
  return String(v || "").trim().slice(0, max);
}

let auditColumnsCache = null;
let userColumnsCache = null;

function lowerSet(rows) {
  return new Set(rows.map((r) => String(r.Field || "").toLowerCase()));
}

async function getAuditColumns() {
  if (auditColumnsCache) return auditColumnsCache;
  const [rows] = await pool.query("SHOW COLUMNS FROM tbl_audit_logs");
  auditColumnsCache = lowerSet(rows);
  return auditColumnsCache;
}

async function getUserColumns() {
  if (userColumnsCache) return userColumnsCache;
  const [rows] = await pool.query("SHOW COLUMNS FROM tbl_users");
  userColumnsCache = lowerSet(rows);
  return userColumnsCache;
}

function buildUserNameExpr(userCols) {
  if (userCols.has("full_name")) {
    return `NULLIF(TRIM(u.full_name), '')`;
  }

  if (userCols.has("first_name") && userCols.has("last_name")) {
    return `NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), '')`;
  }

  if (userCols.has("username")) {
    return `NULLIF(TRIM(u.username), '')`;
  }

  return `NULL`;
}

function buildUserEmailExpr(userCols) {
  if (userCols.has("email")) {
    return `NULLIF(TRIM(u.email), '')`;
  }
  return `NULL`;
}

function buildUserSearchParts(userCols) {
  const parts = [];

  if (userCols.has("full_name")) parts.push(`u.full_name LIKE ?`);
  if (userCols.has("first_name")) parts.push(`u.first_name LIKE ?`);
  if (userCols.has("last_name")) parts.push(`u.last_name LIKE ?`);
  if (userCols.has("username")) parts.push(`u.username LIKE ?`);
  if (userCols.has("email")) parts.push(`u.email LIKE ?`);

  return parts;
}

function isLogoutAction(action) {
  const v = String(action || "").toLowerCase();
  return v === "logout" || v === "logout_success" || v === "signout" || v === "sign_out";
}

router.get(
  "/",
  authRequired,
  requireRole("admin", "finance"),
  async (req, res) => {
    try {
      const page = clamp(toInt(req.query.page, 1), 1, 1000000);
      const limit = clamp(toInt(req.query.limit || req.query.pageSize, 20), 1, 200);
      const offset = (page - 1) * limit;

      const q = clean(req.query.q || req.query.search || "", 150);
      const action = clean(req.query.action || "", 120).toLowerCase();
      const entity = clean(req.query.entity || "", 120).toLowerCase();

      const auditCols = await getAuditColumns();
      const userCols = await getUserColumns();

      const actorCol = auditCols.has("actor_id")
        ? "actor_id"
        : auditCols.has("user_id")
        ? "user_id"
        : null;

      const hasEntityType = auditCols.has("entity_type");
      const hasEntityId = auditCols.has("entity_id");
      const hasMetaJson = auditCols.has("meta_json");
      const hasIp = auditCols.has("ip_address");

      const userNameExpr = buildUserNameExpr(userCols);
      const userEmailExpr = buildUserEmailExpr(userCols);

      const where = [];
      const params = [];

      if (q) {
        const like = `%${q}%`;
        const searchParts = [
          `a.action LIKE ?`,
          `a.entity LIKE ?`,
        ];

        params.push(like, like);

        if (hasEntityType) {
          searchParts.push(`a.entity_type LIKE ?`);
          params.push(like);
        }

        if (hasEntityId) {
          searchParts.push(`CAST(a.entity_id AS CHAR) LIKE ?`);
          params.push(like);
        }

        if (hasIp) {
          searchParts.push(`a.ip_address LIKE ?`);
          params.push(like);
        }

        if (hasMetaJson) {
          searchParts.push(`CAST(a.meta_json AS CHAR) LIKE ?`);
          params.push(like);
        }

        const userSearchParts = buildUserSearchParts(userCols);
        userSearchParts.forEach((part) => {
          searchParts.push(part);
          params.push(like);
        });

        where.push(`(${searchParts.join(" OR ")})`);
      }

      if (action) {
        where.push(`LOWER(a.action) = ?`);
        params.push(action);
      }

      if (entity) {
        where.push(`LOWER(a.entity) = ?`);
        params.push(entity);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const joinSql = actorCol
        ? `LEFT JOIN tbl_users u ON u.id = a.${actorCol}`
        : `LEFT JOIN tbl_users u ON 1 = 0`;

      const countSql = `
        SELECT COUNT(*) AS total
        FROM tbl_audit_logs a
        ${joinSql}
        ${whereSql}
      `;

      const [[{ total }]] = await pool.query(countSql, params);

      const selectSql = `
        SELECT
          a.id,
          ${actorCol ? `a.${actorCol} AS actor_id` : `NULL AS actor_id`},
          a.action,
          ${hasEntityType ? `a.entity_type,` : `NULL AS entity_type,`}
          a.entity,
          ${hasEntityId ? `a.entity_id,` : `NULL AS entity_id,`}
          ${hasMetaJson ? `a.meta_json,` : `NULL AS meta_json,`}
          ${hasIp ? `a.ip_address,` : `NULL AS ip_address,`}
          a.created_at,
          ${userNameExpr} AS user_name,
          ${userEmailExpr} AS user_email
        FROM tbl_audit_logs a
        ${joinSql}
        ${whereSql}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ? OFFSET ?
      `;

      const [rows] = await pool.query(selectSql, [...params, limit, offset]);

      const normalizedRows = Array.isArray(rows) ? rows.map((row) => ({
        ...row,
        user_name: row.user_name || "--",
        user_email: row.user_email || "--",
        duration_seconds: null,
      })) : [];

      const logoutRows = normalizedRows.filter(
        (row) => row.actor_id && isLogoutAction(row.action)
      );

      if (logoutRows.length) {
        const actorIds = [...new Set(logoutRows.map((row) => Number(row.actor_id)).filter(Boolean))];
        const maxLogoutTime = logoutRows.reduce((max, row) => {
          const t = new Date(row.created_at).getTime();
          return Number.isFinite(t) && t > max ? t : max;
        }, 0);

        if (actorIds.length && maxLogoutTime > 0) {
          const placeholders = actorIds.map(() => "?").join(", ");
          const [loginRows] = await pool.query(
            `
            SELECT
              id,
              ${actorCol ? `${actorCol} AS actor_id` : `NULL AS actor_id`},
              action,
              created_at
            FROM tbl_audit_logs
            WHERE ${actorCol ? `${actorCol}` : `NULL`} IN (${placeholders})
              AND LOWER(action) = 'login_success'
              AND created_at <= ?
            ORDER BY created_at DESC, id DESC
            `,
            [...actorIds, new Date(maxLogoutTime)]
          );

          const loginByActor = new Map();
          actorIds.forEach((id) => loginByActor.set(id, []));

          (loginRows || []).forEach((row) => {
            const id = Number(row.actor_id);
            if (!loginByActor.has(id)) loginByActor.set(id, []);
            loginByActor.get(id).push(row);
          });

          normalizedRows.forEach((row) => {
            if (!row.actor_id || !isLogoutAction(row.action)) return;

            const candidates = loginByActor.get(Number(row.actor_id)) || [];
            const logoutTime = new Date(row.created_at).getTime();
            if (!Number.isFinite(logoutTime)) return;

            const match = candidates.find((login) => {
              const loginTime = new Date(login.created_at).getTime();
              return Number.isFinite(loginTime) && loginTime <= logoutTime;
            });

            if (match) {
              const loginTime = new Date(match.created_at).getTime();
              const seconds = Math.max(0, Math.floor((logoutTime - loginTime) / 1000));
              row.duration_seconds = seconds;
            }
          });
        }
      }

      return res.json({
        ok: true,
        rows: normalizedRows,
        total: total || 0,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil((total || 0) / limit)),
      });
    } catch (e) {
      console.error("adminAudit error:", e.code || e.message, e);
      return res.status(500).json({ error: "Unable to load audit logs" });
    }
  }
);

module.exports = router;