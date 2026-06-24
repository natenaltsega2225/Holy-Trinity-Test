// backend/routes/publicInvoices.js
"use strict";

const express = require("express");
const crypto = require("crypto");
const fs = require("fs");

const jwt = require("jsonwebtoken");
const Stripe = require("stripe");

const db = require("../db");

const router = express.Router();

const INVOICE_TABLE = "tbl_finance_invoices";
const INVOICE_ITEMS_TABLE = "tbl_finance_invoice_items";

const columnCache = new Map();

/* -------------------------------------------------------------------------- */
/* Basic Helpers                                                              */
/* -------------------------------------------------------------------------- */

function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }

  return Stripe(process.env.STRIPE_SECRET_KEY);
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function cents(value) {
  return Math.max(0, Math.round(money(value) * 100));
}

function formatMoney(value) {
  return `$${money(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function clean(value) {
  return String(value || "").trim();
}

function sqlValue(value) {
  if (value instanceof Date) return value;

  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }

  return value;
}

function safeJson(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function h(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* -------------------------------------------------------------------------- */
/* Public URL Helpers                                                         */
/* -------------------------------------------------------------------------- */

function normalizeBaseUrl(value) {
  const raw = clean(value)
    .replace(/^["']|["']$/g, "")
    .replace(/,+$/, "")
    .replace(/\/+$/, "");

  if (!raw) return "";

  try {
    const url = new URL(raw);

    if (!url.protocol || !url.hostname) {
      return "";
    }

    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

function publicBaseUrl(req) {
  const candidates = [
    process.env.BACKEND_PUBLIC_URL,
    process.env.PUBLIC_BACKEND_URL,
    process.env.API_PUBLIC_URL,
    process.env.APP_URL,
    process.env.FRONTEND_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeBaseUrl(candidate);

    if (normalized) {
      return normalized;
    }
  }

  const host =
    req?.get?.("x-forwarded-host") ||
    req?.get?.("host");

  const forwardedProto = clean(req?.get?.("x-forwarded-proto"));
  const proto =
    process.env.TRUST_PROXY_HTTPS === "true" && forwardedProto
      ? forwardedProto
      : req?.protocol || "http";

  const normalized = normalizeBaseUrl(`${proto}://${host}`);

  if (normalized) {
    return normalized;
  }

  return "http://localhost:5000";
}

function absoluteUrl(req, path) {
  const base = publicBaseUrl(req);
  const normalizedPath = String(path || "").startsWith("/")
    ? path
    : `/${path}`;

  return `${base}${normalizedPath}`;
}

function sameOriginCheckoutPath(invoiceNumber, token, method = "") {
  const base =
    `/api/public/invoices/${encodeURIComponent(invoiceNumber)}/checkout`;

  const params = new URLSearchParams();

  if (method) params.set("method", method);
  params.set("token", token);

  return `${base}?${params.toString()}`;
}
function sameOriginPath(path) {
  return String(path || "").startsWith("/")
    ? path
    : `/${path}`;
}

/* -------------------------------------------------------------------------- */
/* Token Security                                                             */
/* -------------------------------------------------------------------------- */

