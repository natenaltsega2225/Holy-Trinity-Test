//backend\routes\volunteerHours.js
"use strict";

const express = require("express");
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

function text(value) {
  return String(value ?? "").trim();
}

function normalizeDateOnly(value) {
  const raw = text(value);
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;

  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTimeOnly(value) {
  const raw = text(value);
  if (!raw) return null;

  if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw.slice(0, 5);
  }

  return raw;
}

function safeEmail(value) {
  const raw = text(value);
  return raw || null;
}

function calculateHours(startTime, endTime) {
  const start = normalizeTimeOnly(startTime);
  const end = normalizeTimeOnly(endTime);

  if (!start || !end) return null;

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  if (![sh, sm, eh, em].every(Number.isFinite)) return null;

  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  const diff = endMinutes - startMinutes;

  if (diff <= 0) return null;

  return Number((diff / 60).toFixed(2));
}

router.get("/", authRequired, requireRole("admin"), async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        volunteer_name,
        email,
        category,
        serve_post_id,
        date_served,
        start_time,
        end_time,
        total_hours,
        notes,
        created_at,
        updated_at
      FROM tbl_volunteer_hours
      ORDER BY date_served DESC, created_at DESC
    `);

    return res.json({ rows });
  } catch (error) {
    console.error("GET volunteer hours error:", error);
    return res.status(500).json({ message: "Failed to load volunteer hours." });
  }
});

router.post("/", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const {
      volunteer_name,
      email,
      category,
      serve_post_id,
      date_served,
      start_time,
      end_time,
      total_hours,
      notes,
    } = req.body || {};

    if (!text(volunteer_name)) {
      return res.status(400).json({ message: "Volunteer name is required." });
    }

    if (!text(category)) {
      return res.status(400).json({ message: "Category is required." });
    }

    const normalizedDate = normalizeDateOnly(date_served);
    if (!normalizedDate) {
      return res.status(400).json({ message: "Valid date served is required." });
    }

    const normalizedStart = normalizeTimeOnly(start_time);
    const normalizedEnd = normalizeTimeOnly(end_time);

    let hoursValue = total_hours;
    if (hoursValue === undefined || hoursValue === null || String(hoursValue).trim() === "") {
      hoursValue = calculateHours(normalizedStart, normalizedEnd);
    }

    const parsedHours = Number(hoursValue);
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      return res.status(400).json({
        message: "Total hours must be greater than 0.",
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO tbl_volunteer_hours (
        volunteer_name,
        email,
        category,
        serve_post_id,
        date_served,
        start_time,
        end_time,
        total_hours,
        notes,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        text(volunteer_name),
        safeEmail(email),
        text(category),
        serve_post_id ? Number(serve_post_id) : null,
        normalizedDate,
        normalizedStart,
        normalizedEnd,
        parsedHours,
        text(notes) || null,
      ]
    );

    const [rows] = await pool.query(
      `
      SELECT
        id,
        volunteer_name,
        email,
        category,
        serve_post_id,
        date_served,
        start_time,
        end_time,
        total_hours,
        notes,
        created_at,
        updated_at
      FROM tbl_volunteer_hours
      WHERE id = ?
      LIMIT 1
      `,
      [result.insertId]
    );

    return res.status(201).json({
      message: "Volunteer hours saved successfully.",
      row: rows[0] || null,
    });
  } catch (error) {
    console.error("POST volunteer hours error:", error);
    return res.status(500).json({ message: "Failed to save volunteer hours." });
  }
});

router.patch("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid volunteer hours id." });
    }

    const {
      volunteer_name,
      email,
      category,
      serve_post_id,
      date_served,
      start_time,
      end_time,
      total_hours,
      notes,
    } = req.body || {};

    let normalizedDate = null;
    if (date_served !== undefined) {
      normalizedDate = normalizeDateOnly(date_served);
      if (!normalizedDate) {
        return res.status(400).json({ message: "Valid date served is required." });
      }
    }

    let normalizedStart = null;
    if (start_time !== undefined) {
      normalizedStart = normalizeTimeOnly(start_time);
    }

    let normalizedEnd = null;
    if (end_time !== undefined) {
      normalizedEnd = normalizeTimeOnly(end_time);
    }

    let parsedHours = null;
    if (total_hours !== undefined && total_hours !== null && String(total_hours).trim() !== "") {
      parsedHours = Number(total_hours);
      if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
        return res.status(400).json({
          message: "Total hours must be greater than 0.",
        });
      }
    }

    await pool.query(
      `
      UPDATE tbl_volunteer_hours
      SET
        volunteer_name = COALESCE(?, volunteer_name),
        email = COALESCE(?, email),
        category = COALESCE(?, category),
        serve_post_id = COALESCE(?, serve_post_id),
        date_served = COALESCE(?, date_served),
        start_time = COALESCE(?, start_time),
        end_time = COALESCE(?, end_time),
        total_hours = COALESCE(?, total_hours),
        notes = COALESCE(?, notes),
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        volunteer_name !== undefined ? text(volunteer_name) : null,
        email !== undefined ? safeEmail(email) : null,
        category !== undefined ? text(category) : null,
        serve_post_id !== undefined ? (serve_post_id ? Number(serve_post_id) : null) : null,
        normalizedDate,
        normalizedStart,
        normalizedEnd,
        parsedHours,
        notes !== undefined ? text(notes) || null : null,
        id,
      ]
    );

    const [rows] = await pool.query(
      `
      SELECT
        id,
        volunteer_name,
        email,
        category,
        serve_post_id,
        date_served,
        start_time,
        end_time,
        total_hours,
        notes,
        created_at,
        updated_at
      FROM tbl_volunteer_hours
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Volunteer hours record not found." });
    }

    return res.json({
      message: "Volunteer hours updated successfully.",
      row: rows[0],
    });
  } catch (error) {
    console.error("PATCH volunteer hours error:", error);
    return res.status(500).json({ message: "Failed to update volunteer hours." });
  }
});

router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid volunteer hours id." });
    }

    const [result] = await pool.query(
      `DELETE FROM tbl_volunteer_hours WHERE id = ?`,
      [id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Volunteer hours record not found." });
    }

    return res.json({ message: "Volunteer hours deleted successfully." });
  } catch (error) {
    console.error("DELETE volunteer hours error:", error);
    return res.status(500).json({ message: "Failed to delete volunteer hours." });
  }
});

module.exports = router;