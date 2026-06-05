//backend\routes\reconciliation.js
"use strict";

const express = require("express");
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");
const { autoMatch } = require("../utils/autoMatchEngine");
const { writeAuditLog } = require("../utils/audit");

const router = express.Router();

function clean(value, max = 255) {
  return String(value || "").trim().slice(0, max);
}

function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clampPageLimit(req, defaultLimit = 25) {
  const page = Math.max(1, toInt(req.query.page, 1));
  const limit = Math.min(200, Math.max(10, toInt(req.query.limit || req.query.pageSize, defaultLimit)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function dateWhere(alias, req, params) {
  const parts = [];
  const startDate = clean(req.query.startDate || "", 20);
  const endDate = clean(req.query.endDate || "", 20);

  if (startDate) {
    parts.push(`DATE(${alias}) >= ?`);
    params.push(startDate);
  }

  if (endDate) {
    parts.push(`DATE(${alias}) <= ?`);
    params.push(endDate);
  }

  return parts;
}

const allowReconAccess = requireRole("reconciliation", "finance", "admin", "super_admin");

router.get("/summary", authRequired, allowReconAccess, async (_req, res) => {
  try {
    const [[payments]] = await pool.query(`
      SELECT
        COUNT(*) AS total_rows,
        SUM(CASE WHEN COALESCE(reconciled, 0) = 1 THEN 1 ELSE 0 END) AS matched_rows,
        SUM(CASE WHEN COALESCE(reconciled, 0) = 0 THEN 1 ELSE 0 END) AS unmatched_rows,
        COALESCE(SUM(amount), 0) AS total_amount,
        COALESCE(SUM(CASE WHEN COALESCE(reconciled, 0) = 0 THEN amount ELSE 0 END), 0) AS unmatched_amount
      FROM tbl_finance_payments
    `);

    const [[stripe]] = await pool.query(`
      SELECT
        COUNT(*) AS stripe_rows,
        COALESCE(SUM(amount), 0) AS stripe_amount
      FROM tbl_finance_payments
      WHERE provider = 'stripe'
    `);

    const [[discrepancies]] = await pool.query(`
      SELECT COUNT(*) AS discrepancy_count
      FROM tbl_finance_payments
      WHERE COALESCE(reconciliation_status, '') IN ('mismatch', 'missing_bank', 'missing_db', 'duplicate')
    `);

    const total = Number(payments?.total_rows || 0);
    const matched = Number(payments?.matched_rows || 0);

    return res.json({
      ok: true,
      total,
      matched,
      unmatched: Number(payments?.unmatched_rows || 0),
      match_rate: total ? Number(((matched / total) * 100).toFixed(2)) : 0,
      total_amount: Number(payments?.total_amount || 0),
      unmatched_amount: Number(payments?.unmatched_amount || 0),
      stripe_rows: Number(stripe?.stripe_rows || 0),
      stripe_amount: Number(stripe?.stripe_amount || 0),
      discrepancy_count: Number(discrepancies?.discrepancy_count || 0),
    });
  } catch (err) {
    console.error("GET /reconciliation/summary error:", err);
    return res.status(500).json({ error: "Failed to load reconciliation summary." });
  }
});

router.get("/items", authRequired, allowReconAccess, async (req, res) => {
  try {
    const { page, limit, offset } = clampPageLimit(req);
    const search = clean(req.query.search || req.query.q || "", 120);
    const status = clean(req.query.status || "", 60).toLowerCase();
    const provider = clean(req.query.provider || "", 60).toLowerCase();

    const where = [];
    const params = [];

    if (search) {
      const like = `%${search}%`;
      where.push(`
        (
          COALESCE(full_name_snapshot, '') LIKE ?
          OR COALESCE(payment_number, '') LIKE ?
          OR COALESCE(reference_no, '') LIKE ?
          OR COALESCE(stripe_payment_intent_id, '') LIKE ?
          OR COALESCE(stripe_checkout_session_id, '') LIKE ?
          OR COALESCE(method, '') LIKE ?
          OR COALESCE(provider, '') LIKE ?
        )
      `);
      params.push(like, like, like, like, like, like, like);
    }

    if (status) {
      if (status === "matched") where.push(`COALESCE(reconciled, 0) = 1`);
      else if (status === "unmatched") where.push(`COALESCE(reconciled, 0) = 0`);
      else {
        where.push(`LOWER(COALESCE(reconciliation_status, '')) = ?`);
        params.push(status);
      }
    }

    if (provider) {
      where.push(`LOWER(COALESCE(provider, '')) = ?`);
      params.push(provider);
    }

    where.push(...dateWhere("COALESCE(paid_at, payment_date, created_at)", req, params));

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `
      SELECT
        id,
        member_id,
        payment_number,
        COALESCE(full_name_snapshot, '') AS full_name,
        payment_type,
        method,
        provider,
        amount,
        status,
        reconciled,
        reconciliation_status,
        approved_by,
        approved_at,
        COALESCE(paid_at, payment_date, created_at) AS created_at,
        stripe_payment_intent_id,
        stripe_checkout_session_id,
        stripe_charge_id,
        COALESCE(reference_no, stripe_payment_intent_id, stripe_checkout_session_id, stripe_charge_id, payment_number) AS reference
      FROM tbl_finance_payments
      ${whereSql}
      ORDER BY COALESCE(paid_at, payment_date, created_at) DESC, id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [[countRow]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_finance_payments
      ${whereSql}
      `,
      params
    );

    return res.json({
      ok: true,
      rows,
      total: Number(countRow?.total || 0),
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(Number(countRow?.total || 0) / limit)),
    });
  } catch (err) {
    console.error("GET /reconciliation/items error:", err);
    return res.status(500).json({ error: "Failed to load reconciliation items." });
  }
});

router.get("/stripe", authRequired, allowReconAccess, async (req, res) => {
  try {
    const { page, limit, offset } = clampPageLimit(req);
    const search = clean(req.query.search || req.query.q || "", 120);
    const status = clean(req.query.status || "", 60).toLowerCase();

    const where = [`provider = 'stripe'`];
    const params = [];

    if (search) {
      const like = `%${search}%`;
      where.push(`
        (
          payment_number LIKE ?
          OR stripe_payment_intent_id LIKE ?
          OR stripe_checkout_session_id LIKE ?
          OR stripe_charge_id LIKE ?
          OR full_name_snapshot LIKE ?
          OR email_snapshot LIKE ?
        )
      `);
      params.push(like, like, like, like, like, like);
    }

    if (status === "matched") where.push(`COALESCE(reconciled, 0) = 1`);
    if (status === "unmatched") where.push(`COALESCE(reconciled, 0) = 0`);

    where.push(...dateWhere("COALESCE(paid_at, payment_date, created_at)", req, params));

    const whereSql = `WHERE ${where.join(" AND ")}`;

    const [rows] = await pool.query(
      `
      SELECT
        id,
        COALESCE(stripe_payment_intent_id, stripe_checkout_session_id, stripe_charge_id) AS stripe_id,
        payment_number,
        COALESCE(full_name_snapshot, '--') AS full_name,
        amount,
        status,
        provider,
        reconciled AS matched,
        reconciliation_status,
        COALESCE(paid_at, payment_date, created_at) AS received_at,
        stripe_payment_intent_id,
        stripe_checkout_session_id,
        stripe_charge_id,
        card_brand,
        card_last4
      FROM tbl_finance_payments
      ${whereSql}
      ORDER BY COALESCE(paid_at, payment_date, created_at) DESC, id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM tbl_finance_payments ${whereSql}`,
      params
    );

    return res.json({
      ok: true,
      rows,
      total: Number(countRow?.total || 0),
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(Number(countRow?.total || 0) / limit)),
    });
  } catch (err) {
    console.error("GET /reconciliation/stripe error:", err);
    return res.status(500).json({ error: "Failed to load Stripe matches." });
  }
});

