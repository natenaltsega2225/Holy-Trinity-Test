// backend/controllers/financeRegistrationController.js
"use strict";

const {
  registerFinanceMember,
  createFinanceStripeRegistrationCheckout,
} = require("../services/financeRegistrationService");

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const MANUAL_METHODS = new Set(["cash", "check", "zelle"]);
const STRIPE_METHODS = new Set(["card", "ach"]);
const VALID_METHODS = new Set([...MANUAL_METHODS, ...STRIPE_METHODS]);
const VALID_DURATIONS = new Set([1, 3, 6, 12]);

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeEmail(value) {
  return clean(value, 190).toLowerCase().replace(/\s+/g, "");
}

function normalizePhone(value) {
  return clean(value, 80);
}

function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeBoolean(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;

  const text = clean(value, 20).toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(text);
}

function normalizeMethod(value) {
  const method = clean(value, 40).toLowerCase();

  if (["card", "stripe", "stripe_card", "credit_card", "debit_card"].includes(method)) {
    return "card";
  }

  if (["ach", "stripe_ach", "bank", "bank_account", "us_bank_account"].includes(method)) {
    return "ach";
  }

  if (method === "cash") return "cash";
  if (["check", "cheque"].includes(method)) return "check";
  if (method === "zelle") return "zelle";

  return "";
}

function normalizeMonth(value) {
  if (value === null || value === undefined || value === "") return null;

  const n = Number(value);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n;

  const key = clean(value, 20).toLowerCase();
  const months = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };

  return months[key] || null;
}

function normalizeDuration(value) {
  const n = Number(value || 1);
  return VALID_DURATIONS.has(n) ? n : null;
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

function actorRole(req) {
  return clean(req.user?.role || req.auth?.role || "", 80).toLowerCase() || null;
}

function forwardedIp(req) {
  const value = req.headers?.["x-forwarded-for"];

  if (Array.isArray(value)) {
    return clean(value[0], 80);
  }

  return clean(value || "", 500).split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || null;
}

function requestMeta(req) {
  return {
    ip_address: forwardedIp(req),
    user_agent: clean(req.headers?.["user-agent"], 500) || null,
    request_id: req.id || req.requestId || req.headers?.["x-request-id"] || null,
  };
}

function splitName(body = {}) {
  const fullName = clean(
    body.full_name ||
      body.fullName ||
      body.name ||
      `${body.first_name || body.firstName || ""} ${body.last_name || body.lastName || ""}`
  );

  const pieces = fullName.split(/\s+/).filter(Boolean);

  return {
    full_name: fullName,
    first_name: clean(body.first_name || body.firstName || pieces[0] || "", 120) || null,
    last_name:
      clean(
        body.last_name ||
          body.lastName ||
          (pieces.length > 1 ? pieces.slice(1).join(" ") : ""),
        120
      ) || null,
  };
}

function normalizeDependents(value) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, 25)
    .map((item) => {
      const dependent = item || {};
      const names = splitName(dependent);

      return {
        ...dependent,
        full_name: names.full_name,
        first_name: names.first_name,
        last_name: names.last_name,
        relationship: clean(dependent.relationship, 80) || null,
        birth_date: clean(dependent.birth_date || dependent.dob, 40) || null,
        gender: clean(dependent.gender, 40) || null,
        notes: clean(dependent.notes, 500) || null,
      };
    })
    .filter((item) => item.full_name);
}

