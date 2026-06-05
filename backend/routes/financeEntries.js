
// backend/routes/financeEntries.js
"use strict";

const express = require("express");
const crypto = require("crypto");
// remove
const bcrypt = require("bcryptjs");

// add
const argon2 = require("argon2");

async function hashPassword(password) {
  return argon2.hash(String(password), {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");
const { writeAuditLog } = require("../utils/audit");
const { sendReceiptEmail } = require("../services/emailService");
const { generateReceiptPdfBuffer } = require("../services/pdfService");

const router = express.Router();

const PAYMENT_METHODS = [
  "cash",
  "check",
  "zelle",
  "bank_deposit",
  "cash_collection",
  "other",
];

const DONATION_CATEGORIES = [
  "plate_collection",
  "candle_sale",
  "general_donation",
  "tithe",
  "vows",
  "baptism",
  "wedding_engagement",
  "memorial_service",
  "pledge",
  "building_fund",
  "charity_fund",
  "auction",
  "other_fund",
  "sunday_cash_collection",
];

const columnCache = new Map();

function isFinanceAllowed(req, res, next) {
  return requireRole("finance", "admin", "super_admin")(req, res, next);
}

function clean(v, max = 255) {
  return String(v ?? "").trim().slice(0, max);
}

function nullable(v, max = 255) {
  const s = clean(v, max);
  return s || null;
}

function toId(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number(n.toFixed(2));
}

function mysqlDateTime(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return mysqlDateTime(new Date());
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function normalizePaymentMethod(v) {
  const method = clean(v || "cash", 50).toLowerCase();
  return PAYMENT_METHODS.includes(method) ? method : "other";
}

function normalizeStatus(v) {
  const status = clean(v || "paid", 40).toLowerCase();
  if (["paid", "successful", "success", "completed", "posted"].includes(status)) {
    return "paid";
  }
  if (status === "pending") return "pending";
  if (status === "failed") return "failed";
  if (["canceled", "cancelled"].includes(status)) return "canceled";
  return "paid";
}

function normalizeDonationCategory(v) {
  const value = clean(v || "general_donation", 80)
    .toLowerCase()
    .replace(/\s+/g, "_");

  return DONATION_CATEGORIES.includes(value) ? value : "general_donation";
}

function normalizeEntryType(v) {
  const type = clean(v || "membership", 50).toLowerCase();

  if (["membership", "manual_membership", "member", "dues"].includes(type)) {
    return "membership";
  }

  if (["program", "registration", "school", "kids", "trip"].includes(type)) {
    return "program";
  }

  if (["donation", "manual_donation", "giving"].includes(type)) {
    return "donation";
  }

  return "membership";
}

function normalizeDate(v) {
  if (!v) return new Date();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function normalizeMonth(value) {
  const raw = clean(value, 20);
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return new Date().toISOString().slice(0, 10);
}

function generateNumber(prefix) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);

  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();

  return `${prefix}-${stamp}-${rand}`;
}

function generateTempPassword() {
  return `${crypto.randomBytes(9).toString("base64url")}Aa1!`;
}

function buildMemberNo(id) {
  return `M-${String(id).padStart(5, "0")}`;
}

function addMonths(dateValue, months) {
  const d = new Date(dateValue);
  d.setMonth(d.getMonth() + Number(months || 1));
  return d.toISOString().slice(0, 10);
}

function buildCoverage(startMonthDate, monthsPaid) {
  const months = Math.max(1, Number(monthsPaid || 1));
  const start = new Date(startMonthDate);

  return Array.from({ length: months }).map((_, index) => {
    const d = new Date(start);
    d.setMonth(start.getMonth() + index);

    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      }),
      status: "paid",
    };
  });
}

function coverageLabel(coverage = []) {
  if (!coverage.length) return null;
  if (coverage.length === 1) return coverage[0].label;
  return `${coverage[0].label} → ${coverage[coverage.length - 1].label}`;
}

