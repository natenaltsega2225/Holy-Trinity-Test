

// backend/routes/unifiedCheckout.js
"use strict";

const express = require("express");
const Stripe = require("stripe");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

/* =========================================================
   HELPERS
========================================================= */

function clean(v, max = 255) {
  return String(v ?? "").trim().slice(0, max);
}

function money(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function cents(v) {
  return Math.round(money(v) * 100);
}

function frontendUrl() {
  return String(process.env.FRONTEND_URL || "http://localhost:5173").replace(
    /\/+$/,
    ""
  );
}

function jwtSecret() {
  return process.env.JWT_SECRET || "dev_secret";
}

function normalizeType(v) {
  const s = clean(v, 50).toLowerCase();

  if (["membership", "dues", "member_dues", "membership_dues"].includes(s)) {
    return "membership";
  }

  if (["donation", "giving", "donate", "sunday_collection", "sunday_cash_collection"].includes(s)) {
    return "donation";
  }

  if (["school", "kids", "kids_school", "school_program"].includes(s)) {
    return "school";
  }

  if (["trip", "travel"].includes(s)) {
    return "trip";
  }

  if (["pledge", "pledge_payment"].includes(s)) {
    return "pledge";
  }

  return "";
}

function normalizePaymentMethod(v) {
  const s = clean(v, 40).toLowerCase();

  if (["ach", "bank", "bank_transfer", "us_bank_account", "stripe_ach"].includes(s)) {
    return "ach";
  }

  return "card";
}

function stripePaymentMethods(method) {
  return method === "ach" ? ["us_bank_account"] : ["card"];
}

function processingFee(amount) {
  const n = money(amount);
  if (n <= 0) return 0;
  return Number(((n * 0.029 + 0.3) / (1 - 0.029)).toFixed(2));
}

function optionalAuth(req, _res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    req.user = token ? jwt.verify(token, jwtSecret()) : null;
  } catch {
    req.user = null;
  }

  next();
}

function frequencyToStripeInterval(frequency) {
  const f = clean(frequency || "monthly").toLowerCase();

  if (f === "weekly") return { interval: "week", interval_count: 1 };
  if (f === "quarterly") return { interval: "month", interval_count: 3 };
  if (f === "annual" || f === "yearly") return { interval: "year", interval_count: 1 };

  return { interval: "month", interval_count: 1 };
}

function defaultSuccessUrl(type, source) {
  if (source === "finance") {
    return `${frontendUrl()}/dash/finance/payments?status=success&session_id={CHECKOUT_SESSION_ID}`;
  }

  if (type === "membership") {
    return `${frontendUrl()}/dash/membership/my-payments/history?status=success&session_id={CHECKOUT_SESSION_ID}`;
  }

  if (type === "pledge") {
    return `${frontendUrl()}/dash/membership/my-payments/history?status=pledge-success&session_id={CHECKOUT_SESSION_ID}`;
  }

  return `${frontendUrl()}/payments/success?type=${type}&session_id={CHECKOUT_SESSION_ID}`;
}

function defaultCancelUrl(type, source) {
  if (source === "finance") {
    return `${frontendUrl()}/dash/finance/payments?status=cancel&type=${type}`;
  }

  if (type === "membership") {
    return `${frontendUrl()}/dash/membership/my-payments/make-payment?status=cancel&type=${type}`;
  }

  return `${frontendUrl()}/payments/cancel?type=${type}`;
}

function monthName(n) {
  return [
    "",
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
  ][Number(n)] || String(n);
}

// function calculateCoverage(durationMonths, req) {
//   const now = new Date();

//   const coverageYear =
//     Number(req.body.coverage_year || 0) || now.getFullYear();

//   const startMonth =
//     Number(req.body.coverage_start_month || 0) ||
//     Number(String(req.body.membership_start_month || "").split("-")[1] || 0) ||
//     now.getMonth() + 1;

//   const endMonth = Math.min(12, startMonth + Number(durationMonths || 1) - 1);

