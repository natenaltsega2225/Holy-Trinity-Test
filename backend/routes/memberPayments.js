// backend/routes/memberPayments.js
"use strict";

const express = require("express");
const pool = require("../db");

const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.use(authRequired);

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function toInt(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function getMemberId(req) {
  return (
    Number(req.user?.member_id || 0) ||
    Number(req.user?.memberId || 0) ||
    null
  );
}

function getMemberNo(req) {
  return clean(
    req.user?.member_no ||
      req.user?.memberNo ||
      "",
    80
  );
}

function requireMember(req, res) {
  const memberId = getMemberId(req);

  if (!memberId) {
    res.status(403).json({
      ok: false,
      error: "Your account is not linked to a member profile.",
    });

    return null;
  }

  return memberId;
}

function normalizeCategory(value) {
  const raw = clean(value, 80).toLowerCase();

  if (["dues", "membership_dues"].includes(raw)) return "membership";
  if (["giving", "tithe"].includes(raw)) return "donation";
  if (["kids", "kids_school", "school_program"].includes(raw)) return "school";
  if (raw === "travel") return "trip";

  return raw;
}

function normalizeStatus(value) {
  return clean(value, 80).toLowerCase();
}

function paymentBaseJoinSql() {
  return `
    FROM tbl_finance_payments p

    LEFT JOIN (
      SELECT payment_id, MAX(id) AS receipt_id
      FROM tbl_finance_receipts
      GROUP BY payment_id
    ) latest_r
      ON latest_r.payment_id = p.id

    LEFT JOIN tbl_finance_receipts r
      ON r.id = COALESCE(p.receipt_id, latest_r.receipt_id)

    LEFT JOIN (
      SELECT payment_id, MAX(id) AS invoice_id
      FROM tbl_finance_invoices
      GROUP BY payment_id
    ) latest_i
      ON latest_i.payment_id = p.id

    LEFT JOIN tbl_finance_invoices i
      ON i.id = COALESCE(p.invoice_id, latest_i.invoice_id)
  `;
}

function buildPaymentFilters(req, memberId) {
  const search = clean(req.query.search || req.query.q, 160);
  const category = normalizeCategory(req.query.category || req.query.payment_type);
  const status = normalizeStatus(req.query.status);
  const method = clean(req.query.method || req.query.payment_method, 80).toLowerCase();
  const dateFrom = clean(req.query.date_from || req.query.from, 40);
  const dateTo = clean(req.query.date_to || req.query.to, 40);

  const where = ["p.member_id = ?"];
  const params = [memberId];

  if (search) {
    where.push(`
      (
        p.payment_number LIKE ?
        OR p.reference_no LIKE ?
        OR p.reference_number LIKE ?
        OR p.transaction_reference LIKE ?
        OR p.sub_category LIKE ?
        OR p.description LIKE ?
        OR r.receipt_number LIKE ?
        OR i.invoice_number LIKE ?
      )
    `);

    const q = `%${search}%`;
    params.push(q, q, q, q, q, q, q, q);
  }

  if (category) {
    where.push("(p.category = ? OR p.payment_type = ?)");
    params.push(category, category);
  }

  if (status) {
    where.push("(p.status = ? OR p.payment_status = ?)");
    params.push(status, status);
  }

  if (method) {
    where.push("(p.method = ? OR p.payment_method = ?)");
    params.push(method, method);
  }

  if (dateFrom) {
    where.push("DATE(COALESCE(p.paid_at, p.created_at)) >= ?");
    params.push(dateFrom);
  }

  if (dateTo) {
    where.push("DATE(COALESCE(p.paid_at, p.created_at)) <= ?");
    params.push(dateTo);
  }

  return {
    whereSql: `WHERE ${where.join(" AND ")}`,
    params,
  };
}

function monthName(month) {
  return [
    "",
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
  ][Number(month)] || String(month);
}

function formatCoverageLabel(year, startMonth, endMonth) {
  if (!year || !startMonth || !endMonth) return "";

  return `${monthName(startMonth)} ${year} - ${monthName(endMonth)} ${year}`;
}

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/finance-health", (_req, res) => {
  return res.json({
    ok: true,
    module: "memberPayments",
    version: "enterprise",
    mounted_at: "/api/member",
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* Payments                                                                   */
/* -------------------------------------------------------------------------- */

async function listMemberPayments(req, res) {
  try {
    const memberId = requireMember(req, res);
    if (!memberId) return;

    const page = toInt(req.query.page, 1);
    const limit = Math.min(100, toInt(req.query.limit, 25));
    const offset = (page - 1) * limit;

    const { whereSql, params } = buildPaymentFilters(req, memberId);

    const [[countRow]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      ${paymentBaseJoinSql()}
      ${whereSql}
      `,
      params
    );

    const [[summary]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_payments,
        COALESCE(SUM(p.amount), 0) AS total_paid,
        COALESCE(SUM(CASE WHEN p.category = 'membership' OR p.payment_type = 'membership' THEN p.amount ELSE 0 END), 0) AS membership_paid,
        COALESCE(SUM(CASE WHEN p.category = 'donation' OR p.payment_type = 'donation' THEN p.amount ELSE 0 END), 0) AS donation_paid,
        COALESCE(SUM(CASE WHEN p.category IN ('school', 'trip') OR p.payment_type IN ('school', 'trip') THEN p.amount ELSE 0 END), 0) AS program_paid,
        COALESCE(SUM(CASE WHEN p.category = 'pledge' OR p.payment_type = 'pledge' THEN p.amount ELSE 0 END), 0) AS pledge_paid
      ${paymentBaseJoinSql()}
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
        p.coverage_months_json,
        p.coverage_label,
        p.coverage_start,
        p.coverage_end,

        p.method AS payment_method,
        p.method,
        p.provider AS payment_source,
        p.provider,
        p.status,
        p.payment_status,
        p.reference_no,
        p.transaction_reference,

        p.card_brand,
        p.card_last4,
        p.card_exp_month,
        p.card_exp_year,

        p.bank_last4,
        p.bank_name,
        p.bank_account_type,

        p.pledge_id,
        p.pledge_number,
        p.campaign_id,
        p.campaign_name,

        p.registration_id,
        p.news_event_id,
        p.program_name,
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

      ${paymentBaseJoinSql()}
      ${whereSql}

      ORDER BY
        COALESCE(p.paid_at, p.created_at) DESC,
        p.id DESC

      LIMIT ?
      OFFSET ?
      `,
      [...params, limit, offset]
    );

    const total = Number(countRow.total || 0);

    return res.json({
      ok: true,
      rows,
      summary,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.error("member payments error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to load payments.",
    });
  }
}

router.get("/payments", listMemberPayments);
router.get("/my-payments", listMemberPayments);

router.get("/payments/:id", async (req, res) => {
  try {
    const memberId = requireMember(req, res);
    if (!memberId) return;

    const [[payment]] = await pool.query(
      `
      SELECT
        p.*,
        r.id AS receipt_id,
        r.receipt_number,
        r.email_status,
        r.emailed_at,
        i.id AS invoice_id,
        i.invoice_number,
        i.balance_due,
        i.status AS invoice_status
      ${paymentBaseJoinSql()}
      WHERE p.id = ?
        AND p.member_id = ?
      LIMIT 1
      `,
      [req.params.id, memberId]
    );

    if (!payment) {
      return res.status(404).json({
        ok: false,
        error: "Payment not found.",
      });
    }

    let coverage = [];

    try {
      const [rows] = await pool.query(
        `
        SELECT
          id,
          coverage_year,
          month_number,
          month_name,
          coverage_month,
          status,
          amount,
          payment_number,
          invoice_number,
          receipt_number,
          created_at
        FROM tbl_member_membership_coverage
        WHERE member_id = ?
          AND (payment_id = ? OR payment_number = ?)
        ORDER BY coverage_year ASC, month_number ASC
        `,
        [memberId, payment.id, payment.payment_number]
      );

      coverage = rows || [];
    } catch {
      coverage = [];
    }

    return res.json({
      ok: true,
      payment,
      coverage,
    });
  } catch (err) {
    console.error("member payment detail error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to load payment.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Lightweight Invoice / Receipt Compatibility                                */
/* Dedicated routes remain /api/member/invoices and /api/member/receipts       */
/* -------------------------------------------------------------------------- */

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
      ORDER BY COALESCE(i.invoice_date, i.issued_at, i.created_at) DESC, i.id DESC
      LIMIT ?
      `,
      [memberId, limit]
    );

    return res.json({
      ok: true,
      rows,
      dedicated_endpoint: "/api/member/invoices",
    });
  } catch (err) {
    console.error("member invoices error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to load invoices.",
    });
  }
});

router.get("/my-invoices", async (req, res) => {
  req.url = "/invoices";
  return router.handle(req, res);
});

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
      ORDER BY COALESCE(r.issued_at, r.created_at) DESC, r.id DESC
      LIMIT ?
      `,
      [memberId, limit]
    );

    return res.json({
      ok: true,
      rows,
      dedicated_endpoint: "/api/member/receipts",
    });
  } catch (err) {
    console.error("member receipts error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to load receipts.",
    });
  }
});

router.get("/my-receipts", async (req, res) => {
  req.url = "/receipts";
  return router.handle(req, res);
});

/* -------------------------------------------------------------------------- */
/* Membership Coverage                                                        */
/* -------------------------------------------------------------------------- */

router.get("/membership-coverage", async (req, res) => {
  try {
    const memberId = requireMember(req, res);
    if (!memberId) return;

    const year = Number(req.query.year || new Date().getFullYear());

    const [rows] = await pool.query(
      `
      SELECT
        payment_id,
        MAX(payment_number) AS payment_number,
        MAX(receipt_number) AS receipt_number,
        MAX(invoice_number) AS invoice_number,

        MIN(month_number) AS start_month,
        MAX(month_number) AS end_month,
        COUNT(*) AS months_paid,

        SUM(amount) AS amount,
        MAX(method) AS method,
        MAX(provider) AS provider,
        MAX(status) AS status,
        MAX(paid_at) AS paid_at

      FROM tbl_member_membership_coverage

      WHERE member_id = ?
        AND coverage_year = ?
        AND LOWER(COALESCE(status, '')) IN ('paid', 'completed', 'posted')

      GROUP BY payment_id

      ORDER BY
        MAX(paid_at) DESC,
        payment_id DESC
      `,
      [memberId, year]
    );

    // const formatted = rows.map((row) => ({
    //   ...row,
    //   amount: money(row.amount),
    //   months_paid: Number(row.months_paid || 0),
    //   coverage_start_month: Number(row.start_month || 0),
    //   coverage_end_month: Number(row.end_month || 0),
    //   coverage_label: formatCoverageLabel(
    //     year,
    //     row.start_month,
    //     row.end_month
    //   ),
    // }));
const formatted = rows.map((row) => ({
  ...row,

  coverage_start_month:
    Number(row.start_month || 0),

  coverage_end_month:
    Number(row.end_month || 0),

  amount: money(row.amount),

  months_paid:
    Number(row.months_paid || 0),

  coverage_label:
    formatCoverageLabel(
      year,
      row.start_month,
      row.end_month
    ),
}));
    // return res.json({
    //   ok: true,
    //   year,
    //   rows: formatted,
    // });
return res.json({
  ok: true,
  year,
  coverage: formatted[0] || null,
  rows: formatted,
});
  } catch (err) {
    console.error("member coverage error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to load coverage.",
    });
  }
});


router.get("/membership-grid/:year", async (req, res) => {
  try {
    const memberId = requireMember(req, res);
    if (!memberId) return;

    const memberNo = getMemberNo(req);
    const year = Number(req.params.year || new Date().getFullYear());

    const [[member]] = await pool.query(
      `
      SELECT
        id,
        member_no,
        membership_start_date,
        created_at
      FROM tbl_members
      WHERE id = ?
      LIMIT 1
      `,
      [memberId]
    );

    const startDate = member?.membership_start_date || member?.created_at || null;
    const start = startDate ? new Date(startDate) : null;
    const startYear = start ? start.getFullYear() : year;
    const startMonth = start ? start.getMonth() + 1 : 1;

    const [rows] = await pool.query(
      `
      SELECT
        month_number,
        month_name,
        coverage_month,
        coverage_year,

        MAX(payment_number) AS payment_number,
        MAX(receipt_number) AS receipt_number,
        MAX(invoice_number) AS invoice_number,

        MAX(method) AS method,
        MAX(provider) AS provider,
        MAX(amount) AS amount,

        MAX(status) AS status,
        MAX(paid_at) AS paid_at

      FROM tbl_member_membership_coverage

      WHERE member_id = ?
        AND coverage_year = ?
        AND LOWER(COALESCE(status, '')) IN ('paid', 'completed', 'posted')

      GROUP BY
        coverage_year,
        month_number,
        month_name,
        coverage_month

      ORDER BY month_number ASC
      `,
      [memberId, year]
    );

    const paidMap = new Map();

    rows.forEach((row) => {
      paidMap.set(Number(row.month_number), row);
    });

    const grid = Array.from({ length: 12 }, (_, index) => {
      const monthNumber = index + 1;
      const row = paidMap.get(monthNumber);

      const beforeMemberStart =
        year < startYear ||
        (year === startYear && monthNumber < startMonth);

      return {
        month_number: monthNumber,
        month_name: monthName(monthNumber),

        paid: Boolean(row),
        open: !row && !beforeMemberStart,
        not_applicable: beforeMemberStart,

        status:
          row?.status ||
          (beforeMemberStart ? "not_applicable" : "unpaid"),

        payment_number: row?.payment_number || null,
        invoice_number: row?.invoice_number || null,
        receipt_number: row?.receipt_number || null,

        method: row?.method || null,
        provider: row?.provider || null,
        amount: money(row?.amount || 0),
        paid_at: row?.paid_at || null,
      };
    });

    return res.json({
      ok: true,
      year,
      member_id: memberId,
      member_no: memberNo || member?.member_no || null,
      member_start_year: startYear,
      member_start_month: startMonth,
      grid,
    });
  } catch (err) {
    console.error("member coverage grid error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to load coverage grid.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Ledger                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/ledger", async (req, res) => {
  try {
    const memberId = requireMember(req, res);
    if (!memberId) return;

    const limit = Math.min(200, toInt(req.query.limit, 100));

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

      LIMIT ?
      `,
      [memberId, limit]
    );

    return res.json({
      ok: true,
      rows,
    });
  } catch (err) {
    console.error("member ledger error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to load ledger.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Summary                                                                    */
/* -------------------------------------------------------------------------- */

router.get("/summary", async (req, res) => {
  try {
    const memberId = requireMember(req, res);
    if (!memberId) return;

    const [[paymentSummary]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_payments,
        COALESCE(SUM(amount), 0) AS total_paid,
        COALESCE(SUM(CASE WHEN category = 'membership' OR payment_type = 'membership' THEN amount ELSE 0 END), 0) AS membership_paid,
        COALESCE(SUM(CASE WHEN category = 'donation' OR payment_type = 'donation' THEN amount ELSE 0 END), 0) AS donations_paid,
        COALESCE(SUM(CASE WHEN category IN ('school', 'trip') OR payment_type IN ('school', 'trip') THEN amount ELSE 0 END), 0) AS program_paid,
        COALESCE(SUM(CASE WHEN category = 'pledge' OR payment_type = 'pledge' THEN amount ELSE 0 END), 0) AS pledge_paid
      FROM tbl_finance_payments
      WHERE member_id = ?
        AND LOWER(COALESCE(status, payment_status, '')) NOT IN ('void', 'cancelled', 'canceled', 'reversed', 'refunded')
      `,
      [memberId]
    );

    const [[invoiceSummary]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_invoices,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(status, invoice_status, '')) NOT IN ('paid', 'void', 'cancelled', 'canceled') THEN 1 ELSE 0 END), 0) AS pending_invoices,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(status, invoice_status, '')) NOT IN ('paid', 'void', 'cancelled', 'canceled') THEN balance_due ELSE 0 END), 0) AS outstanding_invoice_balance
      FROM tbl_finance_invoices
      WHERE member_id = ?
      `,
      [memberId]
    );

    const [[receiptSummary]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_receipts,
        COALESCE(SUM(amount), 0) AS receipted_amount
      FROM tbl_finance_receipts
      WHERE member_id = ?
      `,
      [memberId]
    );

    const [[coverageSummary]] = await pool.query(
      `
      SELECT
        COUNT(*) AS paid_membership_months,
        COALESCE(SUM(amount), 0) AS paid_membership_coverage_amount
      FROM tbl_member_membership_coverage
      WHERE member_id = ?
        AND LOWER(COALESCE(status, '')) IN ('paid', 'completed', 'posted')
      `,
      [memberId]
    );

    return res.json({
      ok: true,
      summary: {
        ...paymentSummary,
        ...invoiceSummary,
        ...receiptSummary,
        ...coverageSummary,
      },
    });
  } catch (err) {
    console.error("member summary error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to load summary.",
    });
  }
});

module.exports = router;