async function getColumns(conn, tableName) {
  if (columnCache.has(tableName)) return columnCache.get(tableName);

  const [rows] = await conn.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const cols = new Set(rows.map((r) => r.Field));

  columnCache.set(tableName, cols);
  return cols;
}

async function insertExistingColumns(conn, tableName, data) {
  const cols = await getColumns(conn, tableName);

  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) {
    throw new Error(`No matching columns for ${tableName}`);
  }

  const fields = entries.map(([key]) => `\`${key}\``).join(", ");
  const placeholders = entries.map(() => "?").join(", ");
  const values = entries.map(([, value]) => value);

  const [result] = await conn.query(
    `INSERT INTO \`${tableName}\` (${fields}) VALUES (${placeholders})`,
    values
  );

  return result.insertId;
}

async function updateExistingColumns(conn, tableName, data, whereSql, whereParams) {
  const cols = await getColumns(conn, tableName);

  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) return;

  const setSql = entries.map(([key]) => `\`${key}\` = ?`).join(", ");
  const values = entries.map(([, value]) => value);

  await conn.query(
    `UPDATE \`${tableName}\` SET ${setSql} WHERE ${whereSql}`,
    [...values, ...whereParams]
  );
}

async function getMemberSnapshot(conn, memberId) {
  if (!memberId) return null;

  const [[row]] = await conn.query(
    `
    SELECT
      id AS member_id,
      member_no,
      full_name,
      email,
      phone,
      member_type,
      status,
      membership_status
    FROM tbl_members
    WHERE id = ?
    LIMIT 1
    `,
    [memberId]
  );

  return row || null;
}

async function resolveMemberId(conn, body = {}) {
  const direct =
    toId(body.member_id) ||
    toId(body.memberId) ||
    toId(body.selected_member_id) ||
    toId(body.selectedMemberId);

  if (direct) return direct;

  const memberNo = clean(body.member_no || body.memberNo, 80);
  if (memberNo) {
    const [[row]] = await conn.query(
      `SELECT id FROM tbl_members WHERE member_no = ? LIMIT 1`,
      [memberNo]
    );
    if (row?.id) return row.id;
  }

  const email = clean(body.email || body.member_email || body.memberEmail, 190);
  if (email) {
    const [[row]] = await conn.query(
      `
      SELECT m.id
      FROM tbl_members m
      LEFT JOIN tbl_users u ON u.member_id = m.id
      WHERE LOWER(m.email) = LOWER(?)
         OR LOWER(u.email) = LOWER(?)
      ORDER BY m.id DESC
      LIMIT 1
      `,
      [email, email]
    );

    if (row?.id) return row.id;
  }

  return null;
}

async function getPlan(conn, planId) {
  if (!planId) return null;

  const [[row]] = await conn.query(
    `
    SELECT *
    FROM tbl_finance_dues_plans
    WHERE id = ?
    LIMIT 1
    `,
    [planId]
  );

  return row || null;
}

async function getProgram(conn, programId) {
  if (!programId) return null;

  const [[row]] = await conn.query(
    `
    SELECT
      id,
      title,
      category,
      price_per_person,
      price,
      amount
    FROM tbl_news_events
    WHERE id = ?
    LIMIT 1
    `,
    [programId]
  );

  return row || null;
}

async function getRunningBalance(conn, memberId) {
  if (!memberId) return 0;

  const [[row]] = await conn.query(
    `
    SELECT running_balance
    FROM tbl_finance_member_ledger
    WHERE member_id = ?
    ORDER BY record_date DESC, id DESC
    LIMIT 1
    `,
    [memberId]
  ).catch(() => [[]]);

  return Number(row?.running_balance || 0);
}

