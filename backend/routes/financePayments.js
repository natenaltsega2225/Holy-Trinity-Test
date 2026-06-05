// // backend/routes/financePayments.js

// "use strict";

// /* =========================================================
//    ENTERPRISE FINANCE PAYMENTS ROUTES
// ========================================================= */

// const express = require("express");
// const crypto = require("crypto");

// const pool = require("../db");
// const {
//   sendReceiptEmail,
// } = require("../services/domains/receipts/receiptEmailService");
// const {
//   authRequired,
//   requireRole,
// } = require("../middleware/auth");

// const router =
//   express.Router();

// /* =========================================================
//    SECURITY
// ========================================================= */

// router.use(
//   authRequired
// );

// router.use(
//   requireRole(
//     "finance",
//     "admin",
//     "super_admin"
//   )
// );

// /* =========================================================
//    HELPERS
// ========================================================= */

// const columnCache =
//   new Map();

// const tableCache =
//   new Map();

// function clean(value) {
//   return String(
//     value ?? ""
//   ).trim();
// }

// function toInt(
//   value,
//   fallback = 1
// ) {
//   const n = Number(value);

//   return Number.isFinite(n) &&
//     n > 0
//     ? Math.trunc(n)
//     : fallback;
// }

// function toMoney(value) {
//   const n = Number(value || 0);

//   return Number.isFinite(n)
//     ? Number(n.toFixed(2))
//     : 0;
// }

// function nowStamp() {
//   return Date.now();
// }

// function makeCode(prefix) {
//   return `${prefix}-${nowStamp()}-${crypto
//     .randomBytes(3)
//     .toString("hex")
//     .toUpperCase()}`;
// }

// async function tableExists(
//   conn,
//   tableName
// ) {

//   if (
//     tableCache.has(tableName)
//   ) {
//     return tableCache.get(
//       tableName
//     );
//   }

//   try {

//     const [rows] =
//       await conn.query(
//         `SHOW TABLES LIKE ?`,
//         [tableName]
//       );

//     const exists =
//       rows.length > 0;

//     tableCache.set(
//       tableName,
//       exists
//     );

//     return exists;

//   } catch {

//     tableCache.set(
//       tableName,
//       false
//     );

//     return false;
//   }
// }

// async function getColumns(
//   conn,
//   tableName
// ) {

//   if (
//     columnCache.has(tableName)
//   ) {
//     return columnCache.get(
//       tableName
//     );
//   }

//   const exists =
//     await tableExists(
//       conn,
//       tableName
//     );

//   if (!exists) {

//     columnCache.set(
//       tableName,
//       new Set()
//     );

//     return new Set();
//   }

//   const [rows] =
//     await conn.query(
//       `SHOW COLUMNS FROM \`${tableName}\``
//     );

//   const cols =
//     new Set(
//       rows.map(
//         (r) => r.Field
//       )
//     );

//   columnCache.set(
//     tableName,
//     cols
//   );

//   return cols;
// }

// async function insertDynamic(
//   conn,
//   tableName,
//   data
// ) {

//   const cols =
//     await getColumns(
//       conn,
//       tableName
//     );

//   const entries =
//     Object.entries(data)
//       .filter(
//         ([key, value]) =>
//           cols.has(key) &&
//           value !== undefined
//       );

//   if (!entries.length) {
//     return null;
//   }

//   const fields =
//     entries
//       .map(
//         ([key]) =>
//           `\`${key}\``
//       )
//       .join(", ");

//   const marks =
//     entries
//       .map(() => "?")
//       .join(", ");

//   const values =
//     entries.map(
//       ([, value]) => value
//     );

//   const [result] =
//     await conn.query(
//       `
//       INSERT INTO \`${tableName}\`
//       (${fields})
//       VALUES (${marks})
//       `,
//       values
//     );

//   return result.insertId;
// }

// async function updateDynamic(
//   conn,
//   tableName,
//   data,
//   whereSql,
//   whereParams = []
// ) {

//   const cols =
//     await getColumns(
//       conn,
//       tableName
//     );

//   const entries =
//     Object.entries(data)
//       .filter(
//         ([key, value]) =>
//           cols.has(key) &&
//           value !== undefined
//       );

//   if (!entries.length) {
//     return;
//   }

//   const setSql =
//     entries
//       .map(
//         ([key]) =>
//           `\`${key}\` = ?`
//       )
//       .join(", ");

//   const values =
//     entries.map(
//       ([, value]) => value
//     );

//   await conn.query(
//     `
//     UPDATE \`${tableName}\`
//     SET ${setSql}
//     WHERE ${whereSql}
//     `,
//     [
//       ...values,
//       ...whereParams,
//     ]
//   );
// }

// function monthName(month) {

//   const names = [
//     "",
//     "January",
//     "February",
//     "March",
//     "April",
//     "May",
//     "June",
//     "July",
//     "August",
//     "September",
//     "October",
//     "November",
//     "December",
//   ];

//   return (
//     names[
//       Number(month)
//     ] || String(month)
//   );
// }

// function buildCoverageMonths(
//   startYear,
//   startMonth,
//   monthsPaid
// ) {

//   const rows = [];

//   const year =
//     Number(startYear) ||
//     new Date().getFullYear();

//   const month =
//     Number(startMonth) || 1;

//   const count =
//     Number(monthsPaid) || 1;

//   for (
//     let i = 0;
//     i < count;
//     i += 1
//   ) {

//     const d = new Date(
//       year,
//       month - 1 + i,
//       1
//     );

//     rows.push({

//       coverage_year:
//         d.getFullYear(),

//       month_number:
//         d.getMonth() + 1,

//       month_name:
//         d.toLocaleString(
//           "en-US",
//           {
//             month: "long",
//           }
//         ),

//       coverage_month:
//         `${d.getFullYear()}-${String(
//           d.getMonth() + 1
//         ).padStart(2, "0")}`,
//     });
//   }

//   return rows;
// }
// /* =========================================================
//    MEMBER SNAPSHOT
// ========================================================= */

// async function getMemberSnapshot(
//   conn,
//   memberId
// ) {

//   if (!memberId) {
//     return null;
//   }

//   const [[member]] =
//     await conn.query(
//       `
//       SELECT
//         id,
//         member_no,
//         full_name,
//         email,
//         phone,
//         membership_status
//       FROM tbl_members
//       WHERE id = ?
//       LIMIT 1
//       `,
//       [memberId]
//     );

//   return member || null;
// }

// /* =========================================================
//    CREATE INVOICE
// ========================================================= */

// async function createInvoice(
//   conn,
//   payment,
//   payload
// ) {

//   const invoiceNumber =
//     makeCode("INV");

//   const invoiceId =
//     await insertDynamic(
//       conn,
//       "tbl_finance_invoices",
//       {
//         invoice_number:
//           invoiceNumber,

//         payment_id:
//           payment.id,

//         member_id:
//           payment.member_id,

//         member_no:
//           payment.member_no,

//         full_name_snapshot:
//           payment.full_name_snapshot,

//         email_snapshot:
//           payment.email_snapshot,

//         phone_snapshot:
//           payment.phone_snapshot,

//         category:
//           payment.category,

//         sub_category:
//           payment.sub_category,

//         description:
//           payment.description,

//         total_amount:
//           payment.amount,

//         amount:
//           payment.amount,

//         paid_amount:
//           payment.amount,

//         balance_due: 0,

//         status: "paid",

//         due_date:
//           new Date(),

//         invoice_date:
//           new Date(),

//         paid_at:
//           new Date(),

//         created_by:
//           payload.actor_id,

//         created_at:
//           new Date(),

//         updated_at:
//           new Date(),
//       }
//     );

//   return {
//     id: invoiceId,
//     invoice_number:
//       invoiceNumber,
//   };
// }

// /* =========================================================
//    CREATE RECEIPT
// ========================================================= */

// async function createReceipt(
//   conn,
//   payment,
//   invoice,
//   payload
// ) {

//   const receiptNumber =
//     makeCode("RCPT");

