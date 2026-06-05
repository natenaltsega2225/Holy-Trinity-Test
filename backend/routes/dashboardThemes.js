// backend/routes/dashboardThemes.js


"use strict";

const express = require("express");
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const ROLE_OPTIONS = ["admin", "finance", "member"];

function normalizeText(v, fallback = "") {
  return String(v ?? fallback).trim();
}

function normalizeRole(v) {
  const role = normalizeText(v).toLowerCase();
  return ROLE_OPTIONS.includes(role) ? role : null;
}

function normalizeHex(v, fallback) {
  const value = normalizeText(v, fallback);
  return HEX_RE.test(value) ? value : fallback;
}

function toBoolInt(v, fallback = 0) {
  if (v === true || v === "1" || v === 1) return 1;
  if (v === false || v === "0" || v === 0) return 0;
  return fallback ? 1 : 0;
}

function sanitizeThemePayload(body = {}) {
  const role_name = normalizeRole(body.role_name);
  if (!role_name) {
    return { error: "Invalid role_name. Use admin, finance, or member." };
  }

  const theme_key = normalizeText(body.theme_key);
  const theme_name = normalizeText(body.theme_name);

  if (!theme_key) return { error: "theme_key is required." };
  if (!theme_name) return { error: "theme_name is required." };

  return {
    payload: {
      theme_key,
      role_name,
      theme_name,

      page_bg: normalizeHex(body.page_bg, "#edf3fb"),
      surface_bg: normalizeHex(body.surface_bg, "#ffffff"),
      border_color: normalizeHex(body.border_color, "#d7e3f3"),

      text_color: normalizeHex(body.text_color, "#15263f"),
      muted_text_color: normalizeHex(body.muted_text_color, "#687995"),
      desktop_text_color: normalizeHex(body.desktop_text_color, "#0f172a"),

      sidebar_bg: normalizeHex(body.sidebar_bg, "#0f1d34"),
      sidebar_text_color: normalizeHex(body.sidebar_text_color, "#eef4ff"),

      header_bg: normalizeHex(body.header_bg, "#0f1e36"),
      header_text_color: normalizeHex(body.header_text_color, "#ffffff"),

      active_nav_bg: normalizeHex(body.active_nav_bg, "#3a6de8"),
      active_nav_text_color: normalizeHex(body.active_nav_text_color, "#ffffff"),

      button_bg: normalizeHex(body.button_bg, "#315bcb"),
      button_text: normalizeHex(body.button_text, "#ffffff"),

      highlight_bg: normalizeHex(body.highlight_bg, "#eef4ff"),
      highlight_text: normalizeHex(body.highlight_text, "#315bcb"),

      shadow_color: normalizeHex(body.shadow_color, "#0f172a"),

      is_active: toBoolInt(body.is_active, 0),
      is_default: toBoolInt(body.is_default, 0),
    },
  };
}

async function getThemeById(id) {
  const [rows] = await pool.query(
    `
    SELECT *
    FROM tbl_dashboard_themes
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );
  return rows[0] || null;
}

async function getRoleThemeCount(role_name) {
  const [rows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM tbl_dashboard_themes
    WHERE role_name = ?
    `,
    [role_name]
  );
  return Number(rows[0]?.total || 0);
}

async function getNextCopyThemeKey(baseKey) {
  const candidate = `${baseKey}_copy`;

  const [rows] = await pool.query(
    `
    SELECT theme_key
    FROM tbl_dashboard_themes
    WHERE theme_key LIKE ?
    `,
    [`${candidate}%`]
  );

  const existing = new Set(rows.map((r) => String(r.theme_key)));
  if (!existing.has(candidate)) return candidate;

  let i = 2;
  while (existing.has(`${candidate}_${i}`)) {
    i += 1;
  }
  return `${candidate}_${i}`;
}

async function ensureSingleActiveRole(role_name, keepId = null) {
  if (!role_name) return;

  if (keepId == null) {
    await pool.query(
      `
      UPDATE tbl_dashboard_themes
      SET is_active = 0, updated_at = NOW()
      WHERE role_name = ?
      `,
      [role_name]
    );
  } else {
    await pool.query(
      `
      UPDATE tbl_dashboard_themes
      SET is_active = 0, updated_at = NOW()
      WHERE role_name = ?
        AND id <> ?
      `,
      [role_name, keepId]
    );
  }
}

async function ensureSingleDefaultRole(role_name, keepId = null) {
  if (!role_name) return;

  if (keepId == null) {
    await pool.query(
      `
      UPDATE tbl_dashboard_themes
      SET is_default = 0, updated_at = NOW()
      WHERE role_name = ?
      `,
      [role_name]
    );
  } else {
    await pool.query(
      `
      UPDATE tbl_dashboard_themes
      SET is_default = 0, updated_at = NOW()
      WHERE role_name = ?
        AND id <> ?
      `,
      [role_name, keepId]
    );
  }
}

