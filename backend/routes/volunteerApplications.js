"use strict";

const express = require("express");
const pool = require("../db");

const router = express.Router();

function text(value) {
  return String(value ?? "").trim();
}

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(v));
}

function validPhone(v) {
  const digits = String(v ?? "").replace(/\D/g, "");
  return /^\d{7,11}$/.test(digits);
}

router.post("/", async (req, res) => {
  try {
    const {
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
      additional_notes,
    } = req.body || {};

    if (!text(full_name)) {
      return res.status(400).json({ message: "Full name is required." });
    }

    if (!validEmail(email)) {
      return res.status(400).json({ message: "Valid email is required." });
    }

    if (!validPhone(phone)) {
      return res.status(400).json({ message: "Valid phone number is required." });
    }

    if (!text(category)) {
      return res.status(400).json({ message: "Category is required." });
    }

    if (!text(role)) {
      return res.status(400).json({ message: "Role is required." });
    }

    const [result] = await pool.query(
      `
      INSERT INTO tbl_volunteer_applications (
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
        additional_notes,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', NOW(), NOW())
      `,
      [
        text(full_name),
        text(email),
        text(phone),
        text(category),
        text(role),
        text(activity_title) || null,
        text(activity_date) || null,
        text(activity_start_time) || null,
        text(activity_end_time) || null,
        text(activity_location) || null,
        text(additional_notes) || null,
      ]
    );

    return res.status(201).json({
      message: "Volunteer application submitted successfully.",
      id: result.insertId,
    });
  } catch (error) {
    console.error("POST volunteer applications error:", error);
    return res.status(500).json({
      message: "Failed to submit volunteer application.",
    });
  }
});

module.exports = router;