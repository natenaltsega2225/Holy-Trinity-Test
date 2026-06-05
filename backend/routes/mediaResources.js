

//backend\routes\mediaResources.js
"use strict";

const express = require("express");
const pool = require("../db");
const upload = require("../middleware/uploadMedia");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

function toPublicUrl(req, subPath, filename) {
  if (!filename) return null;
  return `${req.protocol}://${req.get("host")}/uploads/${subPath}/${filename}`;
}

async function safeForeignUserId(userId) {
  if (!userId) return null;

  const numericId = Number(userId);
  if (!Number.isFinite(numericId)) return null;

  const [rows] = await pool.query(
    `SELECT id FROM tbl_users WHERE id = ? LIMIT 1`,
    [numericId]
  );

  return rows.length ? numericId : null;
}

/* =========================================================
   PUBLIC: RESOURCES
========================================================= */

router.get("/resources", async (req, res, next) => {
  try {
    const { category = "", search = "", page = 1, pageSize = 8 } = req.query;
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(50, Math.max(1, Number(pageSize) || 8));
    const offset = (p - 1) * ps;

    const where = ["is_published = 1"];
    const params = [];

    if (category && category !== "All") {
      where.push("category = ?");
      params.push(category);
    }

    if (search) {
      where.push("(title LIKE ? OR description LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereSql = where.join(" AND ");

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM tbl_resources WHERE ${whereSql}`,
      params
    );

    const [rows] = await pool.query(
      `
      SELECT
        id,
        title,
        description,
        category,
        file_url,
        thumbnail_url,
        original_filename,
        mime_type,
        file_size_bytes,
        is_published,
        uploaded_by,
        created_at,
        updated_at
      FROM tbl_resources
      WHERE ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, ps, offset]
    );

    res.json({
      rows,
      total: countRows[0]?.total || 0,
      totalPages: Math.max(1, Math.ceil((countRows[0]?.total || 0) / ps)),
      page: p,
      pageSize: ps,
    });
  } catch (err) {
    console.error("GET /resources error:", err);
    next(err);
  }
});

/* =========================================================
   PUBLIC: GALLERY
========================================================= */

router.get("/gallery/albums", async (_req, res, next) => {
  try {
    const [albums] = await pool.query(
      `
      SELECT
        a.id,
        a.title,
        a.description,
        a.cover_image_url,
        (
          SELECT COUNT(*)
          FROM tbl_media_photos p
          WHERE p.album_id = a.id AND p.is_published = 1
        ) AS photo_count
      FROM tbl_media_albums a
      WHERE a.is_published = 1
      ORDER BY a.created_at DESC
      `
    );

    res.json({ rows: albums });
  } catch (err) {
    console.error("GET /gallery/albums error:", err);
    next(err);
  }
});

router.get("/gallery/albums/:id/photos", async (req, res, next) => {
  try {
    const [albumRows] = await pool.query(
      `
      SELECT id, title, description, cover_image_url
      FROM tbl_media_albums
      WHERE id = ? AND is_published = 1
      `,
      [req.params.id]
    );

    if (!albumRows.length) {
      return res.status(404).json({ error: "Album not found" });
    }

    const [photos] = await pool.query(
      `
      SELECT id, image_url, caption, sort_order
      FROM tbl_media_photos
      WHERE album_id = ? AND is_published = 1
      ORDER BY sort_order ASC, id ASC
      `,
      [req.params.id]
    );

    res.json({
      album: albumRows[0],
      photos,
    });
  } catch (err) {
    console.error("GET /gallery/albums/:id/photos error:", err);
    next(err);
  }
});

/* =========================================================
   ADMIN: RESOURCES CRUD
========================================================= */

router.get(
  "/admin/resources",
  authRequired,
  requireRole("admin"),
  async (_req, res, next) => {
    try {
      const [rows] = await pool.query(
        `
        SELECT
          r.*,
          CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS uploaded_by_name
        FROM tbl_resources r
        LEFT JOIN tbl_users u ON u.id = r.uploaded_by
        ORDER BY r.created_at DESC
        `
      );
      res.json({ rows });
    } catch (err) {
      console.error("GET /admin/resources error:", err);
      next(err);
    }
  }
);

