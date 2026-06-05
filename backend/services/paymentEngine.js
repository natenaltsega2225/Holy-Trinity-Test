
// backend/services/paymentEngine.js
"use strict";

const crypto = require("crypto");

const {
  applyMembershipPayment,
} = require("./subscriptionService");

const {
  postPaymentToLedger,
} = require("./ledgerService");

const columnCache = new Map();

function clean(v, max = 255) {
  return String(v ?? "").trim().slice(0, max);
}

function nullable(v, max = 255) {
  const s = clean(v, max);
  return s || null;
}

function toMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number(n.toFixed(2));
}

function cents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

function mysqlNow() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function generateNumber(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

const FINANCE_CATEGORIES = [
  "plate_collection",
  "candle_sale",
  "general_donation",
  "tithe",
  "vows",
  "baptism",
  "wedding_engagement",
  "memorial_service",
  "pledge",
  "building_fund",
  "charity_fund",
  "auction",
  "other_fund",
  "sunday_cash_collection",
  "membership",
  "school_program",
  "school",
  "trip",
  "reimbursement",
];

function normalizeCategory(value, fallback = "general_donation") {
  const raw = clean(value, 120).toLowerCase().replace(/\s+/g, "_");
  if (!raw) return fallback;
  return FINANCE_CATEGORIES.includes(raw) ? raw : fallback;
}

function normalizePaymentType(value) {
  const raw = clean(value, 60).toLowerCase();

  if (
    [
      "membership",
      "membership_dues",
      "registration_with_plan",
      "registration_fee",
      "dues",
      "member_dues",
    ].includes(raw)
  ) {
    return "membership";
  }

  if (["school", "kids", "kids_school", "school_program"].includes(raw)) {
    return "school";
  }

  if (raw === "trip") return "trip";
  if (["donation", "giving", "donate"].includes(raw)) return "donation";
  if (raw === "reimbursement") return "reimbursement";
  if (raw === "manual") return "manual";
  if (raw === "invoice_payment") return "invoice_payment";

  return "other";
}

async function getTableColumns(conn, tableName) {
  if (columnCache.has(tableName)) return columnCache.get(tableName);

  const [rows] = await conn.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const cols = new Set(rows.map((r) => r.Field));
  columnCache.set(tableName, cols);
  return cols;
}

async function insertExistingColumns(conn, tableName, data) {
  const cols = await getTableColumns(conn, tableName);
  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) {
    throw new Error(`No matching columns found for ${tableName}`);
  }

  const keys = entries.map(([key]) => `\`${key}\``).join(", ");
  const marks = entries.map(() => "?").join(", ");
  const values = entries.map(([, value]) => value);

  const [result] = await conn.query(
    `INSERT INTO \`${tableName}\` (${keys}) VALUES (${marks})`,
    values
  );

  return result.insertId;
}

async function updateExistingColumns(conn, tableName, data, whereSql, whereParams) {
  const cols = await getTableColumns(conn, tableName);
  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) return;

  const setSql = entries.map(([key]) => `\`${key}\` = ?`).join(", ");
  const values = entries.map(([, value]) => value);

  await conn.query(
    `UPDATE \`${tableName}\` SET ${setSql} WHERE ${whereSql}`,
    [...values, ...whereParams]
  );
}

async function findMemberSnapshot(conn, memberId) {
  if (!memberId) {
    return {
      member_no: null,
      full_name: null,
      email: null,
      phone: null,
    };
  }

  const [rows] = await conn.query(
    `
    SELECT id, member_no, full_name, email, phone
    FROM tbl_members
    WHERE id = ?
    LIMIT 1
    `,
    [memberId]
  );

  return (
    rows[0] || {
      member_no: null,
      full_name: null,
      email: null,
      phone: null,
    }
  );
}

