// backend/services/domains/pledge/pledgeReminderService.js
"use strict";

const crypto = require("crypto");
const pool = require("../../../db");

function optionalRequire(path, fallback = {}) {
  try {
    return require(path);
  } catch (_err) {
    return fallback;
  }
}

const invoiceGenerationService = optionalRequire("../invoices/invoiceGenerationService");
const invoiceEmailService = optionalRequire("../invoices/invoiceEmailService");
const publicAccess = optionalRequire("../invoices/invoicePublicAccessService");
const emailService = optionalRequire("../../emailService");

let trackingService = {};
let historyService = {};

try {
  trackingService = require("./pledgeEmailTrackingService");
} catch (_err) {
  trackingService = {};
}

try {
  historyService = require("./pledgeReminderHistoryService");
} catch (_err) {
  historyService = {};
}

const PLEDGES_TABLE = "tbl_finance_pledges";
const DEFAULT_LIMIT = 100;
const DEFAULT_LOOKAHEAD_DAYS = 7;
const DEFAULT_COOLDOWN_DAYS = 7;
const META_TTL_MS = 60 * 1000;

const tableCache = new Map();
const columnCache = new Map();

function clean(value, max = 255) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function escapeHtml(value) {
  return clean(value, 5000)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeEmail(value) {
  return clean(value, 190).toLowerCase();
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function formatMoney(value) {
  return money(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : fallback;
}

function mysqlDateTime(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return mysqlDateTime(new Date());
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function daysUntil(dateValue, now = new Date()) {
  const due = new Date(dateValue);
  if (Number.isNaN(due.getTime())) return null;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function sqlId(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(String(name || ""))) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }

  return `\`${name}\``;
}

async function tableExists(conn, tableName) {
  const cached = tableCache.get(tableName);

  if (cached && Date.now() - cached.loadedAt < META_TTL_MS) {
    return cached.exists;
  }

  const [rows] = await conn.query("SHOW TABLES LIKE ?", [tableName]);
  const exists = rows.length > 0;

  tableCache.set(tableName, {
    exists,
    loadedAt: Date.now(),
  });

  return exists;
}

async function getColumns(conn, tableName) {
  const cached = columnCache.get(tableName);

  if (cached && Date.now() - cached.loadedAt < META_TTL_MS) {
    return cached.columns;
  }

  if (!(await tableExists(conn, tableName))) {
    const empty = new Set();

    columnCache.set(tableName, {
      columns: empty,
      loadedAt: Date.now(),
    });

    return empty;
  }

  const [rows] = await conn.query(`SHOW COLUMNS FROM ${sqlId(tableName)}`);
  const columns = new Set(rows.map((row) => row.Field));

  columnCache.set(tableName, {
    columns,
    loadedAt: Date.now(),
  });

  return columns;
}

function firstColumn(cols, alias, names, fallback = "NULL") {
  for (const name of names) {
    if (cols.has(name)) return `${alias}.${sqlId(name)}`;
  }

  return fallback;
}

async function updateExistingColumns(conn, tableName, data, whereSql, whereParams) {
  const cols = await getColumns(conn, tableName);

  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) return 0;

  const setSql = entries.map(([key]) => `${sqlId(key)} = ?`).join(", ");
  const values = entries.map(([, value]) => value);

  const [result] = await conn.query(
    `UPDATE ${sqlId(tableName)} SET ${setSql} WHERE ${whereSql}`,
    [...values, ...whereParams]
  );

  return result.affectedRows || 0;
}

async function insertExistingColumns(conn, tableName, data) {
  const cols = await getColumns(conn, tableName);

  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) return null;

  const insertCols = entries.map(([key]) => sqlId(key));
  const placeholders = entries.map(() => "?");
  const values = entries.map(([, value]) => value);

  const [result] = await conn.query(
    `
    INSERT INTO ${sqlId(tableName)}
    (${insertCols.join(", ")})
    VALUES (${placeholders.join(", ")})
    `,
    values
  );

  return result;
}

function safeJson(value, fallback = null) {
  try {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "string") {
      JSON.parse(value);
      return value;
    }

    return JSON.stringify(value);
  } catch (_err) {
    return fallback;
  }
}

