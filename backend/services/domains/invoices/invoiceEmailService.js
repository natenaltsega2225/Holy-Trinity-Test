// backend/services/domains/invoices/invoiceEmailService.js
"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const crypto = require("crypto");
const pool = require("../../../db");

function optionalRequire(modulePath) {
  try {
    return require(modulePath);
  } catch (err) {
    if (err?.code !== "MODULE_NOT_FOUND") {
      console.error(`Failed loading ${modulePath}:`, err.message);
    }
    return {};
  }
}

const invoicePdfService = optionalRequire("./invoicePdfService");
const publicAccess = optionalRequire("./invoicePublicAccessService");
const emailService = optionalRequire("../../emailService");

let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch {
  nodemailer = null;
}

const CATEGORY_LABELS =
  invoicePdfService.CATEGORY_LABELS || {
    membership: "Membership Dues",
    plate_collection: "Plate Collection",
    candle_sale: "Candle Sale",
    general_donation: "General Donation",
    tithe: "Tithe",
    vows: "Vows",
    baptism: "Baptism",
    wedding_engagement: "Wedding / Engagement",
    memorial_service: "Memorial Service",
    pledge: "Pledge",
    building_fund: "Building Fund",
    charity_fund: "Charity Fund",
    auction: "Auction",
    sunday_cash_collection: "Sunday Collection",
    school: "School Program",
    trip: "Trip Program",
    other_fund: "Other Fund",
  };

const APP_NAME = process.env.APP_NAME || "Holy Trinity EOTC";
const CHURCH_NAME =
  process.env.CHURCH_NAME ||
  process.env.ORGANIZATION_NAME ||
  "Holy Trinity Ethiopian Orthodox Church";
