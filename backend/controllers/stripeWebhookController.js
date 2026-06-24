// backend/controllers/stripeWebhookController.js
"use strict";

const crypto = require("crypto");
const argon2 = require("argon2");
const Stripe = require("stripe");

const pool = require("../db");

const {
  insertExistingColumns,
  updateExistingColumns,
} = require("../utils/dbHelpers");

const paymentService = require("../services/paymentService");

const {
  sendMemberWelcomeEmail,
} = require("../services/memberWelcomeService");

let programRegistrationService = {};

try {
  programRegistrationService = require(
    "../services/domains/programs/programRegistrationService"
  );
} catch {
  programRegistrationService = {};
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const WEBHOOK_EVENT_TABLE = "tbl_stripe_webhook_events";
const columnCache = new Map();
/* -------------------------------------------------------------------------- */
/* Basic Helpers                                                              */
/* -------------------------------------------------------------------------- */

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function centsToMoney(value) {
  return money(Number(value || 0) / 100);
}

function boolFlag(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "y", "on"].includes(
    String(value).trim().toLowerCase()
  );
}

function safeStringify(value, max = 65000) {
  try {
    return JSON.stringify(value).slice(0, max);
  } catch {
    return null;
  }
}

function safeJsonParse(value, fallback = null) {
  try {
    if (!value) return fallback;
    if (typeof value === "object") return value;

    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function pad2(value) {
  return String(Number(value || 0)).padStart(2, "0");
}

function formatDateYMD(date) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join("-");
}

function parseCoverageMonth(value, fallbackYear = null) {
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
    const year = Number(fallbackYear || new Date().getFullYear());

    if (month >= 1 && month <= 12) {
      return { year, month };
    }
  }

  return null;
}

function mysqlMonthStart(value, fallbackYear = null) {
  const parsed = parseCoverageMonth(value, fallbackYear);
  if (!parsed) return null;

  return `${parsed.year}-${pad2(parsed.month)}-01`;
}

function mysqlMonthEnd(value, fallbackYear = null) {
  const parsed = parseCoverageMonth(value, fallbackYear);
  if (!parsed) return null;

  return formatDateYMD(new Date(parsed.year, parsed.month, 0));
}

function generateTemporaryPassword() {
  return crypto.randomBytes(10).toString("base64url");
}

