

// backend/services/paymentService.js
"use strict";

const Stripe = require("stripe");
const crypto = require("crypto");
const pool = require("../db");

const {
  insertExistingColumns,
  updateExistingColumns,
  findOne,
  findMany,
} = require("../utils/dbHelpers");

const {
  clean,
  money,
  mysqlNow,
  normalizePaymentType,
  normalizePaymentMethod,
  normalizeProvider,
  normalizeStatus,
  normalizeDonationCategory,
} = require("../utils/financeHelpers");
const {
  generatePaymentNumber,
  generateMemberNumber,
} = require("../utils/numberGenerator");
const {
  paymentExists,
} = require("../utils/paymentGuards");

const {
  generateInvoice,
} = require("./domains/invoices/invoiceGenerationService");

const {
  generateReceipt,
} = require("./domains/receipts/receiptGenerationService");

const {
  sendReceiptEmail,
} = require("./domains/receipts/receiptEmailService");

const {
  buildCoveragePayload,
} = require("./shared/coverageHelpers");

const {
  donationCategoryLabel,
  paymentCategoryLabel,
} = require("./shared/paymentHelpers");

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

/* =========================================================
   OPTIONAL DOMAIN SERVICES
========================================================= */

function optionalRequire(path, fallback = {}) {
  try {
    return require(path);
  } catch {
    return fallback;
  }
}

const {
  getMemberSnapshot = async () => null,
  postPaymentEntry = async () => null,
} = optionalRequire("./domains/ledger/ledgerService");

const {
  applyMembershipPayment = async () => null,
} = optionalRequire("./domains/membership/subscriptionService");

const {
  createDonationDetail = async () => null,
} = optionalRequire("./domains/donations/donationService");

const {
  markRegistrationPaid = async () => null,
} = optionalRequire("./domains/programs/programRegistrationService");

/* =========================================================
   HELPERS
========================================================= */