const CHURCH_ADDRESS = process.env.CHURCH_ADDRESS || "Nashville, Tennessee";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "true") === "true";
const SMTP_USER = String(process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
const SMTP_PASS = String(process.env.SMTP_PASS || process.env.EMAIL_PASS || "").trim();

const DEFAULT_FROM =
  process.env.MAIL_FROM ||
  process.env.EMAIL_FROM ||
  process.env.SMTP_FROM ||
  `"${APP_NAME} Finance" <${SMTP_USER || "finance@holytrinity.local"}>`;

const META_TTL_MS = 60 * 1000;
const metaCache = new Map();
let fallbackTransporter = null;

function clean(value, max = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function escapeHtml(value) {
  return clean(value, 8000)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function numberValue(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstValue(source, keys, fallback = "") {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
  }
  return fallback;
}

function normalizeKey(value) {
  return clean(value, 140)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function pretty(value) {
  return clean(value || "--")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value) {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return clean(value, 40);
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function participantNames(value) {
  return parseJsonArray(value)
    .map((row) =>
      typeof row === "string"
        ? clean(row, 120)
        : clean(
            row.full_name ||
              row.student_name ||
              row.participant_name ||
              row.child_name ||
              row.name,
            120
          )
    )
    .filter(Boolean);
}

function lineItemAmount(item) {
  const quantity = Math.max(1, numberValue(item.quantity || item.qty || 1));
  const explicit = numberValue(
    item.total_price ||
      item.total_amount ||
      item.line_total ||
      item.amount ||
      item.price_total ||
      0
  );

  if (explicit > 0) {
    return explicit;
  }

  return numberValue(
    (item.unit_price || item.unit_amount || item.price || item.rate || 0) *
      quantity
  );
}

function lineItemsTotal(items = []) {
  if (!Array.isArray(items)) return 0;
  return Number(
    items
      .reduce((sum, item) => sum + lineItemAmount(item), 0)
      .toFixed(2)
  );
}

function safeAttachmentName(value) {
  return clean(value || "invoice", 140)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function columnsFor(tableName) {
  const cached = metaCache.get(tableName);
  if (cached && Date.now() - cached.loadedAt < META_TTL_MS) return cached.columns;

  try {
    const [rows] = await pool.query(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      `,
      [tableName]
    );

    const columns = new Set(rows.map((row) => row.COLUMN_NAME));
    metaCache.set(tableName, { columns, loadedAt: Date.now() });
    return columns;
  } catch {
    const columns = new Set();
    metaCache.set(tableName, { columns, loadedAt: Date.now() });
    return columns;
  }
}

function has(columns, column) {
  return columns && columns.has(column);
}

function sqlId(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(String(name || ""))) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
  return `\`${name}\``;
}

async function selectExisting(alias, tableName, columns) {
  const tableColumns = await columnsFor(tableName);
  return columns
    .filter((column) => has(tableColumns, column))
    .map((column) => `${alias}.${sqlId(column)} AS ${sqlId(`${alias}_${column}`)}`);
}

function categoryKeyFor(invoice) {
  const raw = normalizeKey(
    firstValue(
      invoice,
      [
        "donation_category",
        "i_donation_category",
        "p_donation_category",
        "sub_category",
        "i_sub_category",
        "p_sub_category",
        "category",
        "i_category",
        "p_category",
        "invoice_type",
        "i_invoice_type",
        "payment_type",
        "p_payment_type",
        "type",
      ],
      "other_fund"
    )
  );

  if (CATEGORY_LABELS[raw]) return raw;
  if (raw.includes("member")) return "membership";
  if (raw.includes("pledge")) return "pledge";
  if (raw.includes("school") || raw.includes("kids")) return "school";
  if (raw.includes("trip") || raw.includes("travel")) return "trip";
  if (raw.includes("plate")) return "plate_collection";
  if (raw.includes("sunday")) return "sunday_cash_collection";
  if (raw.includes("candle")) return "candle_sale";
  if (raw.includes("tithe")) return "tithe";
  if (raw.includes("vow")) return "vows";
  if (raw.includes("bapt")) return "baptism";
  if (raw.includes("wedding") || raw.includes("engagement")) return "wedding_engagement";
  if (raw.includes("memorial") || raw.includes("funeral")) return "memorial_service";
  if (raw.includes("building")) return "building_fund";
  if (raw.includes("charity")) return "charity_fund";
  if (raw.includes("auction")) return "auction";
  if (raw.includes("donation") || raw.includes("gift")) return "general_donation";

  return "other_fund";
}

function methodLabel(invoice) {
  const method = normalizeKey(
    firstValue(invoice, ["payment_method", "p_payment_method", "method"], "")
  );
  const cardBrand = firstValue(invoice, ["card_brand", "p_card_brand"], "");
  const cardLast4 = firstValue(invoice, ["card_last4", "p_card_last4"], "");
  const bankLast4 = firstValue(invoice, ["bank_last4", "p_bank_last4"], "");

  if (method === "card") {
    return [cardBrand ? pretty(cardBrand) : "Card", cardLast4 ? `**** ${cardLast4}` : ""]
      .filter(Boolean)
      .join(" ");
  }

  if (["ach", "us_bank_account", "bank", "bank_transfer"].includes(method)) {
    return bankLast4 ? `ACH / Bank **** ${bankLast4}` : "ACH / Bank";
  }

  if (method === "cash") return "Cash";
  if (method === "check") return "Check";
  if (method === "zelle") return "Zelle";

  return pretty(method || "--");
}

function normalizeInvoiceRow(invoice = {}) {
  invoice.payment_number = invoice.payment_number || invoice.p_payment_number || null;
  invoice.receipt_number = invoice.receipt_number || invoice.r_receipt_number || null;
  invoice.member_no = invoice.member_no || invoice.p_member_no || invoice.m_member_no || null;

  invoice.full_name_snapshot = firstValue(
    invoice,
    [
      "payer_name",
      "donor_name",
      "guest_name",
      "customer_name",
      "full_name_snapshot",
      "p_full_name_snapshot",
      "m_full_name",
      "member_full_name",
      "full_name",
    ],
    "Guest Donor"
  );

  invoice.email_snapshot = firstValue(
    invoice,
    [
      "payer_email",
      "donor_email",
      "guest_email",
      "customer_email",
      "email_snapshot",
      "p_email_snapshot",
      "m_email",
      "member_email",
      "email",
    ],
    ""
  );

  invoice.phone_snapshot = firstValue(
    invoice,
    [
      "payer_phone",
      "donor_phone",
      "guest_phone",
      "customer_phone",
      "phone_snapshot",
      "p_phone_snapshot",
      "m_phone",
      "member_phone",
      "phone",
    ],
    ""
  );

  invoice.reference_no =
    invoice.reference_no ||
    invoice.p_reference_no ||
    invoice.p_transaction_reference ||
    invoice.transaction_reference ||
    invoice.p_stripe_payment_intent_id ||
    invoice.stripe_payment_intent_id ||
    null;

  invoice.payment_method = invoice.payment_method || invoice.p_payment_method || null;

  return invoice;
}

function monthName(value) {
  const months = [
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

  return months[Number(value || 0)] || "";
}

function coverageLabelFor(invoice) {
  const startDate = firstValue(
    invoice,
    ["coverage_start_date", "membership_start_date", "period_from", "coverage_from", "start_date", "p_coverage_start_date"],
    ""
  );

  const endDate = firstValue(
    invoice,
    ["coverage_end_date", "membership_end_date", "period_to", "coverage_to", "end_date", "p_coverage_end_date"],
    ""
  );

  const s = startDate ? new Date(startDate) : null;
  const e = endDate ? new Date(endDate) : null;

  if (s && e && !Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
    const sy = s.getFullYear();
    const ey = e.getFullYear();
    const sm = monthName(s.getMonth() + 1);
    const em = monthName(e.getMonth() + 1);
    return sy === ey ? `${sm} - ${em} ${sy}` : `${sm} ${sy} - ${em} ${ey}`;
  }

  return firstValue(invoice, ["coverage_label", "p_coverage_label", "coverage_period"], "");
}

function invoiceView(invoice) {
  const storedAmount = numberValue(
    firstValue(
      invoice,
      [
        "total_amount",
        "invoice_amount",
        "amount",
        "subtotal",
        "p_amount",
      ],
      0
    )
  );
  const lineItemTotal = numberValue(invoice._line_items_total);
  const amount = storedAmount > 0 ? storedAmount : lineItemTotal > 0 ? lineItemTotal : 0;

  const rawPaidAmount = numberValue(
    firstValue(invoice, ["paid_amount", "amount_paid", "collected_amount", "payment_amount", "p_amount"], 0)
  );

  const paidAmount =
    amount > 0 ? Math.min(Math.max(rawPaidAmount, 0), amount) : Math.max(rawPaidAmount, 0);

  const storedBalance = firstValue(
    invoice,
    ["balance_due", "remaining_amount", "outstanding_amount"],
    null
  );
  const normalizedStatus = normalizeKey(firstValue(invoice, ["invoice_status", "status"], "open"));
  const balanceDue =
    storedBalance !== null && storedBalance !== undefined && storedBalance !== ""
      ? Math.max(
          numberValue(storedBalance) === 0 &&
            amount > 0 &&
            paidAmount <= 0 &&
            !["paid", "cancelled", "void", "refunded"].includes(normalizedStatus)
            ? amount
            : numberValue(storedBalance),
          0
        )
      : Math.max(amount - paidAmount, 0);
  const categoryKey = categoryKeyFor(invoice);
  const participants = parseJsonArray(
    firstValue(invoice, ["participants_json", "i_participants_json", "p_participants_json"], "[]")
  );

  const pledgeAmount = numberValue(firstValue(invoice, ["pledged_amount", "pledge_amount", "p_pledged_amount"], 0));
  const pledgePaid = numberValue(firstValue(invoice, ["pledge_paid_amount", "p_paid_amount"], 0));

  return {
    id: invoice.id,
    memberId: invoice.member_id || null,
    paymentId: invoice.payment_id || invoice.p_id || null,

    invoiceNumber: firstValue(invoice, ["invoice_number", "invoice_no", "number"], `INV-${invoice.id || Date.now()}`),
    paymentNumber: firstValue(invoice, ["payment_number", "p_payment_number", "payment_no", "transaction_reference"], "--"),
    receiptNumber: firstValue(invoice, ["receipt_number", "r_receipt_number", "receipt_no"], "--"),

    memberName: firstValue(
      invoice,
      ["payer_name", "donor_name", "guest_name", "customer_name", "full_name_snapshot", "p_full_name_snapshot", "m_full_name", "member_full_name", "full_name"],
      "Guest Donor"
    ),

    memberNo: firstValue(
      invoice,
      ["member_no", "p_member_no", "m_member_no", "member_number"],
      invoice.member_id ? `M-${String(invoice.member_id).padStart(5, "0")}` : "--"
    ),

    payerType: firstValue(
      invoice,
      ["donor_type", "payer_type", "p_payer_type", "member_type"],
      invoice.member_id ? "Member" : "Non Member"
    ),

    email: firstValue(
      invoice,
      ["payer_email", "donor_email", "guest_email", "customer_email", "email_snapshot", "p_email_snapshot", "recipient_email", "m_email", "member_email", "email"],
      ""
    ),

    amount,
    paidAmount,
    balanceDue,
    status:
      amount > 0 && paidAmount >= amount
        ? "paid"
        : firstValue(invoice, ["invoice_status", "status"], "open"),

    invoiceDate: firstValue(invoice, ["invoice_date", "issued_at", "created_at", "date"], new Date()),
    dueDate: firstValue(invoice, ["due_date", "invoice_due_date"], ""),

    categoryKey,
    categoryLabel: firstValue(
      invoice,
      ["donation_category_label", "i_donation_category_label", "p_donation_category_label", "category_label"],
      CATEGORY_LABELS[categoryKey] || CATEGORY_LABELS.other_fund
    ),

    programName: firstValue(invoice, ["program_name", "i_program_name", "p_program_name", "program_title", "event_title"], "--"),
    quantity: Number(firstValue(invoice, ["quantity", "i_quantity", "p_quantity"], participants.length || 1)),
    pricingTierLabel: firstValue(invoice, ["pricing_tier_label", "i_pricing_tier_label", "p_pricing_tier_label"], ""),

    participants,
    participantNames: participantNames(participants),

    pledgeCampaign: firstValue(invoice, ["campaign_name", "p_campaign_name", "pledge_campaign", "campaign"], "--"),
    pledgeRemaining: pledgeAmount ? Math.max(pledgeAmount - pledgePaid, 0) : null,

    coverageLabel: coverageLabelFor(invoice),
    coverageYear: firstValue(invoice, ["coverage_year", "membership_year", "year", "p_coverage_year"], ""),
    coverageMonths: firstValue(invoice, ["coverage_months", "coverage_months_json", "p_coverage_months_json"], ""),

    paymentMethod: methodLabel(invoice),
    reference: firstValue(
      invoice,
      ["reference_number", "reference_no", "p_reference_no", "transaction_reference", "p_transaction_reference", "stripe_payment_intent_id", "p_stripe_payment_intent_id", "check_number", "zelle_reference"],
      "--"
    ),

    paymentLink: firstValue(invoice, ["payment_url", "payment_link", "checkout_url", "public_invoice_url", "invoice_url"], ""),
  };
}

async function getInvoiceById(invoiceId) {
  if (!invoiceId) return null;

  const pSelect = await selectExisting("p", "tbl_finance_payments", [
    "payment_number",
    "amount",
    "payment_method",
    "method",
    "reference_no",
    "transaction_reference",
    "stripe_payment_intent_id",
    "card_brand",
    "card_last4",
    "bank_last4",
    "full_name_snapshot",
    "email_snapshot",
    "phone_snapshot",
    "member_no",
    "payer_type",
    "category",
    "payment_type",
    "donation_category",
    "plan_name",
    "coverage_label",
    "coverage_start_date",
    "coverage_end_date",
    "coverage_months_json",
    "program_name",
    "participants_json",
    "campaign_name",
  ]);

  const rSelect = await selectExisting("r", "tbl_finance_receipts", ["receipt_number"]);
  const mSelect = await selectExisting("m", "tbl_members", ["member_no", "full_name", "email", "phone"]);

  const extra = [...pSelect, ...rSelect, ...mSelect];

  const [[row]] = await pool.query(
    `
    SELECT i.*
      ${extra.length ? `, ${extra.join(", ")}` : ""}
    FROM tbl_finance_invoices i
    LEFT JOIN tbl_finance_payments p
      ON p.id = i.payment_id OR p.invoice_id = i.id
    LEFT JOIN tbl_finance_receipts r
      ON r.invoice_id = i.id OR r.payment_id = p.id
    LEFT JOIN tbl_members m
      ON m.id = i.member_id
    WHERE i.id = ?
    ORDER BY p.id DESC, r.id DESC
    LIMIT 1
    `,
    [invoiceId]
  );

  if (!row) return null;

  const normalized = normalizeInvoiceRow(row);
  const items = await getInvoiceItems(normalized.id);
  const itemTotal = lineItemsTotal(items);

  if (itemTotal > 0) {
    normalized._line_items_total = itemTotal;
  }

  return normalized;
}

async function getInvoiceItems(invoiceId) {
  const invoiceItemColumns = await columnsFor("tbl_finance_invoice_items");

  if (!invoiceItemColumns.size || !invoiceId) return [];

  const [rows] = await pool.query(
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

async function updateInvoiceEmailStatus(invoiceId, status, details = {}) {
  const columns = await columnsFor("tbl_finance_invoices");
  if (!columns.size || !invoiceId) return null;

  const data = {
    email_status: status,
    invoice_email_status: status,
    email_sent_at: status === "sent" ? new Date() : null,
    last_email_sent_at: status === "sent" ? new Date() : null,
    email_error: details.error || null,
    updated_at: new Date(),
  };

  const keys = Object.keys(data).filter((key) => has(columns, key));
  if (!keys.length) return null;

  await pool.query(
    `
    UPDATE tbl_finance_invoices
    SET ${keys.map((key) => `${sqlId(key)} = ?`).join(", ")}
    WHERE id = ?
    `,
    [...keys.map((key) => data[key]), invoiceId]
  );

  return true;
}

async function writeEmailTracking(invoice, status, details = {}) {
  const table = "tbl_finance_invoice_email_tracking";
  const columns = await columnsFor(table);
  if (!columns.size || !invoice?.id) return null;

  const data = {
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number || null,
    recipient_email: details.recipient || null,
    status,
    subject: details.subject || null,
    message_id: details.messageId || null,
    pdf_path: details.pdfPath || null,
    error_message: details.error || null,
    sent_at: status === "sent" ? new Date() : null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const keys = Object.keys(data).filter((key) => has(columns, key));
  if (!keys.length) return null;

  const [result] = await pool.query(
    `
    INSERT INTO ${table}
    (${keys.map(sqlId).join(", ")})
    VALUES (${keys.map(() => "?").join(", ")})
    `,
    keys.map((key) => data[key])
  );

  return result.insertId;
}

function normalizePublicLinks(raw = {}) {
  return {
    view_url: firstValue(raw, ["view_url", "viewUrl", "url", "public_invoice_url"], ""),
    pay_url: firstValue(raw, ["pay_url", "payUrl", "payment_url", "paymentUrl", "payment_link"], ""),
    token: firstValue(raw, ["token"], ""),
  };
}

function normalizeBaseUrl(value) {
  const raw = clean(value, 500).replace(/\/+$/, "");

  if (!raw) return "";

  try {
    const url = new URL(raw);

    if (!url.protocol || !url.hostname) return "";

    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

function invoicePublicBaseUrl() {
  const candidates = [
    process.env.BACKEND_PUBLIC_URL,
    process.env.PUBLIC_BACKEND_URL,
    process.env.API_PUBLIC_URL,
    process.env.APP_URL,
    process.env.FRONTEND_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeBaseUrl(candidate);
    if (normalized) return normalized;
  }

  return "http://localhost:5000";
}

function normalizeSecret(value) {
  return clean(value, 500).replace(/^["']|["']$/g, "");
}

function primaryInvoiceSecret() {
  return (
    normalizeSecret(process.env.PUBLIC_INVOICE_TOKEN_SECRET) ||
    normalizeSecret(process.env.INVOICE_PUBLIC_TOKEN_SECRET) ||
    normalizeSecret(process.env.PUBLIC_INVOICE_SECRET) ||
    normalizeSecret(process.env.JWT_SECRET) ||
    "change_me_public_invoice_token_secret"
  );
}

function hmacSignature(payloadPart, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(payloadPart)
    .digest("base64url");
}

function createPublicInvoiceToken(invoice, scopes = ["view", "pay"]) {
  const invoiceNumber = firstValue(
    invoice,
    ["invoice_number", "invoice_no", "number"],
    ""
  );

  const storedAmount = numberValue(
    firstValue(
      invoice,
      ["total_amount", "invoice_amount", "amount", "subtotal"],
      0
    )
  );
  const lineItemTotal = numberValue(invoice._line_items_total);
  const invoiceAmount = storedAmount > 0 ? storedAmount : lineItemTotal > 0 ? lineItemTotal : 0;

  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = Number(process.env.PUBLIC_INVOICE_TOKEN_TTL_SECONDS || 2592000);

  const payload = {
    typ: "public_invoice_access",
    ver: 2,
    aud: "invoice-public-link",
    invoice_id: invoice.id,
    invoice_number: invoiceNumber,
    scope: scopes,
    fp: crypto
      .createHash("sha256")
      .update(`${invoice.id}:${invoiceNumber}:${invoiceAmount}`)
      .digest("base64url"),
    iat: now,
    nbf: now - 30,
    exp: now + ttlSeconds,
    nonce: crypto.randomBytes(16).toString("base64url"),
  };

  const payloadPart = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signaturePart = hmacSignature(payloadPart, primaryInvoiceSecret());

  return `${payloadPart}.${signaturePart}`;
}

function buildLocalPublicLinks(invoice) {
  const invoiceNumber = firstValue(
    invoice,
    ["invoice_number", "invoice_no", "number"],
    ""
  );

  if (!invoice?.id || !invoiceNumber) {
    return normalizePublicLinks({});
  }

  const encodedInvoiceNumber = encodeURIComponent(invoiceNumber);
  const baseUrl = invoicePublicBaseUrl();
  const viewToken = createPublicInvoiceToken(invoice, [
    "view",
    "pdf",
    "download",
    "pay",
  ]);
  const payToken = createPublicInvoiceToken(invoice, ["view", "pay"]);

  const viewPath =
    `/api/public/invoices/${encodedInvoiceNumber}` +
    `?token=${encodeURIComponent(viewToken)}`;

  const checkoutPath =
    `/api/public/invoices/${encodedInvoiceNumber}/checkout` +
    `?token=${encodeURIComponent(payToken)}`;

  return normalizePublicLinks({
    view_url: `${baseUrl}${viewPath}`,
    pay_url: `${baseUrl}${checkoutPath}`,
    payment_link: `${baseUrl}${checkoutPath}`,
    token: payToken,
  });
}

function invoiceRequiresPayment(view = {}) {
  const status = normalizeKey(view.status);
  return Number(view.balanceDue || 0) > 0 && !["paid", "cancelled", "void"].includes(status);
}

async function buildInvoicePublicEmailLinks(invoice, options = {}) {
  if (options.disablePaymentLink === true || options.disable_payment_link === true) {
    return normalizePublicLinks({});
  }

  if (options.publicLinks) return normalizePublicLinks(options.publicLinks);

  if (options.payment_link || options.paymentLink || options.pay_url) {
    return normalizePublicLinks({
      pay_url: options.payment_link || options.paymentLink || options.pay_url,
    });
  }

  if (typeof publicAccess.buildInvoicePublicLinks === "function") {
    try {
      return normalizePublicLinks(
        await publicAccess.buildInvoicePublicLinks(invoice, {
          ttl_days: options.public_link_ttl_days || options.publicLinkTtlDays || 30,
          scope: options.scope || ["view", "pay"],
        })
      );
    } catch (err) {
      console.error("Public invoice payment link generation failed:", err.message);
    }
  }

  const localLinks = buildLocalPublicLinks(invoice);

  if (localLinks.pay_url || localLinks.view_url) {
    return localLinks;
  }

  return normalizePublicLinks({
    pay_url: firstValue(invoice, ["payment_url", "payment_link", "checkout_url", "public_invoice_url"], ""),
    view_url: firstValue(invoice, ["public_invoice_url", "invoice_url"], ""),
  });
}

function statusBadgeColor(status) {
  const normalized = normalizeKey(status);
  if (normalized === "paid") return "#15803d";
  if (normalized === "partial") return "#b45309";
  if (normalized === "overdue") return "#b91c1c";
  if (normalized === "cancelled" || normalized === "void") return "#6b7280";
  return "#1d4ed8";
}

function detailRow(label, value) {
  return `
    <tr>
      <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;color:#475569;font-size:13px;width:38%;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:10px 12px;border:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:600;">
        ${escapeHtml(value || "--")}
      </td>
    </tr>
  `;
}

function renderSummaryCards(view) {
  const cards = [
    ["Invoice Amount", money(view.amount), "#0f3e67"],
    ["Paid", money(view.paidAmount), "#15803d"],
    ["Balance Due", money(view.balanceDue), view.balanceDue > 0 ? "#b91c1c" : "#15803d"],
  ];

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:10px;margin-top:24px;">
      <tr>
        ${cards
          .map(
            ([label, value, color]) => `
              <td style="border:1px solid #dbe7f3;border-radius:12px;padding:16px;background:#f8fbff;width:33.33%;">
                <div style="font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;">${escapeHtml(label)}</div>
                <div style="margin-top:8px;font-size:20px;font-weight:800;color:${color};">${escapeHtml(value)}</div>
              </td>
            `
          )
          .join("")}
      </tr>
    </table>
  `;
}

function renderItemsTable(items = []) {
  if (!items.length) return "";

  return `
    <div style="margin-top:24px;">
      <div style="font-size:13px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">
        Invoice Items
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#0f3e67;color:#ffffff;">
            <th align="left" style="padding:10px 12px;font-size:12px;">Item</th>
            <th align="center" style="padding:10px 12px;font-size:12px;">Qty</th>
            <th align="right" style="padding:10px 12px;font-size:12px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">
                  ${escapeHtml(item.item_name || item.item_type || "Invoice Item")}
                  <div style="font-size:12px;color:#64748b;margin-top:3px;">${escapeHtml(item.description || "")}</div>
                </td>
                <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:13px;">
                  ${escapeHtml(String(item.quantity || 1))}
                </td>
                <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:13px;font-weight:700;">
                  ${money(item.total_price || item.unit_price || 0)}
                </td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderEnterpriseSections(view) {
  const blocks = [];

  if (view.categoryKey === "membership" || view.coverageLabel) {
    blocks.push(`
      <div style="margin-top:22px;padding:16px;border:1px solid #dbe7f3;border-radius:10px;background:#f8fbff;">
        <div style="font-size:13px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">Membership Coverage</div>
        <div style="margin-top:8px;color:#0f172a;font-size:14px;">${escapeHtml(view.coverageLabel || `Coverage Year: ${view.coverageYear || "--"}`)}</div>
      </div>
    `);
  }

  if (view.categoryKey === "school" || view.categoryKey === "trip") {
    blocks.push(`
      <div style="margin-top:22px;padding:16px;border:1px solid #dbe7f3;border-radius:10px;background:#ffffff;">
        <div style="font-size:13px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">
          ${view.categoryKey === "trip" ? "Trip Program" : "School Program"}
        </div>
        <div style="margin-top:8px;color:#0f172a;font-size:14px;font-weight:700;">${escapeHtml(view.programName)}</div>
        <div style="margin-top:8px;color:#334155;font-size:13px;">Quantity: ${escapeHtml(String(view.quantity || 1))}</div>
        ${
          view.participantNames.length
            ? `<div style="margin-top:10px;color:#334155;font-size:13px;line-height:1.6;"><strong>Participants:</strong> ${escapeHtml(view.participantNames.join(", "))}</div>`
            : ""
        }
      </div>
    `);
  }

  if (view.categoryKey === "pledge" || view.pledgeCampaign !== "--") {
    blocks.push(`
      <div style="margin-top:22px;padding:16px;border:1px solid #dbe7f3;border-radius:10px;background:#ffffff;">
        <div style="font-size:13px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">Pledge Campaign</div>
        <div style="margin-top:8px;color:#0f172a;font-size:14px;">
          ${escapeHtml(view.pledgeCampaign)}
          ${view.pledgeRemaining !== null ? ` | Remaining: ${escapeHtml(money(view.pledgeRemaining))}` : ""}
        </div>
      </div>
    `);
  }

  return blocks.join("");
}

function invoiceEmailTemplate(view, options = {}) {
  const links = normalizePublicLinks(options.publicLinks || {});
  const actionUrl = invoiceRequiresPayment(view)
    ? links.pay_url || links.view_url || view.paymentLink || ""
    : "";

  const statusColor = statusBadgeColor(view.status);

  return `
  <div style="background:#f1f5f9;padding:34px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:760px;margin:auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dbe3ef;">
      <div style="background:#0f3e67;color:#ffffff;padding:30px 34px;">
        <div style="font-size:25px;font-weight:800;">${escapeHtml(CHURCH_NAME)}</div>
        <div style="margin-top:8px;font-size:13px;color:#d8e5f3;">Finance & Membership Platform</div>
      </div>

      <div style="padding:34px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="top">
              <h2 style="margin:0;font-size:24px;color:#0f172a;">Finance Invoice</h2>
              <p style="margin:10px 0 0;color:#475569;line-height:1.6;font-size:14px;">
                Dear ${escapeHtml(view.memberName)},<br/>
                Your invoice has been generated. A PDF copy is attached to this email.
              </p>
            </td>
            <td valign="top" align="right">
              <div style="display:inline-block;background:${statusColor};color:white;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:800;text-transform:uppercase;">
                ${escapeHtml(view.status)}
              </div>
              <div style="margin-top:10px;color:#64748b;font-size:12px;">${escapeHtml(formatDate(view.invoiceDate))}</div>
            </td>
          </tr>
        </table>

        ${renderSummaryCards(view)}

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:28px;">
          ${detailRow("Invoice #", view.invoiceNumber)}
          ${detailRow("Payment #", view.paymentNumber)}
          ${detailRow("Receipt #", view.receiptNumber)}
          ${detailRow("Member / Donor", `${view.memberName} (${view.memberNo || "--"})`)}
          ${detailRow("Payer Type", view.payerType)}
          ${detailRow("Category", view.categoryLabel)}
          ${detailRow("Payment Method", view.paymentMethod)}
          ${detailRow("Reference #", view.reference)}
          ${detailRow("Due Date", formatDate(view.dueDate))}
        </table>

        ${renderItemsTable(options.items || [])}
        ${renderEnterpriseSections(view)}

        ${
          actionUrl
            ? `
              <div style="margin-top:30px;">
                <a href="${escapeHtml(actionUrl)}"
                   style="display:inline-block;background:#0f3e67;color:#ffffff;text-decoration:none;border-radius:10px;padding:13px 18px;font-weight:800;font-size:14px;">
                  Pay Invoice Securely
                </a>
              </div>
            `
            : ""
        }

        <p style="margin:28px 0 0;color:#64748b;line-height:1.7;font-size:13px;">
          ${
            actionUrl
              ? "You can pay this invoice using the secure payment button above. A PDF copy is attached for your records."
              : "Please keep the attached PDF invoice for your records."
          }
        </p>
      </div>

      <div style="border-top:1px solid #e2e8f0;padding:22px 34px;background:#f8fafc;color:#64748b;font-size:12px;text-align:center;line-height:1.6;">
        ${escapeHtml(CHURCH_NAME)}<br/>
        ${escapeHtml(CHURCH_ADDRESS)}
      </div>
    </div>
  </div>
  `;
}

function invoiceTextTemplate(view, options = {}) {
  const links = normalizePublicLinks(options.publicLinks || {});
  const actionUrl = invoiceRequiresPayment(view)
    ? links.pay_url || links.view_url || view.paymentLink || ""
    : "";

  return [
    `${CHURCH_NAME} Finance Invoice`,
    "",
    `Dear ${view.memberName},`,
    "",
    "Your invoice has been generated. A PDF copy is attached to this email.",
    "",
    `Invoice #: ${view.invoiceNumber}`,
    `Amount: ${money(view.amount)}`,
    `Paid: ${money(view.paidAmount)}`,
    `Balance Due: ${money(view.balanceDue)}`,
    `Status: ${view.status}`,
    `Category: ${view.categoryLabel}`,
    `Payment Method: ${view.paymentMethod}`,
    `Due Date: ${formatDate(view.dueDate)}`,
    view.programName !== "--" ? `Program: ${view.programName}` : "",
    view.participantNames.length ? `Participants: ${view.participantNames.join(", ")}` : "",
    actionUrl ? `Pay Invoice: ${actionUrl}` : "",
    "",
    CHURCH_ADDRESS,
  ]
    .filter(Boolean)
    .join("\n");
}

async function buildPdfAttachment(invoice, options = {}) {
  if (options.attachPdf === false || options.attach_pdf === false) {
    return { pdf: null, attachment: null };
  }

  try {
    let buffer = null;
    let pdf = null;

    if (typeof invoicePdfService.generateInvoicePdfBuffer === "function") {
      buffer = await invoicePdfService.generateInvoicePdfBuffer(invoice);
    } else if (typeof invoicePdfService.generateInvoicePdf === "function") {
      pdf = await invoicePdfService.generateInvoicePdf(invoice, { download: false });

      buffer = Buffer.isBuffer(pdf) ? pdf : pdf?.buffer || pdf?.data || null;

      const filePath = pdf?.file_path || pdf?.path;
      if (!buffer && filePath && fs.existsSync(filePath)) {
        buffer = await fsp.readFile(filePath);
      }
    }

    if (!buffer) return { pdf, attachment: null };

    return {
      pdf,
      attachment: {
        filename: `${safeAttachmentName(invoice.invoice_number || "invoice")}.pdf`,
        content: buffer,
        contentType: "application/pdf",
      },
    };
  } catch (err) {
    console.error("Invoice PDF attachment failed:", err.message);
    return { pdf: null, attachment: null, error: err.message };
  }
}

async function getTransporter() {
  if (fallbackTransporter) return fallbackTransporter;

  if (!nodemailer) {
    throw new Error("No email sender is configured.");
  }

  fallbackTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  return fallbackTransporter;
}

async function sendMail(payload) {
  if (typeof emailService.sendEmail === "function") return emailService.sendEmail(payload);
  if (typeof emailService.sendMail === "function") return emailService.sendMail(payload);

  const transporter = await getTransporter();
  return transporter.sendMail(payload);
}

function resolveInvoiceId(input) {
  if (typeof input === "object" && input !== null) {
    return input.invoice_id || input.invoiceId || input.id;
  }
  return input;
}

async function sendInvoiceEmail(invoiceIdOrPayload, options = {}) {
  const invoiceId = resolveInvoiceId(invoiceIdOrPayload);
  const optionBag =
    typeof invoiceIdOrPayload === "object" && invoiceIdOrPayload !== null
      ? { ...invoiceIdOrPayload, ...options }
      : options;

  let invoice = null;

  try {
    invoice =
      typeof invoiceIdOrPayload === "object" && invoiceIdOrPayload !== null && !invoiceId
        ? normalizeInvoiceRow({ ...invoiceIdOrPayload })
        : await getInvoiceById(invoiceId);

    if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`);

    const items = await getInvoiceItems(invoice.id);
    const itemTotal = lineItemsTotal(items);
    const invoiceForView = {
      ...invoice,
      ...(itemTotal > 0 ? { _line_items_total: itemTotal } : {}),
    };

    const view = invoiceView(invoiceForView);
    const publicLinks = invoiceRequiresPayment(view)
      ? await buildInvoicePublicEmailLinks(invoiceForView, optionBag)
      : normalizePublicLinks({});

    const recipient = clean(
      optionBag.recipient_email ||
        optionBag.recipientEmail ||
        optionBag.email ||
        optionBag.to ||
        view.email,
      255
    );

    if (!recipient) throw new Error("Invoice recipient email is missing.");

    const subject =
      clean(optionBag.subject, 180) || `${CHURCH_NAME} Invoice ${view.invoiceNumber}`;

    const attachments = Array.isArray(optionBag.attachments)
      ? [...optionBag.attachments]
      : [];

    let pdf = null;
    let pdfAttachmentError = null;

    if (!Array.isArray(optionBag.attachments)) {
      const result = await buildPdfAttachment({ ...invoiceForView, email: recipient }, optionBag);
      pdf = result.pdf;
      pdfAttachmentError = result.error || null;
      if (result.attachment) attachments.push(result.attachment);
    }

    const mailResult = await sendMail({
      from: optionBag.from || DEFAULT_FROM,
      to: recipient,
      cc: optionBag.cc || undefined,
      bcc: optionBag.bcc || undefined,
      replyTo: optionBag.replyTo || process.env.FINANCE_REPLY_TO || undefined,
      subject,
      html:
        optionBag.html ||
        invoiceEmailTemplate(view, {
          publicLinks,
          pdf,
          items,
        }),
      text:
        optionBag.text ||
        invoiceTextTemplate(view, {
          publicLinks,
        }),
      attachments,

      raw: true,
      layout: false,
      template: false,
      skipDefaultLayout: true,
      suppressDefaultLayout: true,
      suppressDefaultHeader: true,
      suppressDefaultFooter: true,
    });

    const messageId =
      mailResult?.messageId || mailResult?.message_id || mailResult?.id || null;

    await updateInvoiceEmailStatus(invoice.id, "sent", {
      messageId,
      recipient,
      pdfUrl: pdf?.pdf_url || null,
      viewUrl: null,
      payUrl: publicLinks.pay_url || publicLinks.view_url || null,
    }).catch((err) => {
      console.error("Invoice email status update failed:", err.message);
    });

    await writeEmailTracking(invoice, "sent", {
      recipient,
      subject,
      messageId,
      pdfPath: pdf?.file_path || pdf?.path || null,
      resend: !!optionBag.resend,
      source: optionBag.source || "invoice_email_service",
    }).catch((err) => {
      console.error("Invoice email tracking write failed:", err.message);
    });

    return {
      success: true,
      invoice_id: invoice.id,
      invoice_number: view.invoiceNumber,
      to: recipient,
      messageId,
      attached_pdf: attachments.some((item) => item.contentType === "application/pdf"),
      pdf_attachment_error: pdfAttachmentError,
      payment_link_included: Boolean(publicLinks.pay_url || publicLinks.view_url),
      payment_link: publicLinks.pay_url || publicLinks.view_url || null,
      pay_url: publicLinks.pay_url || null,
      view_url: publicLinks.view_url || null,
      pdf,
    };
  } catch (err) {
    console.error("Enterprise invoice email failed:", err.message);

    if (invoice?.id) {
      await updateInvoiceEmailStatus(invoice.id, "failed", {
        error: err.message,
        recipient:
          optionBag.recipient_email ||
          optionBag.recipientEmail ||
          optionBag.email ||
          optionBag.to ||
          invoice.email_snapshot ||
          invoice.email ||
          null,
      }).catch(() => null);

      await writeEmailTracking(invoice, "failed", {
        recipient:
          optionBag.recipient_email ||
          optionBag.recipientEmail ||
          optionBag.email ||
          optionBag.to ||
          invoice.email_snapshot ||
          invoice.email ||
          null,
        subject: optionBag.subject || null,
        error: err.message,
        resend: !!optionBag.resend,
        source: optionBag.source || "invoice_email_service",
      }).catch(() => null);
    }

    return {
      success: false,
      invoice_id: invoice?.id || invoiceId || null,
      error: err.message,
    };
  }
}

async function resendInvoiceEmail(invoiceId, options = {}) {
  return sendInvoiceEmail(invoiceId, {
    ...options,
    resend: true,
    source: options.source || "invoice_email_resend",
  });
}

async function sendInvoiceEmailByPayment(paymentId, options = {}) {
  if (!paymentId) {
    return { success: false, error: "Payment id is required." };
  }

  const invoiceColumns = await columnsFor("tbl_finance_invoices");

  if (has(invoiceColumns, "payment_id")) {
    const [rows] = await pool.query(
      `
      SELECT id
      FROM tbl_finance_invoices
      WHERE payment_id = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [paymentId]
    );

    if (rows[0]?.id) return sendInvoiceEmail(rows[0].id, options);
  }

  const [paymentRows] = await pool.query(
    `
    SELECT invoice_id
    FROM tbl_finance_payments
    WHERE id = ?
      AND invoice_id IS NOT NULL
    LIMIT 1
    `,
    [paymentId]
  );

  if (paymentRows[0]?.invoice_id) {
    return sendInvoiceEmail(paymentRows[0].invoice_id, options);
  }

  return {
    success: false,
    payment_id: paymentId,
    error: "No invoice found for payment.",
  };
}

module.exports = {
  getInvoiceById,
  getInvoiceItems,

  buildInvoicePublicEmailLinks,
  buildPdfAttachment,

  sendInvoiceEmail,
  resendInvoiceEmail,
  sendInvoiceEmailByPayment,

  invoiceView,
  invoiceEmailTemplate,
  invoiceTextTemplate,
};
