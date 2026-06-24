
// //backend\routes\adminMemberAccounts.js
// "use strict";

// const express = require("express");
// const argon2 = require("argon2");
// const crypto = require("crypto");
// const pool = require("../db");
// const { authRequired, requireRole } = require("../middleware/auth");
// const { writeAuditLog } = require("../utils/audit");

// const router = express.Router();

// function clean(v, max = 255) {
//   return String(v ?? "").trim().slice(0, max);
// }

// function nullable(v, max = 255) {
//   const s = clean(v, max);
//   return s || null;
// }

// function toId(v) {
//   const n = Number(v);
//   return Number.isInteger(n) && n > 0 ? n : null;
// }

// function normEmail(v) {
//   return String(v || "").trim().toLowerCase();
// }

// function randomTempPassword(length = 16) {
//   return crypto.randomBytes(length).toString("base64url").slice(0, length);
// }

// function isStrongPassword(password) {
//   const s = String(password || "");
//   if (s.length < 12) return false;
//   if (!/[a-z]/.test(s)) return false;
//   if (!/[A-Z]/.test(s)) return false;
//   if (!/\d/.test(s)) return false;
//   if (!/[^A-Za-z0-9]/.test(s)) return false;
//   return true;
// }

// function cleanRole(role) {
//   const r = clean(role, 30).toLowerCase();
//   return ["finance", "admin", "reconciliation", "super_admin"].includes(r)
//     ? r
//     : null;
// }

// router.get(
//   "/members/:memberId/accounts",
//   authRequired,
//   requireRole("admin"),
//   async (req, res) => {
//     try {
//       const memberId = toId(req.params.memberId);
//       if (!memberId) return res.status(400).json({ error: "Invalid member id." });

//       const [memberRows] = await pool.query(
//         `
//         SELECT id, member_no, full_name, email, phone
//         FROM tbl_members
//         WHERE id = ?
//         LIMIT 1
       
//         `,
//         [memberId]
//       );

//       if (!memberRows.length) {
//         return res.status(404).json({ error: "Member not found." });
//       }

//       const [accounts] = await pool.query(
//         `
//         SELECT
//           id,
//           member_id,
//           username,
//           email,
//           role,
//           is_active,
//           must_change_password,
//           created_at,
//           updated_at
//         FROM tbl_users
//         WHERE member_id = ?
//         ORDER BY created_at ASC, id ASC
//         `,
//         [memberId]
//       );

//       return res.json({
//         ok: true,
//         member: memberRows[0],
//         accounts,
//       });
//     } catch (err) {
//       console.error("GET /admin/members/:memberId/accounts error:", err);
//       return res.status(500).json({ error: "Failed to load linked accounts." });
//     }
//   }
// );

// router.post(
//   "/members/:memberId/accounts",
//   authRequired,
//   requireRole("admin"),
//   async (req, res) => {
//     const conn = await pool.getConnection();

//     try {
//       const memberId = toId(req.params.memberId);
//       if (!memberId) {
//         return res.status(400).json({ error: "Invalid member id." });
//       }

//       const role = cleanRole(req.body.role);
//       const username = normEmail(req.body.username);
//       const email = normEmail(req.body.email);
//       const phone = nullable(req.body.phone, 40);
//       const is_active = req.body.is_active === 0 || req.body.is_active === "0" ? 0 : 1;

//       let password = String(req.body.password || "");
//       const autoGeneratePassword =
//         req.body.auto_generate_password === true ||
//         req.body.auto_generate_password === "1";

//       if (!role) {
//         return res.status(400).json({
//           error:
//             "Only finance, admin, reconciliation, or super_admin accounts can be created here.",
//         });
//       }

//       if (!username || !email) {
//         return res.status(400).json({ error: "Username and email are required." });
//       }

//       if (autoGeneratePassword && !password) {
//         password = `${randomTempPassword(14)}!A1`;
//       }

//       if (!isStrongPassword(password)) {
//         return res.status(400).json({
//           error:
//             "Password must be at least 12 characters and include uppercase, lowercase, number, and special character.",
//         });
//       }

//       const [memberRows] = await conn.query(
//         `
//         SELECT id, first_name, last_name, full_name, email, phone
//         FROM tbl_members
//         WHERE id = ?
//         LIMIT 1
        
