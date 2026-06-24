// backend/services/domains/reports/financeReportService.js
"use strict";

const pool = require("../../../db");

const {
  findOne,
  findMany,
} = require("../../../utils/dbHelpers");

const {
  clean,
  money,
  normalizePaymentType,
} = require("../../../utils/financeHelpers");

const {
  mysqlDate,
} = require("../../../utils/dateHelpers");

const {
  exportExcel,
  exportCsv,
  exportJson,
} = require("../export/exportService");

/* -------------------------------------------------------------------------- */
/* Filters                                                                    */
/* -------------------------------------------------------------------------- */

const PAYMENT_CATEGORIES = new Set([
  "membership",
  "donation",
  "school",
  "trip",
  "pledge",
]);

function normalizeReportFilters(filters = {}) {
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

  const categoryRaw =
    clean(
      filters.category ||
      filters.payment_type ||
      "",
      80
    );

  const category = categoryRaw
    ? normalizePaymentType(categoryRaw)
    : "";

  const status =
    clean(filters.status || "", 80).toLowerCase();

  const search =
    clean(filters.search || filters.q || "", 190);

  const limit = Math.min(
    5000,
    Math.max(1, Number(filters.limit || 500))
  );

  const page = Math.max(1, Number(filters.page || 1));
  const offset = (page - 1) * limit;

  return {
    date_from: dateFrom,
    date_to: dateTo,
    category,
    status,
    search,
    limit,
    page,
    offset,
  };
}

function applyDateFilter(where, params, fieldSql, filters) {
  if (filters.date_from) {
    where.push(`DATE(${fieldSql}) >= DATE(?)`);
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push(`DATE(${fieldSql}) <= DATE(?)`);
    params.push(filters.date_to);
  }
}

function paymentWhere(filters = {}, alias = "p") {
  const f = normalizeReportFilters(filters);
  const where = [`${alias}.status = 'paid'`];
  const params = [];

  applyDateFilter(
    where,
    params,
    `COALESCE(${alias}.paid_at, ${alias}.created_at)`,
    f
  );

  if (f.category && PAYMENT_CATEGORIES.has(f.category)) {
    where.push(`${alias}.category = ?`);
    params.push(f.category);
  }

  if (f.search) {
    where.push(`
      (
        ${alias}.payment_number LIKE ?
        OR ${alias}.member_no LIKE ?
        OR ${alias}.full_name_snapshot LIKE ?
        OR ${alias}.email_snapshot LIKE ?
        OR ${alias}.reference_no LIKE ?
      )
    `);

    const like = `%${f.search}%`;
    params.push(like, like, like, like, like);
  }

  return {
    filters: f,
    whereSql: `WHERE ${where.join(" AND ")}`,
    params,
  };
}

function memberWhere(filters = {}, alias = "m") {
  const f = normalizeReportFilters(filters);
  const where = ["1=1"];
  const params = [];

  applyDateFilter(where, params, `${alias}.created_at`, f);

  if (f.status === "active") {
    where.push(`LOWER(COALESCE(${alias}.membership_status, '')) = 'active'`);
  }

  if (f.status === "inactive") {
    where.push(`LOWER(COALESCE(${alias}.membership_status, '')) IN ('inactive', 'expired', 'suspended')`);
  }

  if (f.search) {
    where.push(`
      (
        ${alias}.member_no LIKE ?
        OR ${alias}.full_name LIKE ?
        OR ${alias}.email LIKE ?
        OR ${alias}.phone LIKE ?
      )
    `);

    const like = `%${f.search}%`;
    params.push(like, like, like, like);
  }

  return {
    filters: f,
    whereSql: `WHERE ${where.join(" AND ")}`,
    params,
  };
}

/* -------------------------------------------------------------------------- */
/* Summary                                                                    */
/* -------------------------------------------------------------------------- */

