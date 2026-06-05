

// backend/routes/memberPayments.js
"use strict";

const express = require("express");
const pool = require("../db");

const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.use(authRequired);

/* =========================================================
   HELPERS
========================================================= */

function toInt(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function clean(value) {
  return String(value ?? "").trim();
}

function getMemberId(req) {
  return Number(req.user?.member_id || req.user?.memberId || 0) || null;
}

function requireMember(req, res) {
  const memberId = getMemberId(req);

  if (!memberId) {
    res.status(403).json({
      error: "Your account is not linked to a member profile.",
    });
    return null;
  }

  return memberId;
}

/* =========================================================
   PAYMENTS
   Supports:
   GET /api/member/payments
   GET /api/member/my-payments
========================================================= */

async function listMemberPayments(req, res) {
  try {
    const memberId = requireMember(req, res);
    if (!memberId) return;

    const page = toInt(req.query.page, 1);
    const limit = Math.min(100, toInt(req.query.limit, 25));
    const offset = (page - 1) * limit;

    const search = clean(req.query.search);
    const category = clean(req.query.category || req.query.payment_type);
    const status = clean(req.query.status);
    const method = clean(req.query.method);

    const where = ["p.member_id = ?"];
    const params = [memberId];

    if (search) {
      where.push(`
        (
          p.payment_number LIKE ?
          OR p.reference_no LIKE ?
          OR p.sub_category LIKE ?
          OR p.description LIKE ?
          OR r.receipt_number LIKE ?
          OR i.invoice_number LIKE ?
        )
      `);

      const q = `%${search}%`;
      params.push(q, q, q, q, q, q);
    }

    if (category) {
      where.push("p.category = ?");
      params.push(category);
    }

    if (status) {
      where.push("p.status = ?");
      params.push(status);
    }

    if (method) {
      where.push("p.method = ?");
      params.push(method);
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;

    const [[countRow]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_finance_payments p
      LEFT JOIN tbl_finance_receipts r ON r.payment_id = p.id
      LEFT JOIN tbl_finance_invoices i ON i.payment_id = p.id
      ${whereSql}
      `,
      params
    );

    const [rows] = await pool.query(
      `
      SELECT
        p.id,
        p.payment_number,
        p.member_id,
        p.member_no,
        p.full_name_snapshot AS full_name,
        p.email_snapshot AS email,
        p.phone_snapshot AS phone,

        p.payment_type,
        p.category,
        p.sub_category,
        p.donation_category,
        p.description,

        p.amount,
        p.currency,
        p.quantity,

        p.plan_name,
        p.months_paid,
        p.coverage_year,
        p.coverage_start_month,
        p.coverage_end_month,
        p.coverage_months,
        p.coverage_label,
        p.coverage_start,
        p.coverage_end,

        p.method AS payment_method,
        p.method,
        p.provider AS payment_source,
        p.provider,
        p.status,
        p.reference_no,

        p.card_brand,
        p.card_last4,
        p.card_exp_month,
        p.card_exp_year,

        p.program_title,
        p.program_category,
        p.event_date,

        COALESCE(p.paid_at, p.created_at) AS payment_date,
        p.paid_at,
        p.created_at,

        r.id AS receipt_id,
        r.receipt_number,
        r.email_status,
        r.emailed_at,

        i.id AS invoice_id,
        i.invoice_number,
        i.balance_due,
        i.status AS invoice_status

      FROM tbl_finance_payments p
      LEFT JOIN tbl_finance_receipts r ON r.payment_id = p.id
      LEFT JOIN tbl_finance_invoices i ON i.payment_id = p.id
      ${whereSql}
      ORDER BY COALESCE(p.paid_at, p.created_at) DESC, p.id DESC
      LIMIT ?
      OFFSET ?
      `,
      [...params, limit, offset]
    );

    return res.json({
      ok: true,
      rows,
      pagination: {
        page,
        limit,
        total: Number(countRow.total || 0),
        pages: Math.ceil(Number(countRow.total || 0) / limit),
      },
    });
  } catch (err) {
    console.error("member payments error:", err);
    return res.status(500).json({
      error: "Failed to load payments.",
    });
  }

}

router.get("/payments", listMemberPayments);
router.get("/my-payments", listMemberPayments);

/* =========================================================
   PAYMENT DETAIL
========================================================= */

router.get("/payments/:id", async (req, res) => {
  try {
    const memberId = requireMember(req, res);
    if (!memberId) return;

    const [[payment]] = await pool.query(
      `
      SELECT
        p.*,
        r.receipt_number,
        r.email_status,
        r.emailed_at,
        i.invoice_number,
        i.balance_due,
        i.status AS invoice_status
      FROM tbl_finance_payments p
      LEFT JOIN tbl_finance_receipts r ON r.payment_id = p.id
      LEFT JOIN tbl_finance_invoices i ON i.payment_id = p.id
      WHERE p.id = ?
        AND p.member_id = ?
      LIMIT 1
      `,
      [req.params.id, memberId]
    );

    if (!payment) {
      return res.status(404).json({
        error: "Payment not found.",
      });
    }

    return res.json({
      ok: true,
      payment,
    });
  } catch (err) {
    console.error("member payment detail error:", err);
    return res.status(500).json({
      error: "Failed to load payment.",
    });
  }
});

/* =========================================================
   INVOICES
========================================================= */

router.get("/invoices", async (req, res) => {
  try {
    const memberId = requireMember(req, res);
    if (!memberId) return;

    const limit = Math.min(100, toInt(req.query.limit, 25));

    const [rows] = await pool.query(
      `
      SELECT
        i.*,
        p.payment_number,
        r.receipt_number
      FROM tbl_finance_invoices i
      LEFT JOIN tbl_finance_payments p ON p.id = i.payment_id
      LEFT JOIN tbl_finance_receipts r ON r.invoice_id = i.id
      WHERE i.member_id = ?
      ORDER BY COALESCE(i.invoice_date, i.created_at) DESC, i.id DESC
      LIMIT ?
      `,
      [memberId, limit]
    );

    return res.json({
      ok: true,
      rows,
    });
  } catch (err) {
    console.error("member invoices error:", err);
    return res.status(500).json({
      error: "Failed to load invoices.",
    });
  }
});

router.get("/my-invoices", async (req, res) => {
  req.url = "/invoices";
  return router.handle(req, res);
});

/* =========================================================
   RECEIPTS
========================================================= */

router.get("/receipts", async (req, res) => {
  try {
    const memberId = requireMember(req, res);
    if (!memberId) return;

    const limit = Math.min(100, toInt(req.query.limit, 25));

    const [rows] = await pool.query(
      `
      SELECT
        r.*,
        p.payment_number,
        p.category,
        p.sub_category,
        p.donation_category,
        p.method,
        p.provider,
        p.card_brand,
        p.card_last4,
        i.invoice_number
      FROM tbl_finance_receipts r
      LEFT JOIN tbl_finance_payments p ON p.id = r.payment_id
      LEFT JOIN tbl_finance_invoices i ON i.id = r.invoice_id
      WHERE r.member_id = ?
      ORDER BY COALESCE(r.issued_at, r.created_at) DESC, r.id DESC LIMIT ?
      `,
      [memberId, limit]
    );

    return res.json({
      ok: true,
      rows,
    });
  } catch (err) {
    console.error("member receipts error:", err);
    return res.status(500).json({
      error: "Failed to load receipts.",
    });
  }
});

router.get("/my-receipts", async (req, res) => {
  req.url = "/receipts";
  return router.handle(req, res);
});

/* =========================================================
   MEMBERSHIP COVERAGE
========================================================= */

router.get("/membership-coverage", async (req, res) => {
  try {

    const memberId =
      requireMember(req, res);

    if (!memberId) return;

    const year = Number(
      req.query.year ||
      new Date().getFullYear()
    );

    const [rows] = await pool.query(
      `
      SELECT
        payment_id,

        MAX(payment_number)
          AS payment_number,

        MAX(receipt_number)
          AS receipt_number,

        MAX(invoice_number)
          AS invoice_number,

        MIN(month_number)
          AS start_month,

        MAX(month_number)
          AS end_month,

        COUNT(*) AS months_paid,

        SUM(amount) AS amount,

        MAX(method) AS method,

        MAX(provider) AS provider,

        MAX(status) AS status

      FROM tbl_member_membership_coverage

      WHERE member_id = ?
        AND coverage_year = ?

      GROUP BY payment_id

      ORDER BY payment_id DESC
      `,
      [
        memberId,
        year,
      ]
    );

    const formatted = rows.map((row) => {

      const startDate =
        new Date(
          year,
          Number(
            row.start_month
          ) - 1,
          1
        );

      const endDate =
        new Date(
          year,
          Number(
            row.end_month
          ) - 1,
          1
        );

      const fmt = (d) =>
        d.toLocaleString(
          "en-US",
          {
            month: "long",
            year: "numeric",
          }
        );

      return {

        ...row,

        amount:
          Number(
            row.amount || 0
          ),

        months_paid:
          Number(
            row.months_paid || 0
          ),

        coverage_start_month:
          row.start_month,

        coverage_end_month:
          row.end_month,

        coverage_label:
          `${fmt(startDate)} - ${fmt(endDate)}`,
      };
    });

    return res.json({
      ok: true,
      year,
      rows: formatted,
    });

  } catch (err) {

    console.error(
      "member coverage error:",
      err
    );

    return res.status(500).json({
      error:
        "Failed to load coverage.",
    });
  }
});
router.get("/membership-grid/:year", async (req, res) => {

try {


const memberId =
  requireMember(req, res);

if (!memberId) return;

const year = Number(
  req.params.year ||
  new Date().getFullYear()
);

const [rows] = await pool.query(
  `
  SELECT

    month_number,
    month_name,
    coverage_month,
    coverage_year,

    MAX(payment_number)
      AS payment_number,

    MAX(receipt_number)
      AS receipt_number,

    MAX(method)
      AS method,

    MAX(amount)
      AS amount,

    'paid' AS status,

    1 AS paid

  FROM tbl_member_membership_coverage

  WHERE member_id = ?
    AND coverage_year = ?

  GROUP BY

    coverage_year,
    month_number,
    month_name,
    coverage_month

  ORDER BY month_number ASC
  `,
  [
    memberId,
    year,
  ]
);

const paidMap =
  new Map();

rows.forEach((row) => {

  paidMap.set(
    Number(row.month_number),
    row
  );
});

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const grid = months.map(
  (name, index) => {

    const monthNumber =
      index + 1;

    const row =
      paidMap.get(monthNumber);

    return {

      month_number:
        monthNumber,

      month_name:
        name,

      paid:
        Boolean(row),

      status:
        row?.status ||
        "unpaid",

      payment_number:
        row?.payment_number ||
        null,

      receipt_number:
        row?.receipt_number ||
        null,

      method:
        row?.method ||
        null,

      amount:
        Number(
          row?.amount || 0
        ),
    };
  }
);

return res.json({
  ok: true,
  year,
  grid,
});


} catch (err) {


console.error(
  "member coverage grid error:",
  err
);

return res.status(500).json({
  error:
    "Failed to load coverage grid.",
});


}
});

/* =========================================================
   LEDGER
========================================================= */

router.get("/ledger", async (req, res) => {
  try {
    const memberId = requireMember(req, res);
    if (!memberId) return;

    const [rows] = await pool.query(
      `
     SELECT
    id,
    member_id,
    payment_id,
    invoice_id,
    receipt_id,

    payment_number,
    invoice_number,
    receipt_number,

    record_date,
    description,

    debit_amount,
    credit_amount,

    running_balance,

    status,
    source,

    created_at

FROM tbl_finance_member_ledger

WHERE member_id = ?

ORDER BY
record_date DESC,
id DESC
      `,
      [memberId]
    );

    return res.json({
      ok: true,
      rows,
    });
  } catch (err) {
    console.error("member ledger error:", err);
    return res.status(500).json({
      error: "Failed to load ledger.",
    });
  }
});

/* =========================================================
   SUMMARY
========================================================= */

router.get("/summary", async (req, res) => {
  try {
    const memberId = requireMember(req, res);
    if (!memberId) return;

    const [[paymentSummary]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_payments,
        COALESCE(SUM(amount), 0) AS total_paid,
        COALESCE(SUM(CASE WHEN category = 'membership' THEN amount ELSE 0 END), 0) AS membership_paid,
        COALESCE(SUM(CASE WHEN category = 'donation' THEN amount ELSE 0 END), 0) AS donations_paid,
        COALESCE(SUM(CASE WHEN category IN ('school', 'trip') THEN amount ELSE 0 END), 0) AS program_paid,
        COALESCE(SUM(CASE WHEN category = 'pledge' THEN amount ELSE 0 END), 0) AS pledge_paid
      FROM tbl_finance_payments
      WHERE member_id = ?
      `,
      [memberId]
    );

    const [[invoiceSummary]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_invoices,
        COALESCE(SUM(CASE WHEN status <> 'paid' THEN 1 ELSE 0 END), 0) AS pending_invoices
      FROM tbl_finance_invoices
      WHERE member_id = ?
      `,
      [memberId]
    );

    const [[receiptSummary]] = await pool.query(
      `
      SELECT COUNT(*) AS total_receipts
      FROM tbl_finance_receipts
      WHERE member_id = ?
      `,
      [memberId]
    );

    return res.json({
      ok: true,
      summary: {
        ...paymentSummary,
        ...invoiceSummary,
        ...receiptSummary,
      },
    });
  } catch (err) {
    console.error("member summary error:", err);
    return res.status(500).json({
      error: "Failed to load summary.",
    });
  }
});

module.exports = router;