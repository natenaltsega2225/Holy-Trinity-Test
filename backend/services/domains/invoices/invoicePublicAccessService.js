// backend/services/domains/invoices/invoicePublicAccessService.js
"use strict";

const crypto = require("crypto");

const TOKEN_TYPE = "public_invoice_access";
const TOKEN_VERSION = 2;
const DEFAULT_TTL_DAYS = 30;
const MAX_TTL_DAYS = 365;

const DEFAULT_SCOPE = [
  "view",
  "pdf",
  "download",
  "pay",
  "email",
];

function clean(value, max = 255) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function tokenSecret() {
  const secret =
    process.env.PUBLIC_INVOICE_TOKEN_SECRET ||
    process.env.INVOICE_TOKEN_SECRET ||
    "";

  if (secret) return clean(secret, 4096);

  if (process.env.NODE_ENV !== "production") {
    return (
      process.env.JWT_SECRET ||
      process.env.ACCESS_TOKEN_SECRET ||
      "dev-public-invoice-secret-change-me"
    );
  }

  return "";
}

function assertTokenSecret() {
  const secret = tokenSecret();

  if (!secret) {
    throw new Error("PUBLIC_INVOICE_TOKEN_SECRET is required.");
  }

  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error("PUBLIC_INVOICE_TOKEN_SECRET must be at least 32 characters.");
  }

  return secret;
}

function normalizeBaseUrl(value) {
  return clean(value, 500).replace(/\/+$/, "");
}

function frontendBaseUrl() {
  return normalizeBaseUrl(
    process.env.FRONTEND_URL ||
      process.env.PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "http://localhost:5173"
  );
}

function apiBaseUrl() {
  return normalizeBaseUrl(
    process.env.API_PUBLIC_URL ||
      process.env.BACKEND_PUBLIC_URL ||
      process.env.BACKEND_URL ||
      process.env.API_URL ||
      ""
  );
}

function clampTtlDays(value) {
  return Math.max(
    1,
    Math.min(MAX_TTL_DAYS, Number(value || DEFAULT_TTL_DAYS))
  );
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function parseBase64urlJson(value) {
  return JSON.parse(Buffer.from(String(value || ""), "base64url").toString("utf8"));
}

function sign(encodedPayload) {
  return crypto
    .createHmac("sha256", assertTokenSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));

  if (left.length !== right.length) return false;

  return crypto.timingSafeEqual(left, right);
}

function normalizeScope(scope) {
  if (Array.isArray(scope)) {
    const values = scope.map((v) => clean(v, 40).toLowerCase()).filter(Boolean);
    return Array.from(new Set(values.length ? values : DEFAULT_SCOPE));
  }

  if (typeof scope === "string") {
    const values = scope
      .split(",")
      .map((v) => clean(v, 40).toLowerCase())
      .filter(Boolean);

    return Array.from(new Set(values.length ? values : DEFAULT_SCOPE));
  }

  return [...DEFAULT_SCOPE];
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

function invoiceIdentity(invoice = {}) {
  const id =
    Number(invoice.id || invoice.invoice_id || 0) > 0
      ? Number(invoice.id || invoice.invoice_id)
      : null;

  const invoiceNumber = clean(
    firstValue(invoice, ["invoice_number", "invoice_no", "number"]),
    140
  );

  if (!id && !invoiceNumber) {
    throw new Error("Invoice id or invoice number is required.");
  }

  return {
    invoice_id: id,
    invoice_number: invoiceNumber,
  };
}

function invoiceFingerprint(invoice = {}) {
  const identity = invoiceIdentity(invoice);

  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        invoice_id: identity.invoice_id,
        invoice_number: identity.invoice_number,
        amount: firstValue(invoice, ["total_amount", "amount", "invoice_amount"], ""),
        member_id: firstValue(invoice, ["member_id"], ""),
        email: clean(
          firstValue(invoice, [
            "email_snapshot",
            "recipient_email",
            "payer_email",
            "guest_email",
            "member_email",
            "email",
          ]),
          190
        ).toLowerCase(),
      })
    )
    .digest("base64url");
}