async function buildPledgeSelectParts(conn) {
  const pledgeCols = await getColumns(conn, PLEDGES_TABLE);
  const hasMembers = await tableExists(conn, "tbl_members");
  const hasUsers = await tableExists(conn, "tbl_users");
  const hasCampaigns = await tableExists(conn, "tbl_finance_campaigns");

  const memberCols = hasMembers ? await getColumns(conn, "tbl_members") : new Set();
  const campaignCols = hasCampaigns
    ? await getColumns(conn, "tbl_finance_campaigns")
    : new Set();

  const dueExpr = firstColumn(
    pledgeCols,
    "p",
    ["due_date", "next_due_at", "pledge_due_date", "scheduled_date"],
    "NULL"
  );

  const pledgedExpr = firstColumn(
    pledgeCols,
    "p",
    ["pledged_amount", "amount", "total_amount"],
    "0"
  );

  const paidExpr = firstColumn(
    pledgeCols,
    "p",
    ["paid_amount", "amount_paid", "collected_amount"],
    "0"
  );

  const amountDueExpr = firstColumn(
    pledgeCols,
    "p",
    ["remaining_balance", "balance_due", "outstanding_amount"],
    `GREATEST(COALESCE(${pledgedExpr}, 0) - COALESCE(${paidExpr}, 0), 0)`
  );

  const statusExpr = firstColumn(pledgeCols, "p", ["status"], "'receivable'");

  const memberJoin =
    hasMembers && pledgeCols.has("member_id") && memberCols.has("id")
      ? "LEFT JOIN tbl_members m ON m.id = p.member_id"
      : "";

  const campaignJoin =
    hasCampaigns && pledgeCols.has("campaign_id") && campaignCols.has("id")
      ? "LEFT JOIN tbl_finance_campaigns c ON c.id = p.campaign_id"
      : "";

  const emailParts = [];
  if (pledgeCols.has("email")) emailParts.push("p.email");
  if (pledgeCols.has("email_snapshot")) emailParts.push("p.email_snapshot");
  if (pledgeCols.has("donor_email")) emailParts.push("p.donor_email");
  if (pledgeCols.has("guest_email")) emailParts.push("p.guest_email");
  if (pledgeCols.has("payer_email")) emailParts.push("p.payer_email");
  if (memberCols.has("email")) emailParts.push("m.email");
  if (hasUsers && pledgeCols.has("member_id")) {
    emailParts.push(
      "(SELECT u.email FROM tbl_users u WHERE u.member_id = p.member_id AND u.email IS NOT NULL ORDER BY u.id ASC LIMIT 1)"
    );
  }

  const phoneParts = [];
  if (pledgeCols.has("phone")) phoneParts.push("p.phone");
  if (pledgeCols.has("phone_snapshot")) phoneParts.push("p.phone_snapshot");
  if (pledgeCols.has("donor_phone")) phoneParts.push("p.donor_phone");
  if (pledgeCols.has("guest_phone")) phoneParts.push("p.guest_phone");
  if (pledgeCols.has("payer_phone")) phoneParts.push("p.payer_phone");
  if (memberCols.has("phone")) phoneParts.push("m.phone");

  const nameParts = [];
  if (pledgeCols.has("full_name_snapshot")) nameParts.push("p.full_name_snapshot");
  if (pledgeCols.has("donor_name")) nameParts.push("p.donor_name");
  if (pledgeCols.has("guest_name")) nameParts.push("p.guest_name");
  if (pledgeCols.has("payer_name")) nameParts.push("p.payer_name");
  if (pledgeCols.has("full_name")) nameParts.push("p.full_name");
  if (pledgeCols.has("name")) nameParts.push("p.name");
  if (memberCols.has("full_name")) nameParts.push("m.full_name");
  if (hasUsers && pledgeCols.has("member_id")) {
    nameParts.push(
      "(SELECT u.full_name FROM tbl_users u WHERE u.member_id = p.member_id AND u.full_name IS NOT NULL ORDER BY u.id ASC LIMIT 1)"
    );
  }

  const memberNoParts = [];
  if (pledgeCols.has("member_no")) memberNoParts.push("p.member_no");
  if (pledgeCols.has("member_number")) memberNoParts.push("p.member_number");
  if (memberCols.has("member_no")) memberNoParts.push("m.member_no");
  if (memberCols.has("member_number")) memberNoParts.push("m.member_number");

  const campaignNameParts = [];
  if (pledgeCols.has("campaign_name")) campaignNameParts.push("p.campaign_name");
  if (campaignCols.has("campaign_name")) campaignNameParts.push("c.campaign_name");
  if (campaignCols.has("title")) campaignNameParts.push("c.title");
  if (campaignCols.has("name")) campaignNameParts.push("c.name");

  return {
    pledgeCols,
    dueExpr,
    amountDueExpr,
    statusExpr,
    memberJoin,
    campaignJoin,
    selectSql: `
      SELECT
        p.id AS pledge_id,
        ${firstColumn(pledgeCols, "p", ["member_id"], "NULL")} AS member_id,
        ${memberNoParts.length ? `COALESCE(${memberNoParts.join(", ")})` : "NULL"} AS member_no,
        ${firstColumn(pledgeCols, "p", ["campaign_id"], "NULL")} AS campaign_id,
        ${firstColumn(pledgeCols, "p", ["pledge_number", "reference_no", "pledge_no"], "NULL")} AS pledge_number,
        ${statusExpr} AS status,
        ${dueExpr} AS due_date,
        ${pledgedExpr} AS pledged_amount,
        ${paidExpr} AS paid_amount,
        ${amountDueExpr} AS amount_due,
        ${firstColumn(pledgeCols, "p", ["reminder_count"], "0")} AS reminder_count,
        ${firstColumn(pledgeCols, "p", ["last_reminder_at", "last_reminder_sent_at"], "NULL")} AS last_reminder_at,
        ${firstColumn(pledgeCols, "p", ["next_reminder_at"], "NULL")} AS next_reminder_at,
        ${emailParts.length ? `COALESCE(${emailParts.join(", ")})` : "NULL"} AS email,
        ${phoneParts.length ? `COALESCE(${phoneParts.join(", ")})` : "NULL"} AS phone,
        ${nameParts.length ? `COALESCE(${nameParts.join(", ")})` : "NULL"} AS full_name,
        ${campaignNameParts.length ? `COALESCE(${campaignNameParts.join(", ")})` : "NULL"} AS campaign_name
      FROM ${PLEDGES_TABLE} p
      ${memberJoin}
      ${campaignJoin}
    `,
  };
}

function formatPledge(row, now = new Date()) {
  const memberId = Number(row.member_id || 0) || null;
  const email = normalizeEmail(row.email);

  return {
    pledge_id: row.pledge_id,
    member_id: memberId,
    member_no: clean(row.member_no, 80) || null,
    payer_type: memberId ? "member" : "non_member",

    campaign_id: row.campaign_id || null,
    pledge_number: clean(row.pledge_number) || `Pledge #${row.pledge_id}`,
    status: clean(row.status, 40).toLowerCase() || "receivable",
    due_date: row.due_date || null,

    pledged_amount: money(row.pledged_amount),
    paid_amount: money(row.paid_amount),
    amount_due: money(row.amount_due),

    reminder_count: Number(row.reminder_count || 0),
    last_reminder_at: row.last_reminder_at || null,
    next_reminder_at: row.next_reminder_at || null,

    email,
    phone: clean(row.phone, 80) || null,
    full_name: clean(row.full_name, 180) || (memberId ? "Member" : "Guest Donor"),
    campaign_name: clean(row.campaign_name, 180) || "Church pledge",

    days_until_due: daysUntil(row.due_date, now),
  };
}

