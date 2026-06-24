// backend/routes/programRegistrations.js
"use strict";

const express = require("express");
const Stripe = require("stripe");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const {
  buildSchoolPaymentPayload,
} = require("../services/domains/programs/schoolPaymentService");

const {
  buildTripPaymentPayload,
} = require("../services/domains/programs/tripPaymentService");

const programRegistrationService = require(
  "../services/domains/programs/programRegistrationService"
);

const router = express.Router();

const ADMIN_ROLES = [
  "admin",
  "finance",
  "super_admin",
  "instructor",
];

const MANUAL_FOLLOWUP_METHODS = new Set([
  "cash",
  "check",
  "zelle",
]);

const PAY_LATER_METHODS = new Set([
  "invoice",
  "invoice_link",
  "pay_later",
  "later",
  "promise",
  "pending",
]);

const ONLINE_METHODS = new Set([
  "card",
  "ach",
  "card_ach",
  "stripe",
  "online",
]);

const REG_TABLE = "tbl_event_program_registrations";
const INVOICE_TABLE = "tbl_finance_invoices";
const INVOICE_ITEM_TABLE = "tbl_finance_invoice_items";

const columnCache = new Map();

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Number(n.toFixed(2));
}

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") return value;

  return ["1", "true", "yes", "y", "on"].includes(
    String(value).trim().toLowerCase()
  );
}

function now() {
  return new Date();
}

function makeNumber(prefix) {
  const suffix = crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase();

  return `${prefix}-${Date.now()}-${suffix}`;
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function getJwtSecret() {
  return process.env.JWT_SECRET || "dev_secret";
}

function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : null;

    req.user = token
      ? jwt.verify(token, getJwtSecret())
      : null;
  } catch {
    req.user = null;
  }

  next();
}

function actorId(req) {
  return (
    req.user?.id ||
    req.user?.user_id ||
    null
  );
}

function isStaff(req) {
  return ADMIN_ROLES.includes(
    String(req.user?.role || "").toLowerCase()
  );
}

function normalizeCategory(value) {
  const category = clean(value, 40).toLowerCase();

  if (category === "school") return "kids";
  if (category === "kid") return "kids";
  if (category === "kids") return "kids";
  if (category === "school_program") return "kids";
  if (category === "trip") return "trip";
  if (category === "trip_program") return "trip";

  return "";
}

function publicCategory(value) {
  const category = normalizeCategory(value);

  if (category === "kids") return "school";

  return category;
}

function normalizePaymentMethod(value) {
  const method = clean(value || "card", 40).toLowerCase();

  if (method === "cheque") return "check";
  if (method === "us_bank_account") return "ach";
  if (method === "bank") return "ach";
  if (method === "stripe") return "card";
  if (method === "online") return "card";
  if (method === "manual") return "cash";
  if (method === "offline") return "cash";
  if (method === "card_ach") return "card_ach";

  return method;
}

function publicError(res, status, message, details) {
  return res.status(status).json({
    ok: false,
    error: message,
    ...(details ? { details } : {}),
  });
}

function frontendUrl(req) {
  return (
    clean(req.body?.frontend_url, 500) ||
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    `${req.protocol}://${req.get("host")}`
  ).replace(/\/+$/, "");
}

function successUrl(req) {
  return (
    clean(req.body?.success_url, 800) ||
    `${frontendUrl(req)}/payment-success?session_id={CHECKOUT_SESSION_ID}`
  );
}

function cancelUrl(req) {
  return (
    clean(req.body?.cancel_url, 800) ||
    `${frontendUrl(req)}/payment-cancel`
  );
}

function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function stripePaymentMethodTypes(method) {
  if (method === "ach") return ["us_bank_account"];
  if (method === "card_ach") return ["card", "us_bank_account"];
  return ["card"];
}

function compactMetadata(input = {}) {
  const output = {};

  for (const [key, value] of Object.entries(input)) {
    if (Object.keys(output).length >= 45) break;
    if (value === undefined || value === null || value === "") continue;

    output[key] = String(value).slice(0, 500);
  }

  return output;
}

