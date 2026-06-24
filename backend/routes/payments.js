// backend/routes/payments.js
"use strict";

const express = require("express");
const db = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const paymentService = require("../services/paymentService");

const router = express.Router();

const FINANCE_ROLES = [
  "finance",
  "admin",
  "super_admin",
  "reconciliation",
];

const MANUAL_METHODS = new Set(["cash", "check", "zelle"]);

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function actorId(req) {
  return (
    req.user?.id ||
    req.user?.user_id ||
    req.auth?.id ||
    req.auth?.user_id ||
    null
  );
}

function actorRole(req) {
  return clean(req.user?.role || req.auth?.role || "", 80).toLowerCase();
}

function isFinance(req) {
  return FINANCE_ROLES.includes(actorRole(req));
}

function getMemberId(req) {
  return (
    Number(
      req.user?.member_id ||
        req.user?.memberId ||
        req.auth?.member_id ||
        req.auth?.memberId ||
        0
    ) || null
  );
}

function requestMeta(req) {
  const forwarded = req.headers["x-forwarded-for"];

  return {
    ip_address:
      (Array.isArray(forwarded) ? forwarded[0] : forwarded)
        ?.split(",")[0]
        ?.trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      null,

    user_agent: clean(req.headers["user-agent"], 500) || null,
    request_id: req.id || req.requestId || req.headers["x-request-id"] || null,
  };
}

function normalizeCategory(value) {
  const raw = clean(value, 80).toLowerCase();

  if (["membership", "membership_dues", "dues", "member_dues"].includes(raw)) {
    return "membership";
  }

  if (["donation", "giving", "tithe", "offering"].includes(raw)) {
    return "donation";
  }

  if (["school", "school_program", "kids_school", "kids"].includes(raw)) {
    return "school";
  }

  if (["trip", "travel", "event_trip"].includes(raw)) {
    return "trip";
  }

  if (["pledge", "campaign_pledge", "fundraising"].includes(raw)) {
    return "pledge";
  }

  return raw || "";
}

function normalizeMethod(value) {
  const raw = clean(value, 80).toLowerCase();

  if (["card", "stripe", "stripe_card", "credit_card", "debit_card"].includes(raw)) {
    return "card";
  }

  if (["ach", "stripe_ach", "bank", "bank_account", "us_bank_account"].includes(raw)) {
    return "ach";
  }

  if (raw === "cash") return "cash";
  if (["check", "cheque"].includes(raw)) return "check";
  if (raw === "zelle") return "zelle";

  return raw || "";
}

function normalizeStatus(value) {
  const raw = clean(value, 80).toLowerCase();

  if (
    [
      "pending",
      "paid",
      "completed",
      "approved",
      "failed",
      "cancelled",
      "refunded",
      "partially_refunded",
      "reversed",
      "void",
    ].includes(raw)
  ) {
    return raw;
  }

  return raw || "";
}

function normalizeReference(body = {}) {
  return (
    clean(
      body.reference_no ||
        body.reference_number ||
        body.transaction_reference ||
        body.check_number ||
        body.check_no ||
        body.zelle_reference ||
        body.zelle_confirmation,
      255
    ) || null
  );
}

function requirePaymentFunction(name) {
  const fn = paymentService[name];

  if (typeof fn !== "function") {
    const err = new Error(`Payment service function ${name} is not available.`);
    err.statusCode = 501;
    throw err;
  }

  return fn;
}

function paymentIdParam(req) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error("Valid payment id is required.");
    err.statusCode = 400;
    throw err;
  }

  return id;
}