async function getPledgeForReminder(pledgeId, options = {}) {
  const conn = await pool.getConnection();

  try {
    if (!(await tableExists(conn, PLEDGES_TABLE))) return null;

    const parts = await buildPledgeSelectParts(conn);

    const [rows] = await conn.query(
      `
      ${parts.selectSql}
      WHERE p.id = ?
      LIMIT 1
      `,
      [pledgeId]
    );

    return rows[0] ? formatPledge(rows[0], options.now || new Date()) : null;
  } finally {
    conn.release();
  }
}

async function getReminderCandidates(options = {}) {
  const conn = await pool.getConnection();

  try {
    if (!(await tableExists(conn, PLEDGES_TABLE))) return [];

    const parts = await buildPledgeSelectParts(conn);
    const lookAheadDays = toInt(options.lookAheadDays, DEFAULT_LOOKAHEAD_DAYS);
    const limit = Math.min(500, toInt(options.limit, DEFAULT_LIMIT));

    const where = [
      `${parts.dueExpr} IS NOT NULL`,
      `DATE(${parts.dueExpr}) <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`,
      `COALESCE(${parts.amountDueExpr}, 0) > 0`,
    ];

    if (parts.pledgeCols.has("status")) {
      where.push(`
        LOWER(p.status) IN (
          'receivable',
          'partial',
          'invoiced',
          'open',
          'pending',
          'overdue',
          'active'
        )
      `);
    }

    if (parts.pledgeCols.has("next_reminder_at")) {
      where.push("(p.next_reminder_at IS NULL OR p.next_reminder_at <= NOW())");
    }

    const [rows] = await conn.query(
      `
      ${parts.selectSql}
      WHERE ${where.join(" AND ")}
      ORDER BY DATE(${parts.dueExpr}) ASC, p.id ASC
      LIMIT ?
      `,
      [lookAheadDays, limit]
    );

    return rows.map((row) => formatPledge(row, options.now || new Date()));
  } finally {
    conn.release();
  }
}

function checkReminderEligibility(pledge, options = {}) {
  if (!pledge) return { ok: false, reason: "pledge_not_found" };
  if (!normalizeEmail(options.to || options.email || pledge.email)) {
    return { ok: false, reason: "missing_email" };
  }

  if (pledge.amount_due <= 0 && !options.force) {
    return { ok: false, reason: "nothing_due" };
  }

  if (!options.force && pledge.last_reminder_at) {
    const nextAllowed = addDays(
      new Date(pledge.last_reminder_at),
      toInt(options.cooldownDays, DEFAULT_COOLDOWN_DAYS)
    );

    if (nextAllowed > new Date()) {
      return { ok: false, reason: "cooldown_active" };
    }
  }

  if (!options.force && pledge.next_reminder_at) {
    const nextReminder = new Date(pledge.next_reminder_at);

    if (!Number.isNaN(nextReminder.getTime()) && nextReminder > new Date()) {
      return { ok: false, reason: "next_reminder_not_due" };
    }
  }

  return { ok: true, reason: "eligible" };
}

async function findExistingOpenPledgeInvoice(conn, pledge) {
  const invoiceCols = await getColumns(conn, "tbl_finance_invoices");
  if (!invoiceCols.size) return null;

  const where = [];
  const params = [];

  if (invoiceCols.has("pledge_id")) {
    where.push("i.pledge_id = ?");
    params.push(pledge.pledge_id);
  } else if (invoiceCols.has("metadata_json")) {
    where.push("i.metadata_json LIKE ?");
    params.push(`%"pledge_id":${Number(pledge.pledge_id)}%`);
  } else {
    return null;
  }

  const statusExpr =
    invoiceCols.has("status") && invoiceCols.has("invoice_status")
      ? "LOWER(COALESCE(i.status, i.invoice_status, 'open'))"
      : invoiceCols.has("status")
      ? "LOWER(COALESCE(i.status, 'open'))"
      : invoiceCols.has("invoice_status")
      ? "LOWER(COALESCE(i.invoice_status, 'open'))"
      : "'open'";

  where.push(`${statusExpr} IN ('open', 'pending', 'partial', 'overdue')`);

  const [rows] = await conn.query(
    `
    SELECT i.*
    FROM tbl_finance_invoices i
    WHERE ${where.join(" AND ")}
    ORDER BY i.id DESC
    LIMIT 1
    `,
    params
  );

  return rows[0] || null;
}

async function loadInvoiceById(conn, invoiceId) {
  const [rows] = await conn.query(
    `
    SELECT *
    FROM tbl_finance_invoices
    WHERE id = ?
    LIMIT 1
    `,
    [invoiceId]
  );

  return rows[0] || null;
}

async function normalizeGeneratedInvoice(conn, generated) {
  const invoice =
    generated?.invoice ||
    generated?.row ||
    generated?.data ||
    generated;

  if (invoice?.id && invoice?.invoice_number) {
    return invoice;
  }

  const invoiceId = Number(
    generated?.invoice_id ||
      generated?.insertId ||
      generated?.id ||
      invoice?.id ||
      0
  );

  if (!invoiceId) {
    throw new Error("Invoice generation did not return invoice id.");
  }

  const loaded = await loadInvoiceById(conn, invoiceId);

  if (!loaded) {
    throw new Error(`Generated invoice not found: ${invoiceId}`);
  }

  return loaded;
}

