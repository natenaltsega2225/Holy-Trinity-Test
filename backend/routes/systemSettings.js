"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");
const { writeAuditLog } = require("../utils/audit");

const router = express.Router();

const ALLOWED_SECTIONS = new Set([
  "general",
  "branding",
  "access",
  "membership",
  "finance",
  "notifications",
  "integrations",
  "maintenance",
]);

const DEFAULT_SYSTEM_INFO = {
  environment: process.env.NODE_ENV || "development",
  appVersion: process.env.APP_VERSION || "v1.0.0",
  database: "Connected",
  storage: "Healthy",
  lastBackup: "Unknown",
};

const uploadsDir = path.join(process.cwd(), "uploads", "settings");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
    cb(null, `logo-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(file.mimetype || "");
    cb(ok ? null : new Error("Only image files are allowed."), ok);
  },
});

function cleanSection(value) {
  return String(value || "").trim().toLowerCase();
}

function inferValueType(value) {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (value && typeof value === "object") return "json";
  return "string";
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toResponseShape(rows) {
  const grouped = {
    general: {},
    branding: {},
    access: {},
    membership: {},
    finance: {},
    notifications: {},
    integrations: {},
    maintenance: {},
  };

  for (const row of rows) {
    if (!grouped[row.section]) grouped[row.section] = {};
    grouped[row.section][row.setting_key] =
      typeof row.setting_value === "string"
        ? safeJsonParse(row.setting_value)
        : row.setting_value;
  }

  grouped.system = DEFAULT_SYSTEM_INFO;
  return grouped;
}

function isLockTimeoutError(err) {
  return (
    err &&
    (err.code === "ER_LOCK_WAIT_TIMEOUT" ||
      err.errno === 1205 ||
      String(err.sqlMessage || "").includes("Lock wait timeout"))
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function upsertOneSetting(section, key, rawValue, updatedBy) {
  const valueType = inferValueType(rawValue);
  const jsonValue = JSON.stringify(rawValue);

  const sql = `
    INSERT INTO tbl_system_settings
      (section, setting_key, setting_value, value_type, updated_by)
    VALUES (?, ?, CAST(? AS JSON), ?, ?)
    ON DUPLICATE KEY UPDATE
      setting_value = CAST(? AS JSON),
      value_type = VALUES(value_type),
      updated_by = VALUES(updated_by),
      updated_at = CURRENT_TIMESTAMP
  `;

  const params = [
    section,
    key,
    jsonValue,
    valueType,
    updatedBy || null,
    jsonValue,
  ];

  let lastErr = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await pool.query(sql, params);
      return;
    } catch (err) {
      lastErr = err;
      if (!isLockTimeoutError(err) || attempt === 3) {
        throw err;
      }
      await delay(150 * attempt);
    }
  }

  throw lastErr;
}

async function upsertSectionSettings(section, values, updatedBy) {
  for (const [key, rawValue] of Object.entries(values)) {
    await upsertOneSetting(section, key, rawValue, updatedBy);
  }
}

async function loadAllSettings() {
  const [rows] = await pool.query(
    `
    SELECT
      section,
      setting_key,
      CAST(setting_value AS CHAR) AS setting_value,
      value_type,
      updated_at
    FROM tbl_system_settings
    ORDER BY section, setting_key
    `
  );

  return toResponseShape(rows || []);
}

router.get(
  "/",
  authRequired,
  requireRole("admin"),
  async (_req, res) => {
    try {
      const settings = await loadAllSettings();
      return res.json({ ok: true, settings });
    } catch (err) {
      console.error("system settings GET error:", err);
      return res.status(500).json({ error: "Unable to load system settings." });
    }
  }
);

router.post(
  "/logo",
  authRequired,
  requireRole("admin"),
  upload.single("logo"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Logo file is required." });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const logoUrl = `${baseUrl}/uploads/settings/${req.file.filename}`;

      await upsertOneSetting(
        "branding",
        "logoUrl",
        logoUrl,
        req.user?.id || null
      );

      await writeAuditLog({
        actorId: req.user?.id || null,
        action: "system_settings_logo_uploaded",
        entity: "system_settings",
        entityId: null,
        meta: { logoUrl },
        ipAddress: req.ip,
      });

      return res.json({
        ok: true,
        message: "Logo uploaded successfully.",
        logoUrl,
      });
    } catch (err) {
      console.error("system settings logo upload error:", err);
      return res.status(500).json({
        error: isLockTimeoutError(err)
          ? "System settings are busy. Please try again."
          : err.message || "Unable to upload logo.",
      });
    }
  }
);

router.put(
  "/:section",
  authRequired,
  requireRole("admin"),
  async (req, res) => {
    try {
      const section = cleanSection(req.params.section);

      if (!ALLOWED_SECTIONS.has(section)) {
        return res.status(400).json({ error: "Invalid settings section." });
      }

      const payload = req.body;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return res.status(400).json({ error: "Request body must be an object." });
      }

      await upsertSectionSettings(section, payload, req.user?.id || null);

      await writeAuditLog({
        actorId: req.user?.id || null,
        action: "system_settings_updated",
        entity: "system_settings",
        entityId: null,
        meta: { section, keys: Object.keys(payload) },
        ipAddress: req.ip,
      });

      const [rows] = await pool.query(
        `
        SELECT
          section,
          setting_key,
          CAST(setting_value AS CHAR) AS setting_value,
          value_type,
          updated_at
        FROM tbl_system_settings
        WHERE section = ?
        ORDER BY setting_key
        `,
        [section]
      );

      const grouped = toResponseShape(rows || []);

      return res.json({
        ok: true,
        message: `${section} settings saved successfully.`,
        section,
        data: grouped[section] || {},
      });
    } catch (err) {
      console.error("system settings section PUT error:", err);
      return res.status(500).json({
        error: isLockTimeoutError(err)
          ? "System settings are busy. Please try again."
          : "Failed to save system settings.",
      });
    }
  }
);

router.put(
  "/",
  authRequired,
  requireRole("admin"),
  async (req, res) => {
    try {
      const payload = req.body;

      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return res.status(400).json({ error: "Request body must be an object." });
      }

      const savedSections = [];

      for (const [section, values] of Object.entries(payload)) {
        const clean = cleanSection(section);

        if (!ALLOWED_SECTIONS.has(clean)) continue;
        if (!values || typeof values !== "object" || Array.isArray(values)) continue;

        await upsertSectionSettings(clean, values, req.user?.id || null);
        savedSections.push(clean);
      }

      await writeAuditLog({
        actorId: req.user?.id || null,
        action: "system_settings_updated",
        entity: "system_settings",
        entityId: null,
        meta: { sections: savedSections },
        ipAddress: req.ip,
      });

      const settings = await loadAllSettings();

      return res.json({
        ok: true,
        message: "System settings saved successfully.",
        settings,
      });
    } catch (err) {
      console.error("system settings PUT all error:", err);
      return res.status(500).json({
        error: isLockTimeoutError(err)
          ? "System settings are busy. Please try again."
          : "Failed to save system settings.",
      });
    }
  }
);

module.exports = router;