function buildListFilters(req, overrides = {}) {
  const finance = isFinance(req);
  const memberId = getMemberId(req);

  if (!finance && !memberId) {
    const err = new Error("Member account not linked.");
    err.statusCode = 403;
    throw err;
  }

  return {
    member_id: finance
      ? req.query.member_id || overrides.member_id || null
      : memberId,

    payer_type: clean(req.query.payer_type, 40) || null,

    payment_type:
      normalizeCategory(req.query.payment_type) ||
      normalizeCategory(req.query.category) ||
      null,

    category:
      normalizeCategory(req.query.category) ||
      normalizeCategory(req.query.payment_type) ||
      null,

    sub_category: clean(req.query.sub_category, 120) || null,
    donation_category: clean(req.query.donation_category, 120) || null,

    method: normalizeMethod(req.query.method || req.query.payment_method) || null,
    payment_method: normalizeMethod(req.query.payment_method || req.query.method) || null,
    provider: clean(req.query.provider, 80).toLowerCase() || null,

    status: normalizeStatus(req.query.status) || null,
    reconciliation_status: clean(req.query.reconciliation_status, 80).toLowerCase() || null,

    coverage_year: req.query.coverage_year || null,
    coverage_month: req.query.coverage_month || null,
    plan_name: clean(req.query.plan_name, 180) || null,

    campaign_id: req.query.campaign_id || null,
    pledge_id: req.query.pledge_id || null,
    program_id: req.query.program_id || null,
    program_name: clean(req.query.program_name, 180) || null,

    invoice_id: req.query.invoice_id || null,
    receipt_id: req.query.receipt_id || null,
    invoice_number: clean(req.query.invoice_number, 120) || null,
    receipt_number: clean(req.query.receipt_number, 120) || null,
    payment_number: clean(req.query.payment_number, 120) || null,
    reference_no: clean(req.query.reference_no || req.query.reference, 255) || null,

    search: clean(req.query.search || req.query.q, 255) || null,

    date_from: clean(req.query.date_from || req.query.from, 40) || null,
    date_to: clean(req.query.date_to || req.query.to, 40) || null,

    amount_min: req.query.amount_min || req.query.min_amount || null,
    amount_max: req.query.amount_max || req.query.max_amount || null,

    page: req.query.page || 1,
    limit: req.query.limit || 50,

    ...overrides,
  };
}

function unpackListResult(result) {
  if (Array.isArray(result)) {
    return {
      rows: result,
      pagination: null,
      summary: null,
    };
  }

  return {
    rows: result?.rows || [],
    pagination: result?.pagination || null,
    summary: result?.summary || null,
  };
}

async function validatePaymentAccess(req, payment) {
  if (!payment) return false;
  if (isFinance(req)) return true;

  const memberId = getMemberId(req);

  if (!memberId) return false;

  return Number(payment.member_id) === Number(memberId);
}

async function getPaymentByNumber(paymentNumber) {
  if (typeof paymentService.getPaymentByNumber === "function") {
    return paymentService.getPaymentByNumber(paymentNumber);
  }

  const [rows] = await db.query(
    `
    SELECT
      p.*,
      i.invoice_number,
      r.receipt_number
    FROM tbl_finance_payments p
    LEFT JOIN tbl_finance_invoices i
      ON i.id = p.invoice_id
    LEFT JOIN tbl_finance_receipts r
      ON r.payment_id = p.id
    WHERE p.payment_number = ?
    LIMIT 1
    `,
    [paymentNumber]
  );

  return rows[0] || null;
}

function validateManualPayload(payload = {}) {
  const method = normalizeMethod(payload.payment_method || payload.method);

  if (!MANUAL_METHODS.has(method)) return;

  const reference = normalizeReference(payload);

  if (method === "check" && !reference) {
    const err = new Error("Check number or reference number is required.");
    err.statusCode = 400;
    throw err;
  }

  if (method === "zelle" && !reference) {
    const err = new Error("Zelle reference number is required.");
    err.statusCode = 400;
    throw err;
  }
}