async function postLedgerEntry(conn, input) {
  if (!input.member_id) return null;

  const previousBalance = await getRunningBalance(conn, input.member_id);
  const debit = Number(input.debit_amount || 0);
  const credit = Number(input.credit_amount || 0);
  const runningBalance = Number((previousBalance + debit - credit).toFixed(2));

  return insertExistingColumns(conn, "tbl_finance_member_ledger", {
    ledger_uuid: generateNumber("LEDGER"),
    member_id: input.member_id,
    member_no: input.member_no || null,
    full_name_snapshot: input.full_name || null,
    phone_snapshot: input.phone || null,

    record_date: input.record_date || mysqlDateTime(),
    record_type: input.record_type || "payment",

    related_document_type: input.related_document_type || "payment",
    related_document_id: input.related_document_id || input.payment_id || null,
    related_document_number:
      input.related_document_number || input.payment_number || input.reference_no || null,

    payment_id: input.payment_id || null,
    invoice_id: input.invoice_id || null,
    receipt_id: input.receipt_id || null,
    ledger_type: input.ledger_type || input.related_document_type || "payment",

    debit_amount: debit,
    credit_amount: credit,
    amount: Number(input.amount || credit || debit || 0),
    running_balance: runningBalance,

    description: input.description || "Manual finance entry",
    reference_no: input.reference_no || input.related_document_number || null,
    source: input.source || "manual",
    source_reference: input.source_reference || input.reference_no || null,
    status: input.status || "posted",

    coverage_json: input.coverage_json ? JSON.stringify(input.coverage_json) : null,
    notes: input.notes || null,

    created_at: mysqlDateTime(),
    updated_at: mysqlDateTime(),
  }).catch((err) => {
    console.error("Manual ledger insert skipped:", err.message);
    return null;
  });
}