//   return {
//     coverage_year: String(coverageYear),
//     coverage_start_month: String(startMonth),
//     coverage_end_month: String(endMonth),
//     coverage_label: `${monthName(startMonth)} - ${monthName(endMonth)} ${coverageYear}`,
//   };
// }
function calculateCoverage(durationMonths, req) {
  const now = new Date();

  const rawStart =
    req.body.coverage_start_month ||
    req.body.membership_start_month ||
    "";

  const rawEnd =
    req.body.coverage_end_month ||
    req.body.membership_end_month ||
    "";

  let coverageYear =
    Number(req.body.coverage_year || 0) ||
    now.getFullYear();

  let startMonth =
    Number(rawStart || 0);

  let endMonth =
    Number(rawEnd || 0);

  if (String(rawStart).match(/^\d{4}-\d{2}$/)) {
    const [y, m] = String(rawStart).split("-").map(Number);
    coverageYear = y;
    startMonth = m;
  }

  if (String(rawEnd).match(/^\d{4}-\d{2}$/)) {
    const [y, m] = String(rawEnd).split("-").map(Number);
    coverageYear = y;
    endMonth = m;
  }

  if (!startMonth) {
    startMonth = now.getMonth() + 1;
  }

  if (!endMonth) {
    endMonth =
      startMonth +
      Number(durationMonths || 1) -
      1;
  }

  startMonth = Math.max(1, Math.min(12, Number(startMonth)));
  endMonth = Math.max(startMonth, Math.min(12, Number(endMonth)));

  const monthsPaid =
    Math.max(
      1,
      endMonth - startMonth + 1
    );

  const coverageMonths = [];

  for (
    let month = startMonth;
    month <= endMonth;
    month += 1
  ) {
    coverageMonths.push({
      year: coverageYear,
      month: monthName(month),
      month_number: month,
      label: `${monthName(month)} ${coverageYear}`,
    });
  }

  return {
    coverage_year: String(coverageYear),
    coverage_start_month: String(startMonth),
    coverage_end_month: String(endMonth),
    coverage_label:
      `${monthName(startMonth)} ${coverageYear} - ${monthName(endMonth)} ${coverageYear}`,
    duration_months: String(monthsPaid),
    months_paid: String(monthsPaid),
    coverage_months_json:
      JSON.stringify(coverageMonths),
  };
}
/* =========================================================
   MEMBER / PLAN / PROGRAM
========================================================= */

async function getMember(userId) {
  if (!userId) return null;

  const [[row]] = await pool.query(
    `
    SELECT
      u.id AS user_id,
      u.username,
      u.email AS user_email,
      u.member_id AS user_member_id,
      m.id AS member_id,
      m.member_no,
      m.full_name,
      m.email,
      m.phone
    FROM tbl_users u
    LEFT JOIN tbl_members m
      ON m.id = u.member_id
    WHERE u.id = ?
    LIMIT 1
    `,
    [userId]
  );

  return row || null;
}

async function getMemberById(memberId) {
  if (!memberId) return null;

  const [[row]] = await pool.query(
    `
    SELECT
      m.id AS member_id,
      m.member_no,
      m.full_name,
      m.email,
      m.phone,
      u.id AS user_id,
      u.username
    FROM tbl_members m
    LEFT JOIN tbl_users u
      ON u.member_id = m.id
    WHERE m.id = ?
    LIMIT 1
    `,
    [memberId]
  );

  return row || null;
}

async function validateMembershipPlan(req) {
  const planId = Number(req.body.plan_id || req.body.dues_plan_id || 0);

  if (!planId) return null;

  const [[plan]] = await pool.query(
    `
    SELECT
      id,
      plan_code,
      plan_name,
      minimum_amount,
      duration_months,
      billing_cycle,
      registration_fee,
      allow_custom_amount,
      is_active
    FROM tbl_finance_dues_plans
    WHERE id = ?
    LIMIT 1
    `,
    [planId]
  );

  if (!plan || Number(plan.is_active) === 0) return null;

  return {
    ...plan,
    minimum_amount: money(plan.minimum_amount),
    registration_fee: money(plan.registration_fee),
    duration_months: Number(plan.duration_months || 1),
    allow_custom_amount: Number(plan.allow_custom_amount || 0),
  };
}

async function resolveProgram(type, req) {
  if (!["school", "trip"].includes(type)) return null;

  const programId = Number(
    req.body.related_entity_id ||
      req.body.program_id ||
      req.body.news_event_id ||
      0
  );

  if (!programId) return null;

  const [[program]] = await pool.query(
    `
    SELECT
      id,
      title,
      category,
      price_per_person,
      start_date
    FROM tbl_news_events
    WHERE id = ?
    LIMIT 1
    `,
    [programId]
  );

  return program || null;
}