router.post(
  "/admin/resources",
  authRequired,
  requireRole("admin"),
  upload.fields([{ name: "pdf_file", maxCount: 1 }]),
  async (req, res, next) => {
    try {
      const { title, description, category, is_published } = req.body;

      if (!title || !category) {
        return res.status(400).json({ error: "title and category are required" });
      }

      const pdf = req.files?.pdf_file?.[0];
      if (!pdf) {
        return res.status(400).json({ error: "PDF file is required" });
      }

      const fileUrl = toPublicUrl(req, "resources", pdf.filename);
      const uploadedBy = await safeForeignUserId(req.user?.id);

      const [result] = await pool.query(
        `
        INSERT INTO tbl_resources
          (
            title,
            description,
            category,
            file_url,
            thumbnail_url,
            original_filename,
            mime_type,
            file_size_bytes,
            is_published,
            uploaded_by
          )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          title,
          description || null,
          category,
          fileUrl,
          null,
          pdf.originalname || null,
          pdf.mimetype || null,
          pdf.size || null,
          Number(is_published ?? 1) ? 1 : 0,
          uploadedBy,
        ]
      );

      res.status(201).json({
        id: result.insertId,
        file_url: fileUrl,
        thumbnail_url: null,
      });
    } catch (err) {
      console.error("POST /admin/resources error:", err);
      next(err);
    }
  }
);

router.put(
  "/admin/resources/:id",
  authRequired,
  requireRole("admin"),
  upload.fields([{ name: "pdf_file", maxCount: 1 }]),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      const [existingRows] = await pool.query(
        `SELECT * FROM tbl_resources WHERE id = ?`,
        [id]
      );

      if (!existingRows.length) {
        return res.status(404).json({ error: "Resource not found" });
      }

      const existing = existingRows[0];
      const pdf = req.files?.pdf_file?.[0];
      const fileUrl = pdf ? toPublicUrl(req, "resources", pdf.filename) : existing.file_url;

      await pool.query(
        `
        UPDATE tbl_resources
        SET
          title = ?,
          description = ?,
          category = ?,
          file_url = ?,
          original_filename = ?,
          mime_type = ?,
          file_size_bytes = ?,
          is_published = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          req.body.title || existing.title,
          req.body.description ?? existing.description,
          req.body.category || existing.category,
          fileUrl,
          pdf ? pdf.originalname : existing.original_filename,
          pdf ? pdf.mimetype : existing.mime_type,
          pdf ? pdf.size : existing.file_size_bytes,
          Number(req.body.is_published ?? existing.is_published) ? 1 : 0,
          id,
        ]
      );

      res.json({ ok: true });
    } catch (err) {
      console.error("PUT /admin/resources/:id error:", err);
      next(err);
    }
  }
);

router.delete(
  "/admin/resources/:id",
  authRequired,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      await pool.query(`DELETE FROM tbl_resources WHERE id = ?`, [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      console.error("DELETE /admin/resources/:id error:", err);
      next(err);
    }
  }
);

/* =========================================================
   ADMIN: ALBUMS CRUD
========================================================= */

router.get(
  "/admin/gallery/albums",
  authRequired,
  requireRole("admin"),
  async (_req, res, next) => {
    try {
      const [rows] = await pool.query(
        `
        SELECT
          a.*,
          (
            SELECT COUNT(*)
            FROM tbl_media_photos p
            WHERE p.album_id = a.id
          ) AS photo_count
        FROM tbl_media_albums a
        ORDER BY a.created_at DESC
        `
      );
      res.json({ rows });
    } catch (err) {
      console.error("GET /admin/gallery/albums error:", err);
      next(err);
    }
  }
);

