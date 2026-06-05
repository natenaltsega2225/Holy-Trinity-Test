
// // routes/members.js

"use strict";

const express = require("express");
const pool = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

function clean(value, max = 255) {
  return String(value || "").trim().slice(0, max);
}

function nullable(value, max = 255) {
  const s = clean(value, max);
  return s || null;
}

function toBool01(v, fallback = 1) {
  if (v === true || v === 1 || v === "1") return 1;
  if (v === false || v === 0 || v === "0") return 0;
  return fallback;
}

function isValidName(value) {
  return /^[A-Za-z][A-Za-z\s'-]{0,99}$/.test(String(value || "").trim());
}

function isValidCustomLocationName(value, max = 100) {
  const pattern = new RegExp(`^[A-Za-z][A-Za-z\\s.'-]{0,${max - 1}}$`);
  return pattern.test(String(value || "").trim());
}

function isValidRelationshipValue(value) {
  return [
    "spouse",
    "child",
    "father",
    "mother",
    "brother",
    "sister",
    "grandparent",
    "other",
  ].includes(String(value || "").trim());
}

function isValidCustomRelationship(value) {
  return /^[A-Za-z][A-Za-z\s/&'-]{0,49}$/.test(String(value || "").trim());
}

function isValidEmail(value) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function isValidPhone(value) {
  if (!value) return true;
  return /^[0-9+\-().\s]{7,25}$/.test(String(value).trim());
}

function isValidZip(value) {
  if (!value) return true;
  return /^[A-Za-z0-9\- ]{3,20}$/.test(String(value).trim());
}

function calcAge(dateValue) {
  if (!dateValue) return null;
  const dob = new Date(dateValue);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < dob.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function validateDob(dateValue) {
  if (!dateValue) return "Date of birth is required.";

  const dob = new Date(dateValue);
  if (Number.isNaN(dob.getTime())) {
    return "Date of birth is invalid.";
  }

  const today = new Date();
  if (dob > today) {
    return "Date of birth cannot be in the future.";
  }

  const age = calcAge(dateValue);
  if (age === null) {
    return "Date of birth is invalid.";
  }

  if (age > 120) {
    return "Age appears invalid.";
  }

  return "";
}

function validateDependentInput(payload) {
  const errors = {};

  if (!payload.first_name) {
    errors.first_name = "First name is required.";
  } else if (!isValidName(payload.first_name)) {
    errors.first_name =
      "First name must contain letters only. Spaces, apostrophes, and hyphens are allowed.";
  }

  if (!payload.last_name) {
    errors.last_name = "Last name is required.";
  } else if (!isValidName(payload.last_name)) {
    errors.last_name =
      "Last name must contain letters only. Spaces, apostrophes, and hyphens are allowed.";
  }

  if (!payload.relationship) {
    errors.relationship = "Relationship is required.";
  } else if (!isValidRelationshipValue(payload.relationship)) {
    errors.relationship = "Relationship is invalid.";
  }

  if (payload.relationship === "other") {
    if (!payload.custom_relationship) {
      errors.custom_relationship = "Custom relationship is required.";
    } else if (!isValidCustomRelationship(payload.custom_relationship)) {
      errors.custom_relationship =
        "Custom relationship must contain letters only.";
    }
  }

  const dobError = validateDob(payload.date_of_birth);
  if (dobError) {
    errors.date_of_birth = dobError;
  }

  if (payload.email && !isValidEmail(payload.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (payload.phone && !isValidPhone(payload.phone)) {
    errors.phone = "Enter a valid phone number.";
  }

  if (
    payload.dependent_type &&
    !["dependent", "spouse", "child", "parent", "other"].includes(
      String(payload.dependent_type)
    )
  ) {
    errors.dependent_type = "Dependent type is invalid.";
  }

  if (
    payload.status &&
    !["active", "inactive", "archived"].includes(String(payload.status))
  ) {
    errors.status = "Status is invalid.";
  }

  return errors;
}

function validateMemberProfileInput(payload) {
  const errors = {};

  if (!payload.first_name) {
    errors.first_name = "First name is required.";
  } else if (!isValidName(payload.first_name)) {
    errors.first_name =
      "First name must contain letters only. Spaces, apostrophes, and hyphens are allowed.";
  }

  if (!payload.last_name) {
    errors.last_name = "Last name is required.";
  } else if (!isValidName(payload.last_name)) {
    errors.last_name =
      "Last name must contain letters only. Spaces, apostrophes, and hyphens are allowed.";
  }

  if (!payload.email) {
    errors.email = "Email is required.";
  } else if (!isValidEmail(payload.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (payload.phone && !isValidPhone(payload.phone)) {
    errors.phone = "Enter a valid phone number.";
  }

  if (payload.city && !isValidCustomLocationName(payload.city, 100)) {
    errors.city = "City must contain letters only.";
  }

  if (payload.state && !isValidCustomLocationName(payload.state, 80)) {
    errors.state = "State must contain letters only.";
  }

  if (payload.zip && !isValidZip(payload.zip)) {
    errors.zip = "ZIP / postal code format is invalid.";
  }

  return errors;
}

async function getMemberIdForUser(userId) {
  const [[row]] = await pool.query(
    `
    SELECT member_id
    FROM tbl_users
    WHERE id = ?
    LIMIT 1
    `,
    [userId]
  );
  return row?.member_id || null;
}

async function getMemberProfileByUserId(userId) {
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
      m.status,
      m.membership_status,
      m.is_active,
      m.next_due_at,
      m.created_at,
      m.updated_at,
      COALESCE(dep.total_dependents, 0) AS total_dependents,
      1 + COALESCE(dep.total_dependents, 0) AS total_members
    FROM tbl_users u
    INNER JOIN tbl_members m
      ON m.id = u.member_id
    LEFT JOIN (
      SELECT
        member_id,
        SUM(CASE WHEN is_active = 1 AND status = 'active' THEN 1 ELSE 0 END) AS total_dependents
      FROM tbl_member_dependents
      GROUP BY member_id
    ) dep
      ON dep.member_id = m.id
    WHERE u.id = ?
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

router.get("/me", authRequired, async (req, res) => {
  try {
    const member = await getMemberProfileByUserId(req.user.id);

    if (!member) {
      return res.status(404).json({ error: "Member profile not found." });
    }

    return res.json({
      ok: true,
      member,
    });
  } catch (e) {
    console.error("member self profile load error:", e);
    return res.status(500).json({ error: "Failed to load profile details." });
  }
});
router.get(
  "/me/ledger",
  authRequired,
  async (req, res) => {
    try {
      const memberId =
        await getMemberIdForUser(req.user.id);

      if (!memberId) {
        return res.json({
          ok: true,
          rows: [],
        });
      }

      const [rows] = await pool.query(
        `
        SELECT
          l.id,
          l.created_at,
          l.entry_type,
          l.source_type,
          l.description,
          l.payment_number,
          l.invoice_number,
          l.reference_no,

          l.debit_amount,
          l.credit_amount,
          l.running_balance,

          l.payment_status,
          l.ledger_status,

          l.months_paid,
          l.coverage_start,
          l.coverage_end

        FROM tbl_finance_member_ledger l

        WHERE l.member_id = ?

        ORDER BY l.id DESC
        `,
        [memberId]
      );

      return res.json({
        ok: true,
        rows,
      });
    } catch (err) {
      console.error(
        "member ledger load error:",
        err
      );

      return res.status(500).json({
        error: "Failed to load ledger.",
      });
    }
  }
);
router.put("/me", authRequired, async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const memberId = await getMemberIdForUser(req.user.id);
    if (!memberId) {
      conn.release();
      return res.status(404).json({ error: "Member profile not found." });
    }

    const payload = {
      first_name: clean(req.body.first_name, 100),
      last_name: clean(req.body.last_name, 100),
      email: clean(req.body.email, 190).toLowerCase(),
      phone: nullable(req.body.phone, 40),
      address_line1: nullable(req.body.address_line1, 200),
      address_line2: nullable(req.body.address_line2, 200),
      city: nullable(req.body.city, 100),
      state: nullable(req.body.state, 80),
      zip: nullable(req.body.zip, 20),
    };

    const errors = validateMemberProfileInput(payload);
    if (Object.keys(errors).length) {
      conn.release();
      return res.status(400).json({
        error: "Validation failed.",
        errors,
      });
    }

    const fullName = `${payload.first_name} ${payload.last_name}`.trim();

    const [[emailConflictMember]] = await conn.query(
      `
      SELECT id
      FROM tbl_members
      WHERE email = ?
        AND id <> ?
      LIMIT 1
      `,
      [payload.email, memberId]
    );

    if (emailConflictMember) {
      conn.release();
      return res.status(409).json({
        error: "That email address is already used by another member.",
      });
    }

    const [[linkedUser]] = await conn.query(
      `
      SELECT id, email
      FROM tbl_users
      WHERE member_id = ?
      ORDER BY id ASC
      LIMIT 1
      `,
      [memberId]
    );

    if (linkedUser) {
      const [[emailConflictUser]] = await conn.query(
        `
        SELECT id
        FROM tbl_users
        WHERE email = ?
          AND id <> ?
        LIMIT 1
        `,
        [payload.email, linkedUser.id]
      );

      if (emailConflictUser) {
        conn.release();
        return res.status(409).json({
          error: "That email address is already used by another user account.",
        });
      }
    }

    await conn.beginTransaction();

    await conn.query(
      `
      UPDATE tbl_members
      SET
        first_name = ?,
        last_name = ?,
        full_name = ?,
        email = ?,
        phone = ?,
        address_line1 = ?,
        address_line2 = ?,
        city = ?,
        state = ?,
        zip = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        payload.first_name,
        payload.last_name,
        fullName,
        payload.email,
        payload.phone,
        payload.address_line1,
        payload.address_line2,
        payload.city,
        payload.state,
        payload.zip,
        memberId,
      ]
    );

    if (linkedUser) {
      await conn.query(
        `
        UPDATE tbl_users
        SET
          first_name = ?,
          last_name = ?,
          full_name = ?,
          email = ?,
          phone = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          payload.first_name,
          payload.last_name,
          fullName,
          payload.email,
          payload.phone,
          linkedUser.id,
        ]
      );
    }

    await conn.commit();

    const member = await getMemberProfileByUserId(req.user.id);

    return res.json({
      ok: true,
      message: "Profile updated successfully.",
      member,
    });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    console.error("member self update error:", e);

    if (e?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: "That email address is already used by another account.",
      });
    }

    return res.status(500).json({ error: "Failed to update profile." });
  } finally {
    conn.release();
  }
});

router.get("/me/dependents", authRequired, async (req, res) => {
  try {
    const memberId = await getMemberIdForUser(req.user.id);
    if (!memberId) {
      return res.status(404).json({ error: "Member not found" });
    }

    const [rows] = await pool.query(
      `
      SELECT
        id,
        dependent_no,
        first_name,
        last_name,
        full_name,
        relationship,
        CASE
          WHEN relationship IN ('spouse','child','father','mother','brother','sister','grandparent')
            THEN NULL
          ELSE relationship
        END AS custom_relationship,
        dependent_type,
        gender,
        date_of_birth,
        TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) AS age,
        email,
        phone,
        is_student,
        is_disabled,
        is_active,
        status,
        notes,
        created_at,
        updated_at
      FROM tbl_member_dependents
      WHERE member_id = ?
      ORDER BY created_at DESC, id DESC
      `,
      [memberId]
    );

    const [[counts]] = await pool.query(
      `
      SELECT
        SUM(CASE WHEN is_active = 1 AND status = 'active' THEN 1 ELSE 0 END) AS total_dependents
      FROM tbl_member_dependents
      WHERE member_id = ?
      `,
      [memberId]
    );

    return res.json({
      ok: true,
      rows,
      summary: {
        total_independent_members: 1,
        total_dependents: Number(counts?.total_dependents || 0),
        total_members: 1 + Number(counts?.total_dependents || 0),
      },
    });
  } catch (e) {
    console.error("member dependents list error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/me/dependents", authRequired, async (req, res) => {
  try {
    const memberId = await getMemberIdForUser(req.user.id);
    if (!memberId) {
      return res.status(404).json({ error: "Member not found" });
    }

    const payload = {
      first_name: clean(req.body.first_name, 100),
      last_name: clean(req.body.last_name, 100),
      relationship: clean(req.body.relationship, 50).toLowerCase(),
      custom_relationship: clean(req.body.custom_relationship, 50),
      dependent_type: clean(req.body.dependent_type || "dependent", 20),
      gender: nullable(req.body.gender, 20),
      date_of_birth: nullable(req.body.date_of_birth, 20),
      email: nullable(req.body.email, 190),
      phone: nullable(req.body.phone, 40),
      is_student: toBool01(req.body.is_student, 0),
      is_disabled: toBool01(req.body.is_disabled, 0),
      is_active: toBool01(req.body.is_active, 1),
      status: clean(req.body.status || "active", 20),
      notes: nullable(req.body.notes, 5000),
    };

    const errors = validateDependentInput(payload);
    if (Object.keys(errors).length) {
      return res.status(400).json({
        error: "Validation failed.",
        errors,
      });
    }

    const storedRelationship =
      payload.relationship === "other"
        ? payload.custom_relationship.toLowerCase()
        : payload.relationship;

    const full_name = `${payload.first_name} ${payload.last_name}`.trim();

    const [result] = await pool.query(
      `
      INSERT INTO tbl_member_dependents (
        member_id,
        dependent_no,
        first_name,
        last_name,
        full_name,
        relationship,
        dependent_type,
        gender,
        date_of_birth,
        email,
        phone,
        is_student,
        is_disabled,
        is_active,
        status,
        notes,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        memberId,
        null,
        payload.first_name,
        payload.last_name,
        full_name,
        storedRelationship,
        payload.dependent_type,
        payload.gender,
        payload.date_of_birth,
        payload.email,
        payload.phone,
        payload.is_student,
        payload.is_disabled,
        payload.is_active,
        payload.status,
        payload.notes,
      ]
    );

    const dependentNo = `D-${String(result.insertId).padStart(5, "0")}`;

    await pool.query(
      `
      UPDATE tbl_member_dependents
      SET dependent_no = ?, updated_at = NOW()
      WHERE id = ?
      `,
      [dependentNo, result.insertId]
    );

    return res.status(201).json({
      ok: true,
      id: result.insertId,
      dependent_no: dependentNo,
      message: "Dependent added successfully.",
    });
  } catch (e) {
    console.error("member dependent create error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.put("/me/dependents/:id", authRequired, async (req, res) => {
  try {
    const memberId = await getMemberIdForUser(req.user.id);
    if (!memberId) {
      return res.status(404).json({ error: "Member not found" });
    }

    const dependentId = Number(req.params.id);
    if (!Number.isInteger(dependentId) || dependentId <= 0) {
      return res.status(400).json({ error: "Invalid dependent id." });
    }

    const payload = {
      first_name: clean(req.body.first_name, 100),
      last_name: clean(req.body.last_name, 100),
      relationship: clean(req.body.relationship, 50).toLowerCase(),
      custom_relationship: clean(req.body.custom_relationship, 50),
      dependent_type: clean(req.body.dependent_type || "dependent", 20),
      gender: nullable(req.body.gender, 20),
      date_of_birth: nullable(req.body.date_of_birth, 20),
      email: nullable(req.body.email, 190),
      phone: nullable(req.body.phone, 40),
      is_student: toBool01(req.body.is_student, 0),
      is_disabled: toBool01(req.body.is_disabled, 0),
      is_active: toBool01(req.body.is_active, 1),
      status: clean(req.body.status || "active", 20),
      notes: nullable(req.body.notes, 5000),
    };

    const errors = validateDependentInput(payload);
    if (Object.keys(errors).length) {
      return res.status(400).json({
        error: "Validation failed.",
        errors,
      });
    }

    const storedRelationship =
      payload.relationship === "other"
        ? payload.custom_relationship.toLowerCase()
        : payload.relationship;

    const full_name = `${payload.first_name} ${payload.last_name}`.trim();

    await pool.query(
      `
      UPDATE tbl_member_dependents
      SET
        first_name = ?,
        last_name = ?,
        full_name = ?,
        relationship = ?,
        dependent_type = ?,
        gender = ?,
        date_of_birth = ?,
        email = ?,
        phone = ?,
        is_student = ?,
        is_disabled = ?,
        is_active = ?,
        status = ?,
        notes = ?,
        updated_at = NOW()
      WHERE id = ?
        AND member_id = ?
      `,
      [
        payload.first_name,
        payload.last_name,
        full_name,
        storedRelationship,
        payload.dependent_type,
        payload.gender,
        payload.date_of_birth,
        payload.email,
        payload.phone,
        payload.is_student,
        payload.is_disabled,
        payload.is_active,
        payload.status,
        payload.notes,
        dependentId,
        memberId,
      ]
    );

    return res.json({
      ok: true,
      message: "Dependent updated successfully.",
    });
  } catch (e) {
    console.error("member dependent update error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/me/dependents/:id", authRequired, async (req, res) => {
  try {
    const memberId = await getMemberIdForUser(req.user.id);
    if (!memberId) {
      return res.status(404).json({ error: "Member not found" });
    }

    const dependentId = Number(req.params.id);
    if (!Number.isInteger(dependentId) || dependentId <= 0) {
      return res.status(400).json({ error: "Invalid dependent id." });
    }

    await pool.query(
      `
      DELETE FROM tbl_member_dependents
      WHERE id = ?
        AND member_id = ?
      `,
      [dependentId, memberId]
    );

    return res.json({
      ok: true,
      message: "Dependent deleted successfully.",
    });
  } catch (e) {
    console.error("member dependent delete error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;