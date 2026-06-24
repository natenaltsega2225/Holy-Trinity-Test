//backend\services\domains\pledge\pledgeAutoReminderProcessor.js
"use strict";

const crypto = require("crypto");
const pool = require("../../../db");
const { sendMail } = require("../../emailService");

const PLEDGES_TABLE = "tbl_finance_pledges";
const HISTORY_TABLES = [
  "tbl_finance_pledge_reminder_history",
  "tbl_pledge_reminder_history",
];

const DEFAULT_LIMIT = 100;
const DEFAULT_LOOKAHEAD_DAYS = 7;
const DEFAULT_COOLDOWN_DAYS = 7;
const DEFAULT_MAX_REMINDERS = 5;

const tableCache = new Map();
const columnCache = new Map();

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : fallback;
}

function mysqlDateTime(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function daysUntil(dateValue, now = new Date()) {
  const due = new Date(dateValue);
  if (Number.isNaN(due.getTime())) return null;

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.ceil((due.getTime() - start.getTime()) / 86400000);
}

async function tableExists(conn, tableName) {
  if (tableCache.has(tableName)) return tableCache.get(tableName);

  const [rows] = await conn.query("SHOW TABLES LIKE ?", [tableName]);
  const exists = rows.length > 0;

  tableCache.set(tableName, exists);
  return exists;
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
  const cols = new Set(rows.map((row) => row.Field));

  columnCache.set(tableName, cols);
  return cols;
}

function firstColumn(cols, alias, names, fallback = "NULL") {
  for (const name of names) {
    if (cols.has(name)) return `${alias}.\`${name}\``;
  }

  return fallback;
}

async function resolveHistoryTable(conn) {
  for (const tableName of HISTORY_TABLES) {
    if (await tableExists(conn, tableName)) return tableName;
  }

  return null;
}

async function insertExistingColumns(conn, tableName, data) {
  const cols = await getColumns(conn, tableName);

  const entries = Object.entries(data).filter(
    ([key, value]) => cols.has(key) && value !== undefined
  );

  if (!entries.length) return null;

  const fields = entries.map(([key]) => `\`${key}\``).join(", ");
  const placeholders = entries.map(() => "?").join(", ");
  const values = entries.map(([, value]) => value);

  const [result] = await conn.query(
    `INSERT INTO \`${tableName}\` (${fields}) VALUES (${placeholders})`,
    values
  );

  return result.insertId;
}

async function updatePledgeReminderState(conn, pledge, options) {
  const cols = await getColumns(conn, PLEDGES_TABLE);
  const set = [];
  const params = [];
  const nowSql = mysqlDateTime(options.now);

  if (cols.has("last_reminder_at")) {
    set.push("`last_reminder_at` = ?");
    params.push(nowSql);
  }

  if (cols.has("reminder_sent_at")) {
    set.push("`reminder_sent_at` = ?");
    params.push(nowSql);
  }

  if (cols.has("reminder_count")) {
    set.push("`reminder_count` = COALESCE(`reminder_count`, 0) + 1");
  }

  if (cols.has("next_reminder_at")) {
    set.push("`next_reminder_at` = ?");
    params.push(mysqlDateTime(addDays(options.now, options.cooldownDays)));
  }

  if (cols.has("updated_at")) {
    set.push("`updated_at` = NOW()");
  }

  if (!set.length) return false;

  params.push(pledge.pledge_id);

  await conn.query(
    `
    UPDATE ${PLEDGES_TABLE}
    SET ${set.join(", ")}
    WHERE id = ?
    `,
    params
  );

  return true;
}

async function getReminderCandidates(options = {}) {
  const conn = await pool.getConnection();

  try {
    if (!(await tableExists(conn, PLEDGES_TABLE))) {
      return [];
    }

    const pledgeCols = await getColumns(conn, PLEDGES_TABLE);
    const memberExists = await tableExists(conn, "tbl_members");
    const userExists = await tableExists(conn, "tbl_users");
    const campaignExists = await tableExists(conn, "tbl_finance_campaigns");

    const memberCols = memberExists ? await getColumns(conn, "tbl_members") : new Set();
    const userCols = userExists ? await getColumns(conn, "tbl_users") : new Set();
    const campaignCols = campaignExists
      ? await getColumns(conn, "tbl_finance_campaigns")
      : new Set();

    const dueExpr = firstColumn(pledgeCols, "p", [
      "due_date",
      "next_due_at",
      "pledge_due_date",
      "scheduled_date",
    ]);

    const pledgedExpr = firstColumn(pledgeCols, "p", [
      "pledged_amount",
      "amount",
      "total_amount",
    ], "0");

    const paidExpr = firstColumn(pledgeCols, "p", [
      "paid_amount",
      "amount_paid",
      "collected_amount",
    ], "0");

    const balanceExpr = firstColumn(pledgeCols, "p", [
      "remaining_balance",
      "balance_due",
      "outstanding_amount",
    ], `GREATEST(COALESCE(${pledgedExpr}, 0) - COALESCE(${paidExpr}, 0), 0)`);

    const statusExpr = firstColumn(pledgeCols, "p", ["status"], "'receivable'");
    const reminderCountExpr = firstColumn(pledgeCols, "p", ["reminder_count"], "0");
    const lastReminderExpr = firstColumn(pledgeCols, "p", ["last_reminder_at"], "NULL");
    const nextReminderExpr = firstColumn(pledgeCols, "p", ["next_reminder_at"], "NULL");

    const memberJoin =
      memberExists && pledgeCols.has("member_id")
        ? "LEFT JOIN tbl_members m ON m.id = p.member_id"
        : "";

    const userJoin =
      userExists && pledgeCols.has("member_id")
        ? "LEFT JOIN tbl_users u ON u.member_id = p.member_id"
        : "";

    const campaignJoin =
      campaignExists && pledgeCols.has("campaign_id")
        ? "LEFT JOIN tbl_finance_campaigns c ON c.id = p.campaign_id"
        : "";

    const emailParts = [];
    if (pledgeCols.has("email")) emailParts.push("p.email");
    if (pledgeCols.has("donor_email")) emailParts.push("p.donor_email");
    if (memberExists && memberCols.has("email")) emailParts.push("m.email");
    if (userExists && userCols.has("email")) emailParts.push("u.email");

    const nameParts = [];
    if (pledgeCols.has("donor_name")) nameParts.push("p.donor_name");
    if (pledgeCols.has("full_name")) nameParts.push("p.full_name");
    if (memberExists && memberCols.has("full_name")) nameParts.push("m.full_name");
    if (userExists && userCols.has("full_name")) nameParts.push("u.full_name");

    const campaignNameParts = [];
    if (campaignExists && campaignCols.has("title")) campaignNameParts.push("c.title");
    if (campaignExists && campaignCols.has("name")) campaignNameParts.push("c.name");
    if (campaignExists && campaignCols.has("campaign_name")) {
      campaignNameParts.push("c.campaign_name");
    }

    const where = [
      `${dueExpr} IS NOT NULL`,
      `DATE(${dueExpr}) <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`,
      `COALESCE(${balanceExpr}, 0) > 0`,
    ];

    const params = [options.lookAheadDays];

    if (pledgeCols.has("status")) {
      where.push(`
        LOWER(p.status) IN (
          'receivable',
          'partial',
          'invoiced',
          'open',
          'pending',
          'overdue'
        )
      `);
    }

    if (pledgeCols.has("next_reminder_at")) {
      where.push("(p.next_reminder_at IS NULL OR p.next_reminder_at <= NOW())");
    }

    const [rows] = await conn.query(
      `
      SELECT
        p.id AS pledge_id,
        ${firstColumn(pledgeCols, "p", ["member_id"], "NULL")} AS member_id,
        ${firstColumn(pledgeCols, "p", ["campaign_id"], "NULL")} AS campaign_id,
        ${firstColumn(pledgeCols, "p", ["pledge_number", "reference_no"], "NULL")} AS pledge_number,
        ${statusExpr} AS status,
        ${dueExpr} AS due_date,
        ${pledgedExpr} AS pledged_amount,
        ${paidExpr} AS paid_amount,
        ${balanceExpr} AS amount_due,
        ${reminderCountExpr} AS reminder_count,
        ${lastReminderExpr} AS last_reminder_at,
        ${nextReminderExpr} AS next_reminder_at,
        ${emailParts.length ? `COALESCE(${emailParts.join(", ")})` : "NULL"} AS email,
        ${nameParts.length ? `COALESCE(${nameParts.join(", ")})` : "NULL"} AS full_name,
        ${campaignNameParts.length ? `COALESCE(${campaignNameParts.join(", ")})` : "NULL"} AS campaign_name

      FROM ${PLEDGES_TABLE} p

      ${memberJoin}
      ${userJoin}
      ${campaignJoin}

      WHERE ${where.join(" AND ")}

      ORDER BY DATE(${dueExpr}) ASC, p.id ASC

      LIMIT ?
      `,
      [...params, options.limit]
    );

    return rows.map((row) => ({
      pledge_id: row.pledge_id,
      member_id: row.member_id || null,
      campaign_id: row.campaign_id || null,
      pledge_number: row.pledge_number || `Pledge #${row.pledge_id}`,
      full_name: clean(row.full_name, 180) || "Member",
      email: clean(row.email, 190).toLowerCase(),
      campaign_name: clean(row.campaign_name, 180) || "Church pledge",
      status: clean(row.status, 40).toLowerCase(),
      due_date: row.due_date,
      pledged_amount: money(row.pledged_amount),
      paid_amount: money(row.paid_amount),
      amount_due: money(row.amount_due),
      reminder_count: Number(row.reminder_count || 0),
      last_reminder_at: row.last_reminder_at || null,
      next_reminder_at: row.next_reminder_at || null,
      days_until_due: daysUntil(row.due_date, options.now),
    }));
  } finally {
    conn.release();
  }
}

function shouldSendReminder(pledge, options) {
  if (!pledge.email) {
    return { ok: false, reason: "missing_email" };
  }

  if (!pledge.due_date) {
    return { ok: false, reason: "missing_due_date" };
  }

  if (pledge.amount_due <= 0) {
    return { ok: false, reason: "nothing_due" };
  }

  if (pledge.reminder_count >= options.maxReminders) {
    return { ok: false, reason: "max_reminders_reached" };
  }

  if (pledge.last_reminder_at) {
    const last = new Date(pledge.last_reminder_at);
    const nextAllowed = addDays(last, options.cooldownDays);

    if (nextAllowed > options.now) {
      return { ok: false, reason: "cooldown_active" };
    }
  }

  if (pledge.next_reminder_at && new Date(pledge.next_reminder_at) > options.now) {
    return { ok: false, reason: "next_reminder_not_due" };
  }

  if (pledge.days_until_due === null) {
    return { ok: false, reason: "invalid_due_date" };
  }

  if (pledge.days_until_due > options.lookAheadDays) {
    return { ok: false, reason: "outside_reminder_window" };
  }

  return { ok: true, reason: "eligible" };
}

function buildReminderEmail(pledge, options) {
  const appUrl = (
    options.frontendUrl ||
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    "http://18.224.63.249"
  ).replace(/\/+$/, "");

  // const pledgeUrl = `${appUrl}/member/pledges`;
  const publicLinks =
  invoicePublicAccessService.buildInvoicePublicLinks(
    invoice,
    {
      ttl_days: 30,
      scope: ["view", "pdf", "download", "pay"]
    }
  );

const pledgeUrl =
  publicLinks.pay_url ||
  publicLinks.view_url;
  const dueText =
    pledge.days_until_due < 0
      ? `${Math.abs(pledge.days_until_due)} day(s) overdue`
      : pledge.days_until_due === 0
      ? "due today"
      : `due in ${pledge.days_until_due} day(s)`;

  return {
    subject: `Pledge reminder: ${pledge.campaign_name}`,
    text:
      `Dear ${pledge.full_name}, this is a reminder for ${pledge.pledge_number}. ` +
      `Amount due: $${pledge.amount_due.toFixed(2)}. ` +
      `This pledge is ${dueText}. View details: ${pledgeUrl}`,

    html: `
      <h2>Pledge Reminder</h2>

      <p>Dear ${escapeHtml(pledge.full_name)},</p>

      <p>This is a friendly reminder about your pledge for:</p>

      <p><strong>${escapeHtml(pledge.campaign_name)}</strong></p>

      <table style="width:100%;border-collapse:collapse;margin-top:20px;">
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Pledge</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(pledge.pledge_number)}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Amount Due</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;">$${pledge.amount_due.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Due Status</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(dueText)}</td>
        </tr>
      </table>

      <div style="margin-top:24px;">
        <a href="${escapeHtml(pledgeUrl)}" style="background:#0d3b66;color:white;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
          View Pledge
        </a>
      </div>

      <p style="margin-top:24px;color:#64748b;font-size:13px;">
        If you already made this payment, please disregard this reminder.
      </p>
    `,
  };
}

async function recordReminder(conn, pledge, status, data = {}) {
  const historyTable = await resolveHistoryTable(conn);
  if (!historyTable) return null;

  return insertExistingColumns(conn, historyTable, {
    pledge_id: pledge.pledge_id,
    member_id: pledge.member_id,
    campaign_id: pledge.campaign_id,
    reminder_type: data.reminder_type || "auto",
    channel: "email",
    recipient_email: pledge.email,
    email: pledge.email,
    status,
    message_id: data.messageId || null,
    error_message: data.error || null,
    amount_due: pledge.amount_due,
    due_date: pledge.due_date,
    sent_at: status === "sent" ? mysqlDateTime(data.sentAt || new Date()) : null,
    created_at: mysqlDateTime(data.createdAt || new Date()),
    updated_at: mysqlDateTime(data.updatedAt || new Date()),
    meta_json: JSON.stringify({
      run_id: data.runId,
      days_until_due: pledge.days_until_due,
      pledge_number: pledge.pledge_number,
      campaign_name: pledge.campaign_name,
    }),
  });
}

async function processOneReminder(pledge, options) {
  const conn = await pool.getConnection();
  const lockName = `pledge:auto-reminder:${pledge.pledge_id}`;

  try {
    const [[lockRow]] = await conn.query("SELECT GET_LOCK(?, ?) AS got_lock", [
      lockName,
      options.lockWaitSeconds,
    ]);

    if (Number(lockRow?.got_lock || 0) !== 1) {
      return {
        pledge_id: pledge.pledge_id,
        status: "skipped",
        reason: "locked",
      };
    }

    const check = shouldSendReminder(pledge, options);

    if (!check.ok) {
      await recordReminder(conn, pledge, "skipped", {
        runId: options.runId,
        error: check.reason,
      });

      return {
        pledge_id: pledge.pledge_id,
        status: "skipped",
        reason: check.reason,
      };
    }

    if (options.dryRun) {
      return {
        pledge_id: pledge.pledge_id,
        status: "dry_run",
        reason: "eligible",
        to: pledge.email,
      };
    }

    const email = buildReminderEmail(pledge, options);

    const result = await sendMail({
      to: pledge.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    if (!result?.success) {
      await recordReminder(conn, pledge, "failed", {
        runId: options.runId,
        error: result?.error || "Email send failed.",
      });

      return {
        pledge_id: pledge.pledge_id,
        status: "failed",
        reason: result?.error || "Email send failed.",
      };
    }

    await updatePledgeReminderState(conn, pledge, options);

    await recordReminder(conn, pledge, "sent", {
      runId: options.runId,
      messageId: result.messageId,
      sentAt: options.now,
    });

    return {
      pledge_id: pledge.pledge_id,
      status: "sent",
      to: pledge.email,
      messageId: result.messageId,
    };
  } finally {
    try {
      await conn.query("SELECT RELEASE_LOCK(?)", [lockName]);
    } catch {}

    conn.release();
  }
}

function normalizeOptions(options = {}) {
  return {
    now: options.now ? new Date(options.now) : new Date(),
    runId: options.runId || crypto.randomUUID(),
    dryRun: Boolean(options.dryRun),
    limit: Math.min(500, toInt(options.limit, DEFAULT_LIMIT)),
    lookAheadDays: toInt(options.lookAheadDays, DEFAULT_LOOKAHEAD_DAYS),
    cooldownDays: toInt(options.cooldownDays, DEFAULT_COOLDOWN_DAYS),
    maxReminders: toInt(options.maxReminders, DEFAULT_MAX_REMINDERS),
    lockWaitSeconds: toInt(options.lockWaitSeconds, 3),
    frontendUrl: options.frontendUrl || null,
  };
}

async function processAutoReminders(options = {}) {
  const normalized = normalizeOptions(options);
  const startedAt = new Date();

  const candidates = await getReminderCandidates(normalized);

  const results = [];
  for (const pledge of candidates) {
    try {
      results.push(await processOneReminder(pledge, normalized));
    } catch (err) {
      results.push({
        pledge_id: pledge.pledge_id,
        status: "failed",
        reason: err.message,
      });
    }
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
    run_id: normalized.runId,
    started_at: mysqlDateTime(startedAt),
    finished_at: mysqlDateTime(),
    options: {
      dryRun: normalized.dryRun,
      limit: normalized.limit,
      lookAheadDays: normalized.lookAheadDays,
      cooldownDays: normalized.cooldownDays,
      maxReminders: normalized.maxReminders,
    },
    candidates: candidates.length,
    summary,
    results,
  };
}

async function runPledgeAutoReminderProcessor(options = {}) {
  return processAutoReminders(options);
}

module.exports = {
  getReminderCandidates,
  processAutoReminders,
  runPledgeAutoReminderProcessor,
};