function normalizeSecret(value) {
  return clean(value).replace(/^["']|["']$/g, "");
}

function invoiceSecrets() {
  const candidates = [
    process.env.PUBLIC_INVOICE_TOKEN_SECRET,
    process.env.INVOICE_PUBLIC_TOKEN_SECRET,
    process.env.PUBLIC_INVOICE_SECRET,
    process.env.JWT_SECRET,
  ]
    .map(normalizeSecret)
    .filter(Boolean);

  return [...new Set(candidates)];
}

function primaryInvoiceSecret() {
  return (
    invoiceSecrets()[0] ||
    "change_me_public_invoice_token_secret"
  );
}

function base64UrlJsonDecode(value) {
  const json = Buffer.from(String(value || ""), "base64url").toString("utf8");
  return JSON.parse(json);
}

function hmacSignature(payloadPart, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(payloadPart)
    .digest("base64url");
}

function safeEqual(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue || ""));
  const right = Buffer.from(String(rightValue || ""));

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function verifyTwoPartInvoiceToken(token) {
  const parts = String(token || "").split(".");

  if (parts.length !== 2) {
    throw new Error("Not a two-part invoice token.");
  }

  const [payloadPart, signaturePart] = parts;
  const decoded = base64UrlJsonDecode(payloadPart);

  let valid = false;

  for (const secret of invoiceSecrets()) {
    const expected = hmacSignature(payloadPart, secret);

    if (safeEqual(expected, signaturePart)) {
      valid = true;
      break;
    }
  }

  if (!valid) {
    throw new Error("Invalid invoice token signature.");
  }

  const now = Math.floor(Date.now() / 1000);

  if (decoded.nbf && now + 300 < Number(decoded.nbf)) {
    throw new Error("Invoice token is not active yet.");
  }

  if (decoded.exp && now - 300 > Number(decoded.exp)) {
    throw new Error("Invoice token has expired.");
  }

  if (decoded.aud && decoded.aud !== "invoice-public-link") {
    throw new Error("Invalid invoice token audience.");
  }

  return decoded;
}

function verifyJwtInvoiceToken(token) {
  let lastError = null;

  for (const secret of invoiceSecrets()) {
    try {
      return jwt.verify(token, secret, {
        audience: "invoice-public-link",
        clockTolerance: 300,
      });
    } catch (err) {
      lastError = err;

      try {
        const decoded = jwt.verify(token, secret, {
          clockTolerance: 300,
        });

        if (decoded.aud && decoded.aud !== "invoice-public-link") {
          lastError = new Error("Invalid invoice token audience.");
          continue;
        }

        return decoded;
      } catch (fallbackErr) {
        lastError = fallbackErr;
      }
    }
  }

  throw lastError || new Error("Invalid invoice token.");
}

function verifyInvoiceToken(req, invoiceNumber, requiredScope = "view") {
  const token = clean(req.query.token || req.body?.token);

  if (!token) {
    const err = new Error("Secure invoice token is required.");
    err.status = 401;
    throw err;
  }

  let decoded;

  try {
    const partCount = token.split(".").length;

    decoded =
      partCount === 2
        ? verifyTwoPartInvoiceToken(token)
        : verifyJwtInvoiceToken(token);
  } catch (err) {
    const e = new Error("Secure invoice link is invalid or expired.");
    e.status = 401;
    e.cause = err;
    throw e;
  }

  if (
    decoded.invoice_number &&
    String(decoded.invoice_number) !== String(invoiceNumber)
  ) {
    const err = new Error("Secure invoice token does not match this invoice.");
    err.status = 403;
    throw err;
  }

  const scopes = Array.isArray(decoded.scope)
    ? decoded.scope
    : [decoded.scope || "view"];

  if (
    requiredScope &&
    !scopes.includes(requiredScope) &&
    !scopes.includes("email")
  ) {
    const err = new Error("Secure invoice token is not allowed for this action.");
    err.status = 403;
    throw err;
  }

  return {
    token,
    decoded,
  };
}

function createInvoiceToken(invoice, scopes = ["view", "pay"]) {
  const invoiceNumber =
    invoice.invoice_number ||
    invoice.invoice_no ||
    invoice.number;

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
      .update(
        `${invoice.id}:${invoiceNumber}:${invoiceTotal(invoice)}`
      )
      .digest("base64url"),
    iat: now,
    nbf: now - 30,
    exp: now + ttlSeconds,
    nonce: crypto.randomBytes(16).toString("base64url"),
  };

  const payloadPart = Buffer
    .from(JSON.stringify(payload))
    .toString("base64url");

  const signaturePart = hmacSignature(
    payloadPart,
    primaryInvoiceSecret()
  );

  return `${payloadPart}.${signaturePart}`;
}