async function createAccountingBundle(conn, input) {
  const amount = toMoney(input.amount);
  if (!amount) throw new Error("Invalid amount.");

  const paymentNumber = generateNumber("PAY");
  const invoiceNumber = generateNumber("INV");
  const receiptNumber = generateNumber("RCPT");

  const memberId = input.member_id || null;
  const memberSnapshot = memberId ? await getMemberSnapshot(conn, memberId) : null;

  const status = normalizeStatus(input.status || "paid");
  const method = normalizePaymentMethod(input.method);
  const provider = input.provider || "manual";

  const paymentType = clean(input.payment_type || "membership", 50);
  const category = clean(input.category || paymentType, 80);
  const subCategory = clean(input.sub_category || category, 120);

  const description = clean(input.description || "Manual finance payment", 500);
  const referenceNo = nullable(input.reference_no, 120);
  const paidAt = normalizeDate(input.paid_at || input.received_date);

  const quantity = Math.max(1, Number(input.quantity || 1));

  const coverageStart = input.coverage_start || input.coverage_start_date || null;
  const coverageEnd = input.coverage_end || input.coverage_end_date || null;
  const monthsPaid = Math.max(0, Number(input.months_paid || 0));
  const coverLabel = input.coverage_label || null;

  const paymentId = await insertExistingColumns(conn, "tbl_finance_payments", {
    payment_number: paymentNumber,
    member_id: memberId,

    full_name_snapshot:
      input.full_name || memberSnapshot?.full_name || null,
    email_snapshot:
      input.email || memberSnapshot?.email || null,
    phone_snapshot:
      input.phone || memberSnapshot?.phone || null,

    payment_type: paymentType,
    category,
    sub_category: subCategory,

    method,
    provider,
    amount,
    quantity,
    status,
    ledger_status: "posted",

    reference_no: referenceNo,
    related_entity_type: input.related_entity_type || null,
    related_entity_id: input.related_entity_id || null,

    plan_name: input.plan_name || null,
    months_paid: monthsPaid,
    coverage_label: coverLabel,
    coverage_start: coverageStart,
    coverage_end: coverageEnd,

    paid_at: mysqlDateTime(paidAt),
    description,
    created_at: mysqlDateTime(),
    updated_at: mysqlDateTime(),
  });

  const invoiceId = await insertExistingColumns(conn, "tbl_finance_invoices", {
    invoice_number: invoiceNumber,
    member_id: memberId,
    payment_id: paymentId,

    invoice_type: paymentType,
    description,
    amount,
    subtotal_amount: amount,
    total_amount: amount,
    paid_amount: status === "paid" ? amount : 0,
    balance_due: status === "paid" ? 0 : amount,

    status: status === "paid" ? "paid" : status,

    invoice_date: mysqlDateTime(paidAt),
    issue_date: mysqlDateTime(paidAt),
    due_date: mysqlDateTime(paidAt),

    period_label: input.period_label || coverLabel || subCategory,
    period_start: coverageStart,
    period_end: coverageEnd,

    notes: input.notes || null,
    created_at: mysqlDateTime(),
    updated_at: mysqlDateTime(),
  });

  await updateExistingColumns(
    conn,
    "tbl_finance_payments",
    { related_invoice_id: invoiceId },
    "id = ?",
    [paymentId]
  );

  await insertExistingColumns(conn, "tbl_finance_invoice_items", {
    invoice_id: invoiceId,
    item_code: category.toUpperCase(),
    item_name: description,
    description: subCategory,
    quantity,
    unit_price: Number((amount / quantity).toFixed(2)),
    amount,
    line_total: amount,
    created_at: mysqlDateTime(),
  }).catch(() => null);

  const receiptId = await insertExistingColumns(conn, "tbl_finance_receipts", {
    receipt_number: receiptNumber,
    member_id: memberId,
    payment_id: paymentId,
    invoice_id: invoiceId,
    amount,
    currency: "USD",
    status: "issued",
    email_status: input.email || memberSnapshot?.email ? "pending" : "not_available",
    email_to: input.email || memberSnapshot?.email || null,
    emailed_to: input.email || memberSnapshot?.email || null,
    notes: input.notes || description,
    issued_at: mysqlDateTime(paidAt),
    created_at: mysqlDateTime(),
    updated_at: mysqlDateTime(),
  });

  if (memberId) {
    await postLedgerEntry(conn, {
      member_id: memberId,
      member_no: memberSnapshot?.member_no,
      full_name: memberSnapshot?.full_name || input.full_name,
      phone: memberSnapshot?.phone || input.phone,
      payment_id: paymentId,
      invoice_id: invoiceId,
      receipt_id: receiptId,
      payment_number: paymentNumber,
      related_document_type: "payment",
      related_document_id: paymentId,
      related_document_number: paymentNumber,
      record_type: "payment",
      credit_amount: amount,
      debit_amount: 0,
      amount,
      description,
      reference_no: paymentNumber,
      status: "posted",
      coverage_json: input.coverage_json || null,
      notes: input.notes || null,
      source: "manual",
    });

    await conn.query(
      `
      UPDATE tbl_members
      SET
        total_paid = COALESCE(total_paid, 0) + ?,
        open_balance = GREATEST(COALESCE(open_balance, 0) - ?, 0),
        last_payment_at = NOW(),
        updated_at = NOW()
      WHERE id = ?
      `,
      [amount, amount, memberId]
    );
  }

  return {
    payment_id: paymentId,
    invoice_id: invoiceId,
    receipt_id: receiptId,
    payment_number: paymentNumber,
    invoice_number: invoiceNumber,
    receipt_number: receiptNumber,
    amount,
  };
}