router.get("/auto-match-preview", authRequired, allowReconAccess, async (_req, res) => {
  try {
    const [dbRows] = await pool.query(`
      SELECT
        id,
        amount,
        COALESCE(paid_at, payment_date, created_at) AS date,
        full_name_snapshot AS full_name,
        COALESCE(reference_no, stripe_payment_intent_id, stripe_checkout_session_id, stripe_charge_id, payment_number) AS reference
      FROM tbl_finance_payments
      WHERE COALESCE(reconciled, 0) = 0
      ORDER BY COALESCE(paid_at, payment_date, created_at) DESC
      LIMIT 300
    `);

    const [bankRows] = await pool.query(`
      SELECT
        id,
        amount,
        transaction_date AS date,
        reference,
        description,
        matched_payment_id
      FROM tbl_reconciliation_bank_import_rows
      WHERE matched_payment_id IS NULL
      ORDER BY transaction_date DESC, id DESC
      LIMIT 300
    `);

    const result = autoMatch(dbRows, bankRows, 70);

    return res.json({
      ok: true,
      matches: result.matches,
      unmatched_db: result.unmatchedLeft,
      unmatched_bank: result.unmatchedRight,
    });
  } catch (err) {
    console.error("GET /reconciliation/auto-match-preview error:", err);
    return res.status(500).json({ error: "Failed to run auto match preview." });
  }
});

