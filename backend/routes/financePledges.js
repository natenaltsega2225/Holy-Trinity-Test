// backend/routes/financePledges.js
// backend/routes/financePledges.js

"use strict";

const express = require("express");
const crypto = require("crypto");
const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const campaignRollupService = require("../services/domains/pledge/campaignRollupService");
const pledgeAuditService = require("../services/domains/pledge/pledgeAuditService");
const pledgeReminderService = require("../services/domains/pledge/pledgeReminderService");
const pledgeAgingService = require("../services/domains/pledge/pledgeAgingService");
const pledgeReceivableService = require("../services/domains/pledge/pledgeReceivableService");
const pledgeKpiService = require("../services/domains/pledge/pledgeKpiService");
const campaignDashboardService = require("../services/domains/pledge/campaignDashboardService");
const pledgeScheduleService = require("../services/domains/pledge/pledgeScheduleService");
const pledgeRecurringService = require("../services/domains/pledge/pledgeRecurringService");
const pledgeStatementService = require("../services/domains/pledge/pledgeStatementService");
const pledgeExportService = require("../services/domains/pledge/pledgeExportService");
const pledgeForecastService = require("../services/domains/pledge/pledgeForecastService");
const pledgeWriteoffService = require("../services/domains/pledge/pledgeWriteoffService");
const pledgeCampaignPerformanceService = require("../services/domains/pledge/pledgeCampaignPerformanceService");
const pledgeCollectionAnalyticsService = require("../services/domains/pledge/pledgeCollectionAnalyticsService");

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

const tableCache = new Map();
const columnCache = new Map();

/* =========================================================
   HELPERS
========================================================= */

function clean(value) {
  return String(value ?? "").trim();
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function toInt(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function makeCode(prefix) {
  return `${prefix}-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

function actorId(req) {
  return req.user?.id || req.user?.user_id || req.user?.userId || null;
}

function requestInfo(req) {
  return {
    ip:
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      req.ip ||
      null,
    userAgent: req.headers["user-agent"] || null,
  };
}

function actor(req) {
  return {
    id: actorId(req),
    name:
      req.user?.full_name ||
      req.user?.name ||
      req.user?.email ||
      "Finance User",
    role: req.user?.role || null,
  };
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
  if (tableCache.has(tableName)) return tableCache.get(tableName);

  try {
    const [rows] = await conn.query(`SHOW TABLES LIKE ?`, [tableName]);
    const exists = rows.length > 0;
    tableCache.set(tableName, exists);
    return exists;
  } catch {
    tableCache.set(tableName, false);
    return false;
  }
}

async function getColumns(conn, tableName) {
  if (columnCache.has(tableName)) return columnCache.get(tableName);

  const exists = await tableExists(conn, tableName);

  if (!exists) {
    const empty = new Set();
    columnCache.set(tableName, empty);
    return empty;
  }

  const [rows] = await conn.query(`SHOW COLUMNS FROM \`${tableName}\``);
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

async function updateDynamic(conn, tableName, data, whereSql, whereParams = []) {
  const cols = await getColumns(conn, tableName);

  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) return;

  const setSql = entries.map(([key]) => `\`${key}\` = ?`).join(", ");
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
    SELECT id, member_no, full_name, email, phone
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
    : cols.has("campaign_name")
    ? "campaign_name"
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
    SELECT id, ${selectTitle}, ${selectGoal}
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

  const paymentId = await insertDynamic(conn, "tbl_finance_payments", {
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
  });

  return {
    id: paymentId,
    payment_number: paymentNumber,
    amount: payload.amount,
  };
}

async function createInvoiceRecord(conn, payload) {
  const invoiceNumber = makeCode("INV");

  const invoiceId = await insertDynamic(conn, "tbl_finance_invoices", {
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
  });

  return {
    id: invoiceId,
    invoice_number: invoiceNumber,
  };
}

async function createReceiptRecord(conn, payload) {
  const receiptNumber = makeCode("RCPT");

  const receiptId = await insertDynamic(conn, "tbl_finance_receipts", {
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
  });

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

    await insertDynamic(conn, table, {
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
    });

    return;
  }
}

