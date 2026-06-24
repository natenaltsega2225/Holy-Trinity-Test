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
} = require("../utils/numberGenerator");

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
  donationCategoryLabel,
} = require("./shared/paymentHelpers");

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

function optionalRequire(path, fallback = {}) {
  try {
    return require(path);
  } catch {
    return fallback;
  }
}

const {
  postPaymentEntry = async () => null,
} = optionalRequire("./domains/ledger/ledgerService");

const {
  applyMembershipPayment = async () => null,
} = optionalRequire("./domains/membership/subscriptionService");

const {
  createDonationDetail = async () => null,
} = optionalRequire("./domains/donations/donationService");

const programRegistrationService =
  optionalRequire("./domains/programs/programRegistrationService");

const invoiceEmailService =
  optionalRequire("./domains/invoices/invoiceEmailService");

const sendInvoiceEmail =
  typeof invoiceEmailService.sendInvoiceEmail === "function"
    ? invoiceEmailService.sendInvoiceEmail
    : async () => null;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */
function buildLedgerPayload(normalizedPayload = {}, payment = {}, invoice = {}, receipt = {}) {
  const documentType = "payment";
  const paymentId = Number(payment.id || payment.payment_id || 0) || null;
  const invoiceId = Number(invoice.id || invoice.invoice_id || normalizedPayload.invoice_id || 0) || null;
  const receiptId = Number(receipt.id || receipt.receipt_id || normalizedPayload.receipt_id || 0) || null;

  const reference =
    normalizedPayload.stripe_checkout_session_id ||
    normalizedPayload.stripe_payment_intent_id ||
    normalizedPayload.transaction_reference ||
    normalizedPayload.reference_no ||
    normalizedPayload.reference_number ||
    normalizedPayload.check_number ||
    normalizedPayload.zelle_reference ||
    payment.payment_number ||
    null;

  return {
    member_id: normalizedPayload.member_id || null,
    member_no: normalizedPayload.member_no || null,
    full_name_snapshot: normalizedPayload.full_name || null,
    email_snapshot: normalizedPayload.email || null,
    phone_snapshot: normalizedPayload.phone || null,

    payment_id: paymentId,
    invoice_id: invoiceId,
    receipt_id: receiptId,

    payment_number: payment.payment_number || normalizedPayload.payment_number || null,
    invoice_number: invoice.invoice_number || normalizedPayload.invoice_number || null,
    receipt_number: receipt.receipt_number || normalizedPayload.receipt_number || null,

    related_document_type: documentType,
    related_document_id: paymentId,
    related_document_number: payment.payment_number || null,

    source_document_type: documentType,
    source_document_id: paymentId,
    source_document_number: payment.payment_number || null,

    document_type: documentType,
    document_id: paymentId,
    document_number: payment.payment_number || null,

    record_type: "payment",
    ledger_type: "payment",
    entry_type: "payment",
    transaction_type: "payment",

    source_type: normalizedPayload.payment_type || normalizedPayload.category || "payment",
    category: normalizedPayload.payment_type || normalizedPayload.category || "other",
    sub_category: normalizedPayload.sub_category || normalizedPayload.donation_category || null,

    debit_amount: 0,
    credit_amount: normalizedPayload.amount,
    amount: normalizedPayload.amount,

    payment_status: "paid",
    ledger_status: "posted",
    status: "posted",
    reconciliation_status: "unreconciled",

    payment_method: normalizedPayload.method || normalizedPayload.payment_method || null,
    method: normalizedPayload.method || normalizedPayload.payment_method || null,
    provider: normalizedPayload.provider || normalizedPayload.payment_provider || null,

    plan_type: normalizedPayload.plan_name || null,
    plan_name: normalizedPayload.plan_name || null,
    months_paid: normalizedPayload.months_paid || null,
    coverage_label: normalizedPayload.coverage_label || null,
    coverage_year: normalizedPayload.coverage_year || null,

    description:
      normalizedPayload.description ||
      buildDescription(normalizedPayload) ||
      "Finance payment",

    reference_no: reference,
    source_reference: reference,
    transaction_reference: reference,

    recorded_by: normalizedPayload.recorded_by || normalizedPayload.created_by || null,
    created_by: normalizedPayload.created_by || normalizedPayload.finance_created_by || null,
    finance_created_by: normalizedPayload.finance_created_by || normalizedPayload.created_by || null,

    audit_source: "payment_service",
    posted_at: mysqlNow(),
    created_at: mysqlNow(),
    updated_at: mysqlNow(),
  };
}
function insertedId(result) {
  return Number(result?.insertId || result?.id || result || 0);
}

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

function boolFlag(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "y", "on"].includes(
    String(value).trim().toLowerCase()
  );
}