router.post("/bulk-match", authRequired, allowReconAccess, async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const ids = Array.isArray(req.body.ids)
      ? req.body.ids.map(toId).filter(Boolean)
      : [];

    if (!ids.length) {
      return res.status(400).json({ error: "No valid ids were provided." });
    }

    await conn.beginTransaction();

    await conn.query(
      `
      UPDATE tbl_finance_payments
      SET
        reconciled = 1,
        reconciliation_status = 'matched',
        approved_by = ?,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id IN (?)
      `,
      [req.user.id, ids]
    );

    await writeAuditLog({
      actorId: req.user.id,
      action: "reconciliation.bulk_match",
      entity: "finance_payment",
      entityId: ids.join(","),
      ipAddress: req.ip,
      meta: { ids, count: ids.length },
      riskLevel: "high",
    });

    await conn.commit();

    return res.json({
      ok: true,
      count: ids.length,
      message: "Selected transactions matched successfully.",
    });
  } catch (err) {
    await conn.rollback();
    console.error("POST /reconciliation/bulk-match error:", err);
    return res.status(500).json({ error: "Failed to bulk match transactions." });
  } finally {
    conn.release();
  }
});

router.post("/approve/:id", authRequired, allowReconAccess, async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid payment id." });

    await pool.query(
      `
      UPDATE tbl_finance_payments
      SET
        reconciled = 1,
        reconciliation_status = 'matched',
        approved_by = ?,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = ?
      `,
      [req.user.id, id]
    );

    await writeAuditLog({
      actorId: req.user.id,
      action: "reconciliation.approved",
      entity: "finance_payment",
      entityId: id,
      ipAddress: req.ip,
      riskLevel: "high",
    });

    return res.json({ ok: true, message: "Transaction approved." });
  } catch (err) {
    console.error("POST /reconciliation/approve/:id error:", err);
    return res.status(500).json({ error: "Failed to approve transaction." });
  }
});

