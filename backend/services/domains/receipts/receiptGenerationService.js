// backend/services/domains/receipts/receiptGenerationService.js
"use strict";

const crypto = require("crypto");

const {
  insertExistingColumns,
} = require("../../../utils/dbHelpers");

let numberGenerator = {};

try {
  numberGenerator = require("../../../utils/numberGenerator");
} catch {
  numberGenerator = {};
}

const RECEIPT_TABLE = "tbl_finance_receipts";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function mysqlNow() {
  return new Date();
}

function fallbackNumber(prefix) {
  return `${prefix}-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

function receiptNumber() {
  if (typeof numberGenerator.generateReceiptNumber === "function") {
    return numberGenerator.generateReceiptNumber();
  }

  if (typeof numberGenerator.generatePaymentNumber === "function") {
    return numberGenerator.generatePaymentNumber("RCPT");
  }

  return fallbackNumber("RCPT");
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === "string" && clean(value)) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

function safeJson(value, fallback = null) {
  try {
    if (value === undefined || value === null || value === "") {
      return fallback;
    }

    if (typeof value === "string") {
      JSON.parse(value);
      return value;
    }

    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function normalizeType(value) {
  const raw = clean(value || "other", 80).toLowerCase();

  if (["dues", "membership_dues", "registration_fee"].includes(raw)) {
    return "membership";
  }

  if (["kids", "kids_school", "school_program"].includes(raw)) {
    return "school";
  }

  if (["travel", "outing"].includes(raw)) {
    return "trip";
  }

  if (["giving", "tithe"].includes(raw)) {
    return "donation";
  }

  if (["pledge_payment", "pledge_invoice"].includes(raw)) {
    return "pledge";
  }

  return raw || "other";
}

function normalizeMethod(value) {
  const raw = clean(value || "manual", 80).toLowerCase();

  if (["stripe", "stripe_card", "credit_card", "debit_card"].includes(raw)) {
    return "card";
  }

  if (["stripe_ach", "bank", "bank_account", "us_bank_account"].includes(raw)) {
    return "ach";
  }

  if (["wire", "bank_deposit"].includes(raw)) return "bank_transfer";
  if (raw === "cheque") return "check";

  return raw || "manual";
}

function normalizePayerType(payload = {}) {
  const raw = clean(payload.payer_type || payload.donor_type || "", 40).toLowerCase();

  if (["guest", "visitor", "donor", "non_member", "non-member"].includes(raw)) {
    return "non_member";
  }

  if (raw === "member") return "member";

  return payload.member_id || payload.member_no ? "member" : "non_member";
}

function firstText(payload = {}, keys = [], max = 255) {
  for (const key of keys) {
    const value = payload[key];

    if (value !== undefined && value !== null && value !== "") {
      return clean(value, max);
    }
  }

  return "";
}
function firstMoney(payload = {}, keys = [], fallback = 0) {
  for (const key of keys) {
    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== "") {
      return money(payload[key]);
    }
  }
  return money(fallback);
}

function firstArray(payload = {}, keys = []) {
  for (const key of keys) {
    const rows = parseJsonArray(payload[key]);
    if (rows.length) return rows;
  }
  return [];
}

function receiptAllocationCode(type) {
  return {
    membership: "01",
    donation: "04",
    school: "14",
    trip: "15",
    pledge: "10",
  }[type] || "99";
}

function receiptAllocationClass(type) {
  return {
    membership: "Membership",
    donation: "Donation",
    school: "School",
    trip: "Trip",
    pledge: "Pledge",
  }[type] || "Other";
}

function receiptAllocationType(type, payload = {}) {
  if (type === "membership") return "Membership Dues";
  if (type === "school") return "School Program";
  if (type === "trip") return "Trip Program";
  if (type === "pledge") return "Pledge Campaign";
  return payload.donation_category_label || payload.donation_category || "General Donation";
}

function receiptAllocationDescription(type, payload = {}) {
  if (type === "membership") {
    return [payload.plan_name || "Membership", payload.coverage_label].filter(Boolean).join(" | ");
  }

  if (type === "school") {
    return [
      `School program: ${payload.program_name || payload.program_title || "--"}`,
      payload.quantity ? `Students: ${payload.quantity}` : "",
      payload.pricing_tier_label ? `Tier: ${payload.pricing_tier_label}` : "",
    ].filter(Boolean).join(" | ");
  }

  if (type === "trip") {
    return [
      `Trip program: ${payload.program_name || payload.program_title || "--"}`,
      payload.quantity ? `Participants: ${payload.quantity}` : "",
    ].filter(Boolean).join(" | ");
  }

  if (type === "pledge") {
    return [
      `Campaign: ${payload.campaign_name || "--"}`,
      payload.pledge_number ? `Pledge #: ${payload.pledge_number}` : "",
    ].filter(Boolean).join(" | ");
  }

  return `Donation category: ${payload.donation_category_label || payload.donation_category || payload.sub_category || "General Donation"}`;
}

