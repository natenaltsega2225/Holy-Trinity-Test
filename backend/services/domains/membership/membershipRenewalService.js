
// backend/services/domains/membership/membershipRenewalService.js
"use strict";

const pool = require("../../../db");

const {
  updateExistingColumns,
  findMany,
  findOne,
} = require("../../../utils/dbHelpers");

const {
  mysqlNow,
  mysqlDate,
  addDays,
  isExpired,
} = require("../../../utils/dateHelpers");

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

const PAID_STATUSES = new Set(["paid", "completed", "posted"]);

function clean(value, max = 255) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function dateOnly(value) {
  if (!value) return null;

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthName(month) {
  return MONTH_NAMES[Number(month) - 1] || String(month || "");
}

function parseDate(value) {
  if (!value) return null;

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseMonth(value, fallbackYear) {
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

  return null;
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

function addMonthsToMonth(start, offset) {
  const d = new Date(Number(start.year), Number(start.month) - 1 + Number(offset || 0), 1);

  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
  };
}

function monthToDate(month) {
  return new Date(Number(month.year), Number(month.month) - 1, 1);
}

function endOfMonthDate(month) {
  return new Date(Number(month.year), Number(month.month), 0);
}

function monthLabel(month) {
  return `${monthName(month.month)} ${month.year}`;
}

function isTruthy(value) {
  return ["true", "1", "yes", "on"].includes(
    String(value || "").toLowerCase()
  );
}

function normalizeTargetMonths(value) {
  const raw = clean(value, 80).toLowerCase();

  if (raw === "month_to_month" || raw === "monthly" || raw === "recurring") return 1;
  if (raw.includes("12") || raw.includes("annual") || raw.includes("year")) return 12;
  if (raw.includes("6")) return 6;
  if (raw.includes("3") || raw.includes("quarter")) return 3;

  const n = Number(value);
  if ([1, 3, 6, 12].includes(n)) return n;

  return 1;
}

function planDurationLabel(months, recurring = false) {
  if (recurring) return "Month-to-Month";

  const n = Number(months || 1);

  if (n === 1) return "1 Month One-Time";
  if (n === 3) return "3 Months One-Time";
  if (n === 6) return "6 Months One-Time";
  if (n === 12) return "12 Months One-Time";

  return `${n} Months One-Time`;
}

async function loadMember(memberId) {
  if (!memberId) return null;

  return findOne(
    pool,
    `
    SELECT *
    FROM tbl_members
    WHERE id = ?
    LIMIT 1
    `,
    [memberId]
  );
}

function memberStartMonth(member = {}) {
  const start =
    parseDate(member.membership_start_date) ||
    parseDate(member.member_start_date) ||
    parseDate(member.join_date) ||
    parseDate(member.joined_at) ||
    parseDate(member.start_date) ||
    parseDate(member.created_at) ||
    new Date();

  return {
    year: start.getFullYear(),
    month: start.getMonth() + 1,
  };
}

async function getPaidCoverageRows(memberId) {
  if (!memberId) return [];

  const rows = await findMany(
    pool,
    `
    SELECT
      id,
      member_id,
      coverage_year,
      month_number,
      month_name,
      coverage_month,
      status,
      amount,
      payment_id,
      payment_number,
      receipt_number,
      invoice_number
    FROM tbl_member_membership_coverage
    WHERE member_id = ?
      AND LOWER(COALESCE(status, coverage_status, '')) IN ('paid', 'completed', 'posted')
    ORDER BY coverage_year ASC, month_number ASC
    `,
    [memberId]
  ).catch(() => []);

  return rows
    .map((row) => ({
      ...row,
      coverage_year: Number(row.coverage_year),
      month_number: Number(row.month_number),
      key: monthKey(row.coverage_year, row.month_number),
    }))
    .filter((row) => row.coverage_year && row.month_number);
}

function findCurrentPaidRunStart(paidRows = [], fallbackStart) {
  if (!paidRows.length) return fallbackStart;

  const sorted = [...paidRows].sort((a, b) => {
    if (Number(a.coverage_year) !== Number(b.coverage_year)) {
      return Number(a.coverage_year) - Number(b.coverage_year);
    }

    return Number(a.month_number) - Number(b.month_number);
  });

  let currentRun = [
    {
      year: sorted[0].coverage_year,
      month: sorted[0].month_number,
    },
  ];

  let latestRun = currentRun;

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];

    const expected = addMonthsToMonth(
      {
        year: previous.coverage_year,
        month: previous.month_number,
      },
      1
    );

    const isContinuous =
      Number(current.coverage_year) === Number(expected.year) &&
      Number(current.month_number) === Number(expected.month);

    if (isContinuous) {
      currentRun.push({
        year: current.coverage_year,
        month: current.month_number,
      });
    } else {
      currentRun = [
        {
          year: current.coverage_year,
          month: current.month_number,
        },
      ];
    }

    latestRun = currentRun;
  }

  return latestRun[0] || fallbackStart;
}

