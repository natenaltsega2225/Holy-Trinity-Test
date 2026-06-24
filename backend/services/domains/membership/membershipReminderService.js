// backend/services/domains/membership/membershipReminderService.js
"use strict";

const crypto = require("crypto");
const pool = require("../../../db");

const {
  insertExistingColumns,
  updateExistingColumns,
  findOne,
} = require("../../../utils/dbHelpers");

const financeHelpers = require("../../../utils/financeHelpers");

const { generateInvoice } = require("../invoices/invoiceGenerationService");

function optionalRequire(path, fallback = {}) {
  try {
    return require(path);
  } catch (_err) {
    return fallback;
  }
}

const invoiceEmailService = optionalRequire("../invoices/invoiceEmailService");
const publicAccess = optionalRequire("../invoices/invoicePublicAccessService");
const emailService = optionalRequire("../../emailService");

const MONTHS = [
  null,
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
];

const META_TTL_MS = 60 * 1000;
const metaCache = new Map();

/* =========================================================
   BASIC HELPERS
========================================================= */

function mysqlNow() {
  if (typeof financeHelpers.mysqlNow === "function") {
    return financeHelpers.mysqlNow();
  }

  return new Date();
}

function clean(value, max = 500) {
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

function roundMoney(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

function formatMoney(value) {
  return roundMoney(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function toId(result) {
  return Number(result?.insertId || result?.id || result || 0) || 0;
}

function sqlId(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(String(name || ""))) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }

  return `\`${name}\``;
}

function has(columns, column) {
  return columns && columns.has(column);
}

async function columnsFor(conn, tableName) {
  const cached = metaCache.get(tableName);

  if (cached && Date.now() - cached.loadedAt < META_TTL_MS) {
    return cached.columns;
  }

  const [rows] = await conn.query(
    `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    `,
    [tableName]
  );

  const columns = new Set(rows.map((row) => row.COLUMN_NAME));

  metaCache.set(tableName, {
    columns,
    loadedAt: Date.now(),
  });

  return columns;
}

async function tableExists(conn, tableName) {
  const columns = await columnsFor(conn, tableName);
  return columns.size > 0;
}

function coalesceExpr(alias, columns, candidates, fallbackSql = "NULL") {
  const parts = candidates
    .filter((column) => has(columns, column))
    .map((column) => `${alias}.${sqlId(column)}`);

  return parts.length
    ? `COALESCE(${parts.join(", ")}, ${fallbackSql})`
    : fallbackSql;
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

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function monthLabel(year, month) {
  return `${MONTHS[Number(month)] || month} ${year}`;
}

function sortCoverageRows(rows = []) {
  return [...rows].sort((a, b) => {
    if (Number(a.coverage_year) !== Number(b.coverage_year)) {
      return Number(a.coverage_year) - Number(b.coverage_year);
    }

    return Number(a.month_number) - Number(b.month_number);
  });
}

function coverageLabel(rows = []) {
  const sorted = sortCoverageRows(rows);
  if (!sorted.length) return "";

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (Number(first.coverage_year) === Number(last.coverage_year)) {
    return `${MONTHS[first.month_number]} - ${MONTHS[last.month_number]} ${first.coverage_year}`;
  }

  return `${MONTHS[first.month_number]} ${first.coverage_year} - ${MONTHS[last.month_number]} ${last.coverage_year}`;
}

function nowYearMonth(daysAhead = 0) {
  const d = new Date();
  d.setDate(d.getDate() + Number(daysAhead || 0));

  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
  };
}

function amountForCoverageRow(row = {}, options = {}) {
  return roundMoney(
    row.balance_due ||
      row.remaining_amount ||
      row.due_amount ||
      row.amount ||
      row.monthly_amount ||
      options.default_monthly_amount ||
      options.default_amount ||
      0
  );
}

/* =========================================================
   PUBLIC INVOICE LINKS
========================================================= */

function buildInvoicePublicLinksForReminder(invoice, options = {}) {
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

/* =========================================================
   LOAD DUE MEMBERSHIP MONTHS
========================================================= */

async function findMembershipDuesToRemind(conn, options = {}) {
  const tableName = "tbl_member_membership_coverage";

  if (!(await tableExists(conn, tableName))) {
    return [];
  }

  const coverageColumns = await columnsFor(conn, tableName);
  const cutoff = nowYearMonth(options.days_ahead || 0);
  const limit = Math.min(1000, Number(options.limit || 250) || 250);

  const where = [
    "LOWER(COALESCE(c.status, 'open')) IN ('open', 'unpaid', 'pending', 'overdue', 'due')",
    `
      (
        c.coverage_year < ?
        OR (
          c.coverage_year = ?
          AND c.month_number <= ?
        )
      )
    `,
    `
      (
        m.membership_start_date IS NULL
        OR c.coverage_year > YEAR(m.membership_start_date)
        OR (
          c.coverage_year = YEAR(m.membership_start_date)
          AND c.month_number >= MONTH(m.membership_start_date)
        )
      )
    `,
    "LOWER(COALESCE(m.status, 'active')) NOT IN ('inactive', 'disabled', 'suspended')",
    "LOWER(COALESCE(m.membership_status, 'active')) NOT IN ('inactive', 'disabled', 'suspended')",
  ];

  const params = [cutoff.year, cutoff.year, cutoff.month];

  if (options.member_id) {
    where.push("c.member_id = ?");
    params.push(Number(options.member_id));
  }

  if (
    options.include_recently_reminded !== true &&
    has(coverageColumns, "last_reminder_sent_at")
  ) {
    const cooldownHours = Math.max(
      1,
      Number(options.reminder_cooldown_hours || 72)
    );

    where.push(
      `
      (
        c.last_reminder_sent_at IS NULL
        OR c.last_reminder_sent_at <= DATE_SUB(NOW(), INTERVAL ? HOUR)
      )
      `
    );

    params.push(cooldownHours);
  }

  params.push(limit);

  const [rows] = await conn.query(
    `
    SELECT
      c.id AS coverage_id,
      c.member_id,
      c.member_no,
      c.coverage_year,
      c.month_number,
      c.month_name,
      c.coverage_month,
      c.coverage_label,
      c.status AS coverage_status,
      c.amount,
      c.due_amount,
      c.balance_due,
      c.remaining_amount,
      c.payment_id,
      c.invoice_id,
      c.receipt_id,
      ${has(coverageColumns, "last_reminder_sent_at") ? "c.last_reminder_sent_at" : "NULL AS last_reminder_sent_at"},

      m.full_name,
      m.email,
      m.phone,
      m.membership_status,
      m.status AS member_status,
      m.membership_start_date,
      m.membership_end_date

    FROM tbl_member_membership_coverage c

    INNER JOIN tbl_members m
      ON m.id = c.member_id

    WHERE ${where.join("\n      AND ")}

    ORDER BY
      c.member_id ASC,
      c.coverage_year ASC,
      c.month_number ASC

    LIMIT ?
    `,
    params
  );

  return rows;
}

function groupByMember(rows = [], options = {}) {
  const groups = new Map();

  for (const row of rows) {
    const key = String(row.member_id);

    if (!groups.has(key)) {
      groups.set(key, {
        member: {
          id: row.member_id,
          member_id: row.member_id,
          member_no: row.member_no,
          full_name: row.full_name,
          email: row.email,
          phone: row.phone,
        },
        rows: [],
        amount: 0,
      });
    }

    const group = groups.get(key);
    const amount = amountForCoverageRow(row, options);

    group.rows.push({
      coverage_id: row.coverage_id,
      coverage_year: Number(row.coverage_year),
      month_number: Number(row.month_number),
      month_name: row.month_name || MONTHS[row.month_number],
      coverage_month:
        row.coverage_month ||
        `${row.coverage_year}-${String(row.month_number).padStart(2, "0")}`,
      label:
        row.coverage_label ||
        monthLabel(row.coverage_year, row.month_number),
      amount,
      status: row.coverage_status,
    });

    group.amount = roundMoney(group.amount + amount);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      rows: sortCoverageRows(group.rows),
      amount: roundMoney(group.amount),
    }))
    .filter((group) => group.amount > 0);
}

/* =========================================================
   EXISTING OPEN INVOICE
========================================================= */

async function findExistingOpenMembershipInvoice(conn, memberId, label) {
  const columns = await columnsFor(conn, "tbl_finance_invoices");

  if (!columns.size) return null;

  const where = ["i.member_id = ?"];
  const params = [memberId];

  const typeExpr = coalesceExpr(
    "i",
    columns,
    ["category", "payment_type", "invoice_type", "type"],
    "''"
  );

  where.push(
    `LOWER(${typeExpr}) IN ('membership', 'membership_dues', 'dues')`
  );

  const statusExpr = coalesceExpr(
    "i",
    columns,
    ["status", "invoice_status"],
    "'open'"
  );

  where.push(
    `LOWER(${statusExpr}) IN ('open', 'pending', 'partial', 'overdue')`
  );

  const labelPredicates = [];

  if (has(columns, "coverage_label")) {
    labelPredicates.push("i.coverage_label = ?");
    params.push(label);
  }

  if (has(columns, "invoice_snapshot_json")) {
    labelPredicates.push("i.invoice_snapshot_json LIKE ?");
    params.push(`%${label}%`);
  }

  if (has(columns, "metadata_json")) {
    labelPredicates.push("i.metadata_json LIKE ?");
    params.push(`%${label}%`);
  }

  if (labelPredicates.length) {
    where.push(`(${labelPredicates.join(" OR ")})`);
  }

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
  if (!generated) {
    throw new Error("Invoice generation returned no result.");
  }

  const invoice =
    generated.invoice ||
    generated.row ||
    generated.data ||
    generated;

  if (invoice.id && invoice.invoice_number) {
    return invoice;
  }

  const invoiceId =
    toId(generated) ||
    toId(generated.result) ||
    toId(generated.insert) ||
    toId(generated.invoice_id) ||
    toId(invoice.id);

  if (!invoiceId) {
    throw new Error("Invoice generation did not return invoice id.");
  }

  const loaded = await loadInvoiceById(conn, invoiceId);

  if (!loaded) {
    throw new Error(`Generated invoice not found: ${invoiceId}`);
  }

  return loaded;
}

/* =========================================================
   INVOICE CREATION
========================================================= */

async function createOrReuseMembershipReminderInvoice(conn, group, options = {}) {
  const member = group.member;
  const rows = sortCoverageRows(group.rows);
  const label = coverageLabel(rows);
  const amount = roundMoney(group.amount);

  if (amount <= 0) {
    throw new Error("Reminder amount must be greater than zero.");
  }

  if (!options.force_new_invoice) {
    const existing = await findExistingOpenMembershipInvoice(
      conn,
      member.member_id,
      label
    );

    if (existing?.id) {
      return {
        invoice: existing,
        reused: true,
      };
    }
  }

  const generated = await generateInvoice(conn, {
    member_id: member.member_id,
    member_no: member.member_no,
    full_name: member.full_name,
    email: member.email,
    phone: member.phone,

    payment_type: "membership",
    category: "membership",
    invoice_type: "membership",
    sub_category: "membership_dues_reminder",

    amount,
    total_amount: amount,
    paid_amount: 0,
    balance_due: amount,
    status: "open",
    invoice_status: "open",

    plan_name: options.plan_name || "Membership Dues",
    months_paid: rows.length,
    quantity: rows.length,
    coverage_year: rows[0]?.coverage_year || null,

    coverage_start_month: rows[0]
      ? `${rows[0].coverage_year}-${String(rows[0].month_number).padStart(2, "0")}`
      : null,

    coverage_end_month: rows[rows.length - 1]
      ? `${rows[rows.length - 1].coverage_year}-${String(
          rows[rows.length - 1].month_number
        ).padStart(2, "0")}`
      : null,

    coverage_label: label,
    coverage_months: rows,
    coverage_months_json: JSON.stringify(rows),

    description: `Membership dues reminder: ${label}`,
    notes: options.notes || "Automatic membership dues reminder.",

    due_date: options.due_date || mysqlNow(),
    created_by: options.created_by || null,

    metadata_json: JSON.stringify({
      source: "membership_reminder_service",
      reminder_type: "membership_dues",
      coverage_label: label,
      coverage_months: rows,
    }),

    line_items: [
      {
        code: "DUE",
        item_type: "membership",
        item_name: "Membership Dues",
        description: `Outstanding membership dues: ${label}`,
        quantity: rows.length,
        unit_price: roundMoney(amount / Math.max(rows.length, 1)),
        total_price: amount,
        coverage_label: label,
        coverage_months: rows,
        metadata: {
          reminder_eligible: true,
          reminder_type: "membership_dues",
          coverage_label: label,
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

/* =========================================================
   PAYMENT LINK
========================================================= */

async function createInvoicePaymentLink(conn, invoice, member, reminder = {}, options = {}) {
  const publicLinks = buildInvoicePublicLinksForReminder(invoice, options);
  const paymentToken = publicLinks.token;
  const tokenHash = sha256Hex(paymentToken);

  const expiresDays = Number(
    options.public_link_ttl_days ||
      options.link_expires_days ||
      30
  );

  const expiresAt = new Date(
    Date.now() + expiresDays * 24 * 60 * 60 * 1000
  );

  for (const tableName of ["tbl_finance_payment_links", "tbl_payment_links"]) {
    if (!(await tableExists(conn, tableName))) continue;

    await insertExistingColumns(conn, tableName, {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,

      member_id: member.member_id || member.id || null,
      member_no: member.member_no || null,
      email: member.email || null,
      full_name: member.full_name || null,

      token_hash: tokenHash,
      payment_token: paymentToken,
      payment_link: publicLinks.view_url,

      amount: roundMoney(
        reminder.amount ||
          invoice.balance_due ||
          invoice.total_amount ||
          invoice.amount ||
          0
      ),

      currency: invoice.currency || "USD",
      status: "active",
      link_type: "membership_dues",
      expires_at: expiresAt,
      created_at: mysqlNow(),
      updated_at: mysqlNow(),
    }).catch(() => null);

    break;
  }

  return {
    token: paymentToken,
    token_hash: tokenHash,
    url: publicLinks.view_url,
    view_url: publicLinks.view_url,
    pdf_url: publicLinks.pdf_url,
    download_url: publicLinks.download_url,
    api_url: publicLinks.api_url,
    expires_at: expiresAt,
    public_links: publicLinks,
  };
}

/* =========================================================
   HISTORY
========================================================= */

async function recordReminderHistory(conn, payload = {}) {
  for (const tableName of [
    "tbl_finance_membership_reminder_history",
    "tbl_membership_reminder_history",
    "tbl_finance_reminder_history",
  ]) {
    if (!(await tableExists(conn, tableName))) continue;

    const result = await insertExistingColumns(conn, tableName, {
      member_id: payload.member_id || null,
      member_no: payload.member_no || null,
      email: payload.email || null,
      full_name: payload.full_name || null,

      invoice_id: payload.invoice_id || null,
      invoice_number: payload.invoice_number || null,

      reminder_type: "membership_dues",
      reminder_status: payload.status || "queued",
      status: payload.status || "queued",

      amount: payload.amount || 0,
      coverage_label: payload.coverage_label || null,
      coverage_months_json: safeJson(payload.coverage_months || [], "[]"),

      payment_link: payload.payment_link || null,
      public_invoice_url: payload.public_invoice_url || payload.payment_link || null,

      sent_at: payload.sent_at || null,
      created_by: payload.created_by || null,
      created_at: mysqlNow(),
      updated_at: mysqlNow(),
    });

    return {
      table: tableName,
      id: toId(result),
    };
  }

  return null;
}

async function updateReminderHistory(conn, history, patch = {}) {
  if (!history?.table || !history?.id) return;

  await updateExistingColumns(
    conn,
    history.table,
    {
      reminder_status: patch.status,
      status: patch.status,
      error_message: patch.error || null,
      sent_at: patch.sent_at || null,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [history.id]
  ).catch(() => null);
}

async function markCoverageReminderSent(conn, rows = []) {
  const ids = rows.map((row) => row.coverage_id).filter(Boolean);
  if (!ids.length) return;

  const columns = await columnsFor(conn, "tbl_member_membership_coverage");
  const sets = [];

  if (has(columns, "last_reminder_sent_at")) {
    sets.push("last_reminder_sent_at = NOW()");
  }

  if (has(columns, "reminder_count")) {
    sets.push("reminder_count = COALESCE(reminder_count, 0) + 1");
  }

  if (has(columns, "updated_at")) {
    sets.push("updated_at = NOW()");
  }

  if (!sets.length) return;

  await conn
    .query(
      `
      UPDATE tbl_member_membership_coverage
      SET ${sets.join(", ")}
      WHERE id IN (${ids.map(() => "?").join(",")})
      `,
      ids
    )
    .catch(() => null);
}

/* =========================================================
   EMAIL FALLBACK
========================================================= */

function buildReminderHtml(payload = {}) {
  const paymentLink = payload.payment_link || payload.public_links?.view_url || "";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:28px;">
      <div style="max-width:720px;margin:auto;background:#ffffff;border:1px solid #dbe4ee;border-radius:14px;overflow:hidden;">
        <div style="background:#0f3f70;color:#ffffff;padding:24px 28px;">
          <h2 style="margin:0;font-size:22px;">Membership Dues Reminder</h2>
          <div style="margin-top:6px;color:#dbeafe;font-size:13px;">Holy Trinity Finance & Membership Platform</div>
        </div>

        <div style="padding:28px;">
          <p style="font-size:15px;color:#334155;line-height:1.7;">
            Dear <strong>${escapeHtml(payload.full_name || "Member")}</strong>,
          </p>

          <p style="font-size:15px;color:#334155;line-height:1.7;">
            This is a friendly reminder that your membership dues are currently open.
          </p>

          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr>
              <td style="padding:10px;border:1px solid #dbe4ee;background:#f8fafc;font-weight:bold;">Member ID</td>
              <td style="padding:10px;border:1px solid #dbe4ee;">${escapeHtml(payload.member_no || "--")}</td>
            </tr>
            <tr>
              <td style="padding:10px;border:1px solid #dbe4ee;background:#f8fafc;font-weight:bold;">Coverage</td>
              <td style="padding:10px;border:1px solid #dbe4ee;">${escapeHtml(payload.coverage_label || "--")}</td>
            </tr>
            <tr>
              <td style="padding:10px;border:1px solid #dbe4ee;background:#f8fafc;font-weight:bold;">Invoice</td>
              <td style="padding:10px;border:1px solid #dbe4ee;">${escapeHtml(payload.invoice_number || "--")}</td>
            </tr>
            <tr>
              <td style="padding:10px;border:1px solid #dbe4ee;background:#f8fafc;font-weight:bold;">Amount Due</td>
              <td style="padding:10px;border:1px solid #dbe4ee;">${escapeHtml(formatMoney(payload.amount || 0))}</td>
            </tr>
          </table>

          ${
            paymentLink
              ? `
                <p style="margin:24px 0;">
                  <a href="${escapeHtml(paymentLink)}" target="_blank" style="background:#0f3f70;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:8px;display:inline-block;font-weight:bold;">
                    Pay Membership Dues
                  </a>
                </p>

                <p style="font-size:13px;color:#64748b;line-height:1.7;">
                  If the button does not work, copy and paste this link into your browser:<br/>
                  ${escapeHtml(paymentLink)}
                </p>
              `
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

function buildReminderText(payload = {}) {
  const paymentLink = payload.payment_link || payload.public_links?.view_url || "";

  return [
    "Membership Dues Reminder",
    "",
    `Dear ${payload.full_name || "Member"},`,
    "",
    "This is a friendly reminder that your membership dues are currently open.",
    "",
    `Member ID: ${payload.member_no || "--"}`,
    `Coverage: ${payload.coverage_label || "--"}`,
    `Invoice: ${payload.invoice_number || "--"}`,
    `Amount Due: ${formatMoney(payload.amount || 0)}`,
    "",
    paymentLink ? `Pay here: ${paymentLink}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendMembershipReminderEmail(payload = {}) {
  if (!payload.email) {
    return {
      success: false,
      skipped: true,
      error: "No email address.",
    };
  }

  if (typeof invoiceEmailService.sendInvoiceEmail === "function") {
    return invoiceEmailService.sendInvoiceEmail(payload.invoice_id, {
      to: payload.email,
      email: payload.email,
      recipient_email: payload.email,

      subject: `Membership Dues Reminder - ${payload.invoice_number || "Invoice"}`,
      source: "membership_dues_reminder",
      reminder: true,
      reminder_type: "membership_dues",

      publicLinks: payload.public_links || null,
      attachPdf: true,
    });
  }

  const sender =
    emailService.sendGenericEmail ||
    emailService.sendMail ||
    emailService.sendEmail;

  if (typeof sender !== "function") {
    return {
      success: false,
      error: "No email sender configured.",
    };
  }

  return sender({
    to: payload.email,
    subject: `Membership Dues Reminder - ${payload.invoice_number || "Invoice"}`,
    html: buildReminderHtml(payload),
    text: buildReminderText(payload),
  });
}

/* =========================================================
   CREATE ONE REMINDER
========================================================= */

async function createMembershipReminderForGroup(conn, group, options = {}) {
  const member = group.member;
  const rows = sortCoverageRows(group.rows);
  const label = coverageLabel(rows);

  const { invoice, reused } = await createOrReuseMembershipReminderInvoice(
    conn,
    {
      ...group,
      rows,
    },
    options
  );

  const paymentLink = await createInvoicePaymentLink(
    conn,
    invoice,
    member,
    {
      amount: group.amount,
    },
    options
  );

  const history = await recordReminderHistory(conn, {
    member_id: member.member_id,
    member_no: member.member_no,
    email: member.email,
    full_name: member.full_name,

    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,

    amount: group.amount,
    coverage_label: label,
    coverage_months: rows,

    payment_link: paymentLink.view_url,
    public_invoice_url: paymentLink.view_url,

    status: options.send_email === false ? "created" : "queued",
    created_by: options.created_by || null,
  });

  return {
    member,
    rows,
    amount: group.amount,
    coverage_label: label,

    invoice,
    invoice_reused: reused,

    payment_link: paymentLink.view_url,
    public_links: paymentLink.public_links,
    payment_token_expires_at: paymentLink.expires_at,

    history,
  };
}

/* =========================================================
   SEND ONE MEMBER REMINDER
========================================================= */

async function sendMembershipReminderForMember(memberId, options = {}) {
  const conn = await pool.getConnection();

  try {
    const rows = await findMembershipDuesToRemind(conn, {
      ...options,
      member_id: memberId,
      include_recently_reminded:
        options.include_recently_reminded !== undefined
          ? options.include_recently_reminded
          : true,
      limit: options.limit || 250,
    });

    const group = groupByMember(rows, options).find(
      (item) => Number(item.member.member_id) === Number(memberId)
    );

    if (!group) {
      return {
        success: true,
        skipped: true,
        reason: "No open membership dues found for member.",
      };
    }

    await conn.beginTransaction();

    const reminder = await createMembershipReminderForGroup(conn, group, options);

    await conn.commit();

    if (options.send_email === false) {
      return {
        success: true,
        reminder,
        email: {
          skipped: true,
        },
      };
    }

    const email = await sendMembershipReminderEmail({
      email: reminder.member.email,
      full_name: reminder.member.full_name,
      member_no: reminder.member.member_no,

      invoice_id: reminder.invoice.id,
      invoice_number: reminder.invoice.invoice_number,

      amount: reminder.amount,
      coverage_label: reminder.coverage_label,

      payment_link: reminder.payment_link,
      public_links: reminder.public_links,
    });

    const updateConn = await pool.getConnection();

    try {
      await updateReminderHistory(updateConn, reminder.history, {
        status: email?.success === false ? "failed" : "sent",
        error: email?.error || null,
        sent_at: email?.success === false ? null : mysqlNow(),
      });

      if (email?.success !== false) {
        await markCoverageReminderSent(updateConn, reminder.rows);
      }
    } finally {
      updateConn.release();
    }

    return {
      success: email?.success !== false,
      reminder,
      email,
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

/* =========================================================
   PROCESS AUTO REMINDERS
========================================================= */

async function processMembershipDuesReminders(options = {}) {
  const conn = await pool.getConnection();

  try {
    const rows = await findMembershipDuesToRemind(conn, options);
    const groups = groupByMember(rows, options);

    const results = [];

    for (const group of groups) {
      const tx = await pool.getConnection();

      try {
        await tx.beginTransaction();

        const reminder = await createMembershipReminderForGroup(tx, group, options);

        await tx.commit();

        let email = {
          skipped: true,
        };

        if (options.send_email !== false) {
          email = await sendMembershipReminderEmail({
            email: reminder.member.email,
            full_name: reminder.member.full_name,
            member_no: reminder.member.member_no,

            invoice_id: reminder.invoice.id,
            invoice_number: reminder.invoice.invoice_number,

            amount: reminder.amount,
            coverage_label: reminder.coverage_label,

            payment_link: reminder.payment_link,
            public_links: reminder.public_links,
          });

          const updateConn = await pool.getConnection();

          try {
            await updateReminderHistory(updateConn, reminder.history, {
              status: email?.success === false ? "failed" : "sent",
              error: email?.error || null,
              sent_at: email?.success === false ? null : mysqlNow(),
            });

            if (email?.success !== false) {
              await markCoverageReminderSent(updateConn, reminder.rows);
            }
          } finally {
            updateConn.release();
          }
        }

        results.push({
          success: email?.success !== false,
          member_id: reminder.member.member_id,
          member_no: reminder.member.member_no,
          invoice_id: reminder.invoice.id,
          invoice_number: reminder.invoice.invoice_number,
          amount: reminder.amount,
          coverage_label: reminder.coverage_label,
          payment_link: reminder.payment_link,
          email,
        });
      } catch (err) {
        try {
          await tx.rollback();
        } catch (_rollbackErr) {}

        results.push({
          success: false,
          member_id: group.member.member_id,
          member_no: group.member.member_no,
          error: err.message,
        });
      } finally {
        tx.release();
      }
    }

    return {
      success: true,
      total_due_rows: rows.length,
      total_members: groups.length,
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  } finally {
    conn.release();
  }
}

module.exports = {
  findMembershipDuesToRemind,
  createMembershipReminderForGroup,
  sendMembershipReminderForMember,
  processMembershipDuesReminders,
  sendMembershipReminderEmail,

  buildInvoicePublicLinksForReminder,

  buildReminderHtml,
  buildReminderText,
};