async function hashPassword(password) {
  return argon2.hash(String(password), {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

function objectId(value) {
  if (!value) return null;
  if (typeof value === "string") return value;

  return value.id || null;
}

function normalizeFinanceCategory(value) {
  const text = clean(value, 80).toLowerCase();

  if (["kids", "kids_school", "school_program", "school"].includes(text)) {
    return "school";
  }

  if (["trip", "travel", "outing"].includes(text)) return "trip";

  if (["membership_dues", "dues", "registration_fee"].includes(text)) {
    return "membership";
  }

  if (["giving", "tithe", "offering"].includes(text)) return "donation";

  if (["membership", "pledge", "donation"].includes(text)) return text;

  if (["invoice", "public_invoice", "invoice_payment"].includes(text)) {
    return "invoice";
  }

  return text || "payment";
}

function normalizePayerType(value, memberId = null) {
  const text = clean(value, 80).toLowerCase();

  if (
    ["non_member", "non-member", "guest", "visitor", "donor"].includes(text)
  ) {
    return "non_member";
  }

  return memberId ? "member" : "non_member";
}

function mergeMetadata(...items) {
  const merged = {};

  for (const item of items) {
    if (!item) continue;

    const metadata = item.metadata || item;

    for (const [key, value] of Object.entries(metadata || {})) {
      if (value !== undefined && value !== null && value !== "") {
        merged[key] = value;
      }
    }
  }

  const snapshot = safeJsonParse(merged.snapshot_json, null);

  if (snapshot?.payer) {
    merged.full_name = merged.full_name || snapshot.payer.name;
    merged.email = merged.email || snapshot.payer.email;
    merged.phone = merged.phone || snapshot.payer.phone;
    merged.payer_type = merged.payer_type || snapshot.payer.type;
  }

  if (snapshot?.member) {
    merged.member_id = merged.member_id || snapshot.member.id;
    merged.member_no = merged.member_no || snapshot.member.no;
  }

  if (snapshot?.invoice) {
    merged.invoice_id = merged.invoice_id || snapshot.invoice.id;
    merged.invoice_number = merged.invoice_number || snapshot.invoice.no;
  }

  if (snapshot?.pledge) {
    merged.pledge_id = merged.pledge_id || snapshot.pledge.id;
    merged.pledge_number = merged.pledge_number || snapshot.pledge.no;
    merged.campaign_name = merged.campaign_name || snapshot.pledge.campaign;
  }

  if (snapshot?.program) {
    merged.program_id = merged.program_id || snapshot.program.id;
    merged.program_name = merged.program_name || snapshot.program.name;
    merged.registration_id =
      merged.registration_id || snapshot.program.registration_id;
    merged.pricing_tier_label =
      merged.pricing_tier_label || snapshot.program.tier;
  }

  return merged;
}

function isFinanceRegistration(payload = {}) {
  return (
    payload.checkout_type === "finance_new_member_registration" ||
    payload.created_from === "finance_registration" ||
    payload.source === "finance_registration" ||
    payload.source === "finance_new_member_registration" ||
    boolFlag(payload.activate_member_after_payment)
  );
}

function isPublicInvoicePayment(payload = {}) {
  return (
    payload.source === "public_invoice" ||
    payload.created_from === "public_invoice" ||
    Boolean(payload.invoice_id || payload.invoice_number)
  );
}

function paymentTypeFromMetadata(metadata = {}, base = {}) {
  return normalizeFinanceCategory(
    metadata.payment_type ||
      metadata.payment_kind ||
      metadata.type ||
      metadata.category ||
      base.payment_type ||
      base.category ||
      "payment"
  );
}

function inferPaymentMethod(metadata = {}, charge = null, base = {}) {
  const explicit = clean(
    metadata.payment_method ||
      metadata.method ||
      metadata.provider_method ||
      base.payment_method ||
      base.method ||
      "",
    80
  ).toLowerCase();

  if (["card", "ach", "cash", "check", "zelle"].includes(explicit)) {
    return explicit;
  }

  const details = charge?.payment_method_details || {};
  const type = clean(details.type || "", 80).toLowerCase();

  if (type === "card") return "card";
  if (type === "us_bank_account") return "ach";

  return explicit || "card";
}

function extractCharge(paymentIntentOrCharge) {
  if (!paymentIntentOrCharge) return null;

  if (paymentIntentOrCharge.object === "charge") {
    return paymentIntentOrCharge;
  }

  const latestCharge = paymentIntentOrCharge.latest_charge;

  if (latestCharge && typeof latestCharge === "object") {
    return latestCharge;
  }

  return null;
}

function extractPaymentMethodDetails(charge = null) {
  const details = charge?.payment_method_details || {};
  const card = details.card || {};
  const bank = details.us_bank_account || {};

  return {
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
}

function firstPositiveMoney(...values) {
  for (const value of values) {
    const amount = money(value);

    if (amount > 0) {
      return amount;
    }
  }

  return 0;
}

function stripePaidTotalFromSession(session, paymentIntent, latestInvoice) {
  return firstPositiveMoney(
    centsToMoney(session?.amount_total),
    centsToMoney(paymentIntent?.amount_received),
    centsToMoney(paymentIntent?.amount),
    centsToMoney(latestInvoice?.amount_paid)
  );
}

function stripePaidTotalFromInvoice(invoice, paymentIntent) {
  return firstPositiveMoney(
    centsToMoney(invoice?.amount_paid),
    centsToMoney(paymentIntent?.amount_received),
    centsToMoney(paymentIntent?.amount)
  );
}

function normalizeStripeAmountBreakdown({
  metadata = {},
  base = {},
  stripeTotal = 0,
  paymentType = "payment",
}) {
  const registrationFee = firstPositiveMoney(
    base.registration_fee,
    metadata.registration_fee
  );

  const membershipAmount = firstPositiveMoney(
    base.membership_amount,
    metadata.membership_amount
  );

  const explicitProcessingFee = firstPositiveMoney(
    base.processing_fee,
    metadata.processing_fee
  );

  let invoiceAmount = firstPositiveMoney(
    base.invoice_amount,
    metadata.invoice_amount,
    base.invoice_amount_applied,
    metadata.invoice_amount_applied,
    base.subtotal_amount,
    metadata.subtotal_amount,
    base.base_amount,
    metadata.base_amount
  );

  if (
    !invoiceAmount &&
    paymentType === "membership" &&
    (registrationFee > 0 || membershipAmount > 0)
  ) {
    invoiceAmount = money(registrationFee + membershipAmount);
  }

  if (
    !invoiceAmount &&
    explicitProcessingFee > 0 &&
    stripeTotal > explicitProcessingFee
  ) {
    invoiceAmount = money(stripeTotal - explicitProcessingFee);
  }

  if (!invoiceAmount) {
    const metadataAmount = firstPositiveMoney(metadata.amount, base.amount);
    const metadataTotal = firstPositiveMoney(metadata.total_amount, base.total_amount);

    invoiceAmount =
      metadataTotal > metadataAmount && metadataAmount > 0
        ? metadataAmount
        : stripeTotal;
  }

  let processingFee = explicitProcessingFee;

  if (!processingFee && stripeTotal > invoiceAmount) {
    processingFee = money(stripeTotal - invoiceAmount);
  }

  const totalPaid = firstPositiveMoney(
    stripeTotal,
    money(invoiceAmount + processingFee),
    metadata.total_amount,
    base.total_amount,
    metadata.amount,
    base.amount
  );

  return {
    invoice_amount: invoiceAmount,
    subtotal_amount: invoiceAmount,
    base_amount: invoiceAmount,
    processing_fee: processingFee,
    total_paid: totalPaid,
    membership_amount: membershipAmount,
    registration_fee: registrationFee,
  };
}

function buildReceiptAllocationRows({
  category,
  metadata = {},
  amounts = {},
  method = "card",
  reference = "--",
}) {
  const rows = [];
  const normalizedCategory = normalizeFinanceCategory(category);
  const invoiceAmount = money(amounts.invoice_amount || 0);
  const processingFee = money(amounts.processing_fee || 0);

  if (normalizedCategory === "membership") {
    const registrationFee = money(amounts.registration_fee || 0);
    const membershipAmount =
      money(amounts.membership_amount || 0) ||
      Math.max(0, money(invoiceAmount - registrationFee));

    if (registrationFee > 0) {
      rows.push({
        code: "REG",
        type: "Registration Fee",
        class: "Membership",
        description: "New member registration fee",
        amount: registrationFee,
        remark: reference,
      });
    }

    if (membershipAmount > 0) {
      rows.push({
        code: "01",
        type: "Membership Dues",
        class: "Membership",
        description: metadata.coverage_label
          ? `${metadata.plan_name || "Membership"} | ${metadata.coverage_label}`
          : metadata.plan_name || "Membership payment",
        amount: membershipAmount,
        remark: reference,
      });
    }
  } else if (normalizedCategory === "school") {
    rows.push({
      code: "14",
      type: "School Program",
      class: "School",
      description: metadata.program_name
        ? `School program: ${metadata.program_name}`
        : "School program payment",
      amount: invoiceAmount,
      remark: reference,
    });
  } else if (normalizedCategory === "trip") {
    rows.push({
      code: "15",
      type: "Trip Program",
      class: "Trip",
      description: metadata.program_name
        ? `Trip program: ${metadata.program_name}`
        : "Trip program payment",
      amount: invoiceAmount,
      remark: reference,
    });
  } else if (normalizedCategory === "pledge") {
    rows.push({
      code: "05",
      type: "Pledge Payment",
      class: "Pledge",
      description: metadata.campaign_name
        ? `Pledge campaign: ${metadata.campaign_name}`
        : "Pledge payment",
      amount: invoiceAmount,
      remark: reference,
    });
  } else {
    rows.push({
      code: "04",
      type: "Donation",
      class: "Donation",
      description:
        metadata.donation_category_label ||
        metadata.donation_category ||
        "Donation payment",
      amount: invoiceAmount,
      remark: reference,
    });
  }

  if (processingFee > 0) {
    rows.push({
      code: "PF",
      type: "Processing Fee",
      class: "Online Payment",
      description:
        method === "ach"
          ? "ACH / checking processing fee"
          : "Card processing fee",
      amount: processingFee,
      remark: reference,
    });
  }

  return rows.filter((row) => money(row.amount) > 0);
}
/* -------------------------------------------------------------------------- */
/* Table Helpers                                                              */
/* -------------------------------------------------------------------------- */


async function tableExists(connOrPool, tableName) {
  const [rows] = await connOrPool.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function tableColumns(connOrPool, tableName) {
  if (columnCache.has(tableName)) {
    return columnCache.get(tableName);
  }

  if (!(await tableExists(connOrPool, tableName))) {
    const empty = new Set();
    columnCache.set(tableName, empty);
    return empty;
  }

  const [rows] = await connOrPool.query(
    `SHOW COLUMNS FROM \`${tableName}\``
  );

  const columns = new Set(rows.map((row) => row.Field));
  columnCache.set(tableName, columns);

  return columns;
}

/* -------------------------------------------------------------------------- */
/* Webhook Idempotency                                                        */
/* -------------------------------------------------------------------------- */

async function startWebhookEvent(event) {
  try {
    if (!(await tableExists(pool, WEBHOOK_EVENT_TABLE))) {
      return true;
    }

    const columns = await tableColumns(pool, WEBHOOK_EVENT_TABLE);

    if (!columns.has("event_id")) {
      return true;
    }

    try {
      await insertExistingColumns(pool, WEBHOOK_EVENT_TABLE, {
        event_id: event.id,
        event_type: event.type,
        stripe_created_at: event.created
          ? new Date(event.created * 1000)
          : new Date(),
        status: "processing",
        payload_json: safeStringify(event),
        created_at: new Date(),
        updated_at: new Date(),
      });

      return true;
    } catch (err) {
      if (err.code !== "ER_DUP_ENTRY") {
        throw err;
      }

      const selectFields = ["event_id"];

      if (columns.has("status")) selectFields.push("status");
      if (columns.has("updated_at")) selectFields.push("updated_at");
      if (columns.has("processed_at")) selectFields.push("processed_at");

      const [rows] = await pool.query(
        `
        SELECT ${selectFields.join(", ")}
        FROM ${WEBHOOK_EVENT_TABLE}
        WHERE event_id = ?
        LIMIT 1
        `,
        [event.id]
      );

      const existing = rows[0] || {};
      const status = clean(existing.status, 40).toLowerCase();

      if (status === "processed") {
        return false;
      }

      const staleMinutes = Number(
        process.env.STRIPE_WEBHOOK_RETRY_STALE_MINUTES || 10
      );

      const updatedAt = existing.updated_at
        ? new Date(existing.updated_at).getTime()
        : 0;

      const isStale =
        !updatedAt ||
        Date.now() - updatedAt > staleMinutes * 60 * 1000;

      if (status === "failed" || status === "error" || isStale) {
        await updateExistingColumns(
          pool,
          WEBHOOK_EVENT_TABLE,
          {
            status: "processing",
            payload_json: safeStringify(event),
            updated_at: new Date(),
          },
          "event_id = ?",
          [event.id]
        );

        return true;
      }

      return false;
    }
  } catch (err) {
    console.error("stripe webhook event log start failed:", err);
    return true;
  }
}

async function finishWebhookEvent(event, status, details = {}) {
  try {
    if (!(await tableExists(pool, WEBHOOK_EVENT_TABLE))) {
      return;
    }

    const columns = await tableColumns(pool, WEBHOOK_EVENT_TABLE);

    if (!columns.has("event_id")) return;

    await updateExistingColumns(
      pool,
      WEBHOOK_EVENT_TABLE,
      {
        status,
        details_json: safeStringify(details),
        processed_at: new Date(),
        updated_at: new Date(),
      },
      "event_id = ?",
      [event.id]
    );
  } catch (err) {
    console.error("stripe webhook event log finish failed:", err);
  }
}

/* -------------------------------------------------------------------------- */
/* Stripe Hydration                                                           */
/* -------------------------------------------------------------------------- */

async function retrieveCheckoutSession(session) {
  if (!stripe || !session?.id) return session;

  try {
    return await stripe.checkout.sessions.retrieve(session.id, {
      expand: [
        "customer",
        "payment_intent",
        "payment_intent.latest_charge",
        "subscription",
        "subscription.latest_invoice",
        "subscription.latest_invoice.payment_intent",
        "subscription.latest_invoice.payment_intent.latest_charge",
      ],
    });
  } catch (err) {
    console.error("Stripe checkout session retrieve failed:", err.message);
    return session;
  }
}

async function retrieveInvoice(invoice) {
  if (!stripe || !invoice?.id) return invoice;

  try {
    return await stripe.invoices.retrieve(invoice.id, {
      expand: [
        "customer",
        "payment_intent",
        "payment_intent.latest_charge",
        "subscription",
      ],
    });
  } catch (err) {
    console.error("Stripe invoice retrieve failed:", err.message);
    return invoice;
  }
}

async function retrieveSubscription(subscriptionId) {
  if (!stripe || !subscriptionId) return null;

  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err) {
    console.error("Stripe subscription retrieve failed:", err.message);
    return null;
  }
}

async function buildPaymentMethodSummary(paymentIntentId, charge = null) {
  const local = extractPaymentMethodDetails(charge);

  if (
    typeof paymentService.retrieveCardSummary === "function" &&
    paymentIntentId
  ) {
    try {
      const remote = await paymentService.retrieveCardSummary(paymentIntentId);

      return {
        ...local,
        ...remote,
      };
    } catch (err) {
      console.error("retrieveCardSummary failed:", err.message);
    }
  }

  return local;
}

/* -------------------------------------------------------------------------- */
/* Payload Builders                                                           */
/* -------------------------------------------------------------------------- */

function basePayloadSafetyFlags(metadata = {}) {
  const payerType = normalizePayerType(
    metadata.payer_type,
    metadata.member_id
  );

  return {
    payer_type: payerType,

    skip_email_member_lookup:
      payerType === "non_member" || isPublicInvoicePayment(metadata),

    existing_invoice_payment:
      Boolean(metadata.invoice_id || metadata.invoice_number),

    linked_invoice_id:
      Number(metadata.invoice_id || 0) || null,

    process_direct_payment:
      metadata.process_direct_payment !== undefined
        ? boolFlag(metadata.process_direct_payment, true)
        : true,

    create_invoice:
      metadata.create_invoice !== undefined
        ? boolFlag(metadata.create_invoice, true)
        : true,

    create_receipt:
      metadata.create_receipt !== undefined
        ? boolFlag(metadata.create_receipt, true)
        : true,

    create_ledger_entry:
      metadata.create_ledger_entry !== undefined
        ? boolFlag(metadata.create_ledger_entry, true)
        : true,
  };
}



async function sessionToEnterprisePayload(session, event) {
  session = await retrieveCheckoutSession(session);

  const paymentIntent =
    typeof session.payment_intent === "object"
      ? session.payment_intent
      : null;

  const subscription =
    typeof session.subscription === "object"
      ? session.subscription
      : null;

  const latestInvoiceId = objectId(subscription?.latest_invoice);

  const latestInvoice =
    typeof subscription?.latest_invoice === "object"
      ? subscription.latest_invoice
      : latestInvoiceId
        ? await retrieveInvoice({ id: latestInvoiceId })
        : null;

  const invoicePaymentIntent =
    typeof latestInvoice?.payment_intent === "object"
      ? latestInvoice.payment_intent
      : null;

  const charge =
    extractCharge(paymentIntent) ||
    extractCharge(invoicePaymentIntent);

  const metadata = mergeMetadata(
    session.metadata,
    paymentIntent?.metadata,
    subscription?.metadata,
    latestInvoice?.metadata,
    invoicePaymentIntent?.metadata
  );

  const paymentIntentId =
    objectId(session.payment_intent) ||
    objectId(paymentIntent) ||
    objectId(latestInvoice?.payment_intent) ||
    objectId(invoicePaymentIntent);

  const methodSummary = await buildPaymentMethodSummary(
    paymentIntentId,
    charge
  );

  let base = {};

  if (typeof paymentService.sessionToPayload === "function") {
    try {
      base = paymentService.sessionToPayload(
        session,
        event,
        methodSummary
      ) || {};
    } catch (err) {
      console.error("paymentService.sessionToPayload failed:", err.message);
    }
  }

  const paymentType = paymentTypeFromMetadata(metadata, base);

  const source =
    metadata.source ||
    base.source ||
    "stripe";

  const method = inferPaymentMethod(metadata, charge, base);

  const category = normalizeFinanceCategory(
    metadata.category ||
      base.category ||
      paymentType
  );

  const stripeTotal = stripePaidTotalFromSession(
    session,
    paymentIntent,
    latestInvoice
  );

  const amounts = normalizeStripeAmountBreakdown({
    metadata,
    base,
    stripeTotal,
    paymentType: category,
  });

  const reference =
    charge?.id ||
    paymentIntentId ||
    session.id;

  const allocationRows = buildReceiptAllocationRows({
    category,
    metadata: {
      ...metadata,
      ...base,
    },
    amounts,
    method,
    reference,
  });

  const sendInvoiceDefault =
    source === "public_invoice" ||
    source === "public_invoice_checkout"
      ? false
      : base.send_invoice_email !== undefined
        ? boolFlag(base.send_invoice_email, true)
        : true;

  const safety = basePayloadSafetyFlags(metadata);

  return {
    ...metadata,
    ...base,
    ...methodSummary,
    ...safety,

    source,

    created_from:
      metadata.created_from ||
      base.created_from ||
      source ||
      "stripe_webhook",

    provider: "stripe",
    payment_provider: "stripe",

    payment_type: paymentType,
    category,

    amount: amounts.total_paid,
    total_amount: amounts.total_paid,
    paid_amount: amounts.total_paid,
    payment_amount: amounts.total_paid,

    invoice_amount: amounts.invoice_amount,
    invoice_amount_applied: amounts.invoice_amount,
    base_amount: amounts.base_amount,
    subtotal_amount: amounts.subtotal_amount,

    stripe_gross_amount: amounts.total_paid,
    stripe_paid_amount: amounts.total_paid,

    membership_amount:
      category === "membership"
        ? money(
            amounts.membership_amount ||
              base.membership_amount ||
              metadata.membership_amount ||
              Math.max(
                0,
                amounts.invoice_amount -
                  money(amounts.registration_fee || 0)
              )
          )
        : money(base.membership_amount || metadata.membership_amount || 0),

    registration_fee:
      money(amounts.registration_fee || base.registration_fee || metadata.registration_fee || 0),

    processing_fee:
      money(amounts.processing_fee || base.processing_fee || metadata.processing_fee || 0),

    allocation_rows: allocationRows,
    allocation_rows_json: safeStringify(allocationRows),
    receipt_items: allocationRows,
    receipt_items_json: safeStringify(allocationRows),
    items: allocationRows,
    items_json: safeStringify(allocationRows),

    payment_method: method,
    method,

    status: "paid",
    payment_status: "paid",

    stripe_event_id: event.id,
    stripe_event_type: event.type,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,

    stripe_subscription_id:
      objectId(session.subscription) ||
      objectId(subscription),

    stripe_invoice_id:
      objectId(latestInvoice) ||
      metadata.stripe_invoice_id ||
      base.stripe_invoice_id ||
      null,

    stripe_customer_id: objectId(session.customer),

    stripe_charge_id:
      charge?.id ||
      methodSummary.stripe_charge_id ||
      null,

    transaction_reference:
      charge?.balance_transaction ||
      charge?.id ||
      paymentIntentId ||
      session.id,

    reference_no:
      charge?.id ||
      paymentIntentId ||
      session.id,

    currency:
      String(
        session.currency ||
          paymentIntent?.currency ||
          latestInvoice?.currency ||
          base.currency ||
          "usd"
      ).toUpperCase(),

    email:
      metadata.email ||
      base.email ||
      session.customer_details?.email ||
      session.customer_email ||
      null,

    full_name:
      metadata.full_name ||
      metadata.member_name ||
      metadata.payer_name ||
      base.full_name ||
      session.customer_details?.name ||
      methodSummary.cardholder_name ||
      null,

    phone:
      metadata.phone ||
      base.phone ||
      session.customer_details?.phone ||
      null,

    participants_json:
      metadata.participants_json ||
      base.participants_json ||
      null,

    participants:
      safeJsonParse(metadata.participants_json, null) ||
      safeJsonParse(base.participants_json, null) ||
      base.participants ||
      [],

    send_receipt_email:
      metadata.send_receipt_email !== undefined
        ? boolFlag(metadata.send_receipt_email, true)
        : base.send_receipt_email !== undefined
          ? boolFlag(base.send_receipt_email, true)
          : true,

    send_invoice_email:
      metadata.send_invoice_email !== undefined
        ? boolFlag(metadata.send_invoice_email, sendInvoiceDefault)
        : sendInvoiceDefault,

    send_welcome_email:
      metadata.send_welcome_email !== undefined
        ? boolFlag(metadata.send_welcome_email, false)
        : boolFlag(base.send_welcome_email, false),
  };
}
async function invoiceToEnterprisePayload(invoice, event) {
  const hydratedInvoice = await retrieveInvoice(invoice);

  const subscriptionId = objectId(hydratedInvoice.subscription);

  const subscription =
    typeof hydratedInvoice.subscription === "object"
      ? hydratedInvoice.subscription
      : await retrieveSubscription(subscriptionId);

  const paymentIntent =
    typeof hydratedInvoice.payment_intent === "object"
      ? hydratedInvoice.payment_intent
      : null;

  const charge = extractCharge(paymentIntent);

  const metadata = mergeMetadata(
    subscription?.metadata,
    hydratedInvoice.metadata,
    paymentIntent?.metadata
  );

  const paymentIntentId =
    objectId(hydratedInvoice.payment_intent) ||
    objectId(paymentIntent);

  const methodSummary = await buildPaymentMethodSummary(
    paymentIntentId,
    charge
  );

  const paymentType = paymentTypeFromMetadata(metadata);

  const source =
    metadata.source ||
    "stripe_invoice";

  const method = inferPaymentMethod(metadata, charge);

  const category = normalizeFinanceCategory(
    metadata.category ||
      paymentType
  );

  const stripeTotal = stripePaidTotalFromInvoice(
    hydratedInvoice,
    paymentIntent
  );

  const amounts = normalizeStripeAmountBreakdown({
    metadata,
    base: {},
    stripeTotal,
    paymentType: category,
  });

  const reference =
    charge?.id ||
    paymentIntentId ||
    hydratedInvoice.id;

  const allocationRows = buildReceiptAllocationRows({
    category,
    metadata,
    amounts,
    method,
    reference,
  });

  const safety = basePayloadSafetyFlags(metadata);

  return {
    ...metadata,
    ...methodSummary,
    ...safety,

    source,

    created_from:
      metadata.created_from ||
      source,

    provider: "stripe",
    payment_provider: "stripe",

    payment_type: paymentType,
    category,

    amount: amounts.total_paid,
    total_amount: amounts.total_paid,
    paid_amount: amounts.total_paid,
    payment_amount: amounts.total_paid,

    invoice_amount: amounts.invoice_amount,
    invoice_amount_applied: amounts.invoice_amount,
    base_amount: amounts.base_amount,
    subtotal_amount: amounts.subtotal_amount,

    stripe_gross_amount: amounts.total_paid,
    stripe_paid_amount: amounts.total_paid,

    membership_amount:
      category === "membership"
        ? money(
            amounts.membership_amount ||
              metadata.membership_amount ||
              Math.max(
                0,
                amounts.invoice_amount -
                  money(amounts.registration_fee || 0)
              )
          )
        : money(metadata.membership_amount || 0),

    registration_fee:
      money(amounts.registration_fee || metadata.registration_fee || 0),

    processing_fee:
      money(amounts.processing_fee || metadata.processing_fee || 0),

    allocation_rows: allocationRows,
    allocation_rows_json: safeStringify(allocationRows),
    receipt_items: allocationRows,
    receipt_items_json: safeStringify(allocationRows),
    items: allocationRows,
    items_json: safeStringify(allocationRows),

    payment_method: method,
    method,

    status: "paid",
    payment_status: "paid",

    stripe_event_id: event.id,
    stripe_event_type: event.type,
    stripe_invoice_id: hydratedInvoice.id,
    stripe_payment_intent_id: paymentIntentId,
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: objectId(hydratedInvoice.customer),

    stripe_charge_id:
      charge?.id ||
      methodSummary.stripe_charge_id ||
      null,

    transaction_reference:
      charge?.balance_transaction ||
      charge?.id ||
      paymentIntentId ||
      hydratedInvoice.id,

    reference_no:
      charge?.id ||
      paymentIntentId ||
      hydratedInvoice.id,

    currency:
      String(hydratedInvoice.currency || "usd").toUpperCase(),

    email:
      metadata.email ||
      hydratedInvoice.customer_email ||
      hydratedInvoice.customer?.email ||
      null,

    full_name:
      metadata.full_name ||
      metadata.member_name ||
      metadata.payer_name ||
      hydratedInvoice.customer_name ||
      hydratedInvoice.customer?.name ||
      methodSummary.cardholder_name ||
      null,

    phone:
      metadata.phone ||
      hydratedInvoice.customer_phone ||
      hydratedInvoice.customer?.phone ||
      null,

    participants_json:
      metadata.participants_json ||
      null,

    participants:
      safeJsonParse(metadata.participants_json, []),

    send_receipt_email:
      metadata.send_receipt_email !== undefined
        ? boolFlag(metadata.send_receipt_email, true)
        : true,

    send_invoice_email:
      metadata.send_invoice_email !== undefined
        ? boolFlag(metadata.send_invoice_email, false)
        : false,

    send_welcome_email:
      metadata.send_welcome_email !== undefined
        ? boolFlag(metadata.send_welcome_email, false)
        : false,
  };
}

/* -------------------------------------------------------------------------- */
/* Payment Completion                                                         */
/* -------------------------------------------------------------------------- */

async function completeStripePayment(payload) {
  if (typeof paymentService.completePayment === "function") {
    return paymentService.completePayment(payload);
  }

  if (typeof paymentService.createPayment === "function") {
    return paymentService.createPayment(payload);
  }

  if (typeof paymentService.processSuccessfulPayment === "function") {
    if (paymentService.processSuccessfulPayment.length >= 2) {
      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        const result = await paymentService.processSuccessfulPayment(
          conn,
          payload
        );

        await conn.commit();

        if (typeof paymentService.sendPaymentEmails === "function") {
          await paymentService.sendPaymentEmails(result);
        }

        return result;
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    return paymentService.processSuccessfulPayment(payload);
  }

  throw new Error(
    "No compatible payment completion function found in services/paymentService."
  );
}

/* -------------------------------------------------------------------------- */
/* Finance Registration Activation + Welcome                                  */
/* -------------------------------------------------------------------------- */

async function loadRegistrationUser(connOrPool, payload = {}) {
  const userId = Number(payload.user_id || 0);
  const memberId = Number(payload.member_id || 0);

  if (!userId && !memberId) return null;

  const userColumns = await tableColumns(connOrPool, "tbl_users");
  const optionalColumns = [];

  if (userColumns.has("welcome_email_sent_at")) {
    optionalColumns.push("u.welcome_email_sent_at");
  }

  if (userColumns.has("temp_password_issued_at")) {
    optionalColumns.push("u.temp_password_issued_at");
  }

  const optionalSql = optionalColumns.length
    ? `, ${optionalColumns.join(", ")}`
    : "";

  const [rows] = await connOrPool.query(
    `
    SELECT
      u.id,
      u.member_id,
      u.username,
      u.email,
      u.full_name,
      u.phone,
      u.must_change_password,
      u.is_active,
      u.account_status
      ${optionalSql},

      m.member_no,
      m.membership_start_date,
      m.membership_end_date,
      m.membership_status,
      m.status

    FROM tbl_users u

    LEFT JOIN tbl_members m
      ON m.id = u.member_id

    WHERE ${userId ? "u.id = ?" : "u.member_id = ?"}
    LIMIT 1
    `,
    [userId || memberId]
  );

  return rows[0] || null;
}

async function activateFinanceRegistration(conn, payload = {}) {
  if (!isFinanceRegistration(payload)) return null;

  const memberId = Number(payload.member_id || 0);
  const userId = Number(payload.user_id || 0);

  if (!memberId && !userId) return null;

  const coverageStart =
    payload.coverage_start_date ||
    mysqlMonthStart(
      payload.coverage_start_month,
      payload.coverage_year
    );

  const coverageEnd =
    payload.coverage_end_date ||
    mysqlMonthEnd(
      payload.coverage_end_month,
      payload.coverage_year
    );

  if (memberId) {
    const [[existingMember]] = await conn.query(
      `
      SELECT membership_start_date
      FROM tbl_members
      WHERE id = ?
      LIMIT 1
      `,
      [memberId]
    );

    const memberUpdates = {
      status: "active",
      membership_status: "active",
      is_active: 1,
      registration_fee_status: "paid",
      registration_paid_at: new Date(),
      last_payment_at: new Date(),
      updated_at: new Date(),
    };

    if (!existingMember?.membership_start_date && coverageStart) {
      memberUpdates.membership_start_date = coverageStart;
    }

    if (coverageEnd) {
      memberUpdates.membership_end_date = coverageEnd;
    }

    await updateExistingColumns(
      conn,
      "tbl_members",
      memberUpdates,
      "id = ?",
      [memberId]
    );
  }

  if (userId || memberId) {
    await updateExistingColumns(
      conn,
      "tbl_users",
      {
        account_status: "active",
        is_active: 1,
        updated_at: new Date(),
      },
      userId ? "id = ?" : "member_id = ?",
      [userId || memberId]
    );
  }

  return {
    member_id: memberId || null,
    user_id: userId || null,
    activated: true,
  };
}




async function sendFinanceRegistrationWelcome(payload = {}, result = {}, options = {}) {
  if (!isFinanceRegistration(payload)) return null;

  if (
    payload.send_welcome_email !== undefined &&
    !boolFlag(payload.send_welcome_email)
  ) {
    return null;
  }

  let user = null;
  let temporaryPassword = null;
  let conn = null;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    user = await loadRegistrationUser(conn, payload);

    if (!user?.id || !user.email) {
      await conn.rollback();

      return {
        success: false,
        skipped: true,
        error: "No registration user email found.",
      };
    }

    if (user.welcome_email_sent_at && !options.force) {
      await conn.rollback();

      return {
        success: true,
        skipped: true,
        reason: "welcome_email_already_sent",
        user_id: user.id,
      };
    }

    temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    await updateExistingColumns(
      conn,
      "tbl_users",
      {
        password_hash: passwordHash,
        password_algo: "argon2id",
        must_change_password: 1,
        welcome_email_status: "pending",
        welcome_email_last_error: null,
        temp_password_issued_at: new Date(),
        updated_at: new Date(),
      },
      "id = ?",
      [user.id]
    );

    await conn.commit();
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
    }

    console.error("finance registration welcome preparation failed:", err);

    return {
      success: false,
      error: err.message,
    };
  } finally {
    if (conn) conn.release();
  }

  try {
    const emailResult = await sendMemberWelcomeEmail({
      email: user.email,
      full_name: user.full_name || payload.full_name || "Member",
      member_no: user.member_no || payload.member_no,
      username: user.username || payload.username || user.email,
      temporary_password: temporaryPassword,

      login_url: `${String(process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:5173").replace(/\/+$/, "")}/login`,

      plan_name: payload.plan_name || "Membership",
      coverage_label: payload.coverage_label || null,
      coverage_year: payload.coverage_year || null,
      coverage_start_month: payload.coverage_start_month || null,
      coverage_end_month: payload.coverage_end_month || null,
      duration_months: payload.duration_months || payload.months_paid || null,

      registration_fee: payload.registration_fee || 0,
      membership_amount: payload.membership_amount || payload.base_amount || 0,
      processing_fee: payload.processing_fee || 0,
      total_amount: payload.total_amount || payload.amount || 0,

      payment_number:
        result?.payment?.payment_number ||
        result?.payment_number ||
        null,

      invoice_number:
        result?.invoice?.invoice_number ||
        result?.invoice_number ||
        null,

      receipt_number:
        result?.receipt?.receipt_number ||
        result?.receipt_number ||
        null,
    });

    const sent =
      emailResult?.success === true ||
      Boolean(emailResult?.messageId) ||
      Boolean(emailResult?.accepted);

    await updateExistingColumns(
      pool,
      "tbl_users",
      {
        welcome_email_sent_at: sent ? new Date() : undefined,
        welcome_email_status: sent ? "sent" : "failed",
        welcome_email_last_error: sent
          ? null
          : emailResult?.error || "Welcome email failed.",
        updated_at: new Date(),
      },
      "id = ?",
      [user.id]
    );

    return sent
      ? { ...emailResult, success: true }
      : {
          success: false,
          error: emailResult?.error || "Welcome email failed.",
        };
  } catch (err) {
    await updateExistingColumns(
      pool,
      "tbl_users",
      {
        welcome_email_status: "failed",
        welcome_email_last_error: err.message,
        updated_at: new Date(),
      },
      "id = ?",
      [user.id]
    );

    console.error("finance registration welcome email failed:", err);

    return {
      success: false,
      error: err.message,
    };
  }
}
async function markFinanceRegistrationFailed(
  payload = {},
  reason = "Payment failed."
) {
  if (!isFinanceRegistration(payload)) return null;

  const memberId = Number(payload.member_id || 0);
  const userId = Number(payload.user_id || 0);

  if (!memberId && !userId) return null;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    if (memberId) {
      await updateExistingColumns(
  conn,
  "tbl_members",
  {
    status: "failed",
    membership_status: "pending_payment",
    updated_at: new Date(),
  },
  `
  id = ?
  AND status IN (
    'draft',
    'pending_payment',
    'payment_processing',
    'failed'
  )
  `,
  [memberId]
);
    }

    if (userId || memberId) {
      await updateExistingColumns(
        conn,
        "tbl_users",
        {
          account_status: "pending_payment",
          updated_at: new Date(),
        },
        userId ? "id = ?" : "member_id = ?",
        [userId || memberId]
      );
    }

    await conn.commit();

    return {
      failed: true,
      member_id: memberId || null,
      user_id: userId || null,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* -------------------------------------------------------------------------- */
/* Program Failure Support                                                    */
/* -------------------------------------------------------------------------- */

async function markProgramRegistrationFailed(payload = {}, reason) {
  if (!payload.registration_id) return null;

  if (
    typeof programRegistrationService.markRegistrationFailed !== "function"
  ) {
    return null;
  }

  try {
    await programRegistrationService.markRegistrationFailed(
      pool,
      payload.registration_id,
      reason
    );

    return {
      registration_failed: true,
    };
  } catch (err) {
    console.error("Failed marking program registration failed:", err);

    return {
      registration_failed: false,
      error: err.message,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Event Handlers                                                             */
/* -------------------------------------------------------------------------- */

async function afterSuccessfulPayment(payload, result, event) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const activation = await activateFinanceRegistration(conn, payload);

    await conn.commit();

    const welcome = await sendFinanceRegistrationWelcome(payload, result);

    return {
      event_id: event.id,
      payment: result,
      duplicate: Boolean(result?.duplicate),
      activation,
      welcome,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function handleCheckoutSessionCompleted(event) {
  const session = await retrieveCheckoutSession(event.data.object);

  if (
    session.payment_status &&
    !["paid", "no_payment_required"].includes(session.payment_status)
  ) {
    return {
      ignored: true,
      reason: `checkout.session.completed payment_status=${session.payment_status}`,
    };
  }

  const payload = await sessionToEnterprisePayload(session, event);
  const result = await completeStripePayment(payload);

  return afterSuccessfulPayment(payload, result, event);
}

async function handleCheckoutAsyncSucceeded(event) {
  const session = await retrieveCheckoutSession(event.data.object);
  const payload = await sessionToEnterprisePayload(session, event);
  const result = await completeStripePayment(payload);

  return afterSuccessfulPayment(payload, result, event);
}

async function handleInvoicePaid(event) {
  const payload = await invoiceToEnterprisePayload(event.data.object, event);

  const paymentType = normalizeFinanceCategory(
    payload.payment_type ||
      payload.category
  );

  const processable =
    boolFlag(payload.process_direct_payment) ||
    boolFlag(payload.process_membership_invoice) ||
    isFinanceRegistration(payload) ||
    [
      "membership",
      "donation",
      "pledge",
      "school",
      "trip",
      "invoice",
    ].includes(paymentType);

  if (!processable) {
    return {
      ignored: true,
      reason: "invoice.paid has no processable finance metadata",
    };
  }

  const result = await completeStripePayment(payload);

  return afterSuccessfulPayment(payload, result, event);
}

async function handleCheckoutExpired(event) {
  const session = event.data.object;
  const payload = mergeMetadata(session.metadata);

  await markFinanceRegistrationFailed(
    payload,
    "Stripe checkout session expired."
  );

  await markProgramRegistrationFailed(
    payload,
    "Stripe session expired."
  );

  return {
    expired: true,
    session_id: session.id,
  };
}

async function handleCheckoutAsyncFailed(event) {
  const session = event.data.object;
  const payload = mergeMetadata(session.metadata);

  await markFinanceRegistrationFailed(
    payload,
    "Stripe asynchronous payment failed."
  );

  await markProgramRegistrationFailed(
    payload,
    "Stripe asynchronous payment failed."
  );

  return {
    failed: true,
    session_id: session.id,
  };
}

async function handlePaymentIntentFailed(event) {
  const intent = event.data.object;
  const payload = mergeMetadata(intent.metadata);

  const reason =
    intent.last_payment_error?.message ||
    intent.last_payment_error?.code ||
    "Stripe payment failed.";

  await markFinanceRegistrationFailed(payload, reason);
  await markProgramRegistrationFailed(payload, reason);

  return {
    failed: true,
    payment_intent_id: intent.id,
    reason,
  };
}

/* -------------------------------------------------------------------------- */
/* Controller                                                                 */
/* -------------------------------------------------------------------------- */

async function stripeWebhookController(req, res) {
  if (!stripe) {
    return res.status(500).json({
      error: "Stripe is not configured.",
    });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({
      error: "Stripe webhook secret is not configured.",
    });
  }

  let event = null;

  try {
    const signature = req.headers["stripe-signature"];

    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Stripe webhook signature error:", err.message);

    return res
      .status(400)
      .send(`Webhook Error: ${err.message}`);
  }

  const shouldProcess = await startWebhookEvent(event);

  if (!shouldProcess) {
    return res.json({
      received: true,
      duplicate: true,
      event_id: event.id,
    });
  }

  try {
    let result = null;

    switch (event.type) {
      case "checkout.session.completed":
        result = await handleCheckoutSessionCompleted(event);
        break;

      case "checkout.session.async_payment_succeeded":
        result = await handleCheckoutAsyncSucceeded(event);
        break;

      case "invoice.paid":
        result = await handleInvoicePaid(event);
        break;

      case "checkout.session.expired":
        result = await handleCheckoutExpired(event);
        break;

      case "checkout.session.async_payment_failed":
        result = await handleCheckoutAsyncFailed(event);
        break;

      case "payment_intent.payment_failed":
        result = await handlePaymentIntentFailed(event);
        break;

      default:
        result = {
          ignored: true,
          reason: `Unhandled Stripe event: ${event.type}`,
        };
        break;
    }

    await finishWebhookEvent(event, "processed", result);

    return res.json({
      received: true,
      event_id: event.id,
      event_type: event.type,
      result,
    });
  } catch (err) {
    console.error("Stripe webhook processing error:", err);

    await finishWebhookEvent(event, "failed", {
      error: err.message,
    });

    return res.status(500).json({
      error:
        err.message ||
        "Webhook processing failed.",
    });
  }
}

module.exports = {
  stripeWebhookController,
};