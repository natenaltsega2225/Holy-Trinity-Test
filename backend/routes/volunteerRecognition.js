"use strict";

const express = require("express");
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

function text(v) {
  return String(v ?? "").trim();
}

function normalizeDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function recognitionLevelFromHours(hours) {
  const value = Number(hours || 0);
  if (value >= 100) return "Platinum";
  if (value >= 50) return "Gold";
  if (value >= 25) return "Silver";
  if (value >= 10) return "Bronze";
  return "Starter";
}

/* ================= GET ================= */
router.get("/", authRequired, requireRole("admin"), async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT *
      FROM tbl_volunteer_recognition
      ORDER BY total_hours DESC, volunteer_name ASC
    `);
    res.json({ rows });
  } catch (err) {
    console.error("GET volunteer recognition error:", err);
    res.status(500).json({ message: "Failed to load recognition" });
  }
});

/* ================= POST ================= */
router.post("/", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const {
      volunteer_name,
      email,
      total_hours,
      recognition_level,
      board_approved,
      approval_date,
      notes,
    } = req.body || {};

    if (!text(volunteer_name)) {
      return res.status(400).json({ message: "Name required" });
    }

    const hours = Number(total_hours);
    if (!Number.isFinite(hours)) {
      return res.status(400).json({ message: "Invalid hours" });
    }

    await pool.query(
      `
      INSERT INTO tbl_volunteer_recognition
      (
        volunteer_name,
        email,
        total_hours,
        recognition_level,
        board_approved,
        approval_date,
        notes,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        text(volunteer_name),
        text(email) || null,
        hours,
        text(recognition_level) || recognitionLevelFromHours(hours),
        board_approved ? 1 : 0,
        normalizeDate(approval_date),
        text(notes) || null,
      ]
    );

    res.json({ message: "Recognition saved" });
  } catch (err) {
    console.error("POST volunteer recognition error:", err);
    res.status(500).json({ message: "Failed to save recognition" });
  }
});

/* ================= PATCH ================= */
router.patch("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const {
      volunteer_name,
      email,
      total_hours,
      recognition_level,
      board_approved,
      approval_date,
      notes,
    } = req.body || {};

    const hours = Number(total_hours);
    if (!Number.isFinite(hours)) {
      return res.status(400).json({ message: "Invalid hours" });
    }

    await pool.query(
      `
      UPDATE tbl_volunteer_recognition
      SET
        volunteer_name = ?,
        email = ?,
        total_hours = ?,
        recognition_level = ?,
        board_approved = ?,
        approval_date = ?,
        notes = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        text(volunteer_name),
        text(email) || null,
        hours,
        text(recognition_level) || recognitionLevelFromHours(hours),
        board_approved ? 1 : 0,
        normalizeDate(approval_date),
        text(notes) || null,
        id,
      ]
    );

    res.json({ message: "Recognition updated" });
  } catch (err) {
    console.error("PATCH volunteer recognition error:", err);
    res.status(500).json({ message: "Failed to update recognition" });
  }
});

/* ================= DELETE ================= */
router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid id" });
    }

    await pool.query(`DELETE FROM tbl_volunteer_recognition WHERE id = ?`, [id]);
    res.json({ message: "Recognition deleted" });
  } catch (err) {
    console.error("DELETE volunteer recognition error:", err);
    res.status(500).json({ message: "Failed to delete recognition" });
  }
});

/* ================= AUTO RECOGNITION: PREVIEW ================= */
router.get("/auto/preview", authRequired, requireRole("admin"), async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        volunteer_name,
        email,
        ROUND(SUM(total_hours), 2) AS total_hours
      FROM tbl_volunteer_hours
      WHERE approved = 1
      GROUP BY volunteer_name, email
      HAVING SUM(total_hours) >= 10
      ORDER BY total_hours DESC, volunteer_name ASC
    `);

    const preview = rows.map((row) => ({
      volunteer_name: row.volunteer_name,
      email: row.email,
      total_hours: Number(row.total_hours || 0),
      recognition_level: recognitionLevelFromHours(row.total_hours),
    }));

    res.json({ rows: preview });
  } catch (err) {
    console.error("GET auto recognition preview error:", err);
    res.status(500).json({ message: "Failed to build recognition preview" });
  }
});

/* ================= AUTO RECOGNITION: SYNC ================= */
router.post("/auto/sync", authRequired, requireRole("admin"), async (_req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(`
      SELECT
        volunteer_name,
        email,
        ROUND(SUM(total_hours), 2) AS total_hours
      FROM tbl_volunteer_hours
      WHERE approved = 1
      GROUP BY volunteer_name, email
      HAVING SUM(total_hours) >= 10
      ORDER BY total_hours DESC, volunteer_name ASC
    `);

    let updated = 0;
    let inserted = 0;

    for (const row of rows) {
      const volunteer_name = text(row.volunteer_name);
      const email = text(row.email) || null;
      const total_hours = Number(row.total_hours || 0);
      const recognition_level = recognitionLevelFromHours(total_hours);

      const [existing] = await conn.query(
        `
        SELECT id
        FROM tbl_volunteer_recognition
        WHERE volunteer_name = ?
          AND ((email IS NULL AND ? IS NULL) OR email = ?)
        LIMIT 1
        `,
        [volunteer_name, email, email]
      );

      if (existing.length) {
        await conn.query(
          `
          UPDATE tbl_volunteer_recognition
          SET
            total_hours = ?,
            recognition_level = ?,
            updated_at = NOW()
          WHERE id = ?
          `,
          [total_hours, recognition_level, existing[0].id]
        );
        updated += 1;
      } else {
        await conn.query(
          `
          INSERT INTO tbl_volunteer_recognition
          (
            volunteer_name,
            email,
            total_hours,
            recognition_level,
            board_approved,
            approval_date,
            notes,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, 0, NULL, NULL, NOW(), NOW())
          `,
          [volunteer_name, email, total_hours, recognition_level]
        );
        inserted += 1;
      }
    }

    await conn.commit();

    res.json({
      message: "Auto recognition sync completed",
      inserted,
      updated,
      total_candidates: rows.length,
    });
  } catch (err) {
    await conn.rollback();
    console.error("POST auto recognition sync error:", err);
    res.status(500).json({ message: "Failed to sync auto recognition" });
  } finally {
    conn.release();
  }
});

module.exports = router;