function createInvoiceAccessToken(invoice = {}, options = {}) {
  const identity = invoiceIdentity(invoice);
  const ttlDays = clampTtlDays(options.ttl_days || options.ttlDays);
  const issuedAt = nowSeconds();

  const payload = {
    typ: TOKEN_TYPE,
    ver: TOKEN_VERSION,
    aud: clean(options.audience || "invoice-public-link", 120),

    invoice_id: identity.invoice_id,
    invoice_number: identity.invoice_number,

    scope: normalizeScope(options.scope),
    fp: options.include_fingerprint === false ? undefined : invoiceFingerprint(invoice),

    iat: issuedAt,
    nbf: issuedAt - 30,
    exp: issuedAt + ttlDays * 24 * 60 * 60,
    nonce: crypto.randomBytes(16).toString("base64url"),
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === null || payload[key] === "") {
      delete payload[key];
    }
  });

  const encodedPayload = base64urlJson(payload);
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function verifyInvoiceAccessToken(token, options = {}) {
  const raw = clean(token, 4096);

  if (!raw || !raw.includes(".")) {
    return {
      ok: false,
      error: "Invalid invoice token.",
    };
  }

  const parts = raw.split(".");

  if (parts.length !== 2) {
    return {
      ok: false,
      error: "Invalid invoice token.",
    };
  }

  const [encodedPayload, signature] = parts;

  if (!encodedPayload || !signature) {
    return {
      ok: false,
      error: "Invalid invoice token.",
    };
  }

  const expectedSignature = sign(encodedPayload);

  if (!safeEqual(signature, expectedSignature)) {
    return {
      ok: false,
      error: "Invalid invoice token.",
    };
  }

  let payload = null;

  try {
    payload = parseBase64urlJson(encodedPayload);
  } catch {
    return {
      ok: false,
      error: "Invalid invoice token.",
    };
  }

  if (
    payload.typ !== TOKEN_TYPE ||
    ![1, TOKEN_VERSION].includes(Number(payload.ver))
  ) {
    return {
      ok: false,
      error: "Invalid invoice token.",
    };
  }

  if (
    options.audience &&
    clean(payload.aud, 120) !== clean(options.audience, 120)
  ) {
    return {
      ok: false,
      error: "Invalid invoice token audience.",
    };
  }

  if (payload.nbf && Number(payload.nbf) > nowSeconds()) {
    return {
      ok: false,
      error: "Invoice link is not active yet.",
      payload,
    };
  }

  if (payload.exp && Number(payload.exp) < nowSeconds()) {
    return {
      ok: false,
      expired: true,
      error: "Invoice link has expired.",
      payload,
    };
  }

  return {
    ok: true,
    payload,
  };
}

function tokenHasScope(payload = {}, requiredScope) {
  const scope = normalizeScope(payload.scope);

  if (!requiredScope) return true;

  const required = clean(requiredScope, 40).toLowerCase();

  return scope.includes(required) || scope.includes("*");
}

function assertInvoiceToken(token, invoice = {}, options = {}) {
  const verified = verifyInvoiceAccessToken(token, options);

  if (!verified.ok) return verified;

  const payload = verified.payload;
  const identity = invoiceIdentity(invoice);

  if (
    payload.invoice_id &&
    identity.invoice_id &&
    Number(payload.invoice_id) !== Number(identity.invoice_id)
  ) {
    return {
      ok: false,
      error: "Invoice token does not match this invoice.",
      payload,
    };
  }

  if (
    payload.invoice_number &&
    identity.invoice_number &&
    clean(payload.invoice_number).toLowerCase() !==
      clean(identity.invoice_number).toLowerCase()
  ) {
    return {
      ok: false,
      error: "Invoice token does not match this invoice.",
      payload,
    };
  }

  if (
    options.check_fingerprint !== false &&
    payload.fp &&
    payload.fp !== invoiceFingerprint(invoice)
  ) {
    return {
      ok: false,
      error: "Invoice token fingerprint does not match this invoice.",
      payload,
    };
  }

  if (
    options.required_scope &&
    !tokenHasScope(payload, options.required_scope)
  ) {
    return {
      ok: false,
      error: "Invoice token does not allow this action.",
      payload,
    };
  }

  return {
    ok: true,
    payload,
  };
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const output = query.toString();
  return output ? `?${output}` : "";
}

