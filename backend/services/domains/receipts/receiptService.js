// backend/services/domains/receipts/receiptService.js
"use strict";

const db = require("../../../db");

function optionalRequire(modulePath) {
  try {
    return require(modulePath);
  } catch {
    return {};
  }
}

const paymentHelpers = optionalRequire("../../shared/paymentHelpers");
const coverageHelpers = optionalRequire("../../shared/coverageHelpers");

const donationCategoryLabel =
  paymentHelpers.donationCategoryLabel ||
  ((value) => String(value || "General Donation").replaceAll("_", " "));

const paymentCategoryLabel =
  paymentHelpers.paymentCategoryLabel ||
  ((value) => String(value || "Payment").replaceAll("_", " "));

const paymentMethodLabel =
  paymentHelpers.paymentMethodLabel ||
  ((value) => String(value || "Payment").replaceAll("_", " "));

const buildCardLabel =
  paymentHelpers.buildCardLabel ||
  ((row = {}) =>
    [row.card_brand || "Card", row.card_last4 ? `**** ${row.card_last4}` : ""]
      .filter(Boolean)
      .join(" "));

const normalizePaymentCategory =
  paymentHelpers.normalizePaymentCategory ||
  ((value) => {
    const key = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    if (key.includes("member")) return "membership";
    if (key.includes("pledge")) return "pledge";
    if (key.includes("school") || key.includes("kids")) return "school";
    if (key.includes("trip")) return "trip";
    if (key.includes("donation") || key.includes("gift")) return "donation";
    return key || "payment";
  });

const isMembershipPayment =
  paymentHelpers.isMembershipPayment ||
  ((category) => String(category || "").includes("membership"));

const isDonationPayment =
  paymentHelpers.isDonationPayment ||
  ((category) =>
    [
      "donation",
      "general_donation",
      "plate_collection",
      "candle_sale",
      "tithe",
      "vows",
      "baptism",
      "wedding_engagement",
      "memorial_service",
      "building_fund",
      "charity_fund",
      "auction",
      "sunday_cash_collection",
      "other_fund",
    ].includes(String(category || "")));

const isProgramPayment =
  paymentHelpers.isProgramPayment ||
  ((category) => ["school", "trip"].includes(String(category || "")));

const buildCoveragePayload =
  coverageHelpers.buildCoveragePayload ||
  ((row = {}) => ({
    coverage_year: row.coverage_year || null,
    coverage_start_month: row.coverage_start_month || null,
    coverage_end_month: row.coverage_end_month || null,
    months_paid: row.months_paid || null,
    coverage_months_json: row.coverage_months_json || null,
  }));

const coverageDisplay =
  coverageHelpers.coverageDisplay ||
  ((row = {}) => row.coverage_label || row.coverage_period || "");

const buildCoverageChips =
  coverageHelpers.buildCoverageChips ||
  ((row = {}) => safeJson(row.coverage_months_json, []));

const META_TTL_MS = 60 * 1000;
const metaCache = new Map();