async function createOrReusePledgeReminderInvoice(conn, pledge, options = {}) {
  if (typeof invoiceGenerationService.generateInvoice !== "function") {
    throw new Error("invoiceGenerationService.generateInvoice is not available.");
  }

  if (!options.force_new_invoice) {
    const existing = await findExistingOpenPledgeInvoice(conn, pledge);

    if (existing?.id) {
      return {
        invoice: existing,
        reused: true,
      };
    }
  }

  const amount = money(options.amount || pledge.amount_due);
  const payerType = pledge.member_id ? "member" : "non_member";

  const generated = await invoiceGenerationService.generateInvoice(conn, {
    member_id: pledge.member_id || null,
    member_no: pledge.member_no || null,

    full_name: pledge.full_name,
    email: pledge.email,
    phone: pledge.phone,

    full_name_snapshot: pledge.full_name,
    email_snapshot: pledge.email,
    phone_snapshot: pledge.phone,
    payer_type: payerType,

    payment_type: "pledge",
    category: "pledge",
    invoice_type: "pledge",
    sub_category: "pledge_reminder",

    pledge_id: pledge.pledge_id,
    pledge_number: pledge.pledge_number,
    campaign_id: pledge.campaign_id || null,
    campaign_name: pledge.campaign_name,

    amount,
    total_amount: amount,
    paid_amount: 0,
    balance_due: amount,
    status: "open",
    invoice_status: "open",

    due_date: pledge.due_date || options.due_date || null,
    description: `Pledge reminder: ${pledge.campaign_name}`,
    notes:
      options.notes ||
      "Pledge reminder invoice. Donor can pay without registration.",

    created_by: options.actorId || options.created_by || null,

    metadata_json: JSON.stringify({
      source: "pledge_reminder_service",
      payer_type: payerType,
      pledge_id: pledge.pledge_id,
      pledge_number: pledge.pledge_number,
      campaign_id: pledge.campaign_id || null,
      campaign_name: pledge.campaign_name,
      donor_name: pledge.full_name,
      donor_email: pledge.email,
      donor_phone: pledge.phone,
      no_registration_required: true,
    }),

    line_items: [
      {
        code: "11",
        item_type: "pledge",
        item_name: "Pledge Payment",
        description: `${pledge.campaign_name} - ${pledge.pledge_number}`,
        quantity: 1,
        unit_price: amount,
        total_price: amount,
        metadata: {
          pledge_id: pledge.pledge_id,
          pledge_number: pledge.pledge_number,
          campaign_name: pledge.campaign_name,
          payer_type: payerType,
        },
      },
    ],
  });

  const invoice = await normalizeGeneratedInvoice(conn, generated);

  return {
    invoice,
    reused: false,
  };
}

function buildPublicLinks(invoice, options = {}) {
  if (typeof publicAccess.buildInvoicePublicLinks !== "function") {
    throw new Error("invoicePublicAccessService is not available.");
  }

  return publicAccess.buildInvoicePublicLinks(invoice, {
    ttl_days:
      options.public_link_ttl_days ||
      options.link_expires_days ||
      options.ttl_days ||
      30,
    scope: ["view", "pdf", "download", "pay", "email"],
  });
}

async function createInvoicePaymentLinkRecord(conn, invoice, pledge, links, options = {}) {
  const paymentToken = links.token || "";
  const tokenHash = paymentToken ? sha256Hex(paymentToken) : null;
  const expiresDays = Number(options.public_link_ttl_days || options.link_expires_days || 30);
  const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

  for (const tableName of ["tbl_finance_payment_links", "tbl_payment_links"]) {
    if (!(await tableExists(conn, tableName))) continue;

    await insertExistingColumns(conn, tableName, {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      pledge_id: pledge.pledge_id,
      pledge_number: pledge.pledge_number,

      member_id: pledge.member_id || null,
      member_no: pledge.member_no || null,

      email: pledge.email || null,
      phone: pledge.phone || null,
      full_name: pledge.full_name || null,
      payer_type: pledge.payer_type || "non_member",

      token_hash: tokenHash,
      payment_token: paymentToken,
      payment_link: links.view_url,

      amount: money(pledge.amount_due),
      currency: invoice.currency || "USD",

      status: "active",
      link_type: "pledge_reminder",
      expires_at: expiresAt,
      created_at: mysqlDateTime(),
      updated_at: mysqlDateTime(),
    }).catch(() => null);

    break;
  }

  return {
    token: paymentToken,
    token_hash: tokenHash,
    url: links.view_url,
    expires_at: expiresAt,
    public_links: links,
  };
}

async function recordLocalReminderHistory(conn, pledge, invoice, links, status, options = {}) {
  for (const tableName of [
    "tbl_finance_pledge_reminder_history",
    "tbl_pledge_reminder_history",
    "tbl_finance_reminder_history",
  ]) {
    if (!(await tableExists(conn, tableName))) continue;

    const result = await insertExistingColumns(conn, tableName, {
      pledge_id: pledge.pledge_id,
      pledge_number: pledge.pledge_number,
      campaign_id: pledge.campaign_id || null,
      member_id: pledge.member_id || null,
      member_no: pledge.member_no || null,

      full_name: pledge.full_name || null,
      email: pledge.email || null,
      phone: pledge.phone || null,
      payer_type: pledge.payer_type || "non_member",

      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,

      reminder_type: options.reminderType || "pledge_reminder",
      reminder_status: status,
      status,

      amount_due: pledge.amount_due,
      amount: pledge.amount_due,
      due_date: pledge.due_date || null,
      days_until_due: pledge.days_until_due,

      payment_link: links.view_url,
      public_invoice_url: links.view_url,

      metadata_json: safeJson({
        source: "pledge_reminder_service",
        no_registration_required: true,
        public_invoice_url: links.view_url,
        pdf_url: links.pdf_url,
        download_url: links.download_url,
      }),

      created_by: options.actorId || options.created_by || null,
      created_at: mysqlDateTime(),
      updated_at: mysqlDateTime(),
    });

    return {
      table: tableName,
      id: Number(result?.insertId || 0),
    };
  }

  return null;
}

