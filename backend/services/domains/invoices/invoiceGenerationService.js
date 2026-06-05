// backend/services/domains/invoices/invoiceGenerationService.js
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
  generateInvoiceNumber,
} = require("../../../utils/numberGenerator");

const {
  donationCategoryLabel,
} = require("../../shared/paymentHelpers");

const {
  buildCoveragePayload,
} = require("../../shared/coverageHelpers");

const {
  createInvoiceItems,
  buildMembershipInvoiceItems,
  buildDonationInvoiceItems,
  buildProgramInvoiceItems,
} = require("./invoiceItemService");

/* =========================================================
   HELPERS
========================================================= */

function safeJson(
  value,
  fallback = null
) {

  if (!value) {
    return fallback;
  }

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

function normalizeCategory(
  payload = {}
) {

  const raw =
    payload.payment_type ||
    payload.category ||
    "payment";

  const type =
    normalizePaymentType(raw);

  if (
    [
      "membership_dues",
      "dues",
      "membership",
    ].includes(type)
  ) {
    return "membership";
  }

  if (
    [
      "giving",
      "tithe",
      "donation",
    ].includes(type)
  ) {
    return "donation";
  }

  if (
    [
      "school_program",
      "kids_school",
      "school",
    ].includes(type)
  ) {
    return "school";
  }

  if (
    [
      "trip",
      "travel",
    ].includes(type)
  ) {
    return "trip";
  }

  return type;
}

function normalizeParticipants(
  payload = {}
) {

  const raw =
    payload.participants ||
    payload.participants_json ||
    [];

  if (Array.isArray(raw)) {
    return raw;
  }

  try {

    const parsed =
      JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed
      : [];

  } catch {

    return [];
  }
}

/* =========================================================
   BUILD TITLE
========================================================= */

function buildInvoiceTitle(
  payload = {}
) {

  const type =
    normalizeCategory(payload);

  if (type === "membership") {
    return "Membership Invoice";
  }

  if (type === "donation") {
    return "Donation Invoice";
  }

  if (type === "school") {
    return "School Program Invoice";
  }

  if (type === "trip") {
    return "Trip Registration Invoice";
  }

  return "Payment Invoice";
}

/* =========================================================
   SNAPSHOT
========================================================= */

function buildInvoiceSnapshot(
  payload = {}
) {

  const type =
    normalizeCategory(payload);

  const participants =
    normalizeParticipants(payload);

  const coverage =
    buildCoveragePayload({

      coverage_year:
        payload.coverage_year,

      coverage_start_month:
        payload.coverage_start_month,

      months_paid:
        payload.months_paid,

      coverage_months_json:
        payload.coverage_months_json,
    });

  return {

    invoice_type:
      type,

    category:
      type,

    sub_category:
      payload.sub_category ||
      null,

    /* =====================================================
       MEMBERSHIP
    ===================================================== */

    plan_name:
      payload.plan_name ||
      null,

    months_paid:
      payload.months_paid ||
      null,

    coverage_year:
      coverage.coverage_year,

    coverage_start_month:
      coverage.coverage_start_month,

    coverage_label:
      coverage.coverage_label,

    coverage_months:
      coverage.coverage_months,

    coverage_months_json:
      coverage.coverage_months_json,

    /* =====================================================
       DONATION
    ===================================================== */

    donation_category:
      payload.donation_category ||
      null,

    donation_category_label:
      payload.donation_category
        ? donationCategoryLabel(
            payload.donation_category
          )
        : null,

    /* =====================================================
       PROGRAMS
    ===================================================== */

    program_name:
      payload.program_name ||
      null,

    quantity:
      payload.quantity ||
      null,

    participants_json:
      safeJson(
        participants,
        "[]"
      ),

    registration_id:
      payload.registration_id ||
      null,
  };
}

/* =========================================================
   BUILD ITEMS
========================================================= */

function buildInvoiceItems(
  payload = {},
  snapshot = {}
) {

  const type =
    normalizeCategory(payload);

  if (type === "membership") {

    return buildMembershipInvoiceItems({

      ...payload,

      coverage_months:
        snapshot.coverage_months || [],
    });
  }

  if (type === "donation") {

    return buildDonationInvoiceItems(
      payload
    );
  }

  if (
    type === "school" ||
    type === "trip"
  ) {

    return buildProgramInvoiceItems({

      ...payload,

      category:
        type,
    });
  }

  return [
    {
      item_type:
        type,

      item_name:
        buildInvoiceTitle(payload),

      description:
        payload.notes ||
        "Payment",

      quantity: 1,

      unit_price:
        money(payload.amount),
    },
  ];
}

/* =========================================================
   GENERATE INVOICE
========================================================= */

async function generateInvoice(
  conn,
  payload = {}
) {

  const invoiceNumber =
    payload.invoice_number ||
    generateInvoiceNumber();

  const type =
    normalizeCategory(payload);

  const snapshot =
    buildInvoiceSnapshot(
      payload
    );

  const totalAmount =
    money(payload.amount);

  const invoiceId =
    await insertExistingColumns(

      conn,

      "tbl_finance_invoices",

      {

        member_id:
          payload.member_id ||
          null,

        member_no:
          payload.member_no ||
          null,

        invoice_number:
          invoiceNumber,

        title:
          buildInvoiceTitle(
            payload
          ),

        category:
          type,

        sub_category:
          payload.sub_category ||
          null,

        full_name_snapshot:
          clean(
            payload.full_name ||
            "Member"
          ),

        email_snapshot:
          clean(
            payload.email ||
            ""
          ),

        phone_snapshot:
          clean(
            payload.phone ||
            ""
          ),

        subtotal:
          totalAmount,

        tax_amount:
          0,

        discount_amount:
          0,

        total_amount:
          totalAmount,

        paid_amount:
          payload.paid_amount ||
          totalAmount,

        balance_due:
          payload.balance_due ||
          0,

        currency:
          payload.currency ||
          "USD",

        status:
          payload.status ||
          "paid",

        /* =================================================
           MEMBERSHIP
        ================================================= */

        plan_name:
          snapshot.plan_name,

        months_paid:
          snapshot.months_paid,

        coverage_year:
          snapshot.coverage_year,

        coverage_start_month:
          snapshot.coverage_start_month,

        coverage_label:
          snapshot.coverage_label,

        coverage_months_json:
          snapshot.coverage_months_json,

        /* =================================================
           DONATION
        ================================================= */

        donation_category:
          snapshot.donation_category,

        donation_category_label:
          snapshot.donation_category_label,

        /* =================================================
           PROGRAMS
        ================================================= */

        program_name:
          snapshot.program_name,

        quantity:
          snapshot.quantity,

        participants_json:
          snapshot.participants_json,

        registration_id:
          snapshot.registration_id,

        /* =================================================
           SNAPSHOT
        ================================================= */

        invoice_snapshot_json:
          safeJson(
            snapshot,
            null
          ),

        invoice_date:
          payload.invoice_date ||
          mysqlNow(),

        due_date:
          payload.due_date ||
          mysqlNow(),

        paid_at:
          payload.paid_at ||
          mysqlNow(),

        created_by:
          payload.created_by ||
          null,

        created_at:
          mysqlNow(),

        updated_at:
          mysqlNow(),
      }
    );

  /* =======================================================
     CREATE INVOICE ITEMS
  ======================================================= */

  const items =
    buildInvoiceItems(
      payload,
      snapshot
    );

  await createInvoiceItems(
    conn,
    invoiceId,
    items
  );

  return {

    id:
      invoiceId,

    invoice_number:
      invoiceNumber,
  };
}

/* =========================================================
   GET INVOICE
========================================================= */

async function getInvoice(
  conn,
  invoiceId
) {

  return findOne(

    conn,

    `
    SELECT *

    FROM tbl_finance_invoices

    WHERE id = ?

    LIMIT 1
    `,

    [invoiceId]
  );
}

/* =========================================================
   GET BY NUMBER
========================================================= */

async function getInvoiceByNumber(
  conn,
  invoiceNumber
) {

  return findOne(

    conn,

    `
    SELECT *

    FROM tbl_finance_invoices

    WHERE invoice_number = ?

    LIMIT 1
    `,

    [invoiceNumber]
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  buildInvoiceTitle,

  buildInvoiceSnapshot,

  buildInvoiceItems,

  generateInvoice,

  getInvoice,

  getInvoiceByNumber,
};