function clean(value, max = 500) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function safeJson(value, fallback = null) {
  try {
    if (!value) return fallback;
    if (typeof value === "object") return value;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function money(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function sqlId(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(String(name || ""))) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }

  return `\`${name}\``;
}

function has(columns, column) {
  return columns && columns.has(column);
}

async function columnsFor(tableName) {
  const cached = metaCache.get(tableName);

  if (cached && Date.now() - cached.loadedAt < META_TTL_MS) {
    return cached.columns;
  }

  try {
    const [rows] = await db.query(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      `,
      [tableName]
    );

    const columns = new Set(rows.map((row) => row.COLUMN_NAME));

    metaCache.set(tableName, {
      columns,
      loadedAt: Date.now(),
    });

    return columns;
  } catch {
    const columns = new Set();

    metaCache.set(tableName, {
      columns,
      loadedAt: Date.now(),
    });

    return columns;
  }
}

async function tableExists(tableName) {
  const columns = await columnsFor(tableName);
  return columns.size > 0;
}

function firstValue(source, keys, fallback = "") {
  for (const key of keys) {
    if (
      source &&
      source[key] !== undefined &&
      source[key] !== null &&
      source[key] !== ""
    ) {
      return source[key];
    }
  }

  return fallback;
}

function col(alias, columns, column) {
  return has(columns, column) ? `${alias}.${sqlId(column)}` : null;
}

function coalesce(parts, fallbackSql = "NULL") {
  const usable = parts.filter(Boolean);
  return usable.length ? `COALESCE(${usable.join(", ")}, ${fallbackSql})` : fallbackSql;
}

function castMoney(expr) {
  return `CAST(${expr} AS DECIMAL(18,2))`;
}

function addSelect(selects, alias, columns, column, outputName) {
  if (!has(columns, column)) return;
  selects.push(`${alias}.${sqlId(column)} AS ${sqlId(outputName)}`);
}

async function receiptQueryParts() {
  const receiptTable = "tbl_finance_receipts";

  if (!(await tableExists(receiptTable))) {
    const error = new Error("Receipt table tbl_finance_receipts does not exist.");
    error.status = 500;
    throw error;
  }

  const rCols = await columnsFor(receiptTable);

  const paymentTable = (await tableExists("tbl_finance_payments"))
    ? "tbl_finance_payments"
    : null;

  const invoiceTable = (await tableExists("tbl_finance_invoices"))
    ? "tbl_finance_invoices"
    : null;

  const memberTable = (await tableExists("tbl_members"))
    ? "tbl_members"
    : null;

  const pCols = paymentTable ? await columnsFor(paymentTable) : new Set();
  const iCols = invoiceTable ? await columnsFor(invoiceTable) : new Set();
  const mCols = memberTable ? await columnsFor(memberTable) : new Set();

  const joins = [];
  const selects = ["r.*"];

  let paymentJoined = false;
  let invoiceJoined = false;
  let memberJoined = false;

  if (paymentTable && has(rCols, "payment_id") && has(pCols, "id")) {
    paymentJoined = true;

    joins.push(`
      LEFT JOIN ${sqlId(paymentTable)} p
        ON p.id = r.payment_id
    `);

    [
      "id",
      "invoice_id",
      "member_id",
      "member_no",
      "payment_number",
      "payment_type",
      "category",
      "sub_category",
      "donation_category",
      "donation_category_label",
      "full_name_snapshot",
      "email_snapshot",
      "phone_snapshot",
      "payment_method",
      "method",
      "provider",
      "payment_provider",
      "card_brand",
      "card_last4",
      "card_exp_month",
      "card_exp_year",
      "bank_last4",
      "bank_name",
      "reference_no",
      "reference_number",
      "transaction_reference",
      "stripe_payment_intent_id",
      "stripe_checkout_session_id",
      "plan_name",
      "coverage_label",
      "coverage_year",
      "coverage_from",
      "coverage_to",
      "coverage_start_month",
      "coverage_end_month",
      "coverage_months_json",
      "months_paid",
      "program_name",
      "program_title",
      "program_category",
      "participants_json",
      "participant_count",
      "pricing_tier_label",
      "campaign_id",
      "campaign_name",
      "pledge_id",
      "pledge_number",
      "pledged_amount",
      "pledge_amount",
      "paid_amount",
      "remaining_balance",
      "pledge_remaining_amount",
    ].forEach((column) => addSelect(selects, "p", pCols, column, `p_${column}`));
  }

  if (invoiceTable) {
    const invoiceJoinParts = [];

    if (has(rCols, "invoice_id") && has(iCols, "id")) {
      invoiceJoinParts.push("r.invoice_id");
    }

    if (paymentJoined && has(pCols, "invoice_id") && has(iCols, "id")) {
      invoiceJoinParts.push("p.invoice_id");
    }

    if (invoiceJoinParts.length) {
      invoiceJoined = true;

      joins.push(`
        LEFT JOIN ${sqlId(invoiceTable)} i
          ON i.id = ${coalesce(invoiceJoinParts)}
      `);

      [
        "id",
        "invoice_number",
        "invoice_no",
        "member_id",
        "member_no",
        "full_name_snapshot",
        "email_snapshot",
        "phone_snapshot",
        "payer_type",
        "invoice_type",
        "payment_type",
        "category",
        "donation_category",
        "donation_category_label",
        "plan_name",
        "coverage_label",
        "coverage_year",
        "coverage_from",
        "coverage_to",
        "coverage_start_month",
        "coverage_end_month",
        "coverage_months_json",
        "months_paid",
        "program_name",
        "program_title",
        "program_category",
        "participants_json",
        "participant_count",
        "pricing_tier_label",
        "campaign_id",
        "campaign_name",
        "pledge_id",
        "pledge_number",
        "pledged_amount",
        "pledge_amount",
        "paid_amount",
        "balance_due",
        "remaining_amount",
      ].forEach((column) => addSelect(selects, "i", iCols, column, `i_${column}`));
    }
  }

  if (memberTable) {
    const memberJoinParts = [];

    if (has(rCols, "member_id")) memberJoinParts.push("r.member_id");
    if (paymentJoined && has(pCols, "member_id")) memberJoinParts.push("p.member_id");
    if (invoiceJoined && has(iCols, "member_id")) memberJoinParts.push("i.member_id");

    const memberIdColumn = has(mCols, "id")
      ? "id"
      : has(mCols, "member_id")
        ? "member_id"
        : null;

    if (memberJoinParts.length && memberIdColumn) {
      memberJoined = true;

      joins.push(`
        LEFT JOIN ${sqlId(memberTable)} m
          ON m.${sqlId(memberIdColumn)} = ${coalesce(memberJoinParts)}
      `);

      [
        "member_no",
        "full_name",
        "name",
        "email",
        "phone",
      ].forEach((column) => addSelect(selects, "m", mCols, column, `m_${column}`));
    }
  }

  const memberId = coalesce([
    col("r", rCols, "member_id"),
    paymentJoined ? col("p", pCols, "member_id") : null,
    invoiceJoined ? col("i", iCols, "member_id") : null,
  ]);

  const paymentId = coalesce([
    col("r", rCols, "payment_id"),
    paymentJoined ? col("p", pCols, "id") : null,
  ]);

  const invoiceId = coalesce([
    col("r", rCols, "invoice_id"),
    paymentJoined ? col("p", pCols, "invoice_id") : null,
    invoiceJoined ? col("i", iCols, "id") : null,
  ]);

  const pledgeId = coalesce([
    col("r", rCols, "pledge_id"),
    paymentJoined ? col("p", pCols, "pledge_id") : null,
    invoiceJoined ? col("i", iCols, "pledge_id") : null,
  ]);

  const campaignId = coalesce([
    col("r", rCols, "campaign_id"),
    paymentJoined ? col("p", pCols, "campaign_id") : null,
    invoiceJoined ? col("i", iCols, "campaign_id") : null,
  ]);

  const category = coalesce([
    col("r", rCols, "payment_type"),
    col("r", rCols, "category"),
    col("r", rCols, "payment_category"),
    col("r", rCols, "donation_category"),
    paymentJoined ? col("p", pCols, "payment_type") : null,
    paymentJoined ? col("p", pCols, "category") : null,
    paymentJoined ? col("p", pCols, "donation_category") : null,
    invoiceJoined ? col("i", iCols, "invoice_type") : null,
    invoiceJoined ? col("i", iCols, "category") : null,
    invoiceJoined ? col("i", iCols, "donation_category") : null,
  ], "'payment'");

  const method = coalesce([
    col("r", rCols, "payment_method"),
    col("r", rCols, "method"),
    paymentJoined ? col("p", pCols, "payment_method") : null,
    paymentJoined ? col("p", pCols, "method") : null,
  ]);

  const status = coalesce([
    col("r", rCols, "status"),
    col("r", rCols, "receipt_status"),
  ], "'issued'");

  const emailStatus = coalesce([
    col("r", rCols, "email_status"),
    col("r", rCols, "delivery_status"),
  ], "'pending'");

  const amount = castMoney(coalesce([
    col("r", rCols, "amount"),
    col("r", rCols, "receipt_amount"),
    paymentJoined ? col("p", pCols, "amount") : null,
  ], "0"));

  const issuedAt = coalesce([
    col("r", rCols, "issued_at"),
    col("r", rCols, "receipt_date"),
    col("r", rCols, "created_at"),
  ], "NOW()");

  const searchName = coalesce([
    col("r", rCols, "full_name_snapshot"),
    paymentJoined ? col("p", pCols, "full_name_snapshot") : null,
    invoiceJoined ? col("i", iCols, "full_name_snapshot") : null,
    memberJoined ? col("m", mCols, "full_name") : null,
    memberJoined ? col("m", mCols, "name") : null,
  ]);

  const searchEmail = coalesce([
    col("r", rCols, "email_snapshot"),
    paymentJoined ? col("p", pCols, "email_snapshot") : null,
    invoiceJoined ? col("i", iCols, "email_snapshot") : null,
    memberJoined ? col("m", mCols, "email") : null,
  ]);

  const searchFields = [
    col("r", rCols, "receipt_number"),
    col("r", rCols, "payment_number"),
    col("r", rCols, "invoice_number"),
    paymentJoined ? col("p", pCols, "payment_number") : null,
    invoiceJoined ? col("i", iCols, "invoice_number") : null,
    col("r", rCols, "reference_no"),
    paymentJoined ? col("p", pCols, "reference_no") : null,
    paymentJoined ? col("p", pCols, "transaction_reference") : null,
    searchName,
    searchEmail,
  ].filter(Boolean);

  return {
    joins: joins.join("\n"),
    selects: selects.join(",\n      "),
    expressions: {
      memberId,
      paymentId,
      invoiceId,
      pledgeId,
      campaignId,
      category,
      method,
      status,
      emailStatus,
      amount,
      issuedAt,
      searchName,
      searchEmail,
      searchFields,
    },
  };
}

function normalizeReceiptRow(row = {}) {
  const snapshot = safeJson(row.receipt_snapshot_json || row.snapshot_json, {});

  const category = normalizePaymentCategory(
    firstValue(row, [
      "payment_type",
      "category",
      "payment_category",
      "donation_category",
      "p_payment_type",
      "p_category",
      "p_donation_category",
      "i_invoice_type",
      "i_category",
      "i_donation_category",
    ], "payment")
  );

  const participants = safeJson(
    firstValue(row, [
      "participants_json",
      "p_participants_json",
      "i_participants_json",
    ], null),
    []
  );

  const coverageMonthsJson = firstValue(row, [
    "coverage_months_json",
    "p_coverage_months_json",
    "i_coverage_months_json",
    "membership_months",
  ], snapshot.coverage_months_json || null);

  const coverage = buildCoveragePayload({
    coverage_year: firstValue(row, ["coverage_year", "p_coverage_year", "i_coverage_year"], snapshot.coverage_year || null),
    coverage_start_month: firstValue(row, ["coverage_start_month", "p_coverage_start_month", "i_coverage_start_month"], snapshot.coverage_start_month || null),
    coverage_end_month: firstValue(row, ["coverage_end_month", "p_coverage_end_month", "i_coverage_end_month"], snapshot.coverage_end_month || null),
    months_paid: firstValue(row, ["months_paid", "p_months_paid", "i_months_paid"], snapshot.months_paid || null),
    coverage_months_json: coverageMonthsJson,
  });

  const fullName = firstValue(row, [
    "payer_name",
    "donor_name",
    "guest_name",
    "customer_name",
    "full_name_snapshot",
    "p_full_name_snapshot",
    "i_full_name_snapshot",
    "m_full_name",
    "m_name",
  ], "Member / Guest");

  const email = firstValue(row, [
    "payer_email",
    "donor_email",
    "guest_email",
    "customer_email",
    "email_snapshot",
    "p_email_snapshot",
    "i_email_snapshot",
    "m_email",
  ], "");

  const phone = firstValue(row, [
    "payer_phone",
    "donor_phone",
    "guest_phone",
    "customer_phone",
    "phone_snapshot",
    "p_phone_snapshot",
    "i_phone_snapshot",
    "m_phone",
  ], "");

  const paymentMethod = firstValue(row, [
    "payment_method",
    "method",
    "p_payment_method",
    "p_method",
  ], "");

  const cardBrand = firstValue(row, ["card_brand", "p_card_brand"], "");
  const cardLast4 = firstValue(row, ["card_last4", "p_card_last4"], "");

  const normalized = {
    ...row,

    id: row.id,
    receipt_id: row.id,

    receipt_number: row.receipt_number,
    invoice_number: firstValue(row, ["invoice_number", "i_invoice_number", "i_invoice_no"], ""),
    payment_number: firstValue(row, ["payment_number", "p_payment_number"], ""),

    payment_id: firstValue(row, ["payment_id", "p_id"], null),
    invoice_id: firstValue(row, ["invoice_id", "p_invoice_id", "i_id"], null),
    member_id: firstValue(row, ["member_id", "p_member_id", "i_member_id"], null),
    pledge_id: firstValue(row, ["pledge_id", "p_pledge_id", "i_pledge_id"], null),
    campaign_id: firstValue(row, ["campaign_id", "p_campaign_id", "i_campaign_id"], null),

    title: row.title || "Payment Receipt",

    category,
    category_label: paymentCategoryLabel(category),
    sub_category: firstValue(row, ["sub_category", "p_sub_category"], ""),

    amount: money(firstValue(row, ["amount", "receipt_amount", "p_amount"], 0)),
    currency: row.currency || "USD",

    status: firstValue(row, ["status", "receipt_status"], "issued"),
    payment_status: firstValue(row, ["payment_status", "status", "receipt_status"], "paid"),

    member_no: firstValue(row, ["member_no", "p_member_no", "i_member_no", "m_member_no"], ""),

    full_name: fullName,
    full_name_snapshot: fullName,
    email,
    email_snapshot: email,
    phone,
    phone_snapshot: phone,

    payment_method: paymentMethod,
    payment_method_label: paymentMethodLabel(paymentMethod),

    payment_provider: firstValue(row, ["payment_provider", "provider", "p_provider", "p_payment_provider"], ""),

    card_brand: cardBrand,
    card_last4: cardLast4,
    card_exp_month: firstValue(row, ["card_exp_month", "p_card_exp_month"], ""),
    card_exp_year: firstValue(row, ["card_exp_year", "p_card_exp_year"], ""),
    bank_last4: firstValue(row, ["bank_last4", "p_bank_last4"], ""),

    card_label: cardLast4
      ? buildCardLabel({
          card_brand: cardBrand,
          card_last4: cardLast4,
        })
      : "",

    reference_no: firstValue(row, [
      "reference_no",
      "reference_number",
      "p_reference_no",
      "p_reference_number",
      "transaction_reference",
      "p_transaction_reference",
      "p_stripe_payment_intent_id",
    ], ""),

    transaction_reference: firstValue(row, [
      "transaction_reference",
      "p_transaction_reference",
      "p_stripe_payment_intent_id",
    ], ""),

    membership: isMembershipPayment(category)
      ? {
          plan_name: firstValue(row, ["plan_name", "p_plan_name", "i_plan_name"], snapshot.plan_name || null),
          months_paid: firstValue(row, ["months_paid", "p_months_paid", "i_months_paid"], snapshot.months_paid || coverage.months_paid),
          coverage_label: firstValue(row, ["coverage_label", "p_coverage_label", "i_coverage_label"], snapshot.coverage_label || coverageDisplay(row)),
          coverage_year: firstValue(row, ["coverage_year", "p_coverage_year", "i_coverage_year"], snapshot.coverage_year || coverage.coverage_year),
          coverage_start_month: firstValue(row, ["coverage_start_month", "p_coverage_start_month", "i_coverage_start_month"], snapshot.coverage_start_month || null),
          coverage_end_month: firstValue(row, ["coverage_end_month", "p_coverage_end_month", "i_coverage_end_month"], snapshot.coverage_end_month || null),
          coverage_months: buildCoverageChips({
            ...row,
            coverage_months_json: coverageMonthsJson,
          }),
          coverage_months_json: coverageMonthsJson,
        }
      : null,

    donation: isDonationPayment(category)
      ? {
          donation_category: firstValue(row, ["donation_category", "p_donation_category", "i_donation_category"], snapshot.donation_category || row.sub_category || "general_donation"),
          donation_label: firstValue(row, ["donation_category_label", "p_donation_category_label", "i_donation_category_label"], snapshot.donation_category_label || donationCategoryLabel(firstValue(row, ["donation_category", "p_donation_category", "i_donation_category"], "general_donation"))),
        }
      : null,

    program: isProgramPayment(category)
      ? {
          type: category,
          program_name: firstValue(row, ["program_name", "p_program_name", "i_program_name", "program_title", "p_program_title", "i_program_title"], snapshot.program_name || row.sub_category || ""),
          quantity: Number(firstValue(row, ["quantity", "participant_count", "p_participant_count", "i_participant_count"], snapshot.quantity || participants.length || 1)),
          price_per_person: Number(firstValue(row, ["price_per_person"], snapshot.price_per_person || 0)),
          pricing_tier_label: firstValue(row, ["pricing_tier_label", "p_pricing_tier_label", "i_pricing_tier_label"], snapshot.pricing_tier_label || ""),
          participants,
          registration_id: firstValue(row, ["registration_id", "p_registration_id", "i_registration_id"], snapshot.registration_id || null),
          news_event_id: firstValue(row, ["news_event_id", "p_news_event_id", "i_news_event_id"], snapshot.news_event_id || null),
        }
      : null,

    pledge: category === "pledge"
      ? {
          pledge_id: firstValue(row, ["pledge_id", "p_pledge_id", "i_pledge_id"], null),
          pledge_number: firstValue(row, ["pledge_number", "p_pledge_number", "i_pledge_number"], ""),
          campaign_id: firstValue(row, ["campaign_id", "p_campaign_id", "i_campaign_id"], null),
          campaign_name: firstValue(row, ["campaign_name", "p_campaign_name", "i_campaign_name"], ""),
          pledged_amount: money(firstValue(row, ["pledged_amount", "pledge_amount", "p_pledged_amount", "p_pledge_amount", "i_pledged_amount", "i_pledge_amount"], 0)),
          remaining_balance: money(firstValue(row, ["remaining_balance", "pledge_remaining_amount", "p_remaining_balance", "p_pledge_remaining_amount", "i_balance_due", "i_remaining_amount"], 0)),
        }
      : null,

    email_status: firstValue(row, ["email_status", "delivery_status"], "pending"),
    emailed_to: firstValue(row, ["emailed_to", "last_emailed_to"], email),
    emailed_at: firstValue(row, ["emailed_at", "sent_at", "last_emailed_at"], null),
    email_error: firstValue(row, ["email_error", "last_email_error"], null),

    pdf_url: firstValue(row, ["pdf_url", "receipt_pdf_url"], ""),

    issued_at: row.issued_at,
    receipt_date: row.receipt_date,
    created_at: row.created_at,
    updated_at: row.updated_at,

    snapshot,
  };

  return normalized;
}

async function loadReceipt(whereSql, params) {
  const parts = await receiptQueryParts();

  const [rows] = await db.query(
    `
    SELECT
      ${parts.selects}
    FROM tbl_finance_receipts r
    ${parts.joins}
    ${whereSql}
    LIMIT 1
    `,
    params
  );

  return rows[0] || null;
}

async function loadReceiptById(id) {
  return loadReceipt("WHERE r.id = ?", [id]);
}

async function loadReceiptByNumber(receiptNumber) {
  return loadReceipt("WHERE r.receipt_number = ?", [receiptNumber]);
}

async function getReceiptById(id) {
  const row = await loadReceiptById(id);
  return row ? normalizeReceiptRow(row) : null;
}

async function getReceiptByNumber(receiptNumber) {
  const row = await loadReceiptByNumber(receiptNumber);
  return row ? normalizeReceiptRow(row) : null;
}

function buildWhere(filters, parts) {
  const where = [];
  const params = [];
  const e = parts.expressions;

  function addValue(expr, value) {
    if (value !== null && value !== undefined && value !== "") {
      where.push(`${expr} = ?`);
      params.push(value);
    }
  }

  addValue(e.memberId, filters.member_id);
  addValue(e.paymentId, filters.payment_id);
  addValue(e.invoiceId, filters.invoice_id);
  addValue(e.pledgeId, filters.pledge_id);
  addValue(e.campaignId, filters.campaign_id);

  if (filters.category) {
    where.push(`LOWER(${e.category}) LIKE ?`);
    params.push(`%${clean(filters.category, 80).toLowerCase()}%`);
  }

  if (filters.method) {
    where.push(`LOWER(${e.method}) = ?`);
    params.push(clean(filters.method, 40).toLowerCase());
  }

  if (filters.status) {
    where.push(`LOWER(${e.status}) = ?`);
    params.push(clean(filters.status, 40).toLowerCase());
  }

  if (filters.email_status) {
    where.push(`LOWER(${e.emailStatus}) = ?`);
    params.push(clean(filters.email_status, 40).toLowerCase());
  }

  if (filters.date_from) {
    where.push(`DATE(${e.issuedAt}) >= ?`);
    params.push(clean(filters.date_from, 20));
  }

  if (filters.date_to) {
    where.push(`DATE(${e.issuedAt}) <= ?`);
    params.push(clean(filters.date_to, 20));
  }

  if (filters.amount_min) {
    where.push(`${e.amount} >= ?`);
    params.push(money(filters.amount_min));
  }

  if (filters.amount_max) {
    where.push(`${e.amount} <= ?`);
    params.push(money(filters.amount_max));
  }

  if (filters.search) {
    const like = `%${clean(filters.search, 120)}%`;
    where.push(`(${e.searchFields.map((field) => `${field} LIKE ?`).join(" OR ")})`);
    params.push(...e.searchFields.map(() => like));
  }

  return {
    sql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

async function listReceipts(filters = {}) {
  const parts = await receiptQueryParts();
  const where = buildWhere(filters, parts);

  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.min(500, Math.max(1, Number(filters.limit || 25)));
  const offset = (page - 1) * limit;
  const e = parts.expressions;

  const [[countRow]] = await db.query(
    `
    SELECT COUNT(*) AS total
    FROM tbl_finance_receipts r
    ${parts.joins}
    ${where.sql}
    `,
    where.params
  );

  const [[summary]] = await db.query(
    `
    SELECT
      COUNT(*) AS total_receipts,
      COALESCE(SUM(${e.amount}), 0) AS total_amount,
      COALESCE(SUM(CASE WHEN LOWER(${e.emailStatus}) = 'sent' THEN 1 ELSE 0 END), 0) AS sent_count,
      COALESCE(SUM(CASE WHEN LOWER(${e.emailStatus}) = 'failed' THEN 1 ELSE 0 END), 0) AS failed_count,
      COALESCE(SUM(CASE WHEN LOWER(${e.category}) LIKE '%member%' THEN 1 ELSE 0 END), 0) AS membership_receipts,
      COALESCE(SUM(CASE WHEN LOWER(${e.category}) LIKE '%donation%' THEN 1 ELSE 0 END), 0) AS donation_receipts,
      COALESCE(SUM(CASE WHEN LOWER(${e.category}) IN ('school', 'trip') THEN 1 ELSE 0 END), 0) AS program_receipts
    FROM tbl_finance_receipts r
    ${parts.joins}
    ${where.sql}
    `,
    where.params
  );

  const [rows] = await db.query(
    `
    SELECT
      ${parts.selects}
    FROM tbl_finance_receipts r
    ${parts.joins}
    ${where.sql}
    ORDER BY ${e.issuedAt} DESC, r.id DESC
    LIMIT ?
    OFFSET ?
    `,
    [...where.params, limit, offset]
  );

  const total = Number(countRow?.total || 0);

  return {
    rows: rows.map(normalizeReceiptRow),

    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },

    summary: {
      total_receipts: Number(summary?.total_receipts || 0),
      total_amount: money(summary?.total_amount),
      sent_count: Number(summary?.sent_count || 0),
      failed_count: Number(summary?.failed_count || 0),
      membership_receipts: Number(summary?.membership_receipts || 0),
      donation_receipts: Number(summary?.donation_receipts || 0),
      program_receipts: Number(summary?.program_receipts || 0),
    },
  };
}

async function getReceiptStats(filters = {}) {
  const result = await listReceipts({
    ...filters,
    page: 1,
    limit: 1,
  });

  return result.summary || {};
}

async function generateReceiptPdf(receiptId, options = {}) {
  const receipt = await getReceiptById(receiptId);

  if (!receipt) {
    throw new Error("Receipt not found.");
  }

  const receiptPdfService = require("./receiptPdfService");

  if (typeof receiptPdfService.generateReceiptPdf !== "function") {
    throw new Error("Receipt PDF service is not available.");
  }

  const pdf = await receiptPdfService.generateReceiptPdf(receipt, options);

  if (pdf?.pdf_url && (await tableExists("tbl_finance_receipts"))) {
    const columns = await columnsFor("tbl_finance_receipts");
    const updates = [];
    const values = [];

    if (has(columns, "pdf_url")) {
      updates.push("pdf_url = ?");
      values.push(pdf.pdf_url);
    }

    if (has(columns, "receipt_pdf_url")) {
      updates.push("receipt_pdf_url = ?");
      values.push(pdf.pdf_url);
    }

    if (has(columns, "updated_at")) {
      updates.push("updated_at = NOW()");
    }

    if (updates.length) {
      values.push(receipt.id);

      await db.query(
        `
        UPDATE tbl_finance_receipts
        SET ${updates.join(", ")}
        WHERE id = ?
        `,
        values
      );
    }
  }

  return pdf;
}

async function sendReceiptEmail(receiptId, options = {}) {
  const receiptEmailService = require("./receiptEmailService");

  if (typeof receiptEmailService.sendReceiptEmail !== "function") {
    throw new Error("Receipt email service is not available.");
  }

  return receiptEmailService.sendReceiptEmail(receiptId, options);
}

async function resendReceiptEmail(receiptId, options = {}) {
  const receiptEmailService = require("./receiptEmailService");

  if (typeof receiptEmailService.resendReceiptEmail === "function") {
    return receiptEmailService.resendReceiptEmail(receiptId, options);
  }

  return sendReceiptEmail(receiptId, {
    ...options,
    resend: true,
  });
}

async function sendReceiptEmailByPayment(paymentId, options = {}) {
  const receiptEmailService = require("./receiptEmailService");

  if (typeof receiptEmailService.sendReceiptEmailByPayment === "function") {
    return receiptEmailService.sendReceiptEmailByPayment(paymentId, options);
  }

  const [[row]] = await db.query(
    `
    SELECT id
    FROM tbl_finance_receipts
    WHERE payment_id = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [paymentId]
  );

  if (!row) {
    throw new Error("Receipt not found for payment.");
  }

  return sendReceiptEmail(row.id, options);
}

module.exports = {
  listReceipts,

  getReceiptById,
  getReceiptByNumber,

  getReceiptStats,

  generateReceiptPdf,
  sendReceiptEmail,
  resendReceiptEmail,
  sendReceiptEmailByPayment,

  normalizeReceipt: normalizeReceiptRow,
};