// backend\routes\adminMemberDependents.js
"use strict";

const express = require("express");
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");

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

function isValidRelationship(value) {
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

  if (!isValidName(payload.first_name)) {
    errors.first_name =
      "First name must contain letters only. Spaces, apostrophes, and hyphens are allowed.";
  }

  if (!isValidName(payload.last_name)) {
    errors.last_name =
      "Last name must contain letters only. Spaces, apostrophes, and hyphens are allowed.";
  }

  if (!isValidRelationship(payload.relationship)) {
    errors.relationship =
      "Relationship must contain letters only.";
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

router.get(
  "/members/:memberId/dependents",
  requireRole(
  "admin",
  "finance",
  "super_admin"
),
  async (req, res) => {
    try {
      const memberId = Number(req.params.memberId);
      if (!Number.isInteger(memberId) || memberId <= 0) {
        return res.status(400).json({ error: "Invalid member id." });
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

      return res.json({ ok: true, rows });
    } catch (e) {
      console.error("admin member dependents list error:", e);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

router.post(
  "/members/:memberId/dependents",
  authRequired,
requireRole(
  "admin",
  "finance",
  "super_admin"
),
  async (req, res) => {
    try {
      const memberId = Number(req.params.memberId);
      if (!Number.isInteger(memberId) || memberId <= 0) {
        return res.status(400).json({ error: "Invalid member id." });
      }

      const payload = {
        first_name: clean(req.body.first_name, 100),
        last_name: clean(req.body.last_name, 100),
        relationship: clean(req.body.relationship, 50),
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
          payload.relationship,
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
      console.error("admin member dependent create error:", e);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

router.put(
  "/members/:memberId/dependents/:id",
 authRequired,
requireRole(
  "admin",
  "finance",
  "super_admin"
),
  async (req, res) => {
    try {
      const memberId = Number(req.params.memberId);
      const dependentId = Number(req.params.id);

      if (!Number.isInteger(memberId) || memberId <= 0) {
        return res.status(400).json({ error: "Invalid member id." });
      }
      if (!Number.isInteger(dependentId) || dependentId <= 0) {
        return res.status(400).json({ error: "Invalid dependent id." });
      }

      const payload = {
        first_name: clean(req.body.first_name, 100),
        last_name: clean(req.body.last_name, 100),
        relationship: clean(req.body.relationship, 50),
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
          payload.relationship,
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
      console.error("admin member dependent update error:", e);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

router.delete(
  "/members/:memberId/dependents/:id",
 authRequired,
requireRole(
  "admin",
  "finance",
  "super_admin"
),
  async (req, res) => {
    try {
      const memberId = Number(req.params.memberId);
      const dependentId = Number(req.params.id);

      if (!Number.isInteger(memberId) || memberId <= 0) {
        return res.status(400).json({ error: "Invalid member id." });
      }
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
      console.error("admin member dependent delete error:", e);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

module.exports = router;