function safeJson(value, fallback = null) {
  try {
    if (value === undefined || value === null || value === "") return fallback;

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

function firstValue(source = {}, keys = [], fallback = null) {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;

    const value = source[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return fallback;
}

function normalizeType(value) {
  const raw = normalizePaymentType(value || "other");

  if (["membership_dues", "dues", "registration_fee"].includes(raw)) {
    return "membership";
  }

  if (["giving", "tithe", "offering"].includes(raw)) {
    return "donation";
  }

  if (["kids", "kids_school", "school_program"].includes(raw)) {
    return "school";
  }

  if (raw === "travel") return "trip";
  if (raw === "pledge_payment") return "pledge";

  return raw || "other";
}

function normalizeMethod(value) {
  const method = normalizePaymentMethod(value || "manual");

  if (["stripe", "stripe_card", "credit_card", "debit_card"].includes(method)) {
    return "card";
  }

  if (["stripe_ach", "bank", "bank_account", "us_bank_account"].includes(method)) {
    return "ach";
  }

  if (method === "cheque") return "check";

  return method;
}

function normalizePayProvider(value, method) {
  if (["card", "ach"].includes(method)) return "stripe";
  return normalizeProvider(value || method || "manual");
}

function normalizeCurrency(value) {
  return clean(value || "USD", 10).toUpperCase() || "USD";
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

function shortMonth(month) {
  return monthName(month).slice(0, 3);
}

function padMonth(month) {
  return String(Number(month)).padStart(2, "0");
}

function formatDateYMD(date) {
  return [
    date.getFullYear(),
    padMonth(date.getMonth() + 1),
    padMonth(date.getDate()),
  ].join("-");
}

function parseDate(value) {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function compareCoverageMonth(a, b) {
  const ay = Number(a.year);
  const am = Number(a.month);
  const by = Number(b.year);
  const bm = Number(b.month);

  if (ay !== by) return ay - by;
  return am - bm;
}

function dateToCoverageStart(date) {
  if (!date) return null;

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

function parseCoverageStart(value, fallbackYear) {
  if (!value) return null;

  const raw = String(value).trim();

  if (/^\d{4}-\d{1,2}$/.test(raw)) {
    const [year, month] = raw.split("-").map(Number);

    if (month >= 1 && month <= 12) {
      return { year, month };
    }
  }

  if (/^\d{1,2}$/.test(raw)) {
    const month = Number(raw);

    if (month >= 1 && month <= 12) {
      return {
        year: Number(fallbackYear) || new Date().getFullYear(),
        month,
      };
    }
  }

  const monthMap = {
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
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };

  const normalized = raw.toLowerCase();

  if (monthMap[normalized]) {
    return {
      year: Number(fallbackYear) || new Date().getFullYear(),
      month: monthMap[normalized],
    };
  }

  return null;
}

function coverageMonthEndDate(row = {}) {
  const year = Number(row.year || row.coverage_year || 0);
  const month = Number(row.month_number || row.month || 0);

  if (!year || month < 1 || month > 12) return null;

  return formatDateYMD(new Date(year, month, 0));
}

function buildCoverageRows(start, monthsPaid) {
  const rows = [];
  const count = Math.max(1, Number(monthsPaid || 1));

  for (let i = 0; i < count; i += 1) {
    const date = new Date(Number(start.year), Number(start.month) - 1 + i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    rows.push({
      year,
      month_number: month,
      month,
      month_name: monthName(month),
      coverage_month: `${year}-${padMonth(month)}`,
      label: `${shortMonth(month)} ${year}`,
    });
  }

  return rows;
}

function coverageLabel(rows) {
  if (!rows.length) return "";

  const first = rows[0];
  const last = rows[rows.length - 1];

  return `${monthName(first.month_number)} ${first.year} - ${monthName(
    last.month_number
  )} ${last.year}`;
}

function normalizeCoverageRowsFromJson(value) {
  return parseJson(value, [])
    .map((row) => {
      const year = Number(row.year || row.y || row.coverage_year || 0);

      const month = Number(
        row.month_number ||
          row.monthNumber ||
          row.month ||
          row.m ||
          0
      );

      if (!year || !month || month < 1 || month > 12) return null;

      return {
        year,
        month_number: month,
        month,
        month_name: row.month_name || row.monthName || monthName(month),
        coverage_month: `${year}-${padMonth(month)}`,
        label: row.label || `${shortMonth(month)} ${year}`,
      };
    })
    .filter(Boolean);
}

function getMemberStartDate(rawPayload = {}, member = {}) {
  return (
    parseDate(rawPayload.membership_start_date) ||
    parseDate(rawPayload.member_start_date) ||
    parseDate(rawPayload.join_date) ||
    parseDate(rawPayload.start_date) ||
    parseDate(member.membership_start_date) ||
    parseDate(member.member_start_date) ||
    parseDate(member.join_date) ||
    parseDate(member.joined_at) ||
    parseDate(member.start_date) ||
    parseDate(member.created_at) ||
    null
  );
}

function extractPlanMonths(payload = {}, plan = null) {
  const explicit =
    Number(payload.months_paid) ||
    Number(payload.duration_months) ||
    Number(payload.interval_count) ||
    Number(plan?.duration_months) ||
    Number(plan?.interval_months);

  if (explicit && Number.isFinite(explicit) && explicit > 0) {
    return Math.trunc(explicit);
  }

  const text = String(
    payload.plan_name ||
      payload.plan_type ||
      payload.selected_option ||
      payload.sub_category ||
      plan?.plan_name ||
      plan?.name ||
      ""
  ).toLowerCase();

  if (text.includes("12") || text.includes("annual") || text.includes("year")) {
    return 12;
  }

  if (text.includes("6")) return 6;
  if (text.includes("3") || text.includes("quarter")) return 3;

  return 1;
}

function buildMembershipCoverage(rawPayload = {}, member = {}, plan = null) {
  const monthsPaid = extractPlanMonths(rawPayload, plan);
  const startDate = getMemberStartDate(rawPayload, member);
  const memberStart = dateToCoverageStart(startDate);

  const explicitStart = parseCoverageStart(
    rawPayload.coverage_start_month ||
      rawPayload.membership_start_month ||
      rawPayload.start_month,
    rawPayload.coverage_year
  );

  const now = new Date();

  let start =
    explicitStart ||
    memberStart ||
    {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    };

  if (memberStart && compareCoverageMonth(start, memberStart) < 0) {
    start = memberStart;
  }

  const rawRows = normalizeCoverageRowsFromJson(
    rawPayload.coverage_months_json ||
      rawPayload.coverage_months
  );

  let rows = [];

  if (rawRows.length) {
    rows = rawRows.filter((row) => {
      if (!memberStart) return true;

      return (
        compareCoverageMonth(
          {
            year: row.year,
            month: row.month_number,
          },
          memberStart
        ) >= 0
      );
    });

    if (!rows.length) {
      rows = buildCoverageRows(start, monthsPaid);
    }
  } else {
    rows = buildCoverageRows(start, monthsPaid);
  }

  const first = rows[0];
  const last = rows[rows.length - 1];

  return {
    coverage_year: first.year,
    coverage_start_month: `${first.year}-${padMonth(first.month_number)}`,
    coverage_end_month: `${last.year}-${padMonth(last.month_number)}`,
    coverage_label: coverageLabel(rows),
    coverage_months_json: JSON.stringify(rows),
    months_paid: rows.length,
    coverage_start_date: `${first.year}-${padMonth(first.month_number)}-01`,
    coverage_end_date: coverageMonthEndDate(last),
    member_start_year: memberStart?.year || first.year,
    member_start_month: memberStart?.month || first.month_number,
    rows,
  };
}

function buildDescription(payload = {}) {
  if (payload.description) return payload.description;

  if (payload.payment_type === "membership") {
    return [
      "Membership payment",
      payload.plan_name,
      payload.coverage_label,
    ].filter(Boolean).join(" - ");
  }

  if (payload.payment_type === "donation") {
    return [
      "Donation",
      payload.donation_category_label ||
        payload.donation_category ||
        payload.sub_category,
    ].filter(Boolean).join(" - ");
  }

  if (["school", "trip"].includes(payload.payment_type)) {
    return [
      payload.payment_type === "school" ? "School payment" : "Trip payment",
      payload.program_title || payload.program_name,
    ].filter(Boolean).join(" - ");
  }

  if (payload.payment_type === "pledge") {
    return [
      "Pledge payment",
      payload.campaign_name || payload.plan_name,
    ].filter(Boolean).join(" - ");
  }

  return "Finance payment";
}

function normalizeProgramPaymentType(value) {
  const raw = clean(value, 80).toLowerCase();

  if (["kids", "school", "kids_school", "school_program"].includes(raw)) {
    return "school";
  }

  if (["trip", "travel", "outing"].includes(raw)) {
    return "trip";
  }

  return raw;
}

function isProgramPayment(value) {
  return ["school", "trip"].includes(
    normalizeProgramPaymentType(value)
  );
}

function invoiceTotalAmount(invoice = {}) {
  return asMoney(
    firstValue(invoice, [
      "total_amount",
      "amount",
      "invoice_amount",
      "subtotal",
      "subtotal_amount",
    ], 0)
  );
}

function invoicePaidAmount(invoice = {}) {
  return asMoney(
    firstValue(invoice, [
      "paid_amount",
      "amount_paid",
      "collected_amount",
    ], 0)
  );
}

function invoiceBalanceDue(invoice = {}) {
  const explicit = firstValue(invoice, [
    "balance_due",
    "remaining_amount",
    "amount_due",
  ], null);

  if (explicit !== null) return Math.max(0, asMoney(explicit));

  return Math.max(0, invoiceTotalAmount(invoice) - invoicePaidAmount(invoice));
}

function isPaidInvoiceStatus(value) {
  return ["paid", "completed", "closed", "settled"].includes(
    String(value || "").trim().toLowerCase()
  );
}

function isCancelledInvoiceStatus(value) {
  return ["void", "cancelled", "canceled", "refunded"].includes(
    String(value || "").trim().toLowerCase()
  );
}

function isLinkedInvoicePayload(payload = {}) {
  return Boolean(
    payload.existing_invoice_payment ||
      payload.linked_invoice_id ||
      payload.invoice_id ||
      payload.invoice_number
  );
}

function isNonMemberInvoicePayment(payload = {}) {
  if (!isLinkedInvoicePayload(payload)) return false;
  if (payload.member_id || payload.member_no || payload.user_id) return false;

  return ["non_member", "guest", "donor"].includes(
    String(payload.payer_type || "").trim().toLowerCase()
  );
}

function normalizeParticipantsFromSources(rawPayload = {}, programRegistration = null) {
  const sources = [
    rawPayload.participants,
    rawPayload.participants_json,
    rawPayload.student_names_json,
    rawPayload.registrants_json,
    programRegistration?.participants,
    programRegistration?.participants_json,
  ];

  for (const source of sources) {
    const rows = Array.isArray(source) ? source : parseJson(source, []);
    if (rows.length) return rows;
  }

  return [];
}

/* -------------------------------------------------------------------------- */
/* DB Helpers                                                                 */
/* -------------------------------------------------------------------------- */

async function tableExists(conn, tableName) {
  const [rows] = await conn.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function loadPlan(conn, planId) {
  if (!planId) return null;

  for (const table of ["tbl_finance_dues_plans", "tbl_membership_plans"]) {
    if (!(await tableExists(conn, table))) continue;

    const [[row]] = await conn.query(
      `
      SELECT *
      FROM ${table}
      WHERE id = ?
      LIMIT 1
      `,
      [planId]
    );

    if (row) return row;
  }

  return null;
}

async function resolveMember(conn, payload = {}) {
  if (payload.member_id) {
    const [[row]] = await conn.query(
      "SELECT * FROM tbl_members WHERE id = ? LIMIT 1",
      [payload.member_id]
    );

    if (row?.id) return row;
  }

  if (payload.member_no) {
    const [[row]] = await conn.query(
      "SELECT * FROM tbl_members WHERE member_no = ? LIMIT 1",
      [payload.member_no]
    );

    if (row?.id) return row;
  }

  if (payload.user_id) {
    const [[row]] = await conn.query(
      `
      SELECT m.*
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

  if (payload.skip_email_member_lookup || isNonMemberInvoicePayment(payload)) {
    return {};
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
    SELECT m.*
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

async function loadLinkedInvoice(conn, payload = {}) {
  const invoiceId =
    Number(payload.linked_invoice_id || payload.invoice_id || 0) || null;

  const invoiceNumber = clean(payload.invoice_number || "", 120);

  if (!invoiceId && !invoiceNumber) return null;

  const where = [];
  const params = [];

  if (invoiceId) {
    where.push("i.id = ?");
    params.push(invoiceId);
  }

  if (invoiceNumber) {
    where.push("i.invoice_number = ?");
    params.push(invoiceNumber);
  }

  const [rows] = await conn.query(
    `
    SELECT
      i.*,

      m.member_no AS linked_member_no,
      m.full_name AS linked_member_name,
      m.email AS linked_member_email,
      m.phone AS linked_member_phone

    FROM tbl_finance_invoices i

    LEFT JOIN tbl_members m
      ON m.id = i.member_id

    WHERE ${where.join(" OR ")}

    ORDER BY i.id DESC
    LIMIT 1
    `,
    params
  );

  return rows[0] || null;
}

async function hydratePaymentPayloadFromLinkedInvoice(conn, rawPayload = {}) {
  const invoice = await loadLinkedInvoice(conn, rawPayload);

  if (!invoice) return rawPayload;

  if (isCancelledInvoiceStatus(invoice.status)) {
    throw new Error("This invoice is cancelled or void.");
  }

  const balance = invoiceBalanceDue(invoice);

  if (balance <= 0 || isPaidInvoiceStatus(invoice.status)) {
    throw new Error("This invoice is already paid.");
  }

  const requestedAmount = asMoney(
    rawPayload.amount ||
      rawPayload.total_amount ||
      rawPayload.payment_amount ||
      0
  );

  const applied = requestedAmount > 0
    ? Math.min(requestedAmount, balance)
    : balance;

  const overpayment = requestedAmount > balance
    ? asMoney(requestedAmount - balance)
    : 0;

  return {
    ...rawPayload,

    existing_invoice_payment: true,
    linked_invoice: invoice,

    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,

    member_id:
      rawPayload.member_id ||
      invoice.member_id ||
      null,

    member_no:
      rawPayload.member_no ||
      invoice.member_no ||
      invoice.linked_member_no ||
      null,

    payer_type:
      rawPayload.payer_type ||
      invoice.payer_type ||
      (invoice.member_id ? "member" : "non_member"),

    full_name:
      rawPayload.full_name ||
      rawPayload.full_name_snapshot ||
      invoice.full_name_snapshot ||
      invoice.payer_name ||
      invoice.guest_name ||
      invoice.linked_member_name ||
      null,

    email:
      rawPayload.email ||
      rawPayload.email_snapshot ||
      invoice.email_snapshot ||
      invoice.payer_email ||
      invoice.guest_email ||
      invoice.linked_member_email ||
      null,

    phone:
      rawPayload.phone ||
      rawPayload.phone_snapshot ||
      invoice.phone_snapshot ||
      invoice.payer_phone ||
      invoice.guest_phone ||
      invoice.linked_member_phone ||
      null,

    payment_type:
      rawPayload.payment_type ||
      invoice.payment_type ||
      invoice.category ||
      invoice.invoice_type ||
      "invoice",

    category:
      rawPayload.category ||
      invoice.category ||
      invoice.payment_type ||
      "invoice",

    sub_category:
      rawPayload.sub_category ||
      invoice.sub_category ||
      invoice.donation_category ||
      invoice.program_name ||
      invoice.campaign_name ||
      null,

    donation_category:
      rawPayload.donation_category ||
      invoice.donation_category ||
      null,

    pledge_id:
      rawPayload.pledge_id ||
      invoice.pledge_id ||
      null,

    pledge_number:
      rawPayload.pledge_number ||
      invoice.pledge_number ||
      null,

    campaign_id:
      rawPayload.campaign_id ||
      invoice.campaign_id ||
      null,

    campaign_name:
      rawPayload.campaign_name ||
      invoice.campaign_name ||
      null,

    registration_id:
      rawPayload.registration_id ||
      invoice.registration_id ||
      null,

    news_event_id:
      rawPayload.news_event_id ||
      invoice.news_event_id ||
      invoice.program_id ||
      null,

    program_id:
      rawPayload.program_id ||
      invoice.program_id ||
      invoice.news_event_id ||
      null,

    program_name:
      rawPayload.program_name ||
      invoice.program_name ||
      null,

    participants_json:
      rawPayload.participants_json ||
      invoice.participants_json ||
      null,

    pricing_tier_id:
      rawPayload.pricing_tier_id ||
      invoice.pricing_tier_id ||
      null,

    pricing_tier_label:
      rawPayload.pricing_tier_label ||
      invoice.pricing_tier_label ||
      null,

    amount: applied,
    total_amount: applied,
    invoice_amount_applied: applied,
    overpayment_amount: overpayment,
    remaining_credit: overpayment,

    skip_email_member_lookup:
      rawPayload.skip_email_member_lookup ||
      !invoice.member_id,

    metadata: {
      ...(rawPayload.metadata || {}),
      linked_invoice_id: invoice.id,
      linked_invoice_number: invoice.invoice_number,
      invoice_balance_before_payment: balance,
      invoice_amount_applied: applied,
      overpayment_amount: overpayment,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Program / Pledge Helpers                                                   */
/* -------------------------------------------------------------------------- */

async function loadProgramRegistrationDetails(conn, registrationId) {
  const id = Number(registrationId || 0);

  if (!id) return null;

  if (
    typeof programRegistrationService.getRegistrationById === "function"
  ) {
    try {
      return await programRegistrationService.getRegistrationById(conn, id);
    } catch (err) {
      console.error("getRegistrationById failed:", err.message);
    }
  }

  try {
    const [[row]] = await conn.query(
      `
      SELECT
        r.*,
        e.title AS program_title,
        e.start_date AS event_date,
        e.location AS program_location
      FROM tbl_event_program_registrations r
      LEFT JOIN tbl_news_events e
        ON e.id = r.news_event_id
      WHERE r.id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!row) return null;

    row.participants = parseJson(row.participants_json, []);

    return row;
  } catch (err) {
    console.error("loadProgramRegistrationDetails failed:", err.message);
    return null;
  }
}

async function markProgramRegistrationPaidForPayment(
  conn,
  payload,
  payment,
  invoice,
  receipt
) {
  if (!isProgramPayment(payload.payment_type)) return null;
  if (!payload.registration_id) return null;

  if (typeof programRegistrationService.markRegistrationPaid !== "function") {
    return null;
  }

  return programRegistrationService.markRegistrationPaid(conn, {
    registration_id: payload.registration_id,
    payment_id: payment.id,
    invoice_id: invoice?.id || null,
    receipt_id: receipt?.id || null,
    stripe_payment_intent_id: payload.stripe_payment_intent_id || null,
    stripe_checkout_session_id: payload.stripe_checkout_session_id || null,
    amount: payload.amount,
  });
}

async function applyPaymentToPledge(conn, payload, payment, invoice, receipt) {
  const pledgeId = Number(payload.pledge_id || 0);
  if (!pledgeId) return null;

  const [[pledge]] = await conn.query(
    `
    SELECT *
    FROM tbl_finance_pledges
    WHERE id = ?
    LIMIT 1
    `,
    [pledgeId]
  );

  if (!pledge) return null;

  const pledgedAmount = asMoney(
    pledge.pledged_amount ||
      pledge.amount ||
      payload.pledged_amount ||
      0
  );

  const previousPaid = asMoney(
    pledge.paid_amount ||
      pledge.amount_paid ||
      0
  );

  const paidAmount = asMoney(previousPaid + payload.amount);
  const remaining = Math.max(0, asMoney(pledgedAmount - paidAmount));

  const status = remaining <= 0
    ? "paid"
    : paidAmount > 0
      ? "partial"
      : "active";

  await updateExistingColumns(
    conn,
    "tbl_finance_pledges",
    {
      paid_amount: paidAmount,
      amount_paid: paidAmount,
      remaining_balance: remaining,
      balance_due: remaining,
      status,
      paid_at: remaining <= 0 ? mysqlNow() : null,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [pledgeId]
  );

  await insertExistingColumns(conn, "tbl_finance_pledge_audit", {
    pledge_id: pledgeId,
    payment_id: payment.id,
    invoice_id: invoice?.id || null,
    receipt_id: receipt?.id || null,
    action: "payment_applied",
    amount: payload.amount,
    previous_paid_amount: previousPaid,
    new_paid_amount: paidAmount,
    remaining_balance: remaining,
    status,
    created_by: payload.created_by || null,
    created_at: mysqlNow(),
  }).catch(() => {});

  return {
    pledge_id: pledgeId,
    status,
    paid_amount: paidAmount,
    remaining_balance: remaining,
  };
}

/* -------------------------------------------------------------------------- */
/* Stripe Helpers                                                             */
/* -------------------------------------------------------------------------- */

async function retrieveCardSummary(paymentIntentId) {
  if (!stripe || !paymentIntentId) return {};

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });

    const charge =
      typeof intent.latest_charge === "object"
        ? intent.latest_charge
        : null;

    const details = charge?.payment_method_details || {};
    const card = details.card || {};
    const bank = details.us_bank_account || {};

    return {
      stripe_charge_id: charge?.id || null,

      payment_method_type:
        details.type === "us_bank_account"
          ? "ach"
          : details.type || null,

      card_brand: card.brand || null,
      card_last4: card.last4 || null,
      card_exp_month: card.exp_month || null,
      card_exp_year: card.exp_year || null,
      cardholder_name: charge?.billing_details?.name || null,

      bank_last4: bank.last4 || null,
      bank_name: bank.bank_name || null,
      bank_account_type: bank.account_type || null,
    };
  } catch (err) {
    console.error("retrieveCardSummary error:", err.message);
    return {};
  }
}

/* -------------------------------------------------------------------------- */
/* Duplicate Guards                                                           */
/* -------------------------------------------------------------------------- */

async function findExistingStripePayment(conn, rawPayload = {}) {
  const candidates = [
    rawPayload.stripe_payment_intent_id,
    rawPayload.stripe_checkout_session_id,
    rawPayload.stripe_charge_id,
    rawPayload.reference_no,
    rawPayload.transaction_reference,
  ].filter(Boolean);

  if (!candidates.length) return null;

  const [rows] = await conn.query(
    `
    SELECT *
    FROM tbl_finance_payments
    WHERE (
      stripe_payment_intent_id IN (?)
      OR stripe_checkout_session_id IN (?)
      OR stripe_charge_id IN (?)
      OR reference_no IN (?)
      OR transaction_reference IN (?)
    )
      AND LOWER(COALESCE(status, payment_status, '')) NOT IN
        ('cancelled', 'canceled', 'void', 'reversed')
    ORDER BY id DESC
    LIMIT 1
    `,
    [candidates, candidates, candidates, candidates, candidates]
  );

  return rows[0] || null;
}

async function findPaidDuplicateCoverage(conn, payload) {
  if (!payload.member_id || !payload.coverage_months_json) return null;

  const rows = normalizeCoverageRowsFromJson(payload.coverage_months_json);
  if (!rows.length) return null;

  for (const row of rows) {
    const [matches] = await conn.query(
      `
      SELECT *
      FROM tbl_member_membership_coverage
      WHERE member_id = ?
        AND coverage_year = ?
        AND month_number = ?
        AND LOWER(COALESCE(status, 'paid')) IN ('paid', 'covered', 'active')
      LIMIT 1
      `,
      [payload.member_id, row.year, row.month_number]
    );

    if (matches[0]) return matches[0];
  }

  return null;
}

async function assertNoDuplicateMembershipPayment(conn, payload) {
  const duplicate = await findPaidDuplicateCoverage(conn, payload);

  if (duplicate) {
    throw new Error(
      `Duplicate membership payment blocked. ${duplicate.month_name || duplicate.month_number} ${duplicate.coverage_year} is already paid.`
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Normalize                                                                  */
/* -------------------------------------------------------------------------- */

async function normalizePaymentPayload(conn, rawPayload = {}) {
  rawPayload = await hydratePaymentPayloadFromLinkedInvoice(conn, rawPayload);

  const preliminaryType = normalizeType(
    rawPayload.payment_type ||
      rawPayload.category ||
      rawPayload.type
  );

  const paymentType = normalizeProgramPaymentType(preliminaryType);

  const programRegistration =
    isProgramPayment(paymentType) && rawPayload.registration_id
      ? await loadProgramRegistrationDetails(conn, rawPayload.registration_id)
      : null;

  const amount = asMoney(
    rawPayload.total_amount ||
      rawPayload.amount ||
      rawPayload.payment_amount ||
      rawPayload.subtotal_amount ||
      programRegistration?.total_amount
  );

  if (amount <= 0) {
    throw new Error("Invalid payment amount.");
  }

  const method = normalizeMethod(
    rawPayload.method ||
      rawPayload.payment_method ||
      "manual"
  );

  const provider = normalizePayProvider(
    rawPayload.provider ||
      rawPayload.payment_provider ||
      method,
    method
  );

  const nonMemberInvoicePayment = isNonMemberInvoicePayment(rawPayload);

  const memberLookupPayload = {
    ...rawPayload,
    member_id:
      rawPayload.member_id ||
      programRegistration?.member_id ||
      null,
    skip_email_member_lookup:
      rawPayload.skip_email_member_lookup ||
      nonMemberInvoicePayment ||
      rawPayload.payer_type === "non_member",
  };

  const member = await resolveMember(conn, memberLookupPayload);

  const resolvedMemberId =
    member?.id ||
    Number(rawPayload.member_id || programRegistration?.member_id || 0) ||
    null;

  const resolvedMemberNo =
    member?.member_no ||
    rawPayload.member_no ||
    null;

  if (paymentType === "membership" && !resolvedMemberId) {
    throw new Error("Membership payment requires a member.");
  }

  const guest = rawPayload.guest || {};

  const fullName =
    rawPayload.full_name ||
    rawPayload.member_name ||
    rawPayload.payer_name ||
    rawPayload.full_name_snapshot ||
    programRegistration?.full_name ||
    (!nonMemberInvoicePayment ? member?.full_name : null) ||
    guest.full_name ||
    rawPayload.cardholder_name ||
    `${rawPayload.first_name || ""} ${rawPayload.last_name || ""}`.trim() ||
    "Guest / Donor";

  const email =
    rawPayload.email ||
    rawPayload.email_snapshot ||
    rawPayload.payer_email ||
    programRegistration?.email ||
    guest.email ||
    (!nonMemberInvoicePayment ? member?.email : null) ||
    null;

  const phone =
    rawPayload.phone ||
    rawPayload.phone_snapshot ||
    rawPayload.payer_phone ||
    programRegistration?.phone ||
    guest.phone ||
    (!nonMemberInvoicePayment ? member?.phone : null) ||
    null;

  const plan = await loadPlan(
    conn,
    rawPayload.dues_plan_id ||
      rawPayload.plan_id ||
      rawPayload.membership_plan_id
  );

  const coverage =
    paymentType === "membership"
      ? buildMembershipCoverage(rawPayload, member, plan)
      : null;

  const donationCategory =
    paymentType === "donation"
      ? normalizeDonationCategory(
          rawPayload.donation_category ||
            rawPayload.sub_category ||
            "general_donation"
        )
      : null;

  const participants = normalizeParticipantsFromSources(
    rawPayload,
    programRegistration
  );

  const programTitle =
    rawPayload.program_title ||
    rawPayload.program_name ||
    programRegistration?.program_title ||
    programRegistration?.title ||
    rawPayload.sub_category ||
    null;

  const status = normalizeStatus(
    rawPayload.status ||
      rawPayload.payment_status ||
      "paid"
  );

  const normalized = {
    ...rawPayload,

    member_id: resolvedMemberId,
    member_no: resolvedMemberNo,

    full_name: fullName,
    email,
    phone,

    full_name_snapshot: fullName,
    email_snapshot: email,
    phone_snapshot: phone,

    payer_type:
      rawPayload.payer_type ||
      (resolvedMemberId ? "member" : "non_member"),

    payment_type: paymentType,
    category: paymentType,

    sub_category:
      rawPayload.sub_category ||
      donationCategory ||
      programTitle ||
      rawPayload.plan_name ||
      null,

    donation_category: donationCategory,

    donation_category_label: donationCategory
      ? donationCategoryLabel(donationCategory)
      : rawPayload.donation_category_label || null,

    method,
    provider,
    payment_method: method,
    payment_provider: provider,

    status,
    payment_status: status,

    amount,
    total_amount: amount,
    paid_amount: amount,

    invoice_amount_applied:
      rawPayload.invoice_amount_applied !== undefined
        ? asMoney(rawPayload.invoice_amount_applied)
        : null,

    overpayment_amount: asMoney(rawPayload.overpayment_amount || 0),
    remaining_credit: asMoney(
      rawPayload.remaining_credit ||
        rawPayload.overpayment_amount ||
        0
    ),

    membership_amount: asMoney(
      rawPayload.membership_amount ||
        rawPayload.amount_paid ||
        rawPayload.base_amount ||
        (paymentType === "membership"
          ? Math.max(
              0,
              amount -
                Number(rawPayload.registration_fee || 0) -
                Number(rawPayload.processing_fee || 0)
            )
          : 0)
    ),

    registration_fee: asMoney(rawPayload.registration_fee || 0),
    processing_fee: asMoney(rawPayload.processing_fee || 0),
    subtotal_amount: asMoney(rawPayload.subtotal_amount || amount),

    currency: normalizeCurrency(rawPayload.currency),

    plan_id:
      rawPayload.plan_id ||
      rawPayload.dues_plan_id ||
      rawPayload.membership_plan_id ||
      null,

    dues_plan_id:
      rawPayload.dues_plan_id ||
      rawPayload.plan_id ||
      null,

    membership_plan_id:
      rawPayload.membership_plan_id ||
      rawPayload.plan_id ||
      null,

    plan_name:
      rawPayload.plan_name ||
      plan?.plan_name ||
      plan?.name ||
      null,

    quantity:
      Number(
        rawPayload.quantity ||
          programRegistration?.quantity ||
          participants.length ||
          1
      ) || 1,

    price_per_person:
      rawPayload.price_per_person ||
      programRegistration?.price_per_person ||
      null,

    pricing_tier_id:
      rawPayload.pricing_tier_id ||
      programRegistration?.pricing_tier_id ||
      null,

    pricing_tier_label:
      rawPayload.pricing_tier_label ||
      programRegistration?.pricing_tier_label ||
      null,

    program_name: programTitle,
    program_title: programTitle,

    program_category:
      rawPayload.program_category ||
      programRegistration?.category ||
      paymentType,

    participants,
    participants_json: safeJson(participants, "[]"),

    registration_id:
      rawPayload.registration_id ||
      programRegistration?.id ||
      null,

    news_event_id:
      rawPayload.news_event_id ||
      rawPayload.related_entity_id ||
      rawPayload.program_id ||
      programRegistration?.news_event_id ||
      null,

    related_entity_id:
      rawPayload.related_entity_id ||
      rawPayload.news_event_id ||
      rawPayload.program_id ||
      programRegistration?.news_event_id ||
      null,

    related_entity_type:
      rawPayload.related_entity_type ||
      (isProgramPayment(paymentType) ? "news_event" : null),

    event_date:
      rawPayload.event_date ||
      programRegistration?.event_date ||
      programRegistration?.program_start_date ||
      null,

    pledge_id: rawPayload.pledge_id || null,
    pledge_number: rawPayload.pledge_number || null,
    campaign_id: rawPayload.campaign_id || null,
    campaign_name: rawPayload.campaign_name || null,

    invoice_id: rawPayload.invoice_id || null,
    invoice_number: rawPayload.invoice_number || null,
    linked_invoice: rawPayload.linked_invoice || null,

    coverage_year:
      coverage?.coverage_year ||
      rawPayload.coverage_year ||
      null,

    coverage_start_month:
      coverage?.coverage_start_month ||
      rawPayload.coverage_start_month ||
      null,

    coverage_end_month:
      coverage?.coverage_end_month ||
      rawPayload.coverage_end_month ||
      null,

    coverage_months_json:
      coverage?.coverage_months_json ||
      rawPayload.coverage_months_json ||
      null,

    coverage_label:
      coverage?.coverage_label ||
      rawPayload.coverage_label ||
      null,

    coverage_start_date:
      coverage?.coverage_start_date ||
      rawPayload.coverage_start_date ||
      null,

    coverage_end_date:
      coverage?.coverage_end_date ||
      rawPayload.coverage_end_date ||
      null,

    months_paid:
      coverage?.months_paid ||
      rawPayload.months_paid ||
      rawPayload.duration_months ||
      null,

    member_start_year: coverage?.member_start_year || null,
    member_start_month: coverage?.member_start_month || null,

    reference_no:
      rawPayload.reference_no ||
      rawPayload.reference_number ||
      rawPayload.transaction_reference ||
      rawPayload.check_number ||
      rawPayload.zelle_reference ||
      rawPayload.stripe_charge_id ||
      rawPayload.stripe_payment_intent_id ||
      rawPayload.stripe_checkout_session_id ||
      null,

    transaction_reference:
      rawPayload.transaction_reference ||
      rawPayload.reference_no ||
      rawPayload.reference_number ||
      rawPayload.stripe_charge_id ||
      rawPayload.stripe_payment_intent_id ||
      rawPayload.stripe_checkout_session_id ||
      null,

    send_receipt_email: boolFlag(rawPayload.send_receipt_email, true),
    send_invoice_email: boolFlag(
      rawPayload.send_invoice_email,
      rawPayload.source === "public_invoice" ? false : true
    ),
    send_welcome_email: boolFlag(rawPayload.send_welcome_email, false),

    created_by:
      rawPayload.created_by ||
      rawPayload.actor_id ||
      rawPayload.finance_created_by ||
      rawPayload.recorded_by ||
      null,
  };

  normalized.metadata_json = safeJson({
    ...(rawPayload.metadata || {}),

    source: rawPayload.source || rawPayload.created_from || null,
    payer_type: normalized.payer_type,

    invoice_id: normalized.invoice_id || null,
    invoice_number: normalized.invoice_number || null,

    program_registration_id: normalized.registration_id || null,
    pricing_tier_id: normalized.pricing_tier_id || null,
    pricing_tier_label: normalized.pricing_tier_label || null,
    participants,

    pledge_id: normalized.pledge_id || null,
    pledge_number: normalized.pledge_number || null,
    campaign_id: normalized.campaign_id || null,
    campaign_name: normalized.campaign_name || null,

    amount_applied: normalized.invoice_amount_applied || null,
    overpayment_amount: normalized.overpayment_amount || 0,
  });

  normalized.description =
    rawPayload.description ||
    buildDescription(normalized);

  return normalized;
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                  */
/* -------------------------------------------------------------------------- */

async function createOrReusePaymentInvoice(conn, payload) {
  if (payload.linked_invoice?.id || payload.existing_invoice_payment) {
    return {
      ...payload.linked_invoice,
      id: payload.invoice_id,
      invoice_number: payload.invoice_number,
      reused: true,
    };
  }

  if (typeof generateInvoice === "function") {
    return generateInvoice(conn, {
      ...payload,
      paid_amount: payload.status === "paid" ? payload.amount : 0,
      balance_due: payload.status === "paid" ? 0 : payload.amount,
      status: payload.status === "paid" ? "paid" : "open",
    });
  }

  const invoiceNumber = payload.invoice_number || number("INV");

  const id = insertedId(
    await insertExistingColumns(conn, "tbl_finance_invoices", {
      invoice_number: invoiceNumber,

      member_id: payload.member_id || null,
      member_no: payload.member_no || null,
      payer_type: payload.payer_type || (payload.member_id ? "member" : "non_member"),

      full_name_snapshot: payload.full_name || null,
      email_snapshot: payload.email || null,
      phone_snapshot: payload.phone || null,

      amount: payload.amount,
      total_amount: payload.amount,
      paid_amount: payload.status === "paid" ? payload.amount : 0,
      balance_due: payload.status === "paid" ? 0 : payload.amount,

      category: payload.payment_type,
      payment_type: payload.payment_type,
      donation_category: payload.donation_category || null,

      pledge_id: payload.pledge_id || null,
      pledge_number: payload.pledge_number || null,
      campaign_id: payload.campaign_id || null,
      campaign_name: payload.campaign_name || null,

      registration_id: payload.registration_id || null,
      news_event_id: payload.news_event_id || null,
      program_id: payload.program_id || payload.news_event_id || null,
      program_name: payload.program_name || payload.program_title || null,
      participants_json: payload.participants_json || safeJson(payload.participants, "[]"),
      pricing_tier_id: payload.pricing_tier_id || null,
      pricing_tier_label: payload.pricing_tier_label || null,

      coverage_year: payload.coverage_year || null,
      coverage_start_month: payload.coverage_start_month || null,
      coverage_end_month: payload.coverage_end_month || null,
      coverage_label: payload.coverage_label || null,
      coverage_months_json: payload.coverage_months_json || null,

      metadata_json: payload.metadata_json || safeJson(payload.metadata, null),

      status: payload.status === "paid" ? "paid" : "open",
      invoice_date: mysqlNow(),
      paid_at: payload.status === "paid" ? mysqlNow() : null,
      created_at: mysqlNow(),
      updated_at: mysqlNow(),
    })
  );

  return {
    id,
    invoice_number: invoiceNumber,
  };
}

async function applyPaymentToInvoice(conn, invoice, payment, payload) {
  if (!invoice?.id) return null;

  const beforeBalance = invoiceBalanceDue(invoice);
  const beforePaid = invoicePaidAmount(invoice);
  const applied = asMoney(payload.invoice_amount_applied || payload.amount);
  const paidAmount = asMoney(beforePaid + applied);
  const remaining = Math.max(0, asMoney(beforeBalance - applied));

  await updateExistingColumns(
    conn,
    "tbl_finance_invoices",
    {
      payment_id: payment.id,
      payment_number: payment.payment_number,
      paid_amount: paidAmount,
      amount_paid: paidAmount,
      balance_due: remaining,
      remaining_amount: remaining,
      status: remaining <= 0 ? "paid" : "partial",
      paid_at: remaining <= 0 ? mysqlNow() : null,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [invoice.id]
  );

  return {
    paid_amount: paidAmount,
    balance_due: remaining,
    status: remaining <= 0 ? "paid" : "partial",
  };
}

async function createReceiptDocument(conn, payload) {
  if (typeof generateReceipt === "function") {
    return generateReceipt(conn, payload);
  }

  const receiptNumber = payload.receipt_number || number("RCPT");

  const id = insertedId(
    await insertExistingColumns(conn, "tbl_finance_receipts", {
      receipt_number: receiptNumber,

      payment_id: payload.payment_id,
      payment_number: payload.payment_number || null,
      invoice_id: payload.invoice_id || null,
      invoice_number: payload.invoice_number || null,

      member_id: payload.member_id || null,
      member_no: payload.member_no || null,
      payer_type: payload.payer_type || (payload.member_id ? "member" : "non_member"),

      full_name_snapshot: payload.full_name || null,
      email_snapshot: payload.email || null,
      phone_snapshot: payload.phone || null,

      amount: payload.amount,
      payment_method: payload.method,
      method: payload.method,
      provider: payload.provider,

      reference_no: payload.reference_no || null,
      transaction_reference: payload.transaction_reference || null,

      category: payload.payment_type,
      payment_type: payload.payment_type,
      donation_category: payload.donation_category || null,

      pledge_id: payload.pledge_id || null,
      pledge_number: payload.pledge_number || null,
      campaign_id: payload.campaign_id || null,
      campaign_name: payload.campaign_name || null,

      registration_id: payload.registration_id || null,
      news_event_id: payload.news_event_id || null,
      program_id: payload.program_id || payload.news_event_id || null,
      program_name: payload.program_name || payload.program_title || null,
      participants_json: payload.participants_json || safeJson(payload.participants, "[]"),
      pricing_tier_id: payload.pricing_tier_id || null,
      pricing_tier_label: payload.pricing_tier_label || null,

      coverage_year: payload.coverage_year || null,
      coverage_start_month: payload.coverage_start_month || null,
      coverage_end_month: payload.coverage_end_month || null,
      coverage_label: payload.coverage_label || null,
      coverage_months_json: payload.coverage_months_json || null,

      metadata_json: payload.metadata_json || safeJson(payload.metadata, null),

      status: "issued",
      email_status: payload.email ? "queued" : null,
      issued_at: mysqlNow(),
      created_at: mysqlNow(),
      updated_at: mysqlNow(),
    })
  );

  return {
    id,
    receipt_number: receiptNumber,
  };
}

/* -------------------------------------------------------------------------- */
/* Payment Record / Membership Coverage                                       */
/* -------------------------------------------------------------------------- */

async function createPaymentRecord(conn, payload) {
  const paymentNumber = payload.payment_number || number("PAY");

  const id = insertedId(
    await insertExistingColumns(conn, "tbl_finance_payments", {
      payment_number: paymentNumber,

      member_id: payload.member_id || null,
      member_no: payload.member_no || null,
      payer_type: payload.payer_type || (payload.member_id ? "member" : "non_member"),

      full_name_snapshot: payload.full_name || null,
      email_snapshot: payload.email || null,
      phone_snapshot: payload.phone || null,

      payment_type: payload.payment_type,
      category: payload.payment_type,
      sub_category: payload.sub_category || null,
      donation_category: payload.donation_category || null,

      amount: payload.amount,
      total_amount: payload.amount,
      paid_amount: payload.amount,
      currency: payload.currency,

      method: payload.method,
      payment_method: payload.method,
      provider: payload.provider,
      payment_provider: payload.provider,

      status: payload.status,
      payment_status: payload.status,

      invoice_id: payload.invoice_id || null,
      invoice_number: payload.invoice_number || null,

      reference_no: payload.reference_no || null,
      reference_number: payload.reference_no || null,
      transaction_reference: payload.transaction_reference || payload.reference_no || null,

      check_number: payload.method === "check" ? payload.reference_no : null,
      zelle_reference: payload.method === "zelle" ? payload.reference_no : null,

      stripe_event_id: payload.stripe_event_id || null,
      stripe_event_type: payload.stripe_event_type || null,
      stripe_checkout_session_id: payload.stripe_checkout_session_id || null,
      stripe_payment_intent_id: payload.stripe_payment_intent_id || null,
      stripe_subscription_id: payload.stripe_subscription_id || null,
      stripe_invoice_id: payload.stripe_invoice_id || null,
      stripe_customer_id: payload.stripe_customer_id || null,
      stripe_charge_id: payload.stripe_charge_id || null,

      card_brand: payload.card_brand || null,
      card_last4: payload.card_last4 || null,
      card_exp_month: payload.card_exp_month || null,
      card_exp_year: payload.card_exp_year || null,

      bank_last4: payload.bank_last4 || null,
      bank_name: payload.bank_name || null,
      bank_account_type: payload.bank_account_type || null,

      plan_id: payload.plan_id || null,
      dues_plan_id: payload.dues_plan_id || null,
      plan_name: payload.plan_name || null,
      months_paid: payload.months_paid || null,

      coverage_year: payload.coverage_year || null,
      coverage_start_month: payload.coverage_start_month || null,
      coverage_end_month: payload.coverage_end_month || null,
      coverage_label: payload.coverage_label || null,
      coverage_months_json: payload.coverage_months_json || null,

      pledge_id: payload.pledge_id || null,
      pledge_number: payload.pledge_number || null,
      campaign_id: payload.campaign_id || null,
      campaign_name: payload.campaign_name || null,

      registration_id: payload.registration_id || null,
      news_event_id: payload.news_event_id || null,
      program_id: payload.program_id || payload.news_event_id || null,
      program_name: payload.program_name || payload.program_title || null,
      participants_json: payload.participants_json || safeJson(payload.participants, "[]"),
      pricing_tier_id: payload.pricing_tier_id || null,
      pricing_tier_label: payload.pricing_tier_label || null,

      source: payload.source || payload.created_from || null,
      created_from: payload.created_from || payload.source || null,
      description: payload.description || null,
      notes: payload.notes || null,

      metadata_json: payload.metadata_json || safeJson(payload.metadata, null),

      created_by: payload.created_by || null,
      recorded_by: payload.recorded_by || payload.created_by || null,

      paid_at: payload.status === "paid" ? mysqlNow() : null,
      created_at: mysqlNow(),
      updated_at: mysqlNow(),
    })
  );

  return {
    id,
    payment_number: paymentNumber,
  };
}

async function markPreStartCoverageNotApplicable(conn, payload) {
  if (!payload.member_id || !payload.member_start_year || !payload.member_start_month) {
    return;
  }

  await updateExistingColumns(
    conn,
    "tbl_member_membership_coverage",
    {
      status: "not_applicable",
      note: "Before member start date",
      updated_at: mysqlNow(),
    },
    `
    member_id = ?
      AND (
        coverage_year < ?
        OR (coverage_year = ? AND month_number < ?)
      )
      AND LOWER(COALESCE(status, '')) IN ('open', 'unpaid', 'due', 'overdue')
    `,
    [
      payload.member_id,
      payload.member_start_year,
      payload.member_start_year,
      payload.member_start_month,
    ]
  ).catch(() => {});
}

async function createMembershipCoverage(conn, payload) {
  const rows = normalizeCoverageRowsFromJson(payload.coverage_months_json);

  for (const row of rows) {
    await insertExistingColumns(conn, "tbl_member_membership_coverage", {
      member_id: payload.member_id,
      member_no: payload.member_no,

      coverage_year: row.year,
      month_number: row.month_number,
      month_name: row.month_name,
      coverage_month: row.coverage_month,

      payment_id: payload.payment_id,
      payment_number: payload.payment_number,
      invoice_id: payload.invoice_id,
      invoice_number: payload.invoice_number,
      receipt_id: payload.receipt_id,
      receipt_number: payload.receipt_number,

      amount: payload.amount / rows.length,
      status: "paid",

      plan_id: payload.plan_id || payload.dues_plan_id || null,
      plan_name: payload.plan_name || null,

      paid_at: mysqlNow(),
      created_at: mysqlNow(),
      updated_at: mysqlNow(),
    });
  }

  return rows;
}

async function updateMemberMembershipSummary(conn, payload) {
  if (!payload.member_id) return;

  await updateExistingColumns(
    conn,
    "tbl_members",
    {
      membership_status: "active",
      status: "active",
      is_active: 1,
      membership_start_date: payload.coverage_start_date || null,
      membership_end_date: payload.coverage_end_date || null,
      last_payment_at: mysqlNow(),
      updated_at: mysqlNow(),
    },
    "id = ?",
    [payload.member_id]
  ).catch((err) => {
    console.error("updateMemberMembershipSummary failed:", err.message);
  });
}

/* -------------------------------------------------------------------------- */
/* Main Transaction                                                           */
/* -------------------------------------------------------------------------- */

async function processSuccessfulPayment(conn, rawPayload = {}) {
  const duplicate = await findExistingStripePayment(conn, rawPayload);

  if (duplicate) {
    return {
      duplicate: true,
      payment: duplicate,
      payment_id: duplicate.id,
      payment_number: duplicate.payment_number,
      should_send_receipt_email: false,
      should_send_invoice_email: false,
    };
  }

  const normalizedPayload = await normalizePaymentPayload(conn, rawPayload);

  if (
    normalizedPayload.payment_type === "membership" &&
    normalizedPayload.status === "paid"
  ) {
    await assertNoDuplicateMembershipPayment(conn, normalizedPayload);
    await markPreStartCoverageNotApplicable(conn, normalizedPayload);
  }

  const invoice = await createOrReusePaymentInvoice(conn, normalizedPayload);

  const payment = await createPaymentRecord(conn, {
    ...normalizedPayload,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
  });

  await applyPaymentToInvoice(conn, invoice, payment, normalizedPayload);

  const receipt = await createReceiptDocument(conn, {
    ...normalizedPayload,
    payment_id: payment.id,
    payment_number: payment.payment_number,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
  });

  await updateExistingColumns(
    conn,
    "tbl_finance_payments",
    {
      receipt_id: receipt.id,
      receipt_number: receipt.receipt_number,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [payment.id]
  ).catch(() => {});

  if (
    normalizedPayload.payment_type === "membership" &&
    normalizedPayload.status === "paid"
  ) {
    await createMembershipCoverage(conn, {
      ...normalizedPayload,
      payment_id: payment.id,
      payment_number: payment.payment_number,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      receipt_id: receipt.id,
      receipt_number: receipt.receipt_number,
    });

    await updateMemberMembershipSummary(conn, normalizedPayload);

    await applyMembershipPayment(conn, {
      ...normalizedPayload,
      payment_id: payment.id,
      payment_number: payment.payment_number,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      receipt_id: receipt.id,
      receipt_number: receipt.receipt_number,
      months: Number(normalizedPayload.months_paid || 1),
      duration_months: Number(normalizedPayload.months_paid || 1),
      skip_unpaid_backfill: true,
      skip_open_month_generation: true,
      coverage_already_recorded: true,
    }).catch((err) => {
      console.error("applyMembershipPayment skipped/failed:", err.message);
    });
  }

 await postPaymentEntry(
  conn,
  buildLedgerPayload(
    normalizedPayload,
    payment,
    invoice,
    receipt
  )
).catch((err) => {
  console.error("postPaymentEntry failed:", err.message);
});
  if (normalizedPayload.payment_type === "donation") {
    await createDonationDetail(conn, {
      ...normalizedPayload,
      payment_id: payment.id,
      receipt_id: receipt.id,
      invoice_id: invoice.id,
      amount: normalizedPayload.amount,
    }).catch((err) => {
      console.error("createDonationDetail failed:", err.message);
    });
  }

  if (["school", "trip"].includes(normalizedPayload.payment_type)) {
    await markProgramRegistrationPaidForPayment(
      conn,
      normalizedPayload,
      payment,
      invoice,
      receipt
    ).catch((err) => {
      console.error("markProgramRegistrationPaidForPayment failed:", err.message);
    });
  }

  if (normalizedPayload.payment_type === "pledge") {
    await applyPaymentToPledge(
      conn,
      normalizedPayload,
      payment,
      invoice,
      receipt
    );
  }

  return {
    payment: {
      ...payment,
      payment_type: normalizedPayload.payment_type,
      method: normalizedPayload.method,
      provider: normalizedPayload.provider,
      amount: normalizedPayload.amount,
      member_no: normalizedPayload.member_no,
      full_name_snapshot: normalizedPayload.full_name,
      email_snapshot: normalizedPayload.email,
      plan_name: normalizedPayload.plan_name || null,
      coverage_label: normalizedPayload.coverage_label || null,
      coverage_months_json: normalizedPayload.coverage_months_json || null,
    },

    payment_id: payment.id,
    payment_number: payment.payment_number,

    invoice,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,

    receipt,
    receipt_id: receipt.id,
    receipt_number: receipt.receipt_number,

    should_send_receipt_email:
      normalizedPayload.send_receipt_email !== false &&
      Boolean(normalizedPayload.email) &&
      Boolean(receipt?.id),

    receipt_email: normalizedPayload.email || null,

    should_send_invoice_email:
      normalizedPayload.send_invoice_email !== false &&
      Boolean(normalizedPayload.email) &&
      Boolean(invoice?.id),

    invoice_email: normalizedPayload.email || null,

    member: {
      id: normalizedPayload.member_id || null,
      member_no: normalizedPayload.member_no || null,
      full_name: normalizedPayload.full_name || null,
      email: normalizedPayload.email || null,
      phone: normalizedPayload.phone || null,
    },

    user: {
      id: normalizedPayload.user_id || null,
      username: normalizedPayload.username || null,
    },

    normalized: normalizedPayload,
  };
}

/* -------------------------------------------------------------------------- */
/* Post-Commit Emails                                                         */
/* -------------------------------------------------------------------------- */

async function sendPaymentEmails(result = {}) {
  if (
    result?.should_send_receipt_email &&
    result?.receipt?.id &&
    result?.receipt_email
  ) {
    await sendReceiptEmail(result.receipt.id, {
      email: result.receipt_email,
      to: result.receipt_email,
      source: "payment_service",
    }).catch((err) => {
      console.error("sendReceiptEmail failed:", err.message);
    });
  }

  if (
    result?.should_send_invoice_email &&
    result?.invoice?.id &&
    result?.invoice_email
  ) {
    await sendInvoiceEmail(result.invoice.id, {
      email: result.invoice_email,
      to: result.invoice_email,
      source: "payment_service",
    }).catch((err) => {
      console.error("sendInvoiceEmail failed:", err.message);
    });
  }

  return {
    success: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Public Create / Complete                                                   */
/* -------------------------------------------------------------------------- */

async function createPayment(payload = {}) {
  const conn = await pool.getConnection();
  let result;

  try {
    await conn.beginTransaction();

    result = await processSuccessfulPayment(conn, payload);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await sendPaymentEmails(result);

  return result;
}

async function completePayment(payload = {}) {
  return createPayment(payload);
}

/* -------------------------------------------------------------------------- */
/* List / Detail / Status Actions                                             */
/* -------------------------------------------------------------------------- */

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
    where.push("DATE(COALESCE(p.paid_at, p.created_at)) >= ?");
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push("DATE(COALESCE(p.paid_at, p.created_at)) <= ?");
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
        OR p.transaction_reference LIKE ?
      )
    `);

    const s = `%${clean(filters.search)}%`;
    params.push(s, s, s, s, s, s);
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
      COALESCE(SUM(CASE WHEN p.payment_type = 'membership' OR p.category = 'membership' THEN p.amount ELSE 0 END), 0) AS membership_amount,
      COALESCE(SUM(CASE WHEN p.payment_type = 'donation' OR p.category = 'donation' THEN p.amount ELSE 0 END), 0) AS donation_amount,
      COALESCE(SUM(CASE WHEN p.payment_type IN ('school','trip') OR p.category IN ('school','trip') THEN p.amount ELSE 0 END), 0) AS program_amount,
      COALESCE(SUM(CASE WHEN p.payment_type = 'pledge' OR p.category = 'pledge' THEN p.amount ELSE 0 END), 0) AS pledge_amount
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
      COALESCE(SUM(CASE WHEN category = 'pledge' OR payment_type = 'pledge' THEN amount ELSE 0 END), 0) AS pledge_amount,
      COALESCE(SUM(CASE WHEN provider = 'stripe' OR payment_provider = 'stripe' THEN amount ELSE 0 END), 0) AS stripe_amount,
      COALESCE(SUM(CASE WHEN method = 'cash' OR payment_method = 'cash' THEN amount ELSE 0 END), 0) AS cash_amount,
      COALESCE(SUM(CASE WHEN method = 'check' OR payment_method = 'check' THEN amount ELSE 0 END), 0) AS check_amount,
      COALESCE(SUM(CASE WHEN method = 'zelle' OR payment_method = 'zelle' THEN amount ELSE 0 END), 0) AS zelle_amount,
      COALESCE(SUM(CASE WHEN reconciliation_status = 'reconciled' THEN 1 ELSE 0 END), 0) AS reconciled_count,
      COALESCE(SUM(CASE WHEN reconciliation_status IS NULL OR reconciliation_status != 'reconciled' THEN 1 ELSE 0 END), 0) AS unreconciled_count
    FROM tbl_finance_payments
    `,
    []
  );
}

/* -------------------------------------------------------------------------- */
/* Stripe Session Conversion                                                  */
/* -------------------------------------------------------------------------- */

function amountFromSession(session) {
  return asMoney(Number(session.amount_total || 0) / 100);
}

function getSessionMetadata(session) {
  const piMetadata =
    typeof session.payment_intent === "object" &&
    session.payment_intent?.metadata
      ? session.payment_intent.metadata
      : {};

  const subscriptionMetadata =
    typeof session.subscription === "object" &&
    session.subscription?.metadata
      ? session.subscription.metadata
      : {};

  return {
    ...subscriptionMetadata,
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

function getSessionSubscriptionId(session) {
  if (!session?.subscription) return null;

  return typeof session.subscription === "string"
    ? session.subscription
    : session.subscription.id || null;
}

function detectStripeMethod(session, metadata = {}) {
  const explicit = normalizeMethod(
    metadata.method ||
      metadata.payment_method ||
      metadata.provider_method ||
      ""
  );

  if (["card", "ach"].includes(explicit)) return explicit;

  if (
    Array.isArray(session.payment_method_types) &&
    session.payment_method_types.includes("us_bank_account")
  ) {
    return "ach";
  }

  return "card";
}

function sessionToPayload(session, event, card = {}) {
  const md = getSessionMetadata(session);
  const paymentType = normalizeType(
    md.payment_type ||
      md.payment_kind ||
      md.category ||
      md.type ||
      "other"
  );

  const method = detectStripeMethod(session, md);
  const amount = amountFromSession(session);

  return {
    stripe_event_id: event?.id || null,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: getSessionPaymentIntentId(session),
    stripe_subscription_id: getSessionSubscriptionId(session),
    stripe_customer_id:
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id || null,

    ...card,

    payment_type: paymentType,
    category: md.category || paymentType,

    sub_category:
      md.sub_category ||
      md.donation_category ||
      md.purpose ||
      md.plan_name ||
      md.program_name ||
      null,

    donation_category: md.donation_category || null,

    source: md.source || null,
    created_from: md.created_from || md.source || null,

    invoice_id: Number(md.invoice_id || 0) || null,
    invoice_number: md.invoice_number || md.invoice_no || null,

    pledge_id: Number(md.pledge_id || 0) || null,
    pledge_number: md.pledge_number || null,
    campaign_id: Number(md.campaign_id || 0) || null,
    campaign_name: md.campaign_name || null,

    payer_type:
      md.payer_type ||
      (Number(md.member_id || 0) ? "member" : "non_member"),

    registration_id: Number(md.registration_id || 0) || null,
    user_id: Number(md.user_id || 0) || null,
    member_id: Number(md.member_id || 0) || null,
    member_no: md.member_no || null,

    username: md.username || md.generated_username || null,

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

    amount,
    total_amount:
      Number(md.total_amount || 0) ||
      Number(md.amount || 0) ||
      amount,

    subtotal_amount: Number(md.subtotal_amount || md.base_amount || 0),
    membership_amount: Number(md.membership_amount || md.base_amount || 0),
    registration_fee: Number(md.registration_fee || 0),
    processing_fee: Number(md.processing_fee || 0),

    quantity: Number(md.quantity || 1) || 1,

    plan_id: Number(md.plan_id || md.dues_plan_id || 0) || null,
    dues_plan_id: Number(md.dues_plan_id || md.plan_id || 0) || null,
    membership_plan_id: Number(md.membership_plan_id || md.plan_id || 0) || null,

    plan_name: md.plan_name || null,

    duration_months: Number(md.duration_months || md.months_paid || 0) || 0,
    months_paid: Number(md.months_paid || md.duration_months || 0) || 0,

    coverage_year: Number(md.coverage_year || 0) || null,
    coverage_start_month: md.coverage_start_month || null,
    coverage_end_month: md.coverage_end_month || null,
    coverage_label: md.coverage_label || null,
    coverage_months_json: md.coverage_months_json || null,

    membership_start_date: md.membership_start_date || md.member_start_date || null,
    member_start_date: md.member_start_date || md.membership_start_date || null,

    related_entity_id:
      Number(md.related_entity_id || md.news_event_id || md.program_id || 0) ||
      null,

    related_entity_type: md.related_entity_type || "news_event",

    news_event_id: Number(md.news_event_id || md.program_id || 0) || null,
    program_id: Number(md.program_id || md.news_event_id || 0) || null,
    program_name: md.program_name || md.program_title || null,
    program_title: md.program_title || md.program_name || null,

    pricing_tier_id: Number(md.pricing_tier_id || 0) || null,
    pricing_tier_label: md.pricing_tier_label || null,

    participants:
      parseJson(md.participants_json, []).length
        ? parseJson(md.participants_json, [])
        : parseJson(md.participants, []),

    participants_json: md.participants_json || md.participants || null,

    note: md.note || null,
    notes: md.note || null,

    method,
    payment_method: method,
    provider: "stripe",
    payment_provider: "stripe",

    status: "paid",
    payment_status: "paid",

    send_receipt_email: boolFlag(md.send_receipt_email, true),
    send_invoice_email: boolFlag(
      md.send_invoice_email,
      md.source === "public_invoice" ? false : true
    ),
    send_welcome_email: boolFlag(md.send_welcome_email, false),
  };
}

/* -------------------------------------------------------------------------- */
/* Exports                                                                    */
/* -------------------------------------------------------------------------- */

module.exports = {
  retrieveCardSummary,

  processSuccessfulPayment,
  createPayment,
  completePayment,
  sendPaymentEmails,

  sessionToPayload,

  listPayments,
  getPaymentById,
  refundPayment,
  reversePayment,
  reconcilePayment,
  unreconcilePayment,
  getPaymentStats,

  normalizePaymentPayload,
};