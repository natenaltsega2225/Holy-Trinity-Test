
//backend\routes\adminMemberAccounts.js
"use strict";

const express = require("express");
const argon2 = require("argon2");
const crypto = require("crypto");
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");
const { writeAuditLog } = require("../utils/audit");

const router = express.Router();

function clean(v, max = 255) {
  return String(v ?? "").trim().slice(0, max);
}

function nullable(v, max = 255) {
  const s = clean(v, max);
  return s || null;
}

function toId(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function randomTempPassword(length = 16) {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
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

function cleanRole(role) {
  const r = clean(role, 30).toLowerCase();
  return ["finance", "admin", "reconciliation", "super_admin"].includes(r)
    ? r
    : null;
}

router.get(
  "/members/:memberId/accounts",
  authRequired,
  requireRole("admin"),
  async (req, res) => {
    try {
      const memberId = toId(req.params.memberId);
      if (!memberId) return res.status(400).json({ error: "Invalid member id." });

      const [memberRows] = await pool.query(
        `
        SELECT id, member_no, full_name, email, phone
        FROM tbl_members
        WHERE id = ?
        LIMIT 1
       
        `,
        [memberId]
      );

      if (!memberRows.length) {
        return res.status(404).json({ error: "Member not found." });
      }

      const [accounts] = await pool.query(
        `
        SELECT
          id,
          member_id,
          username,
          email,
          role,
          is_active,
          must_change_password,
          created_at,
          updated_at
        FROM tbl_users
        WHERE member_id = ?
        ORDER BY created_at ASC, id ASC
        `,
        [memberId]
      );

      return res.json({
        ok: true,
        member: memberRows[0],
        accounts,
      });
    } catch (err) {
      console.error("GET /admin/members/:memberId/accounts error:", err);
      return res.status(500).json({ error: "Failed to load linked accounts." });
    }
  }
);

router.post(
  "/members/:memberId/accounts",
  authRequired,
  requireRole("admin"),
  async (req, res) => {
    const conn = await pool.getConnection();

    try {
      const memberId = toId(req.params.memberId);
      if (!memberId) {
        return res.status(400).json({ error: "Invalid member id." });
      }

      const role = cleanRole(req.body.role);
      const username = normEmail(req.body.username);
      const email = normEmail(req.body.email);
      const phone = nullable(req.body.phone, 40);
      const is_active = req.body.is_active === 0 || req.body.is_active === "0" ? 0 : 1;

      let password = String(req.body.password || "");
      const autoGeneratePassword =
        req.body.auto_generate_password === true ||
        req.body.auto_generate_password === "1";

      if (!role) {
        return res.status(400).json({
          error:
            "Only finance, admin, reconciliation, or super_admin accounts can be created here.",
        });
      }

      if (!username || !email) {
        return res.status(400).json({ error: "Username and email are required." });
      }

      if (autoGeneratePassword && !password) {
        password = `${randomTempPassword(14)}!A1`;
      }

      if (!isStrongPassword(password)) {
        return res.status(400).json({
          error:
            "Password must be at least 12 characters and include uppercase, lowercase, number, and special character.",
        });
      }

      const [memberRows] = await conn.query(
        `
        SELECT id, first_name, last_name, full_name, email, phone
        FROM tbl_members
        WHERE id = ?
        LIMIT 1
        
        `,
        [memberId]
      );

      if (!memberRows.length) {
        return res.status(404).json({ error: "Member not found." });
      }

      const member = memberRows[0];

      const [dupRows] = await conn.query(
        `
        SELECT id
        FROM tbl_users
        WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)
        LIMIT 1
        
        `,
        [username, email]
      );

      if (dupRows.length) {
        return res.status(409).json({ error: "Username or email already exists." });
      }

      const password_hash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });

      await conn.beginTransaction();

      const [result] = await conn.query(
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
        `,
        [
          memberId,
          username,
          member.first_name,
          member.last_name,
          member.full_name,
          email,
          phone || member.phone || null,
          role,
          password_hash,
          is_active,
        ]
      );

      await conn.commit();

      await writeAuditLog({
        req,
        actorId: req.user.id,
        action: "linked_account_created",
        entity: "user_account",
        entityId: result.insertId,
        meta: {
          member_id: memberId,
          role,
          username,
          email,
          must_change_password: 1,
        },
      });

      const [rows] = await pool.query(
        `
        SELECT
          id,
          member_id,
          username,
          email,
          role,
          is_active,
          must_change_password,
          created_at
        FROM tbl_users
        WHERE id = ?
        LIMIT 1
        `,
        [result.insertId]
      );

      return res.status(201).json({
        ok: true,
        row: rows[0],
        temp_password: autoGeneratePassword ? password : null,
        must_change_password: true,
        message: "Linked account created successfully.",
      });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      console.error("POST /admin/members/:memberId/accounts error:", err);
      return res.status(500).json({ error: "Failed to create linked account." });
    } finally {
      conn.release();
    }
  }
);

router.patch(
  "/accounts/:userId/status",
  authRequired,
  requireRole("admin"),
  async (req, res) => {
    try {
      const userId = toId(req.params.userId);
      const is_active = req.body.is_active === 0 || req.body.is_active === "0" ? 0 : 1;

      if (!userId) {
        return res.status(400).json({ error: "Invalid user id." });
      }

      const [rows] = await pool.query(
        `
        SELECT id, role
        FROM tbl_users
        WHERE id = ?
        LIMIT 1
        `,
        [userId]
      );

      if (!rows.length) {
        return res.status(404).json({ error: "User account not found." });
      }

      await pool.query(
        `
        UPDATE tbl_users
        SET
          is_active = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [is_active, userId]
      );

      await writeAuditLog({
        req,
        actorId: req.user.id,
        action: is_active ? "linked_account_enabled" : "linked_account_disabled",
        entity: "user_account",
        entityId: userId,
        meta: {
          is_active,
          role: rows[0].role,
        },
      });

      return res.json({
        ok: true,
        message: "Linked account status updated successfully.",
      });
    } catch (err) {
      console.error("PATCH /admin/accounts/:userId/status error:", err);
      return res.status(500).json({ error: "Failed to update account status." });
    }
  }
);

