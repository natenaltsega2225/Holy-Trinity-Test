// backend/utils/audit.js
"use strict";

const pool = require("../db");

function safeJson(value) {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "Unable to serialize audit metadata." });
  }
}

function riskForAction(action = "") {
  const v = String(action).toLowerCase();

  if (
    v.includes("delete") ||
    v.includes("failed") ||
    v.includes("webhook.failed") ||
    v.includes("status.updated") ||
    v.includes("reconciliation.approved") ||
    v.includes("bulk")
  ) {
    return "high";
  }

  if (
    v.includes("created") ||
    v.includes("updated") ||
    v.includes("email") ||
    v.includes("pdf") ||
    v.includes("webhook")
  ) {
    return "medium";
  }

  return "normal";
}

async function getColumns(table) {
  try {
    const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
    return new Set(rows.map((r) => r.Field));
  } catch {
    return new Set();
  }
}

async function writeAuditLog({
  actorId = null,
  action,
  entity = "system",
  entityType = null,
  entityId = null,
  meta = null,
  ipAddress = null,
  riskLevel = null,
}) {
  if (!action) return;

  try {
    const cols = await getColumns("tbl_audit_logs");

    const data = {
      actor_id: actorId,
      user_id: actorId,
      action,
      entity,
      entity_type: entityType || entity,
      entity_id: entityId,
      meta_json: safeJson(meta),
      ip_address: ipAddress,
      risk_level: riskLevel || riskForAction(action),
      created_at: new Date(),
    };

    const entries = Object.entries(data).filter(
      ([key, value]) => cols.has(key) && value !== undefined
    );

    if (!entries.length) return;

    const keys = entries.map(([key]) => `\`${key}\``).join(", ");
    const marks = entries.map(() => "?").join(", ");
    const values = entries.map(([, value]) => value);

    await pool.query(
      `INSERT INTO tbl_audit_logs (${keys}) VALUES (${marks})`,
      values
    );
  } catch (err) {
    console.error("writeAuditLog failed:", err.message);
  }
}

module.exports = {
  writeAuditLog,
  riskForAction,
};