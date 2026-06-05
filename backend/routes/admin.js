// // //backend\routes\admin.js


"use strict";

const express = require("express");
const argon2 = require("argon2");
const crypto = require("crypto");
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

let notifications = {};
try {
  notifications = require("../utils/notifications");
} catch {
  notifications = {};
}

let auditUtils = {};
try {
  auditUtils = require("../utils/audit");
} catch {
  auditUtils = {};
}

async function safeNotify(fnName, payload) {
  try {
    if (typeof notifications[fnName] === "function") {
      await notifications[fnName](payload);
    }
  } catch (err) {
    console.error(`notification ${fnName} error:`, err);
  }
}

async function safeAudit(payload) {
  try {
    if (typeof auditUtils.writeAuditLog === "function") {
      await auditUtils.writeAuditLog(payload);
    } else if (typeof auditUtils.queueAuditLog === "function") {
      await auditUtils.queueAuditLog(payload);
    }
  } catch (err) {
    console.error("audit log error:", err);
  }
}

function clean(value, max = 255) {
  return String(value || "").trim().slice(0, max);
}

function nullable(value, max = 255) {
  const s = clean(value, max);
  return s || null;
}

function normEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (raw.startsWith("+")) {
    return raw.replace(/\s+/g, "");
  }

  const digits = onlyDigits(raw);
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8) return `+${digits}`;

  return raw;
}

function toBool01(v, fallback = 1) {
  if (v === true || v === 1 || v === "1") return 1;
  if (v === false || v === 0 || v === "0") return 0;
  return fallback;
}

function buildMemberNo(id) {
  return `M-${String(id).padStart(5, "0")}`;
}

function randomTempPassword(length = 14) {
  return `${crypto.randomBytes(length).toString("base64url").slice(0, length)}!A1`;
}

function isStrongPassword(password) {
  const s = String(password || "");
  if (s.length < 12) return false;
  if (!/[a-z]/.test(s)) return false;
  if (!/[A-Z]/.test(s)) return false;
  if (!/\d/.test(s)) return false;
  if (!/[^A-Za-z0-9]/.test(s)) return false;
  return true;
}

async function hashPassword(password) {
  return argon2.hash(String(password), {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

function buildHouseholdWhere(householdType, where) {
  const normalized = String(householdType || "").trim().toLowerCase();

  if (normalized === "independent") {
    where.push(`COALESCE(m.dependents_count, 0) = 0`);
  } else if (normalized === "with_dependents") {
    where.push(`COALESCE(m.dependents_count, 0) > 0`);
  }
}

router.get("/users", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const search = clean(req.query.search || "");
    const householdType = clean(req.query.householdType || "", 50);
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
          m.member_no LIKE ?
          OR m.first_name LIKE ?
          OR m.last_name LIKE ?
          OR m.full_name LIKE ?
          OR m.email LIKE ?
          OR m.phone LIKE ?
          OR m.city LIKE ?
          OR m.state LIKE ?
          OR m.zip LIKE ?
        )
      `);

      const like = `%${search}%`;
      params.push(like, like, like, like, like, like, like, like, like);
    }

    buildHouseholdWhere(householdType, where);

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [[{ total }]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_members m
      ${whereSql}
      `,
      params
    );

    const [rows] = await pool.query(
      `
      SELECT
        m.id,
        m.member_no,
        m.first_name,
        m.last_name,
        m.full_name,
        m.email,
        m.phone,
        m.address_line1,
        m.address_line2,
        m.city,
        m.state,
        m.zip,
        m.member_type,
        m.registration_fee_status,
        m.status,
        m.membership_status,
        m.is_active,
        m.open_balance,
        m.total_paid,
        m.last_payment_at,
        m.next_due_at,
        COALESCE(m.dependents_count, 0) AS dependents_count,
        COALESCE(m.household_member_count, 1) AS household_member_count,
        (
          SELECT COUNT(*)
          FROM tbl_users u
          WHERE u.member_id = m.id
        ) AS linked_accounts_count,
        m.created_at
      FROM tbl_members m
      ${whereSql}
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );

    const [[summary]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_independent_members,
        COALESCE(SUM(COALESCE(m.dependents_count, 0)), 0) AS total_dependents,
        COUNT(*) + COALESCE(SUM(COALESCE(m.dependents_count, 0)), 0) AS total_members
      FROM tbl_members m
      WHERE m.is_active = 1
      `
    );

    return res.json({
      ok: true,
      rows,
      total,
      page,
      pageSize,
      summary: {
        total_independent_members: Number(summary?.total_independent_members || 0),
        total_dependents: Number(summary?.total_dependents || 0),
        total_members: Number(summary?.total_members || 0),
      },
    });
  } catch (err) {
    console.error("GET /admin/users error:", err);
    return res.status(500).json({ error: "Failed to load members." });
  }
});

