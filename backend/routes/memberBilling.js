
// // backend/routes/memberBilling.js
// "use strict";

// const express = require("express");
// const pool = require("../db");
// const { authRequired, requireRole } = require("../middleware/auth");

// const router = express.Router();

// function isAllowed(req, res, next) {
//   return requireRole(
//     "member",
//     "finance",
//     "admin",
//     "super_admin"
//   )(req, res, next);
// }

// function toInt(v, def = 0) {
//   const n = Number(v);
//   return Number.isFinite(n) ? Math.trunc(n) : def;
// }

// function buildCardDisplay(brand, last4) {
//   return brand && last4
//     ? `${String(brand).toUpperCase()} •••• ${last4}`
//     : "--";
// }

// async function getMemberIdForUser(userId) {
//   const [[row]] = await pool.query(
//     `
//     SELECT member_id
//     FROM tbl_users
//     WHERE id = ?
//     LIMIT 1
//     `,
//     [userId]
//   );

//   return Number(row?.member_id || 0) || null;
// }

// async function resolveMemberId(req) {
//   if (
//     ["finance", "admin", "super_admin"].includes(
//       req.user?.role
//     )
//   ) {
//     const explicit = toInt(
//       req.query.member_id || req.body?.member_id,
//       0
//     );

//     if (explicit) return explicit;
//   }

//   return getMemberIdForUser(req.user.id);
// }

// /* =========================================================
//    PAYMENTS
// ========================================================= */

// router.get(
//   "/payments",
//   authRequired,
//   isAllowed,
//   async (req, res) => {
//     try {
//       const memberId = await resolveMemberId(req);

//       if (!memberId) {
//         return res.json({
//           ok: true,
//           rows: [],
//         });
//       }

//       const [rows] = await pool.query(
//         `
//         SELECT
//           p.id,

//           p.payment_number,
//           p.payment_type,
//           p.category,
//           p.sub_category,

//           p.amount,
//           p.status,

//           p.method AS payment_method,
//           p.provider AS payment_source,

//           p.quantity,

//           p.card_brand,
//           p.card_last4,
//           p.card_exp_month,
//           p.card_exp_year,
//           p.cardholder_name,

//           p.months_paid,

//           p.coverage_start,
//           p.coverage_end,
//           p.coverage_label,

//           p.created_at,
//           p.paid_at,

//           DATE_FORMAT(
//             COALESCE(p.paid_at, p.created_at),
//             '%Y-%m-%d'
//           ) AS payment_date,

//           r.id AS receipt_id,
//           r.receipt_number,

//           i.id AS invoice_id,
//           i.invoice_number,
//           i.balance_due,

//           CASE
//             WHEN p.coverage_start IS NOT NULL
//               AND p.coverage_end IS NOT NULL
//             THEN CONCAT(
//               DATE_FORMAT(p.coverage_start, '%m/%d/%Y'),
//               ' → ',
//               DATE_FORMAT(p.coverage_end, '%m/%d/%Y')
//             )
//             ELSE '--'
//           END AS coverage_period,

//           CASE
//             WHEN p.coverage_end IS NOT NULL
//             THEN GREATEST(
//               TIMESTAMPDIFF(MONTH, CURDATE(), p.coverage_end),
//               0
//             )
//             ELSE 0
//           END AS months_remaining

//         FROM tbl_finance_payments p

//         LEFT JOIN tbl_finance_receipts r
//           ON r.payment_id = p.id

//         LEFT JOIN tbl_finance_invoices i
//           ON i.id = r.invoice_id

//         WHERE p.member_id = ?

//         ORDER BY
//           COALESCE(p.paid_at, p.created_at) DESC,
//           p.id DESC
//         `,
//         [memberId]
//       );

//       return res.json({
//         ok: true,

//         rows: rows.map((row) => ({
//           ...row,

//           amount: Number(row.amount || 0),
//           quantity: Number(row.quantity || 1),
//           months_paid: Number(row.months_paid || 0),

//           balance_due: Number(row.balance_due || 0),

//           card_display: buildCardDisplay(
//             row.card_brand,
//             row.card_last4
//           ),

//           payment_method:
//             row.payment_method || "card",

//           payment_source:
//             row.payment_source || "stripe",

//           category:
//             row.category || row.payment_type,
//         })),
//       });
//     } catch (err) {
//       console.error(
//         "GET /member/payments error:",
//         err
//       );

//       return res.status(500).json({
//         ok: false,
//         error: "Failed to load payment history.",
//       });
//     }
//   }
// );

