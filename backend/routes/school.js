// //backend\routes\school.js


"use strict";

const express = require("express");
const pool = require("../db");

const router = express.Router();

router.get("/programs", async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        title,
        title,
        'kids' AS category,
        price_per_person,
        price_per_person AS price,
        start_date,
        end_date,
        location,
        capacity,
        registration_enabled,
        is_published
      FROM tbl_news_events
      WHERE category = 'kids'
        AND is_published = 1
        AND registration_enabled = 1
        AND COALESCE(price_per_person, 0) > 0
      ORDER BY start_date ASC, id DESC
    `);

    return res.json({ ok: true, rows });
  } catch (err) {
    console.error("GET /school/programs error:", err);
    return res.status(500).json({ error: "Failed to load school programs." });
  }
});

module.exports = router;