function buildPublicInvoiceUrls(invoice, req = null) {
  const invoiceNumber = encodeURIComponent(
    invoice.invoice_number || invoice.invoice_no || invoice.number
  );

  const viewToken = createInvoiceToken(invoice, [
    "view",
    "pdf",
    "download",
    "pay",
  ]);

  const payToken = createInvoiceToken(invoice, [
    "view",
    "pay",
  ]);

  return {
    view_url: absoluteUrl(
      req,
      `/api/public/invoices/${invoiceNumber}?token=${encodeURIComponent(viewToken)}`
    ),
    pdf_url: absoluteUrl(
      req,
      `/api/public/invoices/${invoiceNumber}/pdf?token=${encodeURIComponent(viewToken)}`
    ),
    download_url: absoluteUrl(
      req,
      `/api/public/invoices/${invoiceNumber}/download?token=${encodeURIComponent(viewToken)}`
    ),
    checkout_url: absoluteUrl(
      req,
      `/api/public/invoices/${invoiceNumber}/checkout?token=${encodeURIComponent(payToken)}`
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Schema Helpers                                                             */
/* -------------------------------------------------------------------------- */

async function tableColumns(table) {
  if (columnCache.has(table)) {
    return columnCache.get(table);
  }

  const [rows] = await db.query(`SHOW COLUMNS FROM ${table}`);
  const columns = new Set(rows.map((row) => row.Field));

  columnCache.set(table, columns);

  return columns;
}

async function tableHasColumn(table, column) {
  const columns = await tableColumns(table);
  return columns.has(column);
}

async function updateExistingColumns(table, id, values = {}) {
  const columns = await tableColumns(table);
  const entries = Object.entries(values).filter(
    ([key, value]) => columns.has(key) && value !== undefined
  );

  if (!entries.length) {
    return false;
  }

  await db.query(
    `
    UPDATE ${table}
    SET ${entries.map(([key]) => `${key} = ?`).join(", ")}
    WHERE id = ?
    LIMIT 1
    `,
    [
      ...entries.map(([, value]) => sqlValue(value)),
      id,
    ]
  );

  return true;
}

/* -------------------------------------------------------------------------- */
/* Invoice Helpers                                                            */
/* -------------------------------------------------------------------------- */

function processingFee(amount, method) {
  const base = money(amount);

  if (base <= 0) {
    return 0;
  }

  const enabled = String(
    process.env.INVOICE_PROCESSING_FEE_ENABLED ?? "true"
  ).toLowerCase() !== "false";

  if (!enabled) {
    return 0;
  }

  if (method === "ach") {
    const rate = Number(process.env.STRIPE_ACH_FEE_RATE || 0.008);
    const fixed = Number(process.env.STRIPE_ACH_FIXED_FEE || 0);
    const cap = Number(process.env.STRIPE_ACH_FEE_CAP || 5);

    const grossFee = ((base + fixed) / (1 - rate)) - base;
    return money(Math.min(grossFee, cap));
  }

  const rate = Number(process.env.STRIPE_CARD_FEE_RATE || 0.029);
  const fixed = Number(process.env.STRIPE_CARD_FIXED_FEE || 0.3);

  return money(((base + fixed) / (1 - rate)) - base);
}

function normalizeCheckoutMethod(value) {
  const method = String(value || "").trim().toLowerCase();

  if (["ach", "bank", "bank_account", "us_bank_account"].includes(method)) {
    return "ach";
  }

  if (["card", "credit", "debit"].includes(method)) {
    return "card";
  }

  return "";
}

function invoiceStatus(invoice) {
  return String(invoice.status || invoice.invoice_status || "").toLowerCase();
}

function lineItemAmount(item) {
  const quantity = Math.max(1, money(item.quantity || item.qty || 1));
  const explicit = money(
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

  return money(
    (item.unit_price || item.unit_amount || item.price || item.rate || 0) *
      quantity
  );
}

function lineItemsTotal(items = []) {
  if (!Array.isArray(items)) return 0;
  return money(items.reduce((sum, item) => sum + lineItemAmount(item), 0));
}

function invoiceTotal(invoice) {
  return money(
    invoice.total_amount ||
      invoice.invoice_amount ||
      invoice.amount ||
      invoice.subtotal ||
      invoice._line_items_total ||
      0
  );
}

function invoicePaid(invoice) {
  return money(invoice.paid_amount || invoice.amount_paid || invoice.collected_amount || 0);
}

function invoiceBalance(invoice) {
  const stored =
    invoice.balance_due ??
    invoice.remaining_amount ??
    invoice.outstanding_amount;
  const total = invoiceTotal(invoice);
  const paid = invoicePaid(invoice);
  const status = invoiceStatus(invoice);

  if (stored !== null && stored !== undefined && stored !== "") {
    const storedBalance = Math.max(0, money(stored));

    if (
      storedBalance === 0 &&
      total > 0 &&
      paid <= 0 &&
      !["paid", "cancelled", "void", "refunded"].includes(status)
    ) {
      return total;
    }

    return storedBalance;
  }

  return Math.max(0, money(total - paid));
}

async function getInvoiceByNumber(invoiceNumber) {
  const where = ["invoice_number = ?"];
  const params = [invoiceNumber];

  if (await tableHasColumn(INVOICE_TABLE, "invoice_no")) {
    where.push("invoice_no = ?");
    params.push(invoiceNumber);
  }

  const [rows] = await db.query(
    `
    SELECT *
    FROM ${INVOICE_TABLE}
    WHERE ${where.join(" OR ")}
    LIMIT 1
    `,
    params
  );

  const invoice = rows[0] || null;

  if (!invoice) {
    return null;
  }

  const items = await getInvoiceItems(invoice.id);
  const itemTotal = lineItemsTotal(items);

  if (itemTotal > 0) {
    invoice._line_items_total = itemTotal;
  }

  return invoice;
}

async function getInvoiceItems(invoiceId) {
  try {
    const [rows] = await db.query(
      `
      SELECT *
      FROM ${INVOICE_ITEMS_TABLE}
      WHERE invoice_id = ?
      ORDER BY id ASC
      `,
      [invoiceId]
    );

    return rows;
  } catch {
    return [];
  }
}

function invoiceDisplayName(invoice) {
  return (
    invoice.full_name_snapshot ||
    invoice.bill_to ||
    invoice.payer_name ||
    invoice.donor_name ||
    invoice.customer_name ||
    invoice.full_name ||
    "Guest"
  );
}

function invoiceEmail(invoice) {
  return (
    invoice.email_snapshot ||
    invoice.recipient_email ||
    invoice.payer_email ||
    invoice.donor_email ||
    invoice.customer_email ||
    invoice.email ||
    ""
  );
}

function invoiceCategory(invoice) {
  return (
    invoice.category ||
    invoice.payment_type ||
    invoice.invoice_type ||
    invoice.donation_category ||
    "invoice"
  );
}

/* -------------------------------------------------------------------------- */
/* HTML                                                                       */
/* -------------------------------------------------------------------------- */

function renderMethodChoicePage(_req, invoice, token) {
  const invoiceNumber = invoice.invoice_number || invoice.invoice_no;
  const balance = invoiceBalance(invoice);
  const cardFee = processingFee(balance, "card");
  const achFee = processingFee(balance, "ach");

  const cardUrl = sameOriginCheckoutPath(invoiceNumber, token, "card");
const achUrl = sameOriginCheckoutPath(invoiceNumber, token, "ach");
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Pay Invoice ${h(invoiceNumber)}</title>
        <style>
          body {
            margin: 0;
            background: #f3f7fb;
            color: #0f172a;
            font-family: Arial, sans-serif;
          }
          .wrap {
            max-width: 760px;
            margin: 40px auto;
            padding: 24px;
          }
          .card {
            background: #fff;
            border: 1px solid #cbd8e6;
            border-radius: 12px;
            box-shadow: 0 12px 28px rgba(15, 23, 42, .08);
            overflow: hidden;
          }
          .head {
            background: #12476f;
            color: #fff;
            padding: 26px 30px;
          }
          .head h1 {
            margin: 0 0 6px;
            font-size: 24px;
          }
          .body {
            padding: 30px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            border-bottom: 1px solid #e5edf5;
            padding: 12px 0;
          }
          .actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
            margin-top: 28px;
          }
          .btn {
            display: block;
            text-decoration: none;
            text-align: center;
            border-radius: 10px;
            padding: 16px;
            font-weight: 800;
            border: 1px solid #b9cbe0;
            color: #0f172a;
            background: #f8fbff;
          }
          .btn.primary {
            background: #12476f;
            color: #fff;
            border-color: #12476f;
          }
          .muted {
            color: #5c6f86;
            font-size: 13px;
          }
          @media (max-width: 640px) {
            .wrap { margin: 0; padding: 14px; }
            .actions { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <div class="head">
              <h1>Pay Invoice Securely</h1>
              <div>Holy Trinity Finance & Membership Platform</div>
            </div>
            <div class="body">
              <div class="row">
                <span>Invoice</span>
                <strong>${h(invoiceNumber)}</strong>
              </div>
              <div class="row">
                <span>Recipient</span>
                <strong>${h(invoiceDisplayName(invoice))}</strong>
              </div>
              <div class="row">
                <span>Invoice Balance</span>
                <strong>${formatMoney(balance)}</strong>
              </div>

              <div class="actions">
                <a class="btn primary" href="${h(cardUrl)}">
                  Pay by Card<br />
                  <span class="muted" style="color:#dbeafe">
                    Fee ${formatMoney(cardFee)} - Total ${formatMoney(balance + cardFee)}
                  </span>
                </a>
                <a class="btn" href="${h(achUrl)}">
                  Pay by ACH<br />
                  <span class="muted">
                    Fee ${formatMoney(achFee)} - Total ${formatMoney(balance + achFee)}
                  </span>
                </a>
              </div>

              <p class="muted">
                Your payment is processed securely by Stripe. Processing fees are shown before checkout.
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function renderInvoiceHtml(req, invoice, items, token) {
  const invoiceNumber = invoice.invoice_number || invoice.invoice_no;
  const status = invoiceStatus(invoice) || "pending";
  const balance = invoiceBalance(invoice);
const checkoutPath = sameOriginCheckoutPath(invoiceNumber, token);
  const itemRows = items.length
    ? items
    : [
        {
          item_name: invoiceCategory(invoice),
          description: "Invoice payment",
          quantity: 1,
          total_price: invoiceTotal(invoice),
        },
      ];

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Invoice ${h(invoiceNumber)}</title>
        <style>
          body {
            margin: 0;
            background: #f3f7fb;
            color: #0f172a;
            font-family: Arial, sans-serif;
          }
          .wrap {
            max-width: 860px;
            margin: 28px auto;
            padding: 22px;
          }
          .card {
            background: #fff;
            border: 1px solid #cbd8e6;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 12px 28px rgba(15, 23, 42, .08);
          }
          .head {
            background: #12476f;
            color: #fff;
            padding: 26px 30px;
          }
          .body {
            padding: 30px;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin: 20px 0;
          }
          .box {
            border: 1px solid #d4e0ed;
            border-radius: 10px;
            padding: 14px;
            background: #f8fbff;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 18px;
          }
          th {
            background: #12476f;
            color: #fff;
            text-align: left;
            padding: 12px;
          }
          td {
            border-bottom: 1px solid #e5edf5;
            padding: 12px;
          }
          .pay {
            display: inline-block;
            margin-top: 24px;
            background: #12476f;
            color: #fff;
            text-decoration: none;
            padding: 14px 18px;
            border-radius: 10px;
            font-weight: 800;
          }
          .muted {
            color: #5c6f86;
          }
          @media (max-width: 700px) {
            .wrap { margin: 0; padding: 12px; }
            .grid { grid-template-columns: 1fr; }
            table { font-size: 13px; }
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <div class="head">
              <h1>Finance Invoice</h1>
              <div>Holy Trinity Finance & Membership Platform</div>
            </div>
            <div class="body">
              <p>Dear <strong>${h(invoiceDisplayName(invoice))}</strong>,</p>

              <div class="grid">
                <div class="box">
                  <div class="muted">Invoice #</div>
                  <strong>${h(invoiceNumber)}</strong>
                </div>
                <div class="box">
                  <div class="muted">Status</div>
                  <strong>${h(status.toUpperCase())}</strong>
                </div>
                <div class="box">
                  <div class="muted">Balance Due</div>
                  <strong>${formatMoney(balance)}</strong>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows
                    .map(
                      (item) => `
                        <tr>
                          <td>
                            <strong>${h(item.item_name || item.name || item.item_type || "--")}</strong>
                            <div class="muted">${h(item.description || "")}</div>
                          </td>
                          <td>${h(item.quantity || 1)}</td>
                          <td><strong>${formatMoney(item.total_price || item.amount || item.unit_price || 0)}</strong></td>
                        </tr>
                      `
                    )
                    .join("")}
                </tbody>
              </table>

              ${
                balance > 0
                  ? `<a class="pay" href="${h(checkoutPath)}">Pay Invoice Securely</a>`
                  : ""
              }

              <p class="muted">
                This secure invoice page is intended only for the recipient.
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

/* -------------------------------------------------------------------------- */
/* Stripe Checkout                                                            */
/* -------------------------------------------------------------------------- */

async function createCheckoutSession(req, invoice, method, token) {
  const stripe = stripeClient();

  if (!stripe) {
    const err = new Error("Stripe is not configured.");
    err.status = 503;
    throw err;
  }

  const invoiceNumber = invoice.invoice_number || invoice.invoice_no;
  const balance = invoiceBalance(invoice);

  if (balance <= 0) {
    const err = new Error("Invoice has no balance due.");
    err.status = 400;
    throw err;
  }

  const status = invoiceStatus(invoice);

  if (["paid", "cancelled", "void", "refunded"].includes(status)) {
    const err = new Error("Invoice is not payable.");
    err.status = 400;
    throw err;
  }

  const fee = processingFee(balance, method);
  const total = money(balance + fee);

  const publicViewUrl = absoluteUrl(
    req,
    `/api/public/invoices/${encodeURIComponent(invoiceNumber)}?token=${encodeURIComponent(token)}`
  );
const checkoutUrl = absoluteUrl(
  req,
  sameOriginCheckoutPath(invoiceNumber, token)
);
  const successUrl = absoluteUrl(
    req,
    `/api/public/invoices/${encodeURIComponent(invoiceNumber)}?token=${encodeURIComponent(token)}&payment=success&session_id={CHECKOUT_SESSION_ID}`
  );

  const cancelUrl = absoluteUrl(
    req,
    `/api/public/invoices/${encodeURIComponent(invoiceNumber)}/checkout?token=${encodeURIComponent(token)}&payment=cancelled`
  );

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types:
      method === "ach"
        ? ["us_bank_account"]
        : ["card"],

    payment_method_options:
      method === "ach"
        ? {
            us_bank_account: {
              verification_method: "automatic",
            },
          }
        : undefined,

    customer_email: invoiceEmail(invoice) || undefined,
    client_reference_id: String(invoice.id),

    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          product_data: {
            name: `Invoice ${invoiceNumber}`,
            description: `${invoiceCategory(invoice)} invoice payment`,
          },
          unit_amount: cents(balance),
        },
      },
      ...(fee > 0
        ? [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                product_data: {
                  name:
                    method === "ach"
                      ? "ACH Processing Fee"
                      : "Card Processing Fee",
                  description: "Standard online payment processing fee",
                },
                unit_amount: cents(fee),
              },
            },
          ]
        : []),
    ],

    metadata: {
      checkout_type: "public_invoice_payment",
      invoice_id: String(invoice.id),
      invoice_number: String(invoiceNumber),
      member_id: invoice.member_id ? String(invoice.member_id) : "",
      member_no: invoice.member_no || invoice.member_number || "",
      payer_name: invoiceDisplayName(invoice),
      payer_email: invoiceEmail(invoice),
      category: invoiceCategory(invoice),
      invoice_amount: String(balance),
      processing_fee: String(fee),
      total_amount: String(total),
      payment_method: method,
      source: "public_invoice_checkout",
    },

    payment_intent_data: {
      metadata: {
        checkout_type: "public_invoice_payment",
        invoice_id: String(invoice.id),
        invoice_number: String(invoiceNumber),
        category: invoiceCategory(invoice),
        invoice_amount: String(balance),
        processing_fee: String(fee),
        total_amount: String(total),
        payment_method: method,
      },
    },

    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    const err = new Error("Stripe did not return a checkout URL.");
    err.status = 502;
    throw err;
  }

  await updateExistingColumns(INVOICE_TABLE, invoice.id, {
    stripe_checkout_session_id: session.id,
    payment_link_url: checkoutUrl,
    public_invoice_url: publicViewUrl,
    metadata_json: {
      ...(safeJson(invoice.metadata_json, {}) || {}),
      last_public_checkout_session_id: session.id,
      last_public_checkout_method: method,
      last_public_checkout_fee: fee,
      last_public_checkout_total: total,
      last_public_checkout_url: session.url,
      updated_at: new Date().toISOString(),
    },
    updated_at: new Date(),
  });

  return session;
}

/* -------------------------------------------------------------------------- */
/* PDF                                                                        */
/* -------------------------------------------------------------------------- */

async function generateInvoicePdfBuffer(invoice) {
  let service = null;

  try {
    service = require("../services/domains/invoices/invoicePdfService");
  } catch {
    return null;
  }

  const candidates = [
    "generateInvoicePdfBuffer",
    "buildInvoicePdfBuffer",
    "renderInvoicePdfBuffer",
    "generateInvoicePdf",
    "buildInvoicePdf",
  ];

  for (const fn of candidates) {
    if (typeof service[fn] !== "function") continue;

    const result = await service[fn](invoice);

    if (Buffer.isBuffer(result)) {
      return result;
    }

    if (result?.buffer && Buffer.isBuffer(result.buffer)) {
      return result.buffer;
    }

    if (typeof result === "string" && fs.existsSync(result)) {
      return fs.readFileSync(result);
    }

    if (result?.path && fs.existsSync(result.path)) {
      return fs.readFileSync(result.path);
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "publicInvoices",
    version: "enterprise",
    token_formats: ["hmac_2_part", "jwt_3_part"],
    stripe_configured: Boolean(process.env.STRIPE_SECRET_KEY),
    public_base_url: normalizeBaseUrl(process.env.BACKEND_PUBLIC_URL) ||
      normalizeBaseUrl(process.env.APP_URL) ||
      normalizeBaseUrl(process.env.FRONTEND_URL) ||
      "",
    public_base_url_configured: Boolean(
      normalizeBaseUrl(process.env.BACKEND_PUBLIC_URL) ||
        normalizeBaseUrl(process.env.APP_URL) ||
        normalizeBaseUrl(process.env.FRONTEND_URL)
    ),
    timestamp: new Date().toISOString(),
  });
});

