

// backend/services/domains/membership/membershipPlanService.js
"use strict";

const pool = require("../../../db");

const {
  insertExistingColumns,
  updateExistingColumns,
  findOne,
  findMany,
} = require("../../../utils/dbHelpers");

const {
  clean,
  money,
  mysqlNow,
} = require("../../../utils/financeHelpers");

const TABLE = "tbl_membership_plans";

const ALLOWED_DURATIONS = new Set([1, 3, 6, 12]);

const DEFAULT_PLAN_TEMPLATES = [
  {
    plan_code: "MEMBERSHIP_MONTHLY_RECURRING",
    name: "Month-to-Month Membership",
    description: "Recurring monthly membership dues.",
    duration_months: 1,
    interval_months: 1,
    payment_mode: "recurring",
    billing_model: "subscription",
    billing_cycle: "monthly",
    allow_auto_renew: 1,
    is_recurring: 1,
    sort_order: 10,
  },
  {
    plan_code: "MEMBERSHIP_3_MONTH_PREPAID",
    name: "3 Month Membership",
    description: "One-time prepaid membership coverage for 3 months.",
    duration_months: 3,
    interval_months: 3,
    payment_mode: "one_time",
    billing_model: "prepaid",
    billing_cycle: "quarterly",
    allow_auto_renew: 0,
    is_recurring: 0,
    sort_order: 20,
  },
  {
    plan_code: "MEMBERSHIP_6_MONTH_PREPAID",
    name: "6 Month Membership",
    description: "One-time prepaid membership coverage for 6 months.",
    duration_months: 6,
    interval_months: 6,
    payment_mode: "one_time",
    billing_model: "prepaid",
    billing_cycle: "semi_annual",
    allow_auto_renew: 0,
    is_recurring: 0,
    sort_order: 30,
  },
  {
    plan_code: "MEMBERSHIP_12_MONTH_PREPAID",
    name: "12 Month Membership",
    description: "One-time prepaid membership coverage for 12 months.",
    duration_months: 12,
    interval_months: 12,
    payment_mode: "one_time",
    billing_model: "prepaid",
    billing_cycle: "annual",
    allow_auto_renew: 0,
    is_recurring: 0,
    sort_order: 40,
  },
];

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function boolToInt(value, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback ? 1 : 0;
  }

  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0") return 0;

  const normalized = String(value).trim().toLowerCase();
  return ["true", "yes", "y", "active", "enabled", "on"].includes(normalized)
    ? 1
    : 0;
}

function cleanNullable(value, max = 255) {
  const cleaned = clean(value, max);
  return cleaned || null;
}

function normalizeCurrency(value) {
  const currency = clean(value || "USD", 10).toUpperCase();
  return currency || "USD";
}

