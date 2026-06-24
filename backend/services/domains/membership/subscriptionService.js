

// backend/services/domains/membership/subscriptionService.js
"use strict";

const {
  insertExistingColumns,
  updateExistingColumns,
  findOne,
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

function dateOnly(value) {
  if (!value) return null;

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function firstDay(year, month) {
  return new Date(Number(year), Number(month) - 1, 1);
}

function lastDay(year, month) {
  return new Date(Number(year), Number(month), 0);
}

function addMonths(value, months) {
  const base = value ? new Date(value) : new Date();

  return new Date(
    base.getFullYear(),
    base.getMonth() + Number(months || 0),
    1
  );
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthName(month) {
  return MONTH_NAMES[Number(month) - 1] || String(month || "");
}

function shortMonth(month) {
  return monthName(month).slice(0, 3);
}

function isTruthy(value) {
  return ["true", "1", "yes", "on"].includes(
    String(value || "").toLowerCase()
  );
}

function parseDate(value) {
  if (!value) return null;

  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseCoverageStart(value, fallbackYear) {
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

function normalizePlanMode(payload = {}) {
  const hasStripeSubscription = !!payload.stripe_subscription_id;

  const recurring =
    isTruthy(payload.is_recurring) ||
    isTruthy(payload.auto_renew) ||
    isTruthy(payload.auto_payment_enabled) ||
    isTruthy(payload.subscription_enabled) ||
    hasStripeSubscription;

  if (recurring) {
    return {
      payment_mode: "recurring",
      subscription_type: "month_to_month",
      is_recurring: true,
    };
  }

  return {
    payment_mode: "one_time",
    subscription_type: "prepaid",
    is_recurring: false,
  };
}

function normalizeMonths(payload = {}) {
  const mode = normalizePlanMode(payload);

  if (mode.is_recurring) return 1;

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
      // Ignore invalid JSON.
    }
  }

  const start = parseCoverageStart(
    payload.coverage_start_month,
    payload.coverage_year
  );

  const end = parseCoverageStart(
    payload.coverage_end_month,
    payload.coverage_year
  );

  if (start && end && compareMonth(end, start) >= 0) {
    return (Number(end.year) - Number(start.year)) * 12 + Number(end.month) - Number(start.month) + 1;
  }

  const text = String(
    payload.plan_name ||
      payload.plan_duration ||
      payload.selected_option ||
      payload.sub_category ||
      ""
  ).toLowerCase();

  if (text.includes("12") || text.includes("annual") || text.includes("year")) return 12;
  if (text.includes("6")) return 6;
  if (text.includes("3") || text.includes("quarter")) return 3;

  return 1;
}

function planDurationLabel(months, mode = {}) {
  if (mode.is_recurring) return "Month-to-Month";

  const n = Math.max(1, Number(months || 1));

  if (n === 1) return "1 Month One-Time";
  if (n === 3) return "3 Months One-Time";
  if (n === 6) return "6 Months One-Time";
  if (n === 12) return "12 Months One-Time";

  return `${n} Months One-Time`;
}

function prettyCoverageLabel(startDate, endDate) {
  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);

  const fmt = (d) =>
    d.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

  return `${fmt(start)} - ${fmt(end)}`;
}

function buildCoverageRows(start, months) {
  const rows = [];
  const count = Math.max(1, Number(months || 1));

  for (let i = 0; i < count; i += 1) {
    const d = new Date(Number(start.year), Number(start.month) - 1 + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    rows.push({
      year,
      month,
      month_number: month,
      month_name: monthName(month),
      coverage_month: monthKey(year, month),
      label: `${shortMonth(month)} ${year}`,
    });
  }

  return rows;
}

function parseExplicitCoverageRows(payload = {}) {
  if (!payload.coverage_months_json) return [];

  try {
    const parsed = JSON.parse(payload.coverage_months_json);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((row) => {
        const year = Number(
          row.year ||
            row.y ||
            row.coverage_year ||
            payload.coverage_year ||
            0
        );

        const month = Number(
          row.month_number ||
            row.monthNumber ||
            row.month ||
            row.m ||
            0
        );

        if (!year || !month || month < 1 || month > 12) return null;

        return {
          year,
          month,
          month_number: month,
          month_name: row.month_name || row.monthName || monthName(month),
          coverage_month: monthKey(year, month),
          label: row.label || `${shortMonth(month)} ${year}`,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function findCurrentSubscription(conn, memberId) {
  if (!memberId) return null;

  return findOne(
    conn,
    `
    SELECT *
    FROM tbl_finance_dues_subscriptions
    WHERE member_id = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [memberId]
  );
}

async function loadMember(conn, memberId) {
  if (!memberId) return null;

  const [[member]] = await conn.query(
    `
    SELECT *
    FROM tbl_members
    WHERE id = ?
    LIMIT 1
    `,
    [memberId]
  );

  return member || null;
}

function memberStartMonth(member = {}, payload = {}) {
  const startDate =
    parseDate(payload.membership_start_date) ||
    parseDate(payload.member_start_date) ||
    parseDate(payload.join_date) ||
    parseDate(payload.start_date) ||
    parseDate(member.membership_start_date) ||
    parseDate(member.member_start_date) ||
    parseDate(member.join_date) ||
    parseDate(member.joined_at) ||
    parseDate(member.start_date) ||
    parseDate(member.created_at) ||
    null;

  if (!startDate) return null;

  return {
    year: startDate.getFullYear(),
    month: startDate.getMonth() + 1,
  };
}

async function activateMember(conn, memberId) {
  if (!memberId) return;

  await updateExistingColumns(
    conn,
    "tbl_members",
    {
      status: "active",
      membership_status: "active",
      is_active: 1,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [memberId]
  );

  await conn
    .query(
      `
      UPDATE tbl_users
      SET is_active = 1, updated_at = NOW()
      WHERE member_id = ?
      `,
      [memberId]
    )
    .catch(() => {});
}

async function findNextUnpaidMonth(conn, memberId, payload = {}) {
  const now = new Date();
  const member = await loadMember(conn, memberId);
  const start = memberStartMonth(member, payload) || {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };

  if (!memberId) return start;

  const [rows] = await conn
    .query(
      `
      SELECT coverage_year, month_number
      FROM tbl_member_membership_coverage
      WHERE member_id = ?
        AND LOWER(COALESCE(status, '')) IN ('paid', 'completed', 'posted')
      ORDER BY coverage_year DESC, month_number DESC
      LIMIT 1
      `,
      [memberId]
    )
    .catch(() => [[]]);

  if (!rows.length) return start;

  let year = Number(rows[0].coverage_year);
  let month = Number(rows[0].month_number) + 1;

  if (month > 12) {
    month = 1;
    year += 1;
  }

  return maxMonth({ year, month }, start);
}

async function resolveCoverageDates(conn, payload = {}) {
  const mode = normalizePlanMode(payload);
  const months = normalizeMonths(payload);
  const member = await loadMember(conn, payload.member_id);
  const memberStart = memberStartMonth(member, payload);

  let explicitStart = parseCoverageStart(
    payload.coverage_start_month ||
      payload.membership_start_month ||
      payload.start_month,
    payload.coverage_year
  );

  if (memberStart && explicitStart && compareMonth(explicitStart, memberStart) < 0) {
    explicitStart = memberStart;
  }

  let start =
    explicitStart ||
    (await findNextUnpaidMonth(conn, payload.member_id, payload));

  if (memberStart) {
    start = maxMonth(start, memberStart);
  }

  const explicitRows = parseExplicitCoverageRows(payload);
  let rows = [];

  if (explicitRows.length && !mode.is_recurring) {
    rows = explicitRows.filter((row) => {
      if (!memberStart) return true;

      return compareMonth(
        { year: row.year, month: row.month_number },
        memberStart
      ) >= 0;
    });

    if (!rows.length || rows.length !== explicitRows.length) {
      rows = buildCoverageRows(start, months);
    }
  } else {
    rows = buildCoverageRows(start, months);
  }

  if (mode.is_recurring) {
    rows = rows.slice(0, 1);
  }

  const first = rows[0];
  const last = rows[rows.length - 1];

  const startDate = firstDay(first.year, first.month_number);
  const endDate = lastDay(last.year, last.month_number);

  return {
    start_date: dateOnly(startDate),
    end_date: dateOnly(endDate),

    coverage_start_month: first.coverage_month,
    coverage_end_month: last.coverage_month,

    coverage_months: rows.map((row) => row.coverage_month),
    coverage_rows: rows,
    coverage_months_json: JSON.stringify(rows),

    coverage_label: prettyCoverageLabel(startDate, endDate),

    months_paid: rows.length,
    months_remaining: 0,

    coverage_year: first.year,
    start_month_number: first.month_number,
    end_month_number: last.month_number,

    payment_mode: mode.payment_mode,
    subscription_type: mode.subscription_type,
    is_recurring: mode.is_recurring,
  };
}

async function markPreStartCoverageNotApplicable(conn, payload = {}, coverage = {}) {
  if (!payload.member_id) return;

  const member = await loadMember(conn, payload.member_id);
  const start = memberStartMonth(member, payload);

  if (!start) return;

  await updateExistingColumns(
    conn,
    "tbl_member_membership_coverage",
    {
      status: "not_applicable",
      notes: "Before member start date; excluded from overdue/open membership balance.",
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
      AND LOWER(COALESCE(status, '')) IN ('open', 'unpaid', 'pending', 'overdue', 'due')
    `,
    [
      payload.member_id,
      start.year,
      start.year,
      start.month,
    ]
  ).catch(() => {});
}

async function findPaidCoverageDuplicates(conn, payload = {}, coverage = {}) {
  if (!payload.member_id) return [];

  const rows = coverage.coverage_rows || [];
  if (!rows.length) return [];

  const conditions = [];
  const params = [payload.member_id];

  rows.forEach((row) => {
    conditions.push("(coverage_year = ? AND month_number = ?)");
    params.push(row.year, row.month_number);
  });

  const [duplicates] = await conn
    .query(
      `
      SELECT
        id,
        coverage_year,
        month_number,
        month_name,
        status,
        payment_number,
        receipt_number
      FROM tbl_member_membership_coverage
      WHERE member_id = ?
        AND (${conditions.join(" OR ")})
        AND LOWER(COALESCE(status, '')) IN ('paid', 'completed', 'posted')
      `,
      params
    )
    .catch(() => [[]]);

  return duplicates || [];
}

async function assertNoDuplicatePaidCoverage(conn, payload = {}, coverage = {}) {
  if (payload.coverage_already_recorded) return;

  const duplicates = await findPaidCoverageDuplicates(conn, payload, coverage);

  if (!duplicates.length) return;

  const months = duplicates
    .map((row) => `${monthName(row.month_number)} ${row.coverage_year}`)
    .join(", ");

  throw new Error(
    `Duplicate membership coverage blocked. Already paid month(s): ${months}.`
  );
}

async function upsertMembershipSubscription(conn, payload = {}) {
  if (!payload.member_id) return null;

  const existing = await findCurrentSubscription(conn, payload.member_id);
  const mode = normalizePlanMode(payload);
  const dates =
    payload.resolvedCoverage || (await resolveCoverageDates(conn, payload));

  const months = dates.months_paid;
  const end = new Date(dates.end_date);

  const nextRenewalDate = dateOnly(
    new Date(end.getFullYear(), end.getMonth() + 1, 1)
  );

  const totalAmount = money(payload.amount || payload.current_amount || 0);
  const perMonthAmount = money(
    Number(totalAmount || 0) / Math.max(Number(months || 1), 1)
  );

  const commonFields = {
    dues_plan_id:
      payload.dues_plan_id || payload.plan_id || existing?.dues_plan_id || null,

    plan_name: payload.plan_name || existing?.plan_name || null,

    plan_duration:
      payload.plan_duration ||
      planDurationLabel(months, mode),

    payment_mode: dates.payment_mode,
    subscription_type: dates.subscription_type,
    billing_model: dates.is_recurring ? "recurring" : "prepaid",

    current_amount: totalAmount,
    monthly_amount: perMonthAmount,

    months_paid: Number(dates.months_paid || months),
    months_remaining: Number(dates.months_remaining || 0),

    interval_unit: "month",
    interval_count: dates.is_recurring ? 1 : Number(dates.months_paid || months),

    start_date: dates.start_date,
    end_date: dates.end_date,

    coverage_start: dates.start_date,
    coverage_end: dates.end_date,

    coverage_start_month: dates.coverage_start_month,
    coverage_end_month: dates.coverage_end_month,
    coverage_label: dates.coverage_label,

    next_renewal_date: nextRenewalDate,

    is_recurring: dates.is_recurring ? 1 : 0,

    auto_renew:
      payload.auto_renew !== undefined
        ? isTruthy(payload.auto_renew)
          ? 1
          : 0
        : dates.is_recurring
          ? 1
          : Number(existing?.auto_renew || 0),

    auto_payment_enabled:
      payload.auto_payment_enabled !== undefined
        ? isTruthy(payload.auto_payment_enabled)
          ? 1
          : 0
        : dates.is_recurring
          ? 1
          : Number(existing?.auto_payment_enabled || 0),

    stripe_customer_id:
      payload.stripe_customer_id || existing?.stripe_customer_id || null,

    stripe_subscription_id:
      dates.is_recurring
        ? payload.stripe_subscription_id || existing?.stripe_subscription_id || null
        : null,

    status: "active",
    updated_at: mysqlNow(),
  };

  if (existing?.id) {
    await updateExistingColumns(
      conn,
      "tbl_finance_dues_subscriptions",
      commonFields,
      "id = ?",
      [existing.id]
    );

    return {
      id: existing.id,
      member_id: payload.member_id,
      ...commonFields,
    };
  }

  const id = await insertExistingColumns(
    conn,
    "tbl_finance_dues_subscriptions",
    {
      member_id: payload.member_id,
      ...commonFields,
      created_at: mysqlNow(),
    }
  );

  return {
    id,
    member_id: payload.member_id,
    ...commonFields,
  };
}

async function insertMembershipCoverage(conn, payload = {}) {
  if (!payload.member_id || !payload.payment_id) return null;

  const coverage =
    payload.resolvedCoverage || (await resolveCoverageDates(conn, payload));

  if (payload.coverage_already_recorded) {
    return {
      success: true,
      already_recorded: true,
      member_id: payload.member_id,
      payment_id: payload.payment_id,
      coverage_start_month: coverage.coverage_start_month,
      coverage_end_month: coverage.coverage_end_month,
      coverage_label: coverage.coverage_label,
      months_paid: coverage.months_paid,
      inserted_months: 0,
      coverage_months: coverage.coverage_months,
      coverage_months_json: coverage.coverage_months_json,
    };
  }

  await markPreStartCoverageNotApplicable(conn, payload, coverage);
  await assertNoDuplicatePaidCoverage(conn, payload, coverage);

  const coverageRows = Array.isArray(coverage.coverage_rows)
    ? coverage.coverage_rows
    : [];

  if (!coverageRows.length) return null;

  const perMonth = money(
    Number(payload.amount || payload.total_amount || 0) /
      Math.max(coverageRows.length, 1)
  );

  let inserted = 0;

  for (const row of coverageRows) {
    const year = Number(row.year);
    const monthNumber = Number(row.month_number);
    const coverageKey = row.coverage_month || monthKey(year, monthNumber);
    const name = row.month_name || monthName(monthNumber);

    if (!year || !monthNumber) continue;

    let updated = false;

    try {
      const [result] = await conn.query(
        `
        UPDATE tbl_member_membership_coverage
        SET
          payment_id = ?,
          receipt_id = ?,
          invoice_id = ?,
          subscription_id = ?,
          status = 'paid',
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
          AND LOWER(COALESCE(status, '')) IN ('open', 'unpaid', 'pending', 'overdue', 'due', '')
        `,
        [
          payload.payment_id,
          payload.receipt_id || null,
          payload.invoice_id || null,
          payload.subscription_id || null,
          perMonth,
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

    if (!updated) {
      await insertExistingColumns(conn, "tbl_member_membership_coverage", {
        member_id: payload.member_id,
        payment_id: payload.payment_id,
        receipt_id: payload.receipt_id || null,
        invoice_id: payload.invoice_id || null,
        subscription_id: payload.subscription_id || null,

        coverage_year: year,
        coverage_month: coverageKey,
        coverage_month_name: name,
        month_number: monthNumber,
        month_name: name,
        coverage_key: coverageKey,

        status: "paid",
        amount: perMonth,

        payment_number: payload.payment_number || null,
        receipt_number: payload.receipt_number || null,
        invoice_number: payload.invoice_number || null,

        method: payload.method || payload.payment_method || null,
        provider: payload.provider || payload.payment_provider || null,

        created_by: payload.created_by || payload.actor_id || null,
        created_at: mysqlNow(),
        updated_at: mysqlNow(),
      });

      inserted += 1;
    }

    await insertExistingColumns(conn, "tbl_membership_payment_months", {
      payment_id: payload.payment_id,
      member_id: payload.member_id,
      receipt_id: payload.receipt_id || null,
      invoice_id: payload.invoice_id || null,
      year,
      month: monthNumber,
      month_name: name,
      coverage_key: coverageKey,
      amount: perMonth,
      status: "paid",
      created_at: mysqlNow(),
      updated_at: mysqlNow(),
    }).catch(() => {});
  }

  await updateExistingColumns(
    conn,
    "tbl_members",
    {
      membership_start_date: coverage.start_date,
      membership_end_date: coverage.end_date,
      membership_status: "active",
      status: "active",
      is_active: 1,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [payload.member_id]
  ).catch(() => {});

  return {
    success: true,
    member_id: payload.member_id,
    payment_id: payload.payment_id,
    coverage_start_month: coverage.coverage_start_month,
    coverage_end_month: coverage.coverage_end_month,
    coverage_label: coverage.coverage_label,
    months_paid: coverage.months_paid,
    inserted_months: inserted,
    coverage_months: coverage.coverage_months,
    coverage_months_json: coverage.coverage_months_json,
  };
}

async function applyMembershipPayment(conn, payload = {}) {
  if (!payload.member_id) return null;

  await activateMember(conn, payload.member_id);

  const resolvedCoverage = await resolveCoverageDates(conn, payload);

  const subscription = await upsertMembershipSubscription(conn, {
    ...payload,
    months: resolvedCoverage.months_paid,
    duration_months: resolvedCoverage.months_paid,
    resolvedCoverage,
  });

  const coverageResult = await insertMembershipCoverage(conn, {
    ...payload,
    months: resolvedCoverage.months_paid,
    duration_months: resolvedCoverage.months_paid,
    amount: payload.amount,
    total_amount: payload.total_amount || payload.amount,
    subscription_id: subscription?.id || null,
    resolvedCoverage,
  });

  return {
    ...subscription,
    coverage: coverageResult,
  };
}

module.exports = {
  dateOnly,
  addMonths,
  normalizeMonths,
  planDurationLabel,
  prettyCoverageLabel,

  findCurrentSubscription,
  activateMember,

  findNextUnpaidMonth,
  resolveCoverageDates,

  upsertMembershipSubscription,
  insertMembershipCoverage,
  applyMembershipPayment,
};