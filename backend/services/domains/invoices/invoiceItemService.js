// backend/services/domains/invoices/invoiceItemService.js
"use strict";

const db = require("../../../db");

const {
  insertExistingColumns,
} = require("../../../utils/dbHelpers");

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const CATEGORY_CODES = {
  membership: "MEM",
  membership_dues: "MEM",
  registration_fee: "REG",
  donation: "DON",
  school: "SCH",
  trip: "TRIP",
  pledge: "PLG",
  manual: "MAN",
  processing_fee: "FEE",
  payment_reminder: "REM",
  membership_dues_reminder: "DUE",
  pledge_reminder: "PLG",
  donation_promise: "DON",
};

const MONTH_NAMES = [
  null,
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clean(value, max = 500) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function toPositiveInt(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
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

function asArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  return parseJson(value, fallback);
}

function normalizeCategory(value) {
  const raw = clean(value || "manual", 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  if (["dues", "membership_payment", "membership_dues"].includes(raw)) {
    return "membership";
  }

  if (["kids", "kids_school", "school_program"].includes(raw)) {
    return "school";
  }

  if (["pledge_payment", "campaign_pledge"].includes(raw)) {
    return "pledge";
  }

  return raw || "manual";
}

function monthLabel(value) {
  if (!value) return "";

  if (typeof value === "object") {
    const month =
      value.month_name ||
      value.month_label ||
      value.label ||
      MONTH_NAMES[Number(value.month_number || value.month)] ||
      value.month;

    const year =
      value.coverage_year ||
      value.year ||
      value.membership_year ||
      "";

    return clean(`${month || ""}${year ? ` ${year}` : ""}`, 40);
  }

  const n = Number(value);
  if (Number.isFinite(n) && n >= 1 && n <= 12) {
    return MONTH_NAMES[n];
  }

  return clean(value, 40);
}

function coverageMonthsFromPayload(payload = {}) {
  const fromArray =
    asArray(payload.coverage_months, null) ||
    asArray(payload.coverage_months_json, null) ||
    asArray(payload.membership_months, null) ||
    asArray(payload.months, []);

  return fromArray
    .map((month) => {
      if (typeof month === "object") {
        return {
          ...month,
          label: monthLabel(month),
        };
      }

      return {
        value: month,
        label: monthLabel(month),
      };
    })
    .filter((month) => month.label);
}

function coverageLabelFromPayload(payload = {}) {
  const explicit = clean(
    payload.coverage_label ||
      payload.membership_coverage_label ||
      payload.coverage_description ||
      "",
    500
  );

  if (explicit) return explicit;

  const months = coverageMonthsFromPayload(payload);
  if (months.length) {
    return months.map((month) => month.label).join(", ");
  }

  const start =
    payload.coverage_start_month ||
    payload.start_month ||
    payload.coverage_from;

  const end =
    payload.coverage_end_month ||
    payload.end_month ||
    payload.coverage_to;

  const year =
    payload.coverage_year ||
    payload.membership_year ||
    new Date().getFullYear();

  if (start && end) {
    return `${monthLabel(start)} ${year} - ${monthLabel(end)} ${year}`;
  }

  return "";
}

function participantList(payload = {}) {
  return (
    asArray(payload.participants, null) ||
    asArray(payload.participants_json, null) ||
    asArray(payload.student_names_json, null) ||
    asArray(payload.registrants_json, [])
  );
}

function participantSummary(participants = []) {
  const names = participants
    .map((person) => {
      if (typeof person === "string") return clean(person, 120);

      return clean(
        person.full_name ||
          person.name ||
          person.student_name ||
          `${person.first_name || ""} ${person.last_name || ""}`,
        120
      );
    })
    .filter(Boolean);

  if (!names.length) return "";

  if (names.length <= 3) {
    return names.join(", ");
  }

  return `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
}

function amountFromItem(payload = {}) {
  const quantity = toPositiveInt(payload.quantity, 1);

  const unitPrice = money(
    payload.unit_price ??
      payload.price ??
      payload.price_per_person ??
      payload.amount ??
      payload.total_amount ??
      payload.total_price ??
      0
  );

  const explicitTotal =
    payload.total_price ??
    payload.total_amount ??
    payload.line_total ??
    null;

  const total =
    explicitTotal !== null && explicitTotal !== undefined
      ? money(explicitTotal)
      : money(quantity * unitPrice);

  return {
    quantity,
    unitPrice,
    total,
  };
}

function metadataObject(payload = {}) {
  return {
    code: payload.code || payload.item_code || null,
    category: payload.category || payload.payment_type || null,
    sub_category: payload.sub_category || null,

    coverage_label: payload.coverage_label || null,
    coverage_months:
      payload.coverage_months ||
      payload.membership_months ||
      null,

    donation_category: payload.donation_category || null,
    donation_category_label: payload.donation_category_label || null,

    program_id: payload.program_id || payload.news_event_id || null,
    program_name: payload.program_name || payload.program_title || null,
    program_category: payload.program_category || payload.category || null,
    registration_id: payload.registration_id || null,
    pricing_tier_id: payload.pricing_tier_id || null,
    pricing_tier_label: payload.pricing_tier_label || null,
    participants:
      payload.participants ||
      parseJson(payload.participants_json, []),

    pledge_id: payload.pledge_id || null,
    pledge_number: payload.pledge_number || null,
    campaign_id: payload.campaign_id || null,
    campaign_name: payload.campaign_name || null,

    reminder_eligible:
      payload.reminder_eligible !== undefined
        ? Boolean(payload.reminder_eligible)
        : null,
    reminder_type: payload.reminder_type || null,
    payment_link: payload.payment_link || null,
    invoice_link: payload.invoice_link || null,

    ...(payload.metadata || {}),
  };
}

function itemMeta(payload = {}) {
  return safeJson(metadataObject(payload), null);
}

function normalizeItem(payload = {}) {
  const { quantity, unitPrice, total } = amountFromItem(payload);

  const itemType = clean(
    payload.item_type ||
      payload.type ||
      payload.category ||
      payload.payment_type ||
      "payment",
    80
  );

  const itemName = clean(
    payload.item_name ||
      payload.name ||
      payload.title ||
      payload.plan_name ||
      payload.program_name ||
      payload.campaign_name ||
      "Finance Payment",
    180
  );

  const description = clean(
    payload.description ||
      payload.notes ||
      payload.detail ||
      payload.coverage_label ||
      "Finance item",
    1000
  );

  const code =
    clean(payload.code || payload.item_code || "", 40) ||
    CATEGORY_CODES[normalizeCategory(itemType)] ||
    "ITEM";

  return {
    code,
    item_type: itemType,
    item_name: itemName,
    description,
    quantity,
    unit_price: unitPrice,
    total_price: total,
    amount: total,
    total_amount: total,
    metadata_json:
      safeJson(payload.metadata_json, null) ||
      itemMeta(payload),
  };
}

/* -------------------------------------------------------------------------- */
/* Create / Read                                                              */
/* -------------------------------------------------------------------------- */

async function createInvoiceItem(conn, payload = {}) {
  const invoiceId = Number(payload.invoice_id || payload.invoiceId || 0);

  if (!conn || typeof conn.query !== "function") {
    throw new Error("A database transaction connection is required.");
  }

  if (!invoiceId) {
    throw new Error("invoice_id is required to create an invoice item.");
  }

  const item = normalizeItem(payload);

  const result = await insertExistingColumns(
    conn,
    "tbl_finance_invoice_items",
    {
      invoice_id: invoiceId,

      code: item.code,
      item_code: item.code,

      item_type: item.item_type,
      type: item.item_type,

      item_name: item.item_name,
      name: item.item_name,

      description: item.description,

      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      amount: item.amount,
      total_amount: item.total_amount,

      metadata_json: item.metadata_json,

      created_at: new Date(),
      updated_at: new Date(),
    }
  );

  return Number(result?.insertId || result || 0);
}

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

/* -------------------------------------------------------------------------- */
/* Builders                                                                   */
/* -------------------------------------------------------------------------- */

function buildMembershipInvoiceItems(payload = {}) {
  const items = [];

  const coverageMonths = coverageMonthsFromPayload(payload);
  const coverageLabel = coverageLabelFromPayload(payload);

  const registrationFee = money(payload.registration_fee || 0);

  const membershipAmount = money(
    payload.membership_amount ??
      payload.dues_amount ??
      payload.base_amount ??
      payload.amount ??
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
      item_type: "membership",
      item_name:
        payload.plan_name ||
        payload.membership_plan ||
        "Membership Dues",
      description: coverageLabel
        ? `Membership coverage: ${coverageLabel}`
        : "Membership dues",
      quantity: 1,
      unit_price: membershipAmount,
      total_price: membershipAmount,
      coverage_label: coverageLabel,
      coverage_months: coverageMonths,
      metadata: {
        plan_id:
          payload.plan_id ||
          payload.dues_plan_id ||
          payload.membership_plan_id ||
          null,
        plan_name: payload.plan_name || null,
        months_paid:
          payload.months_paid ||
          payload.duration_months ||
          coverageMonths.length ||
          null,
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
    const amount = money(payload.amount || payload.total_amount || 0);

    items.push({
      code: "MEM",
      item_type: "membership",
      item_name: payload.plan_name || "Membership Payment",
      description: coverageLabel || "Membership payment",
      quantity: 1,
      unit_price: amount,
      total_price: amount,
      coverage_label: coverageLabel,
      coverage_months: coverageMonths,
      metadata: {
        reminder_eligible: true,
        reminder_type: "membership_dues",
      },
    });
  }

  return items;
}

function buildDonationInvoiceItems(payload = {}) {
  const amount = money(
    payload.amount ||
      payload.total_amount ||
      payload.balance_due ||
      payload.remaining_amount ||
      0
  );

  const promised = Boolean(
    payload.promise_to_give ||
      payload.promise_to_donate ||
      payload.is_promise ||
      payload.invoice_only
  );

  return [
    {
      code: "DON",
      item_type: promised ? "donation_promise" : "donation",
      item_name:
        payload.donation_category_label ||
        payload.donation_category ||
        payload.fund_name ||
        "Donation",
      description:
        payload.description ||
        payload.notes ||
        "Church donation",
      quantity: 1,
      unit_price: amount,
      total_price: amount,
      donation_category: payload.donation_category || null,
      donation_category_label:
        payload.donation_category_label || null,
      metadata: {
        fund_name: payload.fund_name || null,
        reminder_eligible: promised,
        reminder_type: promised ? "donation_promise" : null,
        payment_link: payload.payment_link || null,
      },
    },
  ];
}

function buildProgramInvoiceItems(payload = {}) {
  const participants = participantList(payload);

  const quantity = toPositiveInt(
    payload.quantity ||
      payload.participant_count ||
      payload.student_count ||
      participants.length ||
      1,
    1
  );

  const totalAmount = money(
    payload.total_amount ??
      payload.amount ??
      0
  );

  const explicitUnit = money(
    payload.unit_price ||
      payload.price_per_person ||
      payload.price ||
      0
  );

  const unitPrice =
    explicitUnit > 0
      ? explicitUnit
      : quantity > 0
        ? money(totalAmount / quantity)
        : totalAmount;

  const totalPrice =
    totalAmount > 0
      ? totalAmount
      : money(unitPrice * quantity);

  const category = normalizeCategory(
    payload.category ||
      payload.program_category ||
      payload.payment_type ||
      "program"
  );

  const label =
    payload.program_title ||
    payload.program_name ||
    (category === "trip"
      ? "Trip Registration"
      : "School Registration");

  const participantText = participantSummary(participants);

  return [
    {
      code: category === "trip" ? "TRIP" : "SCH",
      item_type: category,
      item_name: label,
      description:
        payload.description ||
        (participantText
          ? `Participants: ${participantText}`
          : "Program registration"),
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      program_name: payload.program_name || payload.program_title || null,
      program_category: category,
      registration_id: payload.registration_id || null,
      pricing_tier_id: payload.pricing_tier_id || null,
      pricing_tier_label: payload.pricing_tier_label || null,
      participants,
      metadata: {
        participants,
        participant_count: quantity,
        pricing_tier_id: payload.pricing_tier_id || null,
        pricing_tier_label: payload.pricing_tier_label || null,
        reminder_eligible: true,
        reminder_type: `${category}_payment`,
        payment_link: payload.payment_link || null,
      },
    },
  ];
}

function buildPledgeInvoiceItems(payload = {}) {
  const amount = money(
    payload.amount ||
      payload.total_amount ||
      payload.balance_due ||
      payload.remaining_amount ||
      payload.pledged_amount ||
      0
  );

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
      pledge_number: payload.pledge_number || null,
      campaign_id: payload.campaign_id || null,
      campaign_name: payload.campaign_name || null,
      metadata: {
        pledged_amount: payload.pledged_amount || null,
        paid_amount: payload.paid_amount || null,
        remaining_amount:
          payload.remaining_amount ||
          payload.balance_due ||
          null,
        reminder_eligible: true,
        reminder_type: "pledge",
        payment_link: payload.payment_link || null,
        invoice_link: payload.invoice_link || null,
      },
    },
  ];
}

function buildManualInvoiceItems(payload = {}) {
  const amount = money(payload.amount || payload.total_amount || 0);

  return [
    {
      code: "MAN",
      item_type: payload.payment_type || payload.category || "manual",
      item_name: payload.item_name || "Manual Payment",
      description:
        payload.description ||
        payload.notes ||
        "Manual finance payment",
      quantity: 1,
      unit_price: amount,
      total_price: amount,
      metadata: {
        payment_method:
          payload.payment_method ||
          payload.method ||
          "manual",
        reference_no:
          payload.reference_no ||
          payload.reference_number ||
          payload.transaction_reference ||
          null,
        reminder_eligible: false,
      },
    },
  ];
}

function buildReminderInvoiceItems(payload = {}) {
  const reminderType = normalizeCategory(
    payload.reminder_type ||
      payload.type ||
      payload.payment_type ||
      "payment_reminder"
  );

  const amount = money(
    payload.amount ||
      payload.balance_due ||
      payload.remaining_amount ||
      payload.total_amount ||
      0
  );

  let code = "REM";
  if (reminderType === "membership") code = "DUE";
  if (reminderType === "pledge") code = "PLG";
  if (reminderType === "donation") code = "DON";

  return [
    {
      code,
      item_type: `${reminderType}_reminder`,
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

function buildPaymentInvoiceItems(payload = {}) {
  const category = normalizeCategory(
    payload.payment_type ||
      payload.category ||
      payload.item_type ||
      payload.type
  );

  if (category === "membership") {
    return buildMembershipInvoiceItems(payload);
  }

  if (category === "donation") {
    return buildDonationInvoiceItems(payload);
  }

  if (category === "school" || category === "trip") {
    return buildProgramInvoiceItems({
      ...payload,
      category,
    });
  }

  if (category === "pledge") {
    return buildPledgeInvoiceItems(payload);
  }

  return buildManualInvoiceItems(payload);
}

/* -------------------------------------------------------------------------- */
/* Exports                                                                    */
/* -------------------------------------------------------------------------- */

module.exports = {
  createInvoiceItem,
  createInvoiceItems,
  getInvoiceItems,

  buildMembershipInvoiceItems,
  buildDonationInvoiceItems,
  buildProgramInvoiceItems,
  buildPledgeInvoiceItems,
  buildManualInvoiceItems,
  buildReminderInvoiceItems,
  buildPaymentInvoiceItems,

  normalizeItem,
  normalizeCategory,
};