router.get("/:invoiceNumber/checkout", async (req, res) => {
  try {
    const invoiceNumber = clean(req.params.invoiceNumber);
    const { token } = verifyInvoiceToken(req, invoiceNumber, "pay");

    const invoice = await getInvoiceByNumber(invoiceNumber);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found.",
      });
    }

    const method = normalizeCheckoutMethod(req.query.method);

    if (!method) {
      return res
        .status(200)
        .type("html")
        .send(renderMethodChoicePage(req, invoice, token));
    }

    const session = await createCheckoutSession(req, invoice, method, token);

    return res.redirect(303, session.url);
  } catch (err) {
    console.error("public invoice checkout error:", err);

    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Unable to open secure invoice checkout.",
    });
  }
});

router.post("/:invoiceNumber/payment-link", async (req, res) => {
  try {
    const invoiceNumber = clean(req.params.invoiceNumber);
    const invoice = await getInvoiceByNumber(invoiceNumber);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found.",
      });
    }

    const urls = buildPublicInvoiceUrls(invoice, req);
    const method = normalizeCheckoutMethod(
      req.body?.method ||
        req.body?.payment_method ||
        req.body?.checkout_method ||
        req.query.method
    );

    const paymentUrl = method
      ? `${urls.checkout_url}${urls.checkout_url.includes("?") ? "&" : "?"}method=${encodeURIComponent(method)}`
      : urls.checkout_url;

    return res.json({
      ok: true,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number || invoice.invoice_no || invoiceNumber,
      amount: invoiceTotal(invoice),
      paid_amount: invoicePaid(invoice),
      balance_due: invoiceBalance(invoice),
      payment_link: paymentUrl,
      payment_url: paymentUrl,
      checkout_url: paymentUrl,
      public_checkout_url: paymentUrl,
      view_url: urls.view_url,
      pdf_url: urls.pdf_url,
      download_url: urls.download_url,
      links: {
        payment_link: paymentUrl,
        payment_url: paymentUrl,
        checkout_url: paymentUrl,
        public_checkout_url: paymentUrl,
        view_url: urls.view_url,
        pdf_url: urls.pdf_url,
        download_url: urls.download_url,
      },
    });
  } catch (err) {
    console.error("public invoice payment-link error:", err);

    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Unable to create public invoice payment link.",
    });
  }
});