function buildTargetMonths(anchorStart, targetMonths) {
  const rows = [];

  for (let i = 0; i < Number(targetMonths || 1); i += 1) {
    const month = addMonthsToMonth(anchorStart, i);

    rows.push({
      year: month.year,
      month: month.month,
      month_number: month.month,
      month_name: monthName(month.month),
      coverage_month: monthKey(month.year, month.month),
      label: monthLabel(month),
    });
  }

  return rows;
}

async function buildPlanChangePreview(memberId, targetPlan = {}, options = {}) {
  const member = await loadMember(memberId);

  if (!member) {
    throw new Error("Member not found.");
  }

  const recurring =
    isTruthy(targetPlan.is_recurring) ||
    isTruthy(targetPlan.auto_renew) ||
    isTruthy(targetPlan.auto_payment_enabled) ||
    clean(targetPlan.plan_type).toLowerCase() === "month_to_month";

  const targetMonths = recurring
    ? 1
    : normalizeTargetMonths(
        targetPlan.months ||
          targetPlan.duration_months ||
          targetPlan.interval_count ||
          targetPlan.plan_duration ||
          targetPlan.plan_name ||
          1
      );

  const memberStart = memberStartMonth(member);
  const paidRows = await getPaidCoverageRows(memberId);
  const paidKeys = new Set(paidRows.map((row) => row.key));

  const explicitStart = parseMonth(
    options.coverage_start_month ||
      targetPlan.coverage_start_month ||
      targetPlan.start_month,
    options.coverage_year || targetPlan.coverage_year
  );

  let anchorStart =
    explicitStart ||
    findCurrentPaidRunStart(paidRows, memberStart);

  anchorStart = maxMonth(anchorStart, memberStart);

  if (recurring && paidRows.length) {
    const latestPaid = paidRows[paidRows.length - 1];

    anchorStart = addMonthsToMonth(
      {
        year: latestPaid.coverage_year,
        month: latestPaid.month_number,
      },
      1
    );

    anchorStart = maxMonth(anchorStart, memberStart);
  }

  const targetCoverage = buildTargetMonths(anchorStart, targetMonths);

  const months = targetCoverage.map((row) => {
    const key = row.coverage_month;
    const paid = paidKeys.has(key);

    return {
      ...row,
      key,
      paid,
      status: paid ? "paid" : "open",
      counts_as_due: !paid,
    };
  });

  const paidMonths = months.filter((row) => row.paid);
  const openMonths = months.filter((row) => !row.paid);

  const targetAmount = Number(
    targetPlan.amount ||
      targetPlan.total_amount ||
      targetPlan.current_amount ||
      0
  );

  const perMonthAmount =
    targetAmount > 0
      ? Number((targetAmount / Math.max(targetMonths, 1)).toFixed(2))
      : 0;

  const amountDue =
    perMonthAmount > 0
      ? Number((perMonthAmount * openMonths.length).toFixed(2))
      : 0;

  const first = months[0];
  const last = months[months.length - 1];

  return {
    member_id: memberId,
    member_no: member.member_no,
    full_name: member.full_name,
    email: member.email,
    phone: member.phone,

    plan_name:
      targetPlan.plan_name ||
      planDurationLabel(targetMonths, recurring),

    payment_mode: recurring ? "recurring" : "one_time",
    subscription_type: recurring ? "month_to_month" : "prepaid",

    target_months: targetMonths,
    paid_months: paidMonths.length,
    open_months: openMonths.length,

    amount_due: amountDue,
    per_month_amount: perMonthAmount,

    coverage_start_month: first.coverage_month,
    coverage_end_month: last.coverage_month,
    coverage_label: `${monthLabel(first)} - ${monthLabel(last)}`,

    months,
    paid_coverage_months: paidMonths,
    open_coverage_months: openMonths,

    message:
      openMonths.length === 0
        ? "This member has already paid all months in the selected plan window."
        : `${openMonths.length} month(s) are open for this plan change.`,
  };
}

async function findExpiringMemberships(daysAhead = 30) {
  const endDate = mysqlDate(addDays(new Date(), daysAhead));

  const [rows] = await pool.query(
    `
    SELECT
      m.id AS member_id,
      m.member_no,
      m.full_name,
      m.email,
      m.phone,
      m.membership_status,
      m.membership_start_date,
      m.membership_end_date,

      s.id AS subscription_id,
      s.dues_plan_id,
      s.plan_name,
      s.current_amount AS amount,
      s.start_date,
      s.end_date,
      s.coverage_start_month,
      s.coverage_end_month,
      s.coverage_label,
      s.months_paid,
      s.months_remaining,
      s.next_renewal_date,
      s.auto_renew,
      s.auto_payment_enabled,
      s.status AS subscription_status

    FROM tbl_members m

    LEFT JOIN tbl_finance_dues_subscriptions s
      ON s.member_id = m.id
      AND s.status = 'active'

    WHERE m.membership_end_date IS NOT NULL
      AND DATE(m.membership_end_date) <= ?
      AND m.membership_status = 'active'

    ORDER BY m.membership_end_date ASC
    `,
    [endDate]
  );

  return rows;
}