async function sendReceiptIfPossible({
  conn,
  req,
  receiptNumber,
  email,
  receiptData,
}) {
  if (!email) return { success: false, error: "No email address." };

  try {
    const pdfBuffer = await generateReceiptPdfBuffer({
      receipt_number: receiptNumber,
      amount: receiptData.amount,
      full_name: receiptData.full_name,
      email,
      category: receiptData.payment_type,
      sub_category: receiptData.sub_category,
      payment_method: receiptData.method,
      payment_source: "manual",
      issued_at: mysqlDateTime(),
    });

    const result = await sendReceiptEmail({
      to: email,
      pdfBuffer,
      receiptNo: receiptNumber,
      paidBy: receiptData.full_name,
      amount: receiptData.amount,
      category: receiptData.payment_type,
      method: receiptData.method,
    });

    await updateExistingColumns(
      conn,
      "tbl_finance_receipts",
      {
        email_status: result?.success ? "sent" : "failed",
        emailed_at: result?.success ? mysqlDateTime() : undefined,
        emailed_to: email,
        emailed_by: req.user?.id || null,
        email_error: result?.success ? null : result?.error || "Email failed",
      },
      "receipt_number = ?",
      [receiptNumber]
    );

    return result || { success: true };
  } catch (err) {
    await updateExistingColumns(
      conn,
      "tbl_finance_receipts",
      {
        email_status: "failed",
        email_error: err.message,
      },
      "receipt_number = ?",
      [receiptNumber]
    );

    return { success: false, error: err.message };
  }
}

