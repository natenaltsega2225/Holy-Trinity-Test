// backend/routes/dues.js
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

const ALLOWED_MEMBER_ROLES = [
  "member",
  "finance",
  "admin",
  "super_admin",
];

const PLAN_OPTIONS = [
  "monthly",
  "3_month",
  "6_month",
  "12_month",
  "one_time",
];

let duesPlanColumnsCache = null;

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

function toMoney(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : fallback;
}

function cents(value) {
  return Math.round(toMoney(value, 0) * 100);
}

function userIdFrom(req) {
  return Number(
    req.user?.id ||
      req.user?.user_id ||
      req.user?.userId ||
      0
  );
}

function sqlString(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

async function getDuesPlanColumns() {
  if (duesPlanColumnsCache) return duesPlanColumnsCache;

  const [rows] = await pool.query(
    "SHOW COLUMNS FROM tbl_finance_dues_plans"
  );

  duesPlanColumnsCache = new Set(
    rows.map((row) => String(row.Field || "").toLowerCase())
  );

  return duesPlanColumnsCache;
}

function hasColumn(columns, name) {
  return columns.has(String(name || "").toLowerCase());
}

function selectColumn(columns, names, fallback, alias) {
  const list = Array.isArray(names) ? names : [names];

  for (const name of list) {
    if (hasColumn(columns, name)) {
      return alias && alias !== name
        ? `${name} AS ${alias}`
        : name;
    }
  }

  return `${fallback} AS ${alias || list[0]}`;
}

function normalizeOption(value) {
  const option = String(value || "monthly")
    .trim()
    .toLowerCase();

  if (PLAN_OPTIONS.includes(option)) {
    return option;
  }

  return "monthly";
}

function durationFromOption(option) {
  const value = normalizeOption(option);

  if (value === "3_month") return 3;
  if (value === "6_month") return 6;
  if (value === "12_month") return 12;

  return 1;
}

function intervalMeta(option) {
  const value = normalizeOption(option);

  if (value === "12_month") {
    return {
      intervalUnit: "year",
      intervalCount: 1,
      durationMonths: 12,
      recurring: true,
    };
  }

  if (value === "6_month") {
    return {
      intervalUnit: "month",
      intervalCount: 6,
      durationMonths: 6,
      recurring: true,
    };
  }

  if (value === "3_month") {
    return {
      intervalUnit: "month",
      intervalCount: 3,
      durationMonths: 3,
      recurring: true,
    };
  }

  if (value === "one_time") {
    return {
      intervalUnit: "month",
      intervalCount: 1,
      durationMonths: 1,
      recurring: false,
    };
  }

  return {
    intervalUnit: "month",
    intervalCount: 1,
    durationMonths: 1,
    recurring: true,
  };
}

function planLabelFromOption(option) {
  const value = normalizeOption(option);

  if (value === "3_month") return "3-Month Plan";
  if (value === "6_month") return "6-Month Plan";
  if (value === "12_month") return "12-Month Plan";
  if (value === "one_time") return "One-Time Plan";

  return "Monthly Plan";
}

function parsePresetAmounts(value) {
  if (!value) return [];

  try {
    const parsed =
      typeof value === "string"
        ? JSON.parse(value)
        : value;

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => toMoney(item, 0))
      .filter((item) => item > 0);
  } catch {
    return [];
  }
}