async function getColumns(conn, tableName) {
  if (columnCache.has(tableName)) {
    return columnCache.get(tableName);
  }

  const [rows] = await conn.query(
    `SHOW COLUMNS FROM ${tableName}`
  );

  const columns = new Set(
    rows.map((row) => row.Field)
  );

  columnCache.set(tableName, columns);

  return columns;
}

async function insertExistingColumns(conn, tableName, payload) {
  const columns = await getColumns(conn, tableName);
  const row = {};

  for (const [key, value] of Object.entries(payload)) {
    if (columns.has(key)) {
      row[key] = value;
    }
  }

  if (!Object.keys(row).length) {
    throw new Error(`No valid columns found for ${tableName}.`);
  }

  const [result] = await conn.query(
    `INSERT INTO ${tableName} SET ?`,
    row
  );

  return result.insertId;
}

async function updateExistingColumns(conn, tableName, payload, whereSql, params) {
  const columns = await getColumns(conn, tableName);
  const row = {};

  for (const [key, value] of Object.entries(payload)) {
    if (columns.has(key) && value !== undefined) {
      row[key] = value;
    }
  }

  if (!Object.keys(row).length) {
    return {
      skipped: true,
      affectedRows: 0,
    };
  }

  const [result] = await conn.query(
    `UPDATE ${tableName} SET ? WHERE ${whereSql}`,
    [row, ...params]
  );

  return result;
}

async function getMemberIdFromUser(user) {
  if (!user) return null;

  if (user.member_id) {
    return toId(user.member_id);
  }

  const userId =
    toId(user.id) ||
    toId(user.user_id);

  if (!userId) return null;

  const [[row]] = await pool.query(
    `
    SELECT member_id
    FROM tbl_users
    WHERE id = ?
    LIMIT 1
    `,
    [userId]
  );

  return toId(row?.member_id);
}