router.patch(
  "/accounts/:userId/role",
  authRequired,
  requireRole("admin"),
  async (req, res) => {
    try {
      const userId = toId(req.params.userId);
      const role = cleanRole(req.body.role);

      if (!userId) {
        return res.status(400).json({ error: "Invalid user id." });
      }

      if (!role) {
        return res.status(400).json({
          error:
            "Only finance, admin, reconciliation, or super_admin role is allowed here.",
        });
      }

      await pool.query(
        `
        UPDATE tbl_users
        SET
          role = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [role, userId]
      );

      await writeAuditLog({
        req,
        actorId: req.user.id,
        action: "linked_account_role_updated",
        entity: "user_account",
        entityId: userId,
        meta: { role },
      });

      return res.json({
        ok: true,
        message: "Linked account role updated successfully.",
      });
    } catch (err) {
      console.error("PATCH /admin/accounts/:userId/role error:", err);
      return res.status(500).json({ error: "Failed to update account role." });
    }
  }
);

router.patch(
  "/accounts/:userId/reset-password",
  authRequired,
  requireRole("admin"),
  async (req, res) => {
    try {
      const userId = toId(req.params.userId);
      if (!userId) {
        return res.status(400).json({ error: "Invalid user id." });
      }

      let password = String(req.body.password || "");
      const autoGeneratePassword =
        req.body.auto_generate_password === true ||
        req.body.auto_generate_password === "1";

      if (autoGeneratePassword && !password) {
        password = `${randomTempPassword(14)}!A1`;
      }

      if (!isStrongPassword(password)) {
        return res.status(400).json({
          error:
            "Password must be at least 12 characters and include uppercase, lowercase, number, and special character.",
        });
      }

      const password_hash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });

      await pool.query(
        `
        UPDATE tbl_users
        SET
          password_hash = ?,
          must_change_password = 1,
          updated_at = NOW()
        WHERE id = ?
        `,
        [password_hash, userId]
      );

      await writeAuditLog({
        req,
        actorId: req.user.id,
        action: "linked_account_password_reset",
        entity: "user_account",
        entityId: userId,
        meta: { must_change_password: 1 },
      });

      return res.json({
        ok: true,
        temp_password: autoGeneratePassword ? password : null,
        must_change_password: true,
        message: "Password reset successfully.",
      });
    } catch (err) {
      console.error("PATCH /admin/accounts/:userId/reset-password error:", err);
      return res.status(500).json({ error: "Failed to reset password." });
    }
  }
);

router.delete(
  "/accounts/:userId",
  authRequired,
  requireRole("admin"),
  async (req, res) => {
    try {
      const userId = toId(req.params.userId);

      if (!userId) {
        return res.status(400).json({ error: "Invalid user id." });
      }

      const [rows] = await pool.query(
        `
        SELECT id, role
        FROM tbl_users
        WHERE id = ?
        LIMIT 1
        `,
        [userId]
      );

      if (!rows.length) {
        return res.status(404).json({ error: "User account not found." });
      }

      await pool.query(`DELETE FROM tbl_users WHERE id = ?`, [userId]);

      await writeAuditLog({
        req,
        actorId: req.user.id,
        action: "linked_account_deleted",
        entity: "user_account",
        entityId: userId,
        meta: { role: rows[0].role },
      });

      return res.json({
        ok: true,
        message: "Linked account deleted successfully.",
      });
    } catch (err) {
      console.error("DELETE /admin/accounts/:userId error:", err);
      return res.status(500).json({ error: "Failed to delete account." });
    }
  }
);

module.exports = router;