router.post("/users", authRequired, requireRole("admin"), async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const first_name = clean(req.body.first_name, 100);
    const last_name = clean(req.body.last_name, 100);
    const full_name = `${first_name} ${last_name}`.trim();
    const email = normEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);

    const address_line1 = nullable(req.body.address_line1, 200);
    const address_line2 = nullable(req.body.address_line2, 200);
    const city = nullable(req.body.city, 100);
    const state = nullable(req.body.state, 80);
    const zip = nullable(req.body.zip, 20);

    const member_type = clean(req.body.member_type || "existing", 20).toLowerCase();
    const status = clean(
      req.body.status || (member_type === "new" ? "pending" : "active"),
      50
    );
    const membership_status = clean(
      req.body.membership_status || (member_type === "new" ? "pending" : "active"),
      50
    );
    const is_active = toBool01(req.body.is_active, 1);

    const create_login_account =
      req.body.create_login_account === true ||
      req.body.create_login_account === "1" ||
      req.body.create_login_account === 1;

    const auto_generate_password =
      req.body.auto_generate_password === true ||
      req.body.auto_generate_password === "1" ||
      req.body.auto_generate_password === 1;

    let temp_password = String(req.body.temp_password || "");

    if (!first_name || !last_name || !email) {
      return res.status(400).json({
        error: "First name, last name, and email are required.",
      });
    }

    if (!["existing", "new"].includes(member_type)) {
      return res.status(400).json({
        error: "Member type must be existing or new.",
      });
    }

    if (create_login_account) {
      if (auto_generate_password && !temp_password) {
        temp_password = randomTempPassword();
      }

      if (!isStrongPassword(temp_password)) {
        return res.status(400).json({
          error:
            "Temporary password must be at least 12 characters and include uppercase, lowercase, number, and special character.",
        });
      }
    }

    await conn.beginTransaction();

    const [dupMembers] = await conn.query(
      `
      SELECT id
      FROM tbl_members
      WHERE LOWER(email) = LOWER(?)
      LIMIT 1
      `,
      [email]
    );

    if (dupMembers.length) {
      await conn.rollback();
      return res.status(409).json({ error: "Member email already exists." });
    }

    const registration_fee_status = member_type === "new" ? "unpaid" : "waived";

    const [memberResult] = await conn.query(
      `
      INSERT INTO tbl_members (
        member_no,
        first_name,
        last_name,
        full_name,
        email,
        phone,
        address_line1,
        address_line2,
        city,
        state,
        zip,
        member_type,
        registration_fee_status,
        registration_paid_at,
        status,
        membership_status,
        is_active,
        open_balance,
        total_paid,
        dependents_count,
        household_member_count,
        last_payment_at,
        next_due_at,
        notes,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 0.00, 0.00, 0, 1, NULL, NULL, NULL, NOW(), NOW())
      `,
      [
        "TEMP",
        first_name,
        last_name,
        full_name,
        email,
        phone,
        address_line1,
        address_line2,
        city,
        state,
        zip,
        member_type,
        registration_fee_status,
        status,
        membership_status,
        is_active,
      ]
    );

    const memberId = memberResult.insertId;
    const memberNo = buildMemberNo(memberId);

    await conn.query(
      `
      UPDATE tbl_members
      SET member_no = ?, updated_at = NOW()
      WHERE id = ?
      `,
      [memberNo, memberId]
    );

    let createdUserId = null;

    if (create_login_account) {
      const username = email;

      const [dupUsers] = await conn.query(
        `
        SELECT id
        FROM tbl_users
        WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)
        LIMIT 1
        `,
        [email, username]
      );

      if (dupUsers.length) {
        await conn.rollback();
        return res.status(409).json({
          error:
            "A login account with this email already exists. Member record was not created.",
        });
      }

      const password_hash = await hashPassword(temp_password);

      const [userResult] = await conn.query(
        `
        INSERT INTO tbl_users (
          member_id,
          username,
          first_name,
          last_name,
          full_name,
          email,
          phone,
          role,
          password_hash,
          is_active,
          must_change_password,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'member', ?, ?, 1, NOW(), NOW())
        `,
        [
          memberId,
          username,
          first_name,
          last_name,
          full_name,
          email,
          phone,
          password_hash,
          is_active,
        ]
      );

      createdUserId = userResult.insertId;

      await safeNotify("sendMemberPortalAccountCreatedEmail", {
        to: email,
        fullName: full_name,
        username,
        tempPassword: temp_password,
        memberNo,
        mustChangePassword: true,
      });
    }

    await conn.commit();

    await safeAudit({
      req,
      actorId: req.user?.id || null,
      action: create_login_account
        ? "admin_member_created_with_login"
        : "admin_member_created",
      entity: "member",
      entityId: memberId,
      meta: {
        email,
        member_type,
        created_user_id: createdUserId,
      },
    });

    return res.status(201).json({
      ok: true,
      member_id: memberId,
      member_no: memberNo,
      user_id: createdUserId,
      temp_password: create_login_account ? temp_password : null,
      must_change_password: create_login_account,
      message: create_login_account
        ? "Member and login account created successfully."
        : "Member created successfully.",
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    console.error("POST /admin/users error:", err);
    return res.status(500).json({ error: "Failed to create member." });
  } finally {
    conn.release();
  }
});

router.delete("/users/:id", authRequired, requireRole("admin"), async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid member id." });
    }

    await conn.beginTransaction();

    await conn.query(`DELETE FROM tbl_users WHERE member_id = ?`, [id]);
    await conn.query(`DELETE FROM tbl_members WHERE id = ?`, [id]);

    await conn.commit();

    await safeAudit({
      req,
      actorId: req.user?.id || null,
      action: "admin_member_deleted",
      entity: "member",
      entityId: id,
      meta: {},
    });

    return res.json({ ok: true, message: "Member deleted successfully." });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    console.error("DELETE /admin/users/:id error:", err);
    return res.status(500).json({ error: "Failed to delete member." });
  } finally {
    conn.release();
  }
});

module.exports = router;