async function resolvePledge(req) {
  const pledgeId = Number(req.body.pledge_id || 0);

  if (!pledgeId) return null;

  const [[pledge]] = await pool.query(
    `
    SELECT *
    FROM tbl_finance_pledges
    WHERE id = ?
    LIMIT 1
    `,
    [pledgeId]
  );

  return pledge || null;
}

/* =========================================================
   AMOUNT
========================================================= */

async function resolveAmount(type, req, plan, program, pledge) {
  if (type === "membership") {
    const requested = money(
      req.body.amount ||
        req.body.amount_paid ||
        req.body.membership_amount ||
        req.body.total_amount
    );

    const minimum = money(plan?.minimum_amount || 0);

    if (!plan) return requested;

    if (plan.allow_custom_amount && requested >= minimum) {
      return requested;
    }

    return requested > 0 ? requested : minimum;
  }

  if (["school", "trip"].includes(type)) {
    const qty = Math.max(1, Number(req.body.quantity || 1));
    const unit = Number(program?.price_per_person || 0);

    if (unit > 0) return money(unit * qty);

    return money(req.body.amount || req.body.total_amount);
  }

  if (type === "pledge") {
    return money(
      req.body.upfront_amount ||
        req.body.amount ||
        req.body.total_amount ||
        pledge?.remaining_balance ||
        0
    );
  }

  return money(req.body.amount || req.body.total_amount);
}

/* =========================================================
   METADATA
========================================================= */

async function buildMetadata(req, type, amount, plan, program, pledge) {
  const memberFromToken = req.user?.id ? await getMember(req.user.id) : null;
  const memberFromBody = req.body.member_id
    ? await getMemberById(req.body.member_id)
    : null;

  const member = memberFromToken || memberFromBody;

  const source = clean(req.body.source || req.body.created_from || "finance", 80);

  const fullName = clean(
    member?.full_name ||
      req.body.full_name ||
      req.body.member_name ||
      req.body.donor_name ||
      req.body.name ||
      pledge?.full_name_snapshot ||
      "Guest",
    180
  );

/* =====================================================
   EMAIL
===================================================== */

let email = "";

/* =========================================
   DONATION / GUEST PAYMENTS
========================================= */

if (
  [
    "donation",
    "school",
    "trip",
    "pledge",
  ].includes(type)
) {

  email = clean(

    req.body.email ||

    req.body.donor_email ||

    pledge?.email_snapshot ||

    member?.email ||

    member?.user_email ||

    "",

    190
  );
}

/* =========================================
   MEMBERSHIP
========================================= */

else {

  email = clean(

    member?.email ||

    member?.user_email ||

    req.body.email ||

    pledge?.email_snapshot ||

    "",

    190
  );
}
 /* =====================================================
   PHONE
===================================================== */

let phone = "";

/* =========================================
   DONATION / GUEST PAYMENTS
========================================= */

if (
  [
    "donation",
    "school",
    "trip",
    "pledge",
  ].includes(type)
) {

  phone = clean(

    req.body.phone ||

    req.body.donor_phone ||

    pledge?.phone_snapshot ||

    member?.phone ||

    "",

    40
  );
}

/* =========================================
   MEMBERSHIP
========================================= */

else {

  phone = clean(

    member?.phone ||

    req.body.phone ||

    pledge?.phone_snapshot ||

    "",

    40
  );
}
  const memberId =
    member?.member_id ||
    member?.user_member_id ||
    Number(req.body.member_id || pledge?.member_id || 0) ||
    "";

  const quantity = Math.max(1, Number(req.body.quantity || 1));

  const durationMonths =
    Number(
      req.body.duration_months ||
        req.body.months_paid ||
        plan?.duration_months ||
        1
    ) || 1;

  const planName = clean(req.body.plan_name || plan?.plan_name || "", 120);

  const coverage =
    type === "membership"
      ? calculateCoverage(durationMonths, req)
      : {
          coverage_year: "",
          coverage_start_month: "",
          coverage_end_month: "",
          coverage_label: "",
        };

  const subCategory = clean(
    req.body.sub_category ||
      req.body.donation_category ||
      planName ||
      program?.title ||
      req.body.program_name ||
      req.body.campaign_name ||
      pledge?.campaign_name ||
      type,
    160
  );

  const pledgedAmount = money(
    req.body.pledged_amount || pledge?.pledged_amount || amount
  );

  const paidAmount = money(req.body.upfront_amount || amount);
  const remainingBalance = Math.max(pledgedAmount - paidAmount, 0);

  const baseAmount = money(amount);

  const includeRegistrationFee =
    req.body.registration_mode === "initial_registration" ||
    req.body.include_registration_fee === true ||
    req.body.include_registration_fee === "true" ||
    req.body.registration_fee;

  const registrationFee =
    type === "membership" && includeRegistrationFee
      ? money(plan?.registration_fee || req.body.registration_fee || 0)
      : money(req.body.registration_fee || 0);

  const includeProcessingFee =
    req.body.cover_processing_fee === true ||
    req.body.cover_processing_fee === "true" ||
    req.body.include_processing_fee === true ||
    req.body.include_processing_fee === "true";

  const subtotal = money(baseAmount + registrationFee);
  const fee = includeProcessingFee ? processingFee(subtotal) : 0;
  const totalAmount = money(subtotal + fee);
return {
  type,
  category: type,
  payment_type: type,
  source,

  member_id: memberId ? String(memberId) : "",
  member_no: member?.member_no || clean(req.body.member_no || "", 80),
  full_name: fullName,
  email,
  phone,

  amount: String(totalAmount),
  total_amount: String(totalAmount),
  base_amount: String(baseAmount),
  subtotal_amount: String(subtotal),
  registration_fee: String(registrationFee),
  processing_fee: String(fee),
  currency: "usd",

  payment_method: normalizePaymentMethod(req.body.payment_method),
  method: normalizePaymentMethod(req.body.payment_method),
  provider: "stripe",

  plan_id: clean(req.body.plan_id || req.body.dues_plan_id || "", 40),
  dues_plan_id: clean(req.body.dues_plan_id || req.body.plan_id || "", 40),
  plan_name: planName || "",
  // duration_months: String(durationMonths),
  // months_paid: String(durationMonths),
duration_months:
  coverage.duration_months ||
  String(durationMonths),

months_paid:
  coverage.months_paid ||
  String(durationMonths),
  coverage_year: coverage.coverage_year,
  coverage_start_month: coverage.coverage_start_month,
  coverage_end_month: coverage.coverage_end_month,
  coverage_label: coverage.coverage_label,

  related_entity_id: clean(
    req.body.related_entity_id || req.body.news_event_id || req.body.program_id || program?.id || "",
    40
  ),
  news_event_id: clean(req.body.news_event_id || req.body.program_id || program?.id || "", 40),
  program_id: clean(req.body.program_id || req.body.news_event_id || program?.id || "", 40),
  program_name: clean(program?.title || req.body.program_name || subCategory, 120),
  program_title: clean(program?.title || req.body.program_title || subCategory, 120),

  quantity: String(quantity),

  donation_category:
    type === "donation"
      ? clean(req.body.donation_category || subCategory, 120)
      : "",

  pledge_id: clean(req.body.pledge_id || pledge?.id || "", 40),
  note: clean(req.body.note || req.body.notes || "", 300),

  process_direct_payment: "true",
  send_receipt_email: "true",
};
}

