//backend\routes\volunteerHoursPublic.js
"use strict";

const express = require("express");
const pool = require("../db");

const router = express.Router();

function normalizeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normalizeTime(value) {
  if (!value) return null;
  return value.slice(0, 5);
}

function calculateHours(start, end) {
  if (!start || !end) return null;

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  if (![sh, sm, eh, em].every(Number.isFinite)) return null;

  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return null;

  return Number((diff / 60).toFixed(2));
}

router.post("/", async (req, res) => {
  try {
    const {
      volunteer_name,
      email,
      category,
      date_served,
      start_time,
      end_time,
      notes,
    } = req.body || {};

    if (!volunteer_name || !category || !date_served) {
      return res.status(400).json({
        message: "Name, category, and date are required.",
      });
    }

    const normalizedDate = normalizeDate(date_served);
    if (!normalizedDate) {
      return res.status(400).json({
        message: "Invalid date.",
      });
    }

    const start = normalizeTime(start_time);
    const end = normalizeTime(end_time);

    const total_hours = calculateHours(start, end);
    if (!total_hours) {
      return res.status(400).json({
        message: "Invalid time range.",
      });
    }

    await pool.query(
      `
      INSERT INTO tbl_volunteer_hours (
        volunteer_name,
        email,
        category,
        date_served,
        start_time,
        end_time,
        total_hours,
        notes,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        volunteer_name.trim(),
        email || null,
        category.trim(),
        normalizedDate,
        start,
        end,
        total_hours,
        notes || null,
      ]
    );

    res.json({
      message: "Hours submitted successfully",
      total_hours,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to submit hours" });
  }
});

module.exports = router;