function normalizePlan(row = {}) {
  const durationMonths =
    Number(row.duration_months || 0) ||
    durationFromOption(row.billing_cycle);

  const amount = toMoney(
    row.minimum_amount ??
      row.amount ??
      row.price ??
      row.membership_amount ??
      row.monthly_amount,
    0
  );

  const registrationFee = toMoney(row.registration_fee, 0);
  const active = Number(row.is_active ?? 1) === 1;
  const defaultPlan = Number(row.is_default || row.default_plan || 0) === 1;

  return {
    ...row,

    id: row.id,
    plan_id: row.id,
    dues_plan_id: row.id,

    plan_code: row.plan_code || `PLAN-${row.id}`,
    plan_name: row.plan_name || row.name || "Membership Plan",
    name: row.plan_name || row.name || "Membership Plan",
    title: row.plan_name || row.name || "Membership Plan",
    description: row.description || null,

    minimum_amount: amount,
    amount,
    price: amount,
    membership_amount: amount,
    dues_amount: amount,
    current_amount: amount,
    monthly_equivalent:
      durationMonths > 0
        ? toMoney(amount / durationMonths, 0)
        : amount,

    registration_fee: registrationFee,
    new_member_fee: registrationFee,
    signup_fee: registrationFee,

    billing_cycle: normalizeOption(row.billing_cycle),
    selected_option: normalizeOption(row.billing_cycle),
    plan_label: planLabelFromOption(row.billing_cycle),

    duration_months: durationMonths,
    months: durationMonths,
    coverage_months: durationMonths,

    preset_amounts: parsePresetAmounts(row.preset_amounts_json),
    allow_custom_amount: Number(row.allow_custom_amount || 0),

    allow_online_payment:
      row.allow_online_payment === undefined
        ? 1
        : Number(row.allow_online_payment || 0),

    allow_manual_payment:
      row.allow_manual_payment === undefined
        ? 1
        : Number(row.allow_manual_payment || 0),

    member_type: row.member_type || "member",
    sort_order: Number(row.sort_order || 0),

    is_active: active ? 1 : 0,
    active: active ? 1 : 0,
    status: active ? "active" : "inactive",

    is_default: defaultPlan ? 1 : 0,
    default_plan: defaultPlan ? 1 : 0,
  };
}

function buildPlanSelect(columns) {
  return `
    SELECT
      id,
      ${selectColumn(columns, "plan_code", "CONCAT('PLAN-', id)", "plan_code")},
      ${selectColumn(columns, ["plan_name", "name", "title"], "'Membership Plan'", "plan_name")},
      ${selectColumn(columns, "description", "NULL", "description")},
      ${selectColumn(columns, ["minimum_amount", "amount", "price", "membership_amount"], "0", "minimum_amount")},
      ${selectColumn(columns, "preset_amounts_json", "NULL", "preset_amounts_json")},
      ${selectColumn(columns, "registration_fee", "0", "registration_fee")},
      ${selectColumn(columns, "billing_cycle", "'monthly'", "billing_cycle")},
      ${selectColumn(columns, ["duration_months", "months", "coverage_months"], "1", "duration_months")},
      ${selectColumn(columns, "allow_custom_amount", "0", "allow_custom_amount")},
      ${selectColumn(columns, "allow_online_payment", "1", "allow_online_payment")},
      ${selectColumn(columns, "allow_manual_payment", "1", "allow_manual_payment")},
      ${selectColumn(columns, "member_type", "'member'", "member_type")},
      ${selectColumn(columns, "sort_order", "0", "sort_order")},
      ${selectColumn(columns, "is_default", "0", "is_default")},
      ${selectColumn(columns, "is_active", "1", "is_active")}
    FROM tbl_finance_dues_plans
  `;
}

function activeWhere(columns) {
  if (hasColumn(columns, "is_active")) {
    return "COALESCE(is_active, 1) = 1";
  }

  if (hasColumn(columns, "status")) {
    return "LOWER(COALESCE(status, 'active')) = 'active'";
  }

  return "1 = 1";
}

function planOrderBy(columns) {
  const order = [];

  if (hasColumn(columns, "sort_order")) {
    order.push("sort_order ASC");
  }

  if (hasColumn(columns, "duration_months")) {
    order.push("duration_months ASC");
  }

  order.push("id ASC");

  return order.join(", ");
}

