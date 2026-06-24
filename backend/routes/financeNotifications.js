// backend/routes/financeNotifications.js
"use strict";

const express = require("express");
const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");
const publicAccess = require(
  "../services/domains/invoices/invoicePublicAccessService"
);
const router = express.Router();

const FINANCE_ROLES = ["finance", "admin", "super_admin"];
const columnCache = new Map();

function sqlId(name) {
  return `\`${String(name).replaceAll("`", "``")}\``;
}

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

function nullable(value, max = 255) {
  const text = clean(value, max);
  return text || null;
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function intValue(value, fallback = 50, min = 1, max = 500) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

async function tableColumns(table) {
  if (columnCache.has(table)) return columnCache.get(table);

  try {
    const [rows] = await pool.query(`SHOW COLUMNS FROM ${sqlId(table)}`);
    const columns = new Set(rows.map((row) => row.Field));
    columnCache.set(table, columns);
    return columns;
  } catch (_err) {
    const columns = new Set();
    columnCache.set(table, columns);
    return columns;
  }
}

async function ensureFinanceNotificationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tbl_finance_notifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      notification_number VARCHAR(80) NULL,
      channel VARCHAR(40) NOT NULL DEFAULT 'email',
      notification_type VARCHAR(80) NOT NULL DEFAULT 'announcement',
      audience VARCHAR(80) NOT NULL DEFAULT 'members',
      recipient_type VARCHAR(80) NULL,
      recipient_id BIGINT UNSIGNED NULL,
      recipient_name VARCHAR(180) NULL,
      recipient_email VARCHAR(190) NULL,
      subject VARCHAR(255) NOT NULL,
      message TEXT NULL,
      html_body MEDIUMTEXT NULL,
      related_entity VARCHAR(80) NULL,
      related_id BIGINT UNSIGNED NULL,
      related_number VARCHAR(120) NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'queued',
      attempts INT NOT NULL DEFAULT 0,
      last_attempt_at DATETIME NULL,
      sent_at DATETIME NULL,
      error_message TEXT NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_fin_notif_status (status),
      KEY idx_fin_notif_type (notification_type),
      KEY idx_fin_notif_email (recipient_email),
      KEY idx_fin_notif_related (related_entity, related_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  columnCache.delete("tbl_finance_notifications");
}

async function insertExisting(table, payload, conn = pool) {
  const columns = await tableColumns(table);
  const entries = Object.entries(payload).filter(([key]) => columns.has(key));

  if (!entries.length) {
    return { insertId: null };
  }

  const keys = entries.map(([key]) => sqlId(key));
  const values = entries.map(([, value]) => value);
  const marks = entries.map(() => "?");

  const [result] = await conn.query(
    `
    INSERT INTO ${sqlId(table)}
    (${keys.join(", ")})
    VALUES (${marks.join(", ")})
    `,
    values
  );

  return result;
}

async function updateExisting(table, id, payload, conn = pool) {
  const columns = await tableColumns(table);
  const entries = Object.entries(payload).filter(([key]) => columns.has(key));

  if (!entries.length) return null;

  const setSql = entries.map(([key]) => `${sqlId(key)} = ?`).join(", ");
  const values = entries.map(([, value]) => value);

  await conn.query(
    `
    UPDATE ${sqlId(table)}
    SET ${setSql}
    WHERE id = ?
    LIMIT 1
    `,
    [...values, id]
  );

  return true;
}

function requestActor(req) {
  return {
    id: req.user?.id || req.user?.user_id || null,
    role: req.user?.role || req.user?.user_role || null,
    email: req.user?.email || null,
  };
}

async function writeAudit(req, payload = {}) {
  try {
    await insertExisting("tbl_audit_logs", {
      actor_id: requestActor(req).id,
      actor_role: requestActor(req).role,
      actor_email: requestActor(req).email,
      user_id: requestActor(req).id,
      user_email: requestActor(req).email,
      action: clean(payload.action || "notification.sent", 120),
      entity: clean(payload.entity || payload.entity_type || "notification", 120),
      entity_type: clean(payload.entity_type || payload.entity || "notification", 120),
      entity_id: payload.entity_id || payload.related_id || null,
      reference_no: nullable(payload.reference_no || payload.related_number, 160),
      status: clean(payload.status || "info", 40),
      severity: clean(payload.severity || "info", 40),
      description: nullable(payload.description, 1000),
      message: nullable(payload.description, 1000),
      ip_address: nullable(
        req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
        80
      ),
      user_agent: nullable(req.headers["user-agent"], 500),
      metadata_json: payload.metadata ? JSON.stringify(payload.metadata) : null,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
      created_at: nowSql(),
    });
  } catch (err) {
    console.error("finance notification audit failed:", err.message);
  }
}

function loadEmailSender() {
  const candidates = [
    "../services/emailService",
    "../services/mailService",
    "../services/mailer",
    "../utils/email",
    "../utils/mailer",
    "../config/mailer",
  ];

  for (const path of candidates) {
    try {
      const mod = require(path);

      if (typeof mod === "function") {
        return (message) => mod(message);
      }

      for (const name of [
        "sendEmail",
        "sendMail",
        "send",
        "mail",
        "sendTemplatedEmail",
      ]) {
        if (typeof mod?.[name] === "function") {
          return (message) => mod[name](message);
        }
      }

      if (typeof mod?.transporter?.sendMail === "function") {
        return (message) => mod.transporter.sendMail(message);
      }
    } catch (_err) {}
  }

  return null;
}

const sendEmail = loadEmailSender();
function appUrl() {
  return (
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:5173"
  ).replace(/\/+$/, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US");
}
function apiPublicUrl() {
  return (
    process.env.BACKEND_PUBLIC_URL ||
    process.env.PUBLIC_BACKEND_URL ||
    process.env.API_PUBLIC_URL ||
    process.env.APP_URL ||
    process.env.FRONTEND_URL ||
    "http://localhost:5000"
  ).replace(/\/+$/, "");
}

function invoicePayLink(invoiceNumber, invoiceId, token = "") {
  const invoiceRef = encodeURIComponent(
    invoiceNumber || invoiceId
  );

  const query = token
    ? `?token=${encodeURIComponent(token)}`
    : "";

  return `${apiPublicUrl()}/api/public/invoices/${invoiceRef}/checkout${query}`;
}

function htmlForNotification({
title,
message,
recipientName,
invoices = [],
}) {
const safeTitle = escapeHtml(
title || "Holy Trinity Notification"
);

const safeMessage = escapeHtml(
message || ""
).replace(/\n/g, "<br />");

const totalDue = invoices.reduce(
(sum, invoice) =>
sum + Number(invoice.balance_due || 0),
0
);

const invoiceRows = invoices.length
? ` <div style="margin-top:24px"> <h3
       style="
         margin:0 0 16px;
         color:#102033;
         font-size:20px;
       "
     >
Outstanding Pledge Invoice${
invoices.length > 1 ? "s" : ""
} </h3>


  
${invoices
  .map((invoice) => {
    const payUrl =
      invoice.checkout_url ||
      invoice.pay_url ||
      invoice.public_pay_url ||
      invoice.publicLinks?.checkout_url ||
      invoice.publicLinks?.pay_url ||
      "";

    return `
      <div
        style="
          border:1px solid #d9e3ef;
          border-radius:10px;
          padding:18px;
          margin-bottom:16px;
          background:#f8fafc;
        "
      >
        <p style="margin:0 0 8px">
          <strong>Invoice Number:</strong>
          ${escapeHtml(
            invoice.invoice_number ||
            invoice.invoice_id
          )}
        </p>

        <p style="margin:0 0 8px">
          <strong>Outstanding Balance:</strong>
          ${formatMoney(
            invoice.balance_due
          )}
        </p>

        <p style="margin:0 0 14px">
          <strong>Due Date:</strong>
          ${formatDate(
            invoice.due_date
          )}
        </p>

        ${
          payUrl
            ? `
              <a
                href="${escapeHtml(payUrl)}"
                style="
                  display:inline-block;
                  background:#0f4c81;
                  color:#ffffff;
                  text-decoration:none;
                  padding:12px 18px;
                  border-radius:8px;
                  font-weight:700;
                "
              >
                Pay This Invoice
              </a>

              <div
                style="
                  margin-top:12px;
                  font-size:12px;
                  color:#64748b;
                  line-height:1.6;
                "
              >
                No login or registration required.
                Secure online payment available.
              </div>
            `
            : `
              <div
                style="
                  padding:12px;
                  background:#fff7ed;
                  border-left:4px solid #f97316;
                  color:#9a3412;
                  font-size:13px;
                "
              >
                Payment link unavailable.
                Please contact the finance office.
              </div>
            `
        }
      </div>
    `;
  })
  .join("")}

 



  </div>
`
: "";


return ` <div
   style="
     font-family:Arial,Helvetica,sans-serif;
     color:#102033;
   "
 > <h2
     style="
       margin:0 0 16px;
       font-size:24px;
       color:#102033;
     "
   >
${safeTitle} </h2>


  ${
    recipientName
      ? `
      <p
        style="
          margin:0 0 16px;
          font-size:15px;
          line-height:1.7;
        "
      >
        Dear ${escapeHtml(recipientName)},
      </p>
    `
      : ""
  }

  <div
    style="
      font-size:15px;
      line-height:1.8;
      color:#334155;
    "
  >
    ${safeMessage}
  </div>

  ${
    invoices.length
      ? `
        <div
          style="
            margin-top:22px;
            padding:16px;
            background:#eff6ff;
            border-left:4px solid #2563eb;
            border-radius:6px;
          "
        >
          <strong>Total Outstanding:</strong>
          ${formatMoney(totalDue)}
        </div>
      `
      : ""
  }

  ${invoiceRows}

  <div
    style="
      margin-top:30px;
      padding-top:20px;
      border-top:1px solid #d9e3ef;
      color:#64748b;
      font-size:13px;
      line-height:1.7;
    "
  >
    If you have already made payment,
    please disregard this reminder.

    <br /><br />

    Thank you for supporting
    Debre Berhan Holy Trinity Ethiopian
    Orthodox Tewahedo Church.
  </div>
</div>


`;
}


async function deliverEmail(row) {
  if (!sendEmail) {
    return {
      ok: false,
      error: "Email sender is not configured on this backend.",
    };
  }

  if (!row.recipient_email) {
    return {
      ok: false,
      error: "Recipient email is missing.",
    };
  }

  await sendEmail({
    to: row.recipient_email,
    subject: row.subject,
    text: row.message || row.subject,
    html: row.html_body || htmlForNotification({
      title: row.subject,
      message: row.message,
    }),
  });

  return { ok: true };
}

function normalizeNotificationRow(row = {}) {
  return {
    id: row.id,
    notification_number: row.notification_number,
    channel: row.channel || "email",
    type: row.notification_type || row.type || "announcement",
    notification_type: row.notification_type || row.type || "announcement",
    audience: row.audience || "--",
    recipient_type: row.recipient_type || "--",
    recipient_id: row.recipient_id || null,
    recipient_name: row.recipient_name || "--",
    email: row.recipient_email || row.email || "--",
    recipient_email: row.recipient_email || row.email || "--",
    subject: row.subject || "--",
    message: row.message || "",
    related_entity: row.related_entity || null,
    related_id: row.related_id || null,
    related_number: row.related_number || null,
    status: row.status || "queued",
    attempts: number(row.attempts),
    last_attempt_at: row.last_attempt_at,
    sent_at: row.sent_at,
    error_message: row.error_message || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
function firstColumn(columns, names) {
  return names.find((name) => columns.has(name)) || null;
}

async function getPledgePromiseRecipients(body = {}) {
  const pledgeColumns = await tableColumns("tbl_finance_pledges");
  const memberColumns = await tableColumns("tbl_members");

  if (!pledgeColumns.size || !memberColumns.size) return [];

  const emailCol = firstColumn(memberColumns, ["email", "member_email"]);
  if (!emailCol || !pledgeColumns.has("member_id")) return [];

  const nameExpr = memberColumns.has("full_name")
    ? "m.full_name"
    : memberColumns.has("name")
      ? "m.name"
      : memberColumns.has("first_name") && memberColumns.has("last_name")
        ? "CONCAT(m.first_name, ' ', m.last_name)"
        : "CONCAT('Member ', m.id)";

  const pledgedExpr = pledgeColumns.has("pledged_amount")
    ? "p.pledged_amount"
    : pledgeColumns.has("amount")
      ? "p.amount"
      : pledgeColumns.has("total_amount")
        ? "p.total_amount"
        : "0";

  const paidExpr = pledgeColumns.has("paid_amount") ? "p.paid_amount" : "0";

  const balanceExpr = pledgeColumns.has("remaining_balance")
    ? "p.remaining_balance"
    : pledgeColumns.has("balance_due")
      ? "p.balance_due"
      : pledgeColumns.has("outstanding_amount")
        ? "p.outstanding_amount"
        : `GREATEST(COALESCE(${pledgedExpr}, 0) - COALESCE(${paidExpr}, 0), 0)`;

  const statusCol = firstColumn(pledgeColumns, ["status", "pledge_status"]);
  const where = [
    "p.member_id IS NOT NULL",
    "p.member_id <> 0",
    `m.${sqlId(emailCol)} IS NOT NULL`,
    `m.${sqlId(emailCol)} <> ''`,
    `COALESCE(${balanceExpr}, 0) > 0`,
  ];
  const params = [];

  if (statusCol) {
    where.push(`
      LOWER(COALESCE(p.${sqlId(statusCol)}, 'active'))
      NOT IN ('paid','completed','complete','closed','cancelled','canceled','written_off','writeoff')
    `);
  }

  if (body.campaign_id) {
    where.push("p.campaign_id = ?");
    params.push(body.campaign_id);
  }

  const [rows] = await pool.query(
    `
    SELECT DISTINCT
      m.id,
      ${nameExpr} AS recipient_name,
      m.${sqlId(emailCol)} AS recipient_email
    FROM tbl_finance_pledges p
    JOIN tbl_members m ON m.id = p.member_id
    WHERE ${where.join(" AND ")}
    ORDER BY recipient_name ASC
    LIMIT 5000
    `,
    params
  );

  return rows.map((row) => ({
    recipient_type: "pledge_member",
    recipient_id: row.id,
    recipient_name: clean(row.recipient_name, 180),
    recipient_email: clean(row.recipient_email, 190),
  }));
}


async function getRecipients(audience, body = {}) {
  const value = clean(audience || body.audience || "members", 80);
  const explicit = Array.isArray(body.recipients) ? body.recipients : [];

  if (explicit.length) {
    return explicit
      .map((item) => ({
        recipient_type: clean(item.recipient_type || value, 80),
        recipient_id: item.id || item.recipient_id || null,
        recipient_name: clean(
          item.name ||
            item.full_name ||
            item.recipient_name ||
            [item.first_name, item.last_name].filter(Boolean).join(" "),
          180
        ),
        recipient_email: clean(item.email || item.recipient_email, 190),
      }))
      .filter((item) => item.recipient_email);
  }

  if (body.email || body.recipient_email) {
    return [
      {
        recipient_type: "custom",
        recipient_id: null,
        recipient_name: clean(
          body.name || body.recipient_name || "Recipient",
          180
        ),
        recipient_email: clean(
          body.email || body.recipient_email,
          190
        ),
      },
    ];
  }

  /*
  ==================================================
  PLEDGE REMINDER RECIPIENTS
  ==================================================*/


/*
==================================================
PLEDGE REMINDER RECIPIENTS
==================================================
*/
if (
  [
    "pledge_promises",
    "pledge_invoice_recipients",
    "members_with_open_pledges",
  ].includes(value)
) {
  const [invoiceRows] = await pool.query(`
    SELECT
      i.id AS invoice_id,
      i.invoice_number,
      i.member_id,
      m.full_name AS member_name,
      i.full_name_snapshot,
      m.email AS member_email,
      i.email_snapshot,
      i.balance_due,
      i.due_date
    FROM tbl_finance_invoices i
    LEFT JOIN tbl_members m
      ON m.id = i.member_id
    WHERE
      LOWER(COALESCE(i.category,'')) = 'pledge'
      AND COALESCE(i.balance_due,0) > 0
      AND LOWER(COALESCE(i.status,'open'))
        NOT IN ('paid','cancelled','canceled','closed')
      AND LOWER(COALESCE(i.invoice_status,'open'))
        NOT IN ('paid','cancelled','canceled','closed')
    ORDER BY
      i.due_date ASC,
      i.id ASC
  `);

  const grouped = new Map();

  for (const row of invoiceRows) {
    const email = clean(
      row.member_email || row.email_snapshot,
      190
    ).toLowerCase();

    if (!email) continue;

    const name = clean(
      row.member_name ||
      row.full_name_snapshot ||
      "Friend",
      180
    );

    if (!grouped.has(email)) {
      grouped.set(email, {
        recipient_type: row.member_id
          ? "member"
          : "external_pledge",

        recipient_id: row.member_id || null,
        recipient_name: name,
        recipient_email: email,
        invoices: [],
      });
    }

    let publicLinks = {};

    try {
      if (
        publicAccess &&
        typeof publicAccess.buildInvoicePublicLinks ===
          "function"
      ) {
        publicLinks =
          await publicAccess.buildInvoicePublicLinks({
            id: row.invoice_id,
            invoice_number: row.invoice_number,
          });

        console.log(
          "PUBLIC INVOICE LINKS:",
          row.invoice_number,
          publicLinks
        );
      }
    } catch (err) {
      console.error(
        "Failed building public invoice link:",
        err.message
      );
    }

    grouped.get(email).invoices.push({
      invoice_id: row.invoice_id,
      invoice_number: row.invoice_number,
      balance_due: row.balance_due,
      due_date: row.due_date,

      checkout_url:
        publicLinks.checkout_url || "",

      pay_url:
        publicLinks.checkout_url ||
        publicLinks.pay_url ||
        "",

      public_pay_url:
        publicLinks.checkout_url ||
        publicLinks.pay_url ||
        "",

      view_url:
        publicLinks.view_url || "",

      pdf_url:
        publicLinks.pdf_url || "",

      publicLinks,
    });
  }

  return Array.from(grouped.values());
}



  /*==================================================ALL MEMBERS / ACTIVE MEMBERS================*/
  
  if (
    ["members", "all_members", "active_members"].includes(
      value
    )
  ) {
    const columns = await tableColumns("tbl_members");
    if (!columns.size) return [];

    const nameExpr = columns.has("full_name")
      ? "full_name"
      : columns.has("name")
      ? "name"
      : columns.has("first_name") &&
        columns.has("last_name")
      ? "CONCAT(first_name,' ',last_name)"
      : "CONCAT('Member ',id)";

    const emailColumn = columns.has("email")
      ? "email"
      : null;

    if (!emailColumn) return [];

    const statusColumn = columns.has("status")
      ? "status"
      : columns.has("membership_status")
      ? "membership_status"
      : null;

    const memberWhere = [];

    if (value === "active_members" && statusColumn) {
      memberWhere.push(
        `LOWER(COALESCE(${sqlId(
          statusColumn
        )},'')) IN ('active','paid','current')`
      );
    }

    memberWhere.push(
      `${sqlId(emailColumn)} IS NOT NULL`
    );

    const [rows] = await pool.query(
      `
      SELECT
        id,
        ${nameExpr} AS recipient_name,
        ${sqlId(emailColumn)} AS recipient_email
      FROM tbl_members
      WHERE ${memberWhere.join(" AND ")}
      ORDER BY recipient_name ASC
      LIMIT 5000
      `
    );

    return rows.map((row) => ({
      recipient_type: "member",
      recipient_id: row.id,
      recipient_name: clean(row.recipient_name, 180),
      recipient_email: clean(row.recipient_email, 190),
    }));
  }

  /*
  ==================================================
  FINANCE / ADMINS
  ==================================================
  */
  if (
    [
      "finance",
      "finance_team",
      "admins",
      "admin",
      "super_admin",
    ].includes(value)
  ) {
    const columns = await tableColumns("tbl_users");

    if (!columns.size || !columns.has("email")) {
      return [];
    }

    const roleColumn = columns.has("role")
      ? "role"
      : columns.has("user_role")
      ? "user_role"
      : null;

    const nameExpr = columns.has("full_name")
      ? "full_name"
      : columns.has("name")
      ? "name"
      : columns.has("username")
      ? "username"
      : "email";

    const roles =
      value === "finance" ||
      value === "finance_team"
        ? ["finance", "admin", "super_admin"]
        : ["admin", "super_admin"];

    const where = roleColumn
      ? `WHERE LOWER(COALESCE(${sqlId(
          roleColumn
        )},'')) IN (${roles
          .map(() => "?")
          .join(",")})`
      : "";

    const [rows] = await pool.query(
      `
      SELECT
        id,
        ${nameExpr} AS recipient_name,
        email AS recipient_email
      FROM tbl_users
      ${where}
      ${where ? "AND" : "WHERE"} email IS NOT NULL
      ORDER BY recipient_name ASC
      LIMIT 1000
      `,
      roles
    );

    return rows.map((row) => ({
      recipient_type: value.includes("admin")
        ? "admin"
        : "finance",
      recipient_id: row.id,
      recipient_name: clean(row.recipient_name, 180),
      recipient_email: clean(row.recipient_email, 190),
    }));
  }

  return [];
}



async function queueNotifications(req, body = {}) {
  await ensureFinanceNotificationsTable();

  const notificationType = clean(
    body.notification_type || body.type || "announcement",
    80
  );

  let audience = clean(body.audience || "members", 80);

  // Automatically target only members with unpaid pledges
  // when sending a pledge reminder.
  if (
    notificationType === "pledge_reminder" &&
    ["members", "all_members", "active_members"].includes(audience)
  ) {
    audience = "pledge_promises";
  }

  const subject = clean(body.subject, 255);
  const message = clean(
    body.message || body.body || body.text,
    10000
  );

  const htmlBody =
    body.html_body ||
    body.html ||
    htmlForNotification({
      title: subject,
      message,
    });

  const relatedEntity = nullable(
    body.related_entity || body.entity || notificationType,
    80
  );

  const relatedId =
    body.related_id ||
    body.entity_id ||
    null;

  const relatedNumber = nullable(
    body.related_number || body.reference_no,
    120
  );

  if (!subject) {
    const err = new Error(
      "Notification subject is required."
    );
    err.status = 400;
    throw err;
  }

  if (!message && !body.html_body && !body.html) {
    const err = new Error(
      "Notification message is required."
    );
    err.status = 400;
    throw err;
  }

  const recipients = await getRecipients(audience, body);

  if (!recipients.length) {
    const err = new Error(
      audience === "pledge_promises"
        ? "No members with open pledges were found."
        : "No recipients found for this notification."
    );

    err.status = 400;
    throw err;
  }

  const createdIds = [];
const actor = requestActor(req);

for (const recipient of recipients) {
  const notificationNumber = `NTF-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;

  const invoiceSummary =
    Array.isArray(recipient.invoices) &&
    recipient.invoices.length
      ? recipient.invoices
          .map(
            (invoice) =>
              `Invoice Number: ${
                invoice.invoice_number || invoice.invoice_id
              }
Outstanding Balance: ${formatMoney(
                invoice.balance_due
              )}
Due Date: ${formatDate(invoice.due_date)}
Payment Link: ${
  invoice.pay_url ||
  invoice.checkout_url ||
  invoice.public_pay_url ||
  "Contact finance office"
}`
          )
          .join("\n\n")
      : "";

  const finalMessage = invoiceSummary
    ? `${message}\n\n${invoiceSummary}`
    : message;

  const finalHtmlBody = htmlForNotification({
    title: subject,
    message,
    recipientName: recipient.recipient_name,
    invoices: recipient.invoices || [],
  });

  const result = await insertExisting(
    "tbl_finance_notifications",
    {
      notification_number: notificationNumber,
      channel: "email",
      notification_type: notificationType,
      audience,

      recipient_type: recipient.recipient_type,
      recipient_id: recipient.recipient_id,
      recipient_name: recipient.recipient_name,
      recipient_email: recipient.recipient_email,

      subject,
      message: finalMessage,
      html_body: finalHtmlBody,

      related_entity: relatedEntity,
      related_id:
        recipient.invoices?.[0]?.invoice_id ||
        relatedId,
      related_number:
        recipient.invoices?.[0]?.invoice_number ||
        relatedNumber,

      status: body.send_now ? "sending" : "queued",
      attempts: 0,

      created_by: actor.id,
      created_at: nowSql(),
      updated_at: nowSql(),
    }
  );

  createdIds.push(result.insertId);
}
  

  await writeAudit(req, {
    action: "notification.queued",
    entity: "notification",
    entity_id: createdIds[0] || null,
    status: "success",
    description: `Queued ${createdIds.length} ${notificationType} notification(s).`,
    metadata: {
      notification_type: notificationType,
      audience,
      count: createdIds.length,
      related_entity: relatedEntity,
      related_id: relatedId,
    },
  });

  return createdIds;
}


async function sendQueuedNotification(req, id) {
  const [rows] = await pool.query(
    `
    SELECT *
    FROM tbl_finance_notifications
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  const row = rows[0];
  if (!row) {
    const err = new Error("Notification not found.");
    err.status = 404;
    throw err;
  }

  const attempt = number(row.attempts) + 1;

  try {
    await updateExisting("tbl_finance_notifications", id, {
      status: "sending",
      attempts: attempt,
      last_attempt_at: nowSql(),
      error_message: null,
      updated_at: nowSql(),
    });

    const result = await deliverEmail(row);

    if (!result.ok) {
      throw new Error(result.error || "Email delivery failed.");
    }

    await updateExisting("tbl_finance_notifications", id, {
      status: "sent",
      sent_at: nowSql(),
      error_message: null,
      updated_at: nowSql(),
    });

    await writeAudit(req, {
      action: "notification.sent",
      entity: row.related_entity || "notification",
      entity_id: row.related_id || row.id,
      reference_no: row.related_number || row.notification_number,
      status: "success",
      description: `Notification sent to ${row.recipient_email}.`,
    });

    return { id, ok: true };
  } catch (err) {
    await updateExisting("tbl_finance_notifications", id, {
      status: "failed",
      error_message: clean(err.message, 2000),
      updated_at: nowSql(),
    });

    await writeAudit(req, {
      action: "notification.failed",
      entity: row.related_entity || "notification",
      entity_id: row.related_id || row.id,
      reference_no: row.related_number || row.notification_number,
      status: "failure",
      severity: "warning",
      description: `Notification failed for ${row.recipient_email}: ${err.message}`,
    });

    return { id, ok: false, error: err.message };
  }
}

async function listNotifications(req, res) {
  try {
    await ensureFinanceNotificationsTable();

    const page = intValue(req.query.page, 1, 1, 10000);
    const limit = intValue(req.query.limit || req.query.pageSize, 50, 1, 250);
    const offset = (page - 1) * limit;
    const where = [];
    const params = [];

    if (req.query.type) {
      where.push("notification_type = ?");
      params.push(clean(req.query.type, 80));
    }

    if (req.query.status) {
      where.push("status = ?");
      params.push(clean(req.query.status, 40));
    }

    if (req.query.search || req.query.q) {
      const q = `%${clean(req.query.search || req.query.q, 120)}%`;
      where.push(`
        (
          recipient_name LIKE ?
          OR recipient_email LIKE ?
          OR subject LIKE ?
          OR related_number LIKE ?
          OR message LIKE ?
        )
      `);
      params.push(q, q, q, q, q);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [[countRow]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_finance_notifications
      ${whereSql}
      `,
      params
    );

    const [rows] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_notifications
      ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT ?
      OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [[summary]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('queued','pending','sending') THEN 1 ELSE 0 END) AS queued,
        SUM(CASE WHEN status IN ('sent','delivered') THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status IN ('failed','error') THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN notification_type LIKE '%pledge%' THEN 1 ELSE 0 END) AS pledge_reminders
      FROM tbl_finance_notifications
    `);

    return res.json({
      ok: true,
      rows: rows.map(normalizeNotificationRow),
      notifications: rows.map(normalizeNotificationRow),
      summary: {
        total: number(summary.total),
        queued: number(summary.queued),
        sent: number(summary.sent),
        failed: number(summary.failed),
        pledge_reminders: number(summary.pledge_reminders),
      },
      page,
      limit,
      total: number(countRow.total),
    });
  } catch (err) {
    console.error("finance notifications list failed:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load finance notifications.",
    });
  }
}

router.use(authRequired);
router.use(requireRole(...FINANCE_ROLES));

router.get("/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "financeNotifications",
    version: "enterprise",
    email_sender_configured: Boolean(sendEmail),
    timestamp: new Date().toISOString(),
  });
});

router.get(["/", "/notifications"], listNotifications);

router.post(["/", "/notifications", "/send", "/mass", "/announcement"], async (req, res) => {
  try {
    const ids = await queueNotifications(req, {
      ...(req.body || {}),
      send_now: Boolean(req.body?.send_now),
    });

    const deliveries = [];

    if (req.body?.send_now) {
      for (const id of ids) {
        deliveries.push(await sendQueuedNotification(req, id));
      }
    }

    return res.status(201).json({
      ok: true,
      message: req.body?.send_now
        ? "Notification queued and delivery attempted."
        : "Notification queued successfully.",
      ids,
      deliveries,
    });
  } catch (err) {
    console.error("finance notification create failed:", err);
    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Failed to create notification.",
    });
  }
});

