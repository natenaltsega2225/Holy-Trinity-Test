//backend\services\domains\pledge\pledgeAutoOverdueProcessor.js
"use strict";

const crypto = require("crypto");
const pool = require("../../../db");

const PLEDGES_TABLE = "tbl_finance_pledges";

const AUDIT_TABLES = [
  "tbl_finance_pledge_audit_logs",
  "tbl_pledge_audit_logs",
  "tbl_finance_pledge_status_history",
  "tbl_pledge_status_history",
];

const DEFAULT_LIMIT = 250;
const OVERDUE_STATUSES = new Set([
  "receivable",
  "partial",
  "invoiced",
  "open",
  "pending",
]);

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

function daysPastDue(dateValue, now = new Date()) {
  const due = new Date(dateValue);
  if (Number.isNaN(due.getTime())) return 0;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000));
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

async function resolveAuditTable(conn) {
  for (const tableName of AUDIT_TABLES) {
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

async function getOverdueCandidates(options = {}) {
  const conn = await pool.getConnection();

  try {
    if (!(await tableExists(conn, PLEDGES_TABLE))) {
      return [];
    }

    const cols = await getColumns(conn, PLEDGES_TABLE);

    const dueExpr = firstColumn(cols, "p", [
      "due_date",
      "next_due_at",
      "pledge_due_date",
      "scheduled_date",
    ]);

    const pledgedExpr = firstColumn(cols, "p", [
      "pledged_amount",
      "amount",
      "total_amount",
    ], "0");

    const paidExpr = firstColumn(cols, "p", [
      "paid_amount",
      "amount_paid",
      "collected_amount",
    ], "0");

    const balanceExpr = firstColumn(cols, "p", [
      "remaining_balance",
      "balance_due",
      "outstanding_amount",
    ], `GREATEST(COALESCE(${pledgedExpr}, 0) - COALESCE(${paidExpr}, 0), 0)`);

    const statusExpr = firstColumn(cols, "p", ["status"], "'receivable'");

    const where = [
      `${dueExpr} IS NOT NULL`,
      `DATE(${dueExpr}) < CURDATE()`,
      `COALESCE(${balanceExpr}, 0) > 0`,
    ];

    if (cols.has("status")) {
      where.push(`
        LOWER(p.status) IN (
          'receivable',
          'partial',
          'invoiced',
          'open',
          'pending'
        )
      `);
    }

    const [rows] = await conn.query(
      `
      SELECT
        p.id AS pledge_id,
        ${firstColumn(cols, "p", ["member_id"], "NULL")} AS member_id,
        ${firstColumn(cols, "p", ["campaign_id"], "NULL")} AS campaign_id,
        ${firstColumn(cols, "p", ["pledge_number", "reference_no"], "NULL")} AS pledge_number,
        ${statusExpr} AS current_status,
        ${dueExpr} AS due_date,
        ${pledgedExpr} AS pledged_amount,
        ${paidExpr} AS paid_amount,
        ${balanceExpr} AS remaining_balance

      FROM ${PLEDGES_TABLE} p

      WHERE ${where.join(" AND ")}

      ORDER BY DATE(${dueExpr}) ASC, p.id ASC

      LIMIT ?
      `,
      [options.limit]
    );

    return rows.map((row) => ({
      pledge_id: row.pledge_id,
      member_id: row.member_id || null,
      campaign_id: row.campaign_id || null,
      pledge_number: clean(row.pledge_number) || `Pledge #${row.pledge_id}`,
      previous_status: clean(row.current_status, 40).toLowerCase(),
      due_date: row.due_date,
      pledged_amount: money(row.pledged_amount),
      paid_amount: money(row.paid_amount),
      remaining_balance: money(row.remaining_balance),
      days_overdue: daysPastDue(row.due_date, options.now),
    }));
  } finally {
    conn.release();
  }
}

function shouldMarkOverdue(pledge) {
  if (!pledge.pledge_id) return { ok: false, reason: "missing_pledge_id" };
  if (!pledge.due_date) return { ok: false, reason: "missing_due_date" };
  if (pledge.remaining_balance <= 0) return { ok: false, reason: "nothing_due" };
  if (!OVERDUE_STATUSES.has(pledge.previous_status)) {
    return { ok: false, reason: "status_not_eligible" };
  }

  if (pledge.days_overdue <= 0) {
    return { ok: false, reason: "not_past_due" };
  }

  return { ok: true };
}

async function recordOverdueAudit(conn, pledge, data = {}) {
  const auditTable = await resolveAuditTable(conn);
  if (!auditTable) return null;

  return insertExistingColumns(conn, auditTable, {
    pledge_id: pledge.pledge_id,
    member_id: pledge.member_id,
    campaign_id: pledge.campaign_id,
    action: "pledge.marked_overdue",
    event_type: "overdue",
    previous_status: pledge.previous_status,
    new_status: "overdue",
    old_status: pledge.previous_status,
    status: "overdue",
    actor_id: data.actorId || null,
    actor_type: "system",
    amount: pledge.remaining_balance,
    remaining_balance: pledge.remaining_balance,
    due_date: pledge.due_date,
    days_overdue: pledge.days_overdue,
    notes: data.reason || "Automatically marked overdue.",
    meta_json: JSON.stringify({
      run_id: data.runId,
      pledge_number: pledge.pledge_number,
      previous_status: pledge.previous_status,
      days_overdue: pledge.days_overdue,
    }),
    created_at: mysqlDateTime(data.now),
    updated_at: mysqlDateTime(data.now),
  });
}

async function markPledgeOverdue(conn, pledge, options) {
  const cols = await getColumns(conn, PLEDGES_TABLE);
  const set = [];
  const params = [];

  if (cols.has("status")) {
    set.push("`status` = ?");
    params.push("overdue");
  }

  if (cols.has("overdue_at")) {
    set.push("`overdue_at` = ?");
    params.push(mysqlDateTime(options.now));
  }

  if (cols.has("days_overdue")) {
    set.push("`days_overdue` = ?");
    params.push(pledge.days_overdue);
  }

  if (cols.has("is_overdue")) {
    set.push("`is_overdue` = 1");
  }

  if (cols.has("last_status_changed_at")) {
    set.push("`last_status_changed_at` = ?");
    params.push(mysqlDateTime(options.now));
  }

  if (cols.has("updated_at")) {
    set.push("`updated_at` = NOW()");
  }

  if (!set.length) {
    return {
      updated: false,
      reason: "no_supported_columns",
    };
  }

  params.push(pledge.pledge_id);

  await conn.query(
    `
    UPDATE ${PLEDGES_TABLE}
    SET ${set.join(", ")}
    WHERE id = ?
    `,
    params
  );

  return {
    updated: true,
  };
}

async function processOneOverduePledge(pledge, options) {
  const conn = await pool.getConnection();
  const lockName = `pledge:auto-overdue:${pledge.pledge_id}`;

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

    const check = shouldMarkOverdue(pledge);

    if (!check.ok) {
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
        previous_status: pledge.previous_status,
        new_status: "overdue",
        days_overdue: pledge.days_overdue,
      };
    }

    await conn.beginTransaction();

    const updateResult = await markPledgeOverdue(conn, pledge, options);

    if (!updateResult.updated) {
      await conn.rollback();

      return {
        pledge_id: pledge.pledge_id,
        status: "skipped",
        reason: updateResult.reason,
      };
    }

    await recordOverdueAudit(conn, pledge, {
      runId: options.runId,
      now: options.now,
      reason: "Automatically marked overdue by pledge overdue processor.",
    });

    await conn.commit();

    return {
      pledge_id: pledge.pledge_id,
      status: "updated",
      previous_status: pledge.previous_status,
      new_status: "overdue",
      days_overdue: pledge.days_overdue,
      remaining_balance: pledge.remaining_balance,
    };
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}

    return {
      pledge_id: pledge.pledge_id,
      status: "failed",
      reason: err.message,
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
    limit: Math.min(1000, toInt(options.limit, DEFAULT_LIMIT)),
    lockWaitSeconds: toInt(options.lockWaitSeconds, 3),
  };
}

async function processAutoOverduePledges(options = {}) {
  const normalized = normalizeOptions(options);
  const startedAt = new Date();

  const candidates = await getOverdueCandidates(normalized);

  const results = [];

  for (const pledge of candidates) {
    results.push(await processOneOverduePledge(pledge, normalized));
  }

  const summary = results.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    },
    {
      updated: 0,
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
    },
    candidates: candidates.length,
    summary,
    results,
  };
}

async function runPledgeAutoOverdueProcessor(options = {}) {
  return processAutoOverduePledges(options);
}

module.exports = {
  getOverdueCandidates,
  processAutoOverduePledges,
  runPledgeAutoOverdueProcessor,
};