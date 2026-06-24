

// backend/services/domains/membership/membershipCoverageService.js
"use strict";

const pool = require("../../../db");

const {
  insertExistingColumns,
  findOne,
  findMany,
  updateExistingColumns,
} = require("../../../utils/dbHelpers");

const {
  money,
  mysqlNow,
} = require("../../../utils/financeHelpers");

const MONTH_NAMES = [
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

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const PAID_STATUSES = new Set(["paid", "completed", "posted"]);
const OPEN_STATUSES = new Set(["open", "unpaid", "pending", "overdue", "due", ""]);

function clean(value, max = 255) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function safeDate(value) {
  if (!value) return null;

  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateOnly(value) {
  const d = safeDate(value) || new Date();

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function firstDayOfMonth(value) {
  const d = safeDate(value) || new Date();

  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function lastDayOfMonth(value) {
  const d = safeDate(value) || new Date();

  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addMonths(value, months) {
  const d = safeDate(value) || new Date();

  return new Date(
    d.getFullYear(),
    d.getMonth() + Number(months || 0),
    1
  );
}

function monthKey(year, monthNumber) {
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

function monthName(monthNumber) {
  return MONTH_NAMES[Number(monthNumber) - 1] || String(monthNumber || "");
}

function monthShort(monthNumber) {
  return MONTH_SHORT[Number(monthNumber) - 1] || String(monthNumber || "");
}

function monthObject(year, month) {
  return {
    year: Number(year),
    month: Number(month),
  };
}

function compareMonth(a, b) {
  if (Number(a.year) !== Number(b.year)) {
    return Number(a.year) - Number(b.year);
  }

  return Number(a.month) - Number(b.month);
}

function maxMonth(a, b) {
  if (!a) return b;
  if (!b) return a;

  return compareMonth(a, b) >= 0 ? a : b;
}

function parseMonthValue(value, fallbackYear) {
  if (!value) return null;

  const raw = String(value).trim();

  if (/^\d{4}-\d{1,2}$/.test(raw)) {
    const [year, month] = raw.split("-").map(Number);

    if (month >= 1 && month <= 12) {
      return { year, month };
    }
  }

  if (/^\d{1,2}$/.test(raw)) {
    const month = Number(raw);

    if (month >= 1 && month <= 12) {
      return {
        year: Number(fallbackYear) || new Date().getFullYear(),
        month,
      };
    }
  }

  const lower = raw.toLowerCase();
  const fullIndex = MONTH_NAMES.findIndex((name) => name.toLowerCase() === lower);
  const shortIndex = MONTH_SHORT.findIndex((name) => name.toLowerCase() === lower.slice(0, 3));

  const index = fullIndex >= 0 ? fullIndex : shortIndex;

  if (index >= 0) {
    return {
      year: Number(fallbackYear) || new Date().getFullYear(),
      month: index + 1,
    };
  }

  return null;
}

function isTruthy(value) {
  return ["true", "1", "yes", "on"].includes(
    String(value || "").toLowerCase()
  );
}

function isRecurring(payload = {}) {
  return (
    isTruthy(payload.is_recurring) ||
    isTruthy(payload.auto_renew) ||
    isTruthy(payload.auto_payment_enabled) ||
    isTruthy(payload.subscription_enabled) ||
    !!payload.stripe_subscription_id
  );
}

function normalizeMonths(payload = {}) {
  if (isRecurring(payload)) return 1;

  const explicit =
    Number(payload.months) ||
    Number(payload.months_paid) ||
    Number(payload.duration_months) ||
    Number(payload.interval_count);

  if (explicit && Number.isFinite(explicit) && explicit > 0) {
    return Math.trunc(explicit);
  }

  if (payload.coverage_months_json) {
    try {
      const parsed = JSON.parse(payload.coverage_months_json);
      if (Array.isArray(parsed) && parsed.length) return parsed.length;
    } catch {
      // Ignore invalid coverage JSON.
    }
  }

  const text = clean(
    payload.plan_name ||
      payload.plan_duration ||
      payload.selected_option ||
      payload.sub_category ||
      "",
    120
  ).toLowerCase();

  if (text.includes("12") || text.includes("annual") || text.includes("year")) return 12;
  if (text.includes("6")) return 6;
  if (text.includes("3") || text.includes("quarter")) return 3;

  return 1;
}

function normalizeMonthNumber(row = {}) {
  const direct = Number(
    row.month_number ||
      row.coverage_month_number ||
      row.month ||
      row.m ||
      0
  );

  if (direct >= 1 && direct <= 12) {
    return direct;
  }

  const raw = clean(
    row.coverage_month ||
      row.month_name ||
      row.coverage_month_name ||
      "",
    80
  );

  const parsed = parseMonthValue(raw, row.coverage_year || row.year);
  return parsed?.month || null;
}

function normalizeCoverageRow(row = {}) {
  const monthNumber = normalizeMonthNumber(row);
  const year = Number(row.coverage_year || row.year || 0);
  const status = clean(row.status || row.coverage_status || "unpaid", 40).toLowerCase();

  const name =
    monthNumber >= 1 && monthNumber <= 12
      ? MONTH_NAMES[monthNumber - 1]
      : row.month_name || row.coverage_month_name || null;

  const short =
    monthNumber >= 1 && monthNumber <= 12
      ? MONTH_SHORT[monthNumber - 1]
      : null;

  return {
    ...row,

    coverage_year: year || null,
    coverage_month:
      year && monthNumber
        ? monthKey(year, monthNumber)
        : row.coverage_month || null,

    coverage_month_name: row.coverage_month_name || name,
    month_number: monthNumber,
    month_name: row.month_name || name,
    month_short: short,

    paid: PAID_STATUSES.has(status),
    coverage_status: row.coverage_status || row.status || "unpaid",
    status: row.status || row.coverage_status || "unpaid",
  };
}

async function loadMember(memberId) {
  if (!memberId) return null;

  const row = await findOne(
    pool,
    `
    SELECT *
    FROM tbl_members
    WHERE id = ?
    LIMIT 1
    `,
    [memberId]
  );

  return row || null;
}

function getMemberStartMonth(member = {}, payload = {}) {
  const startDate =
    safeDate(payload.membership_start_date) ||
    safeDate(payload.member_start_date) ||
    safeDate(payload.join_date) ||
    safeDate(payload.start_date) ||
    safeDate(member.membership_start_date) ||
    safeDate(member.member_start_date) ||
    safeDate(member.join_date) ||
    safeDate(member.joined_at) ||
    safeDate(member.start_date) ||
    safeDate(member.created_at) ||
    null;

  if (!startDate) return null;

  return {
    year: startDate.getFullYear(),
    month: startDate.getMonth() + 1,
  };
}

async function getMemberCoverageStart(memberId, payload = {}) {
  const member = await loadMember(memberId);

  return (
    getMemberStartMonth(member, payload) || {
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
    }
  );
}

function buildCoverageRows(start, months) {
  const rows = [];
  const count = Math.max(1, Number(months || 1));

  for (let i = 0; i < count; i += 1) {
    const date = new Date(Number(start.year), Number(start.month) - 1 + i, 1);
    const year = date.getFullYear();
    const monthNumber = date.getMonth() + 1;

    rows.push({
      coverage_year: year,
      coverage_month: monthKey(year, monthNumber),
      coverage_month_name: monthName(monthNumber),
      month_number: monthNumber,
      month_name: monthName(monthNumber),
      month_short: monthShort(monthNumber),
      coverage_key: monthKey(year, monthNumber),
      label: `${monthShort(monthNumber)} ${year}`,
    });
  }

  return rows;
}

function parseExplicitCoverageRows(payload = {}, memberStart = null) {
  if (!payload.coverage_months_json) return [];

  try {
    const parsed = JSON.parse(payload.coverage_months_json);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((row) => {
        const year = Number(row.year || row.y || row.coverage_year || payload.coverage_year || 0);
        const monthNumber = Number(
          row.month_number ||
            row.monthNumber ||
            row.month ||
            row.m ||
            0
        );

        if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) {
          return null;
        }

        const month = monthObject(year, monthNumber);

        if (memberStart && compareMonth(month, memberStart) < 0) {
          return null;
        }

        return {
          coverage_year: year,
          coverage_month: monthKey(year, monthNumber),
          coverage_month_name: monthName(monthNumber),
          month_number: monthNumber,
          month_name: monthName(monthNumber),
          month_short: monthShort(monthNumber),
          coverage_key: monthKey(year, monthNumber),
          label: row.label || `${monthShort(monthNumber)} ${year}`,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function getNextCoverageStart(memberId, payload = {}) {
  const memberStart = await getMemberCoverageStart(memberId, payload);

  const row = await findOne(
    pool,
    `
    SELECT
      coverage_year,
      month_number
    FROM tbl_member_membership_coverage
    WHERE member_id = ?
      AND LOWER(COALESCE(status, '')) IN ('paid', 'completed', 'posted')
    ORDER BY
      coverage_year DESC,
      month_number DESC
    LIMIT 1
    `,
    [memberId]
  );

  if (!row) {
    return firstDayOfMonth(
      new Date(memberStart.year, memberStart.month - 1, 1)
    );
  }

  let year = Number(row.coverage_year);
  let month = Number(row.month_number) + 1;

  if (month > 12) {
    month = 1;
    year += 1;
  }

  const next = maxMonth(
    { year, month },
    memberStart
  );

  return firstDayOfMonth(new Date(next.year, next.month - 1, 1));
}

async function resolveCoverageRows(memberId, payload = {}) {
  const memberStart = await getMemberCoverageStart(memberId, payload);
  const months = normalizeMonths(payload);

  const explicitStart = parseMonthValue(
    payload.coverage_start_month ||
      payload.membership_start_month ||
      payload.start_month,
    payload.coverage_year
  );

  let start =
    explicitStart ||
    null;

  if (start && compareMonth(start, memberStart) < 0) {
    start = memberStart;
  }

  const explicitRows = parseExplicitCoverageRows(payload, memberStart);

  if (explicitRows.length && !isRecurring(payload)) {
    return explicitRows;
  }

  if (!start) {
    const next = await getNextCoverageStart(memberId, payload);

    start = {
      year: next.getFullYear(),
      month: next.getMonth() + 1,
    };
  }

  start = maxMonth(start, memberStart);

  return buildCoverageRows(start, isRecurring(payload) ? 1 : months);
}

async function markPreStartCoverageNotApplicable(memberId, payload = {}) {
  if (!memberId) return;

  const memberStart = await getMemberCoverageStart(memberId, payload);

  await updateExistingColumns(
    pool,
    "tbl_member_membership_coverage",
    {
      status: "not_applicable",
      coverage_status: "not_applicable",
      notes: "Before member start date; excluded from open/unpaid/overdue membership balance.",
      updated_at: mysqlNow(),
    },
    `
    member_id = ?
      AND (
        coverage_year < ?
        OR (
          coverage_year = ?
          AND month_number < ?
        )
      )
      AND LOWER(COALESCE(status, coverage_status, '')) IN ('open', 'unpaid', 'pending', 'overdue', 'due', '')
    `,
    [
      memberId,
      memberStart.year,
      memberStart.year,
      memberStart.month,
    ]
  ).catch(() => {});
}

async function assertNoDuplicatePaidCoverage(memberId, rows = []) {
  if (!memberId || !rows.length) return;

  const conditions = [];
  const params = [memberId];

  rows.forEach((row) => {
    conditions.push("(coverage_year = ? AND month_number = ?)");
    params.push(row.coverage_year, row.month_number);
  });

  const duplicates = await findMany(
    pool,
    `
    SELECT
      id,
      coverage_year,
      month_number,
      month_name,
      payment_number,
      receipt_number,
      status
    FROM tbl_member_membership_coverage
    WHERE member_id = ?
      AND (${conditions.join(" OR ")})
      AND LOWER(COALESCE(status, coverage_status, '')) IN ('paid', 'completed', 'posted')
    `,
    params
  ).catch(() => []);

  if (!duplicates.length) return;

  const months = duplicates
    .map((row) => `${monthName(row.month_number)} ${row.coverage_year}`)
    .join(", ");

  throw new Error(
    `Duplicate membership coverage blocked. Already paid month(s): ${months}.`
  );
}

async function createCoverageRow(payload = {}) {
  const coverageDate = firstDayOfMonth(payload.coverage_date || new Date());

  const year = coverageDate.getFullYear();
  const monthNumber = coverageDate.getMonth() + 1;
  const name = monthName(monthNumber);
  const key = monthKey(year, monthNumber);
  const status = payload.status || payload.coverage_status || "paid";

  return insertExistingColumns(
    pool,
    "tbl_member_membership_coverage",
    {
      member_id: payload.member_id,
      payment_id: payload.payment_id || null,
      receipt_id: payload.receipt_id || null,
      invoice_id: payload.invoice_id || null,
      subscription_id:
        payload.subscription_id ||
        payload.dues_subscription_id ||
        null,

      coverage_year: year,
      coverage_month: key,
      coverage_month_name: name,
      month_number: monthNumber,
      month_name: name,
      coverage_key: key,

      status,
      coverage_status: status,

      amount: money(payload.amount || payload.amount_paid || 0),

      payment_number: payload.payment_number || null,
      receipt_number: payload.receipt_number || null,
      invoice_number: payload.invoice_number || null,

      method: payload.method || payload.payment_method || null,
      provider: payload.provider || payload.payment_provider || null,

      notes: payload.notes || null,

      created_by: payload.created_by || payload.actor_id || null,
      created_at: mysqlNow(),
      updated_at: mysqlNow(),
    }
  );
}

async function upsertPaidCoverageRow(payload = {}) {
  const coverageDate = firstDayOfMonth(payload.coverage_date || new Date());
  const year = coverageDate.getFullYear();
  const monthNumber = coverageDate.getMonth() + 1;
  const amount = money(payload.amount || payload.amount_paid || 0);

  let updated = false;

  try {
    const [result] = await pool.query(
      `
      UPDATE tbl_member_membership_coverage
      SET
        payment_id = ?,
        receipt_id = ?,
        invoice_id = ?,
        subscription_id = ?,
        status = 'paid',
        coverage_status = 'paid',
        amount = ?,
        payment_number = ?,
        receipt_number = ?,
        invoice_number = ?,
        method = ?,
        provider = ?,
        updated_at = NOW()
      WHERE member_id = ?
        AND coverage_year = ?
        AND month_number = ?
        AND LOWER(COALESCE(status, coverage_status, '')) IN ('open', 'unpaid', 'pending', 'overdue', 'due', 'not_applicable', '')
      `,
      [
        payload.payment_id || null,
        payload.receipt_id || null,
        payload.invoice_id || null,
        payload.subscription_id || payload.dues_subscription_id || null,
        amount,
        payload.payment_number || null,
        payload.receipt_number || null,
        payload.invoice_number || null,
        payload.method || payload.payment_method || null,
        payload.provider || payload.payment_provider || null,
        payload.member_id,
        year,
        monthNumber,
      ]
    );

    updated = Number(result.affectedRows || 0) > 0;
  } catch {
    updated = false;
  }

  if (updated) return null;

  return createCoverageRow(payload);
}

async function createMembershipCoverage(payload = {}) {
  const memberId = Number(payload.member_id || 0);

  if (!memberId) {
    throw new Error("member_id required.");
  }

  await markPreStartCoverageNotApplicable(memberId, payload);

  const rows = await resolveCoverageRows(memberId, payload);

  if (!payload.allow_duplicate_paid_coverage) {
    await assertNoDuplicatePaidCoverage(memberId, rows);
  }

  const amountPerMonth = money(
    Number(payload.amount || payload.amount_paid || 0) /
      Math.max(rows.length, 1)
  );

  const createdRows = [];

  for (const row of rows) {
    const coverageDate = firstDayOfMonth(
      new Date(row.coverage_year, row.month_number - 1, 1)
    );

    const created = await upsertPaidCoverageRow({
      ...payload,
      member_id: memberId,
      coverage_date: coverageDate,
      amount: amountPerMonth,
      status: "paid",
      coverage_status: "paid",
    });

    if (created) createdRows.push(created);
  }

  const first = rows[0];
  const last = rows[rows.length - 1];

  const startDate = firstDayOfMonth(
    new Date(first.coverage_year, first.month_number - 1, 1)
  );

  const endDate = lastDayOfMonth(
    new Date(last.coverage_year, last.month_number - 1, 1)
  );

  await updateExistingColumns(
    pool,
    "tbl_members",
    {
      membership_status: "active",
      status: "active",
      is_active: 1,
      membership_start_date: dateOnly(startDate),
      membership_end_date: dateOnly(endDate),
      current_coverage_start: monthKey(first.coverage_year, first.month_number),
      current_coverage_end: monthKey(last.coverage_year, last.month_number),
      updated_at: mysqlNow(),
    },
    "id = ?",
    [memberId]
  ).catch(() => {});

  return {
    success: true,
    total_created: createdRows.length,
    coverage: createdRows,
    coverage_rows: rows,
    coverage_months: rows.map((row) => row.coverage_month),
    coverage_months_json: JSON.stringify(rows),
    coverage_start_month: monthKey(first.coverage_year, first.month_number),
    coverage_end_month: monthKey(last.coverage_year, last.month_number),
    coverage_label: `${monthName(first.month_number)} ${first.coverage_year} - ${monthName(last.month_number)} ${last.coverage_year}`,
    membership_start_date: dateOnly(startDate),
    membership_end_date: dateOnly(endDate),
    payment_mode: isRecurring(payload) ? "recurring" : "one_time",
    months_paid: rows.length,
  };
}

async function getMemberCoverage(memberId) {
  await markPreStartCoverageNotApplicable(memberId);

  const rows = await findMany(
    pool,
    `
    SELECT *
    FROM tbl_member_membership_coverage
    WHERE member_id = ?
    ORDER BY
      coverage_year ASC,
      month_number ASC
    `,
    [memberId]
  );

  return rows.map(normalizeCoverageRow);
}

async function getMemberCoverageByYear(memberId, year) {
  await markPreStartCoverageNotApplicable(memberId);

  const rows = await findMany(
    pool,
    `
    SELECT *
    FROM tbl_member_membership_coverage
    WHERE member_id = ?
      AND coverage_year = ?
    ORDER BY
      month_number ASC
    `,
    [memberId, Number(year)]
  );

  return rows.map(normalizeCoverageRow);
}

async function getDelinquentMonths(memberId) {
  await markPreStartCoverageNotApplicable(memberId);

  const memberStart = await getMemberCoverageStart(memberId);
  const now = new Date();

  const current = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };

  const rows = await findMany(
    pool,
    `
    SELECT *
    FROM tbl_member_membership_coverage
    WHERE member_id = ?
      AND (
        coverage_year < ?
        OR (
          coverage_year = ?
          AND month_number < ?
        )
      )
      AND (
        coverage_year > ?
        OR (
          coverage_year = ?
          AND month_number >= ?
        )
      )
      AND LOWER(COALESCE(status, coverage_status, '')) NOT IN ('paid', 'completed', 'posted', 'not_applicable')
    ORDER BY
      coverage_year ASC,
      month_number ASC
    `,
    [
      memberId,
      current.year,
      current.year,
      current.month,
      memberStart.year,
      memberStart.year,
      memberStart.month,
    ]
  );

  return rows.map(normalizeCoverageRow);
}

async function getCoverageGrid(memberId, year) {
  const memberStart = await getMemberCoverageStart(memberId);
  const rows = await getMemberCoverageByYear(memberId, year);

  const rowByMonth = new Map();

  for (const row of rows) {
    const normalized = normalizeCoverageRow(row);
    rowByMonth.set(Number(normalized.month_number), normalized);
  }

  const grid = {};
  const now = new Date();

  for (let i = 1; i <= 12; i += 1) {
    const currentMonth = {
      year: Number(year),
      month: i,
    };

    const beforeMemberStart = compareMonth(currentMonth, memberStart) < 0;
    const pastMonth =
      Number(year) < now.getFullYear() ||
      (Number(year) === now.getFullYear() && i < now.getMonth() + 1);

    const futureMonth =
      Number(year) > now.getFullYear() ||
      (Number(year) === now.getFullYear() && i > now.getMonth() + 1);

    let status = "open";

    if (beforeMemberStart) status = "not_applicable";
    else if (pastMonth) status = "unpaid";
    else if (futureMonth) status = "upcoming";

    grid[i] = {
      month_number: i,
      month_name: MONTH_NAMES[i - 1],
      month_short: MONTH_SHORT[i - 1],
      paid: false,
      status,
      amount: 0,
      receipt_number: null,
      payment_number: null,
      invoice_number: null,
      method: null,
      provider: null,
      coverage_month: monthKey(year, i),
      coverage_key: monthKey(year, i),
      before_member_start: beforeMemberStart,
      counts_as_due: !beforeMemberStart && status !== "upcoming",
    };
  }

  for (const row of rows) {
    const monthNumber = Number(row.month_number);

    if (monthNumber < 1 || monthNumber > 12) continue;

    const paid = PAID_STATUSES.has(
      clean(row.status || row.coverage_status || "", 40).toLowerCase()
    );

    const status = row.status || row.coverage_status || "unpaid";

    grid[monthNumber] = {
      month_number: monthNumber,
      month_name: MONTH_NAMES[monthNumber - 1],
      month_short: MONTH_SHORT[monthNumber - 1],

      paid,
      status: paid ? "paid" : status,

      amount: Number(row.amount || 0),

      receipt_number: row.receipt_number || null,
      payment_number: row.payment_number || null,
      invoice_number: row.invoice_number || null,

      method: row.method || null,
      provider: row.provider || null,

      coverage_month: row.coverage_month || monthKey(year, monthNumber),
      coverage_key: row.coverage_key || row.coverage_month || monthKey(year, monthNumber),

      before_member_start: compareMonth({ year: Number(year), month: monthNumber }, memberStart) < 0,
      counts_as_due:
        compareMonth({ year: Number(year), month: monthNumber }, memberStart) >= 0 &&
        !paid &&
        !["not_applicable", "upcoming"].includes(String(status).toLowerCase()),
    };
  }

  return grid;
}

module.exports = {
  createCoverageRow,
  createMembershipCoverage,

  getMemberCoverage,
  getMemberCoverageByYear,
  getDelinquentMonths,
  getCoverageGrid,
  getNextCoverageStart,

  normalizeCoverageRow,
  normalizeMonths,
  resolveCoverageRows,
  markPreStartCoverageNotApplicable,
  assertNoDuplicatePaidCoverage,
};