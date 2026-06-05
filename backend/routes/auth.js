

 // //backend\routes\auth.js


"use strict";

const express = require("express");
const crypto = require("crypto");
const argon2 = require("argon2");
const pool = require("../db");
const { sendPasswordResetEmail } = require("../services/emailService");
const {
  issueTokens,
  refreshRequired,
  revokeRefreshTokenById,
  cookieOptions,
} = require("../middleware/auth");

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* Optional notifications + audit                                              */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

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

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
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

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function buildMemberNo(memberId) {
  return `M-${String(memberId).padStart(5, "0")}`;
}

function safeUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    member_id: row.member_id ?? null,
    username: row.username ?? null,
    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,
    full_name:
      row.full_name || `${row.first_name || ""} ${row.last_name || ""}`.trim(),
    email: row.email ?? null,
    phone: row.phone ?? null,
    role: row.role,
    is_active: Number(row.is_active ?? 1),
    must_change_password: Number(row.must_change_password ?? 0),
    member_no: row.member_no ?? null,
    membership_status: row.membership_status ?? null,
    status: row.status ?? null,
    registration_fee_status: row.registration_fee_status ?? null,
    next_due_at: row.next_due_at ?? null,
    last_payment_at: row.last_payment_at ?? null,
  };
}

async function hashPassword(password) {
  return argon2.hash(String(password), {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

async function loadUserByIdentifier(identifierRaw) {
  const identifier = clean(identifierRaw, 190).toLowerCase();

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
      u.password_hash,
      u.is_active,
      u.must_change_password,

      m.member_no,
      m.membership_status,
      m.status,
      m.registration_fee_status,
      m.next_due_at,
      m.last_payment_at

    FROM tbl_users u

    LEFT JOIN tbl_members m
      ON m.id = u.member_id

    WHERE LOWER(u.email) = ?
       OR LOWER(u.username) = ?
       OR LOWER(m.member_no) = ?

    LIMIT 1
    `,
    [identifier, identifier, identifier]
  );

  return rows[0] || null;
}
async function tryAttachMemberIfMissing(user) {
  if (!user) return user;
  if (user.member_id) return user;
  if (String(user.role || "").toLowerCase() !== "member") return user;
  if (!user.email) return user;

  const [[member]] = await pool.query(
    `
    SELECT
      id,
      member_no,
      membership_status,
      status,
      registration_fee_status,
      next_due_at,
      last_payment_at
    FROM tbl_members
    WHERE LOWER(email) = ?
    LIMIT 1
    `,
    [normEmail(user.email)]
  );

  if (!member) return user;

  await pool.query(
    `
    UPDATE tbl_users
    SET member_id = ?, updated_at = NOW()
    WHERE id = ? AND (member_id IS NULL OR member_id = 0)
    `,
    [member.id, user.id]
  );

  return {
    ...user,
    member_id: member.id,
    member_no: member.member_no,
    membership_status: member.membership_status,
    status: member.status,
    registration_fee_status: member.registration_fee_status,
    next_due_at: member.next_due_at,
    last_payment_at: member.last_payment_at,
  };
}

/* -------------------------------------------------------------------------- */
/* Register                                                                   */
/* -------------------------------------------------------------------------- */

router.post("/register", async (req, res) => {
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

    const password = String(req.body.password || "");
    const confirm_password = String(
      req.body.confirm_password || req.body.confirmPassword || ""
    );

    const member_type = clean(req.body.member_type || "existing", 20).toLowerCase();

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error:
          "Password must be at least 12 characters and include uppercase, lowercase, number, and special character.",
      });
    }

    if (confirm_password && password !== confirm_password) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    if (!["existing", "new"].includes(member_type)) {
      return res.status(400).json({
        error: "Member type must be existing or new.",
      });
    }

    const username = email;

    const [dupUsers] = await conn.query(
      `
      SELECT id
      FROM tbl_users
      WHERE LOWER(email) = ? OR LOWER(username) = ?
      LIMIT 1
      `,
      [email, username]
    );

    if (dupUsers.length) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const [dupMembers] = await conn.query(
      `
      SELECT id
      FROM tbl_members
      WHERE LOWER(email) = ?
      LIMIT 1
      `,
      [email]
    );

    if (dupMembers.length) {
      return res.status(409).json({
        error: "A member with this email already exists.",
      });
    }

    const password_hash = await hashPassword(password);

    const memberStatus = member_type === "existing" ? "active" : "pending";
    const membershipStatus = member_type === "existing" ? "active" : "pending";
    const registrationFeeStatus = member_type === "existing" ? "waived" : "unpaid";
    const memberIsActive = 1;
    const userIsActive = 1;

    await conn.beginTransaction();

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
        last_payment_at,
        next_due_at,
        notes,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 0.00, 0.00, NULL, NULL, NULL, NOW(), NOW())
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
        registrationFeeStatus,
        memberStatus,
        membershipStatus,
        memberIsActive,
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
      VALUES (?, ?, ?, ?, ?, ?, ?, 'member', ?, ?, 0, NOW(), NOW())
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
        userIsActive,
      ]
    );

    const userId = userResult.insertId;

    await conn.commit();

    await safeAudit({
      req,
      actorId: userId,
      action:
        member_type === "existing"
          ? "member_register_existing"
          : "member_register_new",
      entity: "member",
      entityId: memberId,
      meta: {
        email,
        member_type,
        registration_fee_status: registrationFeeStatus,
      },
    });

    await safeNotify("sendRegistrationWelcomeEmail", {
      to: email,
      memberId,
      memberNo,
      fullName: full_name,
      memberType: member_type,
      status: memberStatus,
      membershipStatus,
      registrationFeeStatus,
    });

    // IMPORTANT FIX:
    // Issue auth tokens for BOTH existing and new registrations so the new user
    // can continue to membership plan selection and Stripe checkout without 401.
    const authUser = {
      id: userId,
      member_id: memberId,
      username,
      first_name,
      last_name,
      full_name,
      email,
      phone,
      role: "member",
      is_active: 1,
      must_change_password: 0,
      member_no: memberNo,
      membership_status: membershipStatus,
      status: memberStatus,
      registration_fee_status: registrationFeeStatus,
      next_due_at: null,
      last_payment_at: null,
    };

    const { accessToken } = await issueTokens(res, authUser);

    if (member_type === "existing") {
      return res.status(201).json({
        ok: true,
        token: accessToken,
        user: safeUser(authUser),
      });
    }

    return res.status(201).json({
      ok: true,
      requires_plan_selection: true,
      token: accessToken,
      user: safeUser(authUser),
      member_id: memberId,
      user_id: userId,
      member_no: memberNo,
      member_type: "new",
      registration_fee_status: "unpaid",
      membership_status: "pending",
      message: "Registration initialized. Continue to plan selection.",
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}

    console.error("register error:", err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Email already exists." });
    }

    return res.status(500).json({ error: "Server error" });
  } finally {
    conn.release();
  }
});

/*login -------------------------------------------------------------------------- */

router.post("/login", async (req, res) => {

  try {

    const identifier = clean(
      req.body.identifier ||
      req.body.email ||
      req.body.username,
      190
    );

    const password =
      String(
        req.body.password || ""
      );

    if (
      !identifier ||
      !password
    ) {

      return res.status(400).json({
        error:
          "Email/username and password are required.",
      });
    }

    let user =
      await loadUserByIdentifier(
        identifier
      );

    if (!user) {

      return res.status(401).json({
        error:
          "Incorrect email/username or password.",
      });
    }

    /* =====================================================
       VERIFY PASSWORD
    ===================================================== */

    let valid = false;

    try {

      valid =
        await argon2.verify(
          user.password_hash,
          password
        );

    } catch {

      valid = false;
    }

    if (!valid) {

      return res.status(401).json({
        error:
          "Incorrect email/username or password.",
      });
    }

    /* =====================================================
       ATTACH MEMBER
    ===================================================== */

    user =
      await tryAttachMemberIfMissing(
        user
      );

    /* =====================================================
       ACCOUNT ACTIVE
    ===================================================== */

    if (
      Number(user.is_active) !== 1
    ) {

      return res.status(403).json({
        error:
          "This account is disabled or not active.",
      });
    }

    /* =====================================================
       MEMBER ACTIVE
    ===================================================== */

    if (

      String(
        user.role || ""
      ).toLowerCase() ===
        "member" &&

      user.status &&

      [
        "inactive",
        "disabled",
      ].includes(
        String(
          user.status
        ).toLowerCase()
      )
    ) {

      return res.status(403).json({
        error:
          "This member account is not active.",
      });
    }

    /* =====================================================
       MUST CHANGE PASSWORD
    ===================================================== */

if (
  Number(
    user.must_change_password || 0
  ) === 1
) {

  const {
    accessToken,
  } =
    await issueTokens(
      res,
      user
    );
await safeAudit({

  req,

  actorId:
    user.id,

  action:
    "temporary_password_login",

  entity:
    "auth",

  entityId:
    user.id,

  meta: {

    role:
      user.role,

    member_id:
      user.member_id || null,
  },
});
  return res.json({

    ok: true,

    requires_password_reset: true,

    token:
      accessToken,

    identifier:
      user.email ||

      user.username ||

      identifier,

    user:
      safeUser(user),
  });
}
    /* =====================================================
       ISSUE TOKENS
    ===================================================== */

    const {
      accessToken,
    } =
      await issueTokens(
        res,
        user
      );

    /* =====================================================
       AUDIT
    ===================================================== */

    await safeAudit({

      req,

      actorId:
        user.id,

      action:
        "login_success",

      entity:
        "auth",

      entityId:
        user.id,

      meta: {

        role:
          user.role,

        member_id:
          user.member_id ||
          null,
      },
    });

    /* =====================================================
       SUCCESS
    ===================================================== */

    return res.json({

      ok: true,

      token:
        accessToken,

      user:
        safeUser(user),

      must_change_password:
        false,
    });

  } catch (err) {

    console.error(
      "login error:",
      err
    );

    return res.status(500).json({
      error:
        "Server error",
    });
  }
});


/* -------------------------------------------------------------------------- */
/* Reset Temporary Password                                                   */
/* -------------------------------------------------------------------------- */

router.post(

  "/reset-temp-password",

  async (req, res) => {

    try {

      const {

        identifier,

        temp_password,

        new_password,

        confirm_password,

      } = req.body;

      /* =====================================================
         REQUIRED FIELDS
      ===================================================== */

      if (

        !identifier ||

        !temp_password ||

        !new_password ||

        !confirm_password

      ) {

        return res.status(400).json({

          error:
            "All fields are required.",
        });
      }

      /* =====================================================
         PASSWORD MATCH
      ===================================================== */

      if (
        new_password !==
        confirm_password
      ) {

        return res.status(400).json({

          error:
            "Passwords do not match.",
        });
      }

      /* =====================================================
         ENTERPRISE PASSWORD VALIDATION
      ===================================================== */

      function isStrongPassword(
        password = ""
      ) {

        const value =
          String(password);

        return (

          value.length >= 12 &&

          /[A-Z]/.test(value) &&

          /[a-z]/.test(value) &&

          /\d/.test(value) &&

          /[^A-Za-z0-9]/.test(value)
        );
      }

      if (
        !isStrongPassword(
          new_password
        )
      ) {

        return res.status(400).json({

          error:
            "Password must be at least 12 characters and include uppercase, lowercase, number, and special character.",
        });
      }

      /* =====================================================
         LOAD USER
      ===================================================== */

      const user =
        await loadUserByIdentifier(
          identifier
        );

      if (!user) {

        return res.status(404).json({

          error:
            "Account not found.",
        });
      }

      /* =====================================================
         ACCOUNT ACTIVE
      ===================================================== */

      if (
        Number(user.is_active) !== 1
      ) {

        return res.status(403).json({

          error:
            "This account is disabled.",
        });
      }

      /* =====================================================
         MUST CHANGE PASSWORD CHECK
      ===================================================== */

      if (
        Number(
          user.must_change_password || 0
        ) !== 1
      ) {

        return res.status(400).json({

          error:
            "Password reset is not required for this account.",
        });
      }

      /* =====================================================
         VERIFY TEMP PASSWORD
      ===================================================== */

      let valid = false;

      try {

        valid =
          await argon2.verify(
            user.password_hash,
            temp_password
          );

      } catch {

        valid = false;
      }

      if (!valid) {

        return res.status(401).json({

          error:
            "Temporary password is incorrect.",
        });
      }

      /* =====================================================
         HASH NEW PASSWORD
      ===================================================== */

      const newHash =
        await argon2.hash(
          new_password,
          {
            type:
              argon2.argon2id,

            memoryCost:
              19456,

            timeCost:
              2,

            parallelism:
              1,
          }
        );

      /* =====================================================
         UPDATE ACCOUNT
      ===================================================== */

      await pool.query(
        `
        UPDATE tbl_users
        SET
          password_hash = ?,
          must_change_password = 0,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          newHash,
          user.id,
        ]
      );

      /* =====================================================
   REVOKE OLD TOKENS
===================================================== */

await pool.query(
  `
  UPDATE tbl_refresh_tokens
  SET revoked_at = NOW()
  WHERE user_id = ?
    AND revoked_at IS NULL
  `,
  [user.id]
);
      /* =====================================================
         LOAD REFRESHED USER
      ===================================================== */

      const refreshedUser =
        await loadUserByIdentifier(
          identifier
        );

      /* =====================================================
         ISSUE TOKENS
      ===================================================== */

      const {
        accessToken,
      } =
        await issueTokens(
          res,
          refreshedUser
        );

      /* =====================================================
         AUDIT
      ===================================================== */

      await safeAudit({

        req,

        actorId:
          refreshedUser.id,

        action:
          "password_reset_completed",

        entity:
          "auth",

        entityId:
          refreshedUser.id,

        meta: {

          role:
            refreshedUser.role,

          member_id:
            refreshedUser.member_id || null,
        },
      });

      /* =====================================================
         SUCCESS
      ===================================================== */

      return res.json({

        ok: true,

        token:
          accessToken,

        user:
          safeUser(
            refreshedUser
          ),
      });

    } catch (err) {

      console.error(
        "reset-temp-password error:",
        err
      );

      return res.status(500).json({

        error:
          "Server error",
      });
    }
  }
);


