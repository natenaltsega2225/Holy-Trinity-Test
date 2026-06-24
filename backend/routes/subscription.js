// backend/routes/subscription.js
"use strict";

const express = require("express");
const Stripe = require("stripe");

const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const FINANCE_ROLES = [
  "finance",
  "admin",
  "super_admin",
];

const MONTHS = [
  null,
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function boolValue(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;

  const text = clean(value, 20).toLowerCase();
  return ["1", "true", "yes", "y", "on", "enabled"].includes(text);
}

function actorRole(req) {
  return clean(req.user?.role || req.auth?.role || "", 80).toLowerCase();
}

function actorId(req) {
  return (
    req.user?.id ||
    req.user?.user_id ||
    req.auth?.id ||
    req.auth?.user_id ||
    null
  );
}

function isFinance(req) {
  return FINANCE_ROLES.includes(actorRole(req));
}

function quoteIdent(value) {
  const ident = String(value || "");

  if (!/^[A-Za-z0-9_]+$/.test(ident)) {
    throw new Error("Unsafe SQL identifier.");
  }

  return `\`${ident}\``;
}

async function tableExists(tableName) {
  const [rows] = await pool.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function getTableColumns(tableName) {
  if (!(await tableExists(tableName))) return new Set();

  const [rows] = await pool.query(`SHOW COLUMNS FROM ${quoteIdent(tableName)}`);
  return new Set(rows.map((row) => row.Field));
}

function selectColumn(columns, alias, column, asName = column, fallback = "NULL") {
  if (columns.has(column)) {
    return `${alias}.${quoteIdent(column)} AS ${quoteIdent(asName)}`;
  }

  return `${fallback} AS ${quoteIdent(asName)}`;
}

function buildOrder(columns, alias = "s") {
  const parts = [];

  if (columns.has("updated_at")) {
    parts.push(`${alias}.updated_at DESC`);
  }

  if (columns.has("created_at")) {
    parts.push(`${alias}.created_at DESC`);
  }

  parts.push(`${alias}.id DESC`);

  return parts.join(", ");
}

async function getMemberIdForUser(userId) {
  if (!userId) return null;

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

async function resolveMemberId(req) {
  if (isFinance(req)) {
    const requested =
      Number(req.query.member_id || req.body?.member_id || 0) || null;

    if (requested) return requested;
  }

  const direct =
    Number(
      req.user?.member_id ||
        req.user?.memberId ||
        req.auth?.member_id ||
        req.auth?.memberId ||
        0
    ) || null;

  if (direct) return direct;

  return getMemberIdForUser(actorId(req));
}

function normalizePlanType(value, intervalCount = 1, intervalUnit = "month") {
  const raw = clean(value, 80).toLowerCase();
  const count = Number(intervalCount || 1);
  const unit = clean(intervalUnit || "month", 40).toLowerCase();

  if (raw === "12_month" || count === 12) return "12_month";
  if (raw === "6_month" || count === 6) return "6_month";
  if (raw === "3_month" || count === 3) return "3_month";

  if (count === 1 && unit === "year") {
    return "12_month";
  }

  return "monthly";
}

function buildCardDisplay(cardBrand, cardLast4) {
  if (!cardBrand || !cardLast4) return "--";
  return `${String(cardBrand).toUpperCase()} **** ${cardLast4}`;
}

function parseMonth(value) {
  if (!value) return null;

  const numeric = Number(value);

  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) {
    return {
      year: null,
      month: numeric,
    };
  }

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
    };
  }

  return null;
}

function buildCoverageLabel(row = {}) {
  if (row.coverage_label) {
    return row.coverage_label;
  }

  const start =
    parseMonth(row.coverage_start_month) ||
    parseMonth(row.coverage_start) ||
    parseMonth(row.start_date);

  const end =
    parseMonth(row.coverage_end_month) ||
    parseMonth(row.coverage_end) ||
    parseMonth(row.end_date);

  if (!start || !end) return "--";

  const startLabel = start.year
    ? `${MONTHS[start.month]} ${start.year}`
    : MONTHS[start.month];

  const endLabel = end.year
    ? `${MONTHS[end.month]} ${end.year}`
    : MONTHS[end.month];

  return `${startLabel} - ${endLabel}`;
}