async function updateLocalReminderHistory(conn, history, patch = {}) {
  if (!history?.table || !history?.id) return;

  await updateExistingColumns(
    conn,
    history.table,
    {
      reminder_status: patch.status,
      status: patch.status,
      error: patch.error || null,
      error_message: patch.error || null,
      message_id: patch.messageId || null,
      sent_at: patch.sent_at || null,
      updated_at: mysqlDateTime(),
    },
    "id = ?",
    [history.id]
  ).catch(() => null);
}

async function updatePledgeReminderState(pledge, invoice, options = {}) {
  const conn = await pool.getConnection();

  try {
    const now = mysqlDateTime(options.now || new Date());
    const cooldownDays = toInt(options.cooldownDays, DEFAULT_COOLDOWN_DAYS);

    await updateExistingColumns(
      conn,
      PLEDGES_TABLE,
      {
        last_reminder_at: now,
        last_reminder_sent_at: now,
        reminder_sent_at: now,
        next_reminder_at: mysqlDateTime(addDays(options.now || new Date(), cooldownDays)),
        invoice_id: invoice?.id || null,
        last_invoice_id: invoice?.id || null,
        updated_at: mysqlDateTime(),
      },
      "id = ?",
      [pledge.pledge_id]
    );

    const cols = await getColumns(conn, PLEDGES_TABLE);

    if (cols.has("reminder_count")) {
      await conn.query(
        `
        UPDATE ${sqlId(PLEDGES_TABLE)}
        SET reminder_count = COALESCE(reminder_count, 0) + 1
        WHERE id = ?
        `,
        [pledge.pledge_id]
      );
    }

    if (options.mark_invoiced && cols.has("status")) {
      await conn.query(
        `
        UPDATE ${sqlId(PLEDGES_TABLE)}
        SET status = 'invoiced'
        WHERE id = ?
          AND LOWER(COALESCE(status, '')) IN ('receivable', 'open', 'pending', 'active')
        `,
        [pledge.pledge_id]
      );
    }

    return true;
  } finally {
    conn.release();
  }
}

function pledgeDueLabel(pledge) {
  if (pledge.days_until_due === null) return "due date unavailable";
  if (pledge.days_until_due < 0) {
    return `${Math.abs(pledge.days_until_due)} day(s) overdue`;
  }
  if (pledge.days_until_due === 0) return "due today";
  return `due in ${pledge.days_until_due} day(s)`;
}
function buildPledgeReminderEmail(pledge, options = {}) {
const amountDue = money(pledge.amount_due);
const dueLabel = pledgeDueLabel(pledge);

const paymentLink =
options.paymentLink ||
options.payment_link ||
options.publicLinks?.pay_url ||
options.publicLinks?.view_url ||
"";

const subject =
options.subject ||
`Pledge Reminder - ${pledge.campaign_name}`;

return {
subject,


text: [
  `Dear ${pledge.full_name},`,
  "",
  `This is a reminder regarding your pledge.`,
  `Pledge Number: ${pledge.pledge_number}`,
  `Campaign: ${pledge.campaign_name}`,
  `Amount Due: ${formatMoney(amountDue)}`,
  `Status: ${dueLabel}`,
  "",
  paymentLink
    ? `Secure Payment Link: ${paymentLink}`
    : "Please contact the Finance Office to obtain a payment link.",
  "",
  "No registration or login is required.",
  "A receipt will automatically be emailed after payment.",
  "",
  "Thank you for supporting our ministry.",
].join("\n"),

html: `
  <div style="
    font-family:Arial,Helvetica,sans-serif;
    background:#f8fafc;
    padding:30px;
    color:#0f172a;
  ">
    <div style="
      max-width:720px;
      margin:auto;
      background:#ffffff;
      border:1px solid #e2e8f0;
      border-radius:14px;
      overflow:hidden;
    ">

      <!-- BODY -->
      <div style="padding:32px;">

        <h2 style="
          margin-top:0;
          margin-bottom:20px;
          color:#0f3f70;
        ">
          Pledge Reminder
        </h2>

        <p style="
          font-size:15px;
          line-height:1.8;
          color:#334155;
        ">
          Dear <strong>${escapeHtml(pledge.full_name)}</strong>,
        </p>

        <p style="
          font-size:15px;
          line-height:1.8;
          color:#334155;
        ">
          This is a friendly reminder regarding your pledge commitment for
          <strong>${escapeHtml(pledge.campaign_name)}</strong>.
        </p>

        <table style="
          width:100%;
          border-collapse:collapse;
          margin-top:24px;
          margin-bottom:24px;
        ">
          <tr>
            <td style="
              padding:12px;
              border:1px solid #e2e8f0;
              background:#f8fafc;
              font-weight:bold;
              width:40%;
            ">
              Donor Type
            </td>
            <td style="
              padding:12px;
              border:1px solid #e2e8f0;
            ">
              ${pledge.member_id ? "Member" : "Guest / Non-Member"}
            </td>
          </tr>

          <tr>
            <td style="
              padding:12px;
              border:1px solid #e2e8f0;
              background:#f8fafc;
              font-weight:bold;
            ">
              Pledge Number
            </td>
            <td style="
              padding:12px;
              border:1px solid #e2e8f0;
            ">
              ${escapeHtml(pledge.pledge_number)}
            </td>
          </tr>

          <tr>
            <td style="
              padding:12px;
              border:1px solid #e2e8f0;
              background:#f8fafc;
              font-weight:bold;
            ">
              Amount Due
            </td>
            <td style="
              padding:12px;
              border:1px solid #e2e8f0;
              color:#b45309;
              font-weight:bold;
            ">
              ${escapeHtml(formatMoney(amountDue))}
            </td>
          </tr>

          <tr>
            <td style="
              padding:12px;
              border:1px solid #e2e8f0;
              background:#f8fafc;
              font-weight:bold;
            ">
              Due Status
            </td>
            <td style="
              padding:12px;
              border:1px solid #e2e8f0;
            ">
              ${escapeHtml(dueLabel)}
            </td>
          </tr>
        </table>

        ${
          paymentLink
            ? `
            <div style="text-align:center;margin-top:30px;">
              <a
                href="${escapeHtml(paymentLink)}"
                style="
                  background:#0f3f70;
                  color:#ffffff;
                  text-decoration:none;
                  padding:14px 28px;
                  border-radius:8px;
                  font-weight:bold;
                  display:inline-block;
                "
              >
                Pay Pledge Balance
              </a>
            </div>

            <div style="
              margin-top:25px;
              padding:16px;
              background:#eff6ff;
              border-left:4px solid #2563eb;
              border-radius:6px;
              font-size:14px;
              color:#1e3a8a;
            ">
              <strong>No Login Required.</strong><br/>
              You can securely complete your pledge payment using the button above.
              After payment, a receipt will automatically be emailed to you.
            </div>

            <p style="
              margin-top:18px;
              color:#64748b;
              font-size:12px;
              word-break:break-all;
            ">
              If the button does not work, copy and paste this secure payment link:<br/>
              ${escapeHtml(paymentLink)}
            </p>
            `
            : `
            <div style="
              margin-top:24px;
              padding:16px;
              background:#fff7ed;
              border-left:4px solid #f97316;
              border-radius:6px;
              color:#9a3412;
            ">
              A payment link is currently unavailable.
              Please contact the Finance Office for assistance.
            </div>
            `
        }

        <p style="
          margin-top:30px;
          color:#64748b;
          font-size:13px;
          line-height:1.7;
        ">
          If you have already completed this payment, please disregard this reminder.
        </p>

        <p style="
          color:#64748b;
          font-size:13px;
          line-height:1.7;
        ">
          Thank you for your continued support and generosity.
        </p>

      </div>
    </div>
  </div>
`,


};
}