async function createPledgeReceivableLedger(conn, pledge) {
  await createLedgerEntry(conn, {
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

    description: `Pledge receivable created - ${
      pledge.campaign_name || "Campaign"
    }`,
    source: "finance_pledge_receivable",
    source_reference: pledge.pledge_number,
  });
}

async function createFullPaymentWorkflow(conn, payload) {
  const payment = await createPaymentRecord(conn, payload);

  const invoice = await createInvoiceRecord(conn, {
    ...payload,
    payment_id: payment.id,
    amount: payload.amount,
    status: "paid",
  });

  const receipt = await createReceiptRecord(conn, {
    ...payload,
    payment_id: payment.id,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    amount: payload.amount,
  });

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

  await createLedgerEntry(conn, {
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

    description: `Pledge payment received - ${
      payload.campaign_name || "Campaign"
    }`,
    source: "finance_pledge_payment",
    source_reference: payment.payment_number,
  });

  return {
    payment,
    invoice,
    receipt,
  };
}

/* =========================================================
   AUDIT WRAPPER
========================================================= */

async function audit(req, action, pledgeId, details = {}) {
  try {
    await pledgeAuditService.log({
      action,
      entity_type: "pledge",
      entity_id: pledgeId,

      actor_id: actorId(req),

      actor_name:
        req.user?.full_name ||
        req.user?.email ||
        "Finance User",

      role: req.user?.role,

      ip:
        req.headers["x-forwarded-for"] ||
        req.socket?.remoteAddress,

      user_agent:
        req.headers["user-agent"],

      details,
    });
  } catch (err) {
    console.error(
      "pledge audit failed",
      err.message
    );
  }
}

/* =========================================================
   BUILD PAYLOAD
========================================================= */

async function buildPledgePayload(
  conn,
  req,
  existing = null
) {
  const body = req.body || {};

  const memberId =
    body.member_id ??
    existing?.member_id ??
    null;

  const member =
    await getMember(
      conn,
      memberId
    );

  const campaign =
    await getCampaign(
      conn,
      body.campaign_id ||
        existing?.campaign_id
    );

  const pledgedAmount =
    money(
      body.pledged_amount ??
        existing?.pledged_amount
    );

  const upfrontAmount =
    money(
      body.upfront_amount ??
        existing?.upfront_amount ??
        0
    );

  if (
    pledgedAmount <= 0
  ) {
    throw new Error(
      "Pledged amount is required."
    );
  }

  if (
    upfrontAmount >
    pledgedAmount
  ) {
    throw new Error(
      "Upfront payment cannot exceed pledge."
    );
  }

  const paidAmount =
    existing
      ? money(
          Number(
            existing.paid_amount || 0
          ) -
            Number(
              existing.upfront_amount ||
                0
            ) +
            upfrontAmount
        )
      : upfrontAmount;

  const remainingBalance =
    money(
      pledgedAmount -
        paidAmount
    );

  return {
    actor_id:
      actorId(req),

    member_id:
      member?.id || null,

    member_no:
      member?.member_no ||
      null,

    full_name:
      member?.full_name ||
      body.guest
        ?.full_name ||
      body.full_name ||
      "Guest Donor",

    email:
      member?.email ||
      body.guest?.email ||
      body.email ||
      null,

    phone:
      member?.phone ||
      body.guest?.phone ||
      body.phone ||
      null,

    campaign_id:
      campaign?.id || null,

    campaign_name:
      campaign?.campaign_name ||
      campaign?.name ||
      "Campaign",

    pledge_type:
      body.pledge_type ||
      existing?.pledge_type ||
      "promise_to_pay",

    pledge_type_label:
      pledgeTypeLabel(
        body.pledge_type ||
          existing?.pledge_type
      ),

    pledged_amount:
      pledgedAmount,

    upfront_amount:
      upfrontAmount,

    paid_amount:
      paidAmount,

    remaining_balance:
      remainingBalance,

    status:
      pledgeStatus(
        pledgedAmount,
        paidAmount,
        existing?.status
      ),

    due_date:
      body.due_date ||
      existing?.due_date ||
      null,

    reminder_date:
      body.reminder_date ||
      existing?.reminder_date ||
      null,

    frequency:
      body.frequency ||
      existing?.frequency ||
      "one_time",

    notes:
      body.notes ||
      existing?.notes ||
      null,

    payment_method:
      normalizePaymentMethod(
        body.payment_method
      ),
  };
}