function hasProcessingFeeRow(rows = []) {
  return rows.some((row) => {
    const text = `${row.code || ""} ${row.type || ""} ${row.description || ""}`.toLowerCase();
    return row.code === "PF" || text.includes("processing fee");
  });
}

function normalizeReceiptAllocationRows(payload = {}, normalized = {}) {
  const paymentType = normalizeType(normalized.payment_type || payload.payment_type || payload.category);
  const method = normalizeMethod(normalized.method || payload.method || payload.payment_method);

  const reference =
    normalized.reference_no ||
    normalized.transaction_reference ||
    payload.reference_no ||
    payload.transaction_reference ||
    "--";

  const totalPaid = money(normalized.total_amount || normalized.amount || payload.total_amount || payload.amount || 0);
  const processingFee = money(normalized.processing_fee || payload.processing_fee || 0);
  const baseAmount = money(
    normalized.invoice_amount ||
      normalized.base_amount ||
      normalized.subtotal_amount ||
      payload.invoice_amount ||
      payload.base_amount ||
      payload.subtotal_amount ||
      (processingFee > 0 ? Math.max(totalPaid - processingFee, 0) : totalPaid)
  );

  let rows = firstArray(payload, [
    "allocation_rows",
    "allocation_rows_json",
    "receipt_items",
    "receipt_items_json",
    "items",
    "items_json",
    "line_items",
    "line_items_json",
  ]).map((row) => ({
    code: clean(row.code || row.item_code || receiptAllocationCode(paymentType), 20),
    type: clean(row.type || row.item_type || receiptAllocationType(paymentType, payload), 120),
    className: clean(row.className || row.class_name || receiptAllocationClass(paymentType), 80),
    description: clean(row.description || row.detail || row.memo || receiptAllocationDescription(paymentType, payload), 500),
    amount: money(row.amount || row.total_amount || row.total || 0),
    remark: clean(row.remark || row.reference || row.reference_no || reference, 180),
  })).filter((row) => row.amount > 0);

  if (!rows.length) {
    rows = [{
      code: receiptAllocationCode(paymentType),
      type: receiptAllocationType(paymentType, payload),
      className: receiptAllocationClass(paymentType),
      description: receiptAllocationDescription(paymentType, payload),
      amount: baseAmount,
      remark: reference,
    }];
  }

  const rowTotal = money(rows.reduce((sum, row) => sum + money(row.amount), 0));

  if (processingFee > 0 && !hasProcessingFeeRow(rows)) {
    if (Math.abs(rowTotal - totalPaid) < 0.02 && baseAmount > 0) {
      const index = rows.findIndex((row) => money(row.amount) >= processingFee);
      if (index >= 0) rows[index].amount = money(Math.max(rows[index].amount - processingFee, 0));
    }

    rows.push({
      code: "PF",
      type: "Processing Fee",
      className: "Fee",
      description: `${method === "ach" ? "ACH / checking" : "Card"} processing fee`,
      amount: processingFee,
      remark: reference,
    });
  }

  return rows;
}
function participantNames(value) {
  return parseJsonArray(value)
    .map((row) =>
      clean(
        row.full_name ||
          row.student_name ||
          row.participant_name ||
          row.name,
        120
      )
    )
    .filter(Boolean);
}

/* -------------------------------------------------------------------------- */
/* Recipient / Metadata                                                       */
/* -------------------------------------------------------------------------- */

