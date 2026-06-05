//backend\routes\accountProfile.js
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const pool = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

const uploadsDir = path.join(__dirname, "..", "uploads", "profiles");
fs.mkdirSync(uploadsDir, { recursive: true });

function clean(value, max = 255) {
  return String(value || "").trim().slice(0, max);
}

function nullable(value, max = 255) {
  const s = clean(value, max);
  return s || null;
}

function toIntOrNull(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function isValidName(value) {
  return /^[A-Za-z][A-Za-z\s'-]{0,99}$/.test(clean(value));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
}

function isValidPhone(value) {
  if (!clean(value)) return true;
  return /^[0-9+\-().\s]{7,25}$/.test(clean(value));
}

function isValidCustomLocationName(value, max = 100) {
  if (!clean(value)) return true;
  const pattern = new RegExp(`^[A-Za-z][A-Za-z\\s.'-]{0,${max - 1}}$`);
  return pattern.test(clean(value));
}

function isValidZip(value) {
  if (!clean(value)) return true;
  return /^[A-Za-z0-9 -]{3,20}$/.test(clean(value));
}

function validateProfileInput(payload, hasMemberProfile) {
  const errors = {};

  if (!payload.first_name) {
    errors.first_name = "First name is required.";
  } else if (!isValidName(payload.first_name)) {
    errors.first_name =
      "First name must contain letters only. Spaces, apostrophes, and hyphens are allowed.";
  }

  if (!payload.last_name) {
    errors.last_name = "Last name is required.";
  } else if (!isValidName(payload.last_name)) {
    errors.last_name =
      "Last name must contain letters only. Spaces, apostrophes, and hyphens are allowed.";
  }

  if (!payload.email) {
    errors.email = "Email is required.";
  } else if (!isValidEmail(payload.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (payload.phone && !isValidPhone(payload.phone)) {
    errors.phone = "Enter a valid phone number.";
  }

  if (hasMemberProfile) {
    if (payload.city && !isValidCustomLocationName(payload.city, 100)) {
      errors.city = "City must contain letters only.";
    }

    if (payload.state && !isValidCustomLocationName(payload.state, 80)) {
      errors.state = "State must contain letters only.";
    }

    if (payload.zip && !isValidZip(payload.zip)) {
      errors.zip = "ZIP / postal code format is invalid.";
    }
  }

  return errors;
}

function buildPublicProfileUrl(filename) {
  return `/uploads/profiles/${filename}`;
}

function buildAbsoluteUrl(req, urlPath) {
  if (!urlPath) return "";
  if (/^https?:\/\//i.test(urlPath)) return urlPath;
  const origin = `${req.protocol}://${req.get("host")}`;
  return `${origin}${urlPath.startsWith("/") ? "" : "/"}${urlPath}`;
}

function removeLocalFileByUrl(fileUrl) {
  if (!fileUrl) return;
  const normalized = String(fileUrl).replace(/\\/g, "/");
  const marker = "/uploads/profiles/";
  const idx = normalized.indexOf(marker);
  if (idx === -1) return;

  const filename = normalized.slice(idx + marker.length);
  if (!filename) return;

  const filePath = path.join(uploadsDir, filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error("Failed to remove old profile photo:", err);
    }
  }
}

function shapeRowForClient(req, row) {
  if (!row) return null;
  return {
    ...row,
    profile_photo_url: row.profile_photo_url
      ? buildAbsoluteUrl(req, row.profile_photo_url)
      : "",
  };
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
    cb(null, `profile-${req.user.id}-${Date.now()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, and WEBP images are allowed."));
    }
    cb(null, true);
  },
});

async function loadAccountProfile(userId) {
  const [rows] = await pool.query(
    `
    SELECT
      u.id,
      u.member_id,
      u.username,
      u.first_name,
      u.last_name,
      u.full_name,
      u.email,
      u.phone,
      u.role,
      u.is_active,
      u.must_change_password,
      u.created_at,
      u.updated_at,
      u.profile_photo_url,
      u.profile_photo_name,
      u.profile_photo_size,
      m.member_no,
      m.address_line1,
      m.address_line2,
      m.city,
      m.state,
      m.zip,
      m.status,
      m.membership_status,
      m.next_due_at,
      COALESCE(dep.total_dependents, 0) AS total_dependents,
      CASE
        WHEN u.member_id IS NULL THEN 1
        ELSE 1 + COALESCE(dep.total_dependents, 0)
      END AS total_members
    FROM tbl_users u
    LEFT JOIN tbl_members m
      ON m.id = u.member_id
    LEFT JOIN (
      SELECT
        member_id,
        SUM(CASE WHEN is_active = 1 AND status = 'active' THEN 1 ELSE 0 END) AS total_dependents
      FROM tbl_member_dependents
      GROUP BY member_id
    ) dep
      ON dep.member_id = u.member_id
    WHERE u.id = ?
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

router.get("/me", authRequired, async (req, res) => {
  try {
    const row = await loadAccountProfile(req.user.id);

    if (!row) {
      return res.status(404).json({ error: "Profile not found." });
    }

    return res.json({
      ok: true,
      user: shapeRowForClient(req, row),
    });
  } catch (err) {
    console.error("GET /account/me error:", err);
    return res.status(500).json({ error: "Failed to load profile." });
  }
});

router.put("/me", authRequired, async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const userId = req.user.id;

    const [[existingUser]] = await conn.query(
      `
      SELECT
        u.id,
        u.member_id,
        u.username,
        u.email,
        u.profile_photo_url,
        m.id AS member_db_id
      FROM tbl_users u
      LEFT JOIN tbl_members m
        ON m.id = u.member_id
      WHERE u.id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (!existingUser) {
      return res.status(404).json({ error: "Profile not found." });
    }

    const hasMemberProfile = !!existingUser.member_id;

    const payload = {
      first_name: clean(req.body.first_name, 100),
      last_name: clean(req.body.last_name, 100),
      email: clean(req.body.email, 190).toLowerCase(),
      phone: nullable(req.body.phone, 40),
      address_line1: nullable(req.body.address_line1, 200),
      address_line2: nullable(req.body.address_line2, 200),
      city: nullable(req.body.city, 100),
      state: nullable(req.body.state, 80),
      zip: nullable(req.body.zip, 20),
      profile_photo_url: nullable(req.body.profile_photo_url, 255),
      profile_photo_name: nullable(req.body.profile_photo_name, 255),
      profile_photo_size: toIntOrNull(req.body.profile_photo_size),
      clear_photo:
        req.body.clear_photo === true ||
        req.body.clear_photo === 1 ||
        req.body.clear_photo === "1",
    };

    const errors = validateProfileInput(payload, hasMemberProfile);
    if (Object.keys(errors).length) {
      return res.status(400).json({
        error: "Validation failed.",
        errors,
      });
    }

    const fullName = `${payload.first_name} ${payload.last_name}`.trim();

    const [[emailConflictUser]] = await conn.query(
      `
      SELECT id
      FROM tbl_users
      WHERE LOWER(email) = LOWER(?)
        AND id <> ?
      LIMIT 1
      `,
      [payload.email, userId]
    );

    if (emailConflictUser) {
      return res.status(409).json({
        error: "That email address is already used by another user account.",
      });
    }

    if (hasMemberProfile) {
      const [[emailConflictMember]] = await conn.query(
        `
        SELECT id
        FROM tbl_members
        WHERE LOWER(email) = LOWER(?)
          AND id <> ?
        LIMIT 1
        `,
        [payload.email, existingUser.member_id]
      );

      if (emailConflictMember) {
        return res.status(409).json({
          error: "That email address is already used by another member profile.",
        });
      }
    }

    await conn.beginTransaction();

    const nextPhotoUrl = payload.clear_photo ? null : payload.profile_photo_url;
    const nextPhotoName = payload.clear_photo ? null : payload.profile_photo_name;
    const nextPhotoSize = payload.clear_photo ? null : payload.profile_photo_size;

    await conn.query(
      `
      UPDATE tbl_users
      SET
        first_name = ?,
        last_name = ?,
        full_name = ?,
        email = ?,
        phone = ?,
        profile_photo_url = ?,
        profile_photo_name = ?,
        profile_photo_size = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        payload.first_name,
        payload.last_name,
        fullName,
        payload.email,
        payload.phone,
        nextPhotoUrl,
        nextPhotoName,
        nextPhotoSize,
        userId,
      ]
    );

    if (hasMemberProfile) {
      await conn.query(
        `
        UPDATE tbl_members
        SET
          first_name = ?,
          last_name = ?,
          full_name = ?,
          email = ?,
          phone = ?,
          address_line1 = ?,
          address_line2 = ?,
          city = ?,
          state = ?,
          zip = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          payload.first_name,
          payload.last_name,
          fullName,
          payload.email,
          payload.phone,
          payload.address_line1,
          payload.address_line2,
          payload.city,
          payload.state,
          payload.zip,
          existingUser.member_id,
        ]
      );
    }

    await conn.commit();

    if (payload.clear_photo && existingUser.profile_photo_url) {
      removeLocalFileByUrl(existingUser.profile_photo_url);
    }

    const row = await loadAccountProfile(userId);

    return res.json({
      ok: true,
      message: "Profile updated successfully.",
      user: shapeRowForClient(req, row),
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}

    console.error("PUT /account/me error:", err);

    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: "That email address is already used by another account.",
      });
    }

    return res.status(500).json({ error: "Failed to update profile." });
  } finally {
    conn.release();
  }
});

router.post(
  "/me/photo",
  authRequired,
  (req, res, next) => {
    upload.single("photo")(req, res, function onUpload(err) {
      if (err) {
        return res.status(400).json({
          error: err.message || "Profile photo upload failed.",
        });
      }
      next();
    });
  },
  async (req, res) => {
    const conn = await pool.getConnection();

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No photo file was uploaded." });
      }

      const userId = req.user.id;

      const [[existingUser]] = await conn.query(
        `
        SELECT id, profile_photo_url
        FROM tbl_users
        WHERE id = ?
        LIMIT 1
        `,
        [userId]
      );

      if (!existingUser) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {}
        return res.status(404).json({ error: "Profile not found." });
      }

      const publicUrl = buildPublicProfileUrl(req.file.filename);

      await conn.query(
        `
        UPDATE tbl_users
        SET
          profile_photo_url = ?,
          profile_photo_name = ?,
          profile_photo_size = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [publicUrl, req.file.originalname, req.file.size, userId]
      );

      if (existingUser.profile_photo_url) {
        removeLocalFileByUrl(existingUser.profile_photo_url);
      }

      const row = await loadAccountProfile(userId);

      return res.json({
        ok: true,
        message: "Profile photo uploaded successfully.",
        user: shapeRowForClient(req, row),
      });
    } catch (err) {
      console.error("POST /account/me/photo error:", err);
      return res.status(500).json({ error: "Failed to upload profile photo." });
    } finally {
      conn.release();
    }
  }
);

router.delete("/me/photo", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    const [[existingUser]] = await pool.query(
      `
      SELECT id, profile_photo_url
      FROM tbl_users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (!existingUser) {
      return res.status(404).json({ error: "Profile not found." });
    }

    await pool.query(
      `
      UPDATE tbl_users
      SET
        profile_photo_url = NULL,
        profile_photo_name = NULL,
        profile_photo_size = NULL,
        updated_at = NOW()
      WHERE id = ?
      `,
      [userId]
    );

    if (existingUser.profile_photo_url) {
      removeLocalFileByUrl(existingUser.profile_photo_url);
    }

    const row = await loadAccountProfile(userId);

    return res.json({
      ok: true,
      message: "Profile photo removed successfully.",
      user: shapeRowForClient(req, row),
    });
  } catch (err) {
    console.error("DELETE /account/me/photo error:", err);
    return res.status(500).json({ error: "Failed to remove profile photo." });
  }
});

module.exports = router;