// backend/routes/financeLedger.js
// backend/routes/financePledges.js

"use strict";

const express = require("express");
const crypto = require("crypto");

const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

let sendReceiptEmail = null;

try {
  ({ sendReceiptEmail } =
    require("../services/domains/receipts/receiptEmailService"));
} catch {
  sendReceiptEmail = null;
}

const router = express.Router();

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

function money(value) {
  const n = Number(value || 0);

  return Number.isFinite(n)
    ? Number(n.toFixed(2))
    : 0;
}

function toInt(value, fallback = 1) {
  const n = Number(value);

  return Number.isFinite(n) && n > 0
    ? Math.trunc(n)
    : fallback;
}

function makeCode(prefix) {
  return `${prefix}-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

function actorId(req) {
  return (
    req.user?.id ||
    req.user?.user_id ||
    req.user?.userId ||
    null
  );
}

function normalizePaymentMethod(value) {
  const v = clean(value).toLowerCase();

  if (v === "stripe_card") return "card";
  if (v === "stripe_ach") return "ach";
  if (v === "bank") return "bank_deposit";

  return v || "manual";
}

function pledgeStatus(pledgedAmount, paidAmount, currentStatus = "") {
  const pledged = money(pledgedAmount);
  const paid = money(paidAmount);

  const existing = clean(currentStatus).toLowerCase();

  if (["written_off", "cancelled"].includes(existing)) {
    return existing;
  }

  if (paid <= 0) return "receivable";
  if (paid >= pledged) return "paid";

  return "partial";
}

function pledgeTypeLabel(value) {
  const v = clean(value).toLowerCase();

  if (v === "pay_now") return "Pay Full Amount Now";
  if (v === "partial_upfront") return "Partial Payment Now";
  if (v === "recurring") return "Recurring Pledge";

  return "Promise To Pay";
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

  if (!entries.length) return null;

  const fields = entries
    .map(([key]) => `\`${key}\``)
    .join(", ");

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

async function updateDynamic(conn, tableName, data, whereSql, whereParams = []) {
  const cols = await getColumns(conn, tableName);

  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) return;

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
   MEMBER / CAMPAIGN HELPERS
========================================================= */

async function getMember(conn, memberId) {
  if (!memberId) return null;

  const [[row]] = await conn.query(
    `
    SELECT
      id,
      member_no,
      full_name,
      email,
      phone
    FROM tbl_members
    WHERE id = ?
    LIMIT 1
    `,
    [memberId]
  );

  return row || null;
}

async function getCampaign(conn, campaignId) {
  if (!campaignId) return null;

  if (!(await tableExists(conn, "tbl_finance_campaigns"))) {
    return null;
  }

  const cols = await getColumns(conn, "tbl_finance_campaigns");

  const titleCol = cols.has("title")
    ? "title"
    : cols.has("name")
    ? "name"
    : null;

  const goalCol = cols.has("goal_amount")
    ? "goal_amount"
    : cols.has("target_amount")
    ? "target_amount"
    : null;

  const selectTitle = titleCol
    ? `\`${titleCol}\` AS campaign_name`
    : `NULL AS campaign_name`;

  const selectGoal = goalCol
    ? `\`${goalCol}\` AS goal_amount`
    : `0 AS goal_amount`;

  const [[row]] = await conn.query(
    `
    SELECT
      id,
      ${selectTitle},
      ${selectGoal}
    FROM tbl_finance_campaigns
    WHERE id = ?
    LIMIT 1
    `,
    [campaignId]
  );

  return row || null;
}

/* =========================================================
   PAYMENT / INVOICE / RECEIPT / LEDGER HELPERS
========================================================= */

async function createPaymentRecord(conn, payload) {
  const paymentNumber = makeCode("PAY");

  const paymentId = await insertDynamic(
    conn,
    "tbl_finance_payments",
    {
      payment_number: paymentNumber,

      member_id: payload.member_id || null,
      member_no: payload.member_no || null,

      full_name_snapshot: payload.full_name || "Guest Donor",
      email_snapshot: payload.email || null,
      phone_snapshot: payload.phone || null,

      payer_type: payload.member_id ? "member" : "guest",

      category: "pledge",
      payment_type: "pledge",
      sub_category: payload.campaign_name || "Pledge Payment",
      donation_category: "pledge",

      pledge_id: payload.pledge_id || null,
      pledge_number: payload.pledge_number || null,
      campaign_id: payload.campaign_id || null,
      campaign_name: payload.campaign_name || null,

      amount: payload.amount,
      total_amount: payload.amount,
      currency: payload.currency || "USD",

      method: payload.method,
      payment_method: payload.method,
      provider: payload.provider || payload.method,
      payment_provider: payload.provider || payload.method,

      status: "paid",
      payment_status: "paid",

      reference_no: payload.reference_no || null,
      description:
        payload.description ||
        `Pledge payment - ${payload.campaign_name || "Campaign"}`,

      paid_at: new Date(),

      created_by: payload.actor_id || null,
      created_at: new Date(),
      updated_at: new Date(),
    }
  );

  return {
    id: paymentId,
    payment_number: paymentNumber,
    amount: payload.amount,
  };
}