function buildCreatePayload(req) {
  const body = req.body || {};
  const method = normalizeMethod(body.payment_method || body.method);

  const category =
    normalizeCategory(body.category) ||
    normalizeCategory(body.payment_type);

  const reference = normalizeReference(body);

  const amount = numberValue(
    body.amount ||
      body.payment_amount ||
      body.total_amount,
    0
  );

  if (amount <= 0) {
    const err = new Error("Payment amount must be greater than zero.");
    err.statusCode = 400;
    throw err;
  }

  const payload = {
    ...body,

    amount,
    total_amount: numberValue(body.total_amount, amount),
    payment_amount: numberValue(body.payment_amount, amount),

    category,
    payment_type:
      normalizeCategory(body.payment_type) ||
      category,

    sub_category: clean(body.sub_category, 120) || null,
    donation_category: clean(body.donation_category, 120) || null,

    payment_method: method,
    method,
    provider:
      clean(body.provider, 80).toLowerCase() ||
      (MANUAL_METHODS.has(method) ? "manual" : null),

    reference_no: reference,
    reference_number: reference,
    transaction_reference:
      clean(body.transaction_reference, 255) || reference,

    check_number:
      clean(body.check_number || body.check_no, 120) ||
      (method === "check" ? reference : null),

    zelle_reference:
      clean(body.zelle_reference || body.zelle_confirmation, 255) ||
      (method === "zelle" ? reference : null),

    full_name:
      clean(body.full_name || body.payer_name || body.donor_name, 255) || null,
    email:
      clean(body.email || body.payer_email || body.donor_email, 190)
        .toLowerCase()
        .replace(/\s+/g, "") || null,
    phone: clean(body.phone || body.payer_phone || body.donor_phone, 80) || null,

    member_id: body.member_id || null,
    member_no: clean(body.member_no, 80) || null,
    payer_type:
      clean(body.payer_type || (body.member_id ? "member" : "guest"), 40) || null,

    manual_entry: MANUAL_METHODS.has(method) ? 1 : body.manual_entry,
    is_manual_entry: MANUAL_METHODS.has(method) ? 1 : body.is_manual_entry,

    recorded_by: actorId(req),
    created_by: actorId(req),
    updated_by: actorId(req),

    ...requestMeta(req),
  };

  validateManualPayload(payload);

  return payload;
}

function csvEscape(value) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function toCsv(rows = []) {
  const headers = [
    "date",
    "payment_number",
    "member_no",
    "payer",
    "email",
    "category",
    "amount",
    "method",
    "provider",
    "status",
    "reference",
    "invoice_number",
    "receipt_number",
  ];

  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.payment_date || row.created_at || "",
        row.payment_number || "",
        row.member_no || "",
        row.full_name_snapshot || row.full_name || row.payer_name || "",
        row.email_snapshot || row.email || "",
        row.category || row.payment_type || "",
        row.amount || row.payment_amount || row.total_amount || 0,
        row.payment_method || row.method || "",
        row.provider || row.payment_provider || "",
        row.status || row.payment_status || "",
        row.reference_no ||
          row.reference_number ||
          row.transaction_reference ||
          row.check_number ||
          row.zelle_reference ||
          "",
        row.invoice_number || "",
        row.receipt_number || "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  return lines.join("\n");
}

function sendError(res, err, label) {
  const status =
    err?.statusCode ||
    err?.status ||
    (/not found/i.test(err?.message || "")
      ? 404
      : /access denied|not linked|forbidden/i.test(err?.message || "")
        ? 403
        : /required|invalid|must|cannot|already|duplicate/i.test(err?.message || "")
          ? 400
          : 500);

  if (status >= 500) {
    console.error(`${label} error:`, err);
  } else {
    console.warn(`${label} warning:`, err?.message || err);
  }

  return res.status(status).json({
    ok: false,
    error:
      status >= 500 && process.env.NODE_ENV === "production"
        ? "Payment request failed."
        : err?.message || "Payment request failed.",
  });
}

/* -------------------------------------------------------------------------- */
/* Public Health                                                              */
/* -------------------------------------------------------------------------- */