function invoiceNumberPath(invoice = {}) {
  const identity = invoiceIdentity(invoice);

  return encodeURIComponent(
    identity.invoice_number || String(identity.invoice_id)
  );
}

function joinUrl(prefix, path) {
  const cleanPrefix = normalizeBaseUrl(prefix);
  return cleanPrefix ? `${cleanPrefix}${path}` : path;
}

function buildFrontendInvoiceUrl(invoice = {}, token, options = {}) {
  const path =
    options.frontend_path ||
    options.frontendPath ||
    `/pay/invoice/${invoiceNumberPath(invoice)}`;

  return `${frontendBaseUrl()}${path}${buildQuery({
    token,
    source: options.source,
  })}`;
}

function buildPublicApiInvoiceUrl(invoice = {}, token, options = {}) {
  const path = `/api/public/invoices/${invoiceNumberPath(invoice)}`;

  return joinUrl(
    apiBaseUrl(),
    `${path}${buildQuery({
      token,
      source: options.source,
    })}`
  );
}

function buildPublicPdfUrl(invoice = {}, token, options = {}) {
  const path = `/api/public/invoices/${invoiceNumberPath(invoice)}/pdf`;

  return joinUrl(
    apiBaseUrl(),
    `${path}${buildQuery({
      token,
      source: options.source,
    })}`
  );
}

function buildPublicDownloadUrl(invoice = {}, token, options = {}) {
  const path = `/api/public/invoices/${invoiceNumberPath(invoice)}/download`;

  return joinUrl(
    apiBaseUrl(),
    `${path}${buildQuery({
      token,
      source: options.source,
    })}`
  );
}

function buildPublicPayUrl(invoice = {}, token, options = {}) {
  const path = `/api/public/invoices/${invoiceNumberPath(invoice)}/checkout`;

  return joinUrl(
    apiBaseUrl(),
    `${path}${buildQuery({
      token,
      source: options.source,
    })}`
  );
}

function buildPublicCheckoutUrl(invoice = {}, token, options = {}) {
  return {
    url: buildPublicPayUrl(invoice, token, options),
    token,
    method: "POST",
  };
}

function buildInvoicePublicLinks(invoice = {}, options = {}) {
  const ttlDays = clampTtlDays(options.ttl_days || options.ttlDays);

  const token =
    options.token ||
    createInvoiceAccessToken(invoice, {
      ttl_days: ttlDays,
      scope: options.scope,
      audience: options.audience,
      include_fingerprint: options.include_fingerprint,
    });

  const viewUrl = buildFrontendInvoiceUrl(invoice, token, options);
  const apiUrl = buildPublicApiInvoiceUrl(invoice, token, options);
  const pdfUrl = buildPublicPdfUrl(invoice, token, options);
  const downloadUrl = buildPublicDownloadUrl(invoice, token, options);
  const payUrl = buildPublicPayUrl(invoice, token, options);

  return {
    token,
    expires_in_days: ttlDays,
    scope: normalizeScope(options.scope),

    view_url: viewUrl,
    frontend_url: viewUrl,
    api_url: apiUrl,
    pdf_url: pdfUrl,
    download_url: downloadUrl,
    pay_url: payUrl,
    payment_url: payUrl,

    checkout: buildPublicCheckoutUrl(invoice, token, options),
  };
}

module.exports = {
  TOKEN_TYPE,
  TOKEN_VERSION,
  DEFAULT_TTL_DAYS,
  MAX_TTL_DAYS,
  DEFAULT_SCOPE,

  tokenSecret,
  assertTokenSecret,

  frontendBaseUrl,
  apiBaseUrl,

  normalizeScope,
  invoiceIdentity,
  invoiceFingerprint,

  createInvoiceAccessToken,
  verifyInvoiceAccessToken,
  assertInvoiceToken,
  tokenHasScope,

  buildFrontendInvoiceUrl,
  buildPublicApiInvoiceUrl,
  buildPublicPdfUrl,
  buildPublicDownloadUrl,
  buildPublicPayUrl,
  buildPublicCheckoutUrl,
  buildInvoicePublicLinks,
};