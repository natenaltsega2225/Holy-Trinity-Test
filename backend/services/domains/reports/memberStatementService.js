// backend/services/domains/reports/memberStatementService.js
"use strict";

const pool = require("../../../db");

const {
  findOne,
  findMany,
} = require("../../../utils/dbHelpers");

const {
  clean,
  money,
} = require("../../../utils/financeHelpers");

const {
  mysqlDate,
} = require("../../../utils/dateHelpers");

const {
  exportMultiSheetExcel,
  exportCsv,
  exportJson,
} = require("../export/exportService");

/* -------------------------------------------------------------------------- */
/* Filters                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeFilters(filters = {}) {
  const now = new Date();

  const year =
    Number(filters.year) ||
    now.getFullYear();

  const dateFrom =
    clean(
      filters.date_from ||
      filters.from ||
      filters.start_date ||
      "",
      20
    ) || null;

  const dateTo =
    clean(
      filters.date_to ||
      filters.to ||
      filters.end_date ||
      "",
      20
    ) || null;

  const category =
    clean(filters.category || "", 80).toLowerCase();

  const status =
    clean(filters.status || "", 80).toLowerCase();

  const limit = Math.min(
    5000,
    Math.max(1, Number(filters.limit || 1000))
  );

  return {
    year,
    date_from: dateFrom,
    date_to: dateTo,
    category,
    status,
    limit,
  };
}

function applyPaymentDateFilter(where, params, filters, alias = "p") {
  if (filters.date_from) {
    where.push(`DATE(COALESCE(${alias}.paid_at, ${alias}.created_at)) >= DATE(?)`);
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push(`DATE(COALESCE(${alias}.paid_at, ${alias}.created_at)) <= DATE(?)`);
    params.push(filters.date_to);
  }
}

function periodFilters(type = "annual", payload = {}) {
  const now = new Date();
  const year = Number(payload.year || now.getFullYear());
  const month = Math.min(12, Math.max(1, Number(payload.month || now.getMonth() + 1)));
  const quarter = Math.min(4, Math.max(1, Number(payload.quarter || Math.ceil(month / 3))));

  if (payload.date_from || payload.date_to) {
    return normalizeFilters(payload);
  }

  if (type === "monthly") {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);

    return normalizeFilters({
      ...payload,
      year,
      date_from: mysqlDate(start),
      date_to: mysqlDate(end),
    });
  }

  if (type === "quarterly") {
    const startMonth = (quarter - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0);

    return normalizeFilters({
      ...payload,
      year,
      quarter,
      date_from: mysqlDate(start),
      date_to: mysqlDate(end),
    });
  }

  return normalizeFilters({
    ...payload,
    year,
    date_from: `${year}-01-01`,
    date_to: `${year}-12-31`,
  });
}

/* -------------------------------------------------------------------------- */
/* Member Profile                                                             */
/* -------------------------------------------------------------------------- */

async function getMemberProfile(memberId) {
  return findOne(
    pool,
    `
    SELECT
      id,
      member_no,
      full_name,
      email,
      phone,
      membership_status,
      membership_start_date,
      membership_end_date,
      created_at
    FROM tbl_members
    WHERE id = ?
    LIMIT 1
    `,
    [memberId]
  );
}

/* -------------------------------------------------------------------------- */
/* Summary                                                                    */
/* -------------------------------------------------------------------------- */