async function createInvoiceRecord(conn, payload) {
  const invoiceNumber = makeCode("INV");

  const invoiceId = await insertDynamic(
    conn,
    "tbl_finance_invoices",
    {
      invoice_number: invoiceNumber,

      payment_id: payload.payment_id || null,

      member_id: payload.member_id || null,
      member_no: payload.member_no || null,

      full_name_snapshot: payload.full_name || "Guest Donor",
      email_snapshot: payload.email || null,
      phone_snapshot: payload.phone || null,

      category: "pledge",
      payment_type: "pledge",
      sub_category: payload.campaign_name || "Pledge",
      description:
        payload.description ||
        `Pledge invoice - ${payload.campaign_name || "Campaign"}`,

      pledge_id: payload.pledge_id || null,
      pledge_number: payload.pledge_number || null,
      campaign_id: payload.campaign_id || null,
      campaign_name: payload.campaign_name || null,

      total_amount: payload.amount,
      amount: payload.amount,
      paid_amount: payload.status === "paid" ? payload.amount : 0,
      balance_due: payload.status === "paid" ? 0 : payload.amount,

      status: payload.status || "open",
      payment_status: payload.status || "open",

      due_date: payload.due_date || null,
      invoice_date: new Date(),
      paid_at: payload.status === "paid" ? new Date() : null,

      created_by: payload.actor_id || null,
      created_at: new Date(),
      updated_at: new Date(),
    }
  );

  return {
    id: invoiceId,
    invoice_number: invoiceNumber,
  };
}

async function createReceiptRecord(conn, payload) {
  const receiptNumber = makeCode("RCPT");

  const receiptId = await insertDynamic(
    conn,
    "tbl_finance_receipts",
    {
      receipt_number: receiptNumber,

      payment_id: payload.payment_id || null,
      invoice_id: payload.invoice_id || null,
      invoice_number: payload.invoice_number || null,

      member_id: payload.member_id || null,
      member_no: payload.member_no || null,

      full_name_snapshot: payload.full_name || "Guest Donor",
      email_snapshot: payload.email || null,
      phone_snapshot: payload.phone || null,

      category: "pledge",
      payment_type: "pledge",
      sub_category: payload.campaign_name || "Pledge Payment",
      description:
        payload.description ||
        `Pledge receipt - ${payload.campaign_name || "Campaign"}`,

      pledge_id: payload.pledge_id || null,
      pledge_number: payload.pledge_number || null,
      campaign_id: payload.campaign_id || null,
      campaign_name: payload.campaign_name || null,

      amount: payload.amount,

      method: payload.method,
      provider: payload.provider || payload.method,
      reference_no: payload.reference_no || null,

      email_status: payload.email ? "pending" : "not_requested",
      emailed_to: payload.email || null,

      receipt_date: new Date(),
      issued_at: new Date(),

      created_by: payload.actor_id || null,
      created_at: new Date(),
      updated_at: new Date(),
    }
  );

  return {
    id: receiptId,
    receipt_number: receiptNumber,
  };
}