async function resolveMemberId(req, options = {}) {
  const fromUser = await getMemberIdFromUser(req.user);

  if (fromUser) return fromUser;

  if (options.allowBodyMemberId) {
    return toId(req.body?.member_id);
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Email Adapter                                                              */
/* -------------------------------------------------------------------------- */

function loadInvoiceEmailService() {
  try {
    return require("../services/domains/invoices/invoiceEmailService");
  } catch {
    return null;
  }
}

async function sendInvoiceEmailSafe(payload = {}) {
  const service = loadInvoiceEmailService();

  if (!service) {
    return {
      ok: false,
      skipped: true,
      reason: "invoiceEmailService is not available.",
    };
  }

  const candidates = [
    "sendInvoiceEmail",
    "sendInvoice",
    "emailInvoice",
    "sendInvoiceWithPaymentLink",
    "sendProgramInvoiceEmail",
  ];

  for (const name of candidates) {
    if (typeof service[name] === "function") {
      try {
        const result = await service[name](payload);
        return {
          ok: true,
          fn: name,
          result,
        };
      } catch (err) {
        console.error(`program invoice email failed via ${name}:`, err);

        return {
          ok: false,
          fn: name,
          error: err.message,
        };
      }
    }
  }

  return {
    ok: false,
    skipped: true,
    reason: "No supported invoice email function was found.",
  };
}

/* -------------------------------------------------------------------------- */
/* Program Payload                                                            */
/* -------------------------------------------------------------------------- */

async function buildRegistrationPayload(req, options = {}) {
  const category = normalizeCategory(
    req.body.category ||
      req.body.type ||
      req.body.payment_type ||
      req.body.program_category
  );

  if (!category) {
    throw new Error("Program category is required.");
  }

  if (!["kids", "trip"].includes(category)) {
    throw new Error("Invalid program category.");
  }

  const memberId = await resolveMemberId(req, {
    allowBodyMemberId: Boolean(options.allowBodyMemberId),
  });

  const payload = {
    ...req.body,
    category,
    member_id: memberId,
    created_by: actorId(req),
    created_by_user_id: actorId(req),
  };

  if (category === "kids") {
    return buildSchoolPaymentPayload(payload);
  }

  return buildTripPaymentPayload(payload);
}

/* -------------------------------------------------------------------------- */
/* Invoice + Link                                                             */
/* -------------------------------------------------------------------------- */

function invoiceStatusForWorkflow(workflow) {
  if (workflow.createPaymentLink) return "sent";
  if (workflow.financeFollowupRequired) return "sent";
  return "pending";
}

function workflowFromRequest(req, method) {
  const isOnline =
    ONLINE_METHODS.has(method) ||
    toBool(req.body.create_payment_link, false);

  const isManual =
    MANUAL_FOLLOWUP_METHODS.has(method);

  const isPayLater =
    PAY_LATER_METHODS.has(method);

  return {
    method,
    isOnline,
    isManual,
    isPayLater,

    createInvoice:
      toBool(req.body.create_invoice, true),

    createPaymentLink:
      isOnline ||
      toBool(req.body.create_payment_link, false),

    sendInvoiceEmail:
      isOnline ||
      isPayLater ||
      toBool(req.body.send_invoice_email, false),

    sendInvoiceToFinance:
      isManual ||
      toBool(req.body.send_invoice_to_finance_admin, false),

    financeFollowupRequired:
      isManual ||
      toBool(req.body.finance_followup_required, false),
  };
}

async function createProgramInvoice(req, registrationResult, workflow) {
  const conn = await pool.getConnection();

  try {
    const paymentPayload = registrationResult.payment_payload || {};
    const program = registrationResult.program || {};
    const pricing = registrationResult.pricing || {};

    const category =
      publicCategory(paymentPayload.category || program.category) ||
      "program";

    const amount = toMoney(
      paymentPayload.amount ||
        pricing.total_amount ||
        registrationResult.total_amount
    );

    if (amount <= 0) {
      throw new Error("Invoice amount must be greater than zero.");
    }

    const invoiceNumber = makeNumber("INV");
    const dueDate =
      clean(req.body.due_date, 20) ||
      addDays(req.body.invoice_due_days || 14);

    const payerName = clean(
      paymentPayload.full_name ||
        req.body.full_name ||
        req.body.payer_name ||
        req.body.parent_name,
      180
    );

    const payerEmail = clean(
      paymentPayload.email ||
        req.body.email ||
        req.body.payer_email ||
        req.body.parent_email,
      190
    ).toLowerCase();

    const payerPhone = clean(
      paymentPayload.phone ||
        req.body.phone ||
        req.body.payer_phone ||
        req.body.parent_phone,
      80
    );

    const itemName =
      category === "school"
        ? "School Program Registration"
        : "Trip Registration";

    const itemDescription =
      category === "school"
        ? `${program.title || paymentPayload.program_name || "School Program"} - ${pricing.quantity || paymentPayload.quantity || 1} student(s)`
        : `${program.title || paymentPayload.program_name || "Trip"} - ${pricing.quantity || paymentPayload.quantity || 1} participant(s)`;

    const metadata = {
      source: "program_registration",
      registration_id: registrationResult.registration_id,
      news_event_id: paymentPayload.news_event_id || program.id,
      program_id: paymentPayload.news_event_id || program.id,
      program_name: program.title || paymentPayload.program_name || null,
      category,
      raw_category:
        category === "school"
          ? "kids"
          : category,
      quantity:
        pricing.quantity ||
        paymentPayload.quantity ||
        1,
      pricing_source:
        pricing.pricing_source ||
        paymentPayload.pricing_source ||
        null,
      pricing_tier_id:
        pricing.pricing_tier_id ||
        paymentPayload.pricing_tier_id ||
        null,
      pricing_tier_label:
        pricing.pricing_tier_label ||
        paymentPayload.pricing_tier_label ||
        null,
      participants:
        registrationResult.participants ||
        paymentPayload.participants ||
        paymentPayload.students ||
        [],
      workflow,
    };

    await conn.beginTransaction();

    const invoiceId = await insertExistingColumns(
      conn,
      INVOICE_TABLE,
      {
        invoice_number: invoiceNumber,
        invoice_type: category,
        payment_type: category,
        category,

        source: "program_registration",
        status: invoiceStatusForWorkflow(workflow),
        invoice_status: invoiceStatusForWorkflow(workflow),

        member_id:
          toId(paymentPayload.member_id) ||
          toId(req.body.member_id) ||
          null,

        full_name_snapshot: payerName,
        email_snapshot: payerEmail,
        phone_snapshot: payerPhone || null,

        recipient_name: payerName,
        recipient_email: payerEmail,
        recipient_phone: payerPhone || null,

        donor_name: payerName,
        donor_email: payerEmail,
        donor_phone: payerPhone || null,

        customer_name: payerName,
        customer_email: payerEmail,
        customer_phone: payerPhone || null,

        total_amount: amount,
        amount,
        subtotal_amount: amount,
        paid_amount: 0,
        balance_due: amount,

        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: dueDate,

        program_id:
          toId(paymentPayload.news_event_id) ||
          toId(program.id) ||
          null,

        news_event_id:
          toId(paymentPayload.news_event_id) ||
          toId(program.id) ||
          null,

        registration_id:
          toId(registrationResult.registration_id),

        pricing_tier_id:
          toId(pricing.pricing_tier_id) ||
          toId(paymentPayload.pricing_tier_id) ||
          null,

        pricing_tier_label:
          clean(
            pricing.pricing_tier_label ||
              paymentPayload.pricing_tier_label,
            120
          ) || null,

        participants_json:
          JSON.stringify(metadata.participants || []),

        metadata_json:
          JSON.stringify(metadata),

        notes:
          clean(req.body.invoice_notes || req.body.notes, 1000) ||
          null,

        created_by:
          actorId(req),

        updated_by:
          actorId(req),

        created_at: now(),
        updated_at: now(),
      }
    );

    await insertExistingColumns(
      conn,
      INVOICE_ITEM_TABLE,
      {
        invoice_id: invoiceId,

        item_type: category,
        type: category,
        category,

        item_name: itemName,
        name: itemName,

        description: itemDescription,

        quantity: 1,
        unit_price: amount,
        price: amount,
        total_price: amount,
        amount,

        metadata_json:
          JSON.stringify(metadata),

        created_at: now(),
        updated_at: now(),
      }
    );

    await conn.commit();

    await programRegistrationService.attachInvoiceToRegistration(
      pool,
      {
        registration_id: registrationResult.registration_id,
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        invoice_status: invoiceStatusForWorkflow(workflow),
        finance_followup_required: workflow.financeFollowupRequired,
      }
    );

    return {
      id: invoiceId,
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      status: invoiceStatusForWorkflow(workflow),
      total_amount: amount,
      balance_due: amount,
      due_date: dueDate,
      recipient_name: payerName,
      recipient_email: payerEmail,
      recipient_phone: payerPhone || null,
      category,
      metadata,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateInvoicePaymentLink(invoiceId, payload = {}) {
  const conn = await pool.getConnection();

  try {
    await updateExistingColumns(
      conn,
      INVOICE_TABLE,
      {
        payment_link_url:
          clean(payload.payment_link_url, 1000) ||
          null,

        checkout_url:
          clean(payload.payment_link_url, 1000) ||
          null,

        stripe_checkout_session_id:
          clean(payload.stripe_checkout_session_id, 255) ||
          null,

        payment_provider:
          payload.payment_provider || "stripe",

        updated_at: now(),
      },
      "id = ?",
      [invoiceId]
    );
  } finally {
    conn.release();
  }
}

async function createStripeCheckoutSession(req, registrationResult, options = {}) {
  const stripe = stripeClient();

  const paymentPayload = registrationResult.payment_payload || {};
  const program = registrationResult.program || {};
  const invoice = options.invoice || null;

  const amount = toMoney(
    options.amount ||
      paymentPayload.amount ||
      registrationResult.pricing?.total_amount
  );

  if (amount <= 0) {
    throw new Error("Checkout amount must be greater than zero.");
  }

  const method = normalizePaymentMethod(req.body.payment_method);

  const metadata = compactMetadata({
    checkout_type: "program_registration",
    payment_kind: "program_registration",
    payment_type:
      paymentPayload.payment_type ||
      publicCategory(paymentPayload.category),
    category:
      paymentPayload.category ||
      publicCategory(paymentPayload.payment_type),
    registration_id: registrationResult.registration_id,
    invoice_id: invoice?.invoice_id || invoice?.id || null,
    invoice_number: invoice?.invoice_number || null,
    news_event_id:
      paymentPayload.news_event_id ||
      program.id ||
      null,
    program_id:
      paymentPayload.news_event_id ||
      program.id ||
      null,
    program_name:
      program.title ||
      paymentPayload.program_name ||
      null,
    member_id:
      paymentPayload.member_id ||
      req.body.member_id ||
      null,
    quantity:
      paymentPayload.quantity ||
      registrationResult.pricing?.quantity ||
      1,
    full_name:
      paymentPayload.full_name ||
      req.body.full_name ||
      req.body.payer_name,
    email:
      paymentPayload.email ||
      req.body.email ||
      req.body.payer_email,
    process_program_registration: "true",
    process_program_invoice: invoice ? "true" : "false",
    source:
      isStaff(req)
        ? "staff_program_registration"
        : "public_program_registration",
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: stripePaymentMethodTypes(method),

    customer_email:
      clean(paymentPayload.email || req.body.email, 190) ||
      undefined,

    client_reference_id:
      String(registrationResult.registration_id),

    success_url: successUrl(req),
    cancel_url: cancelUrl(req),

    line_items: [
      {
        quantity: 1,
        price_data: {
          currency:
            clean(req.body.currency, 10).toLowerCase() ||
            "usd",

          unit_amount:
            Math.round(amount * 100),

          product_data: {
            name:
              clean(
                program.title ||
                  paymentPayload.program_name ||
                  "Program Registration",
                180
              ),

            description:
              publicCategory(paymentPayload.category) === "school"
                ? "School program registration"
                : "Trip registration",
          },
        },
      },
    ],

    metadata,
  });

  await programRegistrationService.attachStripeCheckoutSession(
    pool,
    registrationResult.registration_id,
    session.id
  );

  if (invoice) {
    await updateInvoicePaymentLink(
      invoice.invoice_id || invoice.id,
      {
        payment_link_url: session.url,
        stripe_checkout_session_id: session.id,
      }
    );

    await programRegistrationService.attachPaymentLinkToRegistration(
      pool,
      {
        registration_id: registrationResult.registration_id,
        invoice_id: invoice.invoice_id || invoice.id,
        invoice_number: invoice.invoice_number,
        invoice_status: "sent",
        payment_link_url: session.url,
      }
    );
  }

  return session;
}

async function deliverProgramInvoice(req, payload = {}) {
  const invoice = payload.invoice;
  const registrationResult = payload.registrationResult;
  const workflow = payload.workflow;

  if (!invoice) {
    return {
      ok: false,
      skipped: true,
      reason: "No invoice was created.",
    };
  }

  if (!workflow.sendInvoiceEmail && !workflow.sendInvoiceToFinance) {
    return {
      ok: true,
      skipped: true,
      reason: "Invoice email was not requested.",
    };
  }

  const financeEmail =
    process.env.FINANCE_ADMIN_EMAIL ||
    process.env.FINANCE_EMAIL ||
    process.env.CHURCH_FINANCE_EMAIL ||
    "";

  const recipientEmail =
    workflow.sendInvoiceToFinance
      ? financeEmail
      : invoice.recipient_email;

  if (!recipientEmail) {
    return {
      ok: false,
      skipped: true,
      reason: "No invoice recipient email is available.",
    };
  }

  const emailResult = await sendInvoiceEmailSafe({
    invoice_id: invoice.invoice_id || invoice.id,
    invoice_number: invoice.invoice_number,
    to: recipientEmail,
    recipient_email: recipientEmail,
    recipient_name: invoice.recipient_name,
    payment_link_url: payload.payment_link_url || null,
    attach_pdf: true,
    include_payment_link: Boolean(payload.payment_link_url),
    program_registration: true,
    registration_id: registrationResult.registration_id,
    category: invoice.category,
    subject:
      workflow.sendInvoiceToFinance
        ? `Program registration payment follow-up ${invoice.invoice_number}`
        : `Program registration invoice ${invoice.invoice_number}`,
  });

  if (emailResult.ok && !workflow.sendInvoiceToFinance) {
    await programRegistrationService.markRegistrationInvoiceSent(
      pool,
      {
        registration_id: registrationResult.registration_id,
        emailed_to: recipientEmail,
      }
    );
  }

  return emailResult;
}

/* -------------------------------------------------------------------------- */
/* Core Workflows                                                             */
/* -------------------------------------------------------------------------- */

async function createProgramCheckoutResponse(req, options = {}) {
  const registrationResult =
    await buildRegistrationPayload(req, {
      allowBodyMemberId: Boolean(options.allowBodyMemberId),
    });

  const workflow = {
    method: normalizePaymentMethod(req.body.payment_method),
    isOnline: true,
    isManual: false,
    isPayLater: false,
    createInvoice: toBool(req.body.create_invoice, true),
    createPaymentLink: true,
    sendInvoiceEmail: toBool(req.body.send_invoice_email, true),
    sendInvoiceToFinance: false,
    financeFollowupRequired: false,
  };

  let invoice = null;

  if (workflow.createInvoice) {
    invoice = await createProgramInvoice(
      req,
      registrationResult,
      workflow
    );
  }

  const session = await createStripeCheckoutSession(
    req,
    registrationResult,
    {
      invoice,
    }
  );

  const emailResult = await deliverProgramInvoice(
    req,
    {
      invoice,
      registrationResult,
      workflow,
      payment_link_url: session.url,
    }
  );

  return {
    ok: true,
    source: options.source || "self_service",
    payment_method: workflow.method,
    url: session.url,
    payment_link_url: session.url,
    session_id: session.id,
    registration_id: registrationResult.registration_id,
    invoice,
    email_result: emailResult,
    program: registrationResult.program,
    pricing: registrationResult.pricing,
    total_amount:
      registrationResult.pricing?.total_amount ||
      registrationResult.payment_payload?.amount,
  };
}

async function createStaffRegistrationResponse(req) {
  const method = normalizePaymentMethod(
    req.body.payment_method ||
      req.body.preferred_payment_method
  );

  const workflow = workflowFromRequest(req, method);

  const registrationResult =
    await buildRegistrationPayload(req, {
      allowBodyMemberId: true,
    });

  if (!workflow.createInvoice) {
    return {
      ok: true,
      source: "staff_registration_only",
      payment_method: method,
      registration_id: registrationResult.registration_id,
      program: registrationResult.program,
      pricing: registrationResult.pricing,
      message: "Program registration created without invoice.",
    };
  }

  const invoice = await createProgramInvoice(
    req,
    registrationResult,
    workflow
  );

  let session = null;
  let paymentLinkUrl = null;

  if (workflow.createPaymentLink) {
    session = await createStripeCheckoutSession(
      req,
      registrationResult,
      {
        invoice,
      }
    );

    paymentLinkUrl = session.url;
  }

  if (workflow.financeFollowupRequired) {
    await programRegistrationService.markRegistrationManualFollowupRequired(
      pool,
      {
        registration_id: registrationResult.registration_id,
        payment_method: method,
        invoice_status: "sent",
        note:
          "Registrant selected manual payment. Finance must collect and post payment.",
      }
    );
  }

  const emailResult = await deliverProgramInvoice(
    req,
    {
      invoice,
      registrationResult,
      workflow,
      payment_link_url: paymentLinkUrl,
    }
  );

  return {
    ok: true,
    source:
      workflow.financeFollowupRequired
        ? "staff_manual_followup"
        : workflow.createPaymentLink
          ? "staff_invoice_payment_link"
          : "staff_pending_invoice",
    payment_method: method,
    registration_id: registrationResult.registration_id,
    invoice,
    payment_link_url: paymentLinkUrl,
    session_id: session?.id || null,
    email_result: emailResult,
    program: registrationResult.program,
    pricing: registrationResult.pricing,
    message:
      workflow.financeFollowupRequired
        ? "Registration and invoice created. Finance follow-up is required for manual payment."
        : workflow.createPaymentLink
          ? "Registration, invoice, and payment link created."
          : "Registration and pending invoice created.",
  };
}

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "programRegistrations",
    version: "enterprise",
    supports: {
      school_dynamic_pricing: true,
      trip_regular_pricing: true,
      public_checkout: true,
      staff_invoice_payment_link: true,
      finance_manual_followup: true,
      single_registration_engine: true,
    },
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* Public/member self-service checkout                                        */
/* -------------------------------------------------------------------------- */

router.post(
  "/create-checkout",
  optionalAuth,
  async (req, res) => {
    try {
      const result = await createProgramCheckoutResponse(
        req,
        {
          allowBodyMemberId: false,
          source: "self_service",
        }
      );

      return res.json(result);
    } catch (err) {
      console.error(
        "POST /program-registrations/create-checkout error:",
        err
      );

      return publicError(
        res,
        400,
        err.message || "Failed to create program checkout."
      );
    }
  }
);

router.post(
  "/",
  optionalAuth,
  async (req, res) => {
    try {
      if (isStaff(req)) {
        const result = await createStaffRegistrationResponse(req);
        return res.json(result);
      }

      const method = normalizePaymentMethod(req.body.payment_method);

      if (
        MANUAL_FOLLOWUP_METHODS.has(method) ||
        PAY_LATER_METHODS.has(method)
      ) {
        return publicError(
          res,
          403,
          "Manual or pay-later program registration must be handled by finance/admin."
        );
      }

      const result = await createProgramCheckoutResponse(
        req,
        {
          allowBodyMemberId: false,
          source: "self_service",
        }
      );

      return res.json(result);
    } catch (err) {
      console.error(
        "POST /program-registrations error:",
        err
      );

      return publicError(
        res,
        400,
        err.message || "Failed to create program registration."
      );
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Finance/admin staff-assisted registration                                  */
/* -------------------------------------------------------------------------- */

router.post(
  "/admin/register",
  authRequired,
  requireRole(...ADMIN_ROLES),
  async (req, res) => {
    try {
      const result = await createStaffRegistrationResponse(req);
      return res.json(result);
    } catch (err) {
      console.error(
        "POST /program-registrations/admin/register error:",
        err
      );

      return publicError(
        res,
        400,
        err.message || "Failed to create staff registration."
      );
    }
  }
);

router.post(
  "/admin",
  authRequired,
  requireRole(...ADMIN_ROLES),
  async (req, res) => {
    try {
      const result = await createStaffRegistrationResponse(req);
      return res.json(result);
    } catch (err) {
      console.error(
        "POST /program-registrations/admin error:",
        err
      );

      return publicError(
        res,
        400,
        err.message || "Failed to create staff registration."
      );
    }
  }
);

router.post(
  "/admin/create-checkout",
  authRequired,
  requireRole(...ADMIN_ROLES),
  async (req, res) => {
    try {
      const result = await createProgramCheckoutResponse(
        req,
        {
          allowBodyMemberId: true,
          source: "staff_checkout",
        }
      );

      return res.json(result);
    } catch (err) {
      console.error(
        "POST /program-registrations/admin/create-checkout error:",
        err
      );

      return publicError(
        res,
        400,
        err.message || "Failed to create staff checkout."
      );
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Admin list / detail                                                        */
/* -------------------------------------------------------------------------- */

router.get(
  "/admin",
  authRequired,
  requireRole(...ADMIN_ROLES),
  async (req, res) => {
    try {
      const rows =
        await programRegistrationService.listRegistrations(
          pool,
          req.query
        );

      const summary =
        await programRegistrationService.getProgramRegistrationSummary(
          pool,
          req.query
        );

      return res.json({
        ok: true,
        rows,
        summary,
        pagination: {
          limit: Number(req.query.limit || req.query.pageSize || 100),
          offset: Number(req.query.offset || 0),
          returned: rows.length,
        },
      });
    } catch (err) {
      console.error(
        "GET /program-registrations/admin error:",
        err
      );

      return publicError(
        res,
        500,
        "Failed to load program registrations."
      );
    }
  }
);

router.post(
  "/admin/expire-pending",
  authRequired,
  requireRole(...ADMIN_ROLES),
  async (req, res) => {
    try {
      const result =
        await programRegistrationService.expirePendingRegistrations(
          pool,
          {
            minutes: Number(req.body.minutes || 60),
            limit: Number(req.body.limit || 250),
          }
        );

      return res.json({
        ok: true,
        result,
      });
    } catch (err) {
      console.error(
        "POST /program-registrations/admin/expire-pending error:",
        err
      );

      return publicError(
        res,
        500,
        "Failed to expire pending registrations."
      );
    }
  }
);

router.get(
  "/admin/:id",
  authRequired,
  requireRole(...ADMIN_ROLES),
  async (req, res) => {
    try {
      const registration =
        await programRegistrationService.getRegistrationById(
          pool,
          req.params.id
        );

      if (!registration) {
        return publicError(res, 404, "Registration not found.");
      }

      return res.json({
        ok: true,
        registration,
      });
    } catch (err) {
      console.error(
        "GET /program-registrations/admin/:id error:",
        err
      );

      return publicError(
        res,
        500,
        "Failed to load registration."
      );
    }
  }
);

router.post(
  "/admin/:id/cancel",
  authRequired,
  requireRole(...ADMIN_ROLES),
  async (req, res) => {
    try {
      const result =
        await programRegistrationService.markRegistrationCancelled(
          pool,
          req.params.id,
          clean(req.body.reason, 500) ||
            "Cancelled by staff."
        );

      return res.json({
        ok: true,
        result,
      });
    } catch (err) {
      console.error(
        "POST /program-registrations/admin/:id/cancel error:",
        err
      );

      return publicError(
        res,
        400,
        err.message || "Failed to cancel registration."
      );
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Member portal history                                                      */
/* -------------------------------------------------------------------------- */

router.get(
  "/member",
  authRequired,
  async (req, res) => {
    try {
      const memberId = await getMemberIdFromUser(req.user);

      if (!memberId) {
        return res.json({
          ok: true,
          rows: [],
        });
      }

      const rows =
        await programRegistrationService.listRegistrations(
          pool,
          {
            member_id: memberId,
            limit: req.query.limit || 100,
            offset: req.query.offset || 0,
          }
        );

      return res.json({
        ok: true,
        rows,
      });
    } catch (err) {
      console.error(
        "GET /program-registrations/member error:",
        err
      );

      return publicError(
        res,
        500,
        "Failed to load member registrations."
      );
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Authenticated detail                                                       */
/* -------------------------------------------------------------------------- */

router.get(
  "/:id",
  authRequired,
  async (req, res) => {
    try {
      const registration =
        await programRegistrationService.getRegistrationById(
          pool,
          req.params.id
        );

      if (!registration) {
        return publicError(res, 404, "Registration not found.");
      }

      if (!isStaff(req)) {
        const memberId = await getMemberIdFromUser(req.user);

        if (
          !memberId ||
          Number(registration.member_id || 0) !== Number(memberId)
        ) {
          return publicError(res, 403, "Access denied.");
        }
      }

      return res.json({
        ok: true,
        registration,
      });
    } catch (err) {
      console.error(
        "GET /program-registrations/:id error:",
        err
      );

      return publicError(
        res,
        500,
        "Failed to load registration."
      );
    }
  }
);

module.exports = router;