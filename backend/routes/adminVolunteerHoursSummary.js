"use strict";

const express = require("express");
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        volunteer_name,
        email,
        SUM(total_hours) AS total_hours,
        MAX(date_served) AS last_served,
        GROUP_CONCAT(DISTINCT category) AS categories
      FROM tbl_volunteer_hours
      GROUP BY volunteer_name, email
      ORDER BY total_hours DESC
    `);

    return res.json({ rows });
  } catch (err) {
    console.error("GET summary error:", err);
    return res.status(500).json({ message: "Failed to load summary" });
  }
});

module.exports = router;