// backend/services/domains/invoices/invoiceGenerationService.js
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

const INVOICE_TABLE = "tbl_finance_invoices";
const ITEM_TABLE = "tbl_finance_invoice_items";

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

function invoiceNumber() {
  if (typeof numberGenerator.generateInvoiceNumber === "function") {
    return numberGenerator.generateInvoiceNumber();
  }

  if (typeof numberGenerator.generatePaymentNumber === "function") {
    return numberGenerator.generatePaymentNumber("INV");
  }

  return fallbackNumber("INV");
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

function normalizePayerType(payload = {}) {
  const raw = clean(payload.payer_type || payload.donor_type || "", 40).toLowerCase();

  if (["non_member", "non-member", "guest", "visitor", "donor"].includes(raw)) {
    return "non_member";
  }

  if (raw === "member") return "member";

  return payload.member_id || payload.member_no ? "member" : "non_member";
}

function statusFromAmounts(total, paid, requestedStatus) {
  const status = clean(requestedStatus, 40).toLowerCase();

  if (["void", "cancelled", "canceled", "refunded"].includes(status)) {
    return status === "canceled" ? "cancelled" : status;
  }

  if (paid >= total && total > 0) return "paid";
  if (paid > 0 && paid < total) return "partial";

  return status || "open";
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

async function tableExists(conn, tableName) {
  try {
    const [rows] = await conn.query("SHOW TABLES LIKE ?", [tableName]);
    return rows.length > 0;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Recipient / Metadata                                                       */
/* -------------------------------------------------------------------------- */

function buildRecipientSnapshot(payload = {}) {
  const fullName =
    firstText(
      payload,
      [
        "full_name",
        "full_name_snapshot",
        "payer_name",
        "donor_name",
        "guest_name",
        "member_name",
        "cardholder_name",
      ],
      255
    ) || "Guest / Donor";

  const email =
    firstText(
      payload,
      [
        "email",
        "email_snapshot",
        "payer_email",
        "donor_email",
        "guest_email",
        "member_email",
      ],
      190
    ) || null;

  const phone =
    firstText(
      payload,
      [
        "phone",
        "phone_snapshot",
        "payer_phone",
        "donor_phone",
        "guest_phone",
        "member_phone",
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

function buildEnterpriseMetadata(payload = {}, normalized = {}) {
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

    invoice: {
      invoice_number: normalized.invoice_number,
      status: normalized.status,
      total_amount: normalized.total_amount,
      paid_amount: normalized.paid_amount,
      balance_due: normalized.balance_due,
    },

    pledge: {
      pledge_id: normalized.pledge_id || null,
      pledge_number: normalized.pledge_number || null,
      pledged_amount: normalized.pledged_amount || null,
      remaining_balance: normalized.remaining_balance || null,
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

    payment: {
      payment_id: normalized.payment_id || null,
      payment_number: normalized.payment_number || null,
      method: normalized.method || normalized.payment_method || null,
      provider: normalized.provider || normalized.payment_provider || null,
      reference_no: normalized.reference_no || null,
      transaction_reference: normalized.transaction_reference || null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Normalize                                                                  */
/* -------------------------------------------------------------------------- */

function normalizeInvoicePayload(payload = {}) {
  const paymentType = normalizeType(
    payload.payment_type ||
      payload.category ||
      payload.invoice_type ||
      "other"
  );

  const totalAmount = money(
    payload.total_amount ||
      payload.amount ||
      payload.invoice_amount ||
      0
  );

  const paidAmount = money(
    payload.paid_amount ||
      payload.amount_paid ||
      (payload.status === "paid" ? totalAmount : 0)
  );

  const balanceDue = Math.max(money(totalAmount - paidAmount), 0);

  const participants =
    payload.participants ||
    parseJsonArray(payload.participants_json);

  const status = statusFromAmounts(
    totalAmount,
    paidAmount,
    payload.status ||
      payload.invoice_status
  );

  const recipient = buildRecipientSnapshot(payload);

  return {
    ...payload,

    payment_type: paymentType,
    category: paymentType,

    invoice_number:
      payload.invoice_number ||
      invoiceNumber(),

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

    amount: totalAmount,
    total_amount: totalAmount,
    paid_amount: paidAmount,
    amount_paid: paidAmount,
    balance_due: balanceDue,
    remaining_amount: balanceDue,

    status,

    currency:
      clean(payload.currency || "USD", 10).toUpperCase(),

    sub_category:
      payload.sub_category ||
      payload.donation_category ||
      payload.program_name ||
      payload.program_title ||
      payload.campaign_name ||
      payload.plan_name ||
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

    payment_method:
      payload.payment_method ||
      payload.method ||
      null,

    method:
      payload.method ||
      payload.payment_method ||
      null,

    provider:
      payload.provider ||
      payload.payment_provider ||
      null,

    payment_provider:
      payload.payment_provider ||
      payload.provider ||
      null,

    reference_no:
      payload.reference_no ||
      payload.reference_number ||
      null,

    transaction_reference:
      payload.transaction_reference ||
      payload.reference_no ||
      payload.reference_number ||
      null,

    description:
      payload.description ||
      buildInvoiceDescription({
        ...payload,
        payment_type: paymentType,
        participants,
      }),
  };
}

/* -------------------------------------------------------------------------- */
/* Descriptions / Items                                                       */
/* -------------------------------------------------------------------------- */

function buildInvoiceDescription(payload = {}) {
  const type = normalizeType(payload.payment_type || payload.category);

  if (type === "membership") {
    return [
      "Membership dues",
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
      "School program registration",
      payload.program_name || payload.program_title,
      payload.pricing_tier_label,
    ]
      .filter(Boolean)
      .join(" - ");
  }

  if (type === "trip") {
    return [
      "Trip registration",
      payload.program_name || payload.program_title,
      payload.pricing_tier_label,
    ]
      .filter(Boolean)
      .join(" - ");
  }

  if (type === "pledge") {
    return [
      "Pledge invoice",
      payload.campaign_name,
      payload.pledge_number,
    ]
      .filter(Boolean)
      .join(" - ");
  }

  return "Finance invoice";
}

function buildInvoiceItems(payload = {}) {
  const type = normalizeType(payload.payment_type || payload.category);
  const items = [];

  if (type === "membership") {
    if (money(payload.registration_fee) > 0) {
      items.push({
        item_type: "registration_fee",
        item_name: "Registration Fee",
        description: "New member registration fee",
        quantity: 1,
        unit_price: money(payload.registration_fee),
        total_price: money(payload.registration_fee),
      });
    }

    const membershipAmount = money(
      payload.membership_amount ||
        payload.amount
    );

    if (membershipAmount > 0) {
      const months = Number(payload.months_paid || payload.duration_months || 1) || 1;

      items.push({
        item_type: "membership",
        item_name:
          payload.plan_name ||
          "Membership Dues",
        description:
          payload.coverage_label ||
          "Membership coverage",
        quantity: months,
        unit_price: money(membershipAmount / months),
        total_price: membershipAmount,
      });
    }

    if (money(payload.processing_fee) > 0) {
      items.push({
        item_type: "processing_fee",
        item_name: "Processing Fee",
        description: "Online payment processing fee",
        quantity: 1,
        unit_price: money(payload.processing_fee),
        total_price: money(payload.processing_fee),
      });
    }

    return items;
  }

  if (type === "school" || type === "trip") {
    const names = participantNames(payload.participants || payload.participants_json);
    const quantity = Number(payload.quantity || names.length || 1) || 1;
    const total = money(payload.amount || payload.total_amount);

    items.push({
      item_type: type,
      item_name:
        type === "school"
          ? "School Program Registration"
          : "Trip Registration",
      description:
        [
          payload.program_name || payload.program_title,
          payload.pricing_tier_label,
          names.length ? `Participants: ${names.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join(" - "),
      quantity,
      unit_price:
        money(
          payload.price_per_person ||
            total / quantity
        ),
      total_price: total,
      metadata_json: safeJson({
        registration_id: payload.registration_id || null,
        news_event_id: payload.news_event_id || payload.related_entity_id || null,
        program_id: payload.program_id || payload.news_event_id || null,
        pricing_tier_id: payload.pricing_tier_id || null,
        pricing_tier_label: payload.pricing_tier_label || null,
        participants: payload.participants || [],
      }),
    });

    return items;
  }

  if (type === "donation") {
    items.push({
      item_type: "donation",
      item_name:
        payload.donation_category_label ||
        payload.donation_category ||
        payload.sub_category ||
        "Donation",
      description:
        payload.description ||
        "Church donation",
      quantity: 1,
      unit_price: money(payload.amount),
      total_price: money(payload.amount),
    });

    return items;
  }

  if (type === "pledge") {
    items.push({
      item_type: "pledge",
      item_name:
        payload.campaign_name ||
        payload.pledge_number ||
        "Pledge Payment",
      description:
        payload.description ||
        "Pledge invoice",
      quantity: 1,
      unit_price: money(payload.amount),
      total_price: money(payload.amount),
      metadata_json: safeJson({
        pledge_id: payload.pledge_id || null,
        pledge_number: payload.pledge_number || null,
        campaign_id: payload.campaign_id || null,
        campaign_name: payload.campaign_name || null,
      }),
    });

    return items;
  }

  items.push({
    item_type: type || "other",
    item_name:
      payload.sub_category ||
      "Finance Payment",
    description:
      payload.description ||
      "Finance invoice",
    quantity: 1,
    unit_price: money(payload.amount),
    total_price: money(payload.amount),
  });

  return items;
}

async function createInvoiceItems(conn, invoiceId, payload) {
  if (!(await tableExists(conn, ITEM_TABLE))) {
    return [];
  }

  const items = buildInvoiceItems(payload);
  const ids = [];

  for (const item of items) {
    const result = await insertExistingColumns(conn, ITEM_TABLE, {
      invoice_id: invoiceId,

      item_type: item.item_type,
      item_name: item.item_name,
      description: item.description,

      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,

      metadata_json: item.metadata_json || null,

      created_at: mysqlNow(),
      updated_at: mysqlNow(),
    });

    ids.push(result?.insertId || result);
  }

  return ids;
}

/* -------------------------------------------------------------------------- */
/* Main Generator                                                             */
/* -------------------------------------------------------------------------- */

async function generateInvoice(conn, payload = {}) {
  const normalized = normalizeInvoicePayload(payload);
  const enterpriseMetadata = buildEnterpriseMetadata(payload, normalized);

  const result = await insertExistingColumns(conn, INVOICE_TABLE, {
    invoice_number: normalized.invoice_number,

    member_id: normalized.member_id,
    member_no: normalized.member_no,

    full_name_snapshot: normalized.full_name,
    email_snapshot: normalized.email,
    phone_snapshot: normalized.phone,

    payer_type: normalized.payer_type,

    invoice_type: normalized.payment_type,
    payment_type: normalized.payment_type,
    category: normalized.category,
    sub_category: normalized.sub_category,
    donation_category: normalized.donation_category || null,

    amount: normalized.amount,
    invoice_amount: normalized.amount,
    total_amount: normalized.total_amount,
    paid_amount: normalized.paid_amount,
    amount_paid: normalized.amount_paid,
    balance_due: normalized.balance_due,
    remaining_amount: normalized.remaining_amount,
    currency: normalized.currency,

    status: normalized.status,
    invoice_status: normalized.status,
    payment_status: normalized.status,

    payment_id: normalized.payment_id || null,
    payment_number: normalized.payment_number || null,

    payment_method: normalized.payment_method || normalized.method || null,
    method: normalized.method || normalized.payment_method || null,
    provider: normalized.provider || normalized.payment_provider || null,
    payment_provider: normalized.payment_provider || normalized.provider || null,
    reference_no: normalized.reference_no || null,
    transaction_reference: normalized.transaction_reference || null,

    pledge_id: normalized.pledge_id,
    pledge_number: normalized.pledge_number,
    pledged_amount: normalized.pledged_amount,

    campaign_id: normalized.campaign_id,
    campaign_name: normalized.campaign_name,
    campaign_code: normalized.campaign_code,

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

    description: normalized.description,
    notes: normalized.notes || normalized.note || null,

    source: normalized.source || normalized.created_from || null,
    created_from: normalized.created_from || normalized.source || null,

    due_date:
      normalized.due_date ||
      normalized.invoice_due_date ||
      mysqlNow(),

    issued_at:
      normalized.issued_at ||
      mysqlNow(),

    paid_at:
      normalized.status === "paid"
        ? normalized.paid_at || mysqlNow()
        : null,

    metadata_json:
      safeJson({
        ...(payload.metadata || {}),
        ...enterpriseMetadata,
      }),

    created_by:
      normalized.created_by ||
      normalized.actor_id ||
      null,

    created_at: mysqlNow(),
    updated_at: mysqlNow(),
  });

  const id = result?.insertId || result;

  await createInvoiceItems(conn, id, normalized).catch((err) => {
    console.error("createInvoiceItems failed:", err.message);
  });

  return {
    id,
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
    paid_amount: normalized.paid_amount,
    balance_due: normalized.balance_due,
    currency: normalized.currency,

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
      ...(payload.metadata || {}),
      ...enterpriseMetadata,
    }),
  };
}

module.exports = {
  generateInvoice,
  buildInvoiceItems,
  buildInvoiceDescription,
  normalizeInvoicePayload,
  buildRecipientSnapshot,
  buildEnterpriseMetadata,
};