/* =========================================================
   CREATE PLEDGE
========================================================= */

router.post(
  "/",
  async (req, res) => {
    const conn =
      await pool.getConnection();

    try {
      await conn.beginTransaction();

      const payload =
        await buildPledgePayload(
          conn,
          req
        );

      const pledgeNumber =
        makeCode("PLG");

      const pledgeId =
        await insertDynamic(
          conn,
          "tbl_finance_pledges",
          {
            pledge_number:
              pledgeNumber,

            campaign_id:
              payload.campaign_id,

            campaign_name:
              payload.campaign_name,

            member_id:
              payload.member_id,

            member_no:
              payload.member_no,

            full_name_snapshot:
              payload.full_name,

            email_snapshot:
              payload.email,

            phone_snapshot:
              payload.phone,

            pledge_type:
              payload.pledge_type,

            pledge_type_label:
              payload.pledge_type_label,

            pledged_amount:
              payload.pledged_amount,

            upfront_amount:
              payload.upfront_amount,

            paid_amount:
              payload.paid_amount,

            remaining_balance:
              payload.remaining_balance,

            status:
              payload.status,

            due_date:
              payload.due_date,

            reminder_date:
              payload.reminder_date,

            frequency:
              payload.frequency,

            notes:
              payload.notes,

            created_by:
              payload.actor_id,

            created_at:
              new Date(),

            updated_at:
              new Date(),
          }
        );

      await audit(
        req,
        "pledge_created",
        pledgeId,
        {
          pledge_number:
            pledgeNumber,
          amount:
            payload.pledged_amount,
        }
      );

      if (
        payload.remaining_balance >
        0
      ) {
        await createPledgeReceivableLedger(
          conn,
          {
            ...payload,
            pledge_id:
              pledgeId,
            pledge_number:
              pledgeNumber,
          }
        );
      }

      if (
        payload.frequency !==
        "one_time"
      ) {
        await pledgeRecurringService.createRecurringPledge(
          {
            pledge_id:
              pledgeId,

            frequency:
              payload.frequency,

            amount:
              payload.remaining_balance,

            actor_id:
              payload.actor_id,
          }
        );
      }

      if (
        payload.due_date
      ) {
        await pledgeScheduleService.createSchedule(
          {
            pledge_id:
              pledgeId,

            due_date:
              payload.due_date,

            amount:
              payload.remaining_balance,
          }
        );
      }

      let workflow =
        null;

      if (
        payload.upfront_amount >
        0
      ) {
        workflow =
          await createFullPaymentWorkflow(
            conn,
            {
              ...payload,

              pledge_id:
                pledgeId,

              pledge_number:
                pledgeNumber,

              amount:
                payload.upfront_amount,

              method:
                payload.payment_method,
            }
          );
      }

      await conn.commit();

      res.status(201).json({
        ok: true,

        pledge_id:
          pledgeId,

        pledge_number:
          pledgeNumber,

        status:
          payload.status,

        payment:
          workflow?.payment,

        invoice:
          workflow?.invoice,

        receipt:
          workflow?.receipt,
      });
    } catch (err) {
      await conn.rollback();

      res.status(400).json({
        ok: false,
        error:
          err.message,
      });
    } finally {
      conn.release();
    }
  }
);

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

    await pledgeAuditService.logPledgeUpdated(
      existing,
      {
        ...existing,
        ...payload,
        id: Number(req.params.id),
        pledge_number: existing.pledge_number,
      },
      actor(req),
      requestInfo(req)
    ).catch(() => {});

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
      FOR UPDATE
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

    const method = normalizePaymentMethod(
      req.body.method || req.body.payment_method
    );

    const paidAmount = money(Number(pledge.paid_amount || 0) + amount);
    const remainingBalance = money(Number(pledge.pledged_amount || 0) - paidAmount);
    const nextStatus = pledgeStatus(pledge.pledged_amount, paidAmount);

    const workflow = await createFullPaymentWorkflow(conn, {
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
      method,
      provider: method,

      reference_no: req.body.reference_no || null,
      description: `Pledge payment - ${pledge.campaign_name || "Campaign"}`,

      actor_id: actorId(req),
    });

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

    await pledgeScheduleService.applyPaymentToSchedule({
      pledgeId: pledge.id,
      paymentId: workflow.payment.id,
      paymentNumber: workflow.payment.payment_number,
      invoiceId: workflow.invoice.id,
      invoiceNumber: workflow.invoice.invoice_number,
      receiptId: workflow.receipt.id,
      receiptNumber: workflow.receipt.receipt_number,
      amount,
      actorId: actorId(req),
    }).catch(() => {});

    await pledgeAuditService.logPaymentApplied({
      pledge,
      payment: workflow.payment,
      invoice: workflow.invoice,
      receipt: workflow.receipt,
      user: actor(req),
      requestInfo: requestInfo(req),
    }).catch(() => {});

    if (
      workflow?.receipt?.id &&
      pledge.email_snapshot &&
      sendReceiptEmail &&
      req.body?.send_receipt !== false
    ) {
      try {
        await sendReceiptEmail(workflow.receipt.id, {
          email: pledge.email_snapshot,
        });
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
   GENERATE INVOICE
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

    const balance = money(pledge.remaining_balance);

    if (balance <= 0) {
      throw new Error("No remaining balance to invoice.");
    }

    const invoice = await createInvoiceRecord(conn, {
      pledge_id: pledge.id,
      pledge_number: pledge.pledge_number,

      campaign_id: pledge.campaign_id || null,
      campaign_name: pledge.campaign_name || "Pledge Campaign",

      member_id: pledge.member_id || null,
      member_no: pledge.member_no || null,

      full_name: pledge.full_name_snapshot || "Guest Donor",
      email: pledge.email_snapshot || null,
      phone: pledge.phone_snapshot || null,

      amount: balance,
      status: "open",
      due_date: req.body.due_date || pledge.due_date || null,

      description: `Pledge receivable invoice - ${
        pledge.campaign_name || "Campaign"
      }`,

      actor_id: actorId(req),
    });

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

    await pledgeAuditService.logInvoiceGenerated({
      pledge,
      invoice,
      user: actor(req),
      requestInfo: requestInfo(req),
    }).catch(() => {});

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
   SEND REMINDER
========================================================= */

router.post("/:id/reminder", async (req, res) => {
  try {
    const result = await pledgeReminderService.sendPledgeReminder({
      pledgeId: req.params.id,
      email: req.body.email,
      subject: req.body.subject,
      message: req.body.message,
      user: actor(req),
      requestInfo: requestInfo(req),
    });

    return res.json({
      ok: true,
      message: "Pledge reminder sent.",
      result,
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
   MARK PAID
========================================================= */

router.post("/:id/mark-paid", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [[pledge]] = await conn.query(
      `
      SELECT *
      FROM tbl_finance_pledges
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [req.params.id]
    );

    if (!pledge) {
      throw new Error("Pledge not found.");
    }

    await updateDynamic(
      conn,
      "tbl_finance_pledges",
      {
        paid_amount: pledge.pledged_amount,
        remaining_balance: 0,
        status: "paid",
        updated_by: actorId(req),
        updated_at: new Date(),
      },
      "id = ?",
      [pledge.id]
    );

    await conn.commit();

    await pledgeAuditService.createAuditLog({
      actorId: actorId(req),
      actorName: actor(req).name,
      actorRole: actor(req).role,
      entityType: "pledge",
      entityId: pledge.id,
      entityNumber: pledge.pledge_number,
      action: "pledge_marked_paid",
      description: `Pledge ${pledge.pledge_number} marked paid.`,
      beforeData: pledge,
      afterData: {
        ...pledge,
        paid_amount: pledge.pledged_amount,
        remaining_balance: 0,
        status: "paid",
      },
      ipAddress: requestInfo(req).ip,
      userAgent: requestInfo(req).userAgent,
    }).catch(() => {});

    return res.json({
      ok: true,
      message: "Pledge marked paid.",
    });
  } catch (err) {
    await conn.rollback();

    console.error("POST /finance/pledges/:id/mark-paid error:", err);

    return res.status(400).json({
      ok: false,
      error: err.message || "Failed to mark pledge paid.",
    });
  } finally {
    conn.release();
  }
});

/* =========================================================
   WRITE OFF
========================================================= */

router.post("/:id/write-off", async (req, res) => {
  try {
    const result = await pledgeWriteoffService.writeoffPledge({
      pledgeId: req.params.id,
      reason: req.body.reason || "Written off by finance.",
      notes: req.body.notes || null,
      approvedBy: actorId(req),
    });

    return res.json({
      ok: true,
      message: "Pledge written off.",
      result,
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
   CANCEL / DELETE
========================================================= */

router.delete("/:id", async (req, res) => {
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

    await updateDynamic(
      conn,
      "tbl_finance_pledges",
      {
        status: "cancelled",
        cancelled_at: new Date(),
        updated_by: actorId(req),
        updated_at: new Date(),
      },
      "id = ?",
      [pledge.id]
    );

    await conn.commit();

    await pledgeAuditService.logPledgeCancelled({
      pledge,
      reason: req.body?.reason || "Cancelled by finance.",
      user: actor(req),
      requestInfo: requestInfo(req),
    }).catch(() => {});

    return res.json({
      ok: true,
      message: "Pledge cancelled.",
    });
  } catch (err) {
    await conn.rollback();

    console.error("DELETE /finance/pledges/:id error:", err);

    return res.status(400).json({
      ok: false,
      error: err.message || "Failed to cancel pledge.",
    });
  } finally {
    conn.release();
  }
});
/* =========================================================
   ENTERPRISE DASHBOARD ROUTES
========================================================= */

router.get("/dashboard/summary", async (req, res) => {
  try {
    const [
      kpis,
      receivables,
      aging,
      forecast,
      analytics,
      campaignDashboard,
    ] = await Promise.all([
      pledgeKpiService.getPledgeDashboardKpis(),
      pledgeReceivableService.getReceivableDashboard(req.query),
      pledgeAgingService.getAgingSummary(req.query),
      pledgeForecastService.getDashboardForecast(),
      pledgeCollectionAnalyticsService.getExecutiveDashboard(),
      campaignDashboardService.getCampaignDashboard(req.query),
    ]);

    return res.json({
      ok: true,
      generated_at: new Date().toISOString(),
      kpis,
      receivables,
      aging,
      forecast,
      analytics,
      campaignDashboard,
    });
  } catch (err) {
    console.error("GET /finance/pledges/dashboard/summary error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load pledge dashboard.",
    });
  }
});

/* =========================================================
   KPI DASHBOARD
========================================================= */

router.get("/kpis", async (req, res) => {
  try {
    const data = await pledgeKpiService.getPledgeDashboardKpis();

    return res.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error("GET /finance/pledges/kpis error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load pledge KPIs.",
    });
  }
});

/* =========================================================
   AGING DASHBOARD
========================================================= */

router.get("/aging", async (req, res) => {
  try {
    const [summary, rows, campaignAging] = await Promise.all([
      pledgeAgingService.getAgingSummary(req.query),
      pledgeAgingService.getAgingRows(req.query),
      pledgeAgingService.getCampaignAging(req.query),
    ]);

    return res.json({
      ok: true,
      summary: summary.summary || summary,
      rows: rows.rows || [],
      campaignAging: campaignAging.rows || [],
      pagination: rows.pagination,
    });
  } catch (err) {
    console.error("GET /finance/pledges/aging error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load pledge aging.",
    });
  }
});

/* =========================================================
   RECEIVABLE DASHBOARD
========================================================= */

router.get("/receivables", async (req, res) => {
  try {
    const [dashboard, rows] = await Promise.all([
      pledgeReceivableService.getReceivableDashboard(req.query),
      pledgeReceivableService.getReceivables(req.query),
    ]);

    return res.json({
      ok: true,
      summary: dashboard.summary,
      topReceivables: dashboard.topReceivables,
      rows: rows.rows,
      pagination: rows.pagination,
    });
  } catch (err) {
    console.error("GET /finance/pledges/receivables error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load pledge receivables.",
    });
  }
});

/* =========================================================
   FORECAST DASHBOARD
========================================================= */

router.get("/forecast", async (req, res) => {
  try {
    const data = await pledgeForecastService.getDashboardForecast();

    return res.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error("GET /finance/pledges/forecast error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load pledge forecast.",
    });
  }
});

/* =========================================================
   COLLECTION ANALYTICS
========================================================= */

router.get("/analytics", async (req, res) => {
  try {
    const data = await pledgeCollectionAnalyticsService.getExecutiveDashboard();

    return res.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error("GET /finance/pledges/analytics error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load pledge analytics.",
    });
  }
});

/* =========================================================
   CAMPAIGN DASHBOARD
========================================================= */

router.get("/campaign-dashboard", async (req, res) => {
  try {
    const data = await campaignDashboardService.getCampaignDashboard(req.query);

    return res.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error("GET /finance/pledges/campaign-dashboard error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load campaign pledge dashboard.",
    });
  }
});

/* =========================================================
   CAMPAIGN PERFORMANCE
========================================================= */

router.get("/campaign-performance", async (req, res) => {
  try {
    const data =
      await pledgeCampaignPerformanceService.getExecutiveSummary();

    return res.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error("GET /finance/pledges/campaign-performance error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load campaign performance.",
    });
  }
});

/* =========================================================
   CAMPAIGN ROLLUPS
========================================================= */

router.get("/campaign-rollups", async (req, res) => {
  try {
    const data = await campaignRollupService.getCampaignRollups(req.query);

    return res.json({
      ok: true,
      ...data,
    });
  } catch (err) {
    console.error("GET /finance/pledges/campaign-rollups error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load campaign rollups.",
    });
  }
});

/* =========================================================
   WRITEOFF DASHBOARD
========================================================= */

router.get("/writeoffs/summary", async (_req, res) => {
  try {
    const data = await pledgeWriteoffService.getExecutiveSummary();

    return res.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error("GET /finance/pledges/writeoffs/summary error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load write-off summary.",
    });
  }
});

/* =========================================================
   REMINDER DASHBOARD
========================================================= */

router.get("/reminders/stats", async (req, res) => {
  try {
    const data = await pledgeReminderService.getReminderStats(req.query);

    return res.json({
      ok: true,
      ...data,
    });
  } catch (err) {
    console.error("GET /finance/pledges/reminders/stats error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to load reminder stats.",
    });
  }
});

/* =========================================================
   PROCESS OVERDUE
========================================================= */

router.post("/processors/overdue", async (req, res) => {
  try {
    const [aging, schedule] = await Promise.all([
      pledgeAgingService.markOverduePledges(req.body || {}),
      pledgeScheduleService.markOverdueScheduleItems(req.body || {}),
    ]);

    return res.json({
      ok: true,
      aging,
      schedule,
    });
  } catch (err) {
    console.error("POST /finance/pledges/processors/overdue error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to process overdue pledges.",
    });
  }
});

/* =========================================================
   PROCESS AUTO REMINDERS
========================================================= */

router.post("/processors/reminders", async (req, res) => {
  try {
    const result = await pledgeReminderService.processAutoReminders({
      ...(req.body || {}),
      user: {
        id: actorId(req),
        name: actor(req).name,
        role: actor(req).role,
      },
    });

    return res.json({
      ok: true,
      result,
    });
  } catch (err) {
    console.error("POST /finance/pledges/processors/reminders error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to process pledge reminders.",
    });
  }
});

/* =========================================================
   PROCESS RECURRING PLEDGES
========================================================= */

router.post("/processors/recurring", async (req, res) => {
  try {
    const result = await pledgeRecurringService.processRecurringPledges({
      ...(req.body || {}),
      actorId: actorId(req),
    });

    return res.json({
      ok: true,
      result,
    });
  } catch (err) {
    console.error("POST /finance/pledges/processors/recurring error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to process recurring pledges.",
    });
  }
});

/* =========================================================
   STATEMENT API
========================================================= */

router.get("/:id/statement", async (req, res) => {
  try {
    const statement =
      await pledgeStatementService.getPledgeStatement(
        req.params.id,
        req.query
      );

    return res.json({
      ok: true,
      ...statement,
    });
  } catch (err) {
    console.error(
      "GET /finance/pledges/:id/statement error:",
      err
    );

    return res.status(500).json({
      ok: false,
      error:
        err.message ||
        "Failed to load pledge statement.",
    });
  }
});

/* =========================================================
   STATEMENT SUMMARY
========================================================= */

router.get("/statement-summary/all", async (_req, res) => {
  try {
    const summary =
      await pledgeStatementService.getStatementSummary();

    return res.json({
      ok: true,
      summary,
    });
  } catch (err) {
    console.error(
      "GET /finance/pledges/statement-summary error:",
      err
    );

    return res.status(500).json({
      ok: false,
      error:
        err.message ||
        "Failed to load statement summary.",
    });
  }
});

/* =========================================================
   EXPORT CSV
========================================================= */

router.get("/export/csv", async (req, res) => {
  try {
    const result =
      await pledgeExportService.exportCsv(
        req.query
      );

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error(
      "GET /finance/pledges/export/csv error:",
      err
    );

    return res.status(500).json({
      ok: false,
      error:
        err.message ||
        "CSV export failed.",
    });
  }
});

/* =========================================================
   EXPORT EXCEL
========================================================= */

router.get("/export/excel", async (req, res) => {
  try {
    const result =
      await pledgeExportService.exportExcel(
        req.query
      );

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error(
      "GET /finance/pledges/export/excel error:",
      err
    );

    return res.status(500).json({
      ok: false,
      error:
        err.message ||
        "Excel export failed.",
    });
  }
});

/* =========================================================
   PAYMENT SCHEDULE
========================================================= */

router.get("/:id/schedule", async (req, res) => {
  try {
    const schedule =
      await pledgeScheduleService.getSchedule(
        req.params.id
      );

    return res.json({
      ok: true,
      schedule,
    });
  } catch (err) {
    console.error(
      "GET /finance/pledges/:id/schedule error:",
      err
    );

    return res.status(500).json({
      ok: false,
      error:
        err.message ||
        "Failed to load pledge schedule.",
    });
  }
});

/* =========================================================
   BUILD PAYMENT SCHEDULE
========================================================= */

router.post("/:id/schedule", async (req, res) => {
  try {
    const result =
      await pledgeScheduleService.buildSchedule(
        req.params.id,
        req.body,
        actorId(req)
      );

    return res.json({
      ok: true,
      result,
    });
  } catch (err) {
    console.error(
      "POST /finance/pledges/:id/schedule error:",
      err
    );

    return res.status(400).json({
      ok: false,
      error:
        err.message ||
        "Failed to build pledge schedule.",
    });
  }
});

/* =========================================================
   RECURRING CONFIGURATION
========================================================= */

router.get("/:id/recurring", async (req, res) => {
  try {
    const recurring =
      await pledgeRecurringService.getRecurringPlan(
        req.params.id
      );

    return res.json({
      ok: true,
      recurring,
    });
  } catch (err) {
    console.error(
      "GET /finance/pledges/:id/recurring error:",
      err
    );

    return res.status(500).json({
      ok: false,
      error:
        err.message ||
        "Failed to load recurring pledge.",
    });
  }
});

/* =========================================================
   ENABLE RECURRING
========================================================= */

router.post("/:id/recurring", async (req, res) => {
  try {
    const result =
      await pledgeRecurringService.enableRecurring(
        req.params.id,
        req.body,
        actorId(req)
      );

    return res.json({
      ok: true,
      result,
    });
  } catch (err) {
    console.error(
      "POST /finance/pledges/:id/recurring error:",
      err
    );

    return res.status(400).json({
      ok: false,
      error:
        err.message ||
        "Failed to enable recurring pledge.",
    });
  }
});

/* =========================================================
   AUDIT HISTORY
========================================================= */

router.get("/:id/audit", async (req, res) => {
  try {
    const audit =
      await pledgeAuditService.getPledgeAuditTrail(
        req.params.id
      );

    return res.json({
      ok: true,
      audit,
    });
  } catch (err) {
    console.error(
      "GET /finance/pledges/:id/audit error:",
      err
    );

    return res.status(500).json({
      ok: false,
      error:
        err.message ||
        "Failed to load audit trail.",
    });
  }
});

/* =========================================================
   REMINDER HISTORY
========================================================= */

router.get("/:id/reminders", async (req, res) => {
  try {
    const history =
      await pledgeReminderService.getReminderHistory(
        req.params.id
      );

    return res.json({
      ok: true,
      history,
    });
  } catch (err) {
    console.error(
      "GET /finance/pledges/:id/reminders error:",
      err
    );

    return res.status(500).json({
      ok: false,
      error:
        err.message ||
        "Failed to load reminder history.",
    });
  }
});

/* =========================================================
   GET PLEDGE DETAILS
========================================================= */

router.get("/:id", async (req, res) => {
  try {
    const pledge =
      await pledgeStatementService.getPledgeOverview(
        req.params.id
      );

    return res.json({
      ok: true,
      pledge,
    });
  } catch (err) {
    console.error(
      "GET /finance/pledges/:id error:",
      err
    );

    return res.status(404).json({
      ok: false,
      error:
        err.message ||
        "Pledge not found.",
    });
  }
});

/* =========================================================
   PLEDGE LIST
========================================================= */

router.get("/", async (req, res) => {
  try {
    const result =
      await pledgeReceivableService.getPledges(
        req.query
      );

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error(
      "GET /finance/pledges error:",
      err
    );

    return res.status(500).json({
      ok: false,
      error:
        err.message ||
        "Failed to load pledges.",
    });
  }
});

/* =========================================================
   HEALTH CHECK
========================================================= */

router.get("/health/check", async (_req, res) => {
  return res.json({
    ok: true,
    module: "financePledges",
    version: "enterprise",
    timestamp: new Date().toISOString(),
  });
});

/* =========================================================
   EXPORT
========================================================= */

module.exports = router;