// function buildPledgeReminderEmail(pledge, options = {}) {
//   const amountDue = money(pledge.amount_due);
//   const dueLabel = pledgeDueLabel(pledge);
//   const paymentLink =
//     options.paymentLink ||
//     options.payment_link ||
//     options.publicLinks?.view_url ||
//     "";

//   const subject =
//     options.subject ||
//     `Pledge Reminder - ${pledge.campaign_name}`;

//   return {
//     subject,
//     text: [
//       `Dear ${pledge.full_name},`,
//       "",
//       `This is a reminder for your pledge: ${pledge.pledge_number}.`,
//       `Campaign: ${pledge.campaign_name}`,
//       `Amount due: ${formatMoney(amountDue)}`,
//       `Due status: ${dueLabel}`,
//       "",
//       paymentLink
//         ? `Pay securely here: ${paymentLink}`
//         : "An invoice payment link will be provided by the finance office.",
//       "",
//       "No registration is required. After payment, a receipt will be sent to this email.",
//     ].join("\n"),

//     html: `
//       <div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:28px;color:#0f172a;">
//         <div style="max-width:720px;margin:auto;background:#ffffff;border:1px solid #dbe4ee;border-radius:14px;overflow:hidden;">

//           <div style="background:#0f3f70;color:#ffffff;padding:24px 28px;">
//             <h2 style="margin:0;font-size:22px;">Pledge Reminder</h2>
//             <div style="margin-top:6px;color:#dbeafe;font-size:13px;">
//               Holy Trinity Finance & Membership Platform
//             </div>
//           </div>

//           <div style="padding:28px;">
//             <p style="font-size:15px;color:#334155;line-height:1.7;">
//               Dear <strong>${escapeHtml(pledge.full_name)}</strong>,
//             </p>

//             <p style="font-size:15px;color:#334155;line-height:1.7;">
//               This is a friendly reminder about your pledge for
//               <strong>${escapeHtml(pledge.campaign_name)}</strong>.
//             </p>

//             <table style="width:100%;border-collapse:collapse;margin:20px 0;">
//               <tr>
//                 <td style="padding:10px;border:1px solid #dbe4ee;background:#f8fafc;font-weight:bold;">Donor Type</td>
//                 <td style="padding:10px;border:1px solid #dbe4ee;">${pledge.member_id ? "Member" : "Non-member / Guest"}</td>
//               </tr>
//               <tr>
//                 <td style="padding:10px;border:1px solid #dbe4ee;background:#f8fafc;font-weight:bold;">Pledge</td>
//                 <td style="padding:10px;border:1px solid #dbe4ee;">${escapeHtml(pledge.pledge_number)}</td>
//               </tr>
//               <tr>
//                 <td style="padding:10px;border:1px solid #dbe4ee;background:#f8fafc;font-weight:bold;">Amount Due</td>
//                 <td style="padding:10px;border:1px solid #dbe4ee;">${escapeHtml(formatMoney(amountDue))}</td>
//               </tr>
//               <tr>
//                 <td style="padding:10px;border:1px solid #dbe4ee;background:#f8fafc;font-weight:bold;">Due Status</td>
//                 <td style="padding:10px;border:1px solid #dbe4ee;">${escapeHtml(dueLabel)}</td>
//               </tr>
//             </table>

//             ${
//               paymentLink
//                 ? `
//                   <div style="margin-top:24px;">
//                     <a href="${escapeHtml(paymentLink)}" style="background:#0f3f70;color:#ffffff;padding:13px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;">
//                       Pay Pledge Balance
//                     </a>
//                   </div>