async function retrieveCardSummary(stripe, paymentIntentId) {
  if (!stripe || !paymentIntentId) return {};

  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });

    const charge = pi.latest_charge;
    const card = charge?.payment_method_details?.card;

    return {
      stripe_charge_id: typeof charge === "string" ? charge : charge?.id || null,
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

function formatCoverageLabel(startDate, endDate) {
  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const fmt = (d) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

  return `${fmt(start)} - ${fmt(end)}`;
}

function addMonths(value, months) {
  const base = value ? new Date(value) : new Date();
  if (Number.isNaN(base.getTime())) return new Date();

  const d = new Date(base);
  d.setMonth(d.getMonth() + Number(months || 1));
  return d;
}

function buildCoverage(payload) {
  const months = Math.max(
    1,
    Number(payload.months_paid || payload.months || payload.duration_months || 1)
  );

  const startDate =
    payload.coverage_start_date ||
    payload.coverage_start ||
    new Date().toISOString().slice(0, 10);

  const endDate =
    payload.coverage_end_date ||
    payload.coverage_end ||
    addMonths(startDate, months).toISOString().slice(0, 10);

  return {
    months,
    start_date: new Date(startDate).toISOString().slice(0, 10),
    end_date: new Date(endDate).toISOString().slice(0, 10),
    label:
      payload.coverage_label ||
      formatCoverageLabel(startDate, endDate) ||
      `${startDate} → ${endDate}`,
  };
}

async function createInvoice(conn, payload) {
  const invoiceNumber = payload.invoice_number || generateNumber("INV");

  const invoiceId = await insertExistingColumns(conn, "tbl_finance_invoices", {
    invoice_number: invoiceNumber,
    member_id: payload.member_id || null,
    payment_id: payload.payment_id || null,
    invoice_type: payload.invoice_type || payload.payment_type || "payment",
    description: payload.description || null,
    status: payload.status || "paid",
    amount: payload.amount,
    subtotal_amount: payload.amount,
    total_amount: payload.amount,
    paid_amount: payload.status === "paid" ? payload.amount : payload.amount,
    balance_due: payload.status === "paid" ? 0 : payload.amount,
    period_label: payload.period_label || null,
    period_start: payload.period_start || null,
    period_end: payload.period_end || null,
    due_date: payload.due_date || mysqlNow(),
    issue_date: payload.issue_date || mysqlNow(),
    invoice_date: payload.invoice_date || mysqlNow(),
    issued_at: payload.issued_at || mysqlNow(),
    created_at: mysqlNow(),
    updated_at: mysqlNow(),
    notes: payload.notes || null,
  });

  return { id: invoiceId, invoice_number: invoiceNumber };
}

async function insertInvoiceItem(conn, payload) {
  return insertExistingColumns(conn, "tbl_finance_invoice_items", {
    invoice_id: payload.invoice_id,
    item_name: payload.item_name || payload.description || "Payment item",
    description: payload.description || payload.item_name || "Payment item",
    quantity: payload.quantity || 1,
    unit_price: payload.unit_price || payload.amount,
    line_total: payload.line_total || payload.amount,
    amount: payload.amount,
    created_at: mysqlNow(),
  }).catch(() => null);
}

async function insertPayment(conn, payload) {
  const paymentNumber = payload.payment_number || generateNumber("PAY");
  const member = await findMemberSnapshot(conn, payload.member_id);

  const paymentId = await insertExistingColumns(conn, "tbl_finance_payments", {
    payment_number: paymentNumber,
    member_id: payload.member_id || null,
    member_no: payload.member_no || member.member_no || null,

    full_name_snapshot:
      payload.full_name_snapshot || member.full_name || payload.full_name || null,
    email_snapshot: payload.email_snapshot || member.email || payload.email || null,
    phone_snapshot: payload.phone_snapshot || member.phone || payload.phone || null,

    related_invoice_id: payload.related_invoice_id || null,
    dues_subscription_id: payload.dues_subscription_id || null,

    payment_type: normalizePaymentType(payload.payment_type),
    category: payload.category || normalizePaymentType(payload.payment_type),
    sub_category: payload.sub_category || null,

    plan_name: payload.plan_name || null,

    related_entity_id: payload.related_entity_id || null,
    related_entity_type: payload.related_entity_type || null,

    quantity: payload.quantity || 1,
    method: payload.method || "card",
    provider: payload.provider || "stripe",
    amount: payload.amount,
    currency: payload.currency || "USD",
    description: payload.description || null,
    reference_no: payload.reference_no || null,
    status: payload.status || "paid",

    stripe_event_id: payload.stripe_event_id || null,
    stripe_payment_intent_id: payload.stripe_payment_intent_id || null,
    stripe_charge_id: payload.stripe_charge_id || null,
    stripe_checkout_session_id: payload.stripe_checkout_session_id || null,
    stripe_invoice_id: payload.stripe_invoice_id || null,
    stripe_subscription_id: payload.stripe_subscription_id || null,
    stripe_customer_id: payload.stripe_customer_id || null,

    paid_at: payload.paid_at || mysqlNow(),
    payment_date: payload.payment_date || payload.paid_at || mysqlNow(),

    approved_at: payload.approved_at || null,
    approved_by: payload.approved_by || null,
    created_by: payload.created_by || null,

    card_brand: payload.card_brand || null,
    card_last4: payload.card_last4 || null,
    card_exp_month: payload.card_exp_month || null,
    card_exp_year: payload.card_exp_year || null,
    cardholder_name: payload.cardholder_name || null,

    months_paid: payload.months_paid || 0,
    coverage_label: payload.coverage_label || null,
    coverage_start: payload.coverage_start_date || payload.coverage_start || null,
    coverage_end: payload.coverage_end_date || payload.coverage_end || null,
    remaining_credit: payload.remaining_credit || 0,

    reconciled: payload.reconciled || 0,
    reconciliation_status: payload.reconciliation_status || null,

    created_at: mysqlNow(),
    updated_at: mysqlNow(),
  });

  return { id: paymentId, payment_number: paymentNumber };
}

async function insertReceipt(conn, payload) {
  const receiptNumber = payload.receipt_number || generateNumber("RCPT");

  const receiptId = await insertExistingColumns(conn, "tbl_finance_receipts", {
    receipt_number: receiptNumber,
    payment_id: payload.payment_id,
    invoice_id: payload.invoice_id || null,
    member_id: payload.member_id || null,
    amount: payload.amount,
    currency: payload.currency || "USD",
    issued_at: payload.issued_at || mysqlNow(),
    email_to: payload.email_to || payload.email || null,
    emailed_to: payload.email_to || payload.email || null,
    email_status: payload.email_to || payload.email ? "pending" : "not_available",
    status: payload.status || "issued",
    notes: payload.notes || null,
    created_at: mysqlNow(),
    updated_at: mysqlNow(),
  });

  return { id: receiptId, receipt_number: receiptNumber };
}

async function markUserActiveMember(conn, memberId) {
  if (!memberId) return;

  await updateExistingColumns(
    conn,
    "tbl_members",
    {
      status: "active",
      membership_status: "active",
      is_active: 1,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [memberId]
  );

  await conn
    .query(
      `
      UPDATE tbl_users
      SET is_active = 1,
          updated_at = NOW()
      WHERE member_id = ?
      `,
      [memberId]
    )
    .catch(() => {});
}

async function insertDonation(conn, payload) {
  return insertExistingColumns(conn, "tbl_donations", {
    payment_id: payload.payment_id,
    member_id: payload.member_id || null,
    donor_name: payload.full_name || null,
    donor_email: payload.email || null,
    category: normalizeCategory(payload.category || payload.sub_category),
    amount: payload.amount || null,
    note: payload.note || payload.notes || null,
    created_at: mysqlNow(),
  }).catch(() => null);
}

async function insertProgramRegistration(conn, payload) {
  return insertExistingColumns(conn, "tbl_program_registrations", {
    payment_id: payload.payment_id,
    member_id: payload.member_id || null,
    news_event_id: payload.news_event_id || payload.program_id || payload.related_entity_id || null,
    program_id: payload.program_id || payload.news_event_id || payload.related_entity_id || null,
    category: payload.payment_type === "school" ? "kids" : "trip",
    applicant_name: payload.full_name || payload.participant_name || null,
    full_name: payload.full_name || payload.participant_name || null,
    email: payload.email || null,
    phone: payload.phone || null,
    quantity: payload.quantity || 1,
    total_amount: payload.amount,
    amount_paid: payload.amount,
    payment_status: "paid",
    registration_status: "successful",
    notes: payload.note || payload.notes || null,
    source: payload.provider || "stripe",
    created_at: mysqlNow(),
    updated_at: mysqlNow(),
  }).catch(() => null);
}

async function createFullPaymentRecord(conn, payload) {
  const amount = toMoney(payload.amount);
  if (!amount) throw new Error("Invalid payment amount.");

  const paymentType = normalizePaymentType(payload.payment_type);

  const coverage =
    paymentType === "membership"
      ? buildCoverage(payload)
      : {
          months: payload.months_paid || 0,
          start_date: payload.coverage_start_date || payload.coverage_start || null,
          end_date: payload.coverage_end_date || payload.coverage_end || null,
          label: payload.coverage_label || null,
        };

  const category =
    payload.category ||
    (paymentType === "donation"
      ? normalizeCategory(payload.sub_category || payload.donation_category)
      : paymentType);

  const description =
    payload.description ||
    payload.sub_category ||
    `${paymentType.replaceAll("_", " ")} payment`;

  const invoice = await createInvoice(conn, {
    member_id: payload.member_id,
    amount,
    status: "paid",
    payment_type: paymentType,
    description,
    notes: payload.notes || payload.note || null,
    period_label: coverage.label,
    period_start: coverage.start_date,
    period_end: coverage.end_date,
  });

  await insertInvoiceItem(conn, {
    invoice_id: invoice.id,
    item_name: payload.item_name || description,
    description,
    quantity: payload.quantity || 1,
    unit_price: amount,
    amount,
    line_total: amount,
  });

  const payment = await insertPayment(conn, {
    ...payload,
    payment_type: paymentType,
    category,
    related_invoice_id: invoice.id,
    amount,
    status: payload.status || "paid",
    description,
    months_paid: coverage.months,
    coverage_start_date: coverage.start_date,
    coverage_end_date: coverage.end_date,
    coverage_label: coverage.label,
  });

  await updateExistingColumns(
    conn,
    "tbl_finance_invoices",
    { payment_id: payment.id },
    "id = ?",
    [invoice.id]
  ).catch(() => {});

  const receipt = await insertReceipt(conn, {
    payment_id: payment.id,
    invoice_id: invoice.id,
    member_id: payload.member_id,
    amount,
    email: payload.email,
    notes: description,
  });

  await postPaymentToLedger(conn, {
    ...payload,
    id: payment.id,
    payment_id: payment.id,
    payment_number: payment.payment_number,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    receipt_id: receipt.id,
    receipt_number: receipt.receipt_number,
    payment_type: paymentType,
    amount,
    description,
    status: "paid",
    months_paid: coverage.months,
    coverage_start_date: coverage.start_date,
    coverage_end_date: coverage.end_date,
    coverage_label: coverage.label,
  });

  if (paymentType === "membership") {
    await markUserActiveMember(conn, payload.member_id);

    const sub = await applyMembershipPayment(conn, {
      payment_id: payment.id,
      member_id: payload.member_id,
      member_no: payload.member_no || null,

      payment_number: payment.payment_number,
      invoice_number: invoice.invoice_number,
      receipt_number: receipt.receipt_number,

      amount,

      plan_name: payload.plan_name,
      dues_plan_id: payload.dues_plan_id || payload.plan_id || null,
      plan_id: payload.plan_id || payload.dues_plan_id || null,

      months: coverage.months,
      months_paid: coverage.months,
      duration_months: coverage.months,

      coverage_start_date: coverage.start_date,
      coverage_end_date: coverage.end_date,
      coverage_label: coverage.label,

      auto_renew: payload.auto_renew,
      auto_payment_enabled: payload.auto_payment_enabled,

      stripe_customer_id: payload.stripe_customer_id || null,
      stripe_subscription_id: payload.stripe_subscription_id || null,
    });

    if (sub?.id) {
      await updateExistingColumns(
        conn,
        "tbl_finance_payments",
        {
          dues_subscription_id: sub.id,
          months_paid: coverage.months,
          coverage_label: coverage.label,
          coverage_start: coverage.start_date,
          coverage_end: coverage.end_date,
        },
        "id = ?",
        [payment.id]
      ).catch(() => {});
    }
  }

  if (paymentType === "donation") {
    await insertDonation(conn, {
      ...payload,
      payment_id: payment.id,
      member_id: payload.member_id,
      category,
      amount,
    });
  }

  if (paymentType === "school" || paymentType === "trip") {
    await insertProgramRegistration(conn, {
      ...payload,
      payment_id: payment.id,
      payment_type: paymentType,
      member_id: payload.member_id,
      amount,
    });
  }

  return {
    payment,
    invoice,
    receipt,
    payment_id: payment.id,
    payment_number: payment.payment_number,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    receipt_id: receipt.id,
    receipt_number: receipt.receipt_number,
    amount,
    payment_type: paymentType,
    coverage_label: coverage.label,
    coverage_start: coverage.start_date,
    coverage_end: coverage.end_date,
    months_paid: coverage.months,
  };
}

module.exports = {
  clean,
  nullable,
  toMoney,
  cents,
  generateNumber,
  normalizeCategory,
  normalizePaymentType,
  retrieveCardSummary,
  createInvoice,
  insertInvoiceItem,
  insertPayment,
  insertReceipt,
  markUserActiveMember,
  insertDonation,
  insertProgramRegistration,
  createFullPaymentRecord,
};