"use strict";

const express = require("express");
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

/* ======================================================
   GET ALL SERVE POSTS (ADMIN)
====================================================== */
router.get(
  "/",
  authRequired,
  requireRole("admin"),
  async (req, res) => {
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
        ORDER BY created_at DESC
      `);

      return res.json({
        ok: true,
        rows,
      });
    } catch (err) {
      console.error("GET serve posts error:", err);

      return res.status(500).json({
        ok: false,
        error: "Failed to load serve posts.",
      });
    }
  }
);

/* ======================================================
   GET SINGLE SERVE POST
====================================================== */
router.get(
  "/:id",
  authRequired,
  requireRole("admin"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({
          ok: false,
          error: "Invalid serve post id.",
        });
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
        LIMIT 1
        `,
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({
          ok: false,
          error: "Serve post not found.",
        });
      }

      return res.json({
        ok: true,
        row: rows[0],
      });
    } catch (err) {
      console.error("GET serve post error:", err);

      return res.status(500).json({
        ok: false,
        error: "Failed to load serve post.",
      });
    }
  }
);

/* ======================================================
   CREATE SERVE POST
====================================================== */
router.post(
  "/",
  authRequired,
  requireRole("admin"),
  async (req, res) => {
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
      } = req.body;

      const [result] = await pool.query(
        `
        INSERT INTO tbl_serve_posts
        (
          category,
          title,
          description,
          activity_date,
          start_time,
          end_time,
          location,
          notes,
          is_published
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          category,
          title,
          description,
          activity_date,
          start_time,
          end_time,
          location,
          notes || null,
          is_published ? 1 : 0,
        ]
      );

      return res.json({
        ok: true,
        id: result.insertId,
        message: "Serve post created successfully.",
      });
    } catch (err) {
      console.error("CREATE serve post error:", err);

      return res.status(500).json({
        ok: false,
        error: "Failed to create serve post.",
      });
    }
  }
);

/* ======================================================
   UPDATE SERVE POST
====================================================== */
router.patch(
  "/:id",
  authRequired,
  requireRole("admin"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({
          ok: false,
          error: "Invalid serve post id.",
        });
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
      } = req.body;

      await pool.query(
        `
        UPDATE tbl_serve_posts
        SET
          category = ?,
          title = ?,
          description = ?,
          activity_date = ?,
          start_time = ?,
          end_time = ?,
          location = ?,
          notes = ?,
          is_published = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          category,
          title,
          description,
          activity_date,
          start_time,
          end_time,
          location,
          notes || null,
          is_published ? 1 : 0,
          id,
        ]
      );

      return res.json({
        ok: true,
        message: "Serve post updated successfully.",
      });
    } catch (err) {
      console.error("UPDATE serve post error:", err);

      return res.status(500).json({
        ok: false,
        error: "Failed to update serve post.",
      });
    }
  }
);

/* ======================================================
   DELETE SERVE POST
====================================================== */
router.delete(
  "/:id",
  authRequired,
  requireRole("admin"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({
          ok: false,
          error: "Invalid serve post id.",
        });
      }

      await pool.query(
        `
        DELETE FROM tbl_serve_posts
        WHERE id = ?
        `,
        [id]
      );

      return res.json({
        ok: true,
        message: "Serve post deleted successfully.",
      });
    } catch (err) {
      console.error("DELETE serve post error:", err);

      return res.status(500).json({
        ok: false,
        error: "Failed to delete serve post.",
      });
    }
  }
);

module.exports = router;