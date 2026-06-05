
// middleware/audit.js
"use strict";

const pool = require("../db");

function getClientIp(req) {
  const xf = (req.headers["x-forwarded-for"] || "").toString();
  const first = xf.split(",")[0]?.trim();
  return first || req.ip || null;
}

/**
 * audit(action, options?)
 * Stores small/safe metadata only.
 */
function audit(action, options = {}) {
  return (req, res, next) => {
    const start = Date.now();

    res.on("finish", async () => {
      try {
        const actor_member_id = req.user?.id ?? null;
        const actor_role = req.user?.role ?? null;

        const ip = getClientIp(req);
        const method = req.method || null;
        const path = req.originalUrl || req.path || null;

        const status_code = res.statusCode || null;
        const request_id = req.requestId || req.headers["x-request-id"] || null;

        const ua = (req.headers["user-agent"] || "").toString();
        const user_agent = ua ? ua.slice(0, 255) : null;

        const target =
          typeof options.target === "function"
            ? options.target(req)
            : options.target || null;

        const baseDetails = {
          duration_ms: Date.now() - start,
          params: req.params || {},
          query: req.query || {},
        };

        const extraDetails =
          typeof options.details === "function"
            ? options.details(req)
            : options.details || {};

        const details = { ...baseDetails, ...extraDetails };

        await pool.query(
          `
          INSERT INTO audit_logs
            (actor_member_id, actor_role, ip, method, path, action,
             status_code, request_id, user_agent, target, details)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            actor_member_id,
            actor_role,
            ip,
            method,
            path,
            action || null,
            status_code,
            request_id,
            user_agent,
            target,
            JSON.stringify(details),
          ]
        );
      } catch (e) {
        console.error("AUDIT LOG FAILED:", e.code || e.message);
      }
    });

    next();
  };
}

module.exports = { audit };