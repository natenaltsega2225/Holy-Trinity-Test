


//backend\routes\subscription.js
"use strict";

const express = require("express");
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

async function getMemberIdForUser(userId) {
  const [[row]] = await pool.query(
    `
    SELECT member_id
    FROM tbl_users
    WHERE id = ?
    LIMIT 1
    `,
    [userId]
  );

  return Number(row?.member_id || 0) || null;
}

function normalizePlanType(value, intervalCount = 1, intervalUnit = "month") {
  const v = String(value || "").toLowerCase();

  if (v === "12_month" || Number(intervalCount) === 12) return "12_month";
  if (v === "6_month" || Number(intervalCount) === 6) return "6_month";
  if (v === "3_month" || Number(intervalCount) === 3) return "3_month";
  if (Number(intervalCount) === 1 && String(intervalUnit).toLowerCase() === "year") {
    return "12_month";
  }

  return "monthly";
}



function buildCardDisplay(cardBrand, cardLast4) {
  return cardBrand && cardLast4
    ? `${String(cardBrand).toUpperCase()} •••• ${cardLast4}`
    : "--";
}

async function loadCurrentSubscription(memberId) {

const [[row]] = await pool.query(
`
SELECT
s.id,
s.member_id,


  s.dues_plan_id,

  s.start_date,
  s.end_date,

  s.coverage_start,
  s.coverage_end,

  s.coverage_start_month,
  s.coverage_end_month,

  s.coverage_label,

  s.months_paid,
  s.months_remaining,

  s.next_renewal_date,

  s.status,

  s.auto_renew,
  s.auto_payment_enabled,

  s.current_amount,

  s.interval_unit,
  s.interval_count,

  s.stripe_subscription_id,

  p.plan_name,
  p.plan_code,
  p.duration_months,

  pay.card_brand,
  pay.card_last4,
  pay.card_exp_month,
  pay.card_exp_year,
  pay.cardholder_name

FROM tbl_finance_dues_subscriptions s

LEFT JOIN tbl_finance_dues_plans p
  ON p.id = s.dues_plan_id

LEFT JOIN tbl_finance_payments pay
  ON pay.id = (
    SELECT p2.id
    FROM tbl_finance_payments p2
    WHERE p2.member_id = s.member_id
      AND p2.status IN (
        'paid',
        'posted',
        'completed',
        'approved'
      )
      AND p2.card_last4 IS NOT NULL
    ORDER BY
      COALESCE(
        p2.paid_at,
        p2.created_at
      ) DESC,
      p2.id DESC
    LIMIT 1
  )

WHERE s.member_id = ?

ORDER BY s.id DESC

LIMIT 1
`,
[memberId]


);

if (!row) {
return null;
}

const plan_type = normalizePlanType(
row.plan_code,
row.interval_count,
row.interval_unit
);

const buildCoverageLabel = () => {


if (
  row.coverage_label
) {
  return row.coverage_label;
}

if (
  !row.coverage_start_month ||
  !row.coverage_end_month
) {
  return "--";
}

const start = new Date(
  `${row.coverage_start_month}-01`
);

const end = new Date(
  `${row.coverage_end_month}-01`
);

const fmt = (d) =>
  d.toLocaleDateString(
    "en-US",
    {
      month: "long",
      year: "numeric",
    }
  );

return `${fmt(start)} - ${fmt(end)}`;


};

return {


...row,

plan_type,

plan_duration:

  row.plan_duration ||

  (
    Number(
      row.interval_count || 1
    ) === 1

      ? "1 Month"

      : `${Number(
          row.interval_count || 1
        )} Months`
  ),

coverage_start_month:
  row.coverage_start_month || null,

coverage_end_month:
  row.coverage_end_month || null,

coverage_label:
  buildCoverageLabel(),

next_renewal_date:

  row.next_renewal_date ||

  row.coverage_end ||

  row.end_date ||

  null,

renewal_date:

  row.next_renewal_date ||

  row.coverage_end ||

  row.end_date ||

  null,

months_paid:
  Number(
    row.months_paid || 0
  ),

months_remaining:
  Number(
    row.months_remaining || 0
  ),

auto_renew:
  Number(
    row.auto_renew || 0
  ),

auto_payment_enabled:
  Number(
    row.auto_payment_enabled || 0
  ),

card_display:
  buildCardDisplay(
    row.card_brand,
    row.card_last4
  ),

payment_card:
  buildCardDisplay(
    row.card_brand,
    row.card_last4
  ),


};
}


router.get(
  ["/", "/current"],
  authRequired,
  requireRole("member", "admin", "finance", "super_admin"),
  async (req, res) => {
    try {
      const memberId = await getMemberIdForUser(req.user.id);

      if (!memberId) {
        return res.json({ ok: true, row: null });
      }

      const row = await loadCurrentSubscription(memberId);

      return res.json({
        ok: true,
        row,
      });
    } catch (err) {
      console.error("GET subscription current error:", err);
      return res.status(500).json({ error: "Failed to load subscription." });
    }
  }
);

router.patch(
  "/toggle-auto-payment",
  authRequired,
  requireRole("member", "admin", "finance", "super_admin"),
  async (req, res) => {
    try {
      const memberId = await getMemberIdForUser(req.user.id);
      if (!memberId) {
        return res.status(400).json({ error: "No member account linked." });
      }

      const enabled = req.body.enabled === true || req.body.enabled === 1 || req.body.enabled === "1";

      const [[sub]] = await pool.query(
        `
        SELECT id, stripe_subscription_id
        FROM tbl_finance_dues_subscriptions
        WHERE member_id = ?
        ORDER BY id DESC
        LIMIT 1
        `,
        [memberId]
      );

      if (!sub) {
        return res.status(404).json({
          error: "No subscription found. Start auto-payment first.",
        });
      }

      await pool.query(
        `
        UPDATE tbl_finance_dues_subscriptions
        SET
          auto_renew = ?,
          auto_payment_enabled = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [enabled ? 1 : 0, enabled ? 1 : 0, sub.id]
      );

      return res.json({
        ok: true,
        message: enabled ? "Auto-payment enabled." : "Auto-payment disabled.",
      });
    } catch (err) {
      console.error("PATCH /subscription/toggle-auto-payment error:", err);
      return res.status(500).json({ error: "Failed to update auto-payment." });
    }
  }
);

module.exports = router;