//                   <p style="margin-top:18px;color:#64748b;font-size:13px;line-height:1.7;">
//                     No registration is required. After payment, a receipt will be sent to this email.<br/>
//                     If the button does not work, copy this link:<br/>
//                     ${escapeHtml(paymentLink)}
//                   </p>
//                 `
//                 : ""
//             }

//             <p style="margin-top:24px;color:#64748b;font-size:13px;">
//               If you already made this payment, please disregard this reminder.
//             </p>
//           </div>
//         </div>
//       </div>
//     `,
//   };
// }

async function deliverFallbackEmail(payload) {
  const sender =
    emailService.sendMail ||
    emailService.sendEmail ||
    emailService.sendGenericEmail;

  if (typeof sender !== "function") {
    return {
      success: false,
      error: "No email sender configured.",
    };
  }

  const result = await sender(payload);

  if (result?.success === false) return result;

  return {
    success: true,
    messageId: result?.messageId || result?.message_id || result?.id || null,
    raw: result,
  };
}

async function safeRecordQueued(pledge, email, options) {
  if (typeof trackingService.recordPledgeEmailQueued !== "function") return null;

  try {
    return await trackingService.recordPledgeEmailQueued({
      pledge_id: pledge.pledge_id,
      member_id: pledge.member_id,
      campaign_id: pledge.campaign_id,
      email: pledge.email,
      subject: email.subject,
      email_type: "pledge_reminder",
      reminder_type: options.reminderType || "manual",
      meta: {
        actor_id: options.actorId || null,
        amount_due: pledge.amount_due,
        payer_type: pledge.payer_type,
        full_name: pledge.full_name,
        phone: pledge.phone,
        payment_link: options.payment_link || null,
        no_registration_required: true,
      },
    });
  } catch (err) {
    console.error("Pledge email tracking queued error:", err.message);
    return null;
  }
}

async function safeRecordSent(pledge, email, sendResult, tracking, options) {
  try {
    const messageId =
      sendResult?.messageId ||
      sendResult?.message_id ||
      sendResult?.id ||
      null;

    if (tracking?.id && typeof trackingService.updateEmailTrackingStatus === "function") {
      await trackingService.updateEmailTrackingStatus({
        id: tracking.id,
        status: "sent",
        messageId,
      });
    } else if (typeof trackingService.recordPledgeEmailSent === "function") {
      await trackingService.recordPledgeEmailSent({
        pledge_id: pledge.pledge_id,
        member_id: pledge.member_id,
        campaign_id: pledge.campaign_id,
        email: pledge.email,
        subject: email.subject,
        messageId,
        email_type: "pledge_reminder",
        reminder_type: options.reminderType || "manual",
      });
    }

    if (typeof historyService.recordPledgeReminderSent === "function") {
      await historyService.recordPledgeReminderSent({
        pledge_id: pledge.pledge_id,
        member_id: pledge.member_id,
        campaign_id: pledge.campaign_id,
        email: pledge.email,
        subject: email.subject,
        messageId,
        reminder_type: options.reminderType || "manual",
        amount_due: pledge.amount_due,
        due_date: pledge.due_date,
        days_until_due: pledge.days_until_due,
        payment_link: options.payment_link || null,
        payer_type: pledge.payer_type,
      });
    }
  } catch (err) {
    console.error("Pledge reminder sent tracking error:", err.message);
  }
}

async function safeRecordFailed(pledge, email, error, tracking, options) {
  try {
    if (tracking?.id && typeof trackingService.updateEmailTrackingStatus === "function") {
      await trackingService.updateEmailTrackingStatus({
        id: tracking.id,
        status: "failed",
        error,
      });
    } else if (typeof trackingService.recordPledgeEmailFailed === "function") {
      await trackingService.recordPledgeEmailFailed({
        pledge_id: pledge.pledge_id,
        member_id: pledge.member_id,
        campaign_id: pledge.campaign_id,
        email: pledge.email,
        subject: email.subject,
        error,
      });
    }

    if (typeof historyService.recordPledgeReminderFailed === "function") {
      await historyService.recordPledgeReminderFailed({
        pledge_id: pledge.pledge_id,
        member_id: pledge.member_id,
        campaign_id: pledge.campaign_id,
        email: pledge.email,
        subject: email.subject,
        reminder_type: options.reminderType || "manual",
        amount_due: pledge.amount_due,
        due_date: pledge.due_date,
        error,
      });
    }
  } catch (err) {
    console.error("Pledge reminder failed tracking error:", err.message);
  }
}

async function safeRecordSkipped(pledge, reason, options) {
  try {
    if (typeof historyService.recordPledgeReminderSkipped === "function") {
      await historyService.recordPledgeReminderSkipped({
        pledge_id: pledge?.pledge_id || null,
        member_id: pledge?.member_id || null,
        campaign_id: pledge?.campaign_id || null,
        email: pledge?.email || null,
        reminder_type: options.reminderType || "manual",
        skip_reason: reason,
        amount_due: pledge?.amount_due || 0,
        due_date: pledge?.due_date || null,
      });
    }
  } catch (err) {
    console.error("Pledge reminder skipped tracking error:", err.message);
  }
}

async function preparePledgeInvoiceAndLink(pledge, options = {}) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const { invoice, reused } = await createOrReusePledgeReminderInvoice(
      conn,
      pledge,
      options
    );

    const publicLinks = buildPublicLinks(invoice, options);

    await createInvoicePaymentLinkRecord(
      conn,
      invoice,
      pledge,
      publicLinks,
      options
    );

    const localHistory = await recordLocalReminderHistory(
      conn,
      pledge,
      invoice,
      publicLinks,
      "queued",
      options
    );

    await conn.commit();

    return {
      invoice,
      invoice_reused: reused,
      public_links: publicLinks,
      payment_link: publicLinks.view_url,
      local_history: localHistory,
    };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_rollbackErr) {}

    throw err;
  } finally {
    conn.release();
  }
}

