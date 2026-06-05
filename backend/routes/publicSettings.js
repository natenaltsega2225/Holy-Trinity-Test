//backend\routes\publicSettings.js
"use strict";

const express = require("express");
const pool = require("../db");

const router = express.Router();

const PUBLIC_KEYS = {
  general: new Set([
    "churchName",
    "supportEmail",
    "contactPhone",
    "address",
    "timezone",
    "dateFormat",
    "language",
  ]),
  branding: new Set([
    "primaryColor",
    "secondaryColor",
    "accentColor",
    "footerText",
    "showPublicBanner",
    "publicBannerText",
    "logoUrl",
    "faviconUrl",
    "loginWelcomeText",
  ]),
};

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeSettings(rows) {
  const settings = {
    general: {},
    branding: {},
  };

  for (const row of rows) {
    const section = String(row.section || "").trim();
    const key = String(row.setting_key || "").trim();

    if (!PUBLIC_KEYS[section] || !PUBLIC_KEYS[section].has(key)) continue;

    settings[section][key] =
      typeof row.setting_value === "string"
        ? safeJsonParse(row.setting_value)
        : row.setting_value;
  }

  const address = String(settings.general.address || "").trim();
  settings.general.googleMapsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : "";

  return settings;
}

router.get("/public", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        section,
        setting_key,
        CAST(setting_value AS CHAR) AS setting_value,
        value_type,
        updated_at
      FROM tbl_system_settings
      WHERE section IN ('general', 'branding')
      ORDER BY section, setting_key
      `
    );

    return res.json({
      ok: true,
      settings: normalizeSettings(rows || []),
    });
  } catch (err) {
    console.error("public settings GET error:", err);
    return res.status(500).json({
      error: "Unable to load public settings.",
    });
  }
});

module.exports = router;