async function getMemberFinancialSummary(memberId, filters = {}) {
  const f = normalizeFilters(filters);
  const where = [
    "p.member_id = ?",
    "p.status = 'paid'",
  ];
  const params = [memberId];

  applyPaymentDateFilter(where, params, f);

  const summary = await findOne(
    pool,
    `
    SELECT
      COUNT(*) AS transactions,

      COALESCE(SUM(p.amount), 0) AS total_paid,

      COALESCE(SUM(CASE WHEN p.category = 'donation' THEN p.amount ELSE 0 END), 0) AS donations,

      COALESCE(SUM(CASE WHEN p.category = 'membership' THEN p.amount ELSE 0 END), 0) AS membership_payments,

      COALESCE(SUM(CASE WHEN p.category IN ('school', 'trip') THEN p.amount ELSE 0 END), 0) AS program_payments,

      COALESCE(SUM(CASE WHEN p.category = 'school' THEN p.amount ELSE 0 END), 0) AS school_payments,

      COALESCE(SUM(CASE WHEN p.category = 'trip' THEN p.amount ELSE 0 END), 0) AS trip_payments,

      COALESCE(SUM(CASE WHEN p.category = 'pledge' THEN p.amount ELSE 0 END), 0) AS pledge_payments,

      COALESCE(SUM(CASE WHEN p.method = 'cash' THEN p.amount ELSE 0 END), 0) AS cash_payments,

      COALESCE(SUM(CASE WHEN p.method = 'check' THEN p.amount ELSE 0 END), 0) AS check_payments,

      COALESCE(SUM(CASE WHEN p.method = 'zelle' THEN p.amount ELSE 0 END), 0) AS zelle_payments,

      COALESCE(SUM(CASE WHEN p.method = 'card' THEN p.amount ELSE 0 END), 0) AS card_payments,

      COALESCE(SUM(CASE WHEN p.method = 'ach' THEN p.amount ELSE 0 END), 0) AS ach_payments

    FROM tbl_finance_payments p
    WHERE ${where.join(" AND ")}
    `,
    params
  );

  return {
    transactions: Number(summary?.transactions || 0),

    totalPaid: money(summary?.total_paid || 0),
    total_paid: money(summary?.total_paid || 0),

    donations: money(summary?.donations || 0),
    membershipPayments: money(summary?.membership_payments || 0),
    membership_payments: money(summary?.membership_payments || 0),

    programPayments: money(summary?.program_payments || 0),
    program_payments: money(summary?.program_payments || 0),

    school_payments: money(summary?.school_payments || 0),
    trip_payments: money(summary?.trip_payments || 0),
    pledge_payments: money(summary?.pledge_payments || 0),

    cash_payments: money(summary?.cash_payments || 0),
    check_payments: money(summary?.check_payments || 0),
    zelle_payments: money(summary?.zelle_payments || 0),
    card_payments: money(summary?.card_payments || 0),
    ach_payments: money(summary?.ach_payments || 0),

    date_from: f.date_from,
    date_to: f.date_to,
  };
}

/* -------------------------------------------------------------------------- */
/* Payments                                                                   */
/* -------------------------------------------------------------------------- */

async function getMemberPayments(memberId, filters = {}) {
  const f = normalizeFilters(filters);
  const where = ["p.member_id = ?"];
  const params = [memberId];

  applyPaymentDateFilter(where, params, f);

  if (f.category) {
    where.push("p.category = ?");
    params.push(f.category);
  }

  if (f.status) {
    where.push("p.status = ?");
    params.push(f.status);
  }

  params.push(f.limit);

  return findMany(
    pool,
    `
    SELECT
      p.id,
      p.payment_number,
      p.category,
      p.sub_category,
      p.amount,
      p.method,
      p.provider,
      p.status,
      p.reference_no,
      p.coverage_start,
      p.coverage_end,
      p.coverage_label,
      p.months_paid,
      p.created_at,
      p.paid_at,

      r.receipt_number,
      r.status AS receipt_status,

      i.invoice_number,
      i.status AS invoice_status

    FROM tbl_finance_payments p

    LEFT JOIN tbl_finance_receipts r
      ON r.payment_id = p.id

    LEFT JOIN tbl_finance_invoices i
      ON i.id = p.invoice_id

    WHERE ${where.join(" AND ")}

    ORDER BY
      COALESCE(p.paid_at, p.created_at) DESC,
      p.id DESC

    LIMIT ?
    `,
    params
  );
}

async function getMemberDonationHistory(memberId, filters = {}) {
  return getMemberPayments(memberId, {
    ...filters,
    category: "donation",
    status: filters.status || "paid",
  });
}

async function getMembershipHistory(memberId, filters = {}) {
  return getMemberPayments(memberId, {
    ...filters,
    category: "membership",
    status: filters.status || "paid",
  });
}