function normalizeSubscription(row = {}) {
  const intervalCount =
    Number(row.interval_count || row.duration_months || row.months_paid || 1) || 1;

  const planType = normalizePlanType(
    row.plan_code,
    intervalCount,
    row.interval_unit
  );

  const planDuration =
    intervalCount === 1
      ? "1 Month"
      : `${intervalCount} Months`;

  return {
    ...row,

    plan_type: planType,
    plan_duration: row.plan_duration || planDuration,

    coverage_label: buildCoverageLabel(row),

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

    months_paid: Number(row.months_paid || 0),
    months_remaining: Number(row.months_remaining || 0),

    auto_renew: Number(row.auto_renew || 0),
    auto_payment_enabled: Number(row.auto_payment_enabled || 0),

    card_display: buildCardDisplay(row.card_brand, row.card_last4),
    payment_card: buildCardDisplay(row.card_brand, row.card_last4),
  };
}

function sendError(res, err, label) {
  const status =
    err?.statusCode ||
    err?.status ||
    (/not found/i.test(err?.message || "")
      ? 404
      : /required|invalid|missing|start auto-payment/i.test(err?.message || "")
        ? 400
        : /access denied|forbidden/i.test(err?.message || "")
          ? 403
          : 500);

  if (status >= 500) {
    console.error(`${label} error:`, err);
  } else {
    console.warn(`${label} warning:`, err?.message || err);
  }

  return res.status(status).json({
    ok: false,
    error:
      status >= 500 && process.env.NODE_ENV === "production"
        ? "Subscription request failed."
        : err?.message || "Subscription request failed.",
  });
}

/* -------------------------------------------------------------------------- */
/* Loaders                                                                    */
/* -------------------------------------------------------------------------- */

async function loadLastCardPayment(memberId) {
  if (!(await tableExists("tbl_finance_payments"))) return null;

  const columns = await getTableColumns("tbl_finance_payments");

  if (!columns.has("member_id")) return null;

  const select = [
    selectColumn(columns, "p", "card_brand"),
    selectColumn(columns, "p", "card_last4"),
    selectColumn(columns, "p", "card_exp_month"),
    selectColumn(columns, "p", "card_exp_year"),
    selectColumn(columns, "p", "cardholder_name"),
  ];

  const where = ["p.member_id = ?"];
  const params = [memberId];

  if (columns.has("card_last4")) {
    where.push("p.card_last4 IS NOT NULL");
  }

  if (columns.has("status")) {
    where.push(
      "p.status IN ('paid', 'posted', 'completed', 'approved')"
    );
  }

  const order = buildOrder(columns, "p");

  const [rows] = await pool.query(
    `
    SELECT ${select.join(", ")}
    FROM tbl_finance_payments p
    WHERE ${where.join(" AND ")}
    ORDER BY ${order}
    LIMIT 1
    `,
    params
  );

  return rows[0] || null;
}

