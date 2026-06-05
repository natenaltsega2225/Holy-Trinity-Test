

// // backend/routes/adminMembershipPlans.js


"use strict";

const express = require("express");
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

function clean(v, max = 255) {
  return String(v ?? "").trim().slice(0, max);
}

function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toMoney(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n)
    ? Number(n.toFixed(2))
    : fallback;
}

function normalizeOption(value) {
  const v = String(value || "monthly").toLowerCase();

  if (
    ["monthly", "3_month", "6_month", "12_month"].includes(v)
  ) {
    return v;
  }

  return "monthly";
}

function durationFromOption(option) {
  const v = normalizeOption(option);

  if (v === "3_month") return 3;
  if (v === "6_month") return 6;
  if (v === "12_month") return 12;

  return 1;
}

function parsePresetAmounts(value) {
  try {
    const parsed =
      Array.isArray(value)
        ? value
        : JSON.parse(String(value || "[]"));

    if (!Array.isArray(parsed)) {
      return [];
    }

    return [
      ...new Set(
        parsed
          .map((x) => toMoney(x, 0))
          .filter((x) => x > 0)
      ),
    ].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

router.get(
  "/",
  authRequired,
  requireRole("finance", "admin", "super_admin"),
  async (_req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT
          id,
          plan_code,
          plan_name,
          description,
          billing_cycle,
          duration_months,
          minimum_amount,
          preset_amounts_json,
          registration_fee,
          member_type,
          sort_order,
          allow_custom_amount,
          is_active,
          created_at,
          updated_at
        FROM tbl_finance_dues_plans
        ORDER BY
          sort_order ASC,
          duration_months ASC,
          id ASC
      `);

      return res.json({
        ok: true,
        rows: rows.map((r) => ({
          id: r.id,

          code: r.plan_code,
          name: r.plan_name,

          description: r.description,

          billing_cycle: r.billing_cycle,

          duration_months: Number(
            r.duration_months || 1
          ),

          minimum_amount: toMoney(
            r.minimum_amount,
            0
          ),

          registration_fee: toMoney(
            r.registration_fee,
            0
          ),

          preset_amounts: parsePresetAmounts(
            r.preset_amounts_json
          ),

          member_type: r.member_type || "both",

          allow_custom_amount:
            Number(r.allow_custom_amount || 0),

          is_active:
            Number(r.is_active || 0),

          sort_order:
            Number(r.sort_order || 0),

          created_at: r.created_at,
          updated_at: r.updated_at,
        })),
      });
    } catch (err) {
      console.error(
        "membership plans load error:",
        err
      );

      return res.status(500).json({
        error: "Failed to load dues plans.",
      });
    }
  }
);

router.post(
  "/",
  authRequired,
  requireRole("finance", "admin", "super_admin"),
  async (req, res) => {
    try {
      const code = clean(req.body.code, 40);
      const name = clean(req.body.name, 120);

      if (!code || !name) {
        return res.status(400).json({
          error: "Code and name are required.",
        });
      }

      const billing_cycle = normalizeOption(
        req.body.billing_cycle
      );

      const duration_months =
        durationFromOption(billing_cycle);

      const minimum_amount = toMoney(
        req.body.minimum_amount,
        0
      );

      const registration_fee = toMoney(
        req.body.registration_fee,
        0
      );

      const preset_amounts =
        parsePresetAmounts(
          req.body.preset_amounts
        );

      const [result] = await pool.query(
        `
        INSERT INTO tbl_finance_dues_plans (
          plan_code,
          plan_name,
          description,
          billing_cycle,
          duration_months,
          minimum_amount,
          preset_amounts_json,
          registration_fee,
          member_type,
          sort_order,
          allow_custom_amount,
          is_active,
          created_by,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `,
        [
          code,
          name,

          clean(req.body.description, 5000),

          billing_cycle,
          duration_months,

          minimum_amount,

          JSON.stringify(preset_amounts),

          registration_fee,

          clean(
            req.body.member_type || "both",
            20
          ),

          toInt(req.body.sort_order, 0),

          Number(
            req.body.allow_custom_amount
              ? 1
              : 0
          ),

          Number(
            req.body.is_active
              ? 1
              : 0
          ),

          req.user?.id || null,
        ]
      );

      return res.json({
        ok: true,
        id: result.insertId,
        message:
          "Membership plan created successfully.",
      });
    } catch (err) {
      console.error(
        "membership create error:",
        err
      );

      return res.status(500).json({
        error: "Failed to create membership plan.",
      });
    }
  }
);

router.put(
  "/:id",
  authRequired,
  requireRole("finance", "admin", "super_admin"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          error: "Invalid id.",
        });
      }

      const billing_cycle = normalizeOption(
        req.body.billing_cycle
      );

      await pool.query(
        `
        UPDATE tbl_finance_dues_plans
        SET
          plan_code = ?,
          plan_name = ?,
          description = ?,
          billing_cycle = ?,
          duration_months = ?,
          minimum_amount = ?,
          preset_amounts_json = ?,
          registration_fee = ?,
          member_type = ?,
          sort_order = ?,
          allow_custom_amount = ?,
          is_active = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          clean(req.body.code, 40),

          clean(req.body.name, 120),

          clean(req.body.description, 5000),

          billing_cycle,

          durationFromOption(billing_cycle),

          toMoney(req.body.minimum_amount, 0),

          JSON.stringify(
            parsePresetAmounts(
              req.body.preset_amounts
            )
          ),

          toMoney(req.body.registration_fee, 0),

          clean(
            req.body.member_type || "both",
            20
          ),

          toInt(req.body.sort_order, 0),

          Number(
            req.body.allow_custom_amount
              ? 1
              : 0
          ),

          Number(
            req.body.is_active
              ? 1
              : 0
          ),

          id,
        ]
      );

      return res.json({
        ok: true,
        message:
          "Membership plan updated successfully.",
      });
    } catch (err) {
      console.error(
        "membership update error:",
        err
      );

      return res.status(500).json({
        error: "Failed to update plan.",
      });
    }
  }
);

router.delete(
  "/:id",
  authRequired,
  requireRole("finance", "admin", "super_admin"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          error: "Invalid id.",
        });
      }

      await pool.query(
        `
        DELETE FROM tbl_finance_dues_plans
        WHERE id = ?
        `,
        [id]
      );

      return res.json({
        ok: true,
        message:
          "Membership plan deleted successfully.",
      });
    } catch (err) {
      console.error(
        "membership delete error:",
        err
      );

      return res.status(500).json({
        error: "Failed to delete plan.",
      });
    }
  }
);

module.exports = router;