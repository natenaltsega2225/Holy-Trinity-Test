// backend/routes/memberSummary.js
"use strict";

const express = require("express");
const db = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();

router.use(authRequired);

router.use(
  requireRole(
    "member",
    "finance",
    "admin",
    "super_admin"
  )
);

function getMemberId(req) {
  return Number(
    req.user?.member_id ||
      req.user?.memberId ||
      0
  ) || null;
}

function isPaid(status) {
  return ["paid", "posted", "completed", "approved"].includes(
    String(status || "").toLowerCase()
  );
}

router.get("/summary", async (req, res) => {
  try {
    const memberId = getMemberId(req);

    if (!memberId) {
      return res.status(403).json({
        ok: false,
        error: "Member profile missing.",
      });
    }

    const year = Number(
      req.query.year ||
        new Date().getFullYear()
    );

    const [[member]] = await db.query(
      `
      SELECT
        id,
        member_no,
        full_name,
        email,
        phone,
        membership_status,
        membership_start_date,
        membership_end_date
      FROM tbl_members
      WHERE id = ?
      LIMIT 1
      `,
      [memberId]
    );

    const [payments] = await db.query(
      `
      SELECT
        id,
        payment_number,
        category,
        amount,
        status,
        payment_status,
        paid_at,
        created_at
      FROM tbl_finance_payments
      WHERE member_id = ?
      ORDER BY COALESCE(paid_at, created_at) DESC, id DESC
      `,
      [memberId]
    );

    const [invoices] = await db.query(
      `
      SELECT
        id,
        invoice_number,
        total_amount,
        paid_amount,
        balance_due,
        status,
        created_at
      FROM tbl_finance_invoices
      WHERE member_id = ?
      ORDER BY id DESC
      `,
      [memberId]
    );

    const [receipts] = await db.query(
      `
      SELECT
        id,
        receipt_number,
        amount,
        status,
        email_status,
        created_at
      FROM tbl_finance_receipts
      WHERE member_id = ?
      ORDER BY id DESC
      `,
      [memberId]
    );

    const [coverage] = await db.query(
      `
      SELECT
        id,
        coverage_year,
        month_number,
        coverage_month,
        month_name,
        status,
        amount,
        payment_number,
        receipt_number,
        invoice_number,
        created_at
      FROM tbl_member_membership_coverage
      WHERE member_id = ?
        AND coverage_year = ?
      ORDER BY month_number ASC
      `,
      [memberId, year]
    );

    const paidCoverageMonths = new Set();

    coverage.forEach((row) => {
      if (isPaid(row.status)) {
        const m = Number(row.month_number);
        if (m >= 1 && m <= 12) {
          paidCoverageMonths.add(m);
        }
      }
    });

    const paidMonths = paidCoverageMonths.size;
    const unpaidMonths = Math.max(0, 12 - paidMonths);
    const coveragePercent = Math.round((paidMonths / 12) * 100);

    const totalPaid = payments
      .filter((p) => isPaid(p.status || p.payment_status))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const currentYearPaid = payments
      .filter((p) => {
        const d = new Date(p.paid_at || p.created_at);
        return !Number.isNaN(d.getTime()) && d.getFullYear() === year;
      })
      .filter((p) => isPaid(p.status || p.payment_status))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const paidInvoices = invoices.filter((i) => isPaid(i.status)).length;

    const pendingInvoices = invoices.filter((i) => !isPaid(i.status)).length;

    const summary = {
      member,
      year,

      totalPaid,
      currentYearPaid,

      paymentCount: payments.length,
      invoiceCount: invoices.length,
      receiptCount: receipts.length,

      paidInvoices,
      pendingInvoices,

      paidMonths,
      unpaidMonths,
      coveragePercent,

      activePlan: member?.membership_status || "--",
      membershipStatus: member?.membership_status || "--",
      membershipStartDate: member?.membership_start_date || null,
      membershipEndDate: member?.membership_end_date || null,

      recentPayments: payments.slice(0, 5),
      recentReceipts: receipts.slice(0, 5),
      coverageRows: coverage,
    };

    return res.json({
      ok: true,
      summary,

      totalPaid,
      currentYearPaid,
      paymentCount: payments.length,
      invoiceCount: invoices.length,
      receiptCount: receipts.length,
      paidInvoices,
      pendingInvoices,
      paidMonths,
      unpaidMonths,
      coveragePercent,
      coverageRows: coverage,
    });
  } catch (err) {
    console.error("member summary error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to load member summary.",
    });
  }
});

module.exports = router;