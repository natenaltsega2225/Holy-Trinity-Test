"use strict";

const express = require("express");

const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();

const FINANCE_ROLES = ["finance", "admin", "super_admin"];

const DEFAULT_SETTINGS = {
  organization_name: "Holy Trinity Ethiopian Orthodox Church",
  platform_name: "Holy Trinity Finance & Membership Platform",
  finance_email: "",
  support_email: "",
  currency: "USD",
  timezone: "America/Chicago",
  invoice_prefix: "INV",
  receipt_prefix: "RCPT",
  payment_prefix: "PAY",
  pledge_prefix: "PLG",
  enable_invoice_emails: true,
  enable_receipt_emails: true,
  enable_payment_links: true,
  attach_invoice_pdf: true,
  attach_receipt_pdf: true,
  enable_notifications: true,
  enable_pledge_reminders: true,
  enable_membership_reminders: true,
  default_due_grace_days: 7,
  reimbursement_requires_person_info: true,
  expense_approval_required: true,
  audit_mode: "strict",
};

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function cleanKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "_")
    .slice(0, 120);
}

function parseSetting(value) {
  if (value === null || value === undefined) return value;

  try {
    return JSON.parse(value);
  } catch (_err) {
    return value;
  }
}

function normalizePayload(body = {}) {
  if (body.settings && typeof body.settings === "object") {
    return body.settings;
  }

  return body;
}

async function ensureSettingsTable(conn = pool) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS tbl_finance_settings (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      setting_key VARCHAR(120) NOT NULL,
      setting_value JSON NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_finance_setting_key (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function readSettings() {
  await ensureSettingsTable();

  const [rows] = await pool.query(`
    SELECT setting_key, setting_value
    FROM tbl_finance_settings
    ORDER BY setting_key ASC
  `);

  const settings = { ...DEFAULT_SETTINGS };

  for (const row of rows) {
    settings[row.setting_key] = parseSetting(row.setting_value);
  }

  settings.stripe_secret_configured = Boolean(process.env.STRIPE_SECRET_KEY);
  settings.stripe_webhook_configured = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  settings.public_invoice_secret_configured = Boolean(
    process.env.PUBLIC_INVOICE_TOKEN_SECRET
  );

  return settings;
}

async function saveSettings(req, res) {
  const payload = normalizePayload(req.body || {});
  const entries = Object.entries(payload)
    .map(([key, value]) => [cleanKey(key), value])
    .filter(([key]) => Boolean(key));

  if (!entries.length) {
    return res.status(400).json({
      ok: false,
      error: "No finance settings were provided.",
    });
  }

  const conn = await pool.getConnection();

  try {
    await ensureSettingsTable(conn);
    await conn.beginTransaction();

    const actorId = req.user?.id || req.user?.user_id || null;
    const stamp = nowSql();

    for (const [key, value] of entries) {
      await conn.query(
        `
        INSERT INTO tbl_finance_settings
          (setting_key, setting_value, updated_by, created_at, updated_at)
        VALUES
          (?, CAST(? AS JSON), ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          setting_value = VALUES(setting_value),
          updated_by = VALUES(updated_by),
          updated_at = VALUES(updated_at)
        `,
        [key, JSON.stringify(value), actorId, stamp, stamp]
      );
    }

    await conn.commit();

    return res.json({
      ok: true,
      message: "Finance settings updated successfully.",
      settings: await readSettings(),
    });
  } catch (err) {
    await conn.rollback();
    console.error("financeSettings save failed:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to save finance settings.",
    });
  } finally {
    conn.release();
  }
}

router.use(authRequired);
router.use(requireRole(...FINANCE_ROLES));

router.get(["/", "/finance"], async (_req, res) => {
  try {
    return res.json({
      ok: true,
      settings: await readSettings(),
      defaults: DEFAULT_SETTINGS,
    });
  } catch (err) {
    console.error("financeSettings read failed:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to load finance settings.",
    });
  }
});

router.put(["/", "/finance"], saveSettings);
router.patch(["/", "/finance"], saveSettings);
router.post(["/", "/finance"], saveSettings);

router.get("/health/check", (_req, res) => {
  res.json({
    ok: true,
    module: "financeSettings",
    version: "enterprise",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
