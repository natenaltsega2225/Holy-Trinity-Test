
// //  // routes/newsEvents.js


"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const router = express.Router();
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");

const TABLE = "tbl_news_events";
const ALLOWED_CATEGORIES = ["holiday", "trip", "kids", "news"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MIME_WHITELIST = ["image/jpeg", "image/png", "image/webp"];

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "news-events");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = IMAGE_EXTENSIONS.includes(ext) ? ext : ".jpg";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (MIME_WHITELIST.includes(file.mimetype) && IMAGE_EXTENSIONS.includes(ext)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only jpg, jpeg, png, and webp image files are allowed."));
  },
});

const SELECT_FIELDS = `
  id,
  category,
  title,
  subtitle,
  summary,
  body_html,
  start_date,
  end_date,
  time_text,
  location,
  audience,
  flyer_url,
  pdf_url,
  pdf_title,
  holiday_color,
  is_published,
  related_program_id,
  registration_enabled,
  price_per_person,
  capacity,
  registration_notes,
  created_at,
  updated_at
`;

function safeTrim(value) {
  return String(value ?? "").trim();
}

function normalizeDate(value) {
  const v = safeTrim(value);
  if (!v) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function normalizePublished(value) {
  if (value === "0" || value === 0 || value === false || value === "false") return 0;
  return 1;
}

function normalizeBool(value) {
  if (value === "1" || value === 1 || value === true || value === "true") return 1;
  return 0;
}

function normalizeMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Number(n.toFixed(2));
}

