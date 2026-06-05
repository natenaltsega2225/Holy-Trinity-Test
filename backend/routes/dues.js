


// // backend/routes/dues.js


"use strict";

const express = require("express");
const Stripe = require("stripe");
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const ALLOWED_MEMBER_ROLES = ["member", "finance", "super_admin"];

function clean(v, max = 255) {
  return String(v ?? "").trim().slice(0, max);
}

function toMoney(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : fallback;
}

function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

function normalizeOption(value) {
  const v = String(value || "monthly").toLowerCase();
  if (["monthly", "3_month", "6_month", "12_month"].includes(v)) return v;
  return "monthly";
}

function durationFromOption(option) {
  const v = normalizeOption(option);
  if (v === "3_month") return 3;
  if (v === "6_month") return 6;
  if (v === "12_month") return 12;
  return 1;
}

function intervalMeta(option) {
  const v = normalizeOption(option);

  if (v === "12_month") {
    return { intervalUnit: "year", intervalCount: 1, durationMonths: 12 };
  }

  if (v === "6_month") {
    return { intervalUnit: "month", intervalCount: 6, durationMonths: 6 };
  }

  if (v === "3_month") {
    return { intervalUnit: "month", intervalCount: 3, durationMonths: 3 };
  }

  return { intervalUnit: "month", intervalCount: 1, durationMonths: 1 };
}

function planLabelFromOption(option) {
  const v = normalizeOption(option);
  if (v === "3_month") return "3-Month Plan";
  if (v === "6_month") return "6-Month Plan";
  if (v === "12_month") return "12-Month Plan";
  return "1-Month Plan";
}

function parsePresetAmounts(value) {
  if (!value) return [];

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => toMoney(item, 0))
      .filter((item) => Number.isFinite(item) && item > 0);
  } catch {
    return [];
  }
}

function buildAmountFromSelection(plan, customAmount) {
  const minimum = toMoney(plan?.minimum_amount || plan?.amount || 0, 0);
  const custom = toMoney(customAmount, 0);

  if (custom > 0) {
    if (!Number(plan?.allow_custom_amount || 0)) {
      throw new Error("Custom amount is not allowed for this membership plan.");
    }

    if (custom < minimum) {
      throw new Error(`Custom amount must be at least ${minimum.toFixed(2)}.`);
    }

    return custom;
  }

  return minimum;
}

function calculateCoverage({ totalPaid, minimumAmount, registrationFee = 0 }) {
  const total = Number(totalPaid || 0);
  const minimum = Number(minimumAmount || 0);
  const regFee = Number(registrationFee || 0);

  if (!Number.isFinite(total) || !Number.isFinite(minimum) || minimum <= 0) {
    return {
      months_paid: 0,
      membership_amount_applied: 0,
      remaining_credit: 0,
    };
  }

  const membershipAmount = Math.max(0, Number((total - regFee).toFixed(2)));
  const monthsPaid = Math.max(1, Math.floor(membershipAmount / minimum));
  const remainingCredit = Number(
    (membershipAmount - monthsPaid * minimum).toFixed(2)
  );

  return {
    months_paid: monthsPaid,
    membership_amount_applied: membershipAmount,
    remaining_credit: remainingCredit,
  };
}

async function getMemberContext(userId) {
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
    LEFT JOIN tbl_members m ON m.id = u.member_id
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
    member_id: Number(row.member_id_resolved || row.member_id || 0) || null,
    member_no: row.member_no || null,
    full_name: row.full_name || null,
    status: row.status || null,
    membership_status: row.membership_status || null,
  };
}