function fallbackNumber(prefix) {
  return `${prefix}-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

function number(prefix) {
  try {
    return generatePaymentNumber(prefix);
  } catch {
    return fallbackNumber(prefix);
  }
}

function asMoney(value) {
  return money(Number(value || 0));
}

function normalizeType(value) {
  const raw = normalizePaymentType(value || "other");

  if (["membership_dues", "dues", "registration_fee"].includes(raw)) {
    return "membership";
  }

  if (["giving", "tithe"].includes(raw)) {
    return "donation";
  }

  if (["kids", "kids_school", "school_program"].includes(raw)) {
    return "school";
  }

  if (["travel"].includes(raw)) {
    return "trip";
  }

  return raw;
}

function normalizeMethod(value) {
  return normalizePaymentMethod(value || "manual");
}

function normalizePayProvider(value, method) {
  return normalizeProvider(value || method || "manual");
}

function safeJson(value, fallback = null) {
  try {
    if (!value) return fallback;
    if (typeof value === "string") {
      JSON.parse(value);
      return value;
    }
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function parseJson(value, fallback = []) {
  try {
    if (!value) return fallback;
    if (Array.isArray(value)) return value;
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function monthName(month) {
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
  ][Number(month)] || String(month);
}

function getMemberIdFromUser(reqUser = {}) {
  return Number(reqUser.member_id || reqUser.memberId || 0) || null;
}

function extractPlanMonths(payload = {}, plan = null) {
  const explicit =
    Number(payload.months_paid) ||
    Number(payload.duration_months) ||
    Number(payload.interval_count) ||
    Number(plan?.duration_months);

  if (explicit && Number.isFinite(explicit) && explicit > 0) {
    return Math.trunc(explicit);
  }

  const text = String(
    payload.plan_name ||
      payload.plan_type ||
      payload.selected_option ||
      payload.sub_category ||
      plan?.plan_name ||
      ""
  ).toLowerCase();

  if (text.includes("12")) return 12;
  if (text.includes("6")) return 6;
  if (text.includes("3")) return 3;

  return 1;
}

async function loadPlan(conn, planId) {
  if (!planId) return null;

  const [[row]] = await conn.query(
    `
    SELECT *
    FROM tbl_finance_dues_plans
    WHERE id = ?
    LIMIT 1
    `,
    [planId]
  );

  return row || null;
}

async function resolveMember(conn, payload = {}) {
  if (payload.member_id) {
    const member = await getMemberSnapshot(conn, payload.member_id).catch(
      () => null
    );

    if (member?.id) return member;

    const [[row]] = await conn.query(
      `
      SELECT
        id,
        member_no,
        full_name,
        email,
        phone
      FROM tbl_members
      WHERE id = ?
      LIMIT 1
      `,
      [payload.member_id]
    );

    if (row?.id) return row;
  }

  if (payload.user_id) {
    const [[row]] = await conn.query(
      `
      SELECT
        m.id,
        m.member_no,
        m.full_name,
        m.email,
        m.phone
      FROM tbl_users u
      INNER JOIN tbl_members m
        ON m.id = u.member_id
      WHERE u.id = ?
      LIMIT 1
      `,
      [payload.user_id]
    );

    if (row?.id) return row;
  }

  const email = clean(
    payload.email ||
      payload.email_snapshot ||
      payload.guest?.email ||
      "",
    190
  );

  if (!email) return {};

  const [[row]] = await conn.query(
    `
    SELECT
      m.id,
      m.member_no,
      m.full_name,
      m.email,
      m.phone
    FROM tbl_members m
    LEFT JOIN tbl_users u
      ON u.member_id = m.id
    WHERE LOWER(m.email) = LOWER(?)
       OR LOWER(u.email) = LOWER(?)
    ORDER BY m.id DESC
    LIMIT 1
    `,
    [email, email]
  );

  return row || {};
}

/* =========================================================
   STRIPE CARD
========================================================= */

async function retrieveCardSummary(paymentIntentId) {
  if (!stripe || !paymentIntentId) return {};

  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });

    const charge = pi.latest_charge;
    const card = charge?.payment_method_details?.card;

    return {
      stripe_charge_id:
        typeof charge === "string" ? charge : charge?.id || null,
      card_brand: card?.brand || null,
      card_last4: card?.last4 || null,
      card_exp_month: card?.exp_month || null,
      card_exp_year: card?.exp_year || null,
      cardholder_name: charge?.billing_details?.name || null,
    };
  } catch (err) {
    console.warn("retrieveCardSummary failed:", err.message);
    return {};
  }
}

/* =========================================================
   CREATE PAYMENT RECORD
========================================================= */

async function createPaymentRecord(conn, payload) {
  const paymentNumber = payload.payment_number || number("PAY");

  const id = await insertExistingColumns(conn, "tbl_finance_payments", {
    payment_number: paymentNumber,

    member_id: payload.member_id || null,
    member_no: payload.member_no || null,
    invoice_id: payload.invoice_id || null,

    full_name_snapshot: payload.full_name || "Guest / Donor",
    email_snapshot: payload.email || null,
    phone_snapshot: payload.phone || null,

    payer_type: payload.payer_type || (payload.member_id ? "member" : "guest"),

    payment_type: payload.payment_type,
    category: payload.category,
    sub_category: payload.sub_category || null,
    donation_category: payload.donation_category || null,
    donation_category_label: payload.donation_category_label || null,

    related_entity_id: payload.related_entity_id || payload.news_event_id || null,
    related_entity_type: payload.related_entity_type || null,

    registration_id: payload.registration_id || null,
    news_event_id: payload.news_event_id || payload.related_entity_id || null,

    program_name: payload.program_name || payload.program_title || null,
    program_title: payload.program_title || payload.program_name || null,
    program_category: payload.program_category || payload.category || null,
    event_date: payload.event_date || null,

    quantity: payload.quantity || 1,
    price_per_person: payload.price_per_person || null,
    participants_json: safeJson(payload.participants || payload.participants_json, "[]"),

    dues_plan_id: payload.dues_plan_id || payload.plan_id || null,
    plan_id: payload.plan_id || payload.dues_plan_id || null,
    plan_name: payload.plan_name || null,

    method: payload.method,
    provider: payload.provider,

    payment_method: payload.method,
    payment_provider: payload.provider,

    amount: payload.amount,
    currency: payload.currency || "USD",
    description: payload.description || null,
    reference_no: payload.reference_no || null,
    transaction_reference: payload.transaction_reference || null,

    status: payload.status || "paid",
    payment_status: payload.status || "paid",
    reconciliation_status: payload.reconciliation_status || "unreconciled",

    stripe_event_id: payload.stripe_event_id || null,
    stripe_payment_intent_id: payload.stripe_payment_intent_id || null,
    stripe_charge_id: payload.stripe_charge_id || null,
    stripe_checkout_session_id: payload.stripe_checkout_session_id || null,
    stripe_invoice_id: payload.stripe_invoice_id || null,
    stripe_subscription_id: payload.stripe_subscription_id || null,
    stripe_customer_id: payload.stripe_customer_id || null,

    card_brand: payload.card_brand || null,
    card_last4: payload.card_last4 || null,
    card_exp_month: payload.card_exp_month || null,
    card_exp_year: payload.card_exp_year || null,
    cardholder_name: payload.cardholder_name || null,

    months_paid: payload.months_paid || null,
    coverage_year: payload.coverage_year || null,
    coverage_start_month: payload.coverage_start_month || null,
    coverage_end_month: payload.coverage_end_month || null,
    coverage_months: payload.coverage_months || null,
    coverage_months_json: payload.coverage_months_json || null,
    coverage_label: payload.coverage_label || null,
    coverage_start: payload.coverage_start_date || null,
    coverage_end: payload.coverage_end_date || null,

    remaining_credit: payload.remaining_credit || 0,

    notes: payload.notes || null,

    paid_at: payload.paid_at || mysqlNow(),
    created_by: payload.created_by || null,
    created_at: mysqlNow(),
    updated_at: mysqlNow(),
  });

  return {
    id,
    payment_number: paymentNumber,
  };
}

/* =========================================================
   MEMBERSHIP COVERAGE
========================================================= */

async function createMembershipCoverage(conn, payload) {
if (payload.payment_type !== "membership") return;
if (!payload.member_id) return;

const rows = parseJson(
payload.coverage_months_json,
[]
);

if (!rows.length) return;

const perMonthAmount =
Number(payload.amount || 0) /
Math.max(rows.length, 1);

for (const row of rows) {
const coverageYear =
Number(
row.year ||
payload.coverage_year
);


const monthNumber =
  Number(
    row.month_number ||
    row.monthNumber
  );

const monthName =
  row.month ||
  row.month_name ||
  monthNumber;

/* =====================================
   MEMBERSHIP COVERAGE
===================================== */

await insertExistingColumns(
  conn,
  "tbl_member_membership_coverage",
  {
    member_id:
      payload.member_id,

    payment_id:
      payload.payment_id,

    invoice_id:
      payload.invoice_id || null,

    receipt_id:
      payload.receipt_id || null,

    coverage_year:
      coverageYear,

    coverage_month:
      monthName,

    coverage_month_name:
      monthName,

    month_number:
      monthNumber,

    month_name:
      monthName,

    plan_name:
      payload.plan_name || null,

    status:
      "paid",

    amount:
      money(perMonthAmount),

    payment_number:
      payload.payment_number || null,

    invoice_number:
      payload.invoice_number || null,

    receipt_number:
      payload.receipt_number || null,

    method:
      payload.method || null,

    provider:
      payload.provider || null,

    created_by:
      payload.created_by || null,

    created_at:
      mysqlNow(),

    updated_at:
      mysqlNow(),
  }
).catch(async () => {

  await conn.query(
    `
    UPDATE tbl_member_membership_coverage
    SET
      payment_id = ?,
      invoice_id = ?,
      receipt_id = ?,
      status = 'paid',
      amount = ?,
      payment_number = ?,
      invoice_number = ?,
      receipt_number = ?,
      updated_at = NOW()
    WHERE member_id = ?
      AND coverage_year = ?
      AND month_number = ?
    `,
    [
      payload.payment_id,
      payload.invoice_id || null,
      payload.receipt_id || null,
      money(perMonthAmount),
      payload.payment_number || null,
      payload.invoice_number || null,
      payload.receipt_number || null,
      payload.member_id,
      coverageYear,
      monthNumber,
    ]
  ).catch(() => {});
});

/* =====================================
   PAYMENT MONTHS TABLE
===================================== */

await insertExistingColumns(
  conn,
  "tbl_membership_payment_months",
  {
    payment_id:
      payload.payment_id,

    member_id:
      payload.member_id,

    year:
      coverageYear,

    month:
      monthNumber,

    month_name:
      monthName,

    amount:
      money(perMonthAmount),

    status:
      "paid",

    created_at:
      mysqlNow(),

    updated_at:
      mysqlNow(),
  }
).catch(() => {});


}
}


/* =========================================================
   PLEDGE
========================================================= */

async function createPledgeIfNeeded(conn, payload) {
  if (payload.payment_type !== "pledge") return null;
  if (!payload.pledge) return null;

  const pledge = payload.pledge;
  const pledgeNumber = pledge.pledge_number || number("PLG");

  const id = await insertExistingColumns(conn, "tbl_finance_pledges", {
    pledge_number: pledgeNumber,

    payment_id: payload.payment_id || null,
    receipt_id: payload.receipt_id || null,
    invoice_id: payload.invoice_id || null,

    campaign_id: pledge.campaign_id || null,
    member_id: payload.member_id || null,

    full_name_snapshot: payload.full_name,
    email_snapshot: payload.email,
    phone_snapshot: payload.phone,

    pledge_type: pledge.pledge_type || "promise_to_pay",
    pledged_amount: money(pledge.pledged_amount || 0),
    upfront_amount: money(pledge.upfront_amount || 0),
    paid_amount: money(pledge.upfront_amount || 0),
    remaining_balance: money(pledge.remaining_balance || 0),

    status:
      pledge.status ||
      (Number(pledge.remaining_balance || 0) > 0 ? "active" : "completed"),

    due_date: pledge.due_date || null,
    reminder_date: pledge.reminder_date || null,
    frequency: pledge.frequency || "one_time",

    notes: payload.notes || null,

    created_by: payload.created_by || null,
    created_at: mysqlNow(),
    updated_at: mysqlNow(),
  });

  return {
    id,
    pledge_number: pledgeNumber,
  };
}

/* =========================================================
   DESCRIPTION
========================================================= */

function buildDescription(payload) {
  const type = payload.payment_type;

  if (type === "membership") {
    return `Membership payment - ${
      payload.plan_name || payload.sub_category || "Membership Plan"
    }${payload.coverage_label ? ` (${payload.coverage_label})` : ""}`;
  }

  if (type === "donation") {
    return `Donation - ${
      payload.donation_category_label ||
      payload.donation_category ||
      payload.sub_category ||
      "General Donation"
    }`;
  }

  if (type === "school") {
    return `Kids School Program - ${
      payload.program_name || payload.program_title || payload.sub_category || "Program"
    }`;
  }

  if (type === "trip") {
    return `Trip Payment - ${
      payload.program_name || payload.program_title || payload.sub_category || "Trip"
    }`;
  }

  if (type === "pledge") {
    return `Pledge - ${
      payload.pledge?.campaign_name || payload.sub_category || "Campaign"
    }`;
  }

  return payload.description || "Payment";
}



/* =========================================================
   NORMALIZE PAYMENT PAYLOAD
========================================================= */

async function normalizePaymentPayload(conn, rawPayload = {}) {

  const paymentType =
    normalizeType(

      rawPayload.payment_type ||

      rawPayload.category ||

      rawPayload.type
    );

  const amount =
    asMoney(

      rawPayload.total_amount ||

      rawPayload.amount ||

      rawPayload.subtotal_amount
    );

  if (
    paymentType !== "pledge" &&
    amount <= 0
  ) {
    throw new Error(
      "Invalid payment amount."
    );
  }

  const method =
    normalizeMethod(

      rawPayload.method ||

      rawPayload.payment_method ||

      "manual"
    );
const provider =

  method === "card" ||
  method === "stripe_card"

    ? "stripe"

    : normalizePayProvider(
        rawPayload.provider ||
        rawPayload.payment_provider ||
        method,
        method
      );

  const member =
    await resolveMember(
      conn,
      rawPayload
    );

  const memberId =

    member?.id ||

    Number(
      rawPayload.member_id || 0
    ) ||

    null;

  const isNewRegistration =

    String(
      rawPayload.create_member_after_payment || ""
    ).toLowerCase() === "true" ||

    String(
      rawPayload.source || ""
    ).toLowerCase() === "finance_registration" ||

    String(
      rawPayload.created_from || ""
    ).toLowerCase() === "finance_registration";

  const guest =
    rawPayload.guest || {};

  const fullName =

    member?.full_name ||

    rawPayload.full_name ||

    rawPayload.member_name ||

    rawPayload.full_name_snapshot ||

    guest.full_name ||

    rawPayload.cardholder_name ||

    `${rawPayload.first_name || ""} ${rawPayload.last_name || ""}`.trim() ||

    "Guest / Donor";

  /* =====================================================
   EMAIL RESOLUTION
===================================================== */

let email = null;

/* =========================================
   DONATION / GUEST PAYMENTS
========================================= */

if (
  [
    "donation",
    "school",
    "trip",
  ].includes(paymentType)
) {

  email =

    rawPayload.email ||

    rawPayload.email_snapshot ||

    guest.email ||

    null;
}

/* =========================================
   MEMBERSHIP PAYMENTS
========================================= */

else {

  email =

    member?.email ||

    rawPayload.email ||

    rawPayload.email_snapshot ||

    guest.email ||

    null;
}

  /* =====================================================
   PHONE RESOLUTION
===================================================== */

let phone = null;

if (
  [
    "donation",
    "school",
    "trip",
  ].includes(paymentType)
) {

  phone =

    rawPayload.phone ||

    rawPayload.phone_snapshot ||

    guest.phone ||

    null;
}

else {

  phone =

    member?.phone ||

    rawPayload.phone ||

    rawPayload.phone_snapshot ||

    guest.phone ||

    null;
}

  let resolvedMemberId =
    memberId;

  let resolvedMemberNo =

    member?.member_no ||

    rawPayload.member_no ||

    null;

  let createdNewMember =
    false;

  let generatedUsername =
    null;

  let generatedTempPassword =
    null;

  let generatedUserId =
    null;

  /* =====================================================
     AUTO CREATE MEMBER
  ===================================================== */

  if (

    paymentType === "membership" &&

    !resolvedMemberId &&

    isNewRegistration
  ) 
  
  
  
  {

   const generatedMemberNo =
  await generateMemberNumber(conn);
    const firstName =

      rawPayload.first_name ||

      fullName.split(" ")[0] ||

      "Member";

    const lastName =

      rawPayload.last_name ||

      fullName
        .split(" ")
        .slice(1)
        .join(" ") ||

      "Account";

    const [insertResult] =
      await conn.query(
        `
        INSERT INTO tbl_members
        (
          member_no,
          first_name,
          last_name,
          full_name,
          email,
          phone,
          membership_status,
          status,
          is_active,
          created_at,
          updated_at
        )
        VALUES
        (
          ?, ?, ?, ?, ?, ?,
          'active',
          'active',
          1,
          NOW(),
          NOW()
        )
        `,
        [
          generatedMemberNo,
          firstName,
          lastName,
          fullName,
          email,
          phone,
        ]
      );

    resolvedMemberId =
      insertResult.insertId;

    resolvedMemberNo =
      generatedMemberNo;

    createdNewMember =
      true;

    console.log(
      "✅ Auto-created member:",
      resolvedMemberId
    );

    /* =================================================
   CREATE LOGIN ACCOUNT
================================================= */

const argon2 =
  require("argon2");

/* =========================================
   TEMP PASSWORD
========================================= */

generatedTempPassword =
  Math.random()
    .toString(36)
    .slice(-8);

/* =========================================
   HASH PASSWORD
========================================= */

const passwordHash =
  await argon2.hash(
    generatedTempPassword,
    {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    }
  );
/* =========================================
   USERNAME
========================================= */

generatedUsername =
  String(
    email ||
    generatedMemberNo
  )
    .trim()
    .toLowerCase();

/* =========================================
   CREATE USER
========================================= */

const [userInsert] =
  await conn.query(
    `
    INSERT INTO tbl_users
    (
      member_id,
      username,
      first_name,
      last_name,
      full_name,
      email,
      phone,
      password_hash,
      role,
      is_active,
      must_change_password,
      created_at,
      updated_at
    )
    VALUES
    (
      ?, ?, ?, ?, ?, ?, ?, ?,
      'member',
      1,
      1,
      NOW(),
      NOW()
    )
    `,
    [
      resolvedMemberId,
      generatedUsername,
      firstName,
      lastName,
      fullName,
      email,
      phone,
      passwordHash,
    ]
  );

generatedUserId =
  userInsert.insertId;

console.log(
  "✅ Login account created:",
  {
    username:
      generatedUsername,

    member_no:
      generatedMemberNo,

    temp_password:
      generatedTempPassword,
  }
);

  }

  /* =====================================================
     VALIDATE MEMBERSHIP
  ===================================================== */

  if (

    paymentType === "membership" &&

    !resolvedMemberId &&

    !isNewRegistration
  ) {

    throw new Error(
      "Membership payment requires a member."
    );
  }

  const plan =
    await loadPlan(
      conn,

      rawPayload.dues_plan_id ||

      rawPayload.plan_id
    );

  let coverage =
    null;

  if (
    paymentType === "membership"
  ) {

    const monthsPaid =
      extractPlanMonths(
        rawPayload,
        plan
      );

    coverage =
      buildCoveragePayload({

        coverage_year:
          rawPayload.coverage_year,

        coverage_start_month:

          rawPayload.coverage_start_month ||

          rawPayload.start_month,

        months_paid:
          monthsPaid,

        coverage_months_json:

          rawPayload.coverage_months_json ||

          rawPayload.coverage_months,
      });
      /* =========================================
   MEMBERSHIP END MONTH
========================================= */

if (
  coverage?.coverage_months_json
) {

  try {

    const rows =
      JSON.parse(
        coverage.coverage_months_json
      );

    if (
      Array.isArray(rows) &&
      rows.length
    ) {

      const last =
        rows[
          rows.length - 1
        ];

      coverage.coverage_end_month =
        `${last.year}-${String(
          last.month_number
        ).padStart(2, "0")}`;
    }

  } catch (err) {

    console.error(
      "coverage_end_month failed:",
      err.message
    );
  }
}
  }

  const donationCategory =

    paymentType === "donation"

      ? normalizeDonationCategory(

          rawPayload.donation_category ||

          rawPayload.sub_category ||

          "general_donation"
        )

      : null;

  const participants =

    rawPayload.participants ||

    parseJson(
      rawPayload.participants_json,
      []
    );

  /* =====================================================
     NORMALIZED PAYLOAD
  ===================================================== */

  const normalized = {

    ...rawPayload,

    member_id:
      resolvedMemberId,

    member_no:
      resolvedMemberNo,

    created_new_member:
      createdNewMember,

    generated_username:
      generatedUsername,

    generated_temp_password:
      generatedTempPassword,

    generated_user_id:
      generatedUserId,

    send_welcome_email:

      createdNewMember &&

      String(
        rawPayload.send_welcome_email || "true"
      ).toLowerCase() === "true",

    send_receipt_email:

      String(
        rawPayload.send_receipt_email || "true"
      ).toLowerCase() === "true",

    full_name:
      fullName,

    email,
    phone,

    payment_type:
      paymentType,

    category:
      paymentType,

    sub_category:

      rawPayload.sub_category ||

      donationCategory ||

      rawPayload.program_name ||

      rawPayload.program_title ||

      rawPayload.plan_name ||

      null,

    donation_category:
      donationCategory,

    donation_category_label:

      donationCategory

        ? donationCategoryLabel(
            donationCategory
          )

        : null,

    method,
    provider,

    status:
      normalizeStatus(

        rawPayload.status ||

        rawPayload.payment_status ||

        "paid"
      ),

    amount,

    total_amount:
      amount,

    membership_amount:
      asMoney(

        rawPayload.membership_amount ||

        rawPayload.amount_paid ||

        rawPayload.base_amount ||

        0
      ),

    registration_fee:
      asMoney(
        rawPayload.registration_fee || 0
      ),

    processing_fee:
      asMoney(
        rawPayload.processing_fee || 0
      ),

    subtotal_amount:
      asMoney(
        rawPayload.subtotal_amount || 0
      ),

    currency:
      rawPayload.currency || "USD",

    plan_id:

      rawPayload.plan_id ||

      rawPayload.dues_plan_id ||

      null,

    dues_plan_id:

      rawPayload.dues_plan_id ||

      rawPayload.plan_id ||

      null,

    plan_name:

      rawPayload.plan_name ||

      plan?.plan_name ||

      null,

    quantity:
      Number(
        rawPayload.quantity || 1
      ),

    price_per_person:
      rawPayload.price_per_person ||
      null,

    program_name:

      rawPayload.program_name ||

      rawPayload.program_title ||

      rawPayload.sub_category ||

      null,

    program_title:

      rawPayload.program_title ||

      rawPayload.program_name ||

      rawPayload.sub_category ||

      null,

    participants,

    registration_id:
      rawPayload.registration_id ||
      null,

    news_event_id:

      rawPayload.news_event_id ||

      rawPayload.related_entity_id ||

      null,

    related_entity_id:

      rawPayload.related_entity_id ||

      rawPayload.news_event_id ||

      null,

    related_entity_type:

      rawPayload.related_entity_type ||

      null,

    coverage_year:
      coverage?.coverage_year ||
      null,

    coverage_start_month:
      coverage?.coverage_start_month ||
      null,
coverage_end_month:
  coverage?.coverage_end_month ||
  null,
    coverage_months_json:
      coverage?.coverage_months_json ||
      null,

    coverage_label:
      coverage?.coverage_label ||
      null,

    months_paid:

      coverage?.months_paid ||

      rawPayload.months_paid ||

      null,

    created_by:

      rawPayload.created_by ||

      rawPayload.actor_id ||

      null,
  };

  normalized.description =

    rawPayload.description ||

    buildDescription(
      normalized
    );

  return normalized;
}


async function processSuccessfulPayment(conn, rawPayload = {}) {

  if (rawPayload.stripe_event_id) {

    const exists =
      await paymentExists(conn, {

        stripe_event_id:
          rawPayload.stripe_event_id,

        stripe_checkout_session_id:
          rawPayload.stripe_checkout_session_id,

        stripe_payment_intent_id:
          rawPayload.stripe_payment_intent_id,
      });

    if (exists) {

      return {
        duplicate: true,
        payment: exists,
        should_send_receipt_email: false,
      };
    }
  }

  const normalizedPayload =
    await normalizePaymentPayload(
      conn,
      rawPayload
    );

  /* =====================================================
     INVOICE
  ===================================================== */

  const invoice =
    await generateInvoice(conn, {

      ...normalizedPayload,

      paid_amount:
        normalizedPayload.status === "paid"
          ? normalizedPayload.amount
          : 0,

      balance_due:
        normalizedPayload.status === "paid"
          ? 0
          : normalizedPayload.amount,

      status:
        normalizedPayload.status === "paid"
          ? "paid"
          : "pending",
    });

  /* =====================================================
     PAYMENT
  ===================================================== */

  const payment =
    await createPaymentRecord(conn, {

      ...normalizedPayload,

      invoice_id:
        invoice.id,
    });

  await updateExistingColumns(
    conn,
    "tbl_finance_invoices",
    {
      payment_id: payment.id,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [invoice.id]
  ).catch(() => {});

  /* =====================================================
     RECEIPT
  ===================================================== */

  const receipt =
    await generateReceipt(conn, {

      ...normalizedPayload,

      payment_id:
        payment.id,

      invoice_id:
        invoice.id,

      payment_number:
        payment.payment_number,

      coverage_label:
        normalizedPayload.coverage_label,

      coverage_months_json:
        normalizedPayload.coverage_months_json,
    });

  /* =====================================================
     LEDGER
  ===================================================== */

  await postPaymentEntry(conn, {

    member_id:
      normalizedPayload.member_id,

    member_no:
      normalizedPayload.member_no,

    full_name_snapshot:
      normalizedPayload.full_name,

    phone_snapshot:
      normalizedPayload.phone,

    payment_id:
      payment.id,

    invoice_id:
      invoice.id,

    receipt_id:
      receipt.id,

    payment_number:
      payment.payment_number,

    invoice_number:
      invoice.invoice_number,

    receipt_number:
      receipt.receipt_number,

    record_type:
      "payment",

    ledger_type:
      "payment",

    entry_type:
      "payment",

    related_document_type:
      "payment",

    related_document_id:
      payment.id,

    related_document_number:
      payment.payment_number,

    source_type:
      normalizedPayload.payment_type,

    debit_amount: 0,

    credit_amount:
      normalizedPayload.amount,

    amount:
      normalizedPayload.amount,

    payment_status:
      "paid",

    ledger_status:
      "posted",

    status:
      "posted",

    plan_type:
      normalizedPayload.plan_name,

    months_paid:
      normalizedPayload.months_paid,

    description:
      normalizedPayload.description,

    source_reference:

      normalizedPayload.stripe_checkout_session_id ||

      normalizedPayload.stripe_payment_intent_id ||

      normalizedPayload.reference_no ||

      null,

    audit_source:
      "payment_service",

  }).catch((err) => {

    console.error(
      "postPaymentEntry failed:",
      err.message
    );
  });


 /* =====================================================
   MEMBERSHIP SUBSCRIPTION
==================================================== */

if (
  normalizedPayload.payment_type ===
  "membership"
) {

  await applyMembershipPayment(conn, {

    ...normalizedPayload,

    member_id:
      normalizedPayload.member_id,

    member_no:
      normalizedPayload.member_no,

    payment_id:
      payment.id,

    payment_number:
      payment.payment_number,

    invoice_id:
      invoice.id,

    invoice_number:
      invoice.invoice_number,

    receipt_id:
      receipt.id,

    receipt_number:
      receipt.receipt_number,

    dues_plan_id:
      normalizedPayload.dues_plan_id,

    plan_name:
      normalizedPayload.plan_name,

    amount:
      normalizedPayload.amount,

    months:
      Number(
        normalizedPayload.months_paid || 1
      ),

    duration_months:
      Number(
        normalizedPayload.months_paid || 1
      ),

    method:
      normalizedPayload.method,

    provider:
      normalizedPayload.provider,

    auto_renew:
      normalizedPayload.auto_renew,

    auto_payment_enabled:
      normalizedPayload.auto_payment_enabled,

    stripe_customer_id:
      normalizedPayload.stripe_customer_id || null,

    stripe_subscription_id:
      normalizedPayload.stripe_subscription_id || null,

    created_by:
      normalizedPayload.created_by || null,
  });

}

  /* =====================================================
     DONATION
  ===================================================== */

  if (
    normalizedPayload.payment_type ===
    "donation"
  ) {

    await createDonationDetail(conn, {

      ...normalizedPayload,

      payment_id:
        payment.id,

      receipt_id:
        receipt.id,

      amount:
        normalizedPayload.amount,

    }).catch((err) => {

      console.error(
        "createDonationDetail failed:",
        err.message
      );
    });
  }

  /* =====================================================
     PROGRAMS
  ===================================================== */

  if (
    ["school", "trip"].includes(
      normalizedPayload.payment_type
    )
  ) {

    await markRegistrationPaid(conn, {

      registration_id:
        normalizedPayload.registration_id,

      related_entity_id:
        normalizedPayload.related_entity_id,

      payment_id:
        payment.id,

      invoice_id:
        invoice.id,

      receipt_id:
        receipt.id,

      amount:
        normalizedPayload.amount,

    }).catch((err) => {

      console.error(
        "markRegistrationPaid failed:",
        err.message
      );
    });
  }

  /* =====================================================
     PLEDGE
  ===================================================== */

  if (
    normalizedPayload.payment_type ===
    "pledge"
  ) {

    await createPledgeIfNeeded(conn, {

      ...normalizedPayload,

      payment_id:
        payment.id,

      invoice_id:
        invoice.id,

      receipt_id:
        receipt.id,

      receipt_number:
        receipt.receipt_number,
    });
  }

/* =====================================================
   FINAL RETURN
===================================================== */

return {

  /* =====================================
     PAYMENT
  ===================================== */

  payment: {

    ...payment,

    created_new_member:
      normalizedPayload.created_new_member,

    generated_username:
      normalizedPayload.generated_username || null,

    generated_temp_password:
      normalizedPayload.generated_temp_password || null,

    plan_name:
      normalizedPayload.plan_name || null,

    coverage_label:
      normalizedPayload.coverage_label || null,

    coverage_months_json:
      normalizedPayload.coverage_months_json || null,

    payment_type:
      normalizedPayload.payment_type || null,

    method:
      normalizedPayload.method || null,

    amount:
      normalizedPayload.amount || 0,
  },

  /* =====================================
     INVOICE
  ===================================== */

  invoice,

  /* =====================================
     RECEIPT
  ===================================== */

  receipt,

  /* =====================================
     EMAIL FLAGS
  ===================================== */

  should_send_receipt_email:

    normalizedPayload.send_receipt_email !== false &&

    normalizedPayload.email &&

    receipt?.id,

  receipt_email:
    normalizedPayload.email || null,

  /* =====================================
     MEMBER
  ===================================== */

  member: {

    id:
      normalizedPayload.member_id || null,

    member_no:
      normalizedPayload.member_no || null,

    full_name:
      normalizedPayload.full_name || null,

    email:
      normalizedPayload.email || null,

    phone:
      normalizedPayload.phone || null,
  },

  /* =====================================
     USER ACCOUNT
  ===================================== */

  user: {

    id:
      normalizedPayload.generated_user_id || null,

    username:
      normalizedPayload.generated_username || null,
  },

  /* =====================================
     GENERATED LOGIN
  ===================================== */

  generated_username:
    normalizedPayload.generated_username || null,

  generated_temp_password:
    normalizedPayload.generated_temp_password || null,

  /* =====================================
     COVERAGE
  ===================================== */

  coverage:
    normalizedPayload.coverage_label || null,
};

}

async function createPayment(payload = {}) {

  const conn =
    await pool.getConnection();

  let result;

  try {

    await conn.beginTransaction();

    result =
      await processSuccessfulPayment(
        conn,
        payload
      );

    await conn.commit();

  } catch (err) {

    await conn.rollback();

    throw err;

  } finally {

    conn.release();
  }

  /* =====================================================
     SEND RECEIPT EMAIL
  ===================================================== */

  if (

    result?.should_send_receipt_email &&

    result?.receipt?.id &&

    result?.receipt_email

  ) {

    await sendReceiptEmail(

      result.receipt.id,

      {
        email:
          result.receipt_email,
      }

    ).catch((err) => {

      console.error(

        "sendReceiptEmail failed:",

        err.message
      );
    });
  }

  /* =====================================================
     SEND WELCOME EMAIL
  ===================================================== */

  if (

    result?.payment?.created_new_member ===
      true &&

    result?.member?.email

  ) {

    const {
      sendMemberWelcomeEmail,
    } = require(
      "./memberWelcomeService"
    );

   await sendMemberWelcomeEmail({

  email:
    result.member.email,

  full_name:
    result.member.full_name,

  member_no:
    result.member.member_no ||
    result.payment.member_no,

  username:
    result.payment.generated_username,

  temporary_password:
    result.payment.generated_temp_password,

  plan_name:
    result.payment.plan_name,

  coverage_label:
    result.payment.coverage_label,

  login_url:
    `${process.env.FRONTEND_URL}/login`,

  reset_link:
    `${process.env.FRONTEND_URL}/reset-password`,
})


    .then(() => {

      console.log(

        "✅ Welcome email sent:",
        result.member.email
      );
    })

    .catch((err) => {

      console.error(

        "sendMemberWelcomeEmail failed:",

        err.message
      );
    });
  }

  return result;
}
/* =========================================================
   LIST PAYMENTS
========================================================= */

async function listPayments(filters = {}) {
  const where = [];
  const params = [];

  if (filters.member_id) {
    where.push("p.member_id = ?");
    params.push(filters.member_id);
  }

  if (filters.category) {
    where.push("(p.category = ? OR p.payment_type = ?)");
    params.push(filters.category, filters.category);
  }

  if (filters.payment_type) {
    where.push("p.payment_type = ?");
    params.push(filters.payment_type);
  }

  if (filters.method) {
    where.push("(p.method = ? OR p.payment_method = ?)");
    params.push(filters.method, filters.method);
  }

  if (filters.provider) {
    where.push("(p.provider = ? OR p.payment_provider = ?)");
    params.push(filters.provider, filters.provider);
  }

  if (filters.status) {
    where.push("(p.status = ? OR p.payment_status = ?)");
    params.push(filters.status, filters.status);
  }

  if (filters.donation_category) {
    where.push("p.donation_category = ?");
    params.push(filters.donation_category);
  }

  if (filters.coverage_year) {
    where.push("p.coverage_year = ?");
    params.push(filters.coverage_year);
  }

  if (filters.date_from) {
    where.push("DATE(p.paid_at) >= ?");
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push("DATE(p.paid_at) <= ?");
    params.push(filters.date_to);
  }

  if (filters.search) {
    where.push(`
      (
        p.payment_number LIKE ?
        OR p.full_name_snapshot LIKE ?
        OR p.email_snapshot LIKE ?
        OR p.phone_snapshot LIKE ?
        OR p.reference_no LIKE ?
      )
    `);

    const s = `%${clean(filters.search)}%`;
    params.push(s, s, s, s, s);
  }

  const limit = Math.min(200, Number(filters.limit || 50) || 50);
  const page = Math.max(1, Number(filters.page || 1) || 1);
  const offset = (page - 1) * limit;

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[countRow]] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM tbl_finance_payments p
    ${whereSql}
    `,
    params
  );

  const [[summary]] = await pool.query(
    `
    SELECT
      COALESCE(SUM(p.amount), 0) AS total_amount,
      COUNT(*) AS total_payments,
      SUM(CASE WHEN p.payment_type = 'membership' OR p.category = 'membership' THEN p.amount ELSE 0 END) AS membership_amount,
      SUM(CASE WHEN p.payment_type = 'donation' OR p.category = 'donation' THEN p.amount ELSE 0 END) AS donation_amount,
      SUM(CASE WHEN p.payment_type IN ('school','trip') OR p.category IN ('school','trip') THEN p.amount ELSE 0 END) AS program_amount
    FROM tbl_finance_payments p
    ${whereSql}
    `,
    params
  );

  const rows = await findMany(
    pool,
    `
    SELECT
      p.*,
      i.invoice_number,
      r.receipt_number
    FROM tbl_finance_payments p
    LEFT JOIN tbl_finance_invoices i
      ON i.id = p.invoice_id
    LEFT JOIN tbl_finance_receipts r
      ON r.payment_id = p.id
    ${whereSql}
    ORDER BY COALESCE(p.paid_at, p.created_at) DESC, p.id DESC
    LIMIT ?
    OFFSET ?
    `,
    [...params, limit, offset]
  );

  return {
    rows,
    pagination: {
      page,
      limit,
      total: Number(countRow.total || 0),
      pages: Math.max(1, Math.ceil(Number(countRow.total || 0) / limit)),
    },
    summary,
  };
}