function normalizePayload(req, overrides = {}) {
  const body = req.body || {};
  const names = splitName(body);

  const method = normalizeMethod(
    overrides.payment_method ||
      body.payment_method ||
      body.paymentMethod ||
      body.method
  );

  const registrationFee = numberValue(
    body.registration_fee ||
      body.first_time_registration_fee ||
      body.signup_fee ||
      body.application_fee,
    0
  );

  const membershipAmount = numberValue(
    body.membership_amount ||
      body.dues_amount ||
      body.monthly_amount ||
      body.amount,
    0
  );

  const amount = numberValue(
    body.amount ||
      body.total_amount ||
      body.payment_amount ||
      registrationFee + membershipAmount,
    registrationFee + membershipAmount
  );

  const durationMonths = normalizeDuration(
    body.duration_months ||
      body.months_paid ||
      body.interval_months ||
      body.plan_months ||
      1
  );

  const coverageStartMonth = normalizeMonth(
    body.coverage_start_month ||
      body.start_month ||
      body.month
  );

  const payload = {
    ...body,
    ...overrides,

    source: overrides.source || body.source || "finance_registration",
    registration_source:
      overrides.registration_source ||
      body.registration_source ||
      "finance_portal",

    full_name: names.full_name,
    first_name: names.first_name,
    last_name: names.last_name,

    email: normalizeEmail(body.email),
    phone: normalizePhone(body.phone),

    address: clean(body.address, 255) || null,
    address_line_1:
      clean(body.address_line_1 || body.address1 || body.street, 255) || null,
    address_line_2:
      clean(body.address_line_2 || body.address2, 255) || null,
    city: clean(body.city, 120) || null,
    state: clean(body.state, 80) || null,
    zip_code: clean(body.zip_code || body.zip || body.postal_code, 40) || null,
    country: clean(body.country, 80) || "USA",

    gender: clean(body.gender, 40) || null,
    marital_status: clean(body.marital_status, 80) || null,
    household_role: clean(body.household_role, 80) || null,

    dependents: normalizeDependents(body.dependents),

    plan_id:
      body.plan_id ||
      body.membership_plan_id ||
      body.dues_plan_id ||
      body.finance_dues_plan_id ||
      null,

    membership_plan_id:
      body.membership_plan_id ||
      body.plan_id ||
      null,

    dues_plan_id:
      body.dues_plan_id ||
      body.finance_dues_plan_id ||
      body.plan_id ||
      null,

    payment_method: method,
    method,
    provider: overrides.provider || body.provider || (STRIPE_METHODS.has(method) ? "stripe" : "manual"),

    amount,
    total_amount: amount,
    payment_amount: amount,

    membership_amount: membershipAmount,
    dues_amount: membershipAmount,
    registration_fee: registrationFee,
    first_time_registration_fee: registrationFee,

    coverage_year:
      Number(body.coverage_year || body.start_year || new Date().getFullYear()),

    coverage_start_month: coverageStartMonth,

    duration_months: durationMonths,
    months_paid: durationMonths,

    reference_no:
      clean(
        body.reference_no ||
          body.reference_number ||
          body.check_number ||
          body.zelle_reference ||
          body.transaction_reference,
        255
      ) || null,

    check_number: clean(body.check_number || body.check_no, 120) || null,
    zelle_reference: clean(body.zelle_reference || body.zelle_confirmation, 255) || null,

    notes: clean(body.notes || body.note, 1000) || null,

    cover_processing_fee: normalizeBoolean(
      body.cover_processing_fee ??
        body.include_processing_fee ??
        overrides.cover_processing_fee ??
        false
    ),

    success_url: clean(body.success_url || body.successUrl, 500) || null,
    cancel_url: clean(body.cancel_url || body.cancelUrl, 500) || null,

    idempotency_key:
      clean(
        body.idempotency_key ||
          body.idempotencyKey ||
          req.headers?.["x-idempotency-key"],
        120
      ) || null,

    created_by: actorId(req),
    finance_created_by: actorId(req),
    actor_id: actorId(req),
    actor_role: actorRole(req),

    ...requestMeta(req),
  };

  return payload;
}

function validatePayload(payload, options = {}) {
  const errors = [];

  if (!payload.full_name) {
    errors.push("Full name is required.");
  }

  if (!payload.email) {
    errors.push("Email is required.");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    errors.push("Enter a valid email address.");
  }

  if (!VALID_METHODS.has(payload.payment_method)) {
    errors.push("Payment method must be card, ach, cash, check, or zelle.");
  }

  if (options.allowedMethods && !options.allowedMethods.has(payload.payment_method)) {
    errors.push(options.methodError || "Payment method is not allowed for this registration route.");
  }

  if (!payload.duration_months) {
    errors.push("Membership duration must be 1, 3, 6, or 12 months.");
  }

  if (
    payload.coverage_start_month !== null &&
    (Number(payload.coverage_start_month) < 1 || Number(payload.coverage_start_month) > 12)
  ) {
    errors.push("Coverage start month must be between 1 and 12.");
  }

  if (numberValue(payload.amount, 0) <= 0) {
    errors.push("Registration payment amount must be greater than zero.");
  }

  if (payload.payment_method === "check" && !payload.reference_no && !payload.check_number) {
    errors.push("Check number or reference number is required for check payments.");
  }

  if (payload.payment_method === "zelle" && !payload.reference_no && !payload.zelle_reference) {
    errors.push("Zelle reference number is required for Zelle payments.");
  }

  if (errors.length) {
    const err = new Error(errors.join(" "));
    err.statusCode = 400;
    throw err;
  }
}

function scrubSecrets(value) {
  if (!value || typeof value !== "object") return value;

  const copy = Array.isArray(value) ? [...value] : { ...value };

  for (const key of Object.keys(copy)) {
    if (/password|secret|token_hash|hash/i.test(key)) {
      delete copy[key];
    } else if (copy[key] && typeof copy[key] === "object") {
      copy[key] = scrubSecrets(copy[key]);
    }
  }

  return copy;
}