function normalizeCapacity(value) {
  if (value === undefined || value === null || safeTrim(value) === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function normalizeRow(row) {
  if (!row) return row;

  return {
    ...row,
    start_date: row.start_date ? new Date(row.start_date).toISOString().slice(0, 10) : null,
    end_date: row.end_date ? new Date(row.end_date).toISOString().slice(0, 10) : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    registration_enabled: Number(row.registration_enabled || 0),
    price_per_person: Number(row.price_per_person || 0),
    capacity: row.capacity === null || row.capacity === undefined ? null : Number(row.capacity),
  };
}

function isValidHexColor(value) {
  const v = safeTrim(value);
  if (!v) return true;
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
}

function isValidImageUrl(value) {
  const v = safeTrim(value);
  if (!v) return true;
  const lower = v.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.includes(ext));
}

function validateDateOrder(startDate, endDate) {
  if (!startDate || !endDate) return "";
  if (endDate < startDate) return "End date cannot be earlier than start date.";
  return "";
}

function validateLength(label, value, maxLength) {
  if (safeTrim(value).length > maxLength) return `${label} is too long.`;
  return "";
}

function buildAbsoluteUploadUrl(req, fileName) {
  return `${req.protocol}://${req.get("host")}/uploads/news-events/${fileName}`;
}

function getRelativeUploadPathFromUrl(urlValue) {
  const value = safeTrim(urlValue);
  if (!value) return null;

  try {
    const maybeUrl = new URL(value);
    const pathname = maybeUrl.pathname || "";
    if (pathname.startsWith("/uploads/news-events/")) {
      return path.join(__dirname, "..", pathname);
    }
    return null;
  } catch {
    if (value.startsWith("/uploads/news-events/")) {
      return path.join(__dirname, "..", value);
    }
    return null;
  }
}

function removeUploadedFileIfExists(urlValue) {
  const filePath = getRelativeUploadPathFromUrl(urlValue);
  if (!filePath) return;

  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (error) {
    console.error("failed to remove uploaded file:", error);
  }
}

function validatePayload(body, uploadedFilePresent = false) {
  const category = safeTrim(body.category || "news");
  const title = safeTrim(body.title);
  const subtitle = safeTrim(body.subtitle);
  const summary = safeTrim(body.summary);
  const timeText = safeTrim(body.time_text);
  const location = safeTrim(body.location);
  const audience = safeTrim(body.audience);
  const flyerUrl = safeTrim(body.flyer_url);
  const holidayColor = safeTrim(body.holiday_color);

  const startDate = normalizeDate(body.start_date);
  const endDate = normalizeDate(body.end_date);
  const isProgram = category === "trip" || category === "kids";
  const registrationEnabled = normalizeBool(body.registration_enabled);
  const pricePerPerson = normalizeMoney(body.price_per_person);
  const capacityRaw = safeTrim(body.capacity);
  const capacity = capacityRaw ? Number(capacityRaw) : null;

  if (!ALLOWED_CATEGORIES.includes(category)) {
    return "Invalid category. Allowed categories are holiday, trip, kids, and news.";
  }

  if (!title) return "Title is required.";
  if (body.start_date && !startDate) return "Start date must be in YYYY-MM-DD format.";
  if (body.end_date && !endDate) return "End date must be in YYYY-MM-DD format.";

  const dateOrderError = validateDateOrder(startDate, endDate);
  if (dateOrderError) return dateOrderError;

  if (isProgram && !startDate) {
    return `${category === "trip" ? "Trip" : "Kids program"} requires a start date.`;
  }

  if (isProgram && !location) {
    return `${category === "trip" ? "Trip" : "Kids program"} requires a location.`;
  }

  if (isProgram && registrationEnabled) {
    if (!Number.isFinite(pricePerPerson) || pricePerPerson <= 0) {
      return "Price per person must be greater than 0 when registration is enabled.";
    }

    if (capacityRaw && (!Number.isInteger(capacity) || capacity <= 0)) {
      return "Capacity must be a positive whole number.";
    }
  }

  if (category === "holiday" && !startDate) return "Holiday requires a start date.";

  if (category === "holiday" && !isValidHexColor(holidayColor)) {
    return "Holiday color must be a valid hex color like #4A75E6.";
  }

  if (!uploadedFilePresent && !isValidImageUrl(flyerUrl)) {
    return "Flyer URL must point to a jpg, jpeg, png, or webp image.";
  }

  return (
    validateLength("Title", title, 200) ||
    validateLength("Subtitle", subtitle, 255) ||
    validateLength("Time text", timeText, 120) ||
    validateLength("Location", location, 200) ||
    validateLength("Audience", audience, 255) ||
    validateLength("Flyer URL", flyerUrl, 500) ||
    validateLength("Holiday color", holidayColor, 20) ||
    validateLength("Summary", summary, 20000)
  );
}

function buildWhere(query, forcePublished = false) {
  const conditions = [];
  const params = [];

  const category = safeTrim(query.category);
  if (category && category !== "all") {
    conditions.push("category = ?");
    params.push(category);
  }

  if (forcePublished || query.published === "1" || query.published === 1) {
    conditions.push("is_published = 1");
  }

  const search = safeTrim(query.search || query.q);
  if (search) {
    const like = `%${search}%`;
    conditions.push(`
      (
        title LIKE ?
        OR subtitle LIKE ?
        OR summary LIKE ?
        OR body_html LIKE ?
        OR location LIKE ?
        OR audience LIKE ?
        OR time_text LIKE ?
      )
    `);
    params.push(like, like, like, like, like, like, like);
  }

  return {
    whereSql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

function getPaging(query) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 10)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function buildPayload(body, req, uploadedFileName = "") {
  const nextFlyerUrl = uploadedFileName
    ? buildAbsoluteUploadUrl(req, uploadedFileName)
    : safeTrim(body.flyer_url) || null;

  const category = safeTrim(body.category || "news");
  const isProgram = category === "kids" || category === "trip";

  return {
    category,
    title: safeTrim(body.title),
    subtitle: safeTrim(body.subtitle) || null,
    summary: safeTrim(body.summary) || null,
    body_html: safeTrim(body.body_html) || null,
    start_date: normalizeDate(body.start_date),
    end_date: normalizeDate(body.end_date),
    time_text: safeTrim(body.time_text) || null,
    location: safeTrim(body.location) || null,
    audience: safeTrim(body.audience) || null,
    flyer_url: nextFlyerUrl,
    holiday_color: safeTrim(body.holiday_color) || null,
    is_published: normalizePublished(body.is_published),

    registration_enabled: isProgram ? normalizeBool(body.registration_enabled) : 0,
    price_per_person: isProgram ? normalizeMoney(body.price_per_person) : 0,
    capacity: isProgram ? normalizeCapacity(body.capacity) : null,
    registration_notes: isProgram ? safeTrim(body.registration_notes) || null : null,
  };
}

function uploadMiddleware(req, res, next) {
  upload.single("flyer_image")(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        ok: false,
        error: error.message || "Image upload failed.",
      });
    }
    next();
  });
}

/**
 * ADMIN LIST
 * IMPORTANT: this must be BEFORE router.get("/:id")
 */
router.get("/admin/list", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { page, limit, offset } = getPaging(req.query);
    const { whereSql, params } = buildWhere(req.query, false);

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM ${TABLE} ${whereSql}`,
      params
    );

    const [rows] = await pool.query(
      `
      SELECT ${SELECT_FIELDS}
      FROM ${TABLE}
      ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return res.json({
      ok: true,
      rows: rows.map(normalizeRow),
      items: rows.map(normalizeRow),
      page,
      limit,
      total: Number(countRow?.total || 0),
      totalPages: Math.max(1, Math.ceil(Number(countRow?.total || 0) / limit)),
    });
  } catch (error) {
    console.error("news events admin list error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to load admin items.",
      details: error.message,
    });
  }
});

/**
 * PUBLIC LIST
 */
router.get("/", async (req, res) => {
  try {
    const { page, limit, offset } = getPaging(req.query);
    const { whereSql, params } = buildWhere(req.query, false);

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM ${TABLE} ${whereSql}`,
      params
    );

    const [rows] = await pool.query(
      `
      SELECT ${SELECT_FIELDS}
      FROM ${TABLE}
      ${whereSql}
      ORDER BY
        CASE WHEN start_date IS NULL THEN 1 ELSE 0 END,
        start_date DESC,
        created_at DESC,
        id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return res.json({
      ok: true,
      rows: rows.map(normalizeRow),
      items: rows.map(normalizeRow),
      page,
      limit,
      total: Number(countRow?.total || 0),
      totalPages: Math.max(1, Math.ceil(Number(countRow?.total || 0) / limit)),
    });
  } catch (error) {
    console.error("news events public list error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to load news and events.",
      details: error.message,
    });
  }
});