async function findExpiredMemberships() {
  const [rows] = await pool.query(
    `
    SELECT
      m.id AS member_id,
      m.member_no,
      m.full_name,
      m.email,
      m.phone,
      m.membership_start_date,
      m.membership_end_date,
      m.membership_status
    FROM tbl_members m
    WHERE m.membership_end_date IS NOT NULL
      AND DATE(m.membership_end_date) < CURDATE()
      AND m.membership_status = 'active'
      AND NOT EXISTS (
        SELECT 1
        FROM tbl_member_membership_coverage c
        WHERE c.member_id = m.id
          AND LOWER(COALESCE(c.status, c.coverage_status, '')) IN ('paid', 'completed', 'posted')
          AND (
            c.coverage_year > YEAR(CURDATE())
            OR (
              c.coverage_year = YEAR(CURDATE())
              AND c.month_number >= MONTH(CURDATE())
            )
          )
      )
    ORDER BY m.membership_end_date ASC
    `
  );

  return rows;
}

async function markMemberExpired(conn, memberId) {
  const paidFuture = await findMany(
    conn,
    `
    SELECT id
    FROM tbl_member_membership_coverage
    WHERE member_id = ?
      AND LOWER(COALESCE(status, coverage_status, '')) IN ('paid', 'completed', 'posted')
      AND (
        coverage_year > YEAR(CURDATE())
        OR (
          coverage_year = YEAR(CURDATE())
          AND month_number >= MONTH(CURDATE())
        )
      )
    LIMIT 1
    `,
    [memberId]
  ).catch(() => []);

  if (paidFuture.length) {
    return updateExistingColumns(
      conn,
      "tbl_members",
      {
        membership_status: "active",
        status: "active",
        is_active: 1,
        updated_at: mysqlNow(),
      },
      "id = ?",
      [memberId]
    );
  }

  return updateExistingColumns(
    conn,
    "tbl_members",
    {
      membership_status: "inactive",
      status: "inactive",
      is_active: 0,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [memberId]
  );
}

async function processExpiredMemberships() {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const expired = await findMany(
      conn,
      `
      SELECT m.id
      FROM tbl_members m
      WHERE m.membership_end_date IS NOT NULL
        AND DATE(m.membership_end_date) < CURDATE()
        AND m.membership_status = 'active'
        AND NOT EXISTS (
          SELECT 1
          FROM tbl_member_membership_coverage c
          WHERE c.member_id = m.id
            AND LOWER(COALESCE(c.status, c.coverage_status, '')) IN ('paid', 'completed', 'posted')
            AND (
              c.coverage_year > YEAR(CURDATE())
              OR (
                c.coverage_year = YEAR(CURDATE())
                AND c.month_number >= MONTH(CURDATE())
              )
            )
        )
      `,
      []
    );

    for (const member of expired) {
      await markMemberExpired(conn, member.id);
    }

    await conn.commit();

    return {
      success: true,
      processed: expired.length,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function buildRenewalNotice(member = {}) {
  return {
    member_id: member.member_id,
    member_no: member.member_no,
    full_name: member.full_name,
    email: member.email,
    phone: member.phone,

    membership_start_date:
      member.membership_start_date ||
      member.start_date ||
      null,

    membership_end_date:
      member.membership_end_date ||
      member.end_date ||
      null,

    plan_name:
      member.plan_name ||
      "Membership Plan",

    amount:
      Number(member.amount || 0),

    coverage_label:
      member.coverage_label || null,

    coverage_start_month:
      member.coverage_start_month || null,

    coverage_end_month:
      member.coverage_end_month || null,

    next_renewal_date:
      member.next_renewal_date ||
      member.membership_end_date ||
      member.end_date ||
      null,

    auto_renew:
      Number(member.auto_renew || 0) === 1,

    auto_payment_enabled:
      Number(member.auto_payment_enabled || 0) === 1,

    expired:
      isExpired(
        member.membership_end_date ||
        member.end_date
      ),
  };
}

module.exports = {
  findExpiringMemberships,
  findExpiredMemberships,
  markMemberExpired,
  processExpiredMemberships,
  buildRenewalNotice,

  buildPlanChangePreview,
  getPaidCoverageRows,
  normalizeTargetMonths,
  planDurationLabel,
};