router.post("/manual-entries", authRequired, isFinanceAllowed, async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const entryType = normalizeEntryType(req.body.entry_type);
    const amount = toMoney(req.body.amount_paid || req.body.amount);
    const method = normalizePaymentMethod(req.body.payment_method || req.body.method);
    const status = normalizeStatus(
      req.body.status || req.body.registration_status || "paid"
    );

    if (!amount) {
      return res.status(400).json({
        error: "Amount paid must be greater than zero.",
      });
    }

    await conn.beginTransaction();

    let bundleInput = null;

    if (entryType === "membership") {
      const memberId = await resolveMemberId(conn, req.body);
      const planId =
        toId(req.body.plan_id) ||
        toId(req.body.dues_plan_id) ||
        toId(req.body.selected_plan_id);

      if (!memberId) throw new Error("Member is required.");
      if (!planId) throw new Error("Membership plan is required.");

      const plan = await getPlan(conn, planId);
      if (!plan) throw new Error("Membership plan not found.");

      const memberSnapshot = await getMemberSnapshot(conn, memberId);
      if (!memberSnapshot) throw new Error("Member not found.");

      const startMonth = normalizeMonth(
        req.body.payment_month || req.body.membership_start_month
      );

      const monthsPaid = Number(plan.duration_months || req.body.months_paid || 1);
      const coverage = buildCoverage(startMonth, monthsPaid);
      const startDate = startMonth;
      const endDate = addMonths(startMonth, monthsPaid);

      bundleInput = {
        member_id: memberId,
        full_name: memberSnapshot.full_name,
        email: memberSnapshot.email,
        phone: memberSnapshot.phone,
        amount,
        method,
        status,
        provider: "manual",

        payment_type: "membership",
        category: "membership",
        sub_category: plan.plan_name || "membership_dues",
        plan_name: plan.plan_name || null,
        months_paid: monthsPaid,
        coverage_start: startDate,
        coverage_end: endDate,
        coverage_label: coverageLabel(coverage),

        description: `Manual membership payment - ${plan.plan_name}`,
        ledger_type: "manual_membership_payment",
        reference_no: req.body.reference_no,
        notes: req.body.notes,
        period_label: coverageLabel(coverage) || startMonth.slice(0, 7),
        coverage_json: coverage,
        quantity: 1,
        received_date: req.body.received_date || req.body.paid_at || new Date(),
      };
    }

    if (entryType === "program") {
      const programId =
        toId(req.body.program_id) ||
        toId(req.body.news_event_id) ||
        toId(req.body.related_entity_id);

      const quantity = Math.max(
        1,
        Number(req.body.quantity || req.body.people_count || 1)
      );

      const applicantName = clean(
        req.body.applicant_name || req.body.full_name || req.body.donor_name,
        180
      );

      const email = clean(req.body.email, 190);
      const phone = clean(req.body.phone, 40);

      if (!programId) throw new Error("Program is required.");
      if (!applicantName) throw new Error("Applicant name is required.");

      const program = await getProgram(conn, programId);
      if (!program) throw new Error("Program not found.");

      const memberId = await resolveMemberId(conn, req.body);
      const memberSnapshot = memberId ? await getMemberSnapshot(conn, memberId) : null;

      const programCategory =
        program.category === "kids" || program.category === "school"
          ? "school"
          : "trip";

      const registrationId = await insertExistingColumns(
        conn,
        "tbl_program_registrations",
        {
          news_event_id: programId,
          program_id: programId,
          member_id: memberId || null,
          full_name: applicantName,
          applicant_name: applicantName,
          email: email || memberSnapshot?.email || null,
          phone: phone || memberSnapshot?.phone || null,
          category: program.category,
          quantity,
          amount_paid: amount,
          total_amount: amount,
          payment_status: status,
          registration_status: status === "paid" ? "successful" : status,
          participants_json: JSON.stringify(req.body.participants || []),
          notes: req.body.notes || null,
          source: "manual",
          created_at: mysqlDateTime(),
          updated_at: mysqlDateTime(),
        }
      );

      bundleInput = {
        member_id: memberId || null,
        full_name: applicantName || memberSnapshot?.full_name,
        email: email || memberSnapshot?.email,
        phone: phone || memberSnapshot?.phone,
        amount,
        method,
        status,
        provider: "manual",

        payment_type: programCategory,
        category: programCategory,
        sub_category: program.title,

        description: `Manual program registration - ${program.title}`,
        ledger_type:
          programCategory === "school"
            ? "manual_school_payment"
            : "manual_trip_payment",

        reference_no: req.body.reference_no,
        notes: req.body.notes,
        period_label: program.title,
        related_entity_type: "program_registration",
        related_entity_id: registrationId,
        quantity,
        received_date: req.body.received_date || req.body.paid_at || new Date(),
      };
    }

    if (entryType === "donation") {
      const memberId = await resolveMemberId(conn, req.body);
      const memberSnapshot = memberId ? await getMemberSnapshot(conn, memberId) : null;

      const donorName = clean(
        req.body.donor_name ||
          req.body.full_name ||
          memberSnapshot?.full_name ||
          "",
        180
      );

      const email = clean(req.body.email || memberSnapshot?.email || "", 190);
      const phone = clean(req.body.phone || memberSnapshot?.phone || "", 40);

      const donationType = normalizeDonationCategory(
        req.body.donation_type || req.body.category || req.body.sub_category
      );

      if (!donorName && !memberId) {
        throw new Error("Donor name or member is required.");
      }

      await insertExistingColumns(conn, "tbl_finance_donations", {
        member_id: memberId || null,
        donor_name: donorName || null,
        donor_email: email || null,
        donor_phone: phone || null,
        donation_type: donationType,
        amount,
        method,
        provider: "manual",
        status,
        notes: req.body.notes || null,
        created_at: mysqlDateTime(),
        updated_at: mysqlDateTime(),
      }).catch(() => null);

      bundleInput = {
        member_id: memberId || null,
        full_name: donorName,
        email,
        phone,
        amount,
        method,
        status,
        provider: "manual",

        payment_type: "donation",
        category: "donation",
        sub_category: donationType,

        description: `Manual donation - ${donationType.replaceAll("_", " ")}`,
        ledger_type: "manual_donation",
        reference_no: req.body.reference_no,
        notes: req.body.notes,
        period_label: donationType,
        quantity: 1,
        received_date: req.body.received_date || req.body.paid_at || new Date(),
      };
    }

    if (!bundleInput) throw new Error("Invalid manual entry type.");

    const bundle = await createAccountingBundle(conn, bundleInput);

    const emailResult = await sendReceiptIfPossible({
      conn,
      req,
      receiptNumber: bundle.receipt_number,
      email: bundleInput.email,
      receiptData: {
        ...bundleInput,
        amount: bundle.amount,
      },
    });

    await writeAuditLog({
      actorId: req.user?.id || null,
      action: "finance.manual_entry.created",
      entity: "finance_payment",
      entityId: bundle.payment_id,
      ipAddress: req.ip,
      meta: {
        entry_type: entryType,
        payment_number: bundle.payment_number,
        receipt_number: bundle.receipt_number,
        amount,
        method,
      },
    }).catch(() => null);

    await conn.commit();

    return res.json({
      ok: true,
      ...bundle,
      email: emailResult,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}

    console.error("POST /finance/manual-entries error:", err);

    return res.status(500).json({
      error: err.message || "Failed to create manual entry.",
    });
  } finally {
    conn.release();
  }
});