async function sendPledgeReminder(input = {}) {
  const pledge =
    input.pledge ||
    (await getPledgeForReminder(input.pledge_id || input.pledgeId, {
      now: input.now,
    }));

  const targetPledge = pledge
    ? {
        ...pledge,
        email: normalizeEmail(input.to || input.email || pledge.email),
        full_name: clean(input.full_name || pledge.full_name, 180) || "Guest Donor",
        phone: clean(input.phone || pledge.phone, 80) || null,
      }
    : null;

  const eligibility = checkReminderEligibility(targetPledge, input);

  if (!eligibility.ok) {
    await safeRecordSkipped(targetPledge, eligibility.reason, input);

    return {
      ok: false,
      status: "skipped",
      reason: eligibility.reason,
      pledge_id: targetPledge?.pledge_id || input.pledge_id || input.pledgeId || null,
    };
  }

  if (input.dryRun) {
    const preview = buildPledgeReminderEmail(targetPledge, input);

    return {
      ok: true,
      status: "dry_run",
      pledge_id: targetPledge.pledge_id,
      payer_type: targetPledge.payer_type,
      to: targetPledge.email,
      subject: preview.subject,
      preview,
    };
  }

  const prepared = await preparePledgeInvoiceAndLink(targetPledge, input);

  const email = buildPledgeReminderEmail(targetPledge, {
    ...input,
    paymentLink: prepared.payment_link,
    publicLinks: prepared.public_links,
  });

  const tracking = await safeRecordQueued(targetPledge, email, {
    ...input,
    payment_link: prepared.payment_link,
  });

  let sendResult = null;

  if (typeof invoiceEmailService.sendInvoiceEmail === "function") {
    sendResult = await invoiceEmailService.sendInvoiceEmail(prepared.invoice.id, {
      to: targetPledge.email,
      email: targetPledge.email,
      recipient_email: targetPledge.email,
      subject: email.subject,
      source: "pledge_reminder_service",
      reminder: true,
      reminder_type: "pledge_reminder",
      publicLinks: prepared.public_links,
      attachPdf: true,
    });
  } else {
    sendResult = await deliverFallbackEmail({
      to: targetPledge.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  }

  if (sendResult?.success === false) {
    const error = sendResult?.error || "Email send failed.";

    await safeRecordFailed(targetPledge, email, error, tracking, input);

    const updateConn = await pool.getConnection();
    try {
      await updateLocalReminderHistory(updateConn, prepared.local_history, {
        status: "failed",
        error,
      });
    } finally {
      updateConn.release();
    }

    return {
      ok: false,
      status: "failed",
      pledge_id: targetPledge.pledge_id,
      payer_type: targetPledge.payer_type,
      invoice_id: prepared.invoice.id,
      invoice_number: prepared.invoice.invoice_number,
      to: targetPledge.email,
      payment_link: prepared.payment_link,
      error,
    };
  }

  await updatePledgeReminderState(targetPledge, prepared.invoice, input);
  await safeRecordSent(targetPledge, email, sendResult, tracking, {
    ...input,
    payment_link: prepared.payment_link,
  });

  const updateConn = await pool.getConnection();
  try {
    await updateLocalReminderHistory(updateConn, prepared.local_history, {
      status: "sent",
      sent_at: mysqlDateTime(),
      messageId:
        sendResult?.messageId ||
        sendResult?.message_id ||
        sendResult?.id ||
        null,
    });
  } finally {
    updateConn.release();
  }

  return {
    ok: true,
    status: "sent",
    pledge_id: targetPledge.pledge_id,
    payer_type: targetPledge.payer_type,
    invoice_id: prepared.invoice.id,
    invoice_number: prepared.invoice.invoice_number,
    to: targetPledge.email,
    payment_link: prepared.payment_link,
    public_links: prepared.public_links,
    messageId:
      sendResult?.messageId ||
      sendResult?.message_id ||
      sendResult?.id ||
      null,
  };
}

async function sendBulkPledgeReminders(options = {}) {
  const pledges = Array.isArray(options.pledges)
    ? options.pledges
    : Array.isArray(options.pledgeIds)
    ? await Promise.all(
        options.pledgeIds.map((id) =>
          getPledgeForReminder(id, { now: options.now })
        )
      )
    : await getReminderCandidates(options);

  const results = [];

  for (const pledge of pledges.filter(Boolean)) {
    results.push(
      await sendPledgeReminder({
        ...options,
        pledge,
      })
    );
  }

  const summary = results.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    },
    {
      sent: 0,
      failed: 0,
      skipped: 0,
      dry_run: 0,
    }
  );

  return {
    ok: true,
    candidates: pledges.filter(Boolean).length,
    summary,
    results,
  };
}

async function getPledgeReminderPreview(pledgeId, options = {}) {
  const pledge = await getPledgeForReminder(pledgeId, options);

  if (!pledge) {
    return {
      ok: false,
      error: "Pledge not found.",
    };
  }

  return {
    ok: true,
    pledge,
    email: buildPledgeReminderEmail(pledge, options),
    eligibility: checkReminderEligibility(pledge, {
      ...options,
      force: true,
    }),
  };
}

module.exports = {
  getPledgeForReminder,
  getReminderCandidates,
  checkReminderEligibility,

  createOrReusePledgeReminderInvoice,
  preparePledgeInvoiceAndLink,

  buildPledgeReminderEmail,
  getPledgeReminderPreview,

  sendPledgeReminder,
  sendManualPledgeReminder: sendPledgeReminder,
  sendPledgeReminderById: sendPledgeReminder,

  sendBulkPledgeReminders,
  sendPledgeReminderBatch: sendBulkPledgeReminders,
};