/**
 * PUBLIC DETAIL
 * IMPORTANT: this must be AFTER /admin/list
 */
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid id." });

    const publishedOnly = req.query.published === "1" || req.query.published === 1;

    const [rows] = await pool.query(
      `
      SELECT ${SELECT_FIELDS}
      FROM ${TABLE}
      WHERE id = ?
      ${publishedOnly ? "AND is_published = 1" : ""}
      LIMIT 1
      `,
      [id]
    );

    if (!rows.length) return res.status(404).json({ ok: false, error: "Item not found." });

    return res.json({ ok: true, item: normalizeRow(rows[0]) });
  } catch (error) {
    console.error("news events public detail error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to load item.",
      details: error.message,
    });
  }
});

/**
 * ADMIN CREATE
 */
router.post("/admin", authRequired, requireRole("admin"), uploadMiddleware, async (req, res) => {
  try {
    const validationError = validatePayload(req.body, Boolean(req.file));
    if (validationError) {
      if (req.file?.filename) removeUploadedFileIfExists(buildAbsoluteUploadUrl(req, req.file.filename));
      return res.status(400).json({ ok: false, error: validationError });
    }

    const payload = buildPayload(req.body, req, req.file?.filename || "");
    const [result] = await pool.query(`INSERT INTO ${TABLE} SET ?`, payload);

    const [rows] = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM ${TABLE} WHERE id = ? LIMIT 1`,
      [result.insertId]
    );

    return res.status(201).json({
      ok: true,
      item: normalizeRow(rows[0]),
    });
  } catch (error) {
    if (req.file?.filename) removeUploadedFileIfExists(buildAbsoluteUploadUrl(req, req.file.filename));
    console.error("news events admin create error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to create item.",
      details: error.message,
    });
  }
});

/**
 * ADMIN UPDATE
 */
router.put("/admin/:id", authRequired, requireRole("admin"), uploadMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      if (req.file?.filename) removeUploadedFileIfExists(buildAbsoluteUploadUrl(req, req.file.filename));
      return res.status(400).json({ ok: false, error: "Invalid id." });
    }

    const [existingRows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ? LIMIT 1`, [id]);

    if (!existingRows.length) {
      if (req.file?.filename) removeUploadedFileIfExists(buildAbsoluteUploadUrl(req, req.file.filename));
      return res.status(404).json({ ok: false, error: "Item not found." });
    }

    const validationError = validatePayload(req.body, Boolean(req.file));
    if (validationError) {
      if (req.file?.filename) removeUploadedFileIfExists(buildAbsoluteUploadUrl(req, req.file.filename));
      return res.status(400).json({ ok: false, error: validationError });
    }

    const existing = existingRows[0];
    const removeFlyer = safeTrim(req.body.remove_flyer) === "1";

    let nextFlyerUrl = existing.flyer_url || null;

    if (req.file?.filename) {
      nextFlyerUrl = buildAbsoluteUploadUrl(req, req.file.filename);
    } else if (removeFlyer) {
      nextFlyerUrl = null;
    } else if (safeTrim(req.body.flyer_url)) {
      nextFlyerUrl = safeTrim(req.body.flyer_url);
    }

    const payload = buildPayload(req.body, req, req.file?.filename || "");
    payload.flyer_url = nextFlyerUrl;

    await pool.query(`UPDATE ${TABLE} SET ? WHERE id = ?`, [payload, id]);

    if ((req.file?.filename || removeFlyer) && existing.flyer_url && existing.flyer_url !== nextFlyerUrl) {
      removeUploadedFileIfExists(existing.flyer_url);
    }

    const [rows] = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM ${TABLE} WHERE id = ? LIMIT 1`,
      [id]
    );

    return res.json({
      ok: true,
      item: normalizeRow(rows[0]),
    });
  } catch (error) {
    if (req.file?.filename) removeUploadedFileIfExists(buildAbsoluteUploadUrl(req, req.file.filename));
    console.error("news events admin update error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to update item.",
      details: error.message,
    });
  }
});

/**
 * ADMIN DELETE
 */
router.delete("/admin/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid id." });

    const [existingRows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ? LIMIT 1`, [id]);

    if (!existingRows.length) return res.status(404).json({ ok: false, error: "Item not found." });

    const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);

    if (!result.affectedRows) return res.status(404).json({ ok: false, error: "Item not found." });

    if (existingRows[0].flyer_url) removeUploadedFileIfExists(existingRows[0].flyer_url);

    return res.json({ ok: true });
  } catch (error) {
    console.error("news events admin delete error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to delete item.",
      details: error.message,
    });
  }
});

module.exports = router;