router.post(
  "/register-new-member",
  authRequired,
  isFinanceAllowed,
  async (req, res) => {
    const conn = await pool.getConnection();

    try {
      const firstName = clean(req.body.first_name, 100);
      const lastName = clean(req.body.last_name, 100);
      const fullName =
        clean(req.body.full_name, 180) || `${firstName} ${lastName}`.trim();

      const email = clean(req.body.email, 190).toLowerCase();
      const phone = nullable(req.body.phone, 40);

      const amount = toMoney(req.body.amount_paid);
      const planId = toId(req.body.plan_id);
      const method = normalizePaymentMethod(req.body.payment_method);
      const startMonth = normalizeMonth(req.body.membership_start_month);

      if (!firstName) {
        return res.status(400).json({ error: "First name is required." });
      }

      if (!lastName) {
        return res.status(400).json({ error: "Last name is required." });
      }

      if (!email) {
        return res.status(400).json({ error: "Email is required." });
      }

      if (!planId) {
        return res.status(400).json({ error: "Membership plan is required." });
      }

      if (!amount) {
        return res.status(400).json({ error: "Amount paid is required." });
      }

      await conn.beginTransaction();

      const [[existingMember]] = await conn.query(
        `SELECT id FROM tbl_members WHERE email = ? LIMIT 1`,
        [email]
      );

      if (existingMember) {
        throw new Error("A member with this email already exists.");
      }

      const [[existingUser]] = await conn.query(
        `SELECT id FROM tbl_users WHERE email = ? OR username = ? LIMIT 1`,
        [email, email]
      );

      if (existingUser) {
        throw new Error("An account with this email already exists.");
      }

      const plan = await getPlan(conn, planId);
      if (!plan) throw new Error("Membership plan not found.");

      const memberId = await insertExistingColumns(conn, "tbl_members", {
        member_no: "TEMP",
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        email,
        phone,
        address_line1: nullable(req.body.address_line1, 200),
        address_line2: nullable(req.body.address_line2, 200),
        city: nullable(req.body.city, 100),
        state: nullable(req.body.state, 80),
        zip: nullable(req.body.zip, 20),
        member_type: "new",
        registration_fee_status: "paid",
        registration_paid_at: mysqlDateTime(),
        status: "active",
        membership_status: "active",
        is_active: 1,
        open_balance: 0,
        total_paid: 0,
        last_payment_at: mysqlDateTime(),
        next_due_at: addMonths(startMonth, Number(plan.duration_months || 1)),
        dependents_count: 0,
        household_member_count: 1,
        notes: nullable(req.body.notes, 5000),
        created_at: mysqlDateTime(),
        updated_at: mysqlDateTime(),
      });

      const memberNo = buildMemberNo(memberId);

      await conn.query(
        `UPDATE tbl_members SET member_no = ? WHERE id = ?`,
        [memberNo, memberId]
      );

      const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
      const userId = await insertExistingColumns(conn, "tbl_users", {
        member_id: memberId,
        username: email,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        email,
        phone,
        role: "member",
        password_hash: passwordHash,
        is_active: 1,
        must_change_password: 1,
        created_at: mysqlDateTime(),
        updated_at: mysqlDateTime(),
      });

      const coverage = buildCoverage(startMonth, Number(plan.duration_months || 1));

      const bundle = await createAccountingBundle(conn, {
        member_id: memberId,
        full_name: fullName,
        email,
        phone,
        amount,
        method,
        status: "paid",
        provider: "manual",

        payment_type: "membership",
        category: "membership",
        sub_category: "membership_registration",
        plan_name: plan.plan_name,
        months_paid: Number(plan.duration_months || 1),
        coverage_start: startMonth,
        coverage_end: addMonths(startMonth, Number(plan.duration_months || 1)),
        coverage_label: coverageLabel(coverage),

        description: `New member registration - ${plan.plan_name}`,
        ledger_type: "manual_membership_registration",
        reference_no: req.body.reference_no,
        notes: req.body.notes,
        period_label: coverageLabel(coverage) || startMonth.slice(0, 7),
        coverage_json: coverage,
        quantity: 1,
      });

      const emailResult = await sendReceiptIfPossible({
        conn,
        req,
        receiptNumber: bundle.receipt_number,
        email,
        receiptData: {
          full_name: fullName,
          amount: bundle.amount,
          payment_type: "membership",
          sub_category: plan.plan_name,
          method,
        },
      });

      await writeAuditLog({
        actorId: req.user?.id || null,
        action: "finance.member.registered_with_manual_payment",
        entity: "member",
        entityId: memberId,
        ipAddress: req.ip,
        meta: {
          user_id: userId,
          member_no: memberNo,
          payment_number: bundle.payment_number,
          receipt_number: bundle.receipt_number,
          email_sent: !!emailResult?.success,
        },
      }).catch(() => null);

      await conn.commit();

      return res.json({
        ok: true,
        member_id: memberId,
        user_id: userId,
        member_no: memberNo,
        temp_password: tempPassword,
        ...bundle,
        email: emailResult,
      });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}

      console.error("POST /finance/register-new-member error:", err);

      return res.status(500).json({
        error: err.message || "Failed to register new member.",
      });
    } finally {
      conn.release();
    }
  }
);