async function createLedgerEntry(conn, payload) {
  const tables = [
    "tbl_finance_member_ledger",
    "tbl_finance_ledger",
    "tbl_finance_ledger_entries",
    "tbl_member_ledger",
  ];

  const ledgerNumber = makeCode("LEDGER");

  for (const table of tables) {
    if (!(await tableExists(conn, table))) continue;

    await insertDynamic(
      conn,
      table,
      {
        ledger_uuid: ledgerNumber,
        ledger_number: ledgerNumber,

        member_id: payload.member_id || null,
        member_no: payload.member_no || null,

        full_name_snapshot: payload.full_name || "Guest Donor",
        phone_snapshot: payload.phone || null,

        record_type: payload.record_type || "payment",
        ledger_type: payload.ledger_type || "payment",
        entry_type: payload.entry_type || "payment",

        related_document_type: payload.related_document_type || "pledge",
        related_document_id: payload.related_document_id || payload.pledge_id || null,
        related_document_number:
          payload.related_document_number || payload.pledge_number || null,

        payment_id: payload.payment_id || null,
        invoice_id: payload.invoice_id || null,
        receipt_id: payload.receipt_id || null,
        pledge_id: payload.pledge_id || null,

        payment_number: payload.payment_number || null,
        invoice_number: payload.invoice_number || null,
        receipt_number: payload.receipt_number || null,
        pledge_number: payload.pledge_number || null,

        category: "pledge",
        payment_type: "pledge",
        sub_category: payload.campaign_name || "Pledge",

        description: payload.description || "Pledge ledger entry",

        debit: payload.debit || 0,
        credit: payload.credit || 0,
        debit_amount: payload.debit || 0,
        credit_amount: payload.credit || 0,
        amount: payload.amount || 0,

        method: payload.method || null,
        provider: payload.provider || null,
        reference_no: payload.reference_no || null,

        source: payload.source || "finance_pledge",
        source_reference: payload.source_reference || payload.pledge_number || null,

        status: "posted",

        record_date: new Date(),
        posted_at: new Date(),

        posted_by: payload.actor_id || null,
        created_by: payload.actor_id || null,

        created_at: new Date(),
        updated_at: new Date(),
      }
    );

    return;
  }
}

async function createPledgeReceivableLedger(conn, pledge) {
  await createLedgerEntry(
    conn,
    {
      ...pledge,

      record_type: "receivable",
      ledger_type: "receivable",
      entry_type: "pledge_receivable",

      related_document_type: "pledge",
      related_document_id: pledge.pledge_id,
      related_document_number: pledge.pledge_number,

      debit: pledge.remaining_balance,
      credit: 0,
      amount: pledge.remaining_balance,

      description:
        `Pledge receivable created - ${pledge.campaign_name || "Campaign"}`,
      source: "finance_pledge_receivable",
      source_reference: pledge.pledge_number,
    }
  );
}

async function createFullPaymentWorkflow(conn, payload) {
  const payment = await createPaymentRecord(conn, payload);

  const invoice = await createInvoiceRecord(
    conn,
    {
      ...payload,
      payment_id: payment.id,
      amount: payload.amount,
      status: "paid",
    }
  );

  const receipt = await createReceiptRecord(
    conn,
    {
      ...payload,
      payment_id: payment.id,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      amount: payload.amount,
    }
  );

  await updateDynamic(
    conn,
    "tbl_finance_payments",
    {
      invoice_id: invoice.id,
      receipt_id: receipt.id,
      invoice_number: invoice.invoice_number,
      receipt_number: receipt.receipt_number,
      updated_at: new Date(),
    },
    "id = ?",
    [payment.id]
  );

  await createLedgerEntry(
    conn,
    {
      ...payload,

      payment_id: payment.id,
      invoice_id: invoice.id,
      receipt_id: receipt.id,

      payment_number: payment.payment_number,
      invoice_number: invoice.invoice_number,
      receipt_number: receipt.receipt_number,

      record_type: "payment",
      ledger_type: "payment",
      entry_type: "pledge_payment",

      related_document_type: "receipt",
      related_document_id: receipt.id,
      related_document_number: receipt.receipt_number,

      debit: 0,
      credit: payload.amount,
      amount: payload.amount,

      description:
        `Pledge payment received - ${payload.campaign_name || "Campaign"}`,
      source: "finance_pledge_payment",
      source_reference: payment.payment_number,
    }
  );

  return {
    payment,
    invoice,
    receipt,
  };
}

/* =========================================================
   NORMALIZE PLEDGE PAYLOAD
========================================================= */

