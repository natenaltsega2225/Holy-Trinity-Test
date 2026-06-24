// backend/services/domains/invoices/invoiceItemService.js
"use strict";

const db = require("../../../db");

const {
  insertExistingColumns,
} = require("../../../utils/dbHelpers");

/* =========================================================
   HELPERS
========================================================= */

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
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

function amountFromItem(payload = {}) {
  const quantity = Number(payload.quantity || 1) || 1;
  const unitPrice = money(
    payload.unit_price ||
      payload.price ||
      payload.amount ||
      payload.total_amount ||
      payload.total_price ||
      0
  );

  const explicitTotal = payload.total_price ?? payload.total_amount ?? payload.amount;

  return {
    quantity,
    unitPrice,
    total: explicitTotal !== undefined ? money(explicitTotal) : money(quantity * unitPrice),
  };
}

function itemMeta(payload = {}) {
  return safeJson(
    {
      code: payload.code || payload.item_code || null,
      category: payload.category || null,
      sub_category: payload.sub_category || null,
      coverage_label: payload.coverage_label || null,
      coverage_months: payload.coverage_months || null,
      coverage_months_json: payload.coverage_months_json || null,
      donation_category: payload.donation_category || null,
      program_name: payload.program_name || null,
      registration_id: payload.registration_id || null,
      pledge_id: payload.pledge_id || null,
      campaign_id: payload.campaign_id || null,
      payment_link: payload.payment_link || null,
      invoice_link: payload.invoice_link || null,
      reminder_type: payload.reminder_type || null,
      ...payload.metadata,
    },
    null
  );
}

function normalizeItem(payload = {}) {
  const { quantity, unitPrice, total } = amountFromItem(payload);

  return {
    code: clean(payload.code || payload.item_code || "", 40) || null,
    item_type: clean(payload.item_type || payload.type || "payment", 80),
    item_name: clean(payload.item_name || payload.name || "Payment", 180),
    description: clean(payload.description || payload.notes || "Finance item", 1000),
    quantity,
    unit_price: unitPrice,
    total_price: total,
    amount: total,
    total_amount: total,
    metadata_json: payload.metadata_json || itemMeta(payload),
  };
}

/* =========================================================
   CREATE ITEM
========================================================= */

async function createInvoiceItem(conn, payload = {}) {
  const item = normalizeItem(payload);

  const id = await insertExistingColumns(conn, "tbl_finance_invoice_items", {
    invoice_id: payload.invoice_id,

    code: item.code,
    item_code: item.code,

    item_type: item.item_type,
    item_name: item.item_name,
    description: item.description,

    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
    amount: item.amount,
    total_amount: item.total_amount,

    metadata_json: item.metadata_json,

    created_at: new Date(),
    updated_at: new Date(),
  });

  return Number(id?.insertId || id || 0);
}

/* =========================================================
   CREATE BULK ITEMS
========================================================= */

async function createInvoiceItems(conn, invoiceId, items = []) {
  const ids = [];

  for (const item of items.filter(Boolean)) {
    const id = await createInvoiceItem(conn, {
      ...item,
      invoice_id: invoiceId,
    });

    if (id) ids.push(id);
  }

  return ids;
}

/* =========================================================
   GET ITEMS
========================================================= */

async function getInvoiceItems(invoiceId) {
  const [rows] = await db.query(
    `
    SELECT *
    FROM tbl_finance_invoice_items
    WHERE invoice_id = ?
    ORDER BY id ASC
    `,
    [invoiceId]
  );

  return rows;
}

/* =========================================================
   BUILD MEMBERSHIP ITEMS
========================================================= */

function buildMembershipInvoiceItems(payload = {}) {
  const items = [];

  const coverageMonths = Array.isArray(payload.coverage_months)
    ? payload.coverage_months
    : parseJson(payload.coverage_months_json, []);

  const coverageLabel =
    payload.coverage_label ||
    (coverageMonths.length
      ? coverageMonths
          .map((m) => m.label || `${m.month_name || m.month} ${m.year}`)
          .join(", ")
      : "");

  const registrationFee = money(payload.registration_fee || 0);
  const membershipAmount = money(
    payload.membership_amount ||
      payload.base_amount ||
      payload.amount ||
      0
  );
  const processingFee = money(payload.processing_fee || 0);

  if (registrationFee > 0) {
    items.push({
      code: "REG",
      item_type: "registration_fee",
      item_name: "First-Time Registration Fee",
      description: "New member registration fee",
      quantity: 1,
      unit_price: registrationFee,
      total_price: registrationFee,
      metadata: {
        reminder_eligible: false,
      },
    });
  }

  if (membershipAmount > 0) {
    items.push({
      code: "MEM",
      item_type: "membership_dues",
      item_name: payload.plan_name || "Membership Dues",
      description: coverageLabel
        ? `Membership coverage: ${coverageLabel}`
        : "Membership dues",
      quantity: 1,
      unit_price: membershipAmount,
      total_price: membershipAmount,
      coverage_label: coverageLabel,
      coverage_months,
      coverage_months_json: payload.coverage_months_json || null,
      metadata: {
        reminder_eligible: true,
        reminder_type: "membership_dues",
      },
    });
  }

  if (processingFee > 0) {
    items.push({
      code: "FEE",
      item_type: "processing_fee",
      item_name: "Processing Fee",
      description: "Payment processing fee",
      quantity: 1,
      unit_price: processingFee,
      total_price: processingFee,
      metadata: {
        reminder_eligible: false,
      },
    });
  }

  if (!items.length) {
    const amount = money(payload.amount || 0);

    items.push({
      code: "MEM",
      item_type: "membership",
      item_name: payload.plan_name || "Membership Payment",
      description: coverageLabel || "Membership payment",
      quantity: 1,
      unit_price: amount,
      total_price: amount,
      metadata: {
        reminder_eligible: true,
        reminder_type: "membership_dues",
      },
    });
  }

  return items;
}

