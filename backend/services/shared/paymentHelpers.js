// backend/services/shared/paymentHelpers.js
"use strict";

/*
=========================================================
 ENTERPRISE PAYMENT HELPERS
---------------------------------------------------------
 Shared payment helper system

 Used by:
 - receipts
 - invoices
 - Stripe webhook
 - manual collection
 - school/trip registration
 - donation system
 - dashboards
 - reporting
=========================================================
*/

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

/* =========================================================
   CLEAN
========================================================= */

function clean(value, fallback = "") {
  const v = String(value ?? "").trim();

  return v || fallback;
}

/* =========================================================
   MONEY
========================================================= */

function money(value) {
  return Number(value || 0);
}

function publicMoney(value) {
  return `$${money(value).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

/* =========================================================
   CATEGORY NORMALIZATION
========================================================= */

function normalizePaymentCategory(value) {
  const raw =
    clean(value, "payment")
      .toLowerCase()
      .replace(/\s+/g, "_");

  if (
    [
      "membership",
      "membership_dues",
      "dues",
      "member_dues",
      "registration_fee",
    ].includes(raw)
  ) {
    return "membership";
  }

  if (
    [
      "donation",
      "giving",
      "tithe",
    ].includes(raw)
  ) {
    return "donation";
  }

  if (
    [
      "school",
      "kids",
      "kids_school",
      "school_program",
    ].includes(raw)
  ) {
    return "school";
  }

  if (
    [
      "trip",
      "travel",
      "retreat",
    ].includes(raw)
  ) {
    return "trip";
  }

  if (
    [
      "pledge",
      "promise_to_pay",
    ].includes(raw)
  ) {
    return "pledge";
  }

  return raw;
}

/* =========================================================
   PAYMENT LABEL
========================================================= */

function paymentCategoryLabel(value) {
  const type =
    normalizePaymentCategory(value);

  const labels = {
    membership:
      "Membership Dues",

    donation:
      "Donation",

    school:
      "School Program",

    trip:
      "Trip Program",

    pledge:
      "Pledge Payment",
  };

  return labels[type] || "Payment";
}

/* =========================================================
   DONATION LABEL
========================================================= */

function donationCategoryLabel(value) {
  const key =
    clean(
      value,
      "general_donation"
    )
      .toLowerCase()
      .replace(/\s+/g, "_");

  return (
    DONATION_CATEGORIES[key] ||
    key
      .replaceAll("_", " ")
      .replace(/\b\w/g, (m) =>
        m.toUpperCase()
      )
  );
}

/* =========================================================
   PAYMENT METHOD LABEL
========================================================= */

function paymentMethodLabel(value) {
  const raw =
    clean(value)
      .toLowerCase();

  const map = {
    cash: "Cash",
    check: "Check",
    card: "Card",
    stripe: "Stripe",
    zelle: "Zelle",
    ach: "ACH",
    bank: "Bank Transfer",
  };

  return map[raw] || raw;
}

/* =========================================================
   CARD LABEL
========================================================= */

function buildCardLabel({
  card_brand,
  card_last4,
} = {}) {
  if (
    !card_brand ||
    !card_last4
  ) {
    return "--";
  }

  return `${String(
    card_brand
  ).toUpperCase()} •••• ${card_last4}`;
}

/* =========================================================
   COVERAGE LABEL
========================================================= */

function buildCoverageLabel({
  coverage_start,
  coverage_end,
  coverage_label,
} = {}) {
  if (coverage_label) {
    return coverage_label;
  }

  if (
    !coverage_start ||
    !coverage_end
  ) {
    return "--";
  }

  const start =
    new Date(coverage_start);

  const end =
    new Date(coverage_end);

  return `${start.toLocaleDateString(
    "en-US",
    {
      month: "short",
      year: "numeric",
    }
  )} - ${end.toLocaleDateString(
    "en-US",
    {
      month: "short",
      year: "numeric",
    }
  )}`;
}

/* =========================================================
   MEMBERSHIP PAYMENT
========================================================= */

function isMembershipPayment(value) {
  return (
    normalizePaymentCategory(
      value
    ) === "membership"
  );
}

/* =========================================================
   DONATION PAYMENT
========================================================= */

function isDonationPayment(value) {
  return (
    normalizePaymentCategory(
      value
    ) === "donation"
  );
}

/* =========================================================
   SCHOOL PAYMENT
========================================================= */

function isSchoolPayment(value) {
  return (
    normalizePaymentCategory(
      value
    ) === "school"
  );
}

/* =========================================================
   TRIP PAYMENT
========================================================= */

function isTripPayment(value) {
  return (
    normalizePaymentCategory(
      value
    ) === "trip"
  );
}

/* =========================================================
   PROGRAM PAYMENT
========================================================= */

function isProgramPayment(value) {
  const type =
    normalizePaymentCategory(
      value
    );

  return (
    type === "school" ||
    type === "trip"
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  DONATION_CATEGORIES,

  clean,
  money,
  publicMoney,

  normalizePaymentCategory,
  paymentCategoryLabel,

  donationCategoryLabel,

  paymentMethodLabel,

  buildCardLabel,
  buildCoverageLabel,

  isMembershipPayment,
  isDonationPayment,
  isSchoolPayment,
  isTripPayment,
  isProgramPayment,
};