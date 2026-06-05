"use strict";

const express = require("express");
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

function text(value) {
  return String(value ?? "").trim();
}

router.get("/", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const status = text(req.query.status);
    const search = text(req.query.search);

    const where = [];
    const params = [];

    if (status) {
      where.push("status = ?");
      params.push(status);
    }

    if (search) {
      where.push(`
        (
          full_name LIKE ?
          OR email LIKE ?
          OR phone LIKE ?
          OR category LIKE ?
          OR role LIKE ?
          OR activity_title LIKE ?
          OR activity_location LIKE ?
        )
      `);
      const q = `%${search}%`;
      params.push(q, q, q, q, q, q, q);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `
      SELECT
        id,
        member_id,
        full_name,
        email,
        phone,
        category,
        role,
        activity_title,
        activity_date,
        activity_start_time,
        activity_end_time,
        activity_location,
        availability,
        experience,
        additional_notes,
        status,
        admin_notes,
        decline_reason,
        ministry_leader_name,
        ministry_leader_email,
        created_at,
        updated_at
      FROM tbl_volunteer_applications
      ${whereSql}
      ORDER BY created_at DESC, id DESC
      `,
      params
    );

    return res.json({ rows });
  } catch (error) {
    console.error("GET admin volunteer applications error:", error);
    return res.status(500).json({
      message: "Failed to load volunteer applications.",
    });
  }
});

router.get("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid application id." });
    }

    const [rows] = await pool.query(
      `
      SELECT
        id,
        member_id,
        full_name,
        email,
        phone,
        category,
        role,
        activity_title,
        activity_date,
        activity_start_time,
        activity_end_time,
        activity_location,
        availability,
        experience,
        additional_notes,
        status,
        admin_notes,
        decline_reason,
        ministry_leader_name,
        ministry_leader_email,
        created_at,
        updated_at
      FROM tbl_volunteer_applications
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Volunteer application not found." });
    }

    return res.json({ row: rows[0] });
  } catch (error) {
    console.error("GET admin volunteer application detail error:", error);
    return res.status(500).json({
      message: "Failed to load volunteer application.",
    });
  }
});

router.patch("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid application id." });
    }

    const {
      status,
      admin_notes,
      decline_reason,
      ministry_leader_name,
      ministry_leader_email,
    } = req.body || {};

    const nextStatus = text(status);
    const allowedStatuses = ["new", "in_review", "approved", "declined", "request_info"];

    if (nextStatus && !allowedStatuses.includes(nextStatus)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    await pool.query(
      `
      UPDATE tbl_volunteer_applications
      SET
        status = COALESCE(?, status),
        admin_notes = COALESCE(?, admin_notes),
        decline_reason = COALESCE(?, decline_reason),
        ministry_leader_name = COALESCE(?, ministry_leader_name),
        ministry_leader_email = COALESCE(?, ministry_leader_email),
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        nextStatus || null,
        admin_notes !== undefined ? text(admin_notes) || null : null,
        decline_reason !== undefined ? text(decline_reason) || null : null,
        ministry_leader_name !== undefined ? text(ministry_leader_name) || null : null,
        ministry_leader_email !== undefined ? text(ministry_leader_email) || null : null,
        id,
      ]
    );

    const [rows] = await pool.query(
      `
      SELECT
        id,
        member_id,
        full_name,
        email,
        phone,
        category,
        role,
        activity_title,
        activity_date,
        activity_start_time,
        activity_end_time,
        activity_location,
        availability,
        experience,
        additional_notes,
        status,
        admin_notes,
        decline_reason,
        ministry_leader_name,
        ministry_leader_email,
        created_at,
        updated_at
      FROM tbl_volunteer_applications
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Volunteer application not found." });
    }

    return res.json({
      message: "Volunteer application updated successfully.",
      row: rows[0],
    });
  } catch (error) {
    console.error("PATCH admin volunteer applications error:", error);
    return res.status(500).json({
      message: "Failed to update volunteer application.",
    });
  }
});

module.exports = router;