//         `,
//         [memberId]
//       );

//       if (!memberRows.length) {
//         return res.status(404).json({ error: "Member not found." });
//       }

//       const member = memberRows[0];

//       const [dupRows] = await conn.query(
//         `
//         SELECT id
//         FROM tbl_users
//         WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)
//         LIMIT 1
        
//         `,
//         [username, email]
//       );

//       if (dupRows.length) {
//         return res.status(409).json({ error: "Username or email already exists." });
//       }

//       const password_hash = await argon2.hash(password, {
//         type: argon2.argon2id,
//         memoryCost: 19456,
//         timeCost: 2,
//         parallelism: 1,
//       });

//       await conn.beginTransaction();

//       const [result] = await conn.query(
//         `
//         INSERT INTO tbl_users (
//           member_id,
//           username,
//           first_name,
//           last_name,
//           full_name,
//           email,
//           phone,
//           role,
//           password_hash,
//           is_active,
//           must_change_password,
//           created_at,
//           updated_at
//         )
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
//         `,
//         [
//           memberId,
//           username,
//           member.first_name,
//           member.last_name,
//           member.full_name,
//           email,
//           phone || member.phone || null,
//           role,
//           password_hash,
//           is_active,
//         ]
//       );

//       await conn.commit();

//       await writeAuditLog({
//         req,
//         actorId: req.user.id,
//         action: "linked_account_created",
//         entity: "user_account",
//         entityId: result.insertId,
//         meta: {
//           member_id: memberId,
//           role,
//           username,
//           email,
//           must_change_password: 1,
//         },
//       });

//       const [rows] = await pool.query(
//         `
//         SELECT
//           id,
//           member_id,
//           username,
//           email,
//           role,
//           is_active,
//           must_change_password,
//           created_at
//         FROM tbl_users
//         WHERE id = ?
//         LIMIT 1
//         `,
//         [result.insertId]
//       );

//       return res.status(201).json({
//         ok: true,
//         row: rows[0],
//         temp_password: autoGeneratePassword ? password : null,
//         must_change_password: true,
//         message: "Linked account created successfully.",
//       });
//     } catch (err) {
//       try {
//         await conn.rollback();
//       } catch {}
//       console.error("POST /admin/members/:memberId/accounts error:", err);
//       return res.status(500).json({ error: "Failed to create linked account." });
//     } finally {
//       conn.release();
//     }
//   }
// );

// router.patch(
//   "/accounts/:userId/status",
//   authRequired,
//   requireRole("admin"),
//   async (req, res) => {
//     try {
//       const userId = toId(req.params.userId);
//       const is_active = req.body.is_active === 0 || req.body.is_active === "0" ? 0 : 1;

//       if (!userId) {
//         return res.status(400).json({ error: "Invalid user id." });
//       }

//       const [rows] = await pool.query(
//         `
//         SELECT id, role
//         FROM tbl_users
//         WHERE id = ?
//         LIMIT 1
//         `,
//         [userId]
//       );

//       if (!rows.length) {
//         return res.status(404).json({ error: "User account not found." });
//       }

//       await pool.query(
//         `
//         UPDATE tbl_users
//         SET
//           is_active = ?,
//           updated_at = NOW()
//         WHERE id = ?
//         `,
//         [is_active, userId]
//       );

//       await writeAuditLog({
//         req,
//         actorId: req.user.id,
//         action: is_active ? "linked_account_enabled" : "linked_account_disabled",
//         entity: "user_account",
//         entityId: userId,
//         meta: {
//           is_active,
//           role: rows[0].role,
//         },
//       });

//       return res.json({
//         ok: true,
//         message: "Linked account status updated successfully.",
//       });
//     } catch (err) {
//       console.error("PATCH /admin/accounts/:userId/status error:", err);
//       return res.status(500).json({ error: "Failed to update account status." });
//     }
//   }
// );

// router.patch(
//   "/accounts/:userId/role",
//   authRequired,
//   requireRole("admin"),
//   async (req, res) => {
//     try {
//       const userId = toId(req.params.userId);
//       const role = cleanRole(req.body.role);