async function loadSubscriptionRows(memberId, options = {}) {
  if (!(await tableExists("tbl_finance_dues_subscriptions"))) {
    return [];
  }

  const subscriptionColumns = await getTableColumns("tbl_finance_dues_subscriptions");
  const planTableExists = await tableExists("tbl_finance_dues_plans");
  const planColumns = planTableExists
    ? await getTableColumns("tbl_finance_dues_plans")
    : new Set();

  const select = [
    selectColumn(subscriptionColumns, "s", "id"),
    selectColumn(subscriptionColumns, "s", "member_id"),
    selectColumn(subscriptionColumns, "s", "dues_plan_id"),
    selectColumn(subscriptionColumns, "s", "membership_plan_id"),

    selectColumn(subscriptionColumns, "s", "start_date"),
    selectColumn(subscriptionColumns, "s", "end_date"),
    selectColumn(subscriptionColumns, "s", "coverage_start"),
    selectColumn(subscriptionColumns, "s", "coverage_end"),
    selectColumn(subscriptionColumns, "s", "coverage_start_month"),
    selectColumn(subscriptionColumns, "s", "coverage_end_month"),
    selectColumn(subscriptionColumns, "s", "coverage_label"),

    selectColumn(subscriptionColumns, "s", "months_paid", "months_paid", "0"),
    selectColumn(subscriptionColumns, "s", "months_remaining", "months_remaining", "0"),

    selectColumn(subscriptionColumns, "s", "next_renewal_date"),
    selectColumn(subscriptionColumns, "s", "status", "status", "'active'"),
    selectColumn(subscriptionColumns, "s", "auto_renew", "auto_renew", "0"),
    selectColumn(subscriptionColumns, "s", "auto_payment_enabled", "auto_payment_enabled", "0"),
    selectColumn(subscriptionColumns, "s", "current_amount", "current_amount", "0"),
    selectColumn(subscriptionColumns, "s", "amount", "amount", "0"),
    selectColumn(subscriptionColumns, "s", "total_amount", "total_amount", "0"),

    selectColumn(subscriptionColumns, "s", "interval_unit", "interval_unit", "'month'"),
    selectColumn(subscriptionColumns, "s", "interval_count", "interval_count", "1"),
    selectColumn(subscriptionColumns, "s", "duration_months", "duration_months", "1"),

    selectColumn(subscriptionColumns, "s", "stripe_subscription_id"),
    selectColumn(subscriptionColumns, "s", "created_at"),
    selectColumn(subscriptionColumns, "s", "updated_at"),
  ];

  let join = "";

  if (planTableExists) {
    join = `
      LEFT JOIN tbl_finance_dues_plans p
        ON p.id = s.dues_plan_id
    `;

    select.push(
      selectColumn(planColumns, "p", "plan_name"),
      selectColumn(planColumns, "p", "plan_code"),
      selectColumn(planColumns, "p", "duration_months", "plan_duration_months", "1")
    );
  } else {
    select.push(
      "NULL AS plan_name",
      "NULL AS plan_code",
      "NULL AS plan_duration_months"
    );
  }

  const limit = Math.min(
    100,
    Math.max(1, Number(options.limit || 25))
  );

  const order = buildOrder(subscriptionColumns, "s");

  const [rows] = await pool.query(
    `
    SELECT ${select.join(", ")}
    FROM tbl_finance_dues_subscriptions s
    ${join}
    WHERE s.member_id = ?
    ORDER BY ${order}
    LIMIT ?
    `,
    [memberId, limit]
  );

  const card = await loadLastCardPayment(memberId);

  return rows.map((row) =>
    normalizeSubscription({
      ...row,
      ...(card || {}),
      plan_name: row.plan_name || "Membership Plan",
      duration_months:
        row.duration_months ||
        row.plan_duration_months ||
        row.interval_count ||
        1,
    })
  );
}

async function loadCurrentSubscription(memberId) {
  const rows = await loadSubscriptionRows(memberId, {
    limit: 1,
  });

  return rows[0] || null;
}