/* =========================================================
   GET PAYMENT
========================================================= */

async function getPaymentById(id) {
  return findOne(
    pool,
    `
    SELECT
      p.*,
      i.invoice_number,
      r.receipt_number
    FROM tbl_finance_payments p
    LEFT JOIN tbl_finance_invoices i
      ON i.id = p.invoice_id
    LEFT JOIN tbl_finance_receipts r
      ON r.payment_id = p.id
    WHERE p.id = ?
    LIMIT 1
    `,
    [id]
  );
}

/* =========================================================
   REFUND / REVERSE / RECONCILE
========================================================= */

async function refundPayment({ payment_id, amount, reason, refunded_by }) {
  await updateExistingColumns(
    pool,
    "tbl_finance_payments",
    {
      status: "refunded",
      payment_status: "refunded",
      refund_amount: amount || null,
      refund_reason: reason || null,
      refunded_by: refunded_by || null,
      refunded_at: mysqlNow(),
      updated_at: mysqlNow(),
    },
    "id = ?",
    [payment_id]
  );

  return getPaymentById(payment_id);
}

async function reversePayment({ payment_id, reason, reversed_by }) {
  await updateExistingColumns(
    pool,
    "tbl_finance_payments",
    {
      status: "reversed",
      payment_status: "reversed",
      reversal_reason: reason || null,
      reversed_by: reversed_by || null,
      reversed_at: mysqlNow(),
      updated_at: mysqlNow(),
    },
    "id = ?",
    [payment_id]
  );

  return getPaymentById(payment_id);
}