/* -------------------------------------------------------------------------- */
/* Refresh / Logout                                                           */
/* -------------------------------------------------------------------------- */

router.post("/refresh", refreshRequired, async (req, res) => {
  try {
    await revokeRefreshTokenById(req.refresh.id);

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
        m.member_no,
        m.membership_status,
        m.status,
        m.registration_fee_status,
        m.next_due_at,
        m.last_payment_at
      FROM tbl_users u
      LEFT JOIN tbl_members m
        ON m.id = u.member_id
      WHERE u.id = ?
      LIMIT 1
      `,
      [req.refresh.user_id]
    );

    if (!rows.length) {
      res.clearCookie("ht_refresh", cookieOptions());
      return res.status(401).json({ error: "Unauthorized" });
    }

    let user = rows[0];
    user = await tryAttachMemberIfMissing(user);

    if (Number(user.is_active) !== 1) {
      res.clearCookie("ht_refresh", cookieOptions());
      return res.status(403).json({ error: "This account is disabled." });
    }

    const { accessToken } = await issueTokens(res, user);

    return res.json({
      ok: true,
      token: accessToken,
      user: safeUser(user),
      must_change_password: Number(user.must_change_password || 0) === 1,
    });
  } catch (err) {
    console.error("refresh error:", err);
    return res.status(401).json({ error: "Unauthorized" });
  }
});

router.post("/logout", refreshRequired, async (req, res) => {
  try {
    await revokeRefreshTokenById(req.refresh.id);
    res.clearCookie("ht_refresh", cookieOptions());
    return res.json({ ok: true });
  } catch (err) {
    console.error("logout error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* -------------------------------------------------------------------------- */
/* Forgot password                                                            */
/* -------------------------------------------------------------------------- */
router.post("/forgot-password", async (req, res) => {
  try {
    const identifier = clean(
      req.body.identifier || req.body.email || req.body.username,
      190
    ).toLowerCase();

    // Always return ok to prevent email/account discovery.
    if (!identifier) {
      return res.json({ ok: true });
    }

    const [rows] = await pool.query(
      `
      SELECT
        u.id,
        u.member_id,
        u.email,
        u.full_name
      FROM tbl_users u
      WHERE LOWER(u.email) = ?
         OR LOWER(u.username) = ?
      LIMIT 1
      `,
      [identifier, identifier]
    );

    if (!rows.length) {
      return res.json({ ok: true });
    }

    const user = rows[0];

    if (!user.email) {
      console.error("Forgot password skipped: user has no email", {
        user_id: user.id,
      });

      return res.json({ ok: true });
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = sha256Hex(token);

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await pool.query(
      `
      INSERT INTO tbl_password_resets
      (
        member_id,
        token_hash,
        expires_at
      )
      VALUES (?, ?, ?)
      `,
      [user.member_id, tokenHash, expiresAt]
    );

    const appUrl = (
      process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      "http://localhost:5173"
    ).replace(/\/+$/, "");

    const resetLink = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

    const emailResult = await sendPasswordResetEmail({
      to: user.email,
      fullName: user.full_name,
      resetLink,
    });

    if (!emailResult?.success) {
      console.error("Forgot password email failed:", emailResult?.error);
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("RESET LINK:", resetLink);
    } else {
      console.log("Password reset requested:", {
        user_id: user.id,
        email: user.email,
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("forgot-password error:", err);
    return res.json({ ok: true });
  }
});

/* -------------------------------------------------------------------------- */
/* Reset password                                                             */
/* -------------------------------------------------------------------------- */

router.post("/reset-password", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const token = String(req.body.token || "");
    const newPassword = String(req.body.new_password || req.body.password || "");
    const confirmPassword = String(
      req.body.confirm_password || req.body.confirmPassword || ""
    );

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Invalid request." });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        error:
          "Password must be at least 12 characters and include uppercase, lowercase, number, and special character.",
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    const tokenHash = sha256Hex(token);

    const [rows] = await conn.query(
      `
      SELECT *
      FROM tbl_password_resets
      WHERE token_hash = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [tokenHash]
    );

    if (!rows.length) {
      return res.status(400).json({ error: "Invalid or expired token." });
    }

    const resetRow = rows[0];

    if (resetRow.used_at) {
      return res.status(400).json({ error: "Invalid or expired token." });
    }

    if (Date.now() > new Date(resetRow.expires_at).getTime()) {
      return res.status(400).json({ error: "Invalid or expired token." });
    }

    const [[userRow]] = await conn.query(
      `
      SELECT id, member_id, email, full_name
      FROM tbl_users
      WHERE member_id = ?
      LIMIT 1
      `,
      [resetRow.member_id]
    );

    if (!userRow?.id) {
      return res.status(400).json({ error: "Invalid or expired token." });
    }

    const passwordHash = await hashPassword(newPassword);

    await conn.beginTransaction();

    await conn.query(
      `
      UPDATE tbl_users
      SET password_hash = ?, must_change_password = 0, updated_at = NOW()
      WHERE id = ?
      `,
      [passwordHash, userRow.id]
    );

    await conn.query(
      `
      UPDATE tbl_password_resets
      SET used_at = NOW()
      WHERE id = ?
      `,
      [resetRow.id]
    );

    await conn.query(
      `
      UPDATE tbl_refresh_tokens
      SET revoked_at = NOW()
      WHERE user_id = ?
        AND revoked_at IS NULL
      `,
      [userRow.id]
    );

    await conn.commit();

    res.clearCookie("ht_refresh", cookieOptions());

    await safeNotify("sendPasswordResetConfirmationEmail", {
      to: userRow.email,
      fullName: userRow.full_name,
    });

   const refreshedUser =
  await loadUserByIdentifier(
    userRow.email
  );

const {
  accessToken,
} =
  await issueTokens(
    res,
    refreshedUser
  );

return res.json({

  ok: true,

  token:
    accessToken,

  user:
    safeUser(
      refreshedUser
    ),
});
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}

    console.error("reset-password error:", err);
    return res.status(500).json({ error: "Server error" });
  } finally {
    conn.release();
  }
});
module.exports = router;