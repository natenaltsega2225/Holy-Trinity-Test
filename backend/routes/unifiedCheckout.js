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

const MAX_STRIPE_METADATA_KEYS = 49;
const MAX_STRIPE_METADATA_VALUE_LENGTH = 500;

let invoicePublicAccessService = {};

try {
  invoicePublicAccessService = require(
    "../services/domains/invoices/invoicePublicAccessService"
  );
} catch {
  invoicePublicAccessService = {};
}

/* -------------------------------------------------------------------------- */
/* Basic Helpers                                                              */
/* -------------------------------------------------------------------------- */

function clean(value, max = 255) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function cents(value) {
  return Math.round(money(value) * 100);
}

function boolFlag(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "y", "on"].includes(
    String(value).trim().toLowerCase()
  );
}

function frontendUrl() {
  return String(
    process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      process.env.APP_URL ||
      "http://localhost:5173"
  ).replace(/\/+$/, "");
}

function jwtSecret() {
  return process.env.JWT_SECRET || "dev_secret";
}

function checkoutError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
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

function normalizeSource(value) {
  const source = clean(value || "", 60).toLowerCase();

  if (["finance", "finance_dashboard", "admin_finance"].includes(source)) {
    return "finance";
  }

  if (
    [
      "finance_registration",
      "finance_new_member_registration",
      "new_member_registration",
    ].includes(source)
  ) {
    return "finance_registration";
  }

  if (
    ["member", "member_portal", "membership_portal", "account"].includes(source)
  ) {
    return "member";
  }

  if (["public_invoice", "invoice_link"].includes(source)) {
    return "public_invoice";
  }

  if (["public", "guest", "website"].includes(source)) {
    return "public";
  }

  return source || "public";
}

function normalizePayerType(value) {
  const payerType = clean(value || "member", 40).toLowerCase();

  if (
    ["guest", "non_member", "non-member", "visitor", "donor"].includes(
      payerType
    )
  ) {
    return "non_member";
  }

  return "member";
}

function normalizeType(value) {
  const s = clean(value, 80).toLowerCase();

  if (["membership", "dues", "member_dues", "membership_dues"].includes(s)) {
    return "membership";
  }

  if (
    [
      "donation",
      "giving",
      "donate",
      "sunday_collection",
      "sunday_cash_collection",
      "tithe",
    ].includes(s)
  ) {
    return "donation";
  }

  if (["school", "kids", "kids_school", "school_program"].includes(s)) {
    return "school";
  }

  if (["trip", "travel"].includes(s)) return "trip";
  if (["pledge", "pledge_payment"].includes(s)) return "pledge";

  if (["invoice", "public_invoice", "invoice_payment"].includes(s)) {
    return "invoice";
  }

  return "";
}