function publicResult(result = {}) {
  const safe = scrubSecrets(result);

  return {
    ok: safe.ok !== false,
    success: safe.success !== false,

    status: safe.status,
    payment_status: safe.payment_status,

    member_id: safe.member_id,
    user_id: safe.user_id,
    member_no: safe.member_no,
    username: safe.username,
    full_name: safe.full_name,
    email: safe.email,

    login_url: safe.login_url,
    requires_password_change: safe.requires_password_change,

    dependents: safe.dependents || [],

    plan: safe.plan,
    coverage: safe.coverage,
    totals: safe.totals,

    invoice: safe.invoice,
    receipt: safe.receipt,
    payment: safe.payment,
    welcome: safe.welcome,

    checkout_url: safe.checkout_url,
    stripe_url: safe.stripe_url,
    session_id: safe.session_id,
    url: safe.checkout_url || safe.stripe_url || null,

    message: safe.message,
  };
}

function sendControllerError(res, err, label) {
  const message = err?.message || "Failed to register member.";

  const status =
    err?.statusCode ||
    err?.status ||
    (/already exists|duplicate/i.test(message)
      ? 409
      : /required|invalid|must|cannot|missing|not allowed/i.test(message)
        ? 400
        : 500);

  if (status >= 500) {
    console.error(`${label} error:`, err);
  } else {
    console.warn(`${label} validation error:`, message);
  }

  return res.status(status).json({
    ok: false,
    error:
      status >= 500 && process.env.NODE_ENV === "production"
        ? "Failed to register member."
        : message,
  });
}

/* -------------------------------------------------------------------------- */
/* Manual Registration                                                        */
/* -------------------------------------------------------------------------- */

async function registerMemberManual(req, res) {
  try {
    const method = normalizeMethod(
      req.body?.payment_method ||
        req.body?.paymentMethod ||
        req.body?.method ||
        "cash"
    );

    const payload = normalizePayload(req, {
      payment_method: method,
      provider: "manual",
      source: "finance_registration_manual",
      registration_source: "finance_portal",
    });

    validatePayload(payload, {
      allowedMethods: MANUAL_METHODS,
      methodError: "Manual registration payment method must be cash, check, or zelle.",
    });

    const result = await registerFinanceMember(payload);

    return res.status(201).json(publicResult(result));
  } catch (err) {
    return sendControllerError(res, err, "registerMemberManual");
  }
}

/* -------------------------------------------------------------------------- */
/* Stripe Registration                                                        */
/* -------------------------------------------------------------------------- */

async function registerMemberStripe(req, res) {
  try {
    const method = normalizeMethod(
      req.body?.payment_method ||
        req.body?.paymentMethod ||
        req.body?.method ||
        "card"
    );

    const payload = normalizePayload(req, {
      payment_method: method,
      provider: "stripe",
      source: "finance_registration_stripe",
      registration_source: "finance_portal",
      cover_processing_fee:
        req.body?.cover_processing_fee ??
        req.body?.include_processing_fee ??
        true,
    });

    validatePayload(payload, {
      allowedMethods: STRIPE_METHODS,
      methodError: "Stripe registration payment method must be card or ach.",
    });

    const result = await createFinanceStripeRegistrationCheckout(payload);

    return res.status(202).json(publicResult(result));
  } catch (err) {
    return sendControllerError(res, err, "registerMemberStripe");
  }
}

/* -------------------------------------------------------------------------- */
/* Unified Registration                                                       */
/* -------------------------------------------------------------------------- */

async function registerMember(req, res) {
  try {
    const payload = normalizePayload(req, {
      source: "finance_registration_unified",
      registration_source: "finance_portal",
    });

    validatePayload(payload);

    if (STRIPE_METHODS.has(payload.payment_method)) {
      const result = await createFinanceStripeRegistrationCheckout({
        ...payload,
        provider: "stripe",
        cover_processing_fee:
          req.body?.cover_processing_fee ??
          req.body?.include_processing_fee ??
          true,
      });

      return res.status(202).json(publicResult(result));
    }

    const result = await registerFinanceMember({
      ...payload,
      provider: "manual",
    });

    return res.status(201).json(publicResult(result));
  } catch (err) {
    return sendControllerError(res, err, "registerMember");
  }
}

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

async function registrationControllerHealth(_req, res) {
  return res.json({
    ok: true,
    module: "financeRegistrationController",
    version: "enterprise",
    manual_methods: [...MANUAL_METHODS],
    stripe_methods: [...STRIPE_METHODS],
    membership_durations: [...VALID_DURATIONS],
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  registerMember,
  registerMemberManual,
  registerMemberStripe,
  registrationControllerHealth,

  // exported for route/service tests
  normalizePayload,
  normalizeMethod,
};