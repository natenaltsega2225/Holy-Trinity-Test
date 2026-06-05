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

function safeDate(value) {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function dateOnly(value) {
  const d = safeDate(value);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function firstDayOfMonth(value) {
  const d = safeDate(value);

  return new Date(
    d.getFullYear(),
    d.getMonth(),
    1
  );
}

function lastDayOfMonth(value) {
  const d = safeDate(value);

  return new Date(
    d.getFullYear(),
    d.getMonth() + 1,
    0
  );
}

function addMonths(value, months) {
  const d = safeDate(value);

  return new Date(
    d.getFullYear(),
    d.getMonth() + Number(months || 0),
    1
  );
}

function monthKey(year, monthNumber) {
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

function normalizeMonthNumber(row = {}) {
  const direct = Number(
    row.month_number ||
      row.coverage_month_number ||
      row.month ||
      0
  );

  if (direct >= 1 && direct <= 12) {
    return direct;
  }

  const raw = String(
    row.coverage_month ||
      row.month_name ||
      ""
  ).trim();

  if (/^\d{4}-\d{2}$/.test(raw)) {
    return Number(raw.slice(5, 7));
  }

  const lower = raw.toLowerCase();

  const index = MONTH_NAMES.findIndex(
    (name) => name.toLowerCase() === lower
  );

  if (index >= 0) return index + 1;

  const shortIndex = MONTH_SHORT.findIndex(
    (name) => name.toLowerCase() === lower.slice(0, 3)
  );

  if (shortIndex >= 0) return shortIndex + 1;

  return null;
}

function normalizeCoverageRow(row = {}) {
  const monthNumber = normalizeMonthNumber(row);
  const year = Number(row.coverage_year || row.year || 0);

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

    coverage_month_name:
      row.coverage_month_name ||
      name,

    month_number:
      monthNumber,

    month_name:
      row.month_name ||
      name,

    month_short:
      short,

    coverage_status:
      row.coverage_status ||
      row.status ||
      "unpaid",

    status:
      row.status ||
      row.coverage_status ||
      "unpaid",
  };
}

async function getNextCoverageStart(memberId) {
  const row = await findOne(
    pool,
    `
    SELECT
      coverage_year,
      month_number
    FROM tbl_member_membership_coverage
    WHERE member_id = ?
      AND status IN ('paid', 'completed', 'posted')
    ORDER BY
      coverage_year DESC,
      month_number DESC
    LIMIT 1
    `,
    [memberId]
  );

  if (!row) {
    return firstDayOfMonth(new Date());
  }

  return firstDayOfMonth(
    addMonths(
      new Date(
        Number(row.coverage_year),
        Number(row.month_number) - 1,
        1
      ),
      1
    )
  );
}

async function createCoverageRow(payload = {}) {
  const coverageDate = firstDayOfMonth(
    payload.coverage_date || new Date()
  );

  const year = coverageDate.getFullYear();
  const monthNumber = coverageDate.getMonth() + 1;
  const name = MONTH_NAMES[monthNumber - 1];
  const key = monthKey(year, monthNumber);

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

      status:
        payload.status ||
        payload.coverage_status ||
        "paid",

      amount: money(
        payload.amount ||
          payload.amount_paid ||
          0
      ),

      payment_number: payload.payment_number || null,
      receipt_number: payload.receipt_number || null,
      invoice_number: payload.invoice_number || null,

      method:
        payload.method ||
        payload.payment_method ||
        null,

      provider:
        payload.provider ||
        payload.payment_provider ||
        null,

      notes: payload.notes || null,

      created_by:
        payload.created_by ||
        payload.actor_id ||
        null,

      created_at: mysqlNow(),
      updated_at: mysqlNow(),
    }
  );
}

async function createMembershipCoverage(payload = {}) {
  const memberId = Number(payload.member_id || 0);
  const months = Math.max(
    1,
    Number(
      payload.months ||
        payload.months_paid ||
        payload.duration_months ||
        payload.interval_count ||
        1
    )
  );

  if (!memberId) {
    throw new Error("member_id required.");
  }

  const startDate = payload.start_date
    ? firstDayOfMonth(payload.start_date)
    : await getNextCoverageStart(memberId);

  const createdRows = [];

  for (let i = 0; i < months; i += 1) {
    const coverageDate = addMonths(startDate, i);

    const year = coverageDate.getFullYear();
    const monthNumber = coverageDate.getMonth() + 1;

    const exists = await findOne(
      pool,
      `
      SELECT id
      FROM tbl_member_membership_coverage
      WHERE member_id = ?
        AND coverage_year = ?
        AND month_number = ?
      LIMIT 1
      `,
      [
        memberId,
        year,
        monthNumber,
      ]
    );

    if (exists) continue;

    const row = await createCoverageRow({
      ...payload,
      member_id: memberId,
      coverage_date: coverageDate,
      amount:
        Number(payload.amount || 0) /
        Math.max(months, 1),
    });

    createdRows.push(row);
  }

  const expiration = lastDayOfMonth(
    addMonths(startDate, months - 1)
  );

  await updateExistingColumns(
    pool,
    "tbl_members",
    {
      membership_status: "active",
      status: "active",
      is_active: 1,
      membership_start_date: dateOnly(startDate),
      membership_end_date: dateOnly(expiration),
      updated_at: mysqlNow(),
    },
    "id = ?",
    [memberId]
  );

  return {
    success: true,
    total_created: createdRows.length,
    coverage: createdRows,
    membership_start_date: dateOnly(startDate),
    membership_end_date: dateOnly(expiration),
  };
}

async function getMemberCoverage(memberId) {
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
    [
      memberId,
      Number(year),
    ]
  );

  return rows.map(normalizeCoverageRow);
}

async function getDelinquentMonths(memberId) {
  const now = new Date();
  const year = now.getFullYear();
  const monthNumber = now.getMonth() + 1;

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
      AND status NOT IN ('paid', 'completed', 'posted')
    ORDER BY
      coverage_year ASC,
      month_number ASC
    `,
    [
      memberId,
      year,
      year,
      monthNumber,
    ]
  );

  return rows.map(normalizeCoverageRow);
}

async function getCoverageGrid(memberId, year) {
  const rows = await getMemberCoverageByYear(
    memberId,
    year
  );

  const grid = {};

  for (let i = 1; i <= 12; i += 1) {
    grid[i] = {
      month_number: i,
      month_name: MONTH_NAMES[i - 1],
      month_short: MONTH_SHORT[i - 1],
      paid: false,
      status: "unpaid",
      amount: 0,
      receipt_number: null,
      payment_number: null,
      method: null,
    };
  }

  for (const row of rows) {
    const monthNumber = Number(row.month_number);

    if (monthNumber < 1 || monthNumber > 12) {
      continue;
    }

    const paid = ["paid", "completed", "posted"].includes(
      String(row.status || row.coverage_status || "").toLowerCase()
    );

    grid[monthNumber] = {
      month_number: monthNumber,
      month_name: MONTH_NAMES[monthNumber - 1],
      month_short: MONTH_SHORT[monthNumber - 1],

      paid,
      status: paid ? "paid" : row.status || "unpaid",

      amount: Number(row.amount || 0),

      receipt_number: row.receipt_number || null,
      payment_number: row.payment_number || null,
      invoice_number: row.invoice_number || null,

      method: row.method || null,
      provider: row.provider || null,

      coverage_month: row.coverage_month,
      coverage_key: row.coverage_key,
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
};