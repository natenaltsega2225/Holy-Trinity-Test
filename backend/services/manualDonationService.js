"use strict";

const pool = require("../db");
const crypto = require("crypto");

const {
  insertExistingColumns,
  updateExistingColumns,
} = require("./ledgerService");

const {
  generateReceiptPdfBuffer,
} = require("./pdfService");

const {
  sendReceiptEmail,
} = require("./emailService");

function money(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function clean(v, max = 255) {
  return String(v ?? "").trim().slice(0, max);
}

function mysqlNow() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function generateNumber(prefix) {
  return `${prefix}-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

const DONATION_CATEGORIES = {
  plate_collection: "መባ — Plate Collection",
  candle_sale: "ሻማ — Candle Sale",
  general_donation: "ስጦታ — General Donation",
  tithe: "አስራት — Tithe",
  vows: "ስዕለት — Vows",
  baptism: "ክርስትና — Baptism",
  wedding_engagement: "ጋብቻ / ቀለበት — Wedding / Engagement",
  memorial_service: "ፍታት — Memorial Service",
  pledge: "ቃል የተገባ — Pledge",
  building_fund: "የቤተክርስቲያን ማሰሪያ — Building Fund",
  charity_fund: "በጎ አድራጎት — Charity Fund",
  auction: "ጨረታ — Auction",
  other_fund: "ሌላ — Other Fund",
  sunday_cash_collection: "የእሁድ ስብስብ — Sunday Collection",
};

function normalizeDonationCategory(value) {
  const key = clean(value || "general_donation", 80)
    .toLowerCase()
    .replace(/\s+/g, "_");

  return DONATION_CATEGORIES[key] ? key : "general_donation";
}

async function resolveDonor(conn, body) {
  const memberId = Number(body.member_id || 0);

  if (memberId) {
    const [[member]] = await conn.query(
      `
      SELECT id, member_no, full_name, email, phone
      FROM tbl_members
      WHERE id = ?
      LIMIT 1
      `,
      [memberId]
    );

    if (member) {
      return {
        member_id: member.id,
        member_no: member.member_no,
        full_name: member.full_name,
        email: member.email,
        phone: member.phone,
        donor_type: "member",
      };
    }
  }

  return {
    member_id: null,
    member_no: null,
    full_name: clean(body.full_name || body.donor_name || "Guest Donor"),
    email: clean(body.email || ""),
    phone: clean(body.phone || ""),
    donor_type: "non_member",
  };
}

async function createManualDonation(body, actor = {}) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const amount = money(body.amount);

    if (amount <= 0) {
      throw new Error("Donation amount must be greater than zero.");
    }

    const donor = await resolveDonor(conn, body);

    const category = normalizeDonationCategory(body.category);

    const method = clean(body.method || body.payment_method || "cash", 40)
      .toLowerCase();

    const referenceNo =
      clean(body.reference_no || body.check_number || body.zelle_reference) ||
      null;

    const paymentNumber = generateNumber("PAY");
    const invoiceNumber = generateNumber("INV");
    const receiptNumber = generateNumber("RCPT");

    const description =
      DONATION_CATEGORIES[category] || "General Donation";

    const invoiceId = await insertExistingColumns(conn, "tbl_finance_invoices", {
      invoice_number: invoiceNumber,
      member_id: donor.member_id,
      description,
      status: "paid",
      amount,
      total_amount: amount,
      paid_amount: amount,
      balance_due: 0,
      due_date: mysqlNow(),
      created_at: mysqlNow(),
      updated_at: mysqlNow(),
    });

    const paymentId = await insertExistingColumns(conn, "tbl_finance_payments", {
      payment_number: paymentNumber,
      member_id: donor.member_id,
      member_no: donor.member_no,
      payment_type: "donation",
      category: "donation",
      sub_category: category,
      description,

      amount,
      currency: "USD",
      status: "paid",

      method,
      provider: "manual",
      payment_source: "manual",

      reference_no: referenceNo,
      check_number: method === "check" ? referenceNo : null,
      zelle_reference: method === "zelle" ? referenceNo : null,

      full_name_snapshot: donor.full_name,
      email_snapshot: donor.email,
      phone_snapshot: donor.phone,

      paid_at: mysqlNow(),
      created_by: actor.id || null,
      created_at: mysqlNow(),
      updated_at: mysqlNow(),
    });

    await updateExistingColumns(
      conn,
      "tbl_finance_invoices",
      { payment_id: paymentId, updated_at: mysqlNow() },
      "id = ?",
      [invoiceId]
    );

    const receiptId = await insertExistingColumns(conn, "tbl_finance_receipts", {
      receipt_number: receiptNumber,
      payment_id: paymentId,
      invoice_id: invoiceId,
      member_id: donor.member_id,
      amount,
      currency: "USD",
      status: "issued",
      email_status: donor.email ? "pending" : "not_available",
      emailed_to: donor.email || null,
      issued_at: mysqlNow(),
      created_at: mysqlNow(),
      updated_at: mysqlNow(),
    });

    if (donor.member_id) {
      await insertExistingColumns(conn, "tbl_finance_member_ledger", {
        ledger_uuid: generateNumber("LEDGER"),
        member_id: donor.member_id,
        member_no: donor.member_no,
        full_name_snapshot: donor.full_name,
        phone_snapshot: donor.phone,

        record_type: "donation",
        related_document_type: "receipt",
        related_document_id: receiptId,
        related_document_number: receiptNumber,

        record_date: mysqlNow(),
        description,

        debit_amount: 0,
        credit_amount: amount,
        amount,
        source: "manual",
        source_reference: referenceNo,
        reference_no: receiptNumber,
        status: "posted",

        notes: clean(body.notes || "", 1000) || null,
        created_at: mysqlNow(),
        updated_at: mysqlNow(),
      });
    }

    await conn.commit();

    let emailResult = {
      success: false,
      error: "No donor email provided.",
    };

    if (donor.email) {
      const pdfBuffer = await generateReceiptPdfBuffer({
        receipt_number: receiptNumber,
        invoice_number: invoiceNumber,
        payment_number: paymentNumber,
        full_name: donor.full_name,
        email: donor.email,
        phone: donor.phone,
        amount,
        category: "donation",
        sub_category: category,
        description,
        method,
        provider: "manual",
        reference_no: referenceNo,
        issued_at: mysqlNow(),
        paid_at: mysqlNow(),
      });

      emailResult = await sendReceiptEmail({
        to: donor.email,
        pdfBuffer,
        receiptNo: receiptNumber,
        paidBy: donor.full_name,
        amount,
        category: description,
        method,
      });

      await pool.query(
        `
        UPDATE tbl_finance_receipts
        SET email_status = ?,
            emailed_at = ?,
            emailed_to = ?,
            email_error = ?
        WHERE id = ?
        `,
        [
          emailResult.success ? "sent" : "failed",
          emailResult.success ? mysqlNow() : null,
          donor.email,
          emailResult.success ? null : emailResult.error,
          receiptId,
        ]
      );
    }

    return {
      ok: true,
      payment_id: paymentId,
      invoice_id: invoiceId,
      receipt_id: receiptId,
      payment_number: paymentNumber,
      invoice_number: invoiceNumber,
      receipt_number: receiptNumber,
      email_status: emailResult.success ? "sent" : "failed",
      email_error: emailResult.success ? null : emailResult.error,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  createManualDonation,
  DONATION_CATEGORIES,
};