async function buildPledgePayload(conn, req, existing = null) {
  const body = req.body || {};

  const memberId =
    body.member_id !== undefined && body.member_id !== null && body.member_id !== ""
      ? Number(body.member_id)
      : existing?.member_id || null;

  const member = await getMember(conn, memberId);

  const guest = body.guest || {};

  const fullName =
    member?.full_name ||
    clean(body.full_name) ||
    clean(guest.full_name) ||
    clean(existing?.full_name_snapshot) ||
    clean(existing?.full_name) ||
    "Guest Donor";

  const email =
    member?.email ||
    clean(body.email) ||
    clean(guest.email) ||
    clean(existing?.email_snapshot) ||
    clean(existing?.email) ||
    null;

  const phone =
    member?.phone ||
    clean(body.phone) ||
    clean(guest.phone) ||
    clean(existing?.phone_snapshot) ||
    clean(existing?.phone) ||
    null;

  const campaignId =
    body.campaign_id !== undefined
      ? body.campaign_id || null
      : existing?.campaign_id || null;

  const campaign = await getCampaign(conn, campaignId);

  const pledgedAmount = money(
    body.pledged_amount !== undefined
      ? body.pledged_amount
      : existing?.pledged_amount
  );

  const upfrontAmount = money(
    body.upfront_amount !== undefined
      ? body.upfront_amount
      : existing?.upfront_amount || 0
  );

  if (pledgedAmount <= 0) {
    throw new Error("Pledged amount is required.");
  }

  if (upfrontAmount < 0) {
    throw new Error("Upfront payment cannot be negative.");
  }

  if (upfrontAmount > pledgedAmount) {
    throw new Error("Upfront payment cannot exceed pledged amount.");
  }

  const paidAmount = existing
    ? money(
        Number(existing.paid_amount || 0) -
          Number(existing.upfront_amount || 0) +
          upfrontAmount
      )
    : upfrontAmount;

  const remainingBalance = money(pledgedAmount - paidAmount);

  const status = pledgeStatus(
    pledgedAmount,
    paidAmount,
    existing?.status
  );

  return {
    actor_id: actorId(req),

    member_id: memberId,
    member_no: member?.member_no || existing?.member_no || null,

    full_name: fullName,
    email,
    phone,

    campaign_id: campaignId,
    campaign_name:
      campaign?.campaign_name ||
      clean(body.campaign_name) ||
      clean(existing?.campaign_name) ||
      "Pledge Campaign",

    pledge_type:
      clean(body.pledge_type) ||
      existing?.pledge_type ||
      "promise_to_pay",

    pledge_type_label:
      pledgeTypeLabel(
        clean(body.pledge_type) ||
          existing?.pledge_type ||
          "promise_to_pay"
      ),

    pledged_amount: pledgedAmount,
    upfront_amount: upfrontAmount,
    paid_amount: paidAmount,
    remaining_balance: remainingBalance,
    status,

    due_date:
      body.due_date !== undefined
        ? body.due_date || null
        : existing?.due_date || null,

    reminder_date:
      body.reminder_date !== undefined
        ? body.reminder_date || null
        : existing?.reminder_date || null,

    frequency:
      clean(body.frequency) ||
      existing?.frequency ||
      "one_time",

    notes:
      body.notes !== undefined
        ? body.notes || null
        : existing?.notes || null,

    payment_method:
      normalizePaymentMethod(body.payment_method || body.method),

    reference_no: body.reference_no || null,
  };
}

/* =========================================================
   LIST PLEDGES
========================================================= */