/* =========================================================
   LINE ITEMS
========================================================= */

function buildLineItems(metadata, type) {
  const lineItems = [];

  const baseAmount = money(metadata.base_amount);
  const registrationFee = money(metadata.registration_fee);
  const processing = money(metadata.processing_fee);

  const qty = Math.max(1, Number(metadata.quantity || 1));

  const itemName =
    metadata.plan_name ||
    metadata.program_name ||
    metadata.donation_category ||
    metadata.sub_category ||
    type;

  if (registrationFee > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: cents(registrationFee),
        product_data: {
          name: "First-Time Registration Fee",
        },
      },
    });
  }

  if (baseAmount > 0) {
    lineItems.push({
      quantity: qty,
      price_data: {
        currency: "usd",
        unit_amount: cents(baseAmount / qty),
        product_data: {
          name: itemName,
          description: metadata.note || undefined,
        },
      },
    });
  }

  if (processing > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: cents(processing),
        product_data: {
          name: "Processing Fee",
        },
      },
    });
  }

  return lineItems;
}

/* =========================================================
   CREATE SESSION
========================================================= */

// router.post("/create-session", optionalAuth, async (req, res) => {
//   try {
//     if (!stripe) {
//       return res.status(500).json({
//         error: "Stripe secret key is not configured.",
//       });
//     }

//     const type = normalizeType(
//       req.body.kind || req.body.type || req.body.payment_type || req.body.category
//     );

//     if (!type) {
//       return res.status(400).json({
//         error: "Invalid payment type.",
//       });
//     }

