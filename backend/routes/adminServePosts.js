//backend\routes\adminServePosts.js
"use strict";

const express = require("express");
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", authRequired, requireRole("admin"), async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        category,
        title,
        description,
        activity_date,
        start_time,
        end_time,
        location,
        notes,
        is_published,
        created_at,
        updated_at
      FROM tbl_serve_posts
      ORDER BY activity_date DESC, start_time DESC, created_at DESC
    `);

    return res.json({ rows });
  } catch (error) {
    console.error("GET admin serve posts error:", error);
    return res.status(500).json({ message: "Failed to load serve posts." });
  }
});

router.post("/", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const {
      category,
      title,
      description,
      activity_date,
      start_time,
      end_time,
      location,
      notes,
      is_published,
    } = req.body || {};

    if (!String(category || "").trim()) {
      return res.status(400).json({ message: "Category is required." });
    }
    if (!String(title || "").trim()) {
      return res.status(400).json({ message: "Title is required." });
    }
    if (!String(description || "").trim()) {
      return res.status(400).json({ message: "Description is required." });
    }
    if (!String(activity_date || "").trim()) {
      return res.status(400).json({ message: "Date is required." });
    }
    if (!String(start_time || "").trim()) {
      return res.status(400).json({ message: "Start time is required." });
    }
    if (!String(end_time || "").trim()) {
      return res.status(400).json({ message: "End time is required." });
    }
    if (!String(location || "").trim()) {
      return res.status(400).json({ message: "Location is required." });
    }

    const [result] = await pool.query(
      `
      INSERT INTO tbl_serve_posts (
        category,
        title,
        description,
        activity_date,
        start_time,
        end_time,
        location,
        notes,
        is_published,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        String(category).trim(),
        String(title).trim(),
        String(description).trim(),
        String(activity_date).trim(),
        String(start_time).trim(),
        String(end_time).trim(),
        String(location).trim(),
        String(notes || "").trim() || null,
        is_published ? 1 : 0,
      ]
    );

    const [rows] = await pool.query(
      `
      SELECT
        id,
        category,
        title,
        description,
        activity_date,
        start_time,
        end_time,
        location,
        notes,
        is_published,
        created_at,
        updated_at
      FROM tbl_serve_posts
      WHERE id = ?
      LIMIT 1
      `,
      [result.insertId]
    );

    return res.status(201).json({
      message: "Serve post created successfully.",
      row: rows[0] || null,
    });
  } catch (error) {
    console.error("POST admin serve posts error:", error);
    return res.status(500).json({ message: "Failed to create serve post." });
  }
});

router.patch("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid serve post id." });
    }

    const {
      category,
      title,
      description,
      activity_date,
      start_time,
      end_time,
      location,
      notes,
      is_published,
    } = req.body || {};

    await pool.query(
      `
      UPDATE tbl_serve_posts
      SET
        category = COALESCE(?, category),
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        activity_date = COALESCE(?, activity_date),
        start_time = COALESCE(?, start_time),
        end_time = COALESCE(?, end_time),
        location = COALESCE(?, location),
        notes = COALESCE(?, notes),
        is_published = COALESCE(?, is_published),
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        category ?? null,
        title ?? null,
        description ?? null,
        activity_date ?? null,
        start_time ?? null,
        end_time ?? null,
        location ?? null,
        notes ?? null,
        typeof is_published === "boolean" ? (is_published ? 1 : 0) : null,
        id,
      ]
    );

    const [rows] = await pool.query(
      `
      SELECT
        id,
        category,
        title,
        description,
        activity_date,
        start_time,
        end_time,
        location,
        notes,
        is_published,
        created_at,
        updated_at
      FROM tbl_serve_posts
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Serve post not found." });
    }

    return res.json({
      message: "Serve post updated successfully.",
      row: rows[0],
    });
  } catch (error) {
    console.error("PATCH admin serve posts error:", error);
    return res.status(500).json({ message: "Failed to update serve post." });
  }
});

router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid serve post id." });
    }

    const [result] = await pool.query(
      `DELETE FROM tbl_serve_posts WHERE id = ?`,
      [id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Serve post not found." });
    }

    return res.json({ message: "Serve post deleted successfully." });
  } catch (error) {
    console.error("DELETE admin serve posts error:", error);
    return res.status(500).json({ message: "Failed to delete serve post." });
  }
});

module.exports = router;