router.get("/discrepancies", authRequired, allowReconAccess, async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        payment_number,
        COALESCE(full_name_snapshot, '--') AS full_name,
        amount,
        reconciliation_status,
        COALESCE(paid_at, payment_date, created_at) AS created_at
      FROM tbl_finance_payments
      WHERE COALESCE(reconciliation_status, '') IN ('mismatch', 'missing_bank', 'missing_db', 'duplicate')
      ORDER BY COALESCE(paid_at, payment_date, created_at) DESC, id DESC
    `);

    return res.json({ ok: true, rows });
  } catch (err) {
    console.error("GET /reconciliation/discrepancies error:", err);
    return res.status(500).json({ error: "Failed to load discrepancies." });
  }
});

router.get("/audit-logs", authRequired, allowReconAccess, async (req, res) => {
  try {
    const { page, limit, offset } = clampPageLimit(req);
    const search = clean(req.query.search || req.query.q || "", 150);
    const action = clean(req.query.action || "", 120).toLowerCase();
    const entity = clean(req.query.entity || "", 120).toLowerCase();

    const where = [];
    const params = [];

    if (search) {
      const like = `%${search}%`;
      where.push(`
        (
          a.action LIKE ?
          OR a.entity LIKE ?
          OR CAST(a.entity_id AS CHAR) LIKE ?
          OR CAST(a.meta_json AS CHAR) LIKE ?
          OR COALESCE(a.ip_address, '') LIKE ?
          OR COALESCE(u.email, '') LIKE ?
          OR COALESCE(u.username, '') LIKE ?
        )
      `);
      params.push(like, like, like, like, like, like, like);
    }

    if (action) {
      where.push(`LOWER(a.action) = ?`);
      params.push(action);
    }

    if (entity) {
      where.push(`LOWER(a.entity) = ?`);
      params.push(entity);
    }

    where.push(...dateWhere("a.created_at", req, params));

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `
      SELECT
        a.id,
        a.created_at,
        a.actor_id,
        COALESCE(u.username, u.email, CONCAT('User #', a.actor_id), 'System') AS actor_name,
        COALESCE(u.role, 'system') AS actor_role,
        a.action,
        a.entity,
        a.entity_id,
        COALESCE(a.risk_level, 'normal') AS risk_level,
        a.ip_address,
        a.meta_json,
        LEFT(COALESCE(CAST(a.meta_json AS CHAR), ''), 180) AS meta_summary
      FROM tbl_audit_logs a
      LEFT JOIN tbl_users u ON u.id = a.actor_id
      ${whereSql}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [[countRow]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_audit_logs a
      LEFT JOIN tbl_users u ON u.id = a.actor_id
      ${whereSql}
      `,
      params
    );

    return res.json({
      ok: true,
      rows,
      total: Number(countRow?.total || 0),
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(Number(countRow?.total || 0) / limit)),
    });
  } catch (err) {
    console.error("GET /reconciliation/audit-logs error:", err);
    return res.status(500).json({ error: "Failed to load audit logs." });
  }
});

router.get("/audit-logs/export", authRequired, allowReconAccess, async (req, res) => {
  try {
    const search = clean(req.query.search || req.query.q || "", 150);
    const action = clean(req.query.action || "", 120).toLowerCase();
    const entity = clean(req.query.entity || "", 120).toLowerCase();

    const where = [];
    const params = [];

    if (search) {
      const like = `%${search}%`;
      where.push(`(a.action LIKE ? OR a.entity LIKE ? OR CAST(a.meta_json AS CHAR) LIKE ?)`);
      params.push(like, like, like);
    }

    if (action) {
      where.push(`LOWER(a.action) = ?`);
      params.push(action);
    }

    if (entity) {
      where.push(`LOWER(a.entity) = ?`);
      params.push(entity);
    }

    where.push(...dateWhere("a.created_at", req, params));

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `
      SELECT
        a.created_at,
        COALESCE(u.username, u.email, CONCAT('User #', a.actor_id), 'System') AS actor_name,
        COALESCE(u.role, 'system') AS actor_role,
        a.action,
        a.entity,
        a.entity_id,
        COALESCE(a.risk_level, 'normal') AS risk_level,
        a.ip_address,
        CAST(a.meta_json AS CHAR) AS meta_json
      FROM tbl_audit_logs a
      LEFT JOIN tbl_users u ON u.id = a.actor_id
      ${whereSql}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 5000
      `,
      params
    );

    const header = [
      "created_at",
      "actor_name",
      "actor_role",
      "action",
      "entity",
      "entity_id",
      "risk_level",
      "ip_address",
      "meta_json",
    ];

    const csv = [
      header.join(","),
      ...rows.map((row) =>
        header
          .map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`)
          .join(",")
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=reconciliation-audit-logs.csv");
    return res.send(csv);
  } catch (err) {
    console.error("GET /reconciliation/audit-logs/export error:", err);
    return res.status(500).json({ error: "Failed to export audit logs." });
  }
});

router.post("/lock-period", authRequired, allowReconAccess, async (req, res) => {
  try {
    const startDate = clean(req.body.startDate || "", 20);
    const endDate = clean(req.body.endDate || "", 20);

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Start and end dates are required." });
    }

    await pool.query(
      `
      INSERT INTO tbl_reconciliation_period_locks (
        period_start,
        period_end,
        locked_by,
        locked_at
      )
      VALUES (?, ?, ?, NOW())
      `,
      [startDate, endDate, req.user.id]
    );

    await writeAuditLog({
      actorId: req.user.id,
      action: "reconciliation.period_locked",
      entity: "reconciliation_period",
      entityId: `${startDate}:${endDate}`,
      ipAddress: req.ip,
      meta: { startDate, endDate },
      riskLevel: "high",
    });

    return res.json({ ok: true, message: "Period locked successfully." });
  } catch (err) {
    console.error("POST /reconciliation/lock-period error:", err);
    return res.status(500).json({ error: "Failed to lock reconciliation period." });
  }
});

module.exports = router;