function buildReceiptRecipientSnapshot(payload = {}) {
  const fullName =
    firstText(
      payload,
      [
        "full_name",
        "payer_name",
        "donor_name",
        "guest_name",
        "member_name",
        "full_name_snapshot",
        "cardholder_name",
      ],
      255
    ) || "Guest / Donor";

  const email =
    firstText(
      payload,
      [
        "email",
        "payer_email",
        "donor_email",
        "guest_email",
        "member_email",
        "email_snapshot",
      ],
      190
    ) || null;

  const phone =
    firstText(
      payload,
      [
        "phone",
        "payer_phone",
        "donor_phone",
        "guest_phone",
        "member_phone",
        "phone_snapshot",
      ],
      80
    ) || null;

  return {
    full_name: fullName,
    email,
    phone,
    payer_type: normalizePayerType(payload),
  };
}

function buildEnterpriseMetadata(payload = {}, normalized = {}, participantNamesList = []) {
  return {
    source: normalized.source || payload.source || payload.created_from || null,
    created_from: normalized.created_from || payload.created_from || payload.source || null,

    payer: {
      type: normalized.payer_type,
      full_name: normalized.full_name,
      email: normalized.email,
      phone: normalized.phone,
      member_id: normalized.member_id || null,
      member_no: normalized.member_no || null,
    },

    staff: {
      recorded_by:
        normalized.recorded_by ||
        normalized.created_by ||
        normalized.actor_id ||
        null,
      staff_id:
        normalized.staff_id ||
        normalized.recorded_by ||
        normalized.created_by ||
        normalized.actor_id ||
        null,
      staff_name: normalized.staff_name || null,
    },

    receipt: {
      receipt_number: normalized.receipt_number,
      status: normalized.status,
      amount: normalized.amount,
      issued_at: normalized.issued_at || null,
    },

    payment: {
      payment_id: normalized.payment_id || null,
      payment_number: normalized.payment_number || null,
      method: normalized.method || normalized.payment_method || null,
      provider: normalized.provider || normalized.payment_provider || null,
      reference_no: normalized.reference_no || null,
      transaction_reference: normalized.transaction_reference || null,
    },

    invoice: {
      invoice_id: normalized.invoice_id || null,
      invoice_number: normalized.invoice_number || null,
      balance_due: normalized.balance_due || normalized.remaining_balance || null,
    },

    pledge: {
      pledge_id: normalized.pledge_id || null,
      pledge_number: normalized.pledge_number || null,
      pledged_amount: normalized.pledged_amount || null,
      remaining_balance: normalized.remaining_balance || normalized.balance_due || null,
    },

    campaign: {
      campaign_id: normalized.campaign_id || null,
      campaign_name: normalized.campaign_name || null,
      campaign_code: normalized.campaign_code || null,
    },

    program: {
      registration_id: normalized.registration_id || null,
      news_event_id: normalized.news_event_id || normalized.related_entity_id || null,
      program_id: normalized.program_id || normalized.news_event_id || null,
      program_name: normalized.program_name || null,
      program_title: normalized.program_title || null,
      pricing_tier_id: normalized.pricing_tier_id || null,
      pricing_tier_label: normalized.pricing_tier_label || null,
      participants: normalized.participants || [],
      participant_names: participantNamesList,
    },

    membership: {
      plan_id: normalized.plan_id || normalized.dues_plan_id || null,
      plan_name: normalized.plan_name || null,
      months_paid: normalized.months_paid || null,
      coverage_year: normalized.coverage_year || null,
      coverage_start_month: normalized.coverage_start_month || null,
      coverage_end_month: normalized.coverage_end_month || null,
      coverage_label: normalized.coverage_label || null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Descriptions                                                               */
/* -------------------------------------------------------------------------- */

function buildReceiptDescription(payload = {}) {
  const type = normalizeType(payload.payment_type || payload.category);

  if (type === "membership") {
    return [
      "Membership payment",
      payload.plan_name,
      payload.coverage_label,
    ]
      .filter(Boolean)
      .join(" - ");
  }

  if (type === "donation") {
    return [
      "Donation",
      payload.donation_category_label ||
        payload.donation_category ||
        payload.sub_category,
    ]
      .filter(Boolean)
      .join(" - ");
  }

  if (type === "school") {
    return [
      "School program payment",
      payload.program_name || payload.program_title,
      payload.pricing_tier_label,
    ]
      .filter(Boolean)
      .join(" - ");
  }

  if (type === "trip") {
    return [
      "Trip payment",
      payload.program_name || payload.program_title,
      payload.pricing_tier_label,
    ]
      .filter(Boolean)
      .join(" - ");
  }

  if (type === "pledge") {
    return [
      "Pledge payment",
      payload.campaign_name,
      payload.pledge_number,
    ]
      .filter(Boolean)
      .join(" - ");
  }

  return "Finance payment";
}

function normalizeReceiptPayload(payload = {}) {
  const paymentType = normalizeType(
    payload.payment_type ||
      payload.category ||
      "other"
  );

  const method = normalizeMethod(
    payload.method ||
      payload.payment_method
  );

  const processingFee = firstMoney(payload, [
    "processing_fee",
    "stripe_processing_fee",
    "card_processing_fee",
    "ach_processing_fee",
    "online_processing_fee",
  ]);

  let totalPaid = firstMoney(payload, [
    "total_amount",
    "payment_amount",
    "stripe_gross_amount",
    "stripe_paid_amount",
    "amount",
    "receipt_amount",
  ]);

  const explicitInvoiceAmount = firstMoney(payload, [
    "invoice_amount",
    "invoice_amount_applied",
    "base_amount",
    "subtotal_amount",
    "amount_before_fee",
  ]);

  const invoiceAmount =
    explicitInvoiceAmount > 0
      ? explicitInvoiceAmount
      : processingFee > 0
        ? money(Math.max(totalPaid - processingFee, 0))
        : totalPaid;

  if (processingFee > 0 && invoiceAmount > 0 && totalPaid <= invoiceAmount) {
    totalPaid = money(invoiceAmount + processingFee);
  }

  const participants =
    payload.participants ||
    parseJsonArray(payload.participants_json);

  const recipient = buildReceiptRecipientSnapshot(payload);

  const referenceNo =
    payload.reference_no ||
    payload.reference_number ||
    payload.transaction_reference ||
    null;

  const transactionReference =
    payload.transaction_reference ||
    payload.reference_no ||
    payload.reference_number ||
    null;

  const allocationRows = normalizeReceiptAllocationRows(payload, {
    payment_type: paymentType,
    method,
    amount: totalPaid,
    total_amount: totalPaid,
    invoice_amount: invoiceAmount,
    base_amount: invoiceAmount,
    subtotal_amount: invoiceAmount,
    processing_fee: processingFee,
    reference_no: referenceNo,
    transaction_reference: transactionReference,
  });

  return {
    ...payload,

    receipt_number:
      payload.receipt_number ||
      receiptNumber(),

    payment_type: paymentType,
    category: paymentType,

    member_id:
      payload.member_id ||
      null,

    member_no:
      payload.member_no ||
      null,

    full_name: recipient.full_name,
    email: recipient.email,
    phone: recipient.phone,
    payer_type: recipient.payer_type,

    payment_id:
      payload.payment_id ||
      null,

    payment_number:
      payload.payment_number ||
      null,

    invoice_id:
      payload.invoice_id ||
      null,

    invoice_number:
      payload.invoice_number ||
      null,

    amount: totalPaid,
    total_amount: totalPaid,
    payment_amount: totalPaid,

    invoice_amount: invoiceAmount,
    base_amount: invoiceAmount,
    subtotal_amount: invoiceAmount,

    processing_fee: processingFee,
    stripe_gross_amount: totalPaid,
    stripe_paid_amount: totalPaid,

    allocation_rows: allocationRows,
    allocation_rows_json: safeJson(allocationRows, "[]"),
    receipt_items: allocationRows,
    receipt_items_json: safeJson(allocationRows, "[]"),
    items: allocationRows,
    items_json: safeJson(allocationRows, "[]"),

    remaining_balance:
      payload.remaining_balance ||
      payload.balance_due ||
      null,

    balance_due:
      payload.balance_due ||
      payload.remaining_balance ||
      null,

    currency:
      clean(payload.currency || "USD", 10).toUpperCase(),

    method,
    payment_method: method,

    provider:
      payload.provider ||
      payload.payment_provider ||
      (["card", "ach"].includes(method) ? "stripe" : method),

    payment_provider:
      payload.payment_provider ||
      payload.provider ||
      (["card", "ach"].includes(method) ? "stripe" : method),

    status:
      clean(payload.receipt_status || payload.status || "issued", 40).toLowerCase(),

    sub_category:
      payload.sub_category ||
      payload.donation_category ||
      payload.program_name ||
      payload.program_title ||
      payload.campaign_name ||
      payload.plan_name ||
      null,

    donation_category:
      payload.donation_category ||
      null,

    donation_category_label:
      payload.donation_category_label ||
      null,

    pledge_id:
      payload.pledge_id ||
      null,

    pledge_number:
      payload.pledge_number ||
      null,

    pledged_amount:
      payload.pledged_amount ||
      null,

    campaign_id:
      payload.campaign_id ||
      null,

    campaign_name:
      payload.campaign_name ||
      null,

    campaign_code:
      payload.campaign_code ||
      null,

    registration_id:
      payload.registration_id ||
      null,

    news_event_id:
      payload.news_event_id ||
      payload.related_entity_id ||
      null,

    program_id:
      payload.program_id ||
      payload.news_event_id ||
      payload.related_entity_id ||
      null,

    program_name:
      payload.program_name ||
      payload.program_title ||
      null,

    program_title:
      payload.program_title ||
      payload.program_name ||
      null,

    program_category:
      payload.program_category ||
      paymentType,

    participants,
    participants_json: safeJson(participants, "[]"),

    quantity:
      Number(payload.quantity || participants.length || 1) || 1,

    price_per_person:
      payload.price_per_person ||
      null,

    pricing_tier_id:
      payload.pricing_tier_id ||
      null,

    pricing_tier_label:
      payload.pricing_tier_label ||
      null,

    reference_no: referenceNo,
    transaction_reference: transactionReference,

    description:
      payload.description ||
      buildReceiptDescription({
        ...payload,
        payment_type: paymentType,
        amount: invoiceAmount,
        total_amount: totalPaid,
        processing_fee: processingFee,
        participants,
      }),
  };
}
/* -------------------------------------------------------------------------- */
/* Main Generator                                                             */
/* -------------------------------------------------------------------------- */

async function generateReceipt(conn, payload = {}) {
  const normalized = normalizeReceiptPayload(payload);
  const names = participantNames(normalized.participants);
  const enterpriseMetadata = buildEnterpriseMetadata(payload, normalized, names);

  const result = await insertExistingColumns(conn, RECEIPT_TABLE, {
    receipt_number: normalized.receipt_number,

    payment_id: normalized.payment_id,
    payment_number: normalized.payment_number,

    invoice_id: normalized.invoice_id,
    invoice_number: normalized.invoice_number,

    member_id: normalized.member_id,
    member_no: normalized.member_no,

    full_name_snapshot: normalized.full_name,
    email_snapshot: normalized.email,
    phone_snapshot: normalized.phone,

    payer_type: normalized.payer_type,

    payment_type: normalized.payment_type,
    category: normalized.category,
    sub_category: normalized.sub_category,

    donation_category: normalized.donation_category,
    donation_category_label: normalized.donation_category_label,

    amount: normalized.amount,
    total_amount: normalized.total_amount,
    currency: normalized.currency,

    remaining_balance: normalized.remaining_balance,
    balance_due: normalized.balance_due,

    method: normalized.method,
    payment_method: normalized.payment_method,
    provider: normalized.provider,
    payment_provider: normalized.payment_provider,

    status: normalized.status,
    receipt_status: normalized.status,

    related_entity_id:
      normalized.related_entity_id ||
      normalized.news_event_id ||
      normalized.program_id ||
      null,

    related_entity_type:
      normalized.related_entity_type ||
      null,

    registration_id:
      normalized.registration_id ||
      null,

    news_event_id:
      normalized.news_event_id ||
      normalized.related_entity_id ||
      null,

    program_id:
      normalized.program_id ||
      normalized.news_event_id ||
      normalized.related_entity_id ||
      null,

    program_name: normalized.program_name,
    program_title: normalized.program_title,
    program_category: normalized.program_category,

    quantity: normalized.quantity,
    price_per_person: normalized.price_per_person,
    pricing_tier_id: normalized.pricing_tier_id,
    pricing_tier_label: normalized.pricing_tier_label,
    participants_json: normalized.participants_json,

    pledge_id: normalized.pledge_id,
    pledge_number: normalized.pledge_number,
    pledged_amount: normalized.pledged_amount,

    campaign_id: normalized.campaign_id,
    campaign_name: normalized.campaign_name,
    campaign_code: normalized.campaign_code,

    plan_id:
      normalized.plan_id ||
      normalized.dues_plan_id ||
      normalized.membership_plan_id ||
      null,

    dues_plan_id:
      normalized.dues_plan_id ||
      normalized.plan_id ||
      null,

    membership_plan_id:
      normalized.membership_plan_id ||
      normalized.plan_id ||
      null,

    plan_name:
      normalized.plan_name ||
      null,

    months_paid:
      normalized.months_paid ||
      null,

    coverage_year:
      normalized.coverage_year ||
      null,

    coverage_start_month:
      normalized.coverage_start_month ||
      null,

    coverage_end_month:
      normalized.coverage_end_month ||
      null,

    coverage_label:
      normalized.coverage_label ||
      null,

    coverage_months_json:
      normalized.coverage_months_json ||
      null,

    card_brand: normalized.card_brand || null,
    card_last4: normalized.card_last4 || null,
    card_exp_month: normalized.card_exp_month || null,
    card_exp_year: normalized.card_exp_year || null,
    cardholder_name: normalized.cardholder_name || null,

    bank_last4: normalized.bank_last4 || null,
    bank_name: normalized.bank_name || null,
    bank_account_type: normalized.bank_account_type || null,

    reference_no: normalized.reference_no,
    reference_number: normalized.reference_no,
    transaction_reference: normalized.transaction_reference,

    description: normalized.description,

    notes:
      normalized.notes ||
      normalized.note ||
      null,

    source: normalized.source || normalized.created_from || null,
    created_from: normalized.created_from || normalized.source || null,

    recorded_by:
      normalized.recorded_by ||
      normalized.created_by ||
      normalized.actor_id ||
      null,

    created_by:
      normalized.created_by ||
      normalized.actor_id ||
      null,

    issued_at:
      normalized.issued_at ||
      mysqlNow(),

    paid_at:
      normalized.paid_at ||
      mysqlNow(),

    sent_at:
      normalized.sent_at ||
      null,

    metadata_json:
      safeJson({
        ...parseJsonObject(payload.metadata),
        ...enterpriseMetadata,
      }),

    created_at: mysqlNow(),
    updated_at: mysqlNow(),
  });

  const id = result?.insertId || result?.id || result;

  return {
    id,
    receipt_number: normalized.receipt_number,

    payment_id: normalized.payment_id,
    payment_number: normalized.payment_number,

    invoice_id: normalized.invoice_id,
    invoice_number: normalized.invoice_number,

    member_id: normalized.member_id,
    member_no: normalized.member_no,

    full_name_snapshot: normalized.full_name,
    email_snapshot: normalized.email,
    phone_snapshot: normalized.phone,
    payer_type: normalized.payer_type,

    payment_type: normalized.payment_type,
    category: normalized.category,
    sub_category: normalized.sub_category,

    amount: normalized.amount,
    total_amount: normalized.total_amount,
    currency: normalized.currency,

    method: normalized.method,
    provider: normalized.provider,

    status: normalized.status,

    description: normalized.description,

    pledge_id: normalized.pledge_id || null,
    pledge_number: normalized.pledge_number || null,
    campaign_id: normalized.campaign_id || null,
    campaign_name: normalized.campaign_name || null,

    registration_id: normalized.registration_id || null,
    news_event_id: normalized.news_event_id || normalized.related_entity_id || null,
    program_id: normalized.program_id || normalized.news_event_id || null,
    program_name: normalized.program_name || null,
    program_title: normalized.program_title || null,
    quantity: normalized.quantity || null,
    pricing_tier_id: normalized.pricing_tier_id || null,
    pricing_tier_label: normalized.pricing_tier_label || null,
    participants_json: normalized.participants_json || null,

    metadata_json: safeJson({
      ...parseJsonObject(payload.metadata),
      ...enterpriseMetadata,
    }),
  };
}

module.exports = {
  generateReceipt,
  buildReceiptDescription,
  normalizeReceiptPayload,
  buildReceiptRecipientSnapshot,
  buildEnterpriseMetadata,
};