//     const paymentMethod = normalizePaymentMethod(req.body.payment_method);

//     const plan = type === "membership" ? await validateMembershipPlan(req) : null;
//     const program = await resolveProgram(type, req);
//     const pledge = type === "pledge" ? await resolvePledge(req) : null;

//     if (type === "membership" && !plan) {
//       return res.status(400).json({
//         error: "Membership plan is required or inactive.",
//       });
//     }

//     const amount = await resolveAmount(type, req, plan, program, pledge);

//     if (amount <= 0) {
//       return res.status(400).json({
//         error: "Invalid payment amount.",
//       });
//     }

//     const metadata = await buildMetadata(req, type, amount, plan, program, pledge);
//     const source = metadata.source || "finance";

//     if (type === "membership" && source !== "finance" && !metadata.member_id) {
//       return res.status(401).json({
//         error: "Please select a linked member before paying dues.",
//       });
//     }

//     const recurring =
//       req.body.is_recurring === true ||
//       req.body.is_recurring === "true" ||
//       req.body.auto_renew === true ||
//       req.body.auto_renew === "true";

//     const subscriptionMode =
//       recurring && ["membership", "donation"].includes(type);

//     const successUrl =
//       req.body.success_url || defaultSuccessUrl(type, source);

//     const cancelUrl =
//       req.body.cancel_url || defaultCancelUrl(type, source);

//     const lineItems = buildLineItems(metadata, type);

//     if (!lineItems.length) {
//       return res.status(400).json({
//         error: "No payable line items were generated.",
//       });
//     }

//     const sessionPayload = {
//       mode: subscriptionMode ? "subscription" : "payment",
//       payment_method_types: stripePaymentMethods(paymentMethod),
//       success_url: successUrl,
//       cancel_url: cancelUrl,
//       customer_email: metadata.email || undefined,
//       billing_address_collection: "auto",
//       phone_number_collection: {
//         enabled: true,
//       },
//       metadata,
//       line_items: lineItems,
//     };

//     if (!subscriptionMode) {
//       sessionPayload.customer_creation = "always";
//     }

//     if (paymentMethod === "ach") {
//       sessionPayload.payment_method_options = {
//         us_bank_account: {
//           financial_connections: {
//             permissions: ["payment_method", "balances"],
//           },
//         },
//       };
//     }

//     if (subscriptionMode) {
//       const interval = frequencyToStripeInterval(
//         req.body.recurring_frequency ||
//           req.body.billing_cycle ||
//           metadata.recurring_frequency
//       );

//       for (const item of sessionPayload.line_items) {
//         item.price_data.recurring = interval;
//       }

//       metadata.is_recurring = "true";
//       metadata.auto_renew = "true";
//       metadata.auto_payment_enabled = "true";
//       metadata.interval_unit = interval.interval;
//       metadata.interval_count = String(interval.interval_count);

//       sessionPayload.subscription_data = {
//         metadata,
//       };
//     } else {
//       sessionPayload.payment_intent_data = {
//         metadata,
//         receipt_email: metadata.email || undefined,
//       };
//     }

//     console.log("Creating Stripe session:", {
//       type,
//       paymentMethod,
//       amount: metadata.total_amount,
//       email: metadata.email,
//       member: metadata.member_no,
//       source,
//     });

//     const session = await stripe.checkout.sessions.create(sessionPayload);

//     return res.json({
//       ok: true,
//       url: session.url,
//       checkout_url: session.url,
//       stripe_url: session.url,
//       id: session.id,
//       session_id: session.id,
//       mode: sessionPayload.mode,
//       payment_method: paymentMethod,
//       amount: metadata.total_amount,
//       metadata,
//     });
//   } catch (err) {
//     console.error("Unified checkout error:", err);

//     return res.status(500).json({
//       error: err.message || "Failed to create checkout session.",
//     });
//   }
// });
/* =========================================================
   CREATE SESSION
========================================================= */