async function getMemberProgramHistory(memberId, filters = {}) {
  const f = normalizeFilters(filters);
  const where = [
    "p.member_id = ?",
    "p.status = 'paid'",
    "p.category IN ('school', 'trip')",
  ];
  const params = [memberId];

  applyPaymentDateFilter(where, params, f);
  params.push(f.limit);

  return findMany(
    pool,
    `
    SELECT
      p.id,
      p.payment_number,
      p.category,
      p.sub_category,
      p.amount,
      p.method,
      p.provider,
      p.reference_no,
      p.created_at,
      p.paid_at,

      i.invoice_number,
      r.receipt_number

    FROM tbl_finance_payments p

    LEFT JOIN tbl_finance_invoices i
      ON i.id = p.invoice_id

    LEFT JOIN tbl_finance_receipts r
      ON r.payment_id = p.id

    WHERE ${where.join(" AND ")}

    ORDER BY
      COALESCE(p.paid_at, p.created_at) DESC,
      p.id DESC

    LIMIT ?
    `,
    params
  );
}

/* -------------------------------------------------------------------------- */
/* Giving Statement                                                           */
/* -------------------------------------------------------------------------- */

async function getAnnualGivingStatement(memberId, year) {
  const f = periodFilters("annual", { year });

  return findMany(
    pool,
    `
    SELECT
      p.payment_number,
      p.category,
      p.sub_category,
      p.amount,
      p.method,
      p.reference_no,
      p.paid_at,

      r.receipt_number

    FROM tbl_finance_payments p

    LEFT JOIN tbl_finance_receipts r
      ON r.payment_id = p.id

    WHERE p.member_id = ?
      AND p.status = 'paid'
      AND p.category IN ('donation', 'pledge')
      AND DATE(COALESCE(p.paid_at, p.created_at)) >= DATE(?)
      AND DATE(COALESCE(p.paid_at, p.created_at)) <= DATE(?)

    ORDER BY
      COALESCE(p.paid_at, p.created_at) ASC,
      p.id ASC
    `,
    [memberId, f.date_from, f.date_to]
  );
}

async function getGivingStatement(memberId, filters = {}) {
  const f = normalizeFilters(filters);
  const where = [
    "p.member_id = ?",
    "p.status = 'paid'",
    "p.category IN ('donation', 'pledge')",
  ];
  const params = [memberId];

  applyPaymentDateFilter(where, params, f);

  return findMany(
    pool,
    `
    SELECT
      p.payment_number,
      p.category,
      p.sub_category AS giving_category,
      p.amount,
      p.method,
      p.reference_no,
      p.paid_at,
      r.receipt_number
    FROM tbl_finance_payments p
    LEFT JOIN tbl_finance_receipts r
      ON r.payment_id = p.id
    WHERE ${where.join(" AND ")}
    ORDER BY COALESCE(p.paid_at, p.created_at) ASC, p.id ASC
    `,
    params
  );
}

/* -------------------------------------------------------------------------- */
/* Pledges                                                                    */
/* -------------------------------------------------------------------------- */

async function getMemberPledgeHistory(memberId, filters = {}) {
  const f = normalizeFilters(filters);
  const where = ["pl.member_id = ?"];
  const params = [memberId];

  if (f.date_from) {
    where.push("DATE(COALESCE(pl.created_at, pl.due_date)) >= DATE(?)");
    params.push(f.date_from);
  }

  if (f.date_to) {
    where.push("DATE(COALESCE(pl.created_at, pl.due_date)) <= DATE(?)");
    params.push(f.date_to);
  }

  return findMany(
    pool,
    `
    SELECT
      pl.id,
      pl.pledge_number,
      c.title AS campaign_name,
      pl.pledged_amount,
      pl.paid_amount,
      GREATEST(COALESCE(pl.pledged_amount, 0) - COALESCE(pl.paid_amount, 0), 0) AS remaining_amount,
      pl.status,
      pl.due_date,
      pl.created_at
    FROM tbl_finance_pledges pl
    LEFT JOIN tbl_finance_campaigns c
      ON c.id = pl.campaign_id
    WHERE ${where.join(" AND ")}
    ORDER BY pl.created_at DESC, pl.id DESC
    `,
    params
  );
}

