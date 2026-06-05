"use strict";

/*
=========================================================
 ENTERPRISE NUMBER GENERATOR
---------------------------------------------------------
 Centralized document numbering system

 Generates:
 - members
 - payments
 - invoices
 - receipts
 - ledger entries
 - subscriptions
 - reimbursements
=========================================================
*/

/* =========================================================
   HELPERS
========================================================= */

function pad(value, size = 6) {
  return String(value).padStart(size, "0");
}

function randomBlock(length = 6) {
  return Math.random()
    .toString(36)
    .slice(2, 2 + length)
    .toUpperCase();
}

function timestampPart() {
  return Date.now();
}

/* =========================================================
   BASE GENERATOR
========================================================= */

function generateNumber(prefix) {
  return [
    prefix,
    timestampPart(),
    randomBlock(6),
  ].join("-");
}

/* =========================================================
   MEMBER NUMBER
========================================================= */

async function generateMemberNumber(conn) {

  const [[row]] = await conn.query(`
    SELECT id
    FROM tbl_members
    ORDER BY id DESC
    LIMIT 1
  `);

  const nextId =
    Number(row?.id || 0) + 1;

  return `M-${String(nextId)
    .padStart(5, "0")}`;
}

/* =========================================================
   PAYMENT
========================================================= */

function generatePaymentNumber() {
  return generateNumber("PAY");
}

/* =========================================================
   INVOICE
========================================================= */

function generateInvoiceNumber() {
  return generateNumber("INV");
}

/* =========================================================
   RECEIPT
========================================================= */

function generateReceiptNumber() {
  return generateNumber("RCPT");
}

/* =========================================================
   LEDGER
========================================================= */

function generateLedgerNumber() {
  return generateNumber("LEDGER");
}

/* =========================================================
   SUBSCRIPTION
========================================================= */

function generateSubscriptionNumber() {
  return generateNumber("SUB");
}

/* =========================================================
   REIMBURSEMENT
========================================================= */

function generateReimbursementNumber() {
  return generateNumber("RMB");
}

/* =========================================================
   CERTIFICATE
========================================================= */

function generateCertificateNumber(type = "CERT") {

  return generateNumber(
    type
      .replaceAll("_", "")
      .toUpperCase()
      .slice(0, 10)
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  generateNumber,

  generateMemberNumber,

  generatePaymentNumber,

  generateInvoiceNumber,

  generateReceiptNumber,

  generateLedgerNumber,

  generateSubscriptionNumber,

  generateReimbursementNumber,

  generateCertificateNumber,
};