//       if (!userId) {
//         return res.status(400).json({ error: "Invalid user id." });
//       }

//       if (!role) {
//         return res.status(400).json({
//           error:
//             "Only finance, admin, reconciliation, or super_admin role is allowed here.",
//         });
//       }

//       await pool.query(
//         `
//         UPDATE tbl_users
//         SET
//           role = ?,
//           updated_at = NOW()
//         WHERE id = ?
//         `,
//         [role, userId]
//       );

//       await writeAuditLog({
//         req,
//         actorId: req.user.id,
//         action: "linked_account_role_updated",
//         entity: "user_account",
//         entityId: userId,
//         meta: { role },
//       });

//       return res.json({
//         ok: true,
//         message: "Linked account role updated successfully.",
//       });
//     } catch (err) {
//       console.error("PATCH /admin/accounts/:userId/role error:", err);
//       return res.status(500).json({ error: "Failed to update account role." });
//     }
//   }
// );

// router.patch(
//   "/accounts/:userId/reset-password",
//   authRequired,
//   requireRole("admin"),
//   async (req, res) => {
//     try {
//       const userId = toId(req.params.userId);
//       if (!userId) {
//         return res.status(400).json({ error: "Invalid user id." });
//       }

//       let password = String(req.body.password || "");
//       const autoGeneratePassword =
//         req.body.auto_generate_password === true ||
//         req.body.auto_generate_password === "1";

//       if (autoGeneratePassword && !password) {
//         password = `${randomTempPassword(14)}!A1`;
//       }

//       if (!isStrongPassword(password)) {
//         return res.status(400).json({
//           error:
//             "Password must be at least 12 characters and include uppercase, lowercase, number, and special character.",
//         });
//       }

//       const password_hash = await argon2.hash(password, {
//         type: argon2.argon2id,
//         memoryCost: 19456,
//         timeCost: 2,
//         parallelism: 1,
//       });

//       await pool.query(
//         `
//         UPDATE tbl_users
//         SET
//           password_hash = ?,
//           must_change_password = 1,
//           updated_at = NOW()
//         WHERE id = ?
//         `,
//         [password_hash, userId]
//       );

//       await writeAuditLog({
//         req,
//         actorId: req.user.id,
//         action: "linked_account_password_reset",
//         entity: "user_account",
//         entityId: userId,
//         meta: { must_change_password: 1 },
//       });

//       return res.json({
//         ok: true,
//         temp_password: autoGeneratePassword ? password : null,
//         must_change_password: true,
//         message: "Password reset successfully.",
//       });
//     } catch (err) {
//       console.error("PATCH /admin/accounts/:userId/reset-password error:", err);
//       return res.status(500).json({ error: "Failed to reset password." });
//     }
//   }
// );

// router.delete(
//   "/accounts/:userId",
//   authRequired,
//   requireRole("admin"),
//   async (req, res) => {
//     try {
//       const userId = toId(req.params.userId);

//       if (!userId) {
//         return res.status(400).json({ error: "Invalid user id." });
//       }

//       const [rows] = await pool.query(
//         `
//         SELECT id, role
//         FROM tbl_users
//         WHERE id = ?
//         LIMIT 1
//         `,
//         [userId]
//       );

//       if (!rows.length) {
//         return res.status(404).json({ error: "User account not found." });
//       }

//       await pool.query(`DELETE FROM tbl_users WHERE id = ?`, [userId]);

//       await writeAuditLog({
//         req,
//         actorId: req.user.id,
//         action: "linked_account_deleted",
//         entity: "user_account",
//         entityId: userId,
//         meta: { role: rows[0].role },
//       });

//       return res.json({
//         ok: true,
//         message: "Linked account deleted successfully.",
//       });
//     } catch (err) {
//       console.error("DELETE /admin/accounts/:userId error:", err);
//       return res.status(500).json({ error: "Failed to delete account." });
//     }
//   }
// );

// module.exports = router;

// backend/routes/adminAccessUsers.js

"use strict";

const express = require("express");
const rateLimit =
  require("express-rate-limit");
const pool = require("../db");
const {
  authRequired,
  requireRole,
  requireMfaForSensitiveRoles,
} = require("../middleware/auth");
const auditService = require(
  "../services/domains/security/auditService"
);