router.get("/manual-entries", authRequired, isFinanceAllowed, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        p.id,
        p.created_at,
        COALESCE(p.paid_at, p.created_at) AS received_at,
        p.payment_number,
        r.receipt_number,
        i.invoice_number,

        COALESCE(m.full_name, p.full_name_snapshot, '--') AS full_name,
        COALESCE(u.email, p.email_snapshot, '') AS email,

        p.payment_type AS entry_type,
        COALESCE(p.sub_category, p.category, '--') AS category,

        p.amount,
        p.status,
        p.method,
        p.reference_no,

        COALESCE(r.email_status, 'pending') AS email_status,
        r.emailed_at AS sent_at

      FROM tbl_finance_payments p

      LEFT JOIN tbl_members m
        ON m.id = p.member_id

      LEFT JOIN tbl_users u
        ON u.member_id = m.id

      LEFT JOIN tbl_finance_receipts r
        ON r.payment_id = p.id

      LEFT JOIN tbl_finance_invoices i
        ON i.id = COALESCE(r.invoice_id, p.related_invoice_id)

      WHERE p.provider = 'manual'

      ORDER BY
        COALESCE(p.paid_at, p.created_at) DESC,
        p.id DESC
      `
    );

    return res.json({
      ok: true,
      rows,
      total: rows.length,
      page: 1,
      limit: rows.length || 10,
      totalPages: 1,
    });
  } catch (err) {
    console.error("GET /finance/manual-entries error:", err);

    return res.status(500).json({
      error: "Failed to load manual entries.",
    });
  }
});

module.exports = router;