function buildAmountFromSelection(plan, customAmount) {
  const minimum = toMoney(
    plan?.minimum_amount ||
      plan?.amount ||
      plan?.membership_amount ||
      0,
    0
  );

  const custom = toMoney(customAmount, 0);

  if (custom > 0) {
    if (!Number(plan?.allow_custom_amount || 0)) {
      throw new Error(
        "Custom amount is not allowed for this membership plan."
      );
    }

    if (custom < minimum) {
      throw new Error(
        `Custom amount must be at least ${minimum.toFixed(2)}.`
      );
    }

    return custom;
  }

  return minimum;
}

function calculateCoverage({
  totalPaid,
  minimumAmount,
  registrationFee = 0,
  durationMonths = 1,
}) {
  const total = toMoney(totalPaid, 0);
  const periodAmount = toMoney(minimumAmount, 0);
  const regFee = toMoney(registrationFee, 0);
  const monthsPerPeriod = Math.max(1, Number(durationMonths || 1));

  if (total <= 0 || periodAmount <= 0) {
    return {
      months_paid: 0,
      membership_amount_applied: 0,
      remaining_credit: 0,
      periods_paid: 0,
    };
  }

  const membershipAmount = Math.max(
    0,
    toMoney(total - regFee, 0)
  );

  const periodsPaid = Math.max(
    1,
    Math.floor(membershipAmount / periodAmount)
  );

  const remainingCredit = toMoney(
    membershipAmount - periodsPaid * periodAmount,
    0
  );

  return {
    months_paid: periodsPaid * monthsPerPeriod,
    membership_amount_applied: membershipAmount,
    remaining_credit: remainingCredit,
    periods_paid: periodsPaid,
  };
}

function requireStripeClient() {
  if (!stripe) {
    const err = new Error(
      "Stripe is not configured. STRIPE_SECRET_KEY is missing."
    );
    err.statusCode = 503;
    throw err;
  }

  return stripe;
}

async function getMemberContext(userId) {
  if (!userId) return null;

  const [[row]] = await pool.query(
    `
    SELECT
      u.id AS user_id,
      u.email AS user_email,
      u.role,
      u.member_id,

      m.id AS member_id_resolved,
      m.full_name,
      m.email AS member_email,
      m.member_no,
      m.status,
      m.membership_status

    FROM tbl_users u

    LEFT JOIN tbl_members m
      ON m.id = u.member_id

    WHERE u.id = ?
    LIMIT 1
    `,
    [userId]
  );

  if (!row) return null;

  return {
    user_id: row.user_id,
    role: row.role,
    email: row.user_email || row.member_email || null,
    member_id:
      Number(row.member_id_resolved || row.member_id || 0) ||
      null,
    member_no: row.member_no || null,
    full_name: row.full_name || null,
    status: row.status || null,
    membership_status: row.membership_status || null,
  };
}

async function getPlanById(planId) {
  const columns = await getDuesPlanColumns();

  const [[row]] = await pool.query(
    `
    ${buildPlanSelect(columns)}
    WHERE id = ?
    LIMIT 1
    `,
    [planId]
  );

  return row ? normalizePlan(row) : null;
}

async function getActivePlanByOption(option) {
  const columns = await getDuesPlanColumns();
  const normalized = normalizeOption(option);

  const [[row]] = await pool.query(
    `
    ${buildPlanSelect(columns)}
    WHERE ${activeWhere(columns)}
      AND COALESCE(billing_cycle, 'monthly') = ?
    ORDER BY ${planOrderBy(columns)}
    LIMIT 1
    `,
    [normalized]
  );

  return row ? normalizePlan(row) : null;
}

async function getStripeCustomer(member) {
  if (!member?.member_id) return undefined;

  const [[existing]] = await pool.query(
    `
    SELECT stripe_customer_id
    FROM tbl_finance_dues_subscriptions
    WHERE member_id = ?
      AND stripe_customer_id IS NOT NULL
    ORDER BY id DESC
    LIMIT 1
    `,
    [member.member_id]
  );

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id;
  }

  const client = requireStripeClient();

  const customer = await client.customers.create({
    email: member.email || undefined,
    name: member.full_name || undefined,
    metadata: {
      member_id: String(member.member_id),
      user_id: String(member.user_id || ""),
      member_no: member.member_no || "",
    },
  });

  return customer.id;
}