async function getPlanById(planId) {
  const [[row]] = await pool.query(
    `
    SELECT
      id,
      plan_code,
      plan_name,
      description,
      minimum_amount,
      preset_amounts_json,
      registration_fee,
      billing_cycle,
      duration_months,
      allow_custom_amount,
      member_type,
      sort_order,
      is_active
    FROM tbl_finance_dues_plans
    WHERE id = ?
    LIMIT 1
    `,
    [planId]
  );

  if (!row) return null;

  return {
    ...row,
    minimum_amount: toMoney(row.minimum_amount, 0),
    registration_fee: toMoney(row.registration_fee, 0),
    preset_amounts: parsePresetAmounts(row.preset_amounts_json),
    duration_months: Number(row.duration_months || 1),
    allow_custom_amount: Number(row.allow_custom_amount || 0),
    is_active: Number(row.is_active || 0),
  };
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

  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const customer = await stripe.customers.create({
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

router.get("/plans", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        id,
        plan_code,
        plan_name,
        description,
        minimum_amount,
        preset_amounts_json,
        registration_fee,
        billing_cycle,
        duration_months,
        allow_custom_amount,
        member_type,
        sort_order,
        is_active
      FROM tbl_finance_dues_plans
      WHERE is_active = 1
      ORDER BY sort_order ASC, duration_months ASC, id ASC
      `
    );

    return res.json({
      ok: true,
      rows: rows.map((row) => ({
        ...row,
        minimum_amount: toMoney(row.minimum_amount, 0),
        registration_fee: toMoney(row.registration_fee, 0),
        preset_amounts: parsePresetAmounts(row.preset_amounts_json),
      })),
    });
  } catch (err) {
    console.error("GET /dues/plans error:", err);
    return res.status(500).json({ error: "Failed to load dues plans." });
  }
});

router.post(
  "/create-checkout-session",
  authRequired,
  requireRole(...ALLOWED_MEMBER_ROLES),
  async (req, res) => {
    try {
      const ctx = await getMemberContext(req.user.id);

      if (!ctx?.member_id) {
        return res.status(400).json({
          error: "No member account is linked to this user.",
        });
      }

      const planId = Number(req.body.plan_id);
      const selectedOption = normalizeOption(req.body.selected_option);
      const customAmount = req.body.custom_amount;
      const registrationMode = clean(req.body.registration_mode || "", 50).toLowerCase();
      const successUrl = clean(req.body.success_url, 600);
      const cancelUrl = clean(req.body.cancel_url, 600);

      if (!planId) return res.status(400).json({ error: "plan_id is required." });
      if (!successUrl || !cancelUrl) {
        return res.status(400).json({
          error: "Success and cancel URLs are required.",
        });
      }

      const plan = await getPlanById(planId);

      if (!plan || plan.is_active !== 1) {
        return res.status(404).json({ error: "Membership plan not found." });
      }

      if (normalizeOption(plan.billing_cycle) !== selectedOption) {
        return res.status(400).json({
          error: "Selected option does not match the selected plan.",
        });
      }

      const membershipFee = buildAmountFromSelection(plan, customAmount);
      const registrationFee =
        registrationMode === "initial_registration"
          ? toMoney(plan.registration_fee, 0)
          : 0;

      const totalAmount = Number((membershipFee + registrationFee).toFixed(2));
      const interval = intervalMeta(selectedOption);
      const coverage = calculateCoverage({
        totalPaid: totalAmount,
        minimumAmount: plan.minimum_amount,
        registrationFee,
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

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: ctx.email || undefined,
        line_items: lineItems,
        metadata: {
          payment_kind: paymentKind,
          checkout_type:
            paymentKind === "registration_with_plan"
              ? "registration_with_plan"
              : "member_dues_payment",
          category: "membership",
          payment_type: "membership",
          user_id: String(ctx.user_id),
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
          interval_unit: interval.intervalUnit,
          interval_count: String(interval.intervalCount),
          registration_mode: registrationMode,
          registration_fee: String(registrationFee),
          membership_fee: String(membershipFee),
          membership_amount: String(membershipFee),
          total_amount: String(totalAmount),
          months_paid: String(coverage.months_paid || interval.durationMonths),
          remaining_credit: String(coverage.remaining_credit),
          membership_amount_applied: String(coverage.membership_amount_applied),
          auto_renew: "0",
          auto_payment_enabled: "0",
        },
      });

      return res.json({
        ok: true,
        url: session.url,
        session_id: session.id,
      });
    } catch (err) {
      console.error("POST /dues/create-checkout-session error:", err);
      return res.status(500).json({
        error: err.message || "Failed to create membership checkout session.",
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
      const ctx = await getMemberContext(req.user.id);

      if (!ctx?.member_id) {
        return res.status(400).json({
          error: "No member account is linked to this user.",
        });
      }

      const planId = Number(req.body.plan_id);
      const selectedOption = normalizeOption(req.body.selected_option);
      const customAmount = req.body.custom_amount;
      const successUrl = clean(req.body.success_url, 600);
      const cancelUrl = clean(req.body.cancel_url, 600);

      if (!planId) return res.status(400).json({ error: "plan_id is required." });
      if (!successUrl || !cancelUrl) {
        return res.status(400).json({
          error: "Success and cancel URLs are required.",
        });
      }

      const plan = await getPlanById(planId);

      if (!plan || plan.is_active !== 1) {
        return res.status(404).json({ error: "Membership plan not found." });
      }

      if (normalizeOption(plan.billing_cycle) !== selectedOption) {
        return res.status(400).json({
          error: "Selected option does not match the selected plan.",
        });
      }

      const membershipFee = buildAmountFromSelection(plan, customAmount);
      const interval = intervalMeta(selectedOption);
      const customerId = await getStripeCustomer(ctx);

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer: customerId,
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
          payment_kind: "membership_autorenew",
          checkout_type: "member_dues_subscription",
          category: "membership",
          payment_type: "membership",
          user_id: String(ctx.user_id),
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
          interval_unit: interval.intervalUnit,
          interval_count: String(interval.intervalCount),
          registration_fee: "0",
          membership_fee: String(membershipFee),
          membership_amount: String(membershipFee),
          total_amount: String(membershipFee),
          months_paid: String(interval.durationMonths),
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
        session_id: session.id,
      });
    } catch (err) {
      console.error("POST /dues/create-subscription-session error:", err);
      return res.status(500).json({
        error: err.message || "Failed to create auto-payment session.",
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
      const ctx = await getMemberContext(req.user.id);
      const subscriptionId = Number(req.body.subscription_id);
      const selectedOption = normalizeOption(req.body.selected_option);
      const customAmount = req.body.custom_amount;

      if (!subscriptionId) {
        return res.status(400).json({ error: "subscription_id is required." });
      }

      const [[subscription]] = await pool.query(
        `
        SELECT id, member_id, status, stripe_subscription_id
        FROM tbl_finance_dues_subscriptions
        WHERE id = ?
        LIMIT 1
        `,
        [subscriptionId]
      );

      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found." });
      }

      if (
        req.user.role === "member" &&
        Number(subscription.member_id) !== Number(ctx?.member_id)
      ) {
        return res.status(403).json({ error: "You cannot change this subscription." });
      }

      const [[plan]] = await pool.query(
        `
        SELECT
          id,
          plan_code,
          plan_name,
          description,
          minimum_amount,
          preset_amounts_json,
          registration_fee,
          billing_cycle,
          duration_months,
          allow_custom_amount,
          member_type,
          is_active
        FROM tbl_finance_dues_plans
        WHERE billing_cycle = ?
          AND is_active = 1
        ORDER BY sort_order ASC, id ASC
        LIMIT 1
        `,
        [selectedOption]
      );

      if (!plan) {
        return res.status(404).json({
          error: "No active plan found for the selected billing option.",
        });
      }

      const normalizedPlan = {
        ...plan,
        minimum_amount: toMoney(plan.minimum_amount, 0),
        allow_custom_amount: Number(plan.allow_custom_amount || 0),
      };

      const selectedAmount = buildAmountFromSelection(normalizedPlan, customAmount);
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
          normalizedPlan.id,
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
      });
    } catch (err) {
      console.error("PATCH /dues/change-subscription-plan error:", err);
      return res.status(500).json({
        error: err.message || "Failed to change subscription plan.",
      });
    }
  }
);

module.exports = router;