async function getRevenueSummary(filters = {}) {
  const { whereSql, params } = paymentWhere(filters);

  const row = await findOne(
    pool,
    `
    SELECT
      COUNT(*) AS total_transactions,

      COALESCE(SUM(p.amount), 0) AS total_payments,

      COALESCE(SUM(CASE WHEN p.category = 'membership' THEN p.amount ELSE 0 END), 0) AS membership_payments,
      COALESCE(SUM(CASE WHEN p.category = 'donation' THEN p.amount ELSE 0 END), 0) AS donation_payments,
      COALESCE(SUM(CASE WHEN p.category = 'school' THEN p.amount ELSE 0 END), 0) AS school_payments,
      COALESCE(SUM(CASE WHEN p.category = 'trip' THEN p.amount ELSE 0 END), 0) AS trip_payments,
      COALESCE(SUM(CASE WHEN p.category = 'pledge' THEN p.amount ELSE 0 END), 0) AS pledge_payments,

      COALESCE(SUM(CASE WHEN p.method = 'cash' THEN p.amount ELSE 0 END), 0) AS cash_payments,
      COALESCE(SUM(CASE WHEN p.method = 'check' THEN p.amount ELSE 0 END), 0) AS check_payments,
      COALESCE(SUM(CASE WHEN p.method = 'zelle' THEN p.amount ELSE 0 END), 0) AS zelle_payments,
      COALESCE(SUM(CASE WHEN p.method = 'card' THEN p.amount ELSE 0 END), 0) AS card_payments,
      COALESCE(SUM(CASE WHEN p.method = 'ach' THEN p.amount ELSE 0 END), 0) AS ach_payments

    FROM tbl_finance_payments p
    ${whereSql}
    `,
    params
  );

  return {
    total_transactions: Number(row?.total_transactions || 0),
    total_payments: money(row?.total_payments || 0),

    membership_payments: money(row?.membership_payments || 0),
    donation_payments: money(row?.donation_payments || 0),
    school_payments: money(row?.school_payments || 0),
    trip_payments: money(row?.trip_payments || 0),
    pledge_payments: money(row?.pledge_payments || 0),

    cash_payments: money(row?.cash_payments || 0),
    check_payments: money(row?.check_payments || 0),
    zelle_payments: money(row?.zelle_payments || 0),
    card_payments: money(row?.card_payments || 0),
    ach_payments: money(row?.ach_payments || 0),
  };
}

async function getMemberSummary(filters = {}) {
  const { whereSql, params } = memberWhere(filters);

  const row = await findOne(
    pool,
    `
    SELECT
      COUNT(*) AS total_members,
      SUM(CASE WHEN LOWER(COALESCE(m.membership_status, '')) = 'active' THEN 1 ELSE 0 END) AS active_members,
      SUM(CASE WHEN LOWER(COALESCE(m.membership_status, '')) IN ('inactive', 'expired', 'suspended') THEN 1 ELSE 0 END) AS inactive_members
    FROM tbl_members m
    ${whereSql}
    `,
    params
  );

  return {
    total_members: Number(row?.total_members || 0),
    active_members: Number(row?.active_members || 0),
    inactive_members: Number(row?.inactive_members || 0),
  };
}