router.get("/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "dues",
    version: "enterprise-schema-safe",
    stripe_configured: Boolean(process.env.STRIPE_SECRET_KEY),
    timestamp: new Date().toISOString(),
  });
});

router.get("/plans", async (_req, res) => {
  try {
    const columns = await getDuesPlanColumns();

    const [rows] = await pool.query(
      `
      ${buildPlanSelect(columns)}
      WHERE ${activeWhere(columns)}
      ORDER BY ${planOrderBy(columns)}
      `
    );

    const plans = rows.map(normalizePlan);

    return res.json({
      ok: true,
      rows: plans,
      plans,
      count: plans.length,
    });
  } catch (err) {
    console.error("GET /dues/plans error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to load dues plans.",
    });
  }
});

router.get("/plans/:id", async (req, res) => {
  try {
    const plan = await getPlanById(req.params.id);

    if (!plan || Number(plan.is_active) !== 1) {
      return res.status(404).json({
        ok: false,
        error: "Membership plan not found.",
      });
    }

    return res.json({
      ok: true,
      plan,
    });
  } catch (err) {
    console.error("GET /dues/plans/:id error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to load dues plan.",
    });
  }
});

router.post(
  "/create-checkout-session",
  authRequired,
  requireRole(...ALLOWED_MEMBER_ROLES),
  async (req, res) => {
    try {
      const client = requireStripeClient();
      const ctx = await getMemberContext(userIdFrom(req));

      if (!ctx?.member_id) {
        return res.status(400).json({
          ok: false,
          error: "No member account is linked to this user.",
        });
      }

      const planId = Number(req.body.plan_id || req.body.dues_plan_id);
      const selectedOption = normalizeOption(req.body.selected_option);
      const customAmount = req.body.custom_amount;
      const registrationMode = clean(
        req.body.registration_mode || "",
        50
      ).toLowerCase();

      const successUrl = clean(req.body.success_url, 600);
      const cancelUrl = clean(req.body.cancel_url, 600);

      if (!planId) {
        return res.status(400).json({
          ok: false,
          error: "plan_id is required.",
        });
      }

      if (!successUrl || !cancelUrl) {
        return res.status(400).json({
          ok: false,
          error: "Success and cancel URLs are required.",
        });
      }

      const plan = await getPlanById(planId);

      if (!plan || Number(plan.is_active) !== 1) {
        return res.status(404).json({
          ok: false,
          error: "Membership plan not found.",
        });
      }

      if (normalizeOption(plan.billing_cycle) !== selectedOption) {
        return res.status(400).json({
          ok: false,
          error: "Selected option does not match the selected plan.",
        });
      }

      const interval = intervalMeta(selectedOption);
      const membershipFee = buildAmountFromSelection(
        plan,
        customAmount
      );

      const registrationFee =
        registrationMode === "initial_registration"
          ? toMoney(plan.registration_fee, 0)
          : 0;

      const totalAmount = toMoney(
        membershipFee + registrationFee,
        0
      );

      const coverage = calculateCoverage({
        totalPaid: totalAmount,
        minimumAmount: plan.minimum_amount,
        registrationFee,
        durationMonths: interval.durationMonths,
      });

      const paymentKind =
        registrationMode === "initial_registration"
          ? "registration_with_plan"
          : "membership";

      const lineItems = [];

      if (registrationFee > 0) {
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: cents(registrationFee),
            product_data: {
              name: "Membership Registration Fee",
            },
          },
        });
      }

      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: cents(membershipFee),
          product_data: {
            name: `${plan.plan_name} - ${planLabelFromOption(selectedOption)}`,
          },
        },
      });

      const session = await client.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: ctx.email || undefined,
        client_reference_id: String(ctx.member_id),
        line_items: lineItems,
        metadata: {
          checkout_type:
            paymentKind === "registration_with_plan"
              ? "registration_with_plan"
              : "member_dues_payment",

          payment_kind: paymentKind,
          category: "membership",
          payment_type: "membership",
          source: "member_dues_checkout",

          user_id: String(ctx.user_id || ""),
          member_id: String(ctx.member_id),
          member_no: ctx.member_no || "",
          full_name: clean(ctx.full_name || "", 180),
          email: clean(ctx.email || "", 190),

          plan_id: String(plan.id),
          dues_plan_id: String(plan.id),
          plan_code: clean(plan.plan_code || "", 80),
          plan_name: clean(plan.plan_name || "", 150),
          selected_option: selectedOption,
          plan_label: planLabelFromOption(selectedOption),

          duration_months: String(interval.durationMonths),
          months_paid: String(
            coverage.months_paid || interval.durationMonths
          ),
          interval_unit: interval.intervalUnit,
          interval_count: String(interval.intervalCount),

          registration_mode: registrationMode,
          registration_fee: String(registrationFee),
          membership_fee: String(membershipFee),
          membership_amount: String(membershipFee),
          total_amount: String(totalAmount),

          remaining_credit: String(coverage.remaining_credit),
          membership_amount_applied: String(
            coverage.membership_amount_applied
          ),

          auto_renew: "0",
          auto_payment_enabled: "0",
        },
      });

      return res.json({
        ok: true,
        url: session.url,
        checkout_url: session.url,
        session_id: session.id,
      });
    } catch (err) {
      console.error("POST /dues/create-checkout-session error:", err);

      return res.status(err.statusCode || 500).json({
        ok: false,
        error:
          err.message ||
          "Failed to create membership checkout session.",
      });
    }
  }
);