function normalizePaymentMethod(value) {
  const s = clean(value, 40).toLowerCase();

  if (
    ["ach", "bank", "bank_transfer", "us_bank_account", "stripe_ach"].includes(
      s
    )
  ) {
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

function frequencyToStripeInterval(frequency) {
  const f = clean(frequency || "monthly").toLowerCase();

  if (f === "weekly") return { interval: "week", interval_count: 1 };
  if (f === "quarterly") return { interval: "month", interval_count: 3 };
  if (f === "annual" || f === "yearly") {
    return { interval: "year", interval_count: 1 };
  }

  return { interval: "month", interval_count: 1 };
}

function defaultSuccessUrl(type, source) {
  if (source === "finance" || source === "finance_registration") {
    return `${frontendUrl()}/dash/finance/payments?status=success&session_id={CHECKOUT_SESSION_ID}`;
  }

  if (source === "public_invoice" || type === "invoice") {
    return `${frontendUrl()}/invoice/payment-success?session_id={CHECKOUT_SESSION_ID}`;
  }

  if (type === "membership" || type === "pledge") {
    return `${frontendUrl()}/dash/membership/my-payments/history?status=success&session_id={CHECKOUT_SESSION_ID}`;
  }

  return `${frontendUrl()}/payments/success?type=${type}&session_id={CHECKOUT_SESSION_ID}`;
}

function defaultCancelUrl(type, source) {
  if (source === "finance" || source === "finance_registration") {
    return `${frontendUrl()}/dash/finance/payments?status=cancel&type=${type}`;
  }

  if (source === "public_invoice" || type === "invoice") {
    return `${frontendUrl()}/invoice/payment-cancelled?type=${type}`;
  }

  if (type === "membership") {
    return `${frontendUrl()}/dash/membership/my-payments/make-payment?status=cancel&type=${type}`;
  }

  return `${frontendUrl()}/payments/cancel?type=${type}`;
}

function safeReturnUrl(value, fallback) {
  const raw = clean(value, 1000);
  if (!raw) return fallback;

  try {
    const parsed = new URL(
      raw.replace("{CHECKOUT_SESSION_ID}", "test_session")
    );

    const allowed = new URL(frontendUrl());

    if (
      parsed.origin === allowed.origin ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1"
    ) {
      return raw;
    }
  } catch {
    return fallback;
  }

  return fallback;
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

function shortMonth(n) {
  return monthName(n).slice(0, 3);
}

function padMonth(n) {
  return String(Number(n)).padStart(2, "0");
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value, 255));
}

function safeJson(value, fallback = "[]") {
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

function parseArray(value, fallback = []) {
  try {
    if (!value) return fallback;
    if (Array.isArray(value)) return value;

    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/* -------------------------------------------------------------------------- */
/* Schema Helpers                                                             */
/* -------------------------------------------------------------------------- */

const columnCache = new Map();

async function tableExists(tableName) {
  const [rows] = await pool.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function tableColumns(tableName) {
  if (columnCache.has(tableName)) return columnCache.get(tableName);

  if (!(await tableExists(tableName))) {
    const empty = new Set();
    columnCache.set(tableName, empty);
    return empty;
  }

  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const cols = new Set(rows.map((row) => row.Field));

  columnCache.set(tableName, cols);

  return cols;
}

/* -------------------------------------------------------------------------- */
/* Coverage                                                                   */
/* -------------------------------------------------------------------------- */

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

  let coverageYear = Number(req.body.coverage_year || 0) || now.getFullYear();
  let startMonth = Number(rawStart || 0);
  let endYear = coverageYear;
  let endMonth = Number(rawEnd || 0);

  if (/^\d{4}-\d{1,2}$/.test(String(rawStart))) {
    const [y, m] = String(rawStart).split("-").map(Number);
    coverageYear = y;
    startMonth = m;
  }

  if (/^\d{4}-\d{1,2}$/.test(String(rawEnd))) {
    const [y, m] = String(rawEnd).split("-").map(Number);
    endYear = y;
    endMonth = m;
  }

  if (!startMonth) startMonth = now.getMonth() + 1;

  if (!endMonth) {
    const end = new Date(
      coverageYear,
      startMonth - 1 + Number(durationMonths || 1) - 1,
      1
    );

    endYear = end.getFullYear();
    endMonth = end.getMonth() + 1;
  }

  startMonth = Math.max(1, Math.min(12, Number(startMonth)));
  endMonth = Math.max(1, Math.min(12, Number(endMonth)));

  const coverageMonths = [];
  let cursor = new Date(coverageYear, startMonth - 1, 1);
  const endCursor = new Date(endYear, endMonth - 1, 1);

  while (cursor <= endCursor && coverageMonths.length < 36) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;

    coverageMonths.push({
      y,
      m,
      year: y,
      month: m,
      month_number: m,
      label: `${shortMonth(m)} ${y}`,
    });

    cursor = new Date(y, m, 1);
  }

  const first = coverageMonths[0];
  const last = coverageMonths[coverageMonths.length - 1];

  return {
    coverage_year: first ? String(first.y) : String(coverageYear),
    coverage_start_month: first ? `${first.y}-${padMonth(first.m)}` : "",
    coverage_end_month: last ? `${last.y}-${padMonth(last.m)}` : "",
    coverage_label:
      first && last
        ? `${monthName(first.m)} ${first.y} - ${monthName(last.m)} ${last.y}`
        : "",
    duration_months: String(coverageMonths.length || durationMonths || 1),
    months_paid: String(coverageMonths.length || durationMonths || 1),
    coverage_months_json: JSON.stringify(coverageMonths).slice(
      0,
      MAX_STRIPE_METADATA_VALUE_LENGTH
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Data Lookups                                                               */
/* -------------------------------------------------------------------------- */

async function getMemberByUserId(userId) {
  const id = toId(userId);
  if (!id) return null;

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
      m.phone,
      m.status,
      m.membership_status

    FROM tbl_users u

    LEFT JOIN tbl_members m
      ON m.id = u.member_id

    WHERE u.id = ?
    LIMIT 1
    `,
    [id]
  );

  return row?.member_id ? row : null;
}

async function getMemberById(memberId) {
  const id = toId(memberId);
  if (!id) return null;

  const [[row]] = await pool.query(
    `
    SELECT
      m.id AS member_id,
      m.member_no,
      m.full_name,
      m.email,
      m.phone,
      m.status,
      m.membership_status,

      u.id AS user_id,
      u.username

    FROM tbl_members m

    LEFT JOIN tbl_users u
      ON u.member_id = m.id

    WHERE m.id = ?
    LIMIT 1
    `,
    [id]
  );

  return row || null;
}

async function getMemberByNo(memberNo) {
  const value = clean(memberNo, 80);
  if (!value) return null;

  const [[row]] = await pool.query(
    `
    SELECT
      m.id AS member_id,
      m.member_no,
      m.full_name,
      m.email,
      m.phone,
      m.status,
      m.membership_status,

      u.id AS user_id,
      u.username

    FROM tbl_members m

    LEFT JOIN tbl_users u
      ON u.member_id = m.id

    WHERE m.member_no = ?
    LIMIT 1
    `,
    [value]
  );

  return row || null;
}

async function getMemberFromRequestBody(body = {}) {
  const memberId =
    toId(body.member_id) ||
    toId(body.memberId) ||
    toId(body.selected_member_id) ||
    toId(body.selectedMemberId);

  const memberNo = clean(
    body.member_no ||
      body.memberNo ||
      body.member_number ||
      body.memberNumber ||
      "",
    80
  );

  const byId = memberId ? await getMemberById(memberId) : null;
  const byNo = memberNo ? await getMemberByNo(memberNo) : null;

  if (memberNo && !byNo) {
    throw checkoutError(`Selected member number was not found: ${memberNo}`, 400);
  }

  if (memberId && !byId) {
    throw checkoutError(`Selected member id was not found: ${memberId}`, 400);
  }

  if (byId && byNo && Number(byId.member_id) !== Number(byNo.member_id)) {
    throw checkoutError(
      `Selected member mismatch. member_id=${byId.member_id}/${byId.member_no}, member_no=${byNo.member_no}.`,
      400
    );
  }

  return byNo || byId || null;
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
      price,
      amount,
      start_date,
      location

    FROM tbl_news_events

    WHERE id = ?
    LIMIT 1
    `,
    [programId]
  );

  return program || null;
}

function participantsFromBody(body = {}) {
  const rows =
    parseArray(body.participants, null) ||
    parseArray(body.participants_json, null) ||
    parseArray(body.student_names_json, []);

  return rows.filter(Boolean).slice(0, 100);
}

function participantCountFromBody(body = {}) {
  const participants = participantsFromBody(body);

  return Math.max(
    1,
    Number(
      body.quantity ||
        body.participant_count ||
        body.student_count ||
        participants.length ||
        1
    )
  );
}

function tierAmount(tier = {}) {
  return money(
    tier.total_amount ||
      tier.amount ||
      tier.price ||
      tier.tier_price ||
      tier.price_amount ||
      0
  );
}

function tierLabel(tier = {}, quantity = null) {
  return clean(
    tier.label ||
      tier.tier_label ||
      tier.name ||
      tier.title ||
      (quantity ? `${quantity} participant(s)` : "Program pricing tier"),
    120
  );
}

async function resolveProgramPricingTier(type, req, program, quantity) {
  if (!["school", "trip"].includes(type)) return null;

  const tableName = "tbl_program_pricing_tiers";

  if (!(await tableExists(tableName))) return null;

  const cols = await tableColumns(tableName);
  const explicitId = Number(req.body.pricing_tier_id || 0);

  if (explicitId) {
    const [rows] = await pool.query(
      `
      SELECT *
      FROM tbl_program_pricing_tiers
      WHERE id = ?
      LIMIT 1
      `,
      [explicitId]
    );

    if (rows[0]) {
      return {
        ...rows[0],
        id: rows[0].id,
        amount: tierAmount(rows[0]),
        label: tierLabel(rows[0], quantity),
        source: "explicit",
      };
    }
  }

  const where = [];
  const params = [];

  if (program?.id) {
    const programParts = [];

    if (cols.has("program_id")) {
      programParts.push("program_id = ?");
      params.push(program.id);
    }

    if (cols.has("news_event_id")) {
      programParts.push("news_event_id = ?");
      params.push(program.id);
    }

    if (cols.has("event_id")) {
      programParts.push("event_id = ?");
      params.push(program.id);
    }

    if (programParts.length) {
      where.push(`(${programParts.join(" OR ")})`);
    }
  }

  if (cols.has("program_type")) {
    where.push("(program_type = ? OR program_type IS NULL OR program_type = '')");
    params.push(type);
  }

  if (cols.has("category")) {
    where.push("(category = ? OR category IS NULL OR category = '')");
    params.push(type);
  }

  if (cols.has("is_active")) {
    where.push("(is_active = 1 OR is_active IS NULL)");
  }

  if (cols.has("status")) {
    where.push("(status IN ('active', 'published') OR status IS NULL)");
  }

  if (cols.has("min_participants")) {
    where.push("(min_participants IS NULL OR min_participants <= ?)");
    params.push(quantity);
  }

  if (cols.has("max_participants")) {
    where.push("(max_participants IS NULL OR max_participants >= ?)");
    params.push(quantity);
  }

  if (!where.length) return null;

  const [rows] = await pool.query(
    `
    SELECT *
    FROM tbl_program_pricing_tiers
    WHERE ${where.join(" AND ")}
    ORDER BY
      COALESCE(min_participants, 0) DESC,
      COALESCE(max_participants, 999999) ASC,
      id ASC
    LIMIT 1
    `,
    params
  );

  if (!rows[0]) return null;

  return {
    ...rows[0],
    id: rows[0].id,
    amount: tierAmount(rows[0]),
    label: tierLabel(rows[0], quantity),
    source: "auto",
  };
}

async function resolvePledge(req) {
  const pledgeId = Number(req.body.pledge_id || 0);
  if (!pledgeId) return null;

  const [[pledge]] = await pool.query(
    `
    SELECT
      p.*,
      c.title AS campaign_title,
      c.name AS campaign_name_fallback

    FROM tbl_finance_pledges p

    LEFT JOIN tbl_finance_campaigns c
      ON c.id = p.campaign_id

    WHERE p.id = ?
    LIMIT 1
    `,
    [pledgeId]
  );

  return pledge || null;
}

async function resolveInvoice(req) {
  const invoiceId = Number(req.body.invoice_id || 0) || null;
  const invoiceNumber = clean(req.body.invoice_number || "", 120);

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

  const [rows] = await pool.query(
    `
    SELECT
      i.*,

      m.member_no AS linked_member_no,
      m.full_name AS linked_member_name,
      m.email AS linked_member_email,
      m.phone AS linked_member_phone,

      u.id AS linked_user_id,
      u.username AS linked_username

    FROM tbl_finance_invoices i

    LEFT JOIN tbl_members m
      ON m.id = i.member_id

    LEFT JOIN tbl_users u
      ON u.member_id = m.id

    WHERE ${where.join(" OR ")}

    ORDER BY i.id DESC
    LIMIT 1
    `,
    params
  );

  return rows[0] || null;
}

async function resolvePledgeMember(pledge) {
  if (!pledge?.member_id) return null;
  return getMemberById(pledge.member_id);
}

async function resolveInvoiceMember(invoice) {
  if (!invoice?.member_id) return null;
  return getMemberById(invoice.member_id);
}

/* -------------------------------------------------------------------------- */
/* Public Invoice Token                                                       */
/* -------------------------------------------------------------------------- */

async function assertPublicInvoiceAccess(req, invoice) {
  if (!invoice) return;

  if (req.user) return;

  const source = normalizeSource(
    req.body.source ||
      req.body.created_from ||
      "public_invoice"
  );

  if (source !== "public_invoice") return;

  const token = clean(
    req.body.public_token ||
      req.body.token ||
      req.query.public_token ||
      req.query.token ||
      "",
    2000
  );

  if (!token) {
    throw checkoutError("Public invoice payment token is required.", 403);
  }

  if (
    typeof invoicePublicAccessService.assertPublicInvoiceAccess === "function"
  ) {
    await invoicePublicAccessService.assertPublicInvoiceAccess({
      token,
      invoice,
      scope: "pay",
      req,
    });

    return;
  }

  if (
    typeof invoicePublicAccessService.verifyPublicInvoiceToken === "function"
  ) {
    const verified = invoicePublicAccessService.verifyPublicInvoiceToken(
      token,
      {
        scope: "pay",
        invoice_number: invoice.invoice_number,
        invoice_id: invoice.id,
      }
    );

    if (!verified) {
      throw checkoutError("Invalid or expired public invoice token.", 403);
    }

    return;
  }

  if (typeof invoicePublicAccessService.verifyToken === "function") {
    const verified = invoicePublicAccessService.verifyToken(token, {
      scope: "pay",
      invoice_number: invoice.invoice_number,
      invoice_id: invoice.id,
    });

    if (!verified) {
      throw checkoutError("Invalid or expired public invoice token.", 403);
    }

    return;
  }

  throw checkoutError("Public invoice access service is not available.", 500);
}

/* -------------------------------------------------------------------------- */
/* Payer Resolution                                                           */
/* -------------------------------------------------------------------------- */

async function resolveCheckoutPayer(req, type, pledge, invoice) {
  const source = normalizeSource(
    req.body.source ||
      req.body.created_from ||
      (invoice ? "public_invoice" : req.user ? "member" : "public")
  );

  const payerType = normalizePayerType(
    req.body.payer_type ||
      req.body.payerType ||
      invoice?.payer_type ||
      (invoice?.member_id ? "member" : "non_member")
  );

  if (payerType === "non_member") {
    if (type === "membership") {
      throw checkoutError("Membership checkout requires a selected member.", 400);
    }

    return {
      source,
      payer_type: "non_member",
      member: null,
      member_source: invoice ? "invoice_non_member" : "guest",
    };
  }

  const tokenUserId =
    toId(req.user?.id) ||
    toId(req.user?.user_id) ||
    toId(req.userId);

  const tokenMember = tokenUserId ? await getMemberByUserId(tokenUserId) : null;
  const bodyMember = await getMemberFromRequestBody(req.body || {});
  const pledgeMember = await resolvePledgeMember(pledge);
  const invoiceMember = await resolveInvoiceMember(invoice);

  if (source === "finance" || source === "finance_registration") {
    const member = bodyMember || invoiceMember || pledgeMember || null;

    if (type === "membership" && !member) {
      throw checkoutError("Finance membership checkout requires a selected member.", 400);
    }

    return {
      source,
      payer_type: member ? "member" : "non_member",
      member,
      member_source: member
        ? bodyMember
          ? "finance_selected_member"
          : invoiceMember
            ? "finance_invoice_member"
            : "finance_pledge_member"
        : "finance_guest",
    };
  }

  if (
    tokenMember &&
    bodyMember &&
    Number(tokenMember.member_id) !== Number(bodyMember.member_id)
  ) {
    throw checkoutError(
      "Member checkout cannot pay under another member profile.",
      403
    );
  }

  if (
    pledgeMember &&
    tokenMember &&
    Number(pledgeMember.member_id) !== Number(tokenMember.member_id)
  ) {
    throw checkoutError("This pledge does not belong to the logged-in member.", 403);
  }

  if (
    invoiceMember &&
    tokenMember &&
    Number(invoiceMember.member_id) !== Number(tokenMember.member_id)
  ) {
    throw checkoutError("This invoice does not belong to the logged-in member.", 403);
  }

  const member = tokenMember || bodyMember || invoiceMember || pledgeMember || null;

  if (type === "membership" && !member) {
    throw checkoutError(
      "Please log in or select a linked member before paying membership dues.",
      401
    );
  }

  return {
    source,
    payer_type: member ? "member" : "non_member",
    member,
    member_source: tokenMember
      ? "logged_in_member"
      : bodyMember
        ? "selected_member"
        : invoiceMember
          ? "invoice_member"
          : pledgeMember
            ? "pledge_member"
            : "guest",
  };
}

/* -------------------------------------------------------------------------- */
/* Amount                                                                     */
/* -------------------------------------------------------------------------- */

async function resolveAmount(type, req, plan, program, pledge, invoice, tier) {
  if (invoice) {
    const total = money(invoice.total_amount || invoice.amount || 0);
    const paid = money(invoice.paid_amount || invoice.amount_paid || 0);

    const explicitBalance = money(
      invoice.balance_due ||
        invoice.remaining_amount ||
        invoice.amount_due ||
        0
    );

    const balance =
      explicitBalance > 0
        ? explicitBalance
        : Math.max(total - paid, 0);

    const requested = money(req.body.amount || req.body.total_amount || 0);

    return requested > 0
      ? Math.min(requested, balance || requested)
      : balance;
  }

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

    if (requested > 0 && requested >= minimum) {
      return requested;
    }

    return minimum;
  }

  if (["school", "trip"].includes(type)) {
    if (tier && money(tier.amount) > 0) {
      return money(tier.amount);
    }

    const quantity = participantCountFromBody(req.body);
    const unit = money(
      program?.price_per_person ||
        program?.price ||
        program?.amount ||
        0
    );

    if (unit > 0) return money(unit * quantity);

    return money(req.body.amount || req.body.total_amount);
  }

  if (type === "pledge") {
    return money(
      req.body.upfront_amount ||
        req.body.amount ||
        req.body.total_amount ||
        pledge?.remaining_balance ||
        pledge?.balance_due ||
        pledge?.outstanding_amount ||
        0
    );
  }

  return money(req.body.amount || req.body.total_amount);
}

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

function compactSnapshotJson({
  member,
  payer,
  invoice,
  pledge,
  program,
  tier,
  participants,
  metadata,
}) {
  const snapshot = {
    payer: {
      type: payer.payer_type,
      source: payer.member_source,
      name: metadata.full_name || "",
      email: metadata.email || "",
      phone: metadata.phone || "",
    },

    member: member
      ? {
          id: metadata.member_id || "",
          no: metadata.member_no || "",
          name: metadata.full_name || "",
        }
      : null,

    invoice: invoice
      ? {
          id: metadata.invoice_id || "",
          no: metadata.invoice_number || "",
        }
      : null,

    pledge: pledge
      ? {
          id: metadata.pledge_id || "",
          no: metadata.pledge_number || "",
          campaign: metadata.campaign_name || "",
        }
      : null,

    program: program
      ? {
          id: metadata.program_id || "",
          name: metadata.program_name || "",
          registration_id: metadata.registration_id || "",
          quantity: metadata.quantity || "",
          tier: metadata.pricing_tier_label || "",
          participants: participants
            .slice(0, 5)
            .map((p) =>
              typeof p === "string"
                ? p
                : p.full_name ||
                  p.name ||
                  p.student_name ||
                  `${p.first_name || ""} ${p.last_name || ""}`.trim()
            )
            .filter(Boolean),
        }
      : null,

    pricing: tier
      ? {
          id: metadata.pricing_tier_id || "",
          label: metadata.pricing_tier_label || "",
        }
      : null,
  };

  return JSON.stringify(snapshot).slice(0, MAX_STRIPE_METADATA_VALUE_LENGTH);
}

async function buildMetadata({
  req,
  type,
  amount,
  plan,
  program,
  pledge,
  invoice,
  payer,
  tier,
  participants,
}) {
  const member = payer.member || null;
  const source = payer.source;

  const invoicePaymentType =
    invoice?.payment_type ||
    invoice?.category ||
    invoice?.invoice_type ||
    null;

  const effectiveType = invoice
    ? normalizeType(invoicePaymentType) || type
    : type;

  const fullName = clean(
    member?.full_name ||
      req.body.full_name ||
      req.body.member_name ||
      req.body.donor_name ||
      req.body.guest_name ||
      req.body.payer_name ||
      req.body.name ||
      invoice?.full_name_snapshot ||
      invoice?.payer_name ||
      invoice?.guest_name ||
      invoice?.linked_member_name ||
      pledge?.full_name_snapshot ||
      pledge?.guest_name ||
      "Guest Donor",
    180
  );

  const email = clean(
    req.body.email ||
      req.body.member_email ||
      req.body.donor_email ||
      req.body.guest_email ||
      req.body.payer_email ||
      invoice?.email_snapshot ||
      invoice?.payer_email ||
      invoice?.guest_email ||
      invoice?.linked_member_email ||
      member?.email ||
      member?.user_email ||
      pledge?.email_snapshot ||
      "",
    190
  );

  const phone = clean(
    req.body.phone ||
      req.body.member_phone ||
      req.body.donor_phone ||
      req.body.guest_phone ||
      req.body.payer_phone ||
      invoice?.phone_snapshot ||
      invoice?.payer_phone ||
      invoice?.guest_phone ||
      invoice?.linked_member_phone ||
      member?.phone ||
      pledge?.phone_snapshot ||
      "",
    50
  );

  const durationMonths =
    Number(
      req.body.duration_months ||
        req.body.months_paid ||
        plan?.duration_months ||
        1
    ) || 1;

  const planName = clean(req.body.plan_name || plan?.plan_name || "", 120);

  const coverage =
    effectiveType === "membership"
      ? calculateCoverage(durationMonths, req)
      : {
          coverage_year: clean(
            req.body.coverage_year || invoice?.coverage_year || "",
            20
          ),
          coverage_start_month: clean(
            req.body.coverage_start_month ||
              invoice?.coverage_start_month ||
              "",
            20
          ),
          coverage_end_month: clean(
            req.body.coverage_end_month ||
              invoice?.coverage_end_month ||
              "",
            20
          ),
          coverage_label: clean(
            req.body.coverage_label || invoice?.coverage_label || "",
            160
          ),
          duration_months: "",
          months_paid: "",
          coverage_months_json: "",
        };

  const programName = clean(
    program?.title ||
      req.body.program_name ||
      invoice?.program_name ||
      "",
    120
  );

  const subCategory = clean(
    req.body.sub_category ||
      req.body.donation_category ||
      invoice?.sub_category ||
      invoice?.donation_category ||
      planName ||
      programName ||
      req.body.campaign_name ||
      pledge?.campaign_name ||
      pledge?.campaign_title ||
      pledge?.campaign_name_fallback ||
      effectiveType,
    160
  );

  const pledgedAmount = money(
    req.body.pledged_amount ||
      pledge?.pledged_amount ||
      pledge?.amount ||
      invoice?.pledged_amount ||
      amount
  );

  const paidAmount = money(req.body.upfront_amount || amount);
  const remainingBalance = Math.max(pledgedAmount - paidAmount, 0);
  const baseAmount = money(amount);

  const includeRegistrationFee =
    req.body.registration_mode === "initial_registration" ||
    boolFlag(req.body.include_registration_fee) ||
    req.body.registration_fee;

  const registrationFee =
    effectiveType === "membership" && includeRegistrationFee
      ? money(plan?.registration_fee || req.body.registration_fee || 0)
      : money(req.body.registration_fee || 0);

  const includeProcessingFee =
    boolFlag(req.body.cover_processing_fee) ||
    boolFlag(req.body.include_processing_fee);

  const subtotal = money(baseAmount + registrationFee);
  const fee = includeProcessingFee ? processingFee(subtotal) : 0;
  const totalAmount = money(subtotal + fee);

  const paymentMethod = normalizePaymentMethod(
    req.body.payment_method ||
      req.body.paymentMethod ||
      req.body.method
  );

  const quantity =
    ["school", "trip"].includes(effectiveType)
      ? participantCountFromBody(req.body)
      : 1;

  const registrationId = clean(
    req.body.registration_id ||
      req.body.program_registration_id ||
      invoice?.registration_id ||
      "",
    40
  );

  const userId =
    req.body.user_id ||
    req.body.member_user_id ||
    member?.user_id ||
    invoice?.linked_user_id ||
    (source === "member" ? req.user?.id : "") ||
    "";

  const metadata = {
    v: "3",

    payment_type: effectiveType,
    sub_category: subCategory,

    source,
    payer_type: payer.payer_type,
    member_source: payer.member_source,

    user_id: clean(userId, 40),
    member_id: member?.member_id
      ? String(member.member_id)
      : clean(invoice?.member_id || "", 40),
    member_no:
      member?.member_no ||
      invoice?.member_no ||
      invoice?.linked_member_no ||
      clean(req.body.member_no || "", 80),

    full_name: fullName,
    email,
    phone,

    invoice_id: clean(req.body.invoice_id || invoice?.id || "", 40),
    invoice_number: clean(
      req.body.invoice_number || invoice?.invoice_number || "",
      120
    ),

    pledge_id: clean(
      req.body.pledge_id ||
        pledge?.id ||
        invoice?.pledge_id ||
        "",
      40
    ),
    pledge_number: clean(
      req.body.pledge_number ||
        pledge?.pledge_number ||
        invoice?.pledge_number ||
        "",
      120
    ),
    campaign_id: clean(
      req.body.campaign_id ||
        pledge?.campaign_id ||
        invoice?.campaign_id ||
        "",
      40
    ),
    campaign_name: clean(
      req.body.campaign_name ||
        pledge?.campaign_name ||
        pledge?.campaign_title ||
        pledge?.campaign_name_fallback ||
        invoice?.campaign_name ||
        "",
      160
    ),

    amount: String(totalAmount),
    total_amount: String(totalAmount),
    base_amount: String(baseAmount),
    registration_fee: String(registrationFee),
    processing_fee: String(fee),

    payment_method: paymentMethod,

    plan_id: clean(req.body.plan_id || req.body.dues_plan_id || "", 40),
    plan_name: planName || "",

    months_paid: coverage.months_paid || String(durationMonths),
    coverage_year: coverage.coverage_year,
    coverage_start_month: coverage.coverage_start_month,
    coverage_end_month: coverage.coverage_end_month,
    coverage_label: coverage.coverage_label,

    related_entity_id: clean(
      req.body.related_entity_id ||
        req.body.news_event_id ||
        req.body.program_id ||
        program?.id ||
        invoice?.related_entity_id ||
        "",
      40
    ),
    program_id: clean(
      req.body.program_id ||
        req.body.news_event_id ||
        program?.id ||
        invoice?.program_id ||
        "",
      40
    ),
    program_name: programName || subCategory,

    registration_id: registrationId,

    pricing_tier_id: clean(
      req.body.pricing_tier_id ||
        tier?.id ||
        invoice?.pricing_tier_id ||
        "",
      40
    ),
    pricing_tier_label: clean(
      req.body.pricing_tier_label ||
        tier?.label ||
        invoice?.pricing_tier_label ||
        "",
      120
    ),

    quantity: String(quantity),

    participants_json: safeJson(participants, "[]").slice(
      0,
      MAX_STRIPE_METADATA_VALUE_LENGTH
    ),

    donation_category:
      effectiveType === "donation"
        ? clean(
            req.body.donation_category ||
              invoice?.donation_category ||
              subCategory,
            120
          )
        : "",

    pledged_amount: effectiveType === "pledge" ? String(pledgedAmount) : "",
    upfront_amount: effectiveType === "pledge" ? String(paidAmount) : "",
    remaining_balance:
      effectiveType === "pledge" ? String(remainingBalance) : "",

    send_receipt_email:
      req.body.send_receipt_email === false ? "false" : "true",

    send_invoice_email:
      req.body.send_invoice_email === false ? "false" : "true",

    send_welcome_email:
      req.body.send_welcome_email === true ||
      boolFlag(req.body.send_welcome_email)
        ? "true"
        : "false",
  };

  metadata.snapshot_json = compactSnapshotJson({
    member,
    payer,
    invoice,
    pledge,
    program,
    tier,
    participants,
    metadata,
  });

  return metadata;
}

const STRIPE_METADATA_KEYS = [
  "v",
  "payment_type",
  "sub_category",
  "source",
  "payer_type",
  "member_source",
  "user_id",
  "member_id",
  "member_no",
  "full_name",
  "email",
  "phone",
  "invoice_id",
  "invoice_number",
  "pledge_id",
  "pledge_number",
  "campaign_id",
  "campaign_name",
  "amount",
  "total_amount",
  "base_amount",
  "registration_fee",
  "processing_fee",
  "payment_method",
  "plan_id",
  "plan_name",
  "months_paid",
  "coverage_year",
  "coverage_start_month",
  "coverage_end_month",
  "coverage_label",
  "related_entity_id",
  "program_id",
  "program_name",
  "registration_id",
  "pricing_tier_id",
  "pricing_tier_label",
  "quantity",
  "participants_json",
  "donation_category",
  "pledged_amount",
  "upfront_amount",
  "remaining_balance",
  "snapshot_json",
  "send_receipt_email",
  "send_invoice_email",
  "send_welcome_email",
];

function stripeMetadataValue(value) {
  if (value === undefined || value === null) return null;

  let text =
    typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

  text = text.trim();

  if (!text) return null;

  return text.slice(0, MAX_STRIPE_METADATA_VALUE_LENGTH);
}

function compactStripeMetadata(metadata = {}) {
  const compact = {};

  for (const key of STRIPE_METADATA_KEYS) {
    if (Object.keys(compact).length >= MAX_STRIPE_METADATA_KEYS) break;

    const value = stripeMetadataValue(metadata[key]);

    if (value !== null) {
      compact[key] = value;
    }
  }

  return compact;
}

/* -------------------------------------------------------------------------- */
/* Stripe Line Items                                                          */
/* -------------------------------------------------------------------------- */

function buildLineItems(metadata, type) {
  const lineItems = [];

  const baseAmount = money(metadata.base_amount);
  const registrationFee = money(metadata.registration_fee);
  const processing = money(metadata.processing_fee);
  const quantity = Math.max(1, Number(metadata.quantity || 1));

  const itemName = clean(
    metadata.invoice_number
      ? `Invoice ${metadata.invoice_number}`
      : metadata.plan_name ||
          metadata.program_name ||
          metadata.donation_category ||
          metadata.sub_category ||
          type,
    120
  );

  if (registrationFee > 0) {
    lineItems.push({
      recurring_eligible: false,
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
      recurring_eligible: true,
      quantity,
      price_data: {
        currency: "usd",
        unit_amount: cents(baseAmount / quantity),
        product_data: {
          name: itemName,
        },
      },
    });
  }

  if (processing > 0) {
    lineItems.push({
      recurring_eligible: true,
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

function finalizeLineItemsForStripe(lineItems, subscriptionMode, interval) {
  return lineItems.map((item) => {
    const recurringEligible = Boolean(item.recurring_eligible);
    const finalItem = {
      quantity: item.quantity,
      price_data: {
        ...item.price_data,
        product_data: {
          ...item.price_data.product_data,
        },
      },
    };

    if (subscriptionMode && recurringEligible) {
      finalItem.price_data.recurring = interval;
    }

    return finalItem;
  });
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "unifiedCheckout",
    version: "enterprise",
    stripe_configured: Boolean(process.env.STRIPE_SECRET_KEY),
    metadata_key_limit: MAX_STRIPE_METADATA_KEYS,
    public_invoice_access_service: Boolean(
      invoicePublicAccessService.verifyPublicInvoiceToken ||
        invoicePublicAccessService.verifyToken ||
        invoicePublicAccessService.assertPublicInvoiceAccess
    ),
    timestamp: new Date().toISOString(),
  });
});

router.post("/create-session", optionalAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        error: "Stripe secret key is not configured.",
      });
    }

    const requestedType = normalizeType(
      req.body.kind ||
        req.body.type ||
        req.body.payment_type ||
        req.body.category ||
        (req.body.invoice_id || req.body.invoice_number ? "invoice" : "")
    );

    if (!requestedType) {
      return res.status(400).json({
        error: "Invalid payment type.",
      });
    }

    const paymentMethod = normalizePaymentMethod(
      req.body.payment_method ||
        req.body.paymentMethod ||
        req.body.method
    );

    const invoice = await resolveInvoice(req);

    if (invoice) {
      await assertPublicInvoiceAccess(req, invoice);
    }

    const effectiveType = invoice
      ? normalizeType(
          invoice.payment_type ||
            invoice.category ||
            invoice.invoice_type
        ) || requestedType
      : requestedType;

    const plan =
      effectiveType === "membership"
        ? await validateMembershipPlan(req)
        : null;

    const program = await resolveProgram(effectiveType, req);
    const participants = participantsFromBody(req.body);
    const quantity = participantCountFromBody(req.body);

    const tier = await resolveProgramPricingTier(
      effectiveType,
      req,
      program,
      quantity
    );

    const pledge =
      effectiveType === "pledge" || invoice?.pledge_id
        ? await resolvePledge({
            ...req,
            body: {
              ...req.body,
              pledge_id: req.body.pledge_id || invoice?.pledge_id,
            },
          })
        : null;

    const payer = await resolveCheckoutPayer(
      req,
      effectiveType,
      pledge,
      invoice
    );

    if (effectiveType === "membership" && !plan && !invoice) {
      return res.status(400).json({
        error: "Membership plan is required or inactive.",
      });
    }

    const amount = await resolveAmount(
      effectiveType,
      req,
      plan,
      program,
      pledge,
      invoice,
      tier
    );

    if (amount <= 0) {
      return res.status(400).json({
        error: "Invalid payment amount or invoice is already paid.",
      });
    }

    const metadata = await buildMetadata({
      req,
      type: effectiveType,
      amount,
      plan,
      program,
      pledge,
      invoice,
      payer,
      tier,
      participants,
    });

    const source = metadata.source || "public";

    if (effectiveType === "membership" && !metadata.member_id) {
      return res.status(source === "finance" ? 400 : 401).json({
        error: "Membership checkout requires a linked member.",
      });
    }

    const recurring =
      boolFlag(req.body.is_recurring) ||
      boolFlag(req.body.auto_renew) ||
      boolFlag(req.body.subscription_enabled);

    const subscriptionMode =
      recurring &&
      ["membership", "donation"].includes(effectiveType) &&
      !invoice;

    const successUrl = safeReturnUrl(
      req.body.success_url,
      defaultSuccessUrl(effectiveType, source)
    );

    const cancelUrl = safeReturnUrl(
      req.body.cancel_url,
      defaultCancelUrl(effectiveType, source)
    );

    const interval = frequencyToStripeInterval(
      req.body.recurring_frequency ||
        req.body.billing_cycle
    );

    const rawLineItems = buildLineItems(metadata, effectiveType);
    const lineItems = finalizeLineItemsForStripe(
      rawLineItems,
      subscriptionMode,
      interval
    );

    if (!lineItems.length) {
      return res.status(400).json({
        error: "No payable line items were generated.",
      });
    }

    if (subscriptionMode) {
      metadata.snapshot_json = JSON.stringify({
        ...JSON.parse(metadata.snapshot_json || "{}"),
        recurring: {
          enabled: true,
          interval: interval.interval,
          interval_count: interval.interval_count,
        },
      }).slice(0, MAX_STRIPE_METADATA_VALUE_LENGTH);
    }

    const stripeMetadata = compactStripeMetadata(metadata);

    if (Object.keys(stripeMetadata).length >= 50) {
      return res.status(500).json({
        error: "Stripe metadata exceeds safe key limit.",
      });
    }

    const sessionPayload = {
      mode: subscriptionMode ? "subscription" : "payment",
      payment_method_types: stripePaymentMethods(paymentMethod),
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: validEmail(metadata.email) ? metadata.email : undefined,
      client_reference_id:
        metadata.member_id ||
        metadata.invoice_number ||
        metadata.email ||
        undefined,
      billing_address_collection: "auto",
      phone_number_collection: {
        enabled: true,
      },
      metadata: stripeMetadata,
      line_items: lineItems,
    };

    if (!subscriptionMode) {
      sessionPayload.customer_creation = "always";
      sessionPayload.payment_intent_data = {
        metadata: stripeMetadata,
        receipt_email: validEmail(metadata.email) ? metadata.email : undefined,
      };
    } else {
      sessionPayload.subscription_data = {
        metadata: stripeMetadata,
      };
    }

    if (paymentMethod === "ach") {
      sessionPayload.payment_method_options = {
        us_bank_account: {
          financial_connections: {
            permissions: ["payment_method", "balances"],
          },
        },
      };
    }

    console.log("Creating Stripe session:", {
      type: effectiveType,
      paymentMethod,
      amount: metadata.total_amount,
      email: metadata.email,
      member_no: metadata.member_no,
      member_id: metadata.member_id,
      payer_type: metadata.payer_type,
      source,
      invoice_number: metadata.invoice_number,
      pledge_id: metadata.pledge_id,
      campaign_id: metadata.campaign_id,
      registration_id: metadata.registration_id,
      pricing_tier_id: metadata.pricing_tier_id,
      mode: sessionPayload.mode,
      stripe_metadata_count: Object.keys(stripeMetadata).length,
      stripe_metadata_keys: Object.keys(stripeMetadata),
    });

    const session = await stripe.checkout.sessions.create(sessionPayload);

    return res.json({
      ok: true,
      url: session.url,
      checkout_url: session.url,
      stripe_url: session.url,
      id: session.id,
      session_id: session.id,
      mode: sessionPayload.mode,
      payment_method: paymentMethod,
      amount: metadata.total_amount,
      invoice_id: metadata.invoice_id || "",
      invoice_number: metadata.invoice_number || "",
      pledge_id: metadata.pledge_id || "",
      campaign_id: metadata.campaign_id || "",
      registration_id: metadata.registration_id || "",
      pricing_tier_id: metadata.pricing_tier_id || "",
      coverage_year: metadata.coverage_year || "",
      coverage_start_month: metadata.coverage_start_month || "",
      coverage_end_month: metadata.coverage_end_month || "",
      coverage_label: metadata.coverage_label || "",
      stripe_metadata_count: Object.keys(stripeMetadata).length,
      stripe_metadata_keys: Object.keys(stripeMetadata),
      metadata,
    });
  } catch (err) {
    console.error("Unified checkout error:", err);

    return res.status(err.statusCode || 500).json({
      error: err.message || "Failed to create checkout session.",
    });
  }
});

module.exports = router;