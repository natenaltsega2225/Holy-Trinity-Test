// backend/utils/financeHelpers.js
"use strict";

const crypto = require("crypto");

const {
  addMonths,
  calculateCoverage,
  mysqlDate,
  mysqlNow,
  dateOnly,
  buildCoverageLabel,
} = require("./dateHelpers");

/* -------------------------------------------------------------------------- */
/* Text / JSON                                                                */
/* -------------------------------------------------------------------------- */

function clean(value, max = 255) {
  return String(value ?? "")
    .trim()
    .slice(0, Math.max(1, Number(max || 255)));
}

function nullable(value, max = 255) {
  const text = clean(value, max);
  return text || null;
}

function safeJson(value) {
  if (value === undefined || value === null) return null;

  if (typeof value === "string") {
    const text = value.trim();
    return text || null;
  }

  try {
    return JSON.stringify(value);
  } catch (_err) {
    return JSON.stringify({ value: String(value) });
  }
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;

  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch (_err) {
    return fallback;
  }
}

function slug(value, fallback = "item") {
  const text = clean(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return text || fallback;
}

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

function money(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) return 0;

  return Number(number.toFixed(2));
}

function cents(value) {
  return Math.round(money(value) * 100);
}

function fromCents(value) {
  return money(Number(value || 0) / 100);
}

