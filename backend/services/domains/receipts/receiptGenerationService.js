// backend/services/domains/receipts/receiptGenerationService.js
"use strict";

const {
  insertExistingColumns,
  findOne,
} = require("../../../utils/dbHelpers");

const {
  clean,
  money,
  mysqlNow,
  normalizePaymentType,
} = require("../../../utils/financeHelpers");

const {
  generateReceiptNumber,
} = require("../../../utils/numberGenerator");

const {
  donationCategoryLabel,
} = require("../../shared/paymentHelpers");

const {
  buildCoveragePayload,
} = require("../../shared/coverageHelpers");

/* =========================================================
   HELPERS
========================================================= */

function safeJson(value, fallback = null) {
  if (!value) return fallback;

  try {
    if (typeof value === "string") {
      JSON.parse(value);
      return value;
    }

    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function normalizeCategory(payload = {}) {
  const raw =
    payload.payment_type ||
    payload.category ||
    payload.payment_category ||
    "payment";

  const type = normalizePaymentType(raw);

  if (["kids", "kids_school", "school_program"].includes(type)) {
    return "school";
  }

  if (["travel"].includes(type)) {
    return "trip";
  }

  if (["dues", "membership_dues", "registration_fee"].includes(type)) {
    return "membership";
  }

  if (["giving", "tithe"].includes(type)) {
    return "donation";
  }

  return type || "payment";
}

function normalizeParticipants(payload = {}) {
  const raw =
    payload.participants ||
    payload.participants_json ||
    payload.participant_names ||
    [];

  if (Array.isArray(raw)) return raw;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* =========================================================
   BUILD RECEIPT TITLE
========================================================= */

function buildReceiptTitle(payload = {}) {
  const type = normalizeCategory(payload);

  if (type === "membership") {
    return "Membership Payment Receipt";
  }

  if (type === "donation") {
    return "Donation Receipt";
  }

  if (type === "school") {
    return "School Program Receipt";
  }

  if (type === "trip") {
    return "Trip Registration Receipt";
  }

  if (type === "pledge") {
    return "Pledge Receipt";
  }

  if (type === "sunday_collection") {
    return "Sunday Collection Receipt";
  }

  return "Payment Receipt";
}

/* =========================================================
   BUILD SNAPSHOT
========================================================= */
function buildReceiptSnapshot(payload = {}) {

  const type =
    normalizeCategory(payload);

  const donationCategory =

    payload.donation_category ||

    payload.sub_category ||

    null;

  const participants =
    normalizeParticipants(payload);

  /* =====================================================
     MEMBERSHIP COVERAGE
  ===================================================== */

  const coverage =
    buildCoveragePayload({

      coverage_year:
        payload.coverage_year,

      coverage_start_month:
        payload.coverage_start_month,

      coverage_end_month:
        payload.coverage_end_month,

      months_paid:

        payload.months_paid ||

        payload.duration_months,

      coverage_months_json:

        payload.coverage_months_json ||

        payload.coverage_months,
    });

  /* =====================================================
     SNAPSHOT
  ===================================================== */

  const snapshot = {

    receipt_type:
      type,

    category:
      type,

    sub_category:

      payload.sub_category ||

      donationCategory ||

      payload.program_name ||

      payload.plan_name ||

      null,

    /* =========================================
       DONATION
    ========================================= */

    donation_category:

      type === "donation"

        ? donationCategory ||
          "general_donation"

        : null,

    donation_category_label:

      type === "donation"

        ? donationCategoryLabel(

            donationCategory ||
            "general_donation"
          )

        : null,

    /* =========================================
       MEMBERSHIP PLAN
    ========================================= */

    plan_id:
      payload.plan_id || null,

    plan_name:
      payload.plan_name || null,

    months_paid:

      type === "membership"

        ? Number(

            payload.months_paid ||

            coverage.months_paid ||

            1
          )

        : null,

    /* =========================================
       MEMBERSHIP COVERAGE
    ========================================= */

    coverage_year:

      type === "membership"

        ? payload.coverage_year ||

          coverage.coverage_year ||

          null

        : null,

    coverage_start_month:

      type === "membership"

        ? payload.coverage_start_month ||

          coverage.coverage_start_month ||

          null

        : null,

    coverage_end_month:

      type === "membership"

        ? payload.coverage_end_month ||

          coverage.coverage_end_month ||

          null

        : null,

    coverage_label:

      type === "membership"

        ? payload.coverage_label ||

          coverage.coverage_label ||

          null

        : null,

    coverage_months_json:

      type === "membership"

        ? coverage.coverage_months_json ||

          null

        : null,

    /* =========================================
       PROGRAMS
    ========================================= */

    program_name:

      ["school", "trip"].includes(type)

        ? payload.program_name ||

          payload.program_title ||

          payload.sub_category ||

          null

        : null,

    program_type:

      ["school", "trip"].includes(type)

        ? type

        : null,

    quantity:

      ["school", "trip"].includes(type)

        ? Number(payload.quantity || 1)

        : null,

    price_per_person:

      ["school", "trip"].includes(type)

        ? Number(
            payload.price_per_person || 0
          )

        : null,

    participants_json:

      ["school", "trip"].includes(type)

        ? safeJson(
            participants,
            "[]"
          )

        : null,

    registration_id:

      ["school", "trip"].includes(type)

        ? payload.registration_id ||

          null

        : null,

    news_event_id:

      ["school", "trip"].includes(type)

        ? payload.news_event_id ||

          payload.related_entity_id ||

          null

        : null,
  };

  return snapshot;
}

/* =========================================================
   GENERATE RECEIPT
========================================================= */

async function generateReceipt(conn, payload = {}) {
  const receiptNumber =
    payload.receipt_number ||
    generateReceiptNumber();

  const type =
    normalizeCategory(payload);

  const snapshot =
    buildReceiptSnapshot(payload);

  const amount =
    Number(payload.amount || 0);

  const receiptId =
    await insertExistingColumns(
      conn,
      "tbl_finance_receipts",
      {
        payment_id:
          payload.payment_id,

        invoice_id:
          payload.invoice_id || null,

        member_id:
          payload.member_id || null,

        member_no:
          payload.member_no || null,

        receipt_number:
          receiptNumber,

        payment_number:
          payload.payment_number || null,

        title:
          buildReceiptTitle(payload),

        payment_type:
          type,

        category:
          type,

        sub_category:
          snapshot.sub_category,

        donation_category:
          snapshot.donation_category,

        donation_category_label:
          snapshot.donation_category_label,

        plan_id:
          snapshot.plan_id,

        plan_name:
          snapshot.plan_name,

        months_paid:
          snapshot.months_paid,

        coverage_year:
          snapshot.coverage_year,

        coverage_start_month:
          snapshot.coverage_start_month,
coverage_end_month:
  snapshot.coverage_end_month,
        coverage_label:
          snapshot.coverage_label,

        coverage_months_json:
          snapshot.coverage_months_json,

        program_name:
          snapshot.program_name,

        program_type:
          snapshot.program_type,

        quantity:
          snapshot.quantity,

        price_per_person:
          snapshot.price_per_person,

        participants_json:
          snapshot.participants_json,

        registration_id:
          snapshot.registration_id,

        news_event_id:
          snapshot.news_event_id,

        full_name_snapshot:
          clean(
            payload.full_name ||
            payload.full_name_snapshot ||
            "Member / Guest"
          ),

        email_snapshot:
          clean(
            payload.email ||
            payload.email_snapshot ||
            ""
          ),

        phone_snapshot:
          clean(
            payload.phone ||
            payload.phone_snapshot ||
            ""
          ),

        amount,

        currency:
          payload.currency || "USD",

        payment_method:
          payload.payment_method ||
          payload.method ||
          "card",

        payment_provider:
          payload.payment_provider ||
          payload.provider ||
          "stripe",

        payment_status:
          payload.payment_status ||
          payload.status ||
          "paid",

        reference_no:
          payload.reference_no || null,

        transaction_reference:
          payload.transaction_reference ||
          payload.stripe_payment_intent_id ||
          payload.stripe_payment_intent ||
          null,

        receipt_snapshot_json:
          safeJson(
            {
              ...snapshot,
              amount,
              currency: payload.currency || "USD",
              payment_number: payload.payment_number || null,
              invoice_number: payload.invoice_number || null,
            },
            null
          ),

        email_status:
          payload.email ||
          payload.email_snapshot
            ? "pending"
            : "not_available",

        emailed_to:
          payload.email ||
          payload.email_snapshot ||
          null,

        status:
          "issued",

        issued_at:
          payload.issued_at || mysqlNow(),

        receipt_date:
          payload.receipt_date || mysqlNow(),

        created_by:
          payload.created_by || null,

        created_at:
          mysqlNow(),

        updated_at:
          mysqlNow(),
      }
    );

  return {
    id: receiptId,
    receipt_number: receiptNumber,
    receipt_type: type,
  };
}

/* =========================================================
   GET RECEIPT
========================================================= */

async function getReceipt(conn, receiptId) {
  return findOne(
    conn,
    `
    SELECT *
    FROM tbl_finance_receipts
    WHERE id = ?
    LIMIT 1
    `,
    [receiptId]
  );
}

/* =========================================================
   GET RECEIPT BY PAYMENT
========================================================= */

async function getReceiptByPayment(conn, paymentId) {
  return findOne(
    conn,
    `
    SELECT *
    FROM tbl_finance_receipts
    WHERE payment_id = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [paymentId]
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  buildReceiptTitle,
  buildReceiptSnapshot,
  generateReceipt,
  getReceipt,
  getReceiptByPayment,
};