router.post("/:invoiceNumber/checkout-link", async (req, res) => {
  req.url = `/${encodeURIComponent(req.params.invoiceNumber)}/payment-link`;
  return router.handle(req, res);
});

router.get("/:invoiceNumber/pdf", async (req, res) => {
  try {
    const invoiceNumber = clean(req.params.invoiceNumber);
    verifyInvoiceToken(req, invoiceNumber, "pdf");

    const invoice = await getInvoiceByNumber(invoiceNumber);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found.",
      });
    }

    const buffer = await generateInvoicePdfBuffer(invoice);

    if (!buffer) {
      return res.status(501).json({
        ok: false,
        error: "Invoice PDF generator is not available.",
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${invoiceNumber}.pdf"`
    );

    return res.send(buffer);
  } catch (err) {
    console.error("public invoice pdf error:", err);

    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Unable to render invoice PDF.",
    });
  }
});

router.get("/:invoiceNumber/download", async (req, res) => {
  try {
    const invoiceNumber = clean(req.params.invoiceNumber);
    verifyInvoiceToken(req, invoiceNumber, "download");

    const invoice = await getInvoiceByNumber(invoiceNumber);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found.",
      });
    }

    const buffer = await generateInvoicePdfBuffer(invoice);

    if (!buffer) {
      return res.status(501).json({
        ok: false,
        error: "Invoice PDF generator is not available.",
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${invoiceNumber}.pdf"`
    );

    return res.send(buffer);
  } catch (err) {
    console.error("public invoice download error:", err);

    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Unable to download invoice PDF.",
    });
  }
});

router.get("/:invoiceNumber", async (req, res) => {
  try {
    const invoiceNumber = clean(req.params.invoiceNumber);
    const { token } = verifyInvoiceToken(req, invoiceNumber, "view");

    const invoice = await getInvoiceByNumber(invoiceNumber);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found.",
      });
    }

    const items = await getInvoiceItems(invoice.id);
    const html = await renderInvoiceHtml(req, invoice, items, token);

    return res.status(200).type("html").send(html);
  } catch (err) {
    console.error("public invoice view error:", err);

    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Unable to open invoice.",
    });
  }
});

router.buildPublicInvoiceUrls = buildPublicInvoiceUrls;
router.createInvoiceToken = createInvoiceToken;

module.exports = router;