function publicMoney(value) {
  return money(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatCurrency(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(money(value));
}

/* -------------------------------------------------------------------------- */
/* Numbers                                                                    */
/* -------------------------------------------------------------------------- */

function generateNumber(prefix = "HT") {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);

  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();

  return `${clean(prefix, 20).toUpperCase()}-${stamp}-${rand}`;
}

function generatePublicToken(bytes = 32) {
  return crypto.randomBytes(Number(bytes || 32)).toString("base64url");
}

function sha256Hex(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

/* -------------------------------------------------------------------------- */
/* Donation Categories                                                        */
/* -------------------------------------------------------------------------- */

const DONATION_CATEGORIES = {
  membership: "አባልነት — Membership",
  plate_collection: "መባ — Plate Collection",
  candle_sale: "ሻማ — Candle Sale",
  general_donation: "ስጦታ — General Donation",
  tithe: "አስራት — Tithe",
  vows: "ስዕለት — Vows",
  baptism: "ክርስትና — Baptism",
  wedding_engagement: "ጋብቻ / ቀለበት — Wedding / Engagement",
  memorial_service: "ፍታት — Memorial Service",
  pledge: "ቃል የተገባ — Pledge",
  building_fund: "የቤተክርስቲያን ማሰሪያ — Building Fund",
  charity_fund: "በጎ አድራጎት — Charity Fund",
  auction: "ጨረታ — Auction",
  other_fund: "ሌላ — Other Fund",
  sunday_cash_collection: "የእሁድ ስብስብ — Sunday Collection",
  school: "ትምህርት — School Program",
  trip: "ጉዞ — Trip Program",
};

function normalizeDonationCategory(value) {
  const key = slug(value || "general_donation", "general_donation");

  const aliases = {
    donation: "general_donation",
    general: "general_donation",
    plate: "plate_collection",
    candle: "candle_sale",
    wedding: "wedding_engagement",
    engagement: "wedding_engagement",
    memorial: "memorial_service",
    building: "building_fund",
    charity: "charity_fund",
    sunday: "sunday_cash_collection",
  };

  const normalized = aliases[key] || key;

  return DONATION_CATEGORIES[normalized]
    ? normalized
    : "general_donation";
}

function donationCategoryLabel(value) {
  const key = normalizeDonationCategory(value);
  return DONATION_CATEGORIES[key] || DONATION_CATEGORIES.general_donation;
}

/* -------------------------------------------------------------------------- */
/* Payment Normalization                                                      */
/* -------------------------------------------------------------------------- */

function normalizePaymentType(value) {
  const raw = slug(value || "other", "other");

  if (
    [
      "membership",
      "membership_dues",
      "member_dues",
      "registration_fee",
      "registration_with_plan",
      "membership_registration",
      "dues",
    ].includes(raw)
  ) {
    return "membership";
  }

  if (["school", "school_program", "kids", "kids_school", "program"].includes(raw)) {
    return "school";
  }

  if (["trip", "travel", "trip_program"].includes(raw)) {
    return "trip";
  }

  if (["donation", "giving", "donate", "manual_donation"].includes(raw)) {
    return "donation";
  }

  if (["pledge", "pledges", "campaign_pledge"].includes(raw)) {
    return "pledge";
  }

  return raw || "other";
}

function normalizePaymentMethod(value) {
  const method = slug(value || "card", "card");

  const aliases = {
    credit_card: "card",
    debit_card: "card",
    stripe: "card",
    bank: "ach",
    bank_account: "ach",
    us_bank_account: "ach",
    cheque: "check",
    manual_check: "check",
    manual_cash: "cash",
    manual_zelle: "zelle",
    cash_collection: "cash",
  };

  const normalized = aliases[method] || method;

  const allowed = new Set([
    "card",
    "ach",
    "cash",
    "check",
    "zelle",
    "bank_deposit",
    "other",
  ]);

  return allowed.has(normalized) ? normalized : "other";
}

function normalizeProvider(value, method = "") {
  const provider = slug(value || "", "");

  if (provider) return provider;

  const normalizedMethod = normalizePaymentMethod(method);

  if (normalizedMethod === "card" || normalizedMethod === "ach") {
    return "stripe";
  }

  return "manual";
}

function normalizeStatus(value) {
  const status = slug(value || "paid", "paid");

  if (["paid", "success", "successful", "completed", "posted", "succeeded"].includes(status)) {
    return "paid";
  }

  if (["pending", "open", "processing", "requires_action"].includes(status)) {
    return "pending";
  }

  if (["failed", "declined", "error"].includes(status)) {
    return "failed";
  }

  if (["cancelled", "canceled", "void", "voided"].includes(status)) {
    return "cancelled";
  }

  if (["refunded", "refund"].includes(status)) {
    return "refunded";
  }

  return "paid";
}

function isPaidStatus(value) {
  return normalizeStatus(value) === "paid";
}

function isPendingStatus(value) {
  return normalizeStatus(value) === "pending";
}

function isFailedStatus(value) {
  return normalizeStatus(value) === "failed";
}

/* -------------------------------------------------------------------------- */
/* Coverage                                                                   */
/* -------------------------------------------------------------------------- */

function normalizeMonths(payload = {}) {
  const months =
    Number(payload.months_paid) ||
    Number(payload.months) ||
    Number(payload.duration_months) ||
    Number(payload.interval_count) ||
    Number(payload.plan_months) ||
    1;

  return Math.max(1, Math.trunc(months));
}

function buildCoverage(payload = {}) {
  const months = normalizeMonths(payload);

  const start =
    payload.coverage_start ||
    payload.coverage_start_date ||
    payload.start_date ||
    payload.membership_start_date ||
    payload.paid_at ||
    payload.payment_date ||
    new Date();

  const coverage = calculateCoverage({
    startDate: start,
    monthsPaid: months,
  });

  return {
    months,
    start: coverage.coverage_start,
    end: coverage.coverage_end,
    label: coverage.coverage_label,
    coverage_start: coverage.coverage_start,
    coverage_end: coverage.coverage_end,
    coverage_label: coverage.coverage_label,
    coverage_months: coverage.coverage_months,
  };
}

/* -------------------------------------------------------------------------- */
/* Display                                                                    */
/* -------------------------------------------------------------------------- */

function cardDisplay(row = {}) {
  const last4 =
    row.card_last4 ||
    row.card_last_4 ||
    row.last4 ||
    "";

  if (!last4) return "--";

  return `${String(row.card_brand || row.brand || "CARD").toUpperCase()} **** ${last4}`;
}

function maskEmail(value = "") {
  const email = String(value || "");
  const [name, domain] = email.split("@");

  if (!name || !domain) return email;

  return `${name.slice(0, 2)}***@${domain}`;
}

module.exports = {
  clean,
  nullable,
  safeJson,
  parseJson,
  slug,

  money,
  cents,
  fromCents,
  publicMoney,
  formatCurrency,

  mysqlNow,
  dateOnly,
  mysqlDate,

  generateNumber,
  generatePublicToken,
  sha256Hex,

  DONATION_CATEGORIES,
  normalizeDonationCategory,
  donationCategoryLabel,

  normalizePaymentType,
  normalizePaymentMethod,
  normalizeProvider,
  normalizeStatus,

  isPaidStatus,
  isPendingStatus,
  isFailedStatus,

  normalizeMonths,
  buildCoverage,
  addMonths,
  buildCoverageLabel,

  cardDisplay,
  maskEmail,
};