async function ensureRoleHasActiveTheme(role_name) {
  const [activeRows] = await pool.query(
    `
    SELECT id
    FROM tbl_dashboard_themes
    WHERE role_name = ?
      AND is_active = 1
    LIMIT 1
    `,
    [role_name]
  );

  if (activeRows.length) return;

  const [fallbackRows] = await pool.query(
    `
    SELECT id
    FROM tbl_dashboard_themes
    WHERE role_name = ?
    ORDER BY is_default DESC, id ASC
    LIMIT 1
    `,
    [role_name]
  );

  if (!fallbackRows.length) return;

  await pool.query(
    `
    UPDATE tbl_dashboard_themes
    SET is_active = 1, updated_at = NOW()
    WHERE id = ?
    `,
    [fallbackRows[0].id]
  );
}

async function ensureRoleHasDefaultTheme(role_name) {
  const [defaultRows] = await pool.query(
    `
    SELECT id
    FROM tbl_dashboard_themes
    WHERE role_name = ?
      AND is_default = 1
    LIMIT 1
    `,
    [role_name]
  );

  if (defaultRows.length) return;

  const [fallbackRows] = await pool.query(
    `
    SELECT id
    FROM tbl_dashboard_themes
    WHERE role_name = ?
    ORDER BY is_active DESC, id ASC
    LIMIT 1
    `,
    [role_name]
  );

  if (!fallbackRows.length) return;

  await pool.query(
    `
    UPDATE tbl_dashboard_themes
    SET is_default = 1, updated_at = NOW()
    WHERE id = ?
    `,
    [fallbackRows[0].id]
  );
}

/* =========================================================
   GET list
========================================================= */
router.get("/", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const search = normalizeText(req.query.search);
    const role = normalizeText(req.query.role, "all").toLowerCase();

    const where = [];
    const params = [];

    if (search) {
      where.push(`
        (
          theme_key LIKE ?
          OR theme_name LIKE ?
          OR role_name LIKE ?
        )
      `);
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (role && role !== "all") {
      const normalizedRole = normalizeRole(role);
      if (!normalizedRole) {
        return res.status(400).json({ error: "Invalid role filter." });
      }
      where.push(`role_name = ?`);
      params.push(normalizedRole);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `
      SELECT
        id,
        theme_key,
        role_name,
        theme_name,
        page_bg,
        surface_bg,
        border_color,
        text_color,
        muted_text_color,
        desktop_text_color,
        sidebar_bg,
        sidebar_text_color,
        header_bg,
        header_text_color,
        active_nav_bg,
        active_nav_text_color,
        button_bg,
        button_text,
        highlight_bg,
        highlight_text,
        shadow_color,
        is_active,
        is_default,
        created_at,
        updated_at
      FROM tbl_dashboard_themes
      ${whereSql}
      ORDER BY FIELD(role_name, 'admin', 'finance', 'member'),
               is_default DESC,
               theme_name ASC,
               id ASC
      `,
      params
    );

    return res.json({ ok: true, rows });
  } catch (err) {
    console.error("GET /api/admin/dashboard-themes error:", err);
    return res.status(500).json({ error: "Failed to load themes." });
  }
});

/* =========================================================
   GET active by role
========================================================= */
router.get("/active", authRequired, async (req, res) => {
  try {
    const role_name = normalizeRole(req.query.role);
    if (!role_name) {
      return res.status(400).json({ error: "Valid role is required." });
    }

    const [rows] = await pool.query(
      `
      SELECT
        id,
        theme_key,
        role_name,
        theme_name,
        page_bg,
        surface_bg,
        border_color,
        text_color,
        muted_text_color,
        desktop_text_color,
        sidebar_bg,
        sidebar_text_color,
        header_bg,
        header_text_color,
        active_nav_bg,
        active_nav_text_color,
        button_bg,
        button_text,
        highlight_bg,
        highlight_text,
        shadow_color,
        is_active,
        is_default,
        created_at,
        updated_at
      FROM tbl_dashboard_themes
      WHERE role_name = ?
        AND is_active = 1
      ORDER BY is_default DESC, id ASC
      LIMIT 1
      `,
      [role_name]
    );

    if (rows.length) {
      return res.json({ ok: true, row: rows[0] });
    }

    const [fallbackRows] = await pool.query(
      `
      SELECT
        id,
        theme_key,
        role_name,
        theme_name,
        page_bg,
        surface_bg,
        border_color,
        text_color,
        muted_text_color,
        desktop_text_color,
        sidebar_bg,
        sidebar_text_color,
        header_bg,
        header_text_color,
        active_nav_bg,
        active_nav_text_color,
        button_bg,
        button_text,
        highlight_bg,
        highlight_text,
        shadow_color,
        is_active,
        is_default,
        created_at,
        updated_at
      FROM tbl_dashboard_themes
      WHERE role_name = ?
      ORDER BY is_default DESC, id ASC
      LIMIT 1
      `,
      [role_name]
    );

    return res.json({ ok: true, row: fallbackRows[0] || null });
  } catch (err) {
    console.error("GET /api/admin/dashboard-themes/active error:", err);
    return res.status(500).json({ error: "Failed to load active theme." });
  }
});