router.post(
  "/create-subscription-session",
  authRequired,
  requireRole(...ALLOWED_MEMBER_ROLES),
  async (req, res) => {
    try {
      const client = requireStripeClient();
      const ctx = await getMemberContext(userIdFrom(req));

      if (!ctx?.member_id) {
        return res.status(400).json({
          ok: false,
          error: "No member account is linked to this user.",
        });
      }

      const planId = Number(req.body.plan_id || req.body.dues_plan_id);
      const selectedOption = normalizeOption(req.body.selected_option);
      const customAmount = req.body.custom_amount;
      const successUrl = clean(req.body.success_url, 600);
      const cancelUrl = clean(req.body.cancel_url, 600);

      if (!planId) {
        return res.status(400).json({
          ok: false,
          error: "plan_id is required.",
        });
      }

      if (!successUrl || !cancelUrl) {
        return res.status(400).json({
          ok: false,
          error: "Success and cancel URLs are required.",
        });
      }

      const plan = await getPlanById(planId);

      if (!plan || Number(plan.is_active) !== 1) {
        return res.status(404).json({
          ok: false,
          error: "Membership plan not found.",
        });
      }

      if (normalizeOption(plan.billing_cycle) !== selectedOption) {
        return res.status(400).json({
          ok: false,
          error: "Selected option does not match the selected plan.",
        });
      }

      const interval = intervalMeta(selectedOption);

      if (!interval.recurring) {
        return res.status(400).json({
          ok: false,
          error: "Selected plan is not eligible for subscription billing.",
        });
      }

      const membershipFee = buildAmountFromSelection(
        plan,
        customAmount
      );

      const customerId = await getStripeCustomer(ctx);

      const session = await client.checkout.sessions.create({
        mode: "subscription",
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer: customerId,
        client_reference_id: String(ctx.member_id),
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: cents(membershipFee),
              recurring: {
                interval: interval.intervalUnit,
                interval_count: interval.intervalCount,
              },
              product_data: {
                name: `${plan.plan_name} Auto Pay - ${planLabelFromOption(
                  selectedOption
                )}`,
              },
            },
          },
        ],
        metadata: {
          checkout_type: "member_dues_subscription",
          payment_kind: "membership_autorenew",
          category: "membership",
          payment_type: "membership",
          source: "member_dues_subscription",

          user_id: String(ctx.user_id || ""),
          member_id: String(ctx.member_id),
          member_no: ctx.member_no || "",
          full_name: clean(ctx.full_name || "", 180),
          email: clean(ctx.email || "", 190),

          plan_id: String(plan.id),
          dues_plan_id: String(plan.id),
          plan_code: clean(plan.plan_code || "", 80),
          plan_name: clean(plan.plan_name || "", 150),
          selected_option: selectedOption,
          plan_label: planLabelFromOption(selectedOption),

          duration_months: String(interval.durationMonths),
          months_paid: String(interval.durationMonths),
          interval_unit: interval.intervalUnit,
          interval_count: String(interval.intervalCount),

          registration_fee: "0",
          membership_fee: String(membershipFee),
          membership_amount: String(membershipFee),
          total_amount: String(membershipFee),
          remaining_credit: "0",
          membership_amount_applied: String(membershipFee),
          registration_mode: "",

          auto_renew: "1",
          auto_payment_enabled: "1",
        },
      });

      return res.json({
        ok: true,
        url: session.url,
        checkout_url: session.url,
        session_id: session.id,
      });
    } catch (err) {
      console.error("POST /dues/create-subscription-session error:", err);

      return res.status(err.statusCode || 500).json({
        ok: false,
        error:
          err.message ||
          "Failed to create auto-payment session.",
      });
    }
  }
);