router.post(
  "/admin/gallery/albums",
  authRequired,
  requireRole("admin"),
  upload.single("cover_image"),
  async (req, res, next) => {
    try {
      const { title, description, is_published } = req.body;

      if (!title) {
        return res.status(400).json({ error: "title is required" });
      }

      const coverUrl = req.file ? toPublicUrl(req, "gallery", req.file.filename) : null;
      const createdBy = await safeForeignUserId(req.user?.id);

      const [result] = await pool.query(
        `
        INSERT INTO tbl_media_albums
          (title, description, cover_image_url, is_published, created_by)
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          title,
          description || null,
          coverUrl,
          Number(is_published ?? 1) ? 1 : 0,
          createdBy,
        ]
      );

      res.status(201).json({
        id: result.insertId,
        cover_image_url: coverUrl,
      });
    } catch (err) {
      console.error("POST /admin/gallery/albums error:", err);
      next(err);
    }
  }
);

router.put(
  "/admin/gallery/albums/:id",
  authRequired,
  requireRole("admin"),
  upload.single("cover_image"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const [rows] = await pool.query(
        `SELECT * FROM tbl_media_albums WHERE id = ?`,
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({ error: "Album not found" });
      }

      const old = rows[0];
      const coverUrl = req.file ? toPublicUrl(req, "gallery", req.file.filename) : old.cover_image_url;

      await pool.query(
        `
        UPDATE tbl_media_albums
        SET
          title = ?,
          description = ?,
          cover_image_url = ?,
          is_published = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          req.body.title || old.title,
          req.body.description ?? old.description,
          coverUrl,
          Number(req.body.is_published ?? old.is_published) ? 1 : 0,
          id,
        ]
      );

      res.json({ ok: true });
    } catch (err) {
      console.error("PUT /admin/gallery/albums/:id error:", err);
      next(err);
    }
  }
);

router.delete(
  "/admin/gallery/albums/:id",
  authRequired,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      await pool.query(`DELETE FROM tbl_media_albums WHERE id = ?`, [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      console.error("DELETE /admin/gallery/albums/:id error:", err);
      next(err);
    }
  }
);

/* =========================================================
   ADMIN: PHOTOS CRUD
========================================================= */

router.get(
  "/admin/gallery/albums/:id/photos",
  authRequired,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const [rows] = await pool.query(
        `
        SELECT id, album_id, image_url, caption, sort_order, is_published, created_at
        FROM tbl_media_photos
        WHERE album_id = ?
        ORDER BY sort_order ASC, id ASC
        `,
        [req.params.id]
      );
      res.json({ rows });
    } catch (err) {
      console.error("GET /admin/gallery/albums/:id/photos error:", err);
      next(err);
    }
  }
);

router.post(
  "/admin/gallery/albums/:id/photos",
  authRequired,
  requireRole("admin"),
  upload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Image is required" });
      }

      const [albumRows] = await pool.query(
        `SELECT id FROM tbl_media_albums WHERE id = ? LIMIT 1`,
        [req.params.id]
      );

      if (!albumRows.length) {
        return res.status(404).json({ error: "Album not found" });
      }

      const imageUrl = toPublicUrl(req, "gallery", req.file.filename);

      const [result] = await pool.query(
        `
        INSERT INTO tbl_media_photos
          (album_id, image_url, caption, sort_order, is_published)
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          req.params.id,
          imageUrl,
          req.body.caption || null,
          Number(req.body.sort_order || 0),
          Number(req.body.is_published ?? 1) ? 1 : 0,
        ]
      );

      res.status(201).json({ id: result.insertId, image_url: imageUrl });
    } catch (err) {
      console.error("POST /admin/gallery/albums/:id/photos error:", err);
      next(err);
    }
  }
);

router.put(
  "/admin/gallery/photos/:photoId",
  authRequired,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { caption, sort_order, is_published } = req.body;

      await pool.query(
        `
        UPDATE tbl_media_photos
        SET
          caption = ?,
          sort_order = ?,
          is_published = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          caption || null,
          Number(sort_order || 0),
          Number(is_published ?? 1) ? 1 : 0,
          req.params.photoId,
        ]
      );

      res.json({ ok: true });
    } catch (err) {
      console.error("PUT /admin/gallery/photos/:photoId error:", err);
      next(err);
    }
  }
);

router.delete(
  "/admin/gallery/photos/:photoId",
  authRequired,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      await pool.query(`DELETE FROM tbl_media_photos WHERE id = ?`, [req.params.photoId]);
      res.json({ ok: true });
    } catch (err) {
      console.error("DELETE /admin/gallery/photos/:photoId error:", err);
      next(err);
    }
  }
);

module.exports = router;