/* =========================================================
   POST create
========================================================= */
router.post("/", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const checked = sanitizeThemePayload(req.body);
    if (checked.error) {
      return res.status(400).json({ error: checked.error });
    }

    const payload = checked.payload;

    const [existingKey] = await pool.query(
      `
      SELECT id
      FROM tbl_dashboard_themes
      WHERE theme_key = ?
      LIMIT 1
      `,
      [payload.theme_key]
    );

    if (existingKey.length) {
      return res.status(400).json({ error: "theme_key already exists." });
    }

    if (payload.is_active === 1) {
      await ensureSingleActiveRole(payload.role_name, null);
    }

    if (payload.is_default === 1) {
      await ensureSingleDefaultRole(payload.role_name, null);
    }

    const [result] = await pool.query(
      `
      INSERT INTO tbl_dashboard_themes
      (
        theme_key,
        role_name,
        theme_name,
        page_bg,
        surface_bg,
        border_color,
        text_color,
        muted_text_color,
        desktop_text_color,
        sidebar_bg,
        sidebar_text_color,
        header_bg,
        header_text_color,
        active_nav_bg,
        active_nav_text_color,
        button_bg,
        button_text,
        highlight_bg,
        highlight_text,
        shadow_color,
        is_active,
        is_default,
        created_at,
        updated_at
      )
      VALUES
      (?, ?, ?,
       ?, ?, ?,
       ?, ?, ?,
       ?, ?,
       ?, ?,
       ?, ?,
       ?, ?,
       ?, ?, ?,
       ?, ?, NOW(), NOW())
      `,
      [
        payload.theme_key,
        payload.role_name,
        payload.theme_name,
        payload.page_bg,
        payload.surface_bg,
        payload.border_color,
        payload.text_color,
        payload.muted_text_color,
        payload.desktop_text_color,
        payload.sidebar_bg,
        payload.sidebar_text_color,
        payload.header_bg,
        payload.header_text_color,
        payload.active_nav_bg,
        payload.active_nav_text_color,
        payload.button_bg,
        payload.button_text,
        payload.highlight_bg,
        payload.highlight_text,
        payload.shadow_color,
        payload.is_active,
        payload.is_default,
      ]
    );

    await ensureRoleHasDefaultTheme(payload.role_name);
    await ensureRoleHasActiveTheme(payload.role_name);

    const row = await getThemeById(result.insertId);

    return res.json({
      ok: true,
      row,
      message: "Theme created successfully.",
    });
  } catch (err) {
    console.error("POST /api/admin/dashboard-themes error:", err);
    return res.status(500).json({ error: "Failed to create theme." });
  }
});

/* =========================================================
   POST copy
========================================================= */
router.post("/:id/copy", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid theme id." });
    }

    const source = await getThemeById(id);
    if (!source) {
      return res.status(404).json({ error: "Theme not found." });
    }

    const newThemeKey = await getNextCopyThemeKey(source.theme_key);
    const newThemeName = `${source.theme_name} Copy`;

    const [result] = await pool.query(
      `
      INSERT INTO tbl_dashboard_themes
      (
        theme_key,
        role_name,
        theme_name,
        page_bg,
        surface_bg,
        border_color,
        text_color,
        muted_text_color,
        desktop_text_color,
        sidebar_bg,
        sidebar_text_color,
        header_bg,
        header_text_color,
        active_nav_bg,
        active_nav_text_color,
        button_bg,
        button_text,
        highlight_bg,
        highlight_text,
        shadow_color,
        is_active,
        is_default,
        created_at,
        updated_at
      )
      VALUES
      (?, ?, ?,
       ?, ?, ?,
       ?, ?, ?,
       ?, ?,
       ?, ?,
       ?, ?,
       ?, ?,
       ?, ?, ?,
       0, 0, NOW(), NOW())
      `,
      [
        newThemeKey,
        source.role_name,
        newThemeName,
        source.page_bg,
        source.surface_bg,
        source.border_color,
        source.text_color,
        source.muted_text_color,
        source.desktop_text_color,
        source.sidebar_bg,
        source.sidebar_text_color,
        source.header_bg,
        source.header_text_color,
        source.active_nav_bg,
        source.active_nav_text_color,
        source.button_bg,
        source.button_text,
        source.highlight_bg,
        source.highlight_text,
        source.shadow_color,
      ]
    );

    const row = await getThemeById(result.insertId);

    return res.json({
      ok: true,
      row,
      message: "Theme copied successfully.",
    });
  } catch (err) {
    console.error("POST /api/admin/dashboard-themes/:id/copy error:", err);
    return res.status(500).json({ error: "Failed to copy theme." });
  }
});