//   const receiptId =
//     await insertDynamic(
//       conn,
//       "tbl_finance_receipts",
//       {
//         receipt_number:
//           receiptNumber,

//         payment_id:
//           payment.id,

//         invoice_id:
//           invoice.id,

//         invoice_number:
//           invoice.invoice_number,

//         member_id:
//           payment.member_id,

//         member_no:
//           payment.member_no,

//         full_name_snapshot:
//           payment.full_name_snapshot,

//         email_snapshot:
//           payment.email_snapshot,

//         phone_snapshot:
//           payment.phone_snapshot,

//         category:
//           payment.category,

//         sub_category:
//           payment.sub_category,

//         description:
//           payment.description,

//         amount:
//           payment.amount,

//         method:
//           payment.method,

//         provider:
//           payment.provider,

//         reference_no:
//           payment.reference_no,

//        email_status:
//   payment.email_snapshot
//     ? "pending"
//     : "not_requested",

// emailed_to:
//   payment.email_snapshot || null,
//         receipt_date:
//           new Date(),

//         created_by:
//           payload.actor_id,

//         created_at:
//           new Date(),

//         updated_at:
//           new Date(),
//       }
//     );

//   return {
//     id: receiptId,
//     receipt_number:
//       receiptNumber,
//   };
// }

// /* =========================================================
//    CREATE LEDGER
// ========================================================= */

// async function createLedgerEntry(conn, payment, invoice, receipt, payload) {
//   const tables = [
//     "tbl_finance_member_ledger",
//     "tbl_finance_ledger",
//     "tbl_finance_ledger_entries",
//     "tbl_member_ledger",
//   ];

//   const ledgerUuid = makeCode("LEDGER");

//   for (const table of tables) {
//     if (!(await tableExists(conn, table))) {
//       continue;
//     }

//     await insertDynamic(conn, table, {
//       ledger_uuid: ledgerUuid,
//       ledger_number: ledgerUuid,

//       member_id: payment.member_id,
//       member_no: payment.member_no || null,

//       full_name_snapshot: payment.full_name_snapshot || null,
//       phone_snapshot: payment.phone_snapshot || null,

//       record_type: "payment",
//       ledger_type: "payment",
//       entry_type: "payment",

//       related_document_type: "receipt",
//       related_document_id: receipt.id,
//       related_document_number: receipt.receipt_number,

//       payment_id: payment.id,
//       invoice_id: invoice.id,
//       receipt_id: receipt.id,

//       payment_number: payment.payment_number,
//       invoice_number: invoice.invoice_number,
//       receipt_number: receipt.receipt_number,

//       record_date: new Date(),

//       category: payment.category,
//       sub_category: payment.sub_category,

//       description:
//         payment.description ||
//         `${payment.category || "payment"} payment`,

//       debit: 0,
//       credit: payment.amount,

//       debit_amount: 0,
//       credit_amount: payment.amount,

//       amount: payment.amount,
//       running_balance: 0,

//       method: payment.method,
//       provider: payment.provider,

//       source: "finance_manual_payment",
//       source_reference: payment.payment_number,

//       reference_no: payment.reference_no,

//       status: "posted",

//       posted_by: payload.actor_id,
//       created_by: payload.actor_id,

//       posted_at: new Date(),
//       created_at: new Date(),
//       updated_at: new Date(),
//     });

//     return;
//   }
// }
// /* =========================================================
//    CREATE COVERAGE
// ========================================================= */

// async function createCoverage(
//   conn,
//   payment,
//   receipt,
//   payload
// ) {

//   if (
//     payment.category !==
//     "membership"
//   ) {
//     return;
//   }

//   const coverageTables = [
//     "tbl_member_membership_coverage",
//     "tbl_finance_membership_coverage",
//     "tbl_membership_coverage",
//   ];

//  const nextCoverage =
//   await findNextUnpaidMonth(
//     conn,
//     payment.member_id
//   );

// const months =
//   buildCoverageMonths(
//     nextCoverage.year,
//     nextCoverage.month,
//     payment.months_paid
//   );
//   for (const table of coverageTables) {

//     if (
//       !(
//         await tableExists(
//           conn,
//           table
//         )
//       )
//     ) {
//       continue;
//     }

//  for (const row of months) {

//   await insertDynamic(
//     conn,
//     table,
//     {
//       member_id:
//         payment.member_id,

//       payment_id:
//         payment.id,

//       receipt_id:
//         receipt.id,

//       coverage_year:
//         row.coverage_year,

//       coverage_month:
//         row.coverage_month,

//       coverage_month_name:
//         row.month_name,

//       month_number:
//         row.month_number,

//       month_name:
//         row.month_name,

//       plan_id:
//         payload.plan_id || null,

//       status:
//         "paid",

//       amount:
//         Number(payment.amount || 0) /
//         Math.max(months.length, 1),

//       payment_number:
//         payment.payment_number,

//       receipt_number:
//         receipt.receipt_number,

//       method:
//         payment.method,

//       created_by:
//         payload.actor_id,

//       created_at:
//         new Date(),

//       updated_at:
//         new Date(),
//     }
//   );
// }
//     return;
//   }
// }

// /* =========================================================
//    LIST PAYMENTS
// ========================================================= */

// router.get(
//   "/",
//   async (req, res) => {

//     try {

//       const page =
//         toInt(
//           req.query.page,
//           1
//         );

//       const limit =
//         Math.min(
//           100,
//           toInt(
//             req.query.limit,
//             25
//           )
//         );

//       const offset =
//         (page - 1) *
//         limit;

//       const search =
//         clean(
//           req.query.search
//         );

//      const paymentType =
// clean(
// req.query.payment_type ||
// req.query.category
// );

// const status =
// clean(req.query.status);

// const method =
// clean(req.query.method);

// const source =
// clean(req.query.source);

// const donationCategory =
// clean(req.query.donation_category);

// const coverageYear =
// clean(req.query.coverage_year);

// const dateFrom =
// clean(req.query.date_from);

// const dateTo =
// clean(req.query.date_to);

// const invoiceNumber =
// clean(req.query.invoice_number);

// const receiptNumber =
// clean(req.query.receipt_number);

//       const where = [];
//       const params = [];

//       if (search) {

//         where.push(`
//           (
//             p.payment_number LIKE ?
//             OR p.full_name_snapshot LIKE ?
//             OR p.email_snapshot LIKE ?
//             OR p.reference_no LIKE ?
//             OR r.receipt_number LIKE ?
//             OR i.invoice_number LIKE ?
//           )
//         `);

//         const q =
//           `%${search}%`;

//         params.push(
//           q,
//           q,
//           q,
//           q,
//           q,
//           q
//         );
//       }

//      if (paymentType) {

// where.push(`
// (
// p.category = ?
// OR p.payment_type = ?
// )
// `);

// params.push(
// paymentType,
// paymentType
// );
// }
// if (donationCategory) {

// where.push(
// "p.donation_category = ?"
// );

// params.push(
// donationCategory
// );
// }
// if (coverageYear) {

// where.push(
// "p.coverage_year = ?"
// );

// params.push(
// coverageYear
// );
// }
// if (source) {

// if (
// source === "online"
// ) {

// where.push(`
// (
// p.provider='stripe'
// OR p.method='card'
// OR p.method='ach'
// )
// `);
// }

// if (
// source === "in_person"
// ) {

// where.push(`
// (
// p.method IN
// ('cash','check','zelle')
// )
// `);
// }
// }
// if (invoiceNumber) {

// where.push(
// "i.invoice_number LIKE ?"
// );

// params.push(
// `%${invoiceNumber}%`
// );
// }
// if (receiptNumber) {

// where.push(
// "r.receipt_number LIKE ?"
// );

// params.push(
// `%${receiptNumber}%`
// );
// }
// if (dateFrom) {

// where.push(
// "DATE(p.paid_at)>=?"
// );

// params.push(dateFrom);
// }

// if (dateTo) {

// where.push(
// "DATE(p.paid_at)<=?"
// );