async function loadSubscriptionByMember(memberId) {
  if (!(await tableExists("tbl_finance_dues_subscriptions"))) {
    return null;
  }

  const [rows] = await pool.query(
    `
    SELECT *
    FROM tbl_finance_dues_subscriptions
    WHERE member_id = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [memberId]
  );

  return rows[0] || null;
}

/* -------------------------------------------------------------------------- */
/* Stripe Auto Payment                                                        */
/* -------------------------------------------------------------------------- */

async function updateStripeAutoPayment(subscriptionId, enabled) {
  if (!subscriptionId) {
    return {
      skipped: true,
      reason: "No Stripe subscription id.",
    };
  }

  if (!stripe) {
    const err = new Error("Stripe is not configured; cannot update auto-payment.");
    err.statusCode = 503;
    throw err;
  }

  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: !enabled,
    metadata: {
      auto_payment_enabled: enabled ? "true" : "false",
      updated_from: "member_subscription_route",
      updated_at: new Date().toISOString(),
    },
  });

  return {
    success: true,
    stripe_subscription_id: subscription.id,
    cancel_at_period_end: subscription.cancel_at_period_end,
    status: subscription.status,
  };
}

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "subscription",
    version: "enterprise",
    stripe_configured: Boolean(process.env.STRIPE_SECRET_KEY),
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* Security                                                                   */
/* -------------------------------------------------------------------------- */

router.use(authRequired);

router.use(
  requireRole(
    "member",
    "finance",
    "admin",
    "super_admin"
  )
);

/* -------------------------------------------------------------------------- */
/* Current Subscription                                                       */
/* -------------------------------------------------------------------------- */

router.get(["/", "/current"], async (req, res) => {
  try {
    const memberId = await resolveMemberId(req);

    if (!memberId) {
      return res.json({
        ok: true,
        row: null,
      });
    }

    const row = await loadCurrentSubscription(memberId);

    return res.json({
      ok: true,
      row,
    });
  } catch (err) {
    return sendError(res, err, "subscription current");
  }
});

/* -------------------------------------------------------------------------- */
/* Subscription History                                                       */
/* -------------------------------------------------------------------------- */

router.get("/history", async (req, res) => {
  try {
    const memberId = await resolveMemberId(req);

    if (!memberId) {
      return res.status(403).json({
        ok: false,
        error: "Member account not linked.",
      });
    }

    const rows = await loadSubscriptionRows(memberId, {
      limit: req.query.limit,
    });

    return res.json({
      ok: true,
      rows,
    });
  } catch (err) {
    return sendError(res, err, "subscription history");
  }
});

/* -------------------------------------------------------------------------- */
/* Auto Payment Toggle                                                        */
/* -------------------------------------------------------------------------- */

async function toggleAutoPayment(req, res) {
  try {
    const memberId = await resolveMemberId(req);

    if (!memberId) {
      return res.status(400).json({
        ok: false,
        error: "No member account linked.",
      });
    }

    const enabled = boolValue(req.body?.enabled);

    const subscription = await loadSubscriptionByMember(memberId);

    if (!subscription) {
      return res.status(404).json({
        ok: false,
        error: "No subscription found.",
      });
    }

    if (enabled && !subscription.stripe_subscription_id) {
      return res.status(400).json({
        ok: false,
        error: "Start auto-payment first before enabling automatic charges.",
      });
    }

    const stripeResult = subscription.stripe_subscription_id
      ? await updateStripeAutoPayment(subscription.stripe_subscription_id, enabled)
      : {
          skipped: true,
          reason: "Manual subscription only.",
        };

    await pool.query(
      `
      UPDATE tbl_finance_dues_subscriptions
      SET
        auto_renew = ?,
        auto_payment_enabled = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        enabled ? 1 : 0,
        enabled && subscription.stripe_subscription_id ? 1 : 0,
        subscription.id,
      ]
    );

    const row = await loadCurrentSubscription(memberId);

    return res.json({
      ok: true,
      message: enabled
        ? "Auto-payment enabled."
        : "Auto-payment disabled.",
      stripe: stripeResult,
      row,
    });
  } catch (err) {
    return sendError(res, err, "toggle auto-payment");
  }
}

router.patch("/toggle-auto-payment", toggleAutoPayment);
router.patch("/auto-payment", toggleAutoPayment);

/* -------------------------------------------------------------------------- */
/* Disable Auto Renew Alias                                                   */
/* -------------------------------------------------------------------------- */

router.post("/cancel-auto-renew", async (req, res) => {
  req.body = {
    ...(req.body || {}),
    enabled: false,
  };

  return toggleAutoPayment(req, res);
});

module.exports = router;