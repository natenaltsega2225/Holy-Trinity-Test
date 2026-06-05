"use strict";

const express = require("express");
const pool = require("../db");

const router = express.Router();

/* ================= PUBLIC GET ALL PUBLISHED ================= */
router.get("/", async (_req, res) => {
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
      WHERE is_published = 1
      ORDER BY activity_date ASC, start_time ASC, created_at DESC
    `);

    return res.json({ rows });
  } catch (error) {
    console.error("GET public serve posts error:", error);
    return res.status(500).json({ message: "Failed to load serve posts." });
  }
});

/* ================= PUBLIC GET ONE PUBLISHED ================= */
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid serve post id." });
    }

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
        AND is_published = 1
      LIMIT 1
      `,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Serve post not found." });
    }

    return res.json({ row: rows[0] });
  } catch (error) {
    console.error("GET public serve post by id error:", error);
    return res.status(500).json({ message: "Failed to load serve post." });
  }
});

module.exports = router;