router.post("/create-session", optionalAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        error: "Stripe secret key is not configured.",
      });
    }

    const type = normalizeType(
      req.body.kind ||
        req.body.type ||
        req.body.payment_type ||
        req.body.category
    );

    if (!type) {
      return res.status(400).json({
        error: "Invalid payment type.",
      });
    }

    const paymentMethod = normalizePaymentMethod(
      req.body.payment_method
    );

    const plan =
      type === "membership"
        ? await validateMembershipPlan(req)
        : null;

    const program =
      await resolveProgram(type, req);

    const pledge =
      type === "pledge"
        ? await resolvePledge(req)
        : null;

    if (type === "membership" && !plan) {
      return res.status(400).json({
        error: "Membership plan is required or inactive.",
      });
    }

    const amount =
      await resolveAmount(
        type,
        req,
        plan,
        program,
        pledge
      );

    if (amount <= 0) {
      return res.status(400).json({
        error: "Invalid payment amount.",
      });
    }

    const metadata =
      await buildMetadata(
        req,
        type,
        amount,
        plan,
        program,
        pledge
      );

    const source =
      metadata.source || "finance";

    if (
      type === "membership" &&
      source !== "finance" &&
      !metadata.member_id
    ) {
      return res.status(401).json({
        error:
          "Please select a linked member before paying dues.",
      });
    }

    const recurring =
      req.body.is_recurring === true ||
      req.body.is_recurring === "true" ||
      req.body.auto_renew === true ||
      req.body.auto_renew === "true" ||
      req.body.subscription_enabled === true ||
      req.body.subscription_enabled === "true";

    const subscriptionMode =
      recurring &&
      ["membership", "donation"].includes(type);

    const successUrl =
      req.body.success_url ||
      defaultSuccessUrl(type, source);

    const cancelUrl =
      req.body.cancel_url ||
      defaultCancelUrl(type, source);

    const lineItems =
      buildLineItems(
        metadata,
        type
      );

    if (!lineItems.length) {
      return res.status(400).json({
        error:
          "No payable line items were generated.",
      });
    }

    const sessionPayload = {
      mode:
        subscriptionMode
          ? "subscription"
          : "payment",

      payment_method_types:
        stripePaymentMethods(paymentMethod),

      success_url:
        successUrl,

      cancel_url:
        cancelUrl,

      customer_email:
        metadata.email || undefined,

      billing_address_collection:
        "auto",

      phone_number_collection: {
        enabled: true,
      },

      metadata,

      line_items:
        lineItems,
    };

    if (!subscriptionMode) {
      sessionPayload.customer_creation =
        "always";
    }

    if (paymentMethod === "ach") {
      sessionPayload.payment_method_options = {
        us_bank_account: {
          financial_connections: {
            permissions: [
              "payment_method",
              "balances",
            ],
          },
        },
      };
    }

    if (subscriptionMode) {
      const interval =
        frequencyToStripeInterval(
          req.body.recurring_frequency ||
            req.body.billing_cycle ||
            metadata.recurring_frequency
        );

      for (const item of sessionPayload.line_items) {
        item.price_data.recurring =
          interval;
      }

      metadata.is_recurring =
        "true";

      metadata.auto_renew =
        "true";

      metadata.auto_payment_enabled =
        "true";

      metadata.subscription_enabled =
        "true";

      metadata.interval_unit =
        interval.interval;

      metadata.interval_count =
        String(interval.interval_count);

      sessionPayload.subscription_data = {
        metadata,
      };
    } else {
      sessionPayload.payment_intent_data = {
        metadata,
        receipt_email:
          metadata.email || undefined,
      };
    }

    console.log("Creating Stripe session:", {
      type,
      paymentMethod,
      amount: metadata.total_amount,
      email: metadata.email,
      member: metadata.member_no,
      source,
      mode: sessionPayload.mode,
      coverage_year: metadata.coverage_year,
      coverage_start_month:
        metadata.coverage_start_month,
      coverage_end_month:
        metadata.coverage_end_month,
    });

    const session =
      await stripe.checkout.sessions.create(
        sessionPayload
      );

    return res.json({
      ok: true,

      url:
        session.url,

      checkout_url:
        session.url,

      stripe_url:
        session.url,

      id:
        session.id,

      session_id:
        session.id,

      mode:
        sessionPayload.mode,

      payment_method:
        paymentMethod,

      amount:
        metadata.total_amount,

      coverage_year:
        metadata.coverage_year || "",

      coverage_start_month:
        metadata.coverage_start_month || "",

      coverage_end_month:
        metadata.coverage_end_month || "",

      coverage_label:
        metadata.coverage_label || "",

      coverage_months_json:
        metadata.coverage_months_json || "",

      metadata,
    });
  } catch (err) {
    console.error(
      "Unified checkout error:",
      err
    );

    return res.status(500).json({
      error:
        err.message ||
        "Failed to create checkout session.",
    });
  }
});
module.exports = router;