// params.push(dateTo);
// }
//       if (status) {
//         where.push(
//           "p.status = ?"
//         );

//         params.push(status);
//       }

//       if (method) {
//         where.push(
//           "p.method = ?"
//         );

//         params.push(method);
//       }

//       const whereSql =
//         where.length
//           ? `WHERE ${where.join(" AND ")}`
//           : "";

//       const [[countRow]] =
//         await pool.query(
//           `
//           SELECT
//             COUNT(*) AS total
//           FROM tbl_finance_payments p

//           LEFT JOIN tbl_finance_receipts r
//             ON r.payment_id = p.id

//           LEFT JOIN tbl_finance_invoices i
//             ON i.payment_id = p.id

//           ${whereSql}
//           `,
//           params
//         );

//       const [rows] =
//         await pool.query(
//           `
//           SELECT
//             p.*,

//             r.id AS receipt_id,
//             r.receipt_number,
//             r.email_status,
//             r.emailed_at,

//             i.id AS invoice_id,
//             i.invoice_number,
//             i.balance_due

//           FROM tbl_finance_payments p

//           LEFT JOIN tbl_finance_receipts r
//             ON r.payment_id = p.id

//           LEFT JOIN tbl_finance_invoices i
//             ON i.payment_id = p.id

//           ${whereSql}

//           ORDER BY
//             COALESCE(
//               p.paid_at,
//               p.created_at
//             ) DESC,
//             p.id DESC

//           LIMIT ?
//           OFFSET ?
//           `,
//           [
//             ...params,
//             limit,
//             offset,
//           ]
//         );

//       const [[summary]] =
//         await pool.query(
//           `
//           SELECT

//             COUNT(*) AS total_transactions,

//             COALESCE(
//               SUM(p.amount),
//               0
//             ) AS total_amount,

//             COALESCE(
//               SUM(
//                 CASE
//                   WHEN p.category = 'membership'
//                   THEN p.amount
//                   ELSE 0
//                 END
//               ),
//               0
//             ) AS membership_amount,

//             COALESCE(
//               SUM(
//                 CASE
//                   WHEN p.category = 'donation'
//                   THEN p.amount
//                   ELSE 0
//                 END
//               ),
//               0
//             ) AS donation_amount

//           FROM tbl_finance_payments p

//           LEFT JOIN tbl_finance_receipts r
//             ON r.payment_id = p.id

//           LEFT JOIN tbl_finance_invoices i
//             ON i.payment_id = p.id

//           ${whereSql}
//           `,
//           params
//         );

//       return res.json({
//         ok: true,

//         rows,

//         pagination: {
//           page,
//           limit,

//           total:
//             Number(
//               countRow.total || 0
//             ),

//           pages:
//             Math.ceil(
//               Number(
//                 countRow.total || 0
//               ) / limit
//             ),
//         },

//         summary,
//       });

//     } catch (err) {

//       console.error(
//         "GET /finance/payments error:",
//         err
//       );

//       return res.status(500).json({
//         error:
//           "Failed to load payments.",
//       });
//     }
//   }
// );

// /* =========================================================
//    CREATE PAYMENT
// ========================================================= */

// router.post(
//   "/",
//   async (req, res) => {

//     const conn =
//       await pool.getConnection();

//     try {

//       await conn.beginTransaction();

//       const body =
//         req.body || {};

//       const category =
//         clean(
//           body.category ||
//           body.payment_type ||
//           "donation"
//         );

//       const method =
//         clean(
//           body.method || "manual"
//         );

//       const provider =
//         clean(
//           body.provider || method
//         );

//       const memberId =
//         body.member_id
//           ? Number(
//               body.member_id
//             )
//           : null;

//       const member =
//         await getMemberSnapshot(
//           conn,
//           memberId
//         );

//       const fullName =
//         member?.full_name ||
//         clean(
//           body.full_name
//         ) ||
//         "Guest";

//       const email =
//         member?.email ||
//         clean(body.email) ||
//         null;

//       const phone =
//         member?.phone ||
//         clean(body.phone) ||
//         null;

//       const amount =
//         toMoney(body.amount);

//       const paymentNumber =
//         makeCode("PAY");

//       const monthsPaid =
//         toInt(
//           body.months_paid,
//           1
//         );
// const coverageYear = null;
// const coverageStartMonth = null;

//       const paymentId =
//         await insertDynamic(
//           conn,
//           "tbl_finance_payments",
//           {
//             payment_number:
//               paymentNumber,

//             member_id:
//               memberId,

//             member_no:
//               member?.member_no ||
//               null,

//             full_name_snapshot:
//               fullName,

//             email_snapshot:
//               email,

//             phone_snapshot:
//               phone,

//             category,

//             payment_type:
//               category,

//             sub_category:
//               body.sub_category ||
//               null,

//             amount,

//             currency:
//               body.currency ||
//               "USD",

//             months_paid:
//               category ===
//               "membership"
//                 ? monthsPaid
//                 : 0,

//             method,

//             provider,

//             status:
//               body.status ||
//               "paid",

//             reference_no:
//               body.reference_no ||
//               null,

//             description:
//               body.description ||
//               category,

//             paid_at:
//               new Date(),

//             created_at:
//               new Date(),

//             updated_at:
//               new Date(),
//           }
//         );

//       const payment = {
//   id: paymentId,
//   payment_number: paymentNumber,

//   member_id: memberId,
//   member_no: member?.member_no || null,

//   full_name_snapshot: fullName,
//   email_snapshot: email,
//   phone_snapshot: phone,

//   category,
//   sub_category: body.sub_category || null,
//   description: body.description || category,

//   amount,
//   method,
//   provider,
//   reference_no: body.reference_no || null,

//   months_paid: monthsPaid,
// };
//      const actorPayload = {
//   ...body,

//   actor_id:
//     req.user?.id ||
//     req.user?.user_id ||
//     null,

//   member_id:
//     memberId,
// };
//       const invoice =
//         await createInvoice(
//           conn,
//           payment,
//           actorPayload
//         );

//       const receipt =
//         await createReceipt(
//           conn,
//           payment,
//           invoice,
//           actorPayload
//         );

//       await updateDynamic(
//         conn,
//         "tbl_finance_payments",
//         {
//           related_invoice_id:
//             invoice.id,

//           related_receipt_id:
//             receipt.id,

//           updated_at:
//             new Date(),
//         },
//         "id = ?",
//         [payment.id]
//       );

//       await createLedgerEntry(
//         conn,
//         payment,
//         invoice,
//         receipt,
//         actorPayload
//       );

//       await createCoverage(
//         conn,
//         payment,
//         receipt,
//         actorPayload
//       );

//       await conn.commit();
// try {
//   if (
//     receipt?.id &&
//     email
//   ) {
//     await sendReceiptEmail(
//       receipt.id,
//       {
//         email,
//       }
//     );
//   }
// } catch (emailErr) {
//   console.error(
//     "Manual payment receipt email failed:",
//     emailErr
//   );
// }
//       return res.status(201).json({
//         ok: true,

//         message:
//           "Payment created successfully.",

//         payment_id:
//           paymentId,

//         payment_number:
//           paymentNumber,

//         invoice,

//         receipt,
//       });

//     } catch (err) {

//       await conn.rollback();

//       console.error(
//         "POST /finance/payments error:",
//         err
//       );

//       return res.status(400).json({
//         error:
//           err.message ||
//           "Failed to create payment.",
//       });

//     } finally {

//       conn.release();
//     }
//   }
// );

// /* =========================================================
//    CAMPAIGNS
// ========================================================= */

// router.get(
//   "/campaigns",
//   async (_req, res) => {

//     return res.json({
//       ok: true,
//       rows: [],
//     });
//   }
// );

// /* =========================================================
//    SINGLE PAYMENT
// ========================================================= */

// router.get(
//   "/:id",
//   async (req, res) => {

//     try {

//       const [[row]] =
//         await pool.query(
//           `
//           SELECT
//             p.*,