async function reconcilePayment({
  payment_id,
  reconciliation_batch,
  reconciled_by,
}) {
  await updateExistingColumns(
    pool,
    "tbl_finance_payments",
    {
      reconciliation_status: "reconciled",
      reconciliation_batch: reconciliation_batch || null,
      reconciled_by: reconciled_by || null,
      reconciled_at: mysqlNow(),
      updated_at: mysqlNow(),
    },
    "id = ?",
    [payment_id]
  );

  return getPaymentById(payment_id);
}

async function unreconcilePayment({ payment_id, unreconciled_by }) {
  await updateExistingColumns(
    pool,
    "tbl_finance_payments",
    {
      reconciliation_status: "unreconciled",
      unreconciled_by: unreconciled_by || null,
      reconciled_at: null,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [payment_id]
  );

  return getPaymentById(payment_id);
}

/* =========================================================
   STATS
========================================================= */

async function getPaymentStats() {
  return findOne(
    pool,
    `
    SELECT
      COUNT(*) AS total_payments,
      COALESCE(SUM(amount), 0) AS total_amount,

      COALESCE(SUM(CASE WHEN category = 'membership' OR payment_type = 'membership' THEN amount ELSE 0 END), 0) AS membership_amount,
      COALESCE(SUM(CASE WHEN category = 'donation' OR payment_type = 'donation' THEN amount ELSE 0 END), 0) AS donation_amount,
      COALESCE(SUM(CASE WHEN category IN ('school','trip') OR payment_type IN ('school','trip') THEN amount ELSE 0 END), 0) AS program_amount,

      SUM(CASE WHEN provider = 'stripe' OR payment_provider = 'stripe' THEN amount ELSE 0 END) AS stripe_amount,
      SUM(CASE WHEN method = 'cash' OR payment_method = 'cash' THEN amount ELSE 0 END) AS cash_amount,
      SUM(CASE WHEN method = 'zelle' OR payment_method = 'zelle' THEN amount ELSE 0 END) AS zelle_amount,

      SUM(CASE WHEN reconciliation_status = 'reconciled' THEN 1 ELSE 0 END) AS reconciled_count,
      SUM(CASE WHEN reconciliation_status IS NULL OR reconciliation_status != 'reconciled' THEN 1 ELSE 0 END) AS unreconciled_count
    FROM tbl_finance_payments
    `,
    []
  );
}

/* =========================================================
   STRIPE SESSION HELPERS
========================================================= */

function amountFromSession(session) {
  return asMoney(Number(session.amount_total || 0) / 100);
}

function getSessionMetadata(session) {
  const piMetadata =
    typeof session.payment_intent === "object" &&
    session.payment_intent?.metadata
      ? session.payment_intent.metadata
      : {};

  return {
    ...piMetadata,
    ...(session.metadata || {}),
  };
}

function getSessionPaymentIntentId(session) {
  if (!session?.payment_intent) return null;

  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent.id || null;
}

function sessionToPayload(
  session,
  event,
  card = {}
) 


{

  const md =
    getSessionMetadata(session);

  const paymentType =

    md.payment_type ||

    md.payment_kind ||

    md.category ||

    md.type ||

    "other";

 return {

  /* =====================================================
     STRIPE IDS
  ===================================================== */

  stripe_event_id:
    event?.id || null,

  stripe_checkout_session_id:
    session.id,

  stripe_payment_intent_id:
    getSessionPaymentIntentId(
      session
    ),

  stripe_subscription_id:

    typeof session.subscription ===
    "string"

      ? session.subscription

      : session.subscription?.id ||

        md.stripe_subscription_id ||

        null,

  stripe_customer_id:

    typeof session.customer ===
    "string"

      ? session.customer

      : session.customer?.id ||

        null,

  ...card,

  /* =====================================================
     PAYMENT TYPE
  ===================================================== */

  payment_type:
    paymentType,

  category:
    md.category ||
    paymentType,

  sub_category:

    md.sub_category ||

    md.donation_category ||

    md.purpose ||

    md.plan_name ||

    md.program_name ||

    null,

  donation_category:
    md.donation_category || null,

  /* =====================================================
     FINANCE REGISTRATION FLAGS
  ===================================================== */

  source:
    md.source || null,

  created_from:
    md.created_from ||
    md.source ||
    null,

  create_member_after_payment:

    String(
      md.create_member_after_payment ||
      "false"
    ).toLowerCase() ===
    "true",

  created_new_member:

    String(
      md.create_member_after_payment ||
      "false"
    ).toLowerCase() ===
    "true",

  send_welcome_email:

    String(
      md.send_welcome_email ||
      "false"
    ).toLowerCase() ===
    "true",

  send_receipt_email:

    String(
      md.send_receipt_email ||
      "true"
    ).toLowerCase() ===
    "true",

  create_invoice:

    String(
      md.create_invoice ||
      "true"
    ).toLowerCase() ===
    "true",

  create_ledger_entry:

    String(
      md.create_ledger_entry ||
      "true"
    ).toLowerCase() ===
    "true",

  /* =====================================================
     MEMBER
  ===================================================== */

  registration_id:
    Number(
      md.registration_id || 0
    ) || null,

  user_id:
    Number(
      md.user_id || 0
    ) || null,

  member_id:
    Number(
      md.member_id || 0
    ) || null,

  member_no:
    md.member_no || null,

  username:
    md.username ||
    md.generated_username ||
    null,

  generated_username:
    md.generated_username ||
    md.username ||
    null,

  temporary_password:
    md.temporary_password ||
    md.generated_temp_password ||
    null,

  generated_temp_password:
    md.generated_temp_password ||
    md.temporary_password ||
    null,

  first_name:
    md.first_name || null,

  last_name:
    md.last_name || null,

  full_name:

    md.full_name ||

    md.member_name ||

    session.customer_details?.name ||

    card.cardholder_name ||

    "",

  email:

    md.email ||

    session.customer_details?.email ||

    session.customer_email ||

    "",

  phone:

    md.phone ||

    session.customer_details?.phone ||

    "",

  /* =====================================================
     PAYMENT TOTALS
  ===================================================== */

  amount:
    amountFromSession(session),

  total_amount:
    Number(
      md.total_amount ||
      session.amount_total / 100 ||
      0
    ),

  subtotal_amount:
    Number(
      md.subtotal_amount || 0
    ),

  membership_amount:
    Number(
      md.membership_amount ||
      md.amount ||
      0
    ),

  registration_fee:
    Number(
      md.registration_fee || 0
    ),

  processing_fee:
    Number(
      md.processing_fee || 0
    ),

  quantity:
    Number(
      md.quantity || 1
    ) || 1,

  /* =====================================================
     PLAN
  ===================================================== */

  plan_id:

    Number(
      md.plan_id ||
      md.dues_plan_id ||
      0
    ) || null,

  dues_plan_id:

    Number(
      md.dues_plan_id ||
      md.plan_id ||
      0
    ) || null,

  plan_name:
    md.plan_name || null,

  plan_type:
    md.plan_type ||
    md.selected_option ||
    null,

  selected_option:

    md.selected_option ||

    md.plan_type ||

    null,

  duration_months:

    Number(
      md.duration_months ||
      md.months_paid ||
      0
    ) || 0,

  months_paid:

    Number(
      md.months_paid ||
      md.duration_months ||
      0
    ) || 0,

  /* =====================================================
     COVERAGE
  ===================================================== */

  coverage_year:
    Number(
      md.coverage_year || 0
    ) || null,

  coverage_start_month:
    md.coverage_start_month ||
    null,

  coverage_end_month:
    md.coverage_end_month ||
    null,

  coverage_label:
    md.coverage_label || null,

  coverage_months_json:

    md.coverage_months_json ||

    null,

  /* =====================================================
     PROGRAMS
  ===================================================== */

  related_entity_id:

    Number(

      md.related_entity_id ||

      md.news_event_id ||

      md.program_id ||

      0
    ) || null,

  related_entity_type:

    md.related_entity_type ||

    "news_event",

  news_event_id:

    Number(
      md.news_event_id ||
      md.program_id ||
      0
    ) || null,

  program_id:

    Number(
      md.program_id ||
      md.news_event_id ||
      0
    ) || null,

  program_name:
    md.program_name ||
    md.program_title ||
    null,

  program_title:
    md.program_title ||
    md.program_name ||
    null,

  event_date:
    md.event_date || null,

  participants:
    parseJson(
      md.participants_json,
      []
    ),

  /* =====================================================
     NOTES
  ===================================================== */

  note:
    md.note || null,

  /* =====================================================
     PAYMENT STATUS
  ===================================================== */

  method:
    "card",

  provider:
    "stripe",

  status:
    "paid",
};
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  retrieveCardSummary,
  processSuccessfulPayment,
  sessionToPayload,

  createPayment,
  listPayments,
  getPaymentById,
  refundPayment,
  reversePayment,
  reconcilePayment,
  unreconcilePayment,
  getPaymentStats,
};