router.get("/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "payments",
    version: "enterprise",
    protected: true,
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* Security                                                                   */
/* -------------------------------------------------------------------------- */

router.use(authRequired);

/* -------------------------------------------------------------------------- */
/* Stats                                                                      */
/* -------------------------------------------------------------------------- */

router.get(
  "/stats/overview",
  requireRole("finance", "admin", "super_admin", "reconciliation"),
  async (req, res) => {
    try {
      const getPaymentStats = requirePaymentFunction("getPaymentStats");

      const stats = await getPaymentStats({
        date_from: req.query.date_from || req.query.from || null,
        date_to: req.query.date_to || req.query.to || null,
        category: normalizeCategory(req.query.category) || null,
        method: normalizeMethod(req.query.method || req.query.payment_method) || null,
        status: normalizeStatus(req.query.status) || null,
      });

      return res.json({
        ok: true,
        stats,
      });
    } catch (err) {
      return sendError(res, err, "payment stats");
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

router.get(
  "/export/csv",
  requireRole("finance", "admin", "super_admin", "reconciliation"),
  async (req, res) => {
    try {
      const listPayments = requirePaymentFunction("listPayments");

      const result = await listPayments(
        buildListFilters(req, {
          page: 1,
          limit: Math.min(Number(req.query.limit || 5000), 10000),
        })
      );

      const { rows } = unpackListResult(result);
      const csv = toCsv(rows);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="finance-payments-${Date.now()}.csv"`
      );

      return res.send(csv);
    } catch (err) {
      return sendError(res, err, "payments export");
    }
  }
);

/* -------------------------------------------------------------------------- */
/* List Payments                                                              */
/* -------------------------------------------------------------------------- */

router.get("/", async (req, res) => {
  try {
    const listPayments = requirePaymentFunction("listPayments");
    const result = await listPayments(buildListFilters(req));
    const payload = unpackListResult(result);

    return res.json({
      ok: true,
      ...payload,
    });
  } catch (err) {
    return sendError(res, err, "list payments");
  }
});

/* -------------------------------------------------------------------------- */
/* My Payments                                                                */
/* -------------------------------------------------------------------------- */

async function listMyPayments(req, res) {
  try {
    const memberId = getMemberId(req);

    if (!memberId) {
      return res.status(403).json({
        ok: false,
        error: "Member account not linked.",
      });
    }

    const listPayments = requirePaymentFunction("listPayments");

    const result = await listPayments(
      buildListFilters(req, {
        member_id: memberId,
      })
    );

    const payload = unpackListResult(result);

    return res.json({
      ok: true,
      ...payload,
    });
  } catch (err) {
    return sendError(res, err, "member payments");
  }
}

router.get("/me", listMyPayments);
router.get("/member/me", listMyPayments);

/* -------------------------------------------------------------------------- */
/* Lookup                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/number/:paymentNumber", async (req, res) => {
  try {
    const paymentNumber = clean(req.params.paymentNumber, 120);

    if (!paymentNumber) {
      return res.status(400).json({
        ok: false,
        error: "Payment number is required.",
      });
    }

    const payment = await getPaymentByNumber(paymentNumber);

    if (!payment) {
      return res.status(404).json({
        ok: false,
        error: "Payment not found.",
      });
    }

    const allowed = await validatePaymentAccess(req, payment);

    if (!allowed) {
      return res.status(403).json({
        ok: false,
        error: "Access denied.",
      });
    }

    return res.json({
      ok: true,
      payment,
    });
  } catch (err) {
    return sendError(res, err, "get payment by number");
  }
});

router.get("/:id", async (req, res) => {
  try {
    const getPaymentById = requirePaymentFunction("getPaymentById");
    const payment = await getPaymentById(paymentIdParam(req));

    if (!payment) {
      return res.status(404).json({
        ok: false,
        error: "Payment not found.",
      });
    }

    const allowed = await validatePaymentAccess(req, payment);

    if (!allowed) {
      return res.status(403).json({
        ok: false,
        error: "Access denied.",
      });
    }

    return res.json({
      ok: true,
      payment,
    });
  } catch (err) {
    return sendError(res, err, "get payment");
  }
});

/* -------------------------------------------------------------------------- */
/* Create Manual / Staff Payment                                              */
/* -------------------------------------------------------------------------- */

router.post(
  "/",
  requireRole("finance", "admin", "super_admin"),
  async (req, res) => {
    try {
      const createPayment = requirePaymentFunction("createPayment");
      const payload = buildCreatePayload(req);

      const payment = await createPayment(payload);

      return res.status(201).json({
        ok: true,
        payment,
      });
    } catch (err) {
      return sendError(res, err, "create payment");
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Refund                                                                     */
/* -------------------------------------------------------------------------- */

router.post(
  "/:id/refund",
  requireRole("finance", "admin", "super_admin"),
  async (req, res) => {
    try {
      const refundPayment = requirePaymentFunction("refundPayment");

      const result = await refundPayment({
        payment_id: paymentIdParam(req),
        amount: req.body?.amount,
        reason: clean(req.body?.reason, 1000),
        refunded_by: actorId(req),
        ...requestMeta(req),
      });

      return res.json({
        ok: true,
        result,
      });
    } catch (err) {
      return sendError(res, err, "refund payment");
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Reverse / Void                                                             */
/* -------------------------------------------------------------------------- */

async function reversePaymentHandler(req, res) {
  try {
    const reversePayment = requirePaymentFunction("reversePayment");

    const reason = clean(req.body?.reason, 1000);

    if (!reason) {
      return res.status(400).json({
        ok: false,
        error: "Reason is required.",
      });
    }

    const result = await reversePayment({
      payment_id: paymentIdParam(req),
      reason,
      reversed_by: actorId(req),
      voided_by: actorId(req),
      ...requestMeta(req),
    });

    return res.json({
      ok: true,
      result,
    });
  } catch (err) {
    return sendError(res, err, "reverse payment");
  }
}

router.post(
  "/:id/reverse",
  requireRole("finance", "admin", "super_admin"),
  reversePaymentHandler
);

router.post(
  "/:id/void",
  requireRole("finance", "admin", "super_admin"),
  reversePaymentHandler
);

/* -------------------------------------------------------------------------- */
/* Reconciliation                                                             */
/* -------------------------------------------------------------------------- */

router.post(
  "/:id/reconcile",
  requireRole("finance", "admin", "super_admin", "reconciliation"),
  async (req, res) => {
    try {
      const reconcilePayment = requirePaymentFunction("reconcilePayment");

      const result = await reconcilePayment({
        payment_id: paymentIdParam(req),
        reconciliation_batch:
          clean(req.body?.reconciliation_batch || req.body?.batch_no, 120) ||
          null,
        reconciliation_id: req.body?.reconciliation_id || null,
        notes: clean(req.body?.notes, 1000) || null,
        reconciled_by: actorId(req),
        ...requestMeta(req),
      });

      return res.json({
        ok: true,
        result,
      });
    } catch (err) {
      return sendError(res, err, "reconcile payment");
    }
  }
);

router.post(
  "/:id/unreconcile",
  requireRole("finance", "admin", "super_admin", "reconciliation"),
  async (req, res) => {
    try {
      const unreconcilePayment = requirePaymentFunction("unreconcilePayment");

      const result = await unreconcilePayment({
        payment_id: paymentIdParam(req),
        reason: clean(req.body?.reason, 1000) || null,
        unreconciled_by: actorId(req),
        ...requestMeta(req),
      });

      return res.json({
        ok: true,
        result,
      });
    } catch (err) {
      return sendError(res, err, "unreconcile payment");
    }
  }
);

module.exports = router;