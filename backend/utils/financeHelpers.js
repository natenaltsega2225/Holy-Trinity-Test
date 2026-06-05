// backend/utils/financeHelpers.js
"use strict";

const crypto = require("crypto");

const {
  addMonths,
  buildCoverageLabel,
  mysqlDate,
} = require("./dateHelpers");

/* =========================================================
   BASIC HELPERS
========================================================= */

function clean(value, max = 255) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function nullable(value, max = 255) {
  const text = clean(value, max);
  return text || null;
}

function money(value) {
  const n = Number(value || 0);

  if (!Number.isFinite(n)) {
    return 0;
  }

  return Number(n.toFixed(2));
}

function cents(value) {
  return Math.round(money(value) * 100);
}

function mysqlNow(date = new Date()) {
  const d =
    date instanceof Date
      ? date
      : new Date(date);

  if (
    Number.isNaN(d.getTime())
  ) {
    return mysqlNow(
      new Date()
    );
  }

  return d
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

function dateOnly(
  value = new Date()
) {
  const d =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(d.getTime())
  ) {
    return new Date()
      .toISOString()
      .slice(0, 10);
  }

  return d
    .toISOString()
    .slice(0, 10);
}

function generateNumber(
  prefix
) {
  const stamp = new Date()
    .toISOString()
    .replace(
      /[-:.TZ]/g,
      ""
    )
    .slice(0, 14);

  const rand =
    crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase();

  return `${prefix}-${stamp}-${rand}`;
}

/* =========================================================
   DONATION CATEGORIES
========================================================= */

const DONATION_CATEGORIES = {

  plate_collection:
    "መባ — Plate Collection",

  candle_sale:
    "ሻማ — Candle Sale",

  general_donation:
    "ስጦታ — General Donation",

  tithe:
    "አስራት — Tithe",

  vows:
    "ስዕለት — Vows",

  baptism:
    "ክርስትና — Baptism",

  wedding_engagement:
    "ጋብቻ / ቀለበት — Wedding / Engagement",

  memorial_service:
    "ፍታት — Memorial Service",

  pledge:
    "ቃል የተገባ — Pledge",

  building_fund:
    "የቤተክርስቲያን ማሰሪያ — Building Fund",

  charity_fund:
    "በጎ አድራጎት — Charity Fund",

  auction:
    "ጨረታ — Auction",

  other_fund:
    "ሌላ — Other Fund",

  sunday_cash_collection:
    "የእሁድ ስብስብ — Sunday Collection",
};

function normalizeDonationCategory(
  value
) {

  const key = clean(
    value ||
      "general_donation",
    120
  )
    .toLowerCase()
    .replace(/\s+/g, "_");

  return DONATION_CATEGORIES[
    key
  ]
    ? key
    : "general_donation";
}

function donationCategoryLabel(
  value
) {

  return DONATION_CATEGORIES[
    normalizeDonationCategory(
      value
    )
  ];
}

/* =========================================================
   PAYMENT NORMALIZATION
========================================================= */

function normalizePaymentType(
  value
) {

  const raw = clean(
    value,
    80
  ).toLowerCase();

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

  if (
    [
      "school",
      "school_program",
      "kids",
      "kids_school",
      "program",
    ].includes(raw)
  ) {
    return "school";
  }

  if (
    ["trip", "travel"].includes(
      raw
    )
  ) {
    return "trip";
  }

  if (
    [
      "donation",
      "giving",
      "donate",
      "manual_donation",
    ].includes(raw)
  ) {
    return "donation";
  }

  return raw || "other";
}

function normalizePaymentMethod(
  value
) {

  const method = clean(
    value || "card",
    50
  ).toLowerCase();

  const allowed = new Set([
    "card",
    "cash",
    "check",
    "zelle",
    "bank_deposit",
    "cash_collection",
    "ach",
    "manual",
    "other",
  ]);

  return allowed.has(method)
    ? method
    : "other";
}

