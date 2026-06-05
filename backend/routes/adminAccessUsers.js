//backend\routes\adminAccessUsers.js
"use strict";

const express = require("express");
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

function clean(value, max = 255) {
  return String(value || "").trim().slice(0, max);
}

function cleanRoleFilter(value) {
  const role = clean(value, 30).toLowerCase();
  return ["member", "finance", "admin", "reconciliation", "super_admin"].includes(role)
    ? role
    : "";
}

router.get("/", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const search = clean(req.query.search || "", 190);
    const role = cleanRoleFilter(req.query.role || "");
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const pageSize = Math.min(
      200,
      Math.max(1, parseInt(req.query.pageSize || "10", 10))
    );
    const offset = (page - 1) * pageSize;

    const where = [];
    const params = [];

    if (search) {
      where.push(`
        (
          u.username LIKE ?
          OR u.email LIKE ?
          OR u.role LIKE ?
          OR COALESCE(m.member_no, '') LIKE ?
          OR COALESCE(m.full_name, '') LIKE ?
          OR COALESCE(u.full_name, '') LIKE ?
        )
      `);
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like);
    }

    if (role) {
      where.push(`LOWER(COALESCE(u.role, '')) = ?`);
      params.push(role);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [[{ total }]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_users u
      LEFT JOIN tbl_members m
        ON m.id = u.member_id
      ${whereSql}
      `,
      params
    );

    const [rows] = await pool.query(
      `
      SELECT
        u.id,
        u.member_id,
        u.username,
        u.first_name,
        u.last_name,
        u.full_name,
        u.email,
        u.phone,
        u.role,
        u.is_active,
        u.must_change_password,
        u.created_at,
        u.updated_at,
        m.member_no,
        COALESCE(m.full_name, u.full_name, CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS member_full_name
      FROM tbl_users u
      LEFT JOIN tbl_members m
        ON m.id = u.member_id
      ${whereSql}
      ORDER BY
        CASE
          WHEN u.role = 'super_admin' THEN 1
          WHEN u.role = 'admin' THEN 2
          WHEN u.role = 'reconciliation' THEN 3
          WHEN u.role = 'finance' THEN 4
          WHEN u.role = 'member' THEN 5
          ELSE 6
        END,
        u.created_at DESC,
        u.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );

    const [[summary]] = await pool.query(
      `
      SELECT
        SUM(CASE WHEN LOWER(COALESCE(u.role, '')) = 'member' THEN 1 ELSE 0 END) AS member_count,
        SUM(CASE WHEN LOWER(COALESCE(u.role, '')) = 'finance' THEN 1 ELSE 0 END) AS finance_count,
        SUM(CASE WHEN LOWER(COALESCE(u.role, '')) = 'admin' THEN 1 ELSE 0 END) AS admin_count,
        SUM(CASE WHEN LOWER(COALESCE(u.role, '')) = 'reconciliation' THEN 1 ELSE 0 END) AS reconciliation_count,
        SUM(CASE WHEN LOWER(COALESCE(u.role, '')) = 'super_admin' THEN 1 ELSE 0 END) AS super_admin_count,
        COUNT(*) AS total_count
      FROM tbl_users u
      `
    );

    return res.json({
      ok: true,
      rows,
      total,
      page,
      pageSize,
      summary: {
        member: Number(summary?.member_count || 0),
        finance: Number(summary?.finance_count || 0),
        admin: Number(summary?.admin_count || 0),
        reconciliation: Number(summary?.reconciliation_count || 0),
        super_admin: Number(summary?.super_admin_count || 0),
        all: Number(summary?.total_count || 0),
      },
    });
  } catch (err) {
    console.error("GET /admin/access-users error:", err);
    return res.status(500).json({ error: "Failed to load access users." });
  }
});

module.exports = router;