//             r.receipt_number,
//             r.email_status,
//             r.emailed_at,

//             i.invoice_number,
//             i.balance_due

//           FROM tbl_finance_payments p

//           LEFT JOIN tbl_finance_receipts r
//             ON r.payment_id = p.id

//           LEFT JOIN tbl_finance_invoices i
//             ON i.payment_id = p.id

//           WHERE p.id = ?
//           LIMIT 1
//           `,
//           [req.params.id]
//         );

//       if (!row) {

//         return res.status(404).json({
//           error:
//             "Payment not found.",
//         });
//       }

//       return res.json({
//         ok: true,
//         payment: row,
//       });

//     } catch (err) {

//       console.error(
//         "GET /finance/payments/:id error:",
//         err
//       );

//       return res.status(500).json({
//         error:
//           "Failed to load payment.",
//       });
//     }
//   }
// );

// /* =========================================================
//    EXPORTS
// ========================================================= */

// module.exports =
//   router;

// backend/routes/financePayments.js

"use strict";

/* =========================================================
   ENTERPRISE FINANCE PAYMENTS ROUTES
========================================================= */

const express = require("express");
const crypto = require("crypto");

const pool = require("../db");

const {
  sendReceiptEmail,
} = require("../services/domains/receipts/receiptEmailService");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();

/* =========================================================
   SECURITY
========================================================= */

router.use(authRequired);
router.use(requireRole("finance", "admin", "super_admin"));

/* =========================================================
   CACHE
========================================================= */

const columnCache = new Map();
const tableCache = new Map();

/* =========================================================
   HELPERS
========================================================= */

function clean(value) {
  return String(value ?? "").trim();
}

function toInt(value, fallback = 1) {
  const n = Number(value);

  return Number.isFinite(n) && n > 0
    ? Math.trunc(n)
    : fallback;
}

function toMoney(value) {
  const n = Number(value || 0);

  return Number.isFinite(n)
    ? Number(n.toFixed(2))
    : 0;
}

function makeCode(prefix) {
  return `${prefix}-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
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
  ][Number(month)] || String(month || "");
}

function isTruthy(value) {
  return ["true", "1", "yes", "on"].includes(
    String(value || "").toLowerCase()
  );
}

async function tableExists(conn, tableName) {
  if (tableCache.has(tableName)) {
    return tableCache.get(tableName);
  }

  try {
    const [rows] = await conn.query(
      `SHOW TABLES LIKE ?`,
      [tableName]
    );

    const exists = rows.length > 0;

    tableCache.set(tableName, exists);

    return exists;
  } catch {
    tableCache.set(tableName, false);
    return false;
  }
}

async function getColumns(conn, tableName) {
  if (columnCache.has(tableName)) {
    return columnCache.get(tableName);
  }

  const exists = await tableExists(conn, tableName);

  if (!exists) {
    const empty = new Set();
    columnCache.set(tableName, empty);
    return empty;
  }

  const [rows] = await conn.query(
    `SHOW COLUMNS FROM \`${tableName}\``
  );

  const cols = new Set(rows.map((r) => r.Field));

  columnCache.set(tableName, cols);

  return cols;
}

async function insertDynamic(conn, tableName, data) {
  const cols = await getColumns(conn, tableName);

  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) {
    return null;
  }

  const fields = entries.map(([key]) => `\`${key}\``).join(", ");
  const marks = entries.map(() => "?").join(", ");
  const values = entries.map(([, value]) => value);

  const [result] = await conn.query(
    `
    INSERT INTO \`${tableName}\`
    (${fields})
    VALUES (${marks})
    `,
    values
  );

  return result.insertId;
}

async function updateDynamic(
  conn,
  tableName,
  data,
  whereSql,
  whereParams = []
) {
  const cols = await getColumns(conn, tableName);

  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) {
    return;
  }

  const setSql = entries
    .map(([key]) => `\`${key}\` = ?`)
    .join(", ");

  const values = entries.map(([, value]) => value);

  await conn.query(
    `
    UPDATE \`${tableName}\`
    SET ${setSql}
    WHERE ${whereSql}
    `,
    [...values, ...whereParams]
  );
}

/* =========================================================
   MEMBER SNAPSHOT
========================================================= */

async function getMemberSnapshot(conn, memberId) {
  if (!memberId) return null;

  const [[member]] = await conn.query(
    `
    SELECT
      id,
      member_no,
      full_name,
      email,
      phone,
      membership_status
    FROM tbl_members
    WHERE id = ?
    LIMIT 1
    `,
    [memberId]
  );

  return member || null;
}

/* =========================================================
   COVERAGE HELPERS
========================================================= */

async function findNextUnpaidMonth(conn, memberId) {
  const now = new Date();

  if (!memberId) {
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    };
  }

  const [rows] = await conn.query(
    `
    SELECT
      coverage_year,
      month_number
    FROM tbl_member_membership_coverage
    WHERE member_id = ?
      AND status IN ('paid', 'completed', 'posted')
    ORDER BY coverage_year DESC, month_number DESC
    LIMIT 1
    `,
    [memberId]
  );

  if (!rows.length) {
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    };
  }

  let year = Number(rows[0].coverage_year);
  let month = Number(rows[0].month_number) + 1;

  if (month > 12) {
    month = 1;
    year += 1;
  }

  return { year, month };
}

function buildCoverageMonths(startYear, startMonth, monthsPaid) {
  const rows = [];

  const year = Number(startYear) || new Date().getFullYear();
  const month = Number(startMonth) || 1;
  const count = Number(monthsPaid) || 1;

  for (let i = 0; i < count; i += 1) {
    const d = new Date(year, month - 1 + i, 1);

    rows.push({
      coverage_year: d.getFullYear(),
      month_number: d.getMonth() + 1,
      month_name: d.toLocaleString("en-US", {
        month: "long",
      }),
      coverage_month: `${d.getFullYear()}-${String(
        d.getMonth() + 1
      ).padStart(2, "0")}`,
    });
  }

  return rows;
}