function normalizeProvider(
  value,
  method = ""
) {

  const provider = clean(
    value,
    50
  ).toLowerCase();

  if (provider) {
    return provider;
  }

  const m =
    normalizePaymentMethod(
      method
    );

  if (
    m === "card" ||
    m === "ach"
  ) {
    return "stripe";
  }

  return "manual";
}

function normalizeStatus(
  value
) {

  const status = clean(
    value || "paid",
    40
  ).toLowerCase();

  if (
    [
      "paid",
      "success",
      "successful",
      "completed",
      "posted",
      "succeeded",
    ].includes(status)
  ) {
    return "paid";
  }

  if (
    [
      "pending",
      "open",
      "processing",
    ].includes(status)
  ) {
    return "pending";
  }

  if (
    [
      "failed",
      "declined",
    ].includes(status)
  ) {
    return "failed";
  }

  if (
    [
      "cancelled",
      "canceled",
      "void",
    ].includes(status)
  ) {
    return "cancelled";
  }

  return "paid";
}

/* =========================================================
   STATUS HELPERS
========================================================= */

function isPaidStatus(
  value
) {

  return (
    normalizeStatus(value) ===
    "paid"
  );
}

function isPendingStatus(
  value
) {

  return (
    normalizeStatus(value) ===
    "pending"
  );
}

function isFailedStatus(
  value
) {

  return (
    normalizeStatus(value) ===
    "failed"
  );
}

/* =========================================================
   COVERAGE HELPERS
========================================================= */

function normalizeMonths(
  payload = {}
) {

  const months =
    Number(
      payload.months_paid
    ) ||
    Number(
      payload.months
    ) ||
    Number(
      payload.duration_months
    ) ||
    Number(
      payload.interval_count
    ) ||
    Number(
      payload.plan_months
    ) ||
    1;

  return Math.max(
    1,
    Math.trunc(months)
  );
}

function buildCoverage(
  payload = {}
) {

  const months =
    normalizeMonths(
      payload
    );

  const paidAt =
    payload.paid_at ||
    payload.payment_date ||
    new Date();

  const paidDate =
    new Date(paidAt);

  const safeDate =
    Number.isNaN(
      paidDate.getTime()
    )
      ? new Date()
      : paidDate;

  const start =
    payload.coverage_start ||
    payload.coverage_start_date ||
    new Date(
      safeDate.getFullYear(),
      safeDate.getMonth(),
      1
    );

  const startDate =
    new Date(start);

  const safeStart =
    Number.isNaN(
      startDate.getTime()
    )
      ? new Date(
          safeDate.getFullYear(),
          safeDate.getMonth(),
          1
        )
      : startDate;

  const safeEnd =
    addMonths(
      safeStart,
      months
    );

  return {

    months,

    start:
      mysqlDate(
        safeStart
      ),

    end:
      mysqlDate(
        safeEnd
      ),

    label:
      buildCoverageLabel(
        safeStart,
        safeEnd
      ),
  };
}

/* =========================================================
   CARD DISPLAY
========================================================= */

function cardDisplay(
  row = {}
) {

  if (!row.card_last4) {
    return "--";
  }

  return `${String(
    row.card_brand ||
      "CARD"
  ).toUpperCase()} •••• ${
    row.card_last4
  }`;
}

/* =========================================================
   MONEY DISPLAY
========================================================= */

function publicMoney(
  value
) {

  return `$${money(
    value
  ).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

/* =========================================================
   CURRENCY FORMAT
========================================================= */

function formatCurrency(

  value,

  currency = "USD"
) {

  return new Intl.NumberFormat(
    "en-US",
    {

      style: "currency",

      currency,
    }
  ).format(
    money(value)
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  clean,
  nullable,

  money,
  cents,

  mysqlNow,
  dateOnly,

  generateNumber,

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

  cardDisplay,

  publicMoney,
  formatCurrency,
};