async function getPledgeSummary(filters = {}) {
  const f = normalizeReportFilters(filters);
  const where = ["1=1"];
  const params = [];

  applyDateFilter(where, params, "COALESCE(pl.created_at, pl.due_date)", f);

  const row = await findOne(
    pool,
    `
    SELECT
      COUNT(*) AS total_pledges,
      SUM(CASE WHEN LOWER(COALESCE(pl.status, '')) IN ('active', 'partial', 'overdue') THEN 1 ELSE 0 END) AS open_pledges,
      SUM(CASE WHEN LOWER(COALESCE(pl.status, '')) IN ('paid', 'completed', 'closed') THEN 1 ELSE 0 END) AS paid_pledges,
      COALESCE(SUM(pl.pledged_amount), 0) AS pledged_amount,
      COALESCE(SUM(pl.paid_amount), 0) AS paid_amount,
      COALESCE(SUM(GREATEST(COALESCE(pl.pledged_amount, 0) - COALESCE(pl.paid_amount, 0), 0)), 0) AS remaining_amount
    FROM tbl_finance_pledges pl
    WHERE ${where.join(" AND ")}
    `,
    params
  );

  return {
    total_pledges: Number(row?.total_pledges || 0),
    open_pledges: Number(row?.open_pledges || 0),
    paid_pledges: Number(row?.paid_pledges || 0),
    pledged_amount: money(row?.pledged_amount || 0),
    paid_amount: money(row?.paid_amount || 0),
    remaining_amount: money(row?.remaining_amount || 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Detail Reports                                                             */
/* -------------------------------------------------------------------------- */

async function getMembersReport(filters = {}) {
  const { filters: f, whereSql, params } = memberWhere(filters);

  return findMany(
    pool,
    `
    SELECT
      m.id,
      m.member_no,
      m.full_name,
      m.email,
      m.phone,
      m.membership_status,
      m.membership_start_date,
      m.membership_end_date,
      m.created_at,

      COALESCE(mp.total_paid, 0) AS membership_paid_in_period,
      mp.last_paid_at AS last_membership_payment_at

    FROM tbl_members m

    LEFT JOIN (
      SELECT
        member_id,
        COALESCE(SUM(amount), 0) AS total_paid,
        MAX(COALESCE(paid_at, created_at)) AS last_paid_at
      FROM tbl_finance_payments p
      WHERE p.status = 'paid'
        AND p.category = 'membership'
        ${
          f.date_from
            ? "AND DATE(COALESCE(p.paid_at, p.created_at)) >= DATE(?)"
            : ""
        }
        ${
          f.date_to
            ? "AND DATE(COALESCE(p.paid_at, p.created_at)) <= DATE(?)"
            : ""
        }
      GROUP BY member_id
    ) mp
      ON mp.member_id = m.id

    ${whereSql}

    ORDER BY
      m.member_no ASC,
      m.full_name ASC

    LIMIT ? OFFSET ?
    `,
    [
      ...(f.date_from ? [f.date_from] : []),
      ...(f.date_to ? [f.date_to] : []),
      ...params,
      f.limit,
      f.offset,
    ]
  );
}

async function getUnpaidMembersReport(filters = {}) {
  const f = normalizeReportFilters(filters);
  const dateFrom = f.date_from || mysqlDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const dateTo = f.date_to || mysqlDate(new Date());

  const params = [dateFrom, dateTo];
  const searchWhere = [];

  if (f.search) {
    searchWhere.push(`
      AND (
        m.member_no LIKE ?
        OR m.full_name LIKE ?
        OR m.email LIKE ?
        OR m.phone LIKE ?
      )
    `);

    const like = `%${f.search}%`;
    params.push(like, like, like, like);
  }

  params.push(f.limit, f.offset);

  return findMany(
    pool,
    `
    SELECT
      m.id,
      m.member_no,
      m.full_name,
      m.email,
      m.phone,
      m.membership_status,
      m.membership_start_date,
      m.membership_end_date,

      COALESCE(mp.total_paid, 0) AS membership_paid_in_period,
      mp.last_paid_at AS last_membership_payment_at,

      ? AS report_from,
      ? AS report_to

    FROM tbl_members m

    LEFT JOIN (
      SELECT
        member_id,
        COALESCE(SUM(amount), 0) AS total_paid,
        MAX(COALESCE(paid_at, created_at)) AS last_paid_at
      FROM tbl_finance_payments
      WHERE status = 'paid'
        AND category = 'membership'
        AND DATE(COALESCE(paid_at, created_at)) >= DATE(?)
        AND DATE(COALESCE(paid_at, created_at)) <= DATE(?)
      GROUP BY member_id
    ) mp
      ON mp.member_id = m.id

    WHERE LOWER(COALESCE(m.membership_status, '')) = 'active'
      AND COALESCE(mp.total_paid, 0) = 0
      ${searchWhere.join(" ")}

    ORDER BY
      m.member_no ASC,
      m.full_name ASC

    LIMIT ? OFFSET ?
    `,
    [dateFrom, dateTo, dateFrom, dateTo, ...params.slice(2)]
  );
}

async function getPaymentReport(filters = {}) {
  const { filters: f, whereSql, params } = paymentWhere(filters);

  return findMany(
    pool,
    `
    SELECT
      p.id,
      p.payment_number,
      p.member_id,
      p.member_no,
      p.full_name_snapshot AS payer_name,
      p.email_snapshot AS payer_email,
      p.category,
      p.sub_category,
      p.amount,
      p.method,
      p.provider,
      p.status,
      p.reference_no,
      p.coverage_label,
      p.created_at,
      p.paid_at,

      i.invoice_number,
      r.receipt_number

    FROM tbl_finance_payments p

    LEFT JOIN tbl_finance_invoices i
      ON i.id = p.invoice_id

    LEFT JOIN tbl_finance_receipts r
      ON r.payment_id = p.id

    ${whereSql}

    ORDER BY
      COALESCE(p.paid_at, p.created_at) DESC,
      p.id DESC

    LIMIT ? OFFSET ?
    `,
    [...params, f.limit, f.offset]
  );
}

async function getProgramRegistrationReport(filters = {}) {
  const f = normalizeReportFilters(filters);
  const where = ["1=1"];
  const params = [];

  applyDateFilter(where, params, "r.created_at", f);

  if (f.category === "school") {
    where.push("LOWER(COALESCE(r.category, '')) IN ('school', 'kids', 'school_program')");
  }

  if (f.category === "trip") {
    where.push("LOWER(COALESCE(r.category, '')) IN ('trip', 'travel', 'trip_program')");
  }

  if (f.status) {
    where.push("LOWER(COALESCE(r.status, '')) = ?");
    params.push(f.status);
  }

  if (f.search) {
    where.push(`
      (
        r.registration_number LIKE ?
        OR r.full_name_snapshot LIKE ?
        OR r.email_snapshot LIKE ?
        OR ne.title LIKE ?
      )
    `);

    const like = `%${f.search}%`;
    params.push(like, like, like, like);
  }

  return findMany(
    pool,
    `
    SELECT
      r.*,
      ne.title AS program_title,
      ne.start_date AS program_start_date,
      ne.end_date AS program_end_date,
      ne.location AS program_location,

      (
        SELECT COUNT(*)
        FROM tbl_event_program_registration_participants pp
        WHERE pp.registration_id = r.id
      ) AS participant_count

    FROM tbl_event_program_registrations r

    LEFT JOIN tbl_news_events ne
      ON ne.id = r.program_id

    WHERE ${where.join(" AND ")}

    ORDER BY
      r.created_at DESC,
      r.id DESC

    LIMIT ? OFFSET ?
    `,
    [...params, f.limit, f.offset]
  );
}

async function getPledgeReport(filters = {}) {
  const f = normalizeReportFilters(filters);
  const where = ["1=1"];
  const params = [];

  applyDateFilter(where, params, "COALESCE(pl.created_at, pl.due_date)", f);

  if (f.status) {
    where.push("LOWER(COALESCE(pl.status, '')) = ?");
    params.push(f.status);
  }

  if (f.search) {
    where.push(`
      (
        pl.pledge_number LIKE ?
        OR m.member_no LIKE ?
        OR m.full_name LIKE ?
        OR pl.guest_name LIKE ?
        OR pl.email LIKE ?
        OR c.title LIKE ?
      )
    `);

    const like = `%${f.search}%`;
    params.push(like, like, like, like, like, like);
  }

  return findMany(
    pool,
    `
    SELECT
      pl.id,
      pl.pledge_number,
      pl.member_id,
      m.member_no,
      COALESCE(m.full_name, pl.guest_name) AS donor_name,
      COALESCE(m.email, pl.email) AS donor_email,
      c.title AS campaign_name,
      pl.pledged_amount,
      pl.paid_amount,
      GREATEST(COALESCE(pl.pledged_amount, 0) - COALESCE(pl.paid_amount, 0), 0) AS remaining_amount,
      pl.status,
      pl.due_date,
      pl.created_at,
      pl.updated_at

    FROM tbl_finance_pledges pl

    LEFT JOIN tbl_members m
      ON m.id = pl.member_id

    LEFT JOIN tbl_finance_campaigns c
      ON c.id = pl.campaign_id

    WHERE ${where.join(" AND ")}

    ORDER BY
      pl.created_at DESC,
      pl.id DESC

    LIMIT ? OFFSET ?
    `,
    [...params, f.limit, f.offset]
  );
}

async function getPaymentMethodReport(filters = {}) {
  const { whereSql, params } = paymentWhere(filters);

  return findMany(
    pool,
    `
    SELECT
      p.method,
      p.provider,
      COUNT(*) AS transactions,
      COALESCE(SUM(p.amount), 0) AS total_amount
    FROM tbl_finance_payments p
    ${whereSql}
    GROUP BY p.method, p.provider
    ORDER BY total_amount DESC
    `,
    params
  );
}

async function getRevenueByCategory(filters = {}) {
  const { whereSql, params } = paymentWhere(filters);

  return findMany(
    pool,
    `
    SELECT
      p.category,
      COUNT(*) AS transactions,
      COALESCE(SUM(p.amount), 0) AS total_amount
    FROM tbl_finance_payments p
    ${whereSql}
    GROUP BY p.category
    ORDER BY total_amount DESC
    `,
    params
  );
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

async function getEnterpriseReportDashboard(filters = {}) {
  const [
    revenue_summary,
    member_summary,
    pledge_summary,
    revenue_by_category,
    payment_methods,
    unpaid_members,
    school_registrations,
    trip_registrations,
  ] = await Promise.all([
    getRevenueSummary(filters),
    getMemberSummary(filters),
    getPledgeSummary(filters),
    getRevenueByCategory(filters),
    getPaymentMethodReport(filters),
    getUnpaidMembersReport({ ...filters, limit: 20 }),
    getProgramRegistrationReport({ ...filters, category: "school", limit: 20 }),
    getProgramRegistrationReport({ ...filters, category: "trip", limit: 20 }),
  ]);

  return {
    revenue_summary,
    member_summary,
    pledge_summary,
    revenue_by_category,
    payment_methods,
    unpaid_members,
    school_registrations,
    trip_registrations,
    generated_at: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Exports                                                                    */
/* -------------------------------------------------------------------------- */

async function getReportRows(report, filters = {}) {
  const key = clean(report || "payments", 80).toLowerCase();

  if (key === "members") return getMembersReport(filters);
  if (key === "unpaid_members") return getUnpaidMembersReport(filters);
  if (key === "payments") return getPaymentReport(filters);
  if (key === "membership_payments") {
    return getPaymentReport({ ...filters, category: "membership" });
  }
  if (key === "donation_payments") {
    return getPaymentReport({ ...filters, category: "donation" });
  }
  if (key === "school_registrations") {
    return getProgramRegistrationReport({ ...filters, category: "school" });
  }
  if (key === "trip_registrations") {
    return getProgramRegistrationReport({ ...filters, category: "trip" });
  }
  if (key === "program_registrations") return getProgramRegistrationReport(filters);
  if (key === "pledges") return getPledgeReport(filters);

  return getPaymentReport(filters);
}

async function exportFinanceReport({ report = "payments", format = "xlsx", filters = {} }) {
  const rows = await getReportRows(report, {
    ...filters,
    limit: filters.limit || 5000,
  });

  const fileName = `finance-${report}`;

  if (format === "csv") {
    return exportCsv({
      rows,
      fileName,
    });
  }

  if (format === "json") {
    return exportJson({
      rows,
      fileName,
    });
  }

  return exportExcel({
    rows,
    fileName,
    sheetName: clean(report, 31) || "Report",
    summary: {
      report,
      total_rows: rows.length,
      generated_at: new Date().toISOString(),
      date_from: filters.date_from || filters.from || "",
      date_to: filters.date_to || filters.to || "",
    },
  });
}

module.exports = {
  normalizeReportFilters,

  getEnterpriseReportDashboard,

  getRevenueSummary,
  getMemberSummary,
  getPledgeSummary,

  getMembersReport,
  getUnpaidMembersReport,
  getPaymentReport,
  getProgramRegistrationReport,
  getPledgeReport,

  getPaymentMethodReport,
  getRevenueByCategory,

  getReportRows,
  exportFinanceReport,
};