/* -------------------------------------------------------------------------- */
/* Statement Builders                                                         */
/* -------------------------------------------------------------------------- */

async function getFullMemberStatement(memberId, filters = {}) {
  const f = normalizeFilters(filters);

  const [
    member,
    summary,
    payments,
    donations,
    memberships,
    programs,
    giving,
    pledges,
  ] = await Promise.all([
    getMemberProfile(memberId),
    getMemberFinancialSummary(memberId, f),
    getMemberPayments(memberId, f),
    getMemberDonationHistory(memberId, f),
    getMembershipHistory(memberId, f),
    getMemberProgramHistory(memberId, f),
    getGivingStatement(memberId, f),
    getMemberPledgeHistory(memberId, f),
  ]);

  return {
    member,
    summary,
    payments,
    donations,
    memberships,
    programs,
    giving,
    pledges,
    filters: f,
    generated_at: new Date().toISOString(),
  };
}

async function getMonthlyStatement(memberId, payload = {}) {
  return getFullMemberStatement(
    memberId,
    periodFilters("monthly", payload)
  );
}

async function getQuarterlyStatement(memberId, payload = {}) {
  return getFullMemberStatement(
    memberId,
    periodFilters("quarterly", payload)
  );
}

async function getAnnualStatement(memberId, payload = {}) {
  return getFullMemberStatement(
    memberId,
    periodFilters("annual", payload)
  );
}

function buildStatementExportRows(statement = {}) {
  return (statement.payments || []).map((payment) => ({
    member_no: statement.member?.member_no || "",
    member_name: statement.member?.full_name || "",
    payment_number: payment.payment_number,
    invoice_number: payment.invoice_number,
    receipt_number: payment.receipt_number,
    category: payment.category,
    sub_category: payment.sub_category,
    amount: payment.amount,
    method: payment.method,
    provider: payment.provider,
    status: payment.status,
    coverage_label: payment.coverage_label,
    paid_at: payment.paid_at,
  }));
}

async function exportMemberStatement({
  memberId,
  filters = {},
  format = "xlsx",
  statementType = "annual",
} = {}) {
  let statement;

  if (statementType === "monthly") {
    statement = await getMonthlyStatement(memberId, filters);
  } else if (statementType === "quarterly") {
    statement = await getQuarterlyStatement(memberId, filters);
  } else {
    statement = await getAnnualStatement(memberId, filters);
  }

  const fileName = `member-statement-${statement.member?.member_no || memberId}`;

  if (format === "csv") {
    return exportCsv({
      rows: buildStatementExportRows(statement),
      fileName,
    });
  }

  if (format === "json") {
    return exportJson({
      rows: buildStatementExportRows(statement),
      fileName,
      summary: statement.summary,
    });
  }

  return exportMultiSheetExcel({
    fileName,
    summary: {
      member_no: statement.member?.member_no || "",
      member_name: statement.member?.full_name || "",
      date_from: statement.filters?.date_from || "",
      date_to: statement.filters?.date_to || "",
      total_paid: statement.summary?.total_paid || 0,
      generated_at: statement.generated_at,
    },
    sheets: [
      {
        name: "Payments",
        rows: statement.payments || [],
      },
      {
        name: "Giving",
        rows: statement.giving || [],
      },
      {
        name: "Membership",
        rows: statement.memberships || [],
      },
      {
        name: "Programs",
        rows: statement.programs || [],
      },
      {
        name: "Pledges",
        rows: statement.pledges || [],
      },
    ],
  });
}

module.exports = {
  normalizeFilters,
  periodFilters,

  getMemberProfile,
  getMemberFinancialSummary,

  getMemberPayments,
  getMemberDonationHistory,
  getMembershipHistory,
  getMemberProgramHistory,
  getMemberPledgeHistory,

  getAnnualGivingStatement,
  getGivingStatement,

  getFullMemberStatement,
  getMonthlyStatement,
  getQuarterlyStatement,
  getAnnualStatement,

  buildStatementExportRows,
  exportMemberStatement,
};