router.get("/", async (req, res) => {
  try {
    if (!(await tableExists(pool, "tbl_finance_pledges"))) {
      return res.json({
        ok: true,
        rows: [],
        summary: {
          pledged_amount: 0,
          paid_amount: 0,
          remaining_balance: 0,
          open_count: 0,
          paid_count: 0,
          written_off_count: 0,
        },
      });
    }

    const search = clean(req.query.search || req.query.q);
    const status = clean(req.query.status);
    const campaignId = clean(req.query.campaign_id);
    const memberId = clean(req.query.member_id);

    const page = toInt(req.query.page, 1);
    const limit = Math.min(100, toInt(req.query.limit || req.query.pageSize, 25));
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];

    if (search) {
      where.push(`
        (
          pledge_number LIKE ?
          OR full_name_snapshot LIKE ?
          OR email_snapshot LIKE ?
          OR phone_snapshot LIKE ?
          OR member_no LIKE ?
          OR campaign_name LIKE ?
        )
      `);

      const q = `%${search}%`;
      params.push(q, q, q, q, q, q);
    }

    if (status) {
      where.push("status = ?");
      params.push(status);
    }

    if (campaignId) {
      where.push("campaign_id = ?");
      params.push(campaignId);
    }

    if (memberId) {
      where.push("member_id = ?");
      params.push(memberId);
    }

    const whereSql = where.length
      ? `WHERE ${where.join(" AND ")}`
      : "";

    const [[countRow]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_finance_pledges
      ${whereSql}
      `,
      params
    );

    const [rows] = await pool.query(
      `
      SELECT
        p.*,

        p.full_name_snapshot AS full_name,
        p.email_snapshot AS email,
        p.phone_snapshot AS phone,

        DATEDIFF(CURDATE(), DATE(COALESCE(p.created_at, CURDATE()))) AS age_days,

        CASE
          WHEN p.status IN ('paid', 'written_off', 'cancelled') THEN 'closed'
          WHEN p.due_date IS NOT NULL AND DATE(p.due_date) < CURDATE() THEN 'overdue'
          ELSE 'current'
        END AS aging_status,

        CASE
          WHEN p.due_date IS NULL THEN 'no_due_date'
          WHEN DATEDIFF(CURDATE(), DATE(p.due_date)) <= 0 THEN 'current'
          WHEN DATEDIFF(CURDATE(), DATE(p.due_date)) <= 30 THEN '1_30'
          WHEN DATEDIFF(CURDATE(), DATE(p.due_date)) <= 60 THEN '31_60'
          WHEN DATEDIFF(CURDATE(), DATE(p.due_date)) <= 90 THEN '61_90'
          ELSE '90_plus'
        END AS aging_bucket

      FROM tbl_finance_pledges p

      ${whereSql}

      ORDER BY
        CASE
          WHEN p.status = 'receivable' THEN 1
          WHEN p.status = 'partial' THEN 2
          WHEN p.status = 'paid' THEN 3
          WHEN p.status = 'written_off' THEN 4
          WHEN p.status = 'cancelled' THEN 5
          ELSE 6
        END,
        p.id DESC

      LIMIT ?
      OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [[summary]] = await pool.query(
      `
      SELECT
        COALESCE(SUM(pledged_amount), 0) AS pledged_amount,
        COALESCE(SUM(paid_amount), 0) AS paid_amount,
        COALESCE(SUM(remaining_balance), 0) AS remaining_balance,

        SUM(CASE WHEN status IN ('receivable', 'partial') THEN 1 ELSE 0 END) AS open_count,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
        SUM(CASE WHEN status = 'written_off' THEN 1 ELSE 0 END) AS written_off_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,

        SUM(
          CASE
            WHEN status IN ('receivable', 'partial')
              AND due_date IS NOT NULL
              AND DATE(due_date) < CURDATE()
            THEN 1
            ELSE 0
          END
        ) AS overdue_count

      FROM tbl_finance_pledges
      ${whereSql}
      `,
      params
    );

    return res.json({
      ok: true,
      rows,
      summary,
      pagination: {
        page,
        limit,
        total: Number(countRow.total || 0),
        pages: Math.max(1, Math.ceil(Number(countRow.total || 0) / limit)),
      },
    });
  } catch (err) {
    console.error("GET /finance/pledges error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load pledges.",
    });
  }
});

/* =========================================================
   CREATE PLEDGE
========================================================= */

router.post("/", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    if (!(await tableExists(conn, "tbl_finance_pledges"))) {
      throw new Error("tbl_finance_pledges table does not exist.");
    }

    const payload = await buildPledgePayload(conn, req);

    const pledgeNumber = makeCode("PLG");

    const pledgeId = await insertDynamic(
      conn,
      "tbl_finance_pledges",
      {
        pledge_number: pledgeNumber,

        campaign_id: payload.campaign_id,
        campaign_name: payload.campaign_name,

        member_id: payload.member_id,
        member_no: payload.member_no,

        full_name_snapshot: payload.full_name,
        email_snapshot: payload.email,
        phone_snapshot: payload.phone,

        pledge_type: payload.pledge_type,
        pledge_type_label: payload.pledge_type_label,

        pledged_amount: payload.pledged_amount,
        upfront_amount: payload.upfront_amount,
        paid_amount: payload.paid_amount,
        remaining_balance: payload.remaining_balance,

        status: payload.status,

        due_date: payload.due_date,
        reminder_date: payload.reminder_date,
        frequency: payload.frequency,

        notes: payload.notes,

        created_by: payload.actor_id,
        created_at: new Date(),
        updated_at: new Date(),
      }
    );

    const pledgeBase = {
      ...payload,
      pledge_id: pledgeId,
      pledge_number: pledgeNumber,
    };

    if (payload.remaining_balance > 0) {
      await createPledgeReceivableLedger(conn, pledgeBase);
    }

    let paymentWorkflow = null;

    if (payload.upfront_amount > 0) {
      paymentWorkflow = await createFullPaymentWorkflow(
        conn,
        {
          ...pledgeBase,
          amount: payload.upfront_amount,
          method: payload.payment_method,
          provider: payload.payment_method,
          description:
            `Upfront pledge payment - ${payload.campaign_name}`,
        }
      );

      await updateDynamic(
        conn,
        "tbl_finance_pledges",
        {
          last_payment_id: paymentWorkflow.payment.id,
          last_invoice_id: paymentWorkflow.invoice.id,
          last_receipt_id: paymentWorkflow.receipt.id,
          updated_at: new Date(),
        },
        "id = ?",
        [pledgeId]
      );
    }

    await conn.commit();

    if (
      paymentWorkflow?.receipt?.id &&
      payload.email &&
      sendReceiptEmail &&
      req.body?.send_receipt !== false
    ) {
      try {
        await sendReceiptEmail(
          paymentWorkflow.receipt.id,
          {
            email: payload.email,
          }
        );
      } catch (emailErr) {
        console.error("Pledge receipt email failed:", emailErr);
      }
    }

    return res.status(201).json({
      ok: true,
      pledge_id: pledgeId,
      pledge_number: pledgeNumber,
      status: payload.status,
      payment: paymentWorkflow?.payment || null,
      invoice: paymentWorkflow?.invoice || null,
      receipt: paymentWorkflow?.receipt || null,
    });
  } catch (err) {
    await conn.rollback();

    console.error("POST /finance/pledges error:", err);

    return res.status(400).json({
      ok: false,
      error: err.message || "Failed to create pledge.",
    });
  } finally {
    conn.release();
  }
});