// /* =========================================================
//    LEDGER
// ========================================================= */

// router.get(
//   "/ledger",
//   authRequired,
//   isAllowed,
//   async (req, res) => {
//     try {
//       const memberId = await resolveMemberId(req);

//       if (!memberId) {
//         return res.json({
//           ok: true,
//           rows: [],
//         });
//       }

//       const [rows] = await pool.query(
//         `
//         SELECT
//           l.id,

//           l.record_date AS entry_date,

//           l.record_type,

//           l.related_document_number AS reference_number,

//           l.related_document_type,

//           l.description,

//           l.debit_amount AS debit,

//           l.credit_amount AS credit,

//           l.running_balance AS balance,

//           l.source AS payment_source,

//           l.status,

//           l.notes,

//           p.payment_number,

//           p.category,
//           p.payment_type,
//           p.sub_category,

//           p.coverage_start,
//           p.coverage_end,
//           p.months_paid

//         FROM tbl_finance_member_ledger l

//         LEFT JOIN tbl_finance_payments p
//           ON p.id = l.related_document_id

//         WHERE l.member_id = ?

//         ORDER BY
//           l.record_date DESC,
//           l.id DESC
//         `,
//         [memberId]
//       );

//       return res.json({
//         ok: true,

//         rows: rows.map((row) => ({
//           ...row,

//           debit: Number(row.debit || 0),
//           credit: Number(row.credit || 0),
//           balance: Number(row.balance || 0),
//         })),
//       });
//     } catch (err) {
//       console.error(
//         "GET /member/ledger error:",
//         err
//       );

//       return res.status(500).json({
//         ok: false,
//         error: "Failed to load ledger.",
//       });
//     }
//   }
// );

// /* =========================================================
//    INVOICES + RECEIPTS
// ========================================================= */

// router.get(
//   "/invoices-receipts",
//   authRequired,
//   isAllowed,
//   async (req, res) => {
//     try {
//       const memberId = await resolveMemberId(req);

//       if (!memberId) {
//         return res.json({
//           ok: true,
//           rows: [],
//         });
//       }

//       const [rows] = await pool.query(
//         `
//         SELECT
//           i.id AS invoice_id,

//           i.invoice_number,

//           i.amount,
//           i.total_amount,
//           i.paid_amount,
//           i.balance_due,

//           i.status,

//           i.created_at AS invoice_date,
//           i.due_date,

//           i.period_label,
//           i.period_start,
//           i.period_end,

//           i.description,

//           r.id AS receipt_id,
//           r.receipt_number,
//           r.email_status,

//           p.id AS payment_id,
//           p.payment_number,

//           p.category,
//           p.payment_type,
//           p.sub_category,

//           p.method AS payment_method,
//           p.provider AS payment_source,

//           p.card_brand,
//           p.card_last4,

//           p.months_paid,

//           p.coverage_start,
//           p.coverage_end,
//           p.coverage_label,

//           p.stripe_payment_intent_id,

//           m.member_no,
//           m.full_name,
//           m.email

//         FROM tbl_finance_invoices i

//         LEFT JOIN tbl_finance_receipts r
//           ON r.invoice_id = i.id

//         LEFT JOIN tbl_finance_payments p
//           ON p.id = i.payment_id

//         LEFT JOIN tbl_members m
//           ON m.id = i.member_id

//         WHERE i.member_id = ?

//         ORDER BY
//           i.created_at DESC,
//           i.id DESC
//         `,
//         [memberId]
//       );

//       return res.json({
//         ok: true,

//         rows: rows.map((row) => ({
//           ...row,

//           total_amount: Number(
//             row.total_amount || 0
//           ),

//           paid_amount: Number(
//             row.paid_amount || 0
//           ),

//           balance_due: Number(
//             row.balance_due || 0
//           ),

//           months_paid: Number(
//             row.months_paid || 0
//           ),

//           payment_source:
//             row.payment_source || "stripe",

//           payment_method:
//             row.payment_method || "card",

//           category:
//             row.category || row.payment_type,

//           card_display: buildCardDisplay(
//             row.card_brand,
//             row.card_last4
//           ),
//         })),
//       });
//     } catch (err) {
//       console.error(
//         "GET /member/invoices-receipts error:",
//         err
//       );

//       return res.status(500).json({
//         ok: false,
//         error:
//           "Failed to load invoices and receipts.",
//       });
//     }
//   }
// );

// module.exports = router;