const authService = require(
  "../services/domains/security/authService"
);

const mfaService = require(
  "../services/domains/security/mfaService"
);

const router = express.Router();
const securityLimiter =
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

router.use(securityLimiter);
const VALID_ROLES = Object.freeze([
  "member",
  "finance",
  "membership",
  "reconciliation",
  "it_admin",
  "admin",
  "super_admin",
]);

const ROLE_ORDER = `
  CASE
    WHEN u.role = 'super_admin' THEN 1
    WHEN u.role = 'admin' THEN 2
    WHEN u.role = 'it_admin' THEN 3
    WHEN u.role = 'finance' THEN 4
    WHEN u.role = 'membership' THEN 5
    WHEN u.role = 'reconciliation' THEN 6
    WHEN u.role = 'member' THEN 7
    ELSE 8
  END
`;

function clean(value, max = 255) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

function toInt(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function cleanRoleFilter(value) {
  const role = clean(value, 50).toLowerCase();

  return VALID_ROLES.includes(role)
    ? role
    : "";
}

function requireSecurityAdmin(req, res, next) {
  const role = String(req.user?.role || "").toLowerCase();

  if (
    [
      "super_admin",
      "admin",
      "it_admin",
    ].includes(role)
  ) {
    return next();
  }

  return res.status(403).json({
    ok: false,
    error: "Security administrator access required.",
  });
}

function isSuperAdmin(req) {
  return String(req.user?.role || "").toLowerCase() === "super_admin";
}

function ensureCanManageTarget(req, targetUser) {
  const actorRole = String(req.user?.role || "").toLowerCase();
  const targetRole = String(targetUser?.role || "").toLowerCase();

  if (actorRole === "super_admin") {
    return;
  }

  if (targetRole === "super_admin") {
    const err = new Error("Only super admin can manage super admin accounts.");
    err.status = 403;
    throw err;
  }

  if (
    actorRole === "it_admin" &&
    ["admin", "super_admin"].includes(targetRole)
  ) {
    const err = new Error("IT admin cannot manage admin or super admin accounts.");
    err.status = 403;
    throw err;
  }
}

function clientMeta(req) {
  return {
    ip:
      req.ip ||
      req.headers?.["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      null,

    user_agent:
      req.headers?.["user-agent"] || null,
  };
}

async function getUserById(id) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      member_id,
      username,
      email,
      full_name,
      role,
      is_active,
      account_status,
      must_change_password,
      password_reset_required,
      mfa_enabled,
      failed_login_attempts,
      account_locked_until
    FROM tbl_users
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

async function ensureUserSecurityColumns() {
  const requiredColumns = [
    {
      name: "mfa_enabled",
      ddl:
        "ALTER TABLE tbl_users ADD COLUMN mfa_enabled TINYINT(1) NOT NULL DEFAULT 0",
    },
    {
      name: "mfa_secret",
      ddl:
        "ALTER TABLE tbl_users ADD COLUMN mfa_secret VARCHAR(255) NULL",
    },
    {
      name: "last_login_at",
      ddl:
        "ALTER TABLE tbl_users ADD COLUMN last_login_at DATETIME NULL",
    },
    {
      name: "last_login_ip",
      ddl:
        "ALTER TABLE tbl_users ADD COLUMN last_login_ip VARCHAR(100) NULL",
    },
    {
      name: "failed_login_attempts",
      ddl:
        "ALTER TABLE tbl_users ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0",
    },
    {
      name: "account_locked_until",
      ddl:
        "ALTER TABLE tbl_users ADD COLUMN account_locked_until DATETIME NULL",
    },
    {
      name: "password_changed_at",
      ddl:
        "ALTER TABLE tbl_users ADD COLUMN password_changed_at DATETIME NULL",
    },
  ];

  const [columns] = await pool.query(
    `
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tbl_users'
    `
  );

  const existing = new Set(
    columns.map((row) => row.COLUMN_NAME)
  );

  for (const column of requiredColumns) {
    if (!existing.has(column.name)) {
      await pool.query(column.ddl);
    }
  }
}

/*
====================================================
GET ACCESS USERS
====================================================
*/
router.get(
  "/",
  authRequired,
  requireSecurityAdmin,
  async (req, res) => {
    try {
      await ensureUserSecurityColumns();

      res.set({
        "Cache-Control":
          "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
        Expires: "0",
      });

      const search = clean(
        req.query.search || req.query.q || "",
        190
      );

      const role = cleanRoleFilter(
        req.query.role || ""
      );

      const status = clean(
        req.query.status || "",
        40
      ).toLowerCase();

      const mfa = clean(
        req.query.mfa || "",
        20
      ).toLowerCase();

      const page = Math.max(
        1,
        toInt(req.query.page || "1", 1)
      );

      const pageSize = Math.min(
        200,
        Math.max(
          1,
          toInt(
            req.query.pageSize ||
              req.query.limit ||
              "10",
            10
          )
        )
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
            OR COALESCE(u.phone, '') LIKE ?
          )
        `);

        const like = `%${search}%`;
        params.push(
          like,
          like,
          like,
          like,
          like,
          like,
          like
        );
      }

      if (role) {
        where.push(
          `LOWER(COALESCE(u.role, '')) = ?`
        );
        params.push(role);
      }

      if (status === "active") {
        where.push(
          `u.is_active = 1 AND COALESCE(u.account_status, 'active') = 'active'`
        );
      }

      if (status === "disabled") {
        where.push(
          `(u.is_active = 0 OR COALESCE(u.account_status, '') = 'disabled')`
        );
      }

      if (status === "locked") {
        where.push(
          `u.account_locked_until IS NOT NULL AND u.account_locked_until > NOW()`
        );
      }

      if (mfa === "enabled") {
        where.push(`u.mfa_enabled = 1`);
      }

      if (mfa === "disabled") {
        where.push(`u.mfa_enabled = 0`);
      }

      const whereSql = where.length
        ? `WHERE ${where.join(" AND ")}`
        : "";

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
          u.account_status,
          u.must_change_password,
          u.password_reset_required,
          u.mfa_enabled,
          u.last_login_at,
          u.last_login_ip,
          u.failed_login_attempts,
          u.account_locked_until,
          u.password_changed_at,
          u.created_at,
          u.updated_at,

          m.member_no,

          COALESCE(
            m.full_name,
            u.full_name,
            TRIM(
              CONCAT(
                COALESCE(u.first_name, ''),
                ' ',
                COALESCE(u.last_name, '')
              )
            )
          ) AS member_full_name,

          CASE
            WHEN u.account_locked_until IS NOT NULL
             AND u.account_locked_until > NOW()
              THEN 'locked'
            WHEN u.is_active = 0
              THEN 'disabled'
            ELSE COALESCE(u.account_status, 'active')
          END AS effective_account_status

        FROM tbl_users u
        LEFT JOIN tbl_members m
          ON m.id = u.member_id
        ${whereSql}
        ORDER BY
          ${ROLE_ORDER},
          u.created_at DESC,
          u.id DESC
        LIMIT ? OFFSET ?
        `,
        [
          ...params,
          pageSize,
          offset,
        ]
      );

      const [[summary]] = await pool.query(
        `
        SELECT
          SUM(CASE WHEN LOWER(COALESCE(u.role, '')) = 'member' THEN 1 ELSE 0 END) AS member_count,
          SUM(CASE WHEN LOWER(COALESCE(u.role, '')) = 'finance' THEN 1 ELSE 0 END) AS finance_count,
          SUM(CASE WHEN LOWER(COALESCE(u.role, '')) = 'membership' THEN 1 ELSE 0 END) AS membership_count,
          SUM(CASE WHEN LOWER(COALESCE(u.role, '')) = 'reconciliation' THEN 1 ELSE 0 END) AS reconciliation_count,
          SUM(CASE WHEN LOWER(COALESCE(u.role, '')) = 'it_admin' THEN 1 ELSE 0 END) AS it_admin_count,
          SUM(CASE WHEN LOWER(COALESCE(u.role, '')) = 'admin' THEN 1 ELSE 0 END) AS admin_count,
          SUM(CASE WHEN LOWER(COALESCE(u.role, '')) = 'super_admin' THEN 1 ELSE 0 END) AS super_admin_count,
          SUM(CASE WHEN u.is_active = 1 THEN 1 ELSE 0 END) AS active_count,
          SUM(CASE WHEN u.is_active = 0 THEN 1 ELSE 0 END) AS disabled_count,
          SUM(CASE WHEN u.mfa_enabled = 1 THEN 1 ELSE 0 END) AS mfa_enabled_count,
          SUM(CASE WHEN u.account_locked_until IS NOT NULL AND u.account_locked_until > NOW() THEN 1 ELSE 0 END) AS locked_count,
          COUNT(*) AS total_count
        FROM tbl_users u
        `
      );

      return res.json({
        ok: true,
        rows,
        total: Number(total || 0),
        page,
        pageSize,
        totalPages: Math.max(
          1,
          Math.ceil(Number(total || 0) / pageSize)
        ),
        summary: {
          member: Number(summary?.member_count || 0),
          finance: Number(summary?.finance_count || 0),
          membership: Number(summary?.membership_count || 0),
          reconciliation: Number(summary?.reconciliation_count || 0),
          it_admin: Number(summary?.it_admin_count || 0),
          admin: Number(summary?.admin_count || 0),
          super_admin: Number(summary?.super_admin_count || 0),
          active: Number(summary?.active_count || 0),
          disabled: Number(summary?.disabled_count || 0),
          locked: Number(summary?.locked_count || 0),
          mfa_enabled: Number(summary?.mfa_enabled_count || 0),
          all: Number(summary?.total_count || 0),
        },
      });
    } catch (err) {
      console.error(
        "GET /admin/access-users error:",
        err
      );

      return res.status(500).json({
        ok: false,
        error: "Failed to load access users.",
      });
    }
  }
);

/*
====================================================
UPDATE USER ROLE
====================================================
*/
router.patch(
  "/:id/role",
  authRequired,
  requireSecurityAdmin,
  requireMfaForSensitiveRoles,
  async (req, res) => {
    try {
      const userId = toInt(req.params.id);
      const nextRole = cleanRoleFilter(req.body.role);

      if (!nextRole) {
        return res.status(400).json({
          ok: false,
          error: "Invalid role.",
        });
      }

      const target = await getUserById(userId);

      if (!target) {
        return res.status(404).json({
          ok: false,
          error: "User not found.",
        });
      }
if (req.user.id === userId) {
  return res.status(403).json({
    ok: false,
    error: "Users cannot change their own role."
  });
}
      ensureCanManageTarget(req, target);

      if (
        nextRole === "super_admin" &&
        !isSuperAdmin(req)
      ) {
        return res.status(403).json({
          ok: false,
          error:
            "Only super admin can assign super admin role.",
        });
      }
if (
  target.role === "super_admin" &&
  nextRole !== "super_admin"
) {
  const [[result]] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM tbl_users
    WHERE role='super_admin'
      AND is_active=1
  `);

  if (Number(result.total) <= 1) {
    return res.status(400).json({
      ok: false,
      error:
        "Cannot remove the last active super admin."
    });
  }
}
      await pool.query(
        `
        UPDATE tbl_users
        SET role = ?, updated_at = NOW()
        WHERE id = ?
        `,
        [nextRole, userId]
      );

      await auditService.logSecurityEvent({
        req,
        actorUserId: req.user.id,
        targetUserId: userId,
        action: "ROLE_CHANGED",
        entityType: "user",
        entityId: userId,
        oldValue: { role: target.role },
        newValue: { role: nextRole },
      });

      return res.json({
        ok: true,
        message: "User role updated successfully.",
      });
    } catch (err) {
      console.error(
        "PATCH /admin/access-users/:id/role error:",
        err
      );

      return res.status(err.status || 500).json({
        ok: false,
        error:
          err.message ||
          "Failed to update user role.",
      });
    }
  }
);

/*
====================================================
ACTIVATE / DEACTIVATE USER
====================================================
*/
router.patch(
  "/:id/status",
  authRequired,
  requireSecurityAdmin,
  async (req, res) => {
    try {
      const userId = toInt(req.params.id);
      const active =
        req.body.is_active !== undefined
          ? Number(req.body.is_active) === 1
          : Boolean(req.body.active);

      const target = await getUserById(userId);if (req.user.id === userId) {
  return res.status(403).json({
    ok: false,
    error:
      "You cannot disable your own account."
  });
}
      if (!target) {
        return res.status(404).json({
          ok: false,
          error: "User not found.",
        });
      }

      ensureCanManageTarget(req, target);

      if (
        target.role === "super_admin" &&
        !active
      ) {
        return res.status(403).json({
          ok: false,
          error:
            "Super admin accounts cannot be disabled here.",
        });
      }
if (
  target.role === "super_admin" &&
  !active
) {
  const [[result]] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM tbl_users
    WHERE role='super_admin'
      AND is_active=1
  `);

  if (Number(result.total) <= 1) {
    return res.status(400).json({
      ok: false,
      error:
        "Cannot disable the last active super admin."
    });
  }
}
      await pool.query(
        `
        UPDATE tbl_users
        SET
          is_active = ?,
          account_status = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          active ? 1 : 0,
          active ? "active" : "disabled",
          userId,
        ]
      );

      await auditService.logSecurityEvent({
        req,
        actorUserId: req.user.id,
        targetUserId: userId,
        action: active
          ? "ACCOUNT_ACTIVATED"
          : "ACCOUNT_DEACTIVATED",
        entityType: "user",
        entityId: userId,
        oldValue: {
          is_active: target.is_active,
          account_status:
            target.account_status,
        },
        newValue: {
          is_active: active ? 1 : 0,
          account_status: active
            ? "active"
            : "disabled",
        },
      });

      return res.json({
        ok: true,
        message: active
          ? "Account activated successfully."
          : "Account deactivated successfully.",
      });
    } catch (err) {
      console.error(
        "PATCH /admin/access-users/:id/status error:",
        err
      );

      return res.status(err.status || 500).json({
        ok: false,
        error:
          err.message ||
          "Failed to update account status.",
      });
    }
  }
);

/*
====================================================
UNLOCK USER ACCOUNT
====================================================
*/
router.patch(
  "/:id/unlock",
  authRequired,
  requireSecurityAdmin,
  async (req, res) => {
    try {
      const userId = toInt(req.params.id);

      const target = await getUserById(userId);

      if (!target) {
        return res.status(404).json({
          ok: false,
          error: "User not found.",
        });
      }

      ensureCanManageTarget(req, target);

      await authService.unlockAccount({
        userId,
        req,
      });

      return res.json({
        ok: true,
        message: "Account unlocked successfully.",
      });
    } catch (err) {
      console.error(
        "PATCH /admin/access-users/:id/unlock error:",
        err
      );

      return res.status(err.status || 500).json({
        ok: false,
        error:
          err.message ||
          "Failed to unlock account.",
      });
    }
  }
);

/*
====================================================
FORCE PASSWORD RESET
====================================================
*/
router.patch(
  "/:id/force-password-reset",
  authRequired,
  requireSecurityAdmin,
  async (req, res) => {
    try {
      const userId = toInt(req.params.id);

      const target = await getUserById(userId);

      if (!target) {
        return res.status(404).json({
          ok: false,
          error: "User not found.",
        });
      }

      ensureCanManageTarget(req, target);

      await authService.forcePasswordReset({
        userId,
        req,
      });

      return res.json({
        ok: true,
        message:
          "Password reset requirement enabled.",
      });
    } catch (err) {
      console.error(
        "PATCH /admin/access-users/:id/force-password-reset error:",
        err
      );

      return res.status(err.status || 500).json({
        ok: false,
        error:
          err.message ||
          "Failed to force password reset.",
      });
    }
  }
);

/*
====================================================
ENABLE MFA SETUP
====================================================
*/
router.post(
  "/:id/mfa/setup",
  authRequired,
  requireSecurityAdmin,
  async (req, res) => {
    try {
      const userId = toInt(req.params.id);

      const target = await getUserById(userId);

      if (!target) {
        return res.status(404).json({
          ok: false,
          error: "User not found.",
        });
      }

      ensureCanManageTarget(req, target);

      const setup =
        await mfaService.createMfaSetup(userId);

      await auditService.logSecurityEvent({
        req,
        actorUserId: req.user.id,
        targetUserId: userId,
        action: "MFA_SETUP_CREATED",
        entityType: "user",
        entityId: userId,
      });

      return res.json({
        ok: true,
        message: "MFA setup created.",
        ...setup,
      });
    } catch (err) {
      console.error(
        "POST /admin/access-users/:id/mfa/setup error:",
        err
      );

      return res.status(err.status || 500).json({
        ok: false,
        error:
          err.message ||
          "Failed to create MFA setup.",
      });
    }
  }
);

/*
====================================================
DISABLE MFA
====================================================
*/
router.patch(
  "/:id/mfa/disable",
  authRequired,
  requireSecurityAdmin,
  async (req, res) => {
    try {
      const userId = toInt(req.params.id);

      const target = await getUserById(userId);

      if (!target) {
        return res.status(404).json({
          ok: false,
          error: "User not found.",
        });
      }

      ensureCanManageTarget(req, target);

      await mfaService.disableMfa({
        userId,
        req,
      });

      return res.json({
        ok: true,
        message: "MFA disabled successfully.",
      });
    } catch (err) {
      console.error(
        "PATCH /admin/access-users/:id/mfa/disable error:",
        err
      );

      return res.status(err.status || 500).json({
        ok: false,
        error:
          err.message ||
          "Failed to disable MFA.",
      });
    }
  }
);

router.get(
  "/security-summary",
  authRequired,
  requireRole("admin"),
  async (req, res) => {
    try {
      const [[summary]] = await pool.query(`
        SELECT
          COUNT(*) AS total_users,

          SUM(
            CASE
              WHEN is_active = 1 THEN 1
              ELSE 0
            END
          ) AS active_users,

          SUM(
            CASE
              WHEN is_active = 0 THEN 1
              ELSE 0
            END
          ) AS disabled_users,

          SUM(
            CASE
              WHEN must_change_password = 1 THEN 1
              ELSE 0
            END
          ) AS locked_users,

          SUM(
            CASE
              WHEN role IN ('admin','super_admin')
              THEN 1
              ELSE 0
            END
          ) AS privileged_accounts,

          SUM(
            CASE
              WHEN mfa_enabled = 1
              THEN 1
              ELSE 0
            END
          ) AS mfa_enabled_users,

          SUM(
            CASE
              WHEN role='admin'
              THEN 1
              ELSE 0
            END
          ) AS admin_count,

          SUM(
            CASE
              WHEN role='super_admin'
              THEN 1
              ELSE 0
            END
          ) AS super_admin_count
        FROM tbl_users
      `);

      return res.json({
        success: true,
        summary: {
          total_users: Number(summary.total_users || 0),
          active_users: Number(summary.active_users || 0),
          disabled_users: Number(summary.disabled_users || 0),
          locked_users: Number(summary.locked_users || 0),
          privileged_accounts: Number(summary.privileged_accounts || 0),
          mfa_enabled_users: Number(summary.mfa_enabled_users || 0),
          admin_count: Number(summary.admin_count || 0),
          super_admin_count: Number(summary.super_admin_count || 0),
          it_admin_count: 0,
        },
      });
    } catch (err) {
      console.error(
        "GET /admin/access-users/security-summary",
        err
      );

      return res.status(500).json({
        error: "Failed to load security summary.",
      });
    }
  }
);

/*
====================================================
AUDIT HISTORY
====================================================
*/
router.get(
  "/:id/audit",
  authRequired,
  requireSecurityAdmin,
  async (req, res) => {
    try {
      const userId = toInt(req.params.id);

      const target = await getUserById(userId);

      if (!target) {
        return res.status(404).json({
          ok: false,
          error: "User not found.",
        });
      }

      ensureCanManageTarget(req, target);

      const rows =
        await auditService.listSecurityEvents({
          userId,
          limit: toInt(req.query.limit, 100),
          offset: toInt(req.query.offset, 0),
        });

      return res.json({
        ok: true,
        rows,
      });
    } catch (err) {
      console.error(
        "GET /admin/access-users/:id/audit error:",
        err
      );

      return res.status(err.status || 500).json({
        ok: false,
        error:
          err.message ||
          "Failed to load audit history.",
      });
    }
  }
);



module.exports = router;