/* =========================================================
   BUILD DONATION ITEM
========================================================= */

function buildDonationInvoiceItems(payload = {}) {
  const amount = money(payload.amount || payload.total_amount || 0);

  return [
    {
      code: "DON",
      item_type: "donation",
      item_name:
        payload.donation_category_label ||
        payload.donation_category ||
        "Donation",
      description:
        payload.description ||
        payload.notes ||
        "Church donation",
      quantity: 1,
      unit_price: amount,
      total_price: amount,
      donation_category: payload.donation_category || null,
      metadata: {
        reminder_eligible: Boolean(payload.promise_to_give || payload.promise_to_donate),
        reminder_type: "donation_promise",
        payment_link: payload.payment_link || null,
      },
    },
  ];
}

/* =========================================================
   BUILD PROGRAM ITEM
========================================================= */

function buildProgramInvoiceItems(payload = {}) {
  const quantity = Number(payload.quantity || 1) || 1;
  const amount = money(
    payload.unit_price ||
      payload.price_per_person ||
      payload.amount ||
      payload.total_amount ||
      0
  );

  const unitPrice =
    quantity > 1 && amount === money(payload.total_amount || payload.amount)
      ? money(amount / quantity)
      : amount;

  return [
    {
      code: payload.category === "trip" ? "TRIP" : "SCH",
      item_type: payload.category || "program",
      item_name:
        payload.program_title ||
        payload.program_name ||
        "Program Registration",
      description:
        payload.description ||
        payload.event_date ||
        "Program registration",
      quantity,
      unit_price: unitPrice,
      total_price: money(unitPrice * quantity),
      program_name: payload.program_name || payload.program_title || null,
      registration_id: payload.registration_id || null,
      metadata: {
        participants: payload.participants || parseJson(payload.participants_json, []),
        reminder_eligible: true,
        reminder_type: `${payload.category || "program"}_payment`,
        payment_link: payload.payment_link || null,
      },
    },
  ];
}

/* =========================================================
   BUILD PLEDGE ITEM
========================================================= */

function buildPledgeInvoiceItems(payload = {}) {
  const amount = money(payload.amount || payload.total_amount || payload.pledged_amount || 0);

  return [
    {
      code: "PLG",
      item_type: "pledge",
      item_name:
        payload.campaign_name ||
        payload.pledge_campaign ||
        "Pledge Payment",
      description:
        payload.description ||
        payload.coverage_label ||
        "Pledge promise/payment",
      quantity: 1,
      unit_price: amount,
      total_price: amount,
      pledge_id: payload.pledge_id || null,
      campaign_id: payload.campaign_id || null,
      metadata: {
        reminder_eligible: true,
        reminder_type: "pledge",
        payment_link: payload.payment_link || null,
        invoice_link: payload.invoice_link || null,
      },
    },
  ];
}

/* =========================================================
   BUILD REMINDER INVOICE ITEMS
   For dues reminders, pledge reminders, promised donations.
========================================================= */

function buildReminderInvoiceItems(payload = {}) {
  const reminderType = clean(payload.reminder_type || payload.type || "payment_reminder", 80);
  const amount = money(payload.amount || payload.balance_due || payload.remaining_amount || 0);

  return [
    {
      code:
        reminderType === "pledge"
          ? "PLG"
          : reminderType === "membership_dues"
            ? "DUE"
            : "REM",
      item_type: reminderType,
      item_name:
        payload.item_name ||
        payload.plan_name ||
        payload.campaign_name ||
        "Payment Reminder",
      description:
        payload.description ||
        payload.coverage_label ||
        "Outstanding balance reminder",
      quantity: 1,
      unit_price: amount,
      total_price: amount,
      coverage_label: payload.coverage_label || null,
      pledge_id: payload.pledge_id || null,
      campaign_id: payload.campaign_id || null,
      metadata: {
        reminder_eligible: true,
        reminder_type: reminderType,
        payment_link: payload.payment_link || null,
        invoice_link: payload.invoice_link || null,
        donor_type: payload.member_id ? "member" : "guest",
      },
    },
  ];
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  createInvoiceItem,
  createInvoiceItems,

  getInvoiceItems,

  buildMembershipInvoiceItems,
  buildDonationInvoiceItems,
  buildProgramInvoiceItems,
  buildPledgeInvoiceItems,
  buildReminderInvoiceItems,

  normalizeItem,
};