function parseCoverageMonthsFromPayload(payload = {}) {
  if (!payload.coverage_months_json) return [];

  try {
    const parsed = JSON.parse(payload.coverage_months_json);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((row) => {
        const year = Number(row.year || payload.coverage_year || 0);
        const monthNumber = Number(
          row.month_number ||
            row.monthNumber ||
            row.month ||
            0
        );

        if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) {
          return null;
        }

        return {
          coverage_year: year,
          month_number: monthNumber,
          month_name: monthName(monthNumber),
          coverage_month: `${year}-${String(monthNumber).padStart(2, "0")}`,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/* =========================================================
   CREATE INVOICE
========================================================= */

async function createInvoice(conn, payment, payload) {
  const invoiceNumber = makeCode("INV");

  const invoiceId = await insertDynamic(
    conn,
    "tbl_finance_invoices",
    {
      invoice_number: invoiceNumber,
      payment_id: payment.id,

      member_id: payment.member_id,
      member_no: payment.member_no,

      full_name_snapshot: payment.full_name_snapshot,
      email_snapshot: payment.email_snapshot,
      phone_snapshot: payment.phone_snapshot,

      category: payment.category,
      payment_type: payment.category,
      sub_category: payment.sub_category,
      description: payment.description,

      total_amount: payment.amount,
      amount: payment.amount,
      paid_amount: payment.amount,
      balance_due: 0,

      status: "paid",
      payment_status: "paid",

      due_date: new Date(),
      invoice_date: new Date(),
      paid_at: new Date(),

      created_by: payload.actor_id,
      created_at: new Date(),
      updated_at: new Date(),
    }
  );

  return {
    id: invoiceId,
    invoice_number: invoiceNumber,
  };
}

/* =========================================================
   CREATE RECEIPT
========================================================= */

async function createReceipt(conn, payment, invoice, payload) {
  const receiptNumber = makeCode("RCPT");

  const receiptId = await insertDynamic(
    conn,
    "tbl_finance_receipts",
    {
      receipt_number: receiptNumber,

      payment_id: payment.id,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,

      member_id: payment.member_id,
      member_no: payment.member_no,

      full_name_snapshot: payment.full_name_snapshot,
      email_snapshot: payment.email_snapshot,
      phone_snapshot: payment.phone_snapshot,

      category: payment.category,
      payment_type: payment.category,
      sub_category: payment.sub_category,
      description: payment.description,

      amount: payment.amount,

      method: payment.method,
      provider: payment.provider,
      reference_no: payment.reference_no,

      email_status: payment.email_snapshot
        ? "pending"
        : "not_requested",

      emailed_to: payment.email_snapshot || null,

      receipt_date: new Date(),
      issued_at: new Date(),

      created_by: payload.actor_id,
      created_at: new Date(),
      updated_at: new Date(),
    }
  );

  return {
    id: receiptId,
    receipt_number: receiptNumber,
  };
}

/* =========================================================
   CREATE LEDGER
========================================================= */

async function createLedgerEntry(conn, payment, invoice, receipt, payload) {
  const tables = [
    "tbl_finance_member_ledger",
    "tbl_finance_ledger",
    "tbl_finance_ledger_entries",
    "tbl_member_ledger",
  ];

  const ledgerUuid = makeCode("LEDGER");

  for (const table of tables) {
    if (!(await tableExists(conn, table))) continue;

    await insertDynamic(conn, table, {
      ledger_uuid: ledgerUuid,
      ledger_number: ledgerUuid,

      member_id: payment.member_id,
      member_no: payment.member_no || null,

      full_name_snapshot: payment.full_name_snapshot || null,
      phone_snapshot: payment.phone_snapshot || null,

      record_type: "payment",
      ledger_type: "payment",
      entry_type: "payment",

      related_document_type: "receipt",
      related_document_id: receipt.id,
      related_document_number: receipt.receipt_number,

      payment_id: payment.id,
      invoice_id: invoice.id,
      receipt_id: receipt.id,

      payment_number: payment.payment_number,
      invoice_number: invoice.invoice_number,
      receipt_number: receipt.receipt_number,

      record_date: new Date(),

      category: payment.category,
      payment_type: payment.category,
      sub_category: payment.sub_category,

      description:
        payment.description ||
        `${payment.category || "payment"} payment`,

      debit: 0,
      credit: payment.amount,
      debit_amount: 0,
      credit_amount: payment.amount,

      amount: payment.amount,
      running_balance: 0,

      method: payment.method,
      provider: payment.provider,

      source: "finance_manual_payment",
      source_reference: payment.payment_number,

      reference_no: payment.reference_no,

      status: "posted",

      posted_by: payload.actor_id,
      created_by: payload.actor_id,

      posted_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    });

    return;
  }
}

/* =========================================================
   CREATE MEMBERSHIP COVERAGE
========================================================= */

async function createCoverage(conn, payment, receipt, payload) {
  if (payment.category !== "membership") return;
  if (!payment.member_id) return;

  const coverageTables = [
    "tbl_member_membership_coverage",
    "tbl_finance_membership_coverage",
    "tbl_membership_coverage",
  ];

  let months = parseCoverageMonthsFromPayload(payload);

  if (!months.length && payload.coverage_year && payload.coverage_start_month) {
    months = buildCoverageMonths(
      payload.coverage_year,
      payload.coverage_start_month,
      payment.months_paid
    );
  }

  if (!months.length) {
    const nextCoverage = await findNextUnpaidMonth(
      conn,
      payment.member_id
    );

    months = buildCoverageMonths(
      nextCoverage.year,
      nextCoverage.month,
      payment.months_paid
    );
  }

  for (const table of coverageTables) {
    if (!(await tableExists(conn, table))) continue;

    for (const row of months) {
      const amountPerMonth = toMoney(
        Number(payment.amount || 0) /
          Math.max(months.length, 1)
      );

      try {
        await insertDynamic(conn, table, {
          member_id: payment.member_id,

          payment_id: payment.id,
          receipt_id: receipt.id,
          invoice_id: payment.invoice_id || null,

          coverage_year: row.coverage_year,
          coverage_month: row.coverage_month,
          coverage_month_name: row.month_name,
          month_number: row.month_number,
          month_name: row.month_name,
          coverage_key: row.coverage_month,

          plan_id: payload.plan_id || payload.dues_plan_id || null,
          plan_name: payload.plan_name || null,

          status: "paid",

          amount: amountPerMonth,

          payment_number: payment.payment_number,
          receipt_number: receipt.receipt_number,
          invoice_number: payment.invoice_number || null,

          method: payment.method,
          provider: payment.provider,

          created_by: payload.actor_id,
          created_at: new Date(),
          updated_at: new Date(),
        });
      } catch (err) {
        await conn
          .query(
            `
            UPDATE ${table}
            SET
              payment_id = ?,
              receipt_id = ?,
              status = 'paid',
              amount = ?,
              payment_number = ?,
              receipt_number = ?,
              method = ?,
              provider = ?,
              updated_at = NOW()
            WHERE member_id = ?
              AND coverage_year = ?
              AND month_number = ?
            `,
            [
              payment.id,
              receipt.id,
              amountPerMonth,
              payment.payment_number,
              receipt.receipt_number,
              payment.method,
              payment.provider,
              payment.member_id,
              row.coverage_year,
              row.month_number,
            ]
          )
          .catch(() => {});
      }
    }

    return;
  }
}

// /* =========================================================
//    LIST PAYMENTS
// ========================================================= */

// router.get("/", async (req, res) => {
//   try {
//     const page = toInt(req.query.page, 1);
//     const limit = Math.min(
//       100,
//       toInt(req.query.limit || req.query.pageSize, 25)
//     );
//     const offset = (page - 1) * limit;

//     const search = clean(req.query.search || req.query.q);

//     const paymentType = clean(
//       req.query.payment_type ||
//         req.query.category ||
//         req.query.type
//     );

//     const status = clean(req.query.status);
//     const method = clean(req.query.method);
//     const provider = clean(req.query.provider);
//     const source = clean(req.query.source);
//     const donationCategory = clean(req.query.donation_category);
//     const coverageYear = clean(req.query.coverage_year);
//     const dateFrom = clean(req.query.date_from);
//     const dateTo = clean(req.query.date_to);
//     const invoiceNumber = clean(req.query.invoice_number);
//     const receiptNumber = clean(req.query.receipt_number);
//     const memberId = clean(req.query.member_id);
//     const minAmount = clean(req.query.amount_from);
//     const maxAmount = clean(req.query.amount_to);

//     const where = [];
//     const params = [];

//     if (search) {
//       where.push(`
//         (
//           p.payment_number LIKE ?
//           OR p.full_name_snapshot LIKE ?
//           OR p.email_snapshot LIKE ?
//           OR p.phone_snapshot LIKE ?
//           OR p.reference_no LIKE ?
//           OR r.receipt_number LIKE ?
//           OR i.invoice_number LIKE ?
//         )
//       `);

//       const q = `%${search}%`;
//       params.push(q, q, q, q, q, q, q);
//     }

//     if (memberId) {
//       where.push("p.member_id = ?");
//       params.push(memberId);
//     }

//     if (paymentType) {
//       where.push(`
//         (
//           p.category = ?
//           OR p.payment_type = ?
//         )
//       `);

//       params.push(paymentType, paymentType);
//     }

//     if (status) {
//       where.push(`
//         (
//           p.status = ?
//           OR p.payment_status = ?
//         )
//       `);

//       params.push(status, status);
//     }

//     if (method) {
//       where.push(`
//         (
//           p.method = ?
//           OR p.payment_method = ?
//         )
//       `);

//       params.push(method, method);
//     }

//     if (provider) {
//       where.push(`
//         (
//           p.provider = ?
//           OR p.payment_provider = ?
//         )
//       `);

//       params.push(provider, provider);
//     }

//     if (donationCategory) {
//       where.push("p.donation_category = ?");
//       params.push(donationCategory);
//     }

//     if (coverageYear) {
//       where.push("p.coverage_year = ?");
//       params.push(coverageYear);
//     }

//     if (source === "online") {
//       where.push(`
//         (
//           p.provider = 'stripe'
//           OR p.payment_provider = 'stripe'
//           OR p.method IN ('card', 'ach')
//           OR p.payment_method IN ('card', 'ach')
//         )
//       `);
//     }

//     if (source === "in_person") {
//       where.push(`
//         (
//           p.method IN ('cash', 'check', 'zelle', 'manual')
//           OR p.payment_method IN ('cash', 'check', 'zelle', 'manual')
//         )
//       `);
//     }

//     if (invoiceNumber) {
//       where.push("i.invoice_number LIKE ?");
//       params.push(`%${invoiceNumber}%`);
//     }

//     if (receiptNumber) {
//       where.push("r.receipt_number LIKE ?");
//       params.push(`%${receiptNumber}%`);
//     }

//     if (dateFrom) {
//       where.push("DATE(COALESCE(p.paid_at, p.created_at)) >= ?");
//       params.push(dateFrom);
//     }

//     if (dateTo) {
//       where.push("DATE(COALESCE(p.paid_at, p.created_at)) <= ?");
//       params.push(dateTo);
//     }

//     if (minAmount) {
//       where.push("p.amount >= ?");
//       params.push(Number(minAmount));
//     }

//     if (maxAmount) {
//       where.push("p.amount <= ?");
//       params.push(Number(maxAmount));
//     }

//     const whereSql = where.length
//       ? `WHERE ${where.join(" AND ")}`
//       : "";

//     const [[countRow]] = await pool.query(
//       `
//       SELECT COUNT(DISTINCT p.id) AS total
//       FROM tbl_finance_payments p

//       LEFT JOIN tbl_finance_receipts r
//         ON r.payment_id = p.id

//       LEFT JOIN tbl_finance_invoices i
//         ON i.payment_id = p.id

//       ${whereSql}
//       `,
//       params
//     );

//     const [rows] = await pool.query(
//   `
//   SELECT
//     p.*,

//     r.id AS receipt_id,
//     r.receipt_number,
//     r.email_status,
//     r.emailed_at,

//     i.id AS invoice_id,
//     i.invoice_number,
//     i.balance_due

//   FROM tbl_finance_payments p

//   /* =====================================================
//      LATEST RECEIPT
//   ===================================================== */

//   LEFT JOIN (
//     SELECT
//       payment_id,
//       MAX(id) AS receipt_id
//     FROM tbl_finance_receipts
//     GROUP BY payment_id
//   ) latest_r
//     ON latest_r.payment_id = p.id

//   LEFT JOIN tbl_finance_receipts r
//     ON r.id = latest_r.receipt_id

//   /* =====================================================
//      LATEST INVOICE
//   ===================================================== */

//   LEFT JOIN (
//     SELECT
//       payment_id,
//       MAX(id) AS invoice_id
//     FROM tbl_finance_invoices
//     GROUP BY payment_id
//   ) latest_i
//     ON latest_i.payment_id = p.id

//   LEFT JOIN tbl_finance_invoices i
//     ON i.id = latest_i.invoice_id

//   ${whereSql}

//   ORDER BY
//     COALESCE(p.paid_at, p.created_at) DESC,
//     p.id DESC

//   LIMIT ?
//   OFFSET ?
//   `,
//   [...params, limit, offset]
// );
//     const [[summary]] = await pool.query(
//       `
//       SELECT
//         COUNT(DISTINCT p.id) AS total_transactions,

//         COALESCE(SUM(p.amount), 0) AS total_amount,

//         COALESCE(
//           SUM(
//             CASE
//               WHEN p.category = 'membership'
//                 OR p.payment_type = 'membership'
//               THEN p.amount
//               ELSE 0
//             END
//           ),
//           0
//         ) AS membership_amount,

//         COALESCE(
//           SUM(
//             CASE
//               WHEN p.category = 'donation'
//                 OR p.payment_type = 'donation'
//               THEN p.amount
//               ELSE 0
//             END
//           ),
//           0
//         ) AS donation_amount,

//         COALESCE(
//           SUM(
//             CASE
//               WHEN p.category IN ('school', 'trip')
//                 OR p.payment_type IN ('school', 'trip')
//               THEN p.amount
//               ELSE 0
//             END
//           ),
//           0
//         ) AS program_amount,

//         COALESCE(
//           SUM(
//             CASE
//               WHEN p.method = 'cash'
//                 OR p.payment_method = 'cash'
//               THEN p.amount
//               ELSE 0
//             END
//           ),
//           0
//         ) AS cash_amount,

//         COALESCE(
//           SUM(
//             CASE
//               WHEN p.method = 'check'
//                 OR p.payment_method = 'check'
//               THEN p.amount
//               ELSE 0
//             END
//           ),
//           0
//         ) AS check_amount,

//         COALESCE(
//           SUM(
//             CASE
//               WHEN p.method = 'zelle'
//                 OR p.payment_method = 'zelle'
//               THEN p.amount
//               ELSE 0
//             END
//           ),
//           0
//         ) AS zelle_amount,

//         COALESCE(
//           SUM(
//             CASE
//               WHEN p.method = 'card'
//                 OR p.payment_method = 'card'
//               THEN p.amount
//               ELSE 0
//             END
//           ),
//           0
//         ) AS card_amount,

//         COALESCE(
//           SUM(
//             CASE
//               WHEN p.method = 'ach'
//                 OR p.payment_method = 'ach'
//               THEN p.amount
//               ELSE 0
//             END
//           ),
//           0
//         ) AS ach_amount

//       FROM tbl_finance_payments p

//       LEFT JOIN tbl_finance_receipts r
//         ON r.payment_id = p.id

//       LEFT JOIN tbl_finance_invoices i
//         ON i.payment_id = p.id

//       ${whereSql}
//       `,
//       params
//     );

//     return res.json({
//       ok: true,
//       rows,
//       pagination: {
//         page,
//         limit,
//         total: Number(countRow.total || 0),
//         pages: Math.max(
//           1,
//           Math.ceil(Number(countRow.total || 0) / limit)
//         ),
//       },
//       summary,
//       total: Number(countRow.total || 0),
//       page,
//       limit,
//       totalPages: Math.max(
//         1,
//         Math.ceil(Number(countRow.total || 0) / limit)
//       ),
//     });
//   } catch (err) {
//     console.error("GET /finance/payments error:", err);

//     return res.status(500).json({
//       ok: false,
//       error: err.message || "Failed to load payments.",
//     });
//   }
// });
/* =========================================================
   LIST PAYMENTS
========================================================= */

router.get("/", async (req, res) => {
  try {
    const page = toInt(req.query.page, 1);

    const limit = Math.min(
      100,
      toInt(
        req.query.limit ||
          req.query.pageSize,
        25
      )
    );

    const offset = (page - 1) * limit;

    const search = clean(
      req.query.search ||
        req.query.q
    );

    const paymentType = clean(
      req.query.payment_type ||
        req.query.category ||
        req.query.type
    );

    const status = clean(req.query.status);
    const method = clean(req.query.method);
    const provider = clean(req.query.provider);
    const source = clean(req.query.source);

    const donationCategory = clean(
      req.query.donation_category
    );

    const coverageYear = clean(
      req.query.coverage_year
    );

    const dateFrom = clean(req.query.date_from);
    const dateTo = clean(req.query.date_to);

    const invoiceNumber = clean(
      req.query.invoice_number
    );

    const receiptNumber = clean(
      req.query.receipt_number
    );

    const memberId = clean(req.query.member_id);
    const minAmount = clean(req.query.amount_from);
    const maxAmount = clean(req.query.amount_to);

    const where = [];
    const params = [];

    /* =====================================================
       SEARCH
    ===================================================== */

    if (search) {
      where.push(`
        (
          p.payment_number LIKE ?
          OR p.full_name_snapshot LIKE ?
          OR p.email_snapshot LIKE ?
          OR p.phone_snapshot LIKE ?
          OR p.member_no LIKE ?
          OR p.reference_no LIKE ?
          OR r.receipt_number LIKE ?
          OR i.invoice_number LIKE ?
        )
      `);

      const q = `%${search}%`;

      params.push(
        q,
        q,
        q,
        q,
        q,
        q,
        q,
        q
      );
    }

    /* =====================================================
       FILTERS
    ===================================================== */

    if (memberId) {
      where.push("p.member_id = ?");
      params.push(memberId);
    }

    if (paymentType) {
      where.push(`
        (
          p.category = ?
          OR p.payment_type = ?
        )
      `);

      params.push(
        paymentType,
        paymentType
      );
    }

    if (status) {
      where.push(`
        (
          p.status = ?
          OR p.payment_status = ?
        )
      `);

      params.push(
        status,
        status
      );
    }

    if (method) {
      where.push(`
        (
          p.method = ?
          OR p.payment_method = ?
        )
      `);

      params.push(
        method,
        method
      );
    }

    if (provider) {
      where.push(`
        (
          p.provider = ?
          OR p.payment_provider = ?
        )
      `);

      params.push(
        provider,
        provider
      );
    }

    if (donationCategory) {
      where.push(`
        (
          p.donation_category = ?
          OR p.sub_category = ?
        )
      `);

      params.push(
        donationCategory,
        donationCategory
      );
    }

    if (coverageYear) {
      where.push("p.coverage_year = ?");
      params.push(coverageYear);
    }

    if (source === "online") {
      where.push(`
        (
          p.provider = 'stripe'
          OR p.payment_provider = 'stripe'
          OR p.method IN ('card', 'ach')
          OR p.payment_method IN ('card', 'ach')
        )
      `);
    }

    if (source === "in_person") {
      where.push(`
        (
          p.method IN ('cash', 'check', 'zelle', 'manual', 'bank_deposit')
          OR p.payment_method IN ('cash', 'check', 'zelle', 'manual', 'bank_deposit')
        )
      `);
    }

    if (invoiceNumber) {
      where.push("i.invoice_number LIKE ?");
      params.push(`%${invoiceNumber}%`);
    }

    if (receiptNumber) {
      where.push("r.receipt_number LIKE ?");
      params.push(`%${receiptNumber}%`);
    }

    if (dateFrom) {
      where.push(`

        DATE(
  COALESCE(
    p.paid_at,
    p.created_at
  )
) >= ?
      `);

      params.push(dateFrom);
    }

    if (dateTo) {
      where.push(`

       DATE(
  COALESCE(
    p.paid_at,
    p.created_at
  )
) <= ?
      `);

      params.push(dateTo);
    }

    if (minAmount) {
      where.push("p.amount >= ?");
      params.push(Number(minAmount));
    }

    if (maxAmount) {
      where.push("p.amount <= ?");
      params.push(Number(maxAmount));
    }

    const whereSql = where.length
      ? `WHERE ${where.join(" AND ")}`
      : "";

    /* =====================================================
       BASE JOIN
       Latest receipt/invoice only.
       Prevents duplicate rows and ONLY_FULL_GROUP_BY errors.
    ===================================================== */

    const baseJoinSql = `
      FROM tbl_finance_payments p

      LEFT JOIN (
        SELECT
          payment_id,
          MAX(id) AS receipt_id
        FROM tbl_finance_receipts
        GROUP BY payment_id
      ) latest_r
        ON latest_r.payment_id = p.id

      LEFT JOIN tbl_finance_receipts r
        ON r.id = latest_r.receipt_id

      LEFT JOIN (
        SELECT
          payment_id,
          MAX(id) AS invoice_id
        FROM tbl_finance_invoices
        GROUP BY payment_id
      ) latest_i
        ON latest_i.payment_id = p.id

      LEFT JOIN tbl_finance_invoices i
        ON i.id = latest_i.invoice_id
    `;

    /* =====================================================
       COUNT
    ===================================================== */

    const [[countRow]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total

      ${baseJoinSql}

      ${whereSql}
      `,
      params
    );

    /* =====================================================
       ROWS
    ===================================================== */

    const [rows] = await pool.query(
      `
      SELECT
        p.*,

        r.id AS receipt_id,
        r.receipt_number,
        r.email_status,
        r.emailed_at,
        r.emailed_to,

        i.id AS invoice_id,
        i.invoice_number,
        i.balance_due,
        i.status AS invoice_status

      ${baseJoinSql}

      ${whereSql}

     ORDER BY
  COALESCE(
    p.paid_at,
    p.created_at
  ) DESC,
  p.id DESC

      LIMIT ?
      OFFSET ?
      `,
      [
        ...params,
        limit,
        offset,
      ]
    );

    /* =====================================================
       SUMMARY
    ===================================================== */

    const [[summary]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_transactions,

        COALESCE(SUM(p.amount), 0) AS total_amount,

        COALESCE(
          SUM(
            CASE
              WHEN p.category = 'membership'
                OR p.payment_type = 'membership'
              THEN p.amount
              ELSE 0
            END
          ),
          0
        ) AS membership_amount,

        COALESCE(
          SUM(
            CASE
              WHEN p.category = 'donation'
                OR p.payment_type = 'donation'
              THEN p.amount
              ELSE 0
            END
          ),
          0
        ) AS donation_amount,

        COALESCE(
          SUM(
            CASE
              WHEN p.category IN ('school', 'trip')
                OR p.payment_type IN ('school', 'trip')
              THEN p.amount
              ELSE 0
            END
          ),
          0
        ) AS program_amount,

        COALESCE(
          SUM(
            CASE
              WHEN p.category = 'pledge'
                OR p.payment_type = 'pledge'
              THEN p.amount
              ELSE 0
            END
          ),
          0
        ) AS pledge_amount,

        COALESCE(
          SUM(
            CASE
              WHEN p.method = 'cash'
                OR p.payment_method = 'cash'
              THEN p.amount
              ELSE 0
            END
          ),
          0
        ) AS cash_amount,

        COALESCE(
          SUM(
            CASE
              WHEN p.method = 'check'
                OR p.payment_method = 'check'
              THEN p.amount
              ELSE 0
            END
          ),
          0
        ) AS check_amount,

        COALESCE(
          SUM(
            CASE
              WHEN p.method = 'zelle'
                OR p.payment_method = 'zelle'
              THEN p.amount
              ELSE 0
            END
          ),
          0
        ) AS zelle_amount,

        COALESCE(
          SUM(
            CASE
              WHEN p.method = 'card'
                OR p.payment_method = 'card'
              THEN p.amount
              ELSE 0
            END
          ),
          0
        ) AS card_amount,

        COALESCE(
          SUM(
            CASE
              WHEN p.method = 'ach'
                OR p.payment_method = 'ach'
              THEN p.amount
              ELSE 0
            END
          ),
          0
        ) AS ach_amount,

        COALESCE(
          SUM(
            CASE
              WHEN p.status = 'failed'
                OR p.payment_status = 'failed'
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS failed_count,

        COALESCE(
          SUM(
            CASE
              WHEN p.status = 'pending'
                OR p.payment_status = 'pending'
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS pending_count,

        COALESCE(
          SUM(
            CASE
              WHEN r.email_status = 'sent'
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS emailed_receipts

      ${baseJoinSql}

      ${whereSql}
      `,
      params
    );

    return res.json({
      ok: true,

      rows,

      pagination: {
        page,
        limit,
        total: Number(countRow.total || 0),
        pages: Math.max(
          1,
          Math.ceil(
            Number(countRow.total || 0) /
              limit
          )
        ),
      },

      summary,

      total: Number(countRow.total || 0),
      page,
      limit,
      totalPages: Math.max(
        1,
        Math.ceil(
          Number(countRow.total || 0) /
            limit
        )
      ),
    });
  } catch (err) {
    console.error(
      "GET /finance/payments error:",
      err
    );

    return res.status(500).json({
      ok: false,
      error:
        err.message ||
        "Failed to load payments.",
    });
  }
});
/* =========================================================
   CREATE PAYMENT
========================================================= */

router.post("/", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const body = req.body || {};

    const category = clean(
      body.category ||
        body.payment_type ||
        "donation"
    ).toLowerCase();

    const method = clean(
      body.method ||
        body.payment_method ||
        "manual"
    ).toLowerCase();

    const provider = clean(
      body.provider ||
        body.payment_provider ||
        method
    ).toLowerCase();

    const memberId = body.member_id
      ? Number(body.member_id)
      : null;

    const member = await getMemberSnapshot(conn, memberId);

    const fullName =
      member?.full_name ||
      clean(body.full_name) ||
      clean(body.name) ||
      "Guest";

    const email =
      member?.email ||
      clean(body.email) ||
      clean(body.email_snapshot) ||
      null;

    const phone =
      member?.phone ||
      clean(body.phone) ||
      clean(body.phone_snapshot) ||
      null;

    const amount = toMoney(
      body.amount ||
        body.total_amount ||
        body.paid_amount
    );

    if (amount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }

    if (category === "membership" && !memberId) {
      throw new Error("Membership payment requires a member.");
    }

    const paymentNumber = makeCode("PAY");
    const monthsPaid = toInt(body.months_paid || body.duration_months, 1);

    const paymentId = await insertDynamic(
      conn,
      "tbl_finance_payments",
      {
        payment_number: paymentNumber,

        member_id: memberId,
        member_no: member?.member_no || null,

        full_name_snapshot: fullName,
        email_snapshot: email,
        phone_snapshot: phone,

        payer_type: memberId ? "member" : "guest",

        category,
        payment_type: category,

        sub_category: body.sub_category || null,
        donation_category: body.donation_category || null,

        plan_id: body.plan_id || body.dues_plan_id || null,
        dues_plan_id: body.dues_plan_id || body.plan_id || null,
        plan_name: body.plan_name || null,

        amount,
        total_amount: amount,
        currency: body.currency || "USD",

        months_paid: category === "membership" ? monthsPaid : null,
        coverage_year: body.coverage_year || null,
        coverage_start_month: body.coverage_start_month || null,
        coverage_end_month: body.coverage_end_month || null,
        coverage_months_json: body.coverage_months_json || null,
        coverage_label: body.coverage_label || null,

        method,
        provider,
        payment_method: method,
        payment_provider: provider,

        status: body.status || "paid",
        payment_status: body.payment_status || body.status || "paid",

        reference_no: body.reference_no || null,
        description: body.description || category,

        paid_at: new Date(),
        created_by:
          req.user?.id ||
          req.user?.user_id ||
          null,
        created_at: new Date(),
        updated_at: new Date(),
      }
    );

    const payment = {
      id: paymentId,
      payment_number: paymentNumber,

      member_id: memberId,
      member_no: member?.member_no || null,

      full_name_snapshot: fullName,
      email_snapshot: email,
      phone_snapshot: phone,

      category,
      sub_category: body.sub_category || null,
      description: body.description || category,

      amount,
      method,
      provider,
      reference_no: body.reference_no || null,

      months_paid: monthsPaid,

      coverage_year: body.coverage_year || null,
      coverage_start_month: body.coverage_start_month || null,
      coverage_end_month: body.coverage_end_month || null,
      coverage_months_json: body.coverage_months_json || null,
      coverage_label: body.coverage_label || null,
    };

    const actorPayload = {
      ...body,
      actor_id:
        req.user?.id ||
        req.user?.user_id ||
        null,
      member_id: memberId,
    };

    const invoice = await createInvoice(conn, payment, actorPayload);

    payment.invoice_id = invoice.id;
    payment.invoice_number = invoice.invoice_number;

    const receipt = await createReceipt(
      conn,
      payment,
      invoice,
      actorPayload
    );

    await updateDynamic(
      conn,
      "tbl_finance_payments",
      {
        invoice_id: invoice.id,
        related_invoice_id: invoice.id,

        receipt_id: receipt.id,
        related_receipt_id: receipt.id,

        invoice_number: invoice.invoice_number,
        receipt_number: receipt.receipt_number,

        updated_at: new Date(),
      },
      "id = ?",
      [payment.id]
    );

    await createLedgerEntry(
      conn,
      payment,
      invoice,
      receipt,
      actorPayload
    );

    await createCoverage(
      conn,
      payment,
      receipt,
      actorPayload
    );

    await conn.commit();

    try {
      if (receipt?.id && email && body.send_receipt_email !== false) {
        await sendReceiptEmail(receipt.id, { email });
      }
    } catch (emailErr) {
      console.error(
        "Manual payment receipt email failed:",
        emailErr
      );
    }

    return res.status(201).json({
      ok: true,
      message: "Payment created successfully.",
      payment_id: paymentId,
      payment_number: paymentNumber,
      invoice,
      receipt,
    });
  } catch (err) {
    await conn.rollback();

    console.error("POST /finance/payments error:", err);

    return res.status(400).json({
      ok: false,
      error: err.message || "Failed to create payment.",
    });
  } finally {
    conn.release();
  }
});

/* =========================================================
   CAMPAIGNS PLACEHOLDER
========================================================= */

router.get("/campaigns", async (_req, res) => {
  return res.json({
    ok: true,
    rows: [],
  });
});

/* =========================================================
   SINGLE PAYMENT
========================================================= */

router.get("/:id", async (req, res) => {
  try {
    const [[row]] = await pool.query(
      `
      SELECT
        p.*,

        r.id AS receipt_id,
        r.receipt_number,
        r.email_status,
        r.emailed_at,
        r.emailed_to,

        i.id AS invoice_id,
        i.invoice_number,
        i.balance_due,
        i.status AS invoice_status,

        m.full_name,
        m.member_no,
        m.email,
        m.phone

      FROM tbl_finance_payments p

      LEFT JOIN (
        SELECT
          payment_id,
          MAX(id) AS receipt_id
        FROM tbl_finance_receipts
        GROUP BY payment_id
      ) latest_r
        ON latest_r.payment_id = p.id

      LEFT JOIN tbl_finance_receipts r
        ON r.id = latest_r.receipt_id

      LEFT JOIN (
        SELECT
          payment_id,
          MAX(id) AS invoice_id
        FROM tbl_finance_invoices
        GROUP BY payment_id
      ) latest_i
        ON latest_i.payment_id = p.id

      LEFT JOIN tbl_finance_invoices i
        ON i.id = latest_i.invoice_id

      LEFT JOIN tbl_members m
        ON m.id = p.member_id

      WHERE p.id = ?

      LIMIT 1
      `,
      [req.params.id]
    );

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: "Payment not found.",
      });
    }

    let coverage = [];

    try {
      const [coverageRows] = await pool.query(
        `
        SELECT
          coverage_year,
          month_number,
          month_name,
          status,
          payment_number
        FROM tbl_member_membership_coverage
        WHERE payment_number = ?
        ORDER BY coverage_year, month_number
        `,
        [row.payment_number]
      );

      coverage = coverageRows || [];
    } catch (err) {
      console.warn(
        "Coverage lookup skipped:",
        err.message
      );
    }

    return res.json({
      ok: true,

      payment: row,

      receipt: row.receipt_id
        ? {
            id: row.receipt_id,
            receipt_number: row.receipt_number,
            email_status: row.email_status,
            emailed_at: row.emailed_at,
            emailed_to: row.emailed_to,
          }
        : null,

      invoice: row.invoice_id
        ? {
            id: row.invoice_id,
            invoice_number: row.invoice_number,
            balance_due: row.balance_due,
            status: row.invoice_status,
          }
        : null,

      coverage,
    });
  } catch (err) {
    console.error(
      "GET /finance/payments/:id error:",
      err
    );

    return res.status(500).json({
      ok: false,
      error:
        err.message ||
        "Failed to load payment.",
    });
  }
});
/* =========================================================
   EXPORTS
========================================================= */

module.exports = router;