router.patch(
  "/change-subscription-plan",
  authRequired,
  requireRole(...ALLOWED_MEMBER_ROLES),
  async (req, res) => {
    try {
      const ctx = await getMemberContext(userIdFrom(req));
      const subscriptionId = Number(req.body.subscription_id);
      const selectedOption = normalizeOption(req.body.selected_option);
      const customAmount = req.body.custom_amount;

      if (!subscriptionId) {
        return res.status(400).json({
          ok: false,
          error: "subscription_id is required.",
        });
      }

      const [[subscription]] = await pool.query(
        `
        SELECT
          id,
          member_id,
          status,
          stripe_subscription_id
        FROM tbl_finance_dues_subscriptions
        WHERE id = ?
        LIMIT 1
        `,
        [subscriptionId]
      );

      if (!subscription) {
        return res.status(404).json({
          ok: false,
          error: "Subscription not found.",
        });
      }

      if (
        req.user.role === "member" &&
        Number(subscription.member_id) !== Number(ctx?.member_id)
      ) {
        return res.status(403).json({
          ok: false,
          error: "You cannot change this subscription.",
        });
      }

      const plan = await getActivePlanByOption(selectedOption);

      if (!plan) {
        return res.status(404).json({
          ok: false,
          error: "No active plan found for the selected billing option.",
        });
      }

      const selectedAmount = buildAmountFromSelection(
        plan,
        customAmount
      );

      const interval = intervalMeta(selectedOption);

      await pool.query(
        `
        UPDATE tbl_finance_dues_subscriptions
        SET
          next_plan_id = ?,
          change_effective_at = NOW(),
          current_amount = ?,
          interval_unit = ?,
          interval_count = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          plan.id,
          selectedAmount,
          interval.intervalUnit,
          interval.intervalCount,
          subscriptionId,
        ]
      );

      return res.json({
        ok: true,
        message:
          "Subscription change saved. The new plan will apply on the next billing cycle.",
        next_plan: plan,
        selected_amount: selectedAmount,
      });
    } catch (err) {
      console.error("PATCH /dues/change-subscription-plan error:", err);

      return res.status(500).json({
        ok: false,
        error:
          err.message ||
          "Failed to change subscription plan.",
      });
    }
  }
);

module.exports = router;