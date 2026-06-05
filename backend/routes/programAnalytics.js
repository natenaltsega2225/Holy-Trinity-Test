"use strict";

const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");

router.get("/admin/analytics", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        e.id,
        e.title,
        e.category,
        e.capacity,
        COUNT(r.id) as total_registrations,
        SUM(r.quantity) as total_participants,
        SUM(r.total_amount) as total_revenue
      FROM tbl_news_events e
      LEFT JOIN tbl_event_program_registrations r
        ON r.news_event_id = e.id
      WHERE e.category IN ('kids','trip')
      GROUP BY e.id
      ORDER BY total_revenue DESC
    `);

    res.json({ ok: true, rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed analytics" });
  }
});

module.exports = router;