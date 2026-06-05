//backend\routes\financeMemberLedger.js
"use strict";

const express = require("express");
const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();

const financeOnly = requireRole(
  "finance",
  "admin",
  "super_admin"
);

function clean(value, max = 255) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n)
    ? Math.trunc(n)
    : fallback;
}

function getMemberId(req) {
  return (
    Number(
      req.user?.member_id ||
        req.user?.memberId ||
        0
    ) || null
  );
}

function buildLedgerSelect() {
  return `
    SELECT
      l.id,
      l.member_id,

      l.record_date AS entry_date,
      l.record_date AS created_at,

      l.record_type,
      l.record_type AS entry_type,

      l.related_document_type,
      l.related_document_type AS source_type,

      l.related_document_id,
      l.related_document_number,

      COALESCE(
        l.related_document_number,
        p.payment_number,
        i.invoice_number,
        r.receipt_number
      ) AS reference_number,

      COALESCE(
        l.related_document_number,
        p.payment_number,
        i.invoice_number,
        r.receipt_number
      ) AS reference_no,

      COALESCE(
        l.description,
        p.sub_category,
        p.category,
        l.record_type
      ) AS description,

      l.notes,

      COALESCE(l.debit_amount, 0) AS debit,
      COALESCE(l.credit_amount, 0) AS credit,
      COALESCE(l.running_balance, 0) AS balance,

      l.status,

      m.member_no,
      COALESCE(
        m.full_name,
        p.full_name_snapshot,
        '--'
      ) AS member_name,

      m.status AS member_status,

      p.payment_number,
      p.payment_type,
      p.category,
      p.sub_category,
      p.method AS payment_method,
      p.provider AS payment_source,
      p.status AS payment_status,

      i.invoice_number,
      r.receipt_number,

      COALESCE(p.months_paid, 0) AS months_paid,

      CASE
        WHEN p.months_paid = 12 THEN '12 Month'
        WHEN p.months_paid = 6 THEN '6 Month'
        WHEN p.months_paid = 3 THEN '3 Month'
        WHEN p.months_paid = 1 THEN 'Monthly'
        ELSE NULL
      END AS plan_type,

      CASE
        WHEN ds.auto_renew = 1 THEN 'auto_renew'
        ELSE 'manual'
      END AS renewal_status
  `;
}

function buildLedgerJoins() {
  return `
    FROM tbl_finance_member_ledger l

    LEFT JOIN tbl_members m
      ON m.id = l.member_id

    LEFT JOIN tbl_finance_payments p
      ON (
        l.related_document_type = 'payment'
        AND p.id = l.related_document_id
      )

    LEFT JOIN tbl_finance_invoices i
      ON (
        l.related_document_type = 'invoice'
        AND i.id = l.related_document_id
      )

    LEFT JOIN tbl_finance_receipts r
      ON (
        l.related_document_type = 'receipt'
        AND r.id = l.related_document_id
      )

    LEFT JOIN tbl_finance_dues_subscriptions ds
      ON ds.id = p.dues_subscription_id
  `;
}

function buildFilters(req, options = {}) {
  const where = [];
  const params = [];

  if (options.memberOnly) {
    where.push("l.member_id = ?");
    params.push(options.memberId);
  } else {
    where.push("1=1");
  }

  const search = clean(
    req.query.search ||
      req.query.q,
    150
  );

  if (search) {
    const like = `%${search}%`;

    where.push(`
      (
        m.full_name LIKE ?
        OR m.member_no LIKE ?
        OR l.related_document_number LIKE ?
        OR l.description LIKE ?
        OR l.notes LIKE ?
        OR p.payment_number LIKE ?
        OR i.invoice_number LIKE ?
        OR r.receipt_number LIKE ?
      )
    `);

    params.push(
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like
    );
  }

  const recordType = clean(
    req.query.record_type ||
      req.query.recordType,
    50
  );

  if (recordType) {
    where.push("l.record_type = ?");
    params.push(recordType);
  }

  return {
    whereSql: `WHERE ${where.join(" AND ")}`,
    params,
  };
}

async function queryLedger(req, options = {}) {
  const page = Math.max(
    1,
    toInt(req.query.page, 1)
  );

  const limit = Math.min(
    100,
    Math.max(
      1,
      toInt(
        req.query.limit ||
          req.query.pageSize,
        25
      )
    )
  );

  const offset =
    (page - 1) * limit;

  const {
    whereSql,
    params,
  } = buildFilters(req, options);

  const [rows] = await pool.query(
    `
    ${buildLedgerSelect()}
    ${buildLedgerJoins()}
    ${whereSql}
    ORDER BY
      l.record_date DESC,
      l.id DESC
    LIMIT ? OFFSET ?
    `,
    [
      ...params,
      limit,
      offset,
    ]
  );

  const [[countRow]] = await pool.query(
    `
    SELECT COUNT(*) AS total
    ${buildLedgerJoins()}
    ${whereSql}
    `,
    params
  );

  return {
    rows,
    page,
    limit,
    total: Number(countRow?.total || 0),
  };
}

router.get(
  "/member-ledger",
  authRequired,
  financeOnly,
  async (req, res) => {
    try {
      const result = await queryLedger(req);

      return res.json({
        ok: true,
        ...result,
      });
    } catch (err) {
      console.error(
        "GET /finance/member-ledger error:",
        err
      );

      return res.status(500).json({
        ok: false,
        error:
          "Failed to load member ledger.",
      });
    }
  }
);

router.get(
  "/ledger",
  authRequired,
  async (req, res) => {
    try {
      const memberId =
        getMemberId(req);

      if (!memberId) {
        return res.status(403).json({
          ok: false,
          error:
            "Member account not linked.",
        });
      }

      const result = await queryLedger(
        req,
        {
          memberOnly: true,
          memberId,
        }
      );

      return res.json({
        ok: true,
        ...result,
      });
    } catch (err) {
      console.error(
        "GET /member/ledger error:",
        err
      );

      return res.status(500).json({
        ok: false,
        error:
          "Failed to load ledger.",
      });
    }
  }
);

module.exports = router;