function normalizeCode(value) {
  return clean(value || "", 120)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function durationFromText(value) {
  const text = String(value || "").toLowerCase();

  if (text.includes("annual") || text.includes("year")) return 12;
  if (text.includes("semi")) return 6;
  if (text.includes("quarter")) return 3;
  if (text.includes("month")) return 1;

  const match = text.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function normalizeDurationMonths(payload = {}) {
  const raw =
    payload.duration_months ??
    payload.interval_months ??
    payload.coverage_months ??
    payload.months ??
    payload.month_count ??
    payload.plan_duration ??
    payload.billing_cycle ??
    payload.payment_mode ??
    payload.name;

  let duration = Number(raw);

  if (!Number.isFinite(duration) || duration <= 0) {
    duration = durationFromText(raw);
  }

  duration = Math.max(1, Number(duration || 1));

  if (!ALLOWED_DURATIONS.has(duration)) {
    throw new Error(
      "Membership plan duration must be one of: 1, 3, 6, or 12 months."
    );
  }

  return duration;
}

function normalizePaymentMode(payload = {}, durationMonths = 1) {
  const explicit = clean(
    payload.payment_mode ||
      payload.billing_mode ||
      payload.billing_model ||
      payload.subscription_type ||
      payload.plan_type ||
      "",
    80
  ).toLowerCase();

  if (
    explicit.includes("recurring") ||
    explicit.includes("subscription") ||
    explicit.includes("month_to_month") ||
    explicit.includes("monthly_recurring")
  ) {
    return "recurring";
  }

  if (
    explicit.includes("one_time") ||
    explicit.includes("one-time") ||
    explicit.includes("prepaid") ||
    explicit.includes("single") ||
    explicit.includes("pay_once") ||
    explicit.includes("payment")
  ) {
    return "one_time";
  }

  if (payload.is_recurring !== undefined) {
    return boolToInt(payload.is_recurring) ? "recurring" : "one_time";
  }

  if (payload.allow_auto_renew !== undefined && durationMonths === 1) {
    return boolToInt(payload.allow_auto_renew) ? "recurring" : "one_time";
  }

  return durationMonths === 1 ? "recurring" : "one_time";
}

function normalizeBillingCycle(durationMonths, paymentMode) {
  if (paymentMode === "recurring") return "monthly";
  if (durationMonths === 3) return "quarterly";
  if (durationMonths === 6) return "semi_annual";
  if (durationMonths === 12) return "annual";
  return "monthly";
}

function normalizeVisibility(value) {
  const visibility = clean(value || "public", 40).toLowerCase();
  if (["public", "internal", "hidden"].includes(visibility)) return visibility;
  return "public";
}

function normalizeStatus(payload = {}) {
  if (payload.status) {
    const status = clean(payload.status, 40).toLowerCase();
    if (["active", "inactive", "archived", "draft"].includes(status)) {
      return status;
    }
  }

  return boolToInt(payload.is_active, 1) ? "active" : "inactive";
}

function planLabel(durationMonths, paymentMode) {
  if (paymentMode === "recurring") return "Month-to-Month Membership";
  return `${durationMonths} Month Membership`;
}

function defaultPlanCode(durationMonths, paymentMode, name) {
  if (paymentMode === "recurring") {
    return "MEMBERSHIP_MONTHLY_RECURRING";
  }

  const base = normalizeCode(name) || `MEMBERSHIP_${durationMonths}_MONTH_PREPAID`;
  return base.includes("MEMBERSHIP") ? base : `MEMBERSHIP_${base}`;
}

function safeJson(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function normalizeAmount(value, fieldName = "amount", required = true) {
  if (!required && (value === undefined || value === null || value === "")) {
    return null;
  }

  const amount = money(value);

  if (required && amount <= 0) {
    throw new Error(`${fieldName} must be greater than zero.`);
  }

  if (!required && amount < 0) {
    throw new Error(`${fieldName} cannot be negative.`);
  }

  return amount;
}

function buildMembershipPlanRecord(payload = {}) {
  const durationMonths = normalizeDurationMonths(payload);
  const paymentMode = normalizePaymentMode(payload, durationMonths);
  const isRecurring = paymentMode === "recurring";
  const billingCycle = normalizeBillingCycle(durationMonths, paymentMode);

  const amount = normalizeAmount(payload.amount, "Membership plan amount", true);

  const minimumAmount = normalizeAmount(
    payload.minimum_amount,
    "Minimum amount",
    false
  );

  const maximumAmount = normalizeAmount(
    payload.maximum_amount,
    "Maximum amount",
    false
  );

  if (
    minimumAmount !== null &&
    maximumAmount !== null &&
    minimumAmount > maximumAmount
  ) {
    throw new Error("Minimum amount cannot be greater than maximum amount.");
  }

  if (minimumAmount !== null && amount < minimumAmount) {
    throw new Error("Plan amount cannot be below minimum amount.");
  }

  if (maximumAmount !== null && amount > maximumAmount) {
    throw new Error("Plan amount cannot be greater than maximum amount.");
  }

  const name =
    cleanNullable(payload.name || payload.plan_name || planLabel(durationMonths, paymentMode), 180) ||
    planLabel(durationMonths, paymentMode);

  const planCode =
    normalizeCode(payload.plan_code || payload.code) ||
    defaultPlanCode(durationMonths, paymentMode, name);

  const status = normalizeStatus(payload);
  const active = status === "active" ? 1 : 0;

  const monthlyEquivalentAmount =
    durationMonths > 0 ? money(amount / durationMonths) : amount;

  const allowAutoRenew = isRecurring ? 1 : 0;

  return {
    plan_code: planCode,
    code: planCode,

    name,
    plan_name: name,

    description: cleanNullable(payload.description, 2000),

    amount,
    price: amount,
    dues_amount: amount,
    monthly_equivalent_amount: monthlyEquivalentAmount,
    monthly_amount: monthlyEquivalentAmount,
    unit_amount: amount,

    currency: normalizeCurrency(payload.currency),

    minimum_amount: minimumAmount,
    maximum_amount: maximumAmount,

    interval_months: durationMonths,
    duration_months: durationMonths,
    coverage_months: durationMonths,
    months: durationMonths,

    payment_mode: paymentMode,
    billing_model: isRecurring ? "subscription" : "prepaid",
    billing_cycle: billingCycle,
    checkout_mode: isRecurring ? "subscription" : "payment",
    stripe_mode: isRecurring ? "subscription" : "payment",

    is_recurring: isRecurring ? 1 : 0,
    recurring: isRecurring ? 1 : 0,
    allow_auto_renew: allowAutoRenew,
    auto_renew_allowed: allowAutoRenew,
    auto_payment_enabled: isRecurring ? 1 : 0,

    is_active: active,
    status,

    visibility: normalizeVisibility(payload.visibility),

    max_members:
      payload.max_members === undefined || payload.max_members === null
        ? null
        : Math.max(0, Number(payload.max_members || 0)),

    sort_order:
      payload.sort_order !== undefined
        ? Number(payload.sort_order || 0)
        : isRecurring
          ? 10
          : durationMonths * 10,

    stripe_product_id: cleanNullable(payload.stripe_product_id, 255),
    stripe_price_id: cleanNullable(payload.stripe_price_id, 255),
    stripe_lookup_key: cleanNullable(payload.stripe_lookup_key, 255),

    accounting_code: cleanNullable(payload.accounting_code, 120),
    revenue_account: cleanNullable(payload.revenue_account, 120),

    tax_deductible: boolToInt(payload.tax_deductible, 0),
    requires_approval: boolToInt(payload.requires_approval, 0),

    features_json: safeJson(payload.features || payload.features_json),
    metadata_json: safeJson(payload.metadata || payload.metadata_json),

    created_by: payload.created_by || payload.user_id || null,
    updated_by: payload.updated_by || payload.user_id || null,

    updated_at: mysqlNow(),
  };
}

function hydrateMembershipPlan(row = {}) {
  if (!row) return null;

  const durationMonths = normalizeDurationMonths({
    duration_months: row.duration_months,
    interval_months: row.interval_months,
    coverage_months: row.coverage_months,
    months: row.months,
    name: row.name,
  });

  const paymentMode = normalizePaymentMode(row, durationMonths);
  const isRecurring = paymentMode === "recurring";
  const amount = money(row.amount ?? row.price ?? row.dues_amount ?? 0);

  return {
    ...row,

    id: row.id ? Number(row.id) : row.id,

    plan_code: row.plan_code || row.code || defaultPlanCode(durationMonths, paymentMode, row.name),
    code: row.code || row.plan_code || defaultPlanCode(durationMonths, paymentMode, row.name),

    name: row.name || row.plan_name || planLabel(durationMonths, paymentMode),
    plan_name: row.plan_name || row.name || planLabel(durationMonths, paymentMode),

    amount,
    price: money(row.price ?? amount),
    dues_amount: money(row.dues_amount ?? amount),
    monthly_equivalent_amount: money(
      row.monthly_equivalent_amount ??
        row.monthly_amount ??
        (durationMonths > 0 ? amount / durationMonths : amount)
    ),

    currency: normalizeCurrency(row.currency),

    interval_months: durationMonths,
    duration_months: durationMonths,
    coverage_months: durationMonths,
    months: durationMonths,

    payment_mode: paymentMode,
    billing_model: isRecurring ? "subscription" : "prepaid",
    billing_cycle: row.billing_cycle || normalizeBillingCycle(durationMonths, paymentMode),
    checkout_mode: isRecurring ? "subscription" : "payment",
    stripe_mode: isRecurring ? "subscription" : "payment",

    is_recurring: isRecurring ? 1 : 0,
    recurring: isRecurring ? 1 : 0,
    allow_auto_renew: isRecurring ? 1 : 0,
    auto_renew_allowed: isRecurring ? 1 : 0,

    is_prepaid: isRecurring ? 0 : 1,
    is_month_to_month: isRecurring && durationMonths === 1 ? 1 : 0,

    status: row.status || (boolToInt(row.is_active, 1) ? "active" : "inactive"),
    is_active: boolToInt(row.is_active, 1),

    plan_label: planLabel(durationMonths, paymentMode),
  };
}

function filterPlans(plans = [], filters = {}) {
  return plans.filter((plan) => {
    if (
      filters.active_only &&
      !(plan.is_active === 1 || String(plan.status).toLowerCase() === "active")
    ) {
      return false;
    }

    if (
      filters.payment_mode &&
      plan.payment_mode !== String(filters.payment_mode).toLowerCase()
    ) {
      return false;
    }

    if (
      filters.duration_months &&
      Number(plan.duration_months) !== Number(filters.duration_months)
    ) {
      return false;
    }

    if (
      filters.visibility &&
      String(plan.visibility || "public").toLowerCase() !==
        String(filters.visibility).toLowerCase()
    ) {
      return false;
    }

    return true;
  });
}

async function getMembershipPlanRow(connOrPool, planId) {
  return findOne(
    connOrPool,
    `
    SELECT *
    FROM tbl_membership_plans
    WHERE id = ?
    LIMIT 1
    `,
    [planId]
  );
}

/* =========================================================
   CREATE PLAN
========================================================= */

async function createMembershipPlan(payload = {}) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const record = {
      ...buildMembershipPlanRecord(payload),
      created_at: mysqlNow(),
    };

    const planId = await insertExistingColumns(conn, TABLE, record);

    const created = await getMembershipPlanRow(conn, planId);

    await conn.commit();

    return {
      success: true,
      id: planId,
      plan: hydrateMembershipPlan(created || { id: planId, ...record }),
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* =========================================================
   UPDATE PLAN
========================================================= */

async function updateMembershipPlan(planId, payload = {}) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const existing = await getMembershipPlanRow(conn, planId);

    if (!existing) {
      throw new Error("Membership plan not found.");
    }

    const merged = {
      ...existing,
      ...payload,
    };

    const record = buildMembershipPlanRecord(merged);

    delete record.created_by;

    const result = await updateExistingColumns(
      conn,
      TABLE,
      {
        ...record,
        updated_by: payload.updated_by || payload.user_id || existing.updated_by || null,
        updated_at: mysqlNow(),
      },
      "id = ?",
      [planId]
    );

    const updated = await getMembershipPlanRow(conn, planId);

    await conn.commit();

    return {
      success: true,
      id: Number(planId),
      affectedRows: result?.affectedRows ?? 0,
      plan: hydrateMembershipPlan(updated || { id: planId, ...record }),
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* =========================================================
   GET PLAN
========================================================= */

async function getMembershipPlan(planId) {
  const row = await getMembershipPlanRow(pool, planId);
  return hydrateMembershipPlan(row);
}

async function getMembershipPlanByCode(planCode) {
  const normalized = normalizeCode(planCode);

  if (!normalized) return null;

  const plans = await listMembershipPlans();

  return (
    plans.find(
      (plan) =>
        normalizeCode(plan.plan_code) === normalized ||
        normalizeCode(plan.code) === normalized
    ) || null
  );
}

async function resolveMembershipPlan(identifier) {
  if (!identifier) return null;

  if (/^\d+$/.test(String(identifier))) {
    return getMembershipPlan(Number(identifier));
  }

  return getMembershipPlanByCode(identifier);
}

/* =========================================================
   LIST PLANS
========================================================= */

async function listActiveMembershipPlans(filters = {}) {
  const rows = await findMany(
    pool,
    `
    SELECT *
    FROM tbl_membership_plans
    WHERE is_active = 1
    ORDER BY
      sort_order ASC,
      amount ASC,
      id ASC
    `,
    []
  );

  return filterPlans(rows.map(hydrateMembershipPlan), {
    ...filters,
    active_only: true,
  });
}

async function listMembershipPlans(filters = {}) {
  const rows = await findMany(
    pool,
    `
    SELECT *
    FROM tbl_membership_plans
    ORDER BY
      sort_order ASC,
      amount ASC,
      id ASC
    `,
    []
  );

  return filterPlans(rows.map(hydrateMembershipPlan), filters);
}

/* =========================================================
   PLAN STATE
========================================================= */

async function disableMembershipPlan(planId, userId = null) {
  const result = await updateExistingColumns(
    pool,
    TABLE,
    {
      is_active: 0,
      status: "inactive",
      updated_by: userId,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [planId]
  );

  return {
    success: true,
    id: Number(planId),
    affectedRows: result?.affectedRows ?? 0,
  };
}

async function enableMembershipPlan(planId, userId = null) {
  const result = await updateExistingColumns(
    pool,
    TABLE,
    {
      is_active: 1,
      status: "active",
      updated_by: userId,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [planId]
  );

  return {
    success: true,
    id: Number(planId),
    affectedRows: result?.affectedRows ?? 0,
  };
}

async function archiveMembershipPlan(planId, userId = null) {
  const result = await updateExistingColumns(
    pool,
    TABLE,
    {
      is_active: 0,
      status: "archived",
      archived_at: mysqlNow(),
      updated_by: userId,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [planId]
  );

  return {
    success: true,
    id: Number(planId),
    affectedRows: result?.affectedRows ?? 0,
  };
}

/* =========================================================
   CHECKOUT / UI HELPERS
========================================================= */

function isRecurringPlan(plan = {}) {
  return normalizePaymentMode(plan, normalizeDurationMonths(plan)) === "recurring";
}

function isPrepaidPlan(plan = {}) {
  return !isRecurringPlan(plan);
}

function buildCheckoutPlan(plan = {}) {
  const normalized = hydrateMembershipPlan(plan);

  if (!normalized) return null;

  return {
    id: normalized.id,
    plan_code: normalized.plan_code,
    name: normalized.name,
    description: normalized.description,
    amount: normalized.amount,
    currency: normalized.currency,
    duration_months: normalized.duration_months,
    interval_months: normalized.interval_months,
    payment_mode: normalized.payment_mode,
    billing_model: normalized.billing_model,
    billing_cycle: normalized.billing_cycle,
    checkout_mode: normalized.checkout_mode,
    stripe_mode: normalized.stripe_mode,
    stripe_price_id: normalized.stripe_price_id || null,
    stripe_product_id: normalized.stripe_product_id || null,
    allow_auto_renew: normalized.allow_auto_renew,
    is_recurring: normalized.is_recurring,
    is_prepaid: normalized.is_prepaid,
    monthly_equivalent_amount: normalized.monthly_equivalent_amount,
  };
}

async function getCheckoutMembershipPlan(identifier) {
  const plan = await resolveMembershipPlan(identifier);

  if (!plan) {
    throw new Error("Membership plan not found.");
  }

  if (
    plan.is_active !== 1 ||
    String(plan.status || "active").toLowerCase() !== "active"
  ) {
    throw new Error("Membership plan is not active.");
  }

  return buildCheckoutPlan(plan);
}

function buildDefaultMembershipPlanTemplates(amounts = {}) {
  return DEFAULT_PLAN_TEMPLATES.map((template) => ({
    ...template,
    amount:
      amounts[template.duration_months] ||
      amounts[template.plan_code] ||
      template.amount ||
      0,
    currency: "USD",
    is_active: 1,
    visibility: "public",
  }));
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  createMembershipPlan,
  updateMembershipPlan,
  getMembershipPlan,
  getMembershipPlanByCode,
  resolveMembershipPlan,
  listActiveMembershipPlans,
  listMembershipPlans,
  disableMembershipPlan,
  enableMembershipPlan,
  archiveMembershipPlan,

  buildMembershipPlanRecord,
  hydrateMembershipPlan,
  buildCheckoutPlan,
  getCheckoutMembershipPlan,

  isRecurringPlan,
  isPrepaidPlan,

  normalizeDurationMonths,
  normalizePaymentMode,
  normalizeBillingCycle,

  buildDefaultMembershipPlanTemplates,
};