/* =========================================================
   PUT update
========================================================= */
router.put("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid theme id." });
    }

    const current = await getThemeById(id);
    if (!current) {
      return res.status(404).json({ error: "Theme not found." });
    }

    const checked = sanitizeThemePayload(req.body);
    if (checked.error) {
      return res.status(400).json({ error: checked.error });
    }

    const payload = checked.payload;

    const [dupRows] = await pool.query(
      `
      SELECT id
      FROM tbl_dashboard_themes
      WHERE theme_key = ?
        AND id <> ?
      LIMIT 1
      `,
      [payload.theme_key, id]
    );

    if (dupRows.length) {
      return res.status(400).json({ error: "theme_key already exists." });
    }

    if (Number(current.is_default) === 1 && payload.role_name !== current.role_name) {
      return res.status(400).json({
        error: "Default theme role cannot be changed.",
      });
    }

    if (payload.is_active === 1) {
      await ensureSingleActiveRole(payload.role_name, id);
    }

    if (payload.is_default === 1) {
      await ensureSingleDefaultRole(payload.role_name, id);
    }

    await pool.query(
      `
      UPDATE tbl_dashboard_themes
      SET
        theme_key = ?,
        role_name = ?,
        theme_name = ?,
        page_bg = ?,
        surface_bg = ?,
        border_color = ?,
        text_color = ?,
        muted_text_color = ?,
        desktop_text_color = ?,
        sidebar_bg = ?,
        sidebar_text_color = ?,
        header_bg = ?,
        header_text_color = ?,
        active_nav_bg = ?,
        active_nav_text_color = ?,
        button_bg = ?,
        button_text = ?,
        highlight_bg = ?,
        highlight_text = ?,
        shadow_color = ?,
        is_active = ?,
        is_default = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        payload.theme_key,
        payload.role_name,
        payload.theme_name,
        payload.page_bg,
        payload.surface_bg,
        payload.border_color,
        payload.text_color,
        payload.muted_text_color,
        payload.desktop_text_color,
        payload.sidebar_bg,
        payload.sidebar_text_color,
        payload.header_bg,
        payload.header_text_color,
        payload.active_nav_bg,
        payload.active_nav_text_color,
        payload.button_bg,
        payload.button_text,
        payload.highlight_bg,
        payload.highlight_text,
        payload.shadow_color,
        payload.is_active,
        payload.is_default,
        id,
      ]
    );

    await ensureRoleHasDefaultTheme(payload.role_name);
    await ensureRoleHasActiveTheme(payload.role_name);

    const row = await getThemeById(id);

    return res.json({
      ok: true,
      row,
      message: "Theme updated successfully.",
    });
  } catch (err) {
    console.error("PUT /api/admin/dashboard-themes/:id error:", err);
    return res.status(500).json({ error: "Failed to update theme." });
  }
});

/* =========================================================
   DELETE
========================================================= */
router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid theme id." });
    }

    const theme = await getThemeById(id);
    if (!theme) {
      return res.status(404).json({ error: "Theme not found." });
    }

    if (Number(theme.is_default) === 1) {
      return res.status(400).json({
        error: "Default themes cannot be deleted.",
      });
    }

    const roleCount = await getRoleThemeCount(theme.role_name);
    if (roleCount <= 1) {
      return res.status(400).json({
        error: "You must keep at least one theme for each dashboard role.",
      });
    }

    await pool.query(
      `
      DELETE FROM tbl_dashboard_themes
      WHERE id = ?
      `,
      [id]
    );

    await ensureRoleHasDefaultTheme(theme.role_name);
    await ensureRoleHasActiveTheme(theme.role_name);

    return res.json({
      ok: true,
      message: "Theme deleted successfully.",
    });
  } catch (err) {
    console.error("DELETE /api/admin/dashboard-themes/:id error:", err);
    return res.status(500).json({ error: "Failed to delete theme." });
  }
});

module.exports = router;