router.post("/run", async (req, res) => {
  try {
    await ensureFinanceNotificationsTable();

    const limit = intValue(req.body?.limit || req.query.limit, 50, 1, 250);

    const [rows] = await pool.query(
      `
      SELECT id
      FROM tbl_finance_notifications
      WHERE status IN ('queued','pending','failed')
      ORDER BY
        CASE WHEN status = 'failed' THEN 1 ELSE 0 END,
        created_at ASC,
        id ASC
      LIMIT ?
      `,
      [limit]
    );

    const deliveries = [];

    for (const row of rows) {
      deliveries.push(await sendQueuedNotification(req, row.id));
    }

    return res.json({
      ok: true,
      attempted: deliveries.length,
      sent: deliveries.filter((item) => item.ok).length,
      failed: deliveries.filter((item) => !item.ok).length,
      deliveries,
    });
  } catch (err) {
    console.error("finance notification run failed:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to run notification queue.",
    });
  }
});

router.post(["/:id/retry", "/:id/send"], async (req, res) => {
  try {
    await ensureFinanceNotificationsTable();

    const result = await sendQueuedNotification(req, req.params.id);

    return res.json({
      ok: result.ok,
      result,
      error: result.error,
    });
  } catch (err) {
    console.error("finance notification retry failed:", err);
    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Failed to retry notification.",
    });
  }
});

router.all("*", (_req, res) => {
  return res.status(405).json({
    ok: false,
    error: "Method Not Allowed",
  });
});

// module.exports = router;
router.queueNotifications = queueNotifications;
router.sendQueuedNotification = sendQueuedNotification;

module.exports = router;