/* =========================================================
   GET ONE PLEDGE
========================================================= */

router.get("/:id", async (req, res) => {
  try {
    const [[pledge]] = await pool.query(
      `
      SELECT
        p.*,
        p.full_name_snapshot AS full_name,
        p.email_snapshot AS email,
        p.phone_snapshot AS phone
      FROM tbl_finance_pledges p
      WHERE p.id = ?
      LIMIT 1
      `,
      [req.params.id]
    );

    if (!pledge) {
      return res.status(404).json({
        ok: false,
        error: "Pledge not found.",
      });
    }

    const [payments] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_payments
      WHERE pledge_id = ?
      ORDER BY id DESC
      `,
      [pledge.id]
    ).catch(() => [[]]);

    const [invoices] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_invoices
      WHERE pledge_id = ?
      ORDER BY id DESC
      `,
      [pledge.id]
    ).catch(() => [[]]);

    const [receipts] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_receipts
      WHERE pledge_id = ?
      ORDER BY id DESC
      `,
      [pledge.id]
    ).catch(() => [[]]);

    return res.json({
      ok: true,
      pledge,
      payments,
      invoices,
      receipts,
    });
  } catch (err) {
    console.error("GET /finance/pledges/:id error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load pledge.",
    });
  }
});

/* =========================================================
   UPDATE PLEDGE
========================================================= */

router.put("/:id", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [[existing]] = await conn.query(
      `
      SELECT *
      FROM tbl_finance_pledges
      WHERE id = ?
      LIMIT 1
      `,
      [req.params.id]
    );

    if (!existing) {
      throw new Error("Pledge not found.");
    }

    if (["paid", "written_off", "cancelled"].includes(String(existing.status))) {
      throw new Error("Closed pledges cannot be edited.");
    }

    const payload = await buildPledgePayload(conn, req, existing);

    await updateDynamic(
      conn,
      "tbl_finance_pledges",
      {
        campaign_id: payload.campaign_id,
        campaign_name: payload.campaign_name,

        member_id: payload.member_id,
        member_no: payload.member_no,

        full_name_snapshot: payload.full_name,
        email_snapshot: payload.email,
        phone_snapshot: payload.phone,

        pledge_type: payload.pledge_type,
        pledge_type_label: payload.pledge_type_label,

        pledged_amount: payload.pledged_amount,
        upfront_amount: payload.upfront_amount,
        paid_amount: payload.paid_amount,
        remaining_balance: payload.remaining_balance,

        status: payload.status,

        due_date: payload.due_date,
        reminder_date: payload.reminder_date,
        frequency: payload.frequency,

        notes: payload.notes,

        updated_by: payload.actor_id,
        updated_at: new Date(),
      },
      "id = ?",
      [req.params.id]
    );

    await conn.commit();

    return res.json({
      ok: true,
      pledge_id: Number(req.params.id),
      status: payload.status,
    });
  } catch (err) {
    await conn.rollback();

    console.error("PUT /finance/pledges/:id error:", err);

    return res.status(400).json({
      ok: false,
      error: err.message || "Failed to update pledge.",
    });
  } finally {
    conn.release();
  }
});

/* =========================================================
   APPLY PLEDGE PAYMENT
========================================================= */

router.post("/:id/payments", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const amount = money(req.body.amount);

    if (amount <= 0) {
      throw new Error("Payment amount is required.");
    }

    const [[pledge]] = await conn.query(
      `
      SELECT *
      FROM tbl_finance_pledges
      WHERE id = ?
      LIMIT 1
      `,
      [req.params.id]
    );

    if (!pledge) {
      throw new Error("Pledge not found.");
    }

    if (["paid", "written_off", "cancelled"].includes(String(pledge.status))) {
      throw new Error("This pledge is already closed.");
    }

    const remainingBefore = money(pledge.remaining_balance);

    if (amount > remainingBefore) {
      throw new Error("Payment cannot exceed remaining pledge balance.");
    }

    const paidAmount = money(Number(pledge.paid_amount || 0) + amount);
    const remainingBalance = money(Number(pledge.pledged_amount || 0) - paidAmount);
    const nextStatus = pledgeStatus(pledge.pledged_amount, paidAmount);

    const workflow = await createFullPaymentWorkflow(
      conn,
      {
        pledge_id: pledge.id,
        pledge_number: pledge.pledge_number,

        campaign_id: pledge.campaign_id || null,
        campaign_name: pledge.campaign_name || "Pledge Campaign",

        member_id: pledge.member_id || null,
        member_no: pledge.member_no || null,

        full_name: pledge.full_name_snapshot || "Guest Donor",
        email: pledge.email_snapshot || null,
        phone: pledge.phone_snapshot || null,

        amount,
        method: normalizePaymentMethod(req.body.method || req.body.payment_method),
        provider: normalizePaymentMethod(req.body.method || req.body.payment_method),

        reference_no: req.body.reference_no || null,
        description:
          `Pledge payment - ${pledge.campaign_name || "Campaign"}`,

        actor_id: actorId(req),
      }
    );

    await updateDynamic(
      conn,
      "tbl_finance_pledges",
      {
        paid_amount: paidAmount,
        remaining_balance: remainingBalance,
        status: nextStatus,

        last_payment_id: workflow.payment.id,
        last_invoice_id: workflow.invoice.id,
        last_receipt_id: workflow.receipt.id,
        last_payment_at: new Date(),

        updated_by: actorId(req),
        updated_at: new Date(),
      },
      "id = ?",
      [pledge.id]
    );

    await conn.commit();

    if (
      workflow?.receipt?.id &&
      pledge.email_snapshot &&
      sendReceiptEmail &&
      req.body?.send_receipt !== false
    ) {
      try {
        await sendReceiptEmail(
          workflow.receipt.id,
          {
            email: pledge.email_snapshot,
          }
        );
      } catch (emailErr) {
        console.error("Pledge payment receipt email failed:", emailErr);
      }
    }

    return res.json({
      ok: true,
      message: "Pledge payment recorded.",
      paid_amount: paidAmount,
      remaining_balance: remainingBalance,
      status: nextStatus,
      payment: workflow.payment,
      invoice: workflow.invoice,
      receipt: workflow.receipt,
    });
  } catch (err) {
    await conn.rollback();

    console.error("POST /finance/pledges/:id/payments error:", err);

    return res.status(400).json({
      ok: false,
      error: err.message || "Failed to apply pledge payment.",
    });
  } finally {
    conn.release();
  }
});

/* =========================================================
   GENERATE INVOICE FOR RECEIVABLE
========================================================= */

router.post("/:id/invoice", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [[pledge]] = await conn.query(
      `
      SELECT *
      FROM tbl_finance_pledges
      WHERE id = ?
      LIMIT 1
      `,
      [req.params.id]
    );

    if (!pledge) {
      throw new Error("Pledge not found.");
    }

    if (money(pledge.remaining_balance) <= 0) {
      throw new Error("No remaining balance to invoice.");
    }

    const invoice = await createInvoiceRecord(
      conn,
      {
        pledge_id: pledge.id,
        pledge_number: pledge.pledge_number,

        campaign_id: pledge.campaign_id || null,
        campaign_name: pledge.campaign_name || "Pledge Campaign",

        member_id: pledge.member_id || null,
        member_no: pledge.member_no || null,

        full_name: pledge.full_name_snapshot || "Guest Donor",
        email: pledge.email_snapshot || null,
        phone: pledge.phone_snapshot || null,

        amount: money(pledge.remaining_balance),
        status: "open",
        due_date: pledge.due_date || null,

        description:
          `Pledge receivable invoice - ${pledge.campaign_name || "Campaign"}`,

        actor_id: actorId(req),
      }
    );

    await updateDynamic(
      conn,
      "tbl_finance_pledges",
      {
        status: pledge.status === "receivable" ? "invoiced" : pledge.status,
        last_invoice_id: invoice.id,
        updated_by: actorId(req),
        updated_at: new Date(),
      },
      "id = ?",
      [pledge.id]
    );

    await conn.commit();

    return res.json({
      ok: true,
      invoice,
    });
  } catch (err) {
    await conn.rollback();

    console.error("POST /finance/pledges/:id/invoice error:", err);

    return res.status(400).json({
      ok: false,
      error: err.message || "Failed to generate pledge invoice.",
    });
  } finally {
    conn.release();
  }
});

/* =========================================================
   MARK PAID
========================================================= */

router.post("/:id/mark-paid", async (req, res) => {
  try {
    await pool.query(
      `
      UPDATE tbl_finance_pledges
      SET
        paid_amount = pledged_amount,
        remaining_balance = 0,
        status = 'paid',
        updated_at = NOW()
      WHERE id = ?
      `,
      [req.params.id]
    );

    return res.json({
      ok: true,
      message: "Pledge marked paid.",
    });
  } catch (err) {
    console.error("POST /finance/pledges/:id/mark-paid error:", err);

    return res.status(400).json({
      ok: false,
      error: err.message || "Failed to mark pledge paid.",
    });
  }
});

/* =========================================================
   WRITE OFF
========================================================= */

router.post("/:id/write-off", async (req, res) => {
  try {
    await pool.query(
      `
      UPDATE tbl_finance_pledges
      SET
        status = 'written_off',
        remaining_balance = 0,
        writeoff_reason = ?,
        written_off_at = NOW(),
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        req.body.reason || "Written off by finance.",
        req.params.id,
      ]
    );

    return res.json({
      ok: true,
      message: "Pledge written off.",
    });
  } catch (err) {
    console.error("POST /finance/pledges/:id/write-off error:", err);

    return res.status(400).json({
      ok: false,
      error: err.message || "Failed to write off pledge.",
    });
  }
});

/* =========================================================
   REMINDER
========================================================= */

router.post("/:id/reminder", async (req, res) => {
  try {
    await pool.query(
      `
      UPDATE tbl_finance_pledges
      SET
        last_reminder_sent_at = NOW(),
        last_reminder_subject = ?,
        last_reminder_message = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        req.body.subject || "Pledge Reminder",
        req.body.message || null,
        req.params.id,
      ]
    );

    return res.json({
      ok: true,
      message: "Pledge reminder recorded.",
    });
  } catch (err) {
    console.error("POST /finance/pledges/:id/reminder error:", err);

    return res.status(400).json({
      ok: false,
      error: err.message || "Failed to send pledge reminder.",
    });
  }
});

/* =========================================================
   STATEMENT
========================================================= */

router.get("/:id/statement", async (req, res) => {
  try {
    const [[pledge]] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_pledges
      WHERE id = ?
      LIMIT 1
      `,
      [req.params.id]
    );

    if (!pledge) {
      return res.status(404).json({
        ok: false,
        error: "Pledge not found.",
      });
    }

    const [payments] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_payments
      WHERE pledge_id = ?
      ORDER BY id ASC
      `,
      [pledge.id]
    ).catch(() => [[]]);

    const [receipts] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_receipts
      WHERE pledge_id = ?
      ORDER BY id ASC
      `,
      [pledge.id]
    ).catch(() => [[]]);

    return res.json({
      ok: true,
      pledge,
      payments,
      receipts,
      statement: {
        pledged_amount: pledge.pledged_amount,
        paid_amount: pledge.paid_amount,
        remaining_balance: pledge.remaining_balance,
        status: pledge.status,
      },
    });
  } catch (err) {
    console.error("GET /finance/pledges/:id/statement error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load pledge statement.",
    });
  }
});

/* =========================================================
   DELETE / CANCEL
========================================================= */

router.delete("/:id", async (req, res) => {
  try {
    await pool.query(
      `
      UPDATE tbl_finance_pledges
      SET
        status = 'cancelled',
        cancelled_at = NOW(),
        updated_at = NOW()
      WHERE id = ?
      `,
      [req.params.id]
    );

    return res.json({
      ok: true,
      message: "Pledge cancelled.",
    });
  } catch (err) {
    console.error("DELETE /finance/pledges/:id error:", err);

    return res.status(400).json({
      ok: false,
      error: err.message || "Failed to cancel pledge.",
    });
  }
});

module.exports = router;