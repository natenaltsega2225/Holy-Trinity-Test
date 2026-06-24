// backend/services/domains/analytics/analyticsDashboardService.js
"use strict";

const pool = require("../../../db");

const PAID_STATUSES = [
  "paid",
  "posted",
  "completed",
  "approved",
  "succeeded",
];

const OPEN_INVOICE_STATUSES = [
  "draft",
  "open",
  "pending",
  "partial",
  "overdue",
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function quoteIdent(value) {
  const ident = String(value || "");

  if (!/^[A-Za-z0-9_]+$/.test(ident)) {
    throw new Error("Unsafe SQL identifier.");
  }

  return `\`${ident}\``;
}

async function tableExists(tableName) {
  const [rows] = await pool.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function getTableColumns(tableName) {
  if (!(await tableExists(tableName))) return new Set();

  const [rows] = await pool.query(`SHOW COLUMNS FROM ${quoteIdent(tableName)}`);
  return new Set(rows.map((row) => row.Field));
}

function amountColumn(columns, alias) {
  for (const name of ["amount", "payment_amount", "total_amount"]) {
    if (columns.has(name)) return `${alias}.${quoteIdent(name)}`;
  }

  return "0";
}

function dateColumn(columns, alias) {
  for (const name of ["paid_at", "payment_date", "created_at"]) {
    if (columns.has(name)) return `${alias}.${quoteIdent(name)}`;
  }

  return "NOW()";
}

function categoryColumn(columns, alias) {
  for (const name of ["category", "payment_type", "finance_category"]) {
    if (columns.has(name)) return `${alias}.${quoteIdent(name)}`;
  }

  return "NULL";
}

function methodColumn(columns, alias) {
  for (const name of ["payment_method", "method"]) {
    if (columns.has(name)) return `${alias}.${quoteIdent(name)}`;
  }

  return "NULL";
}

function providerColumn(columns, alias) {
  for (const name of ["provider", "payment_provider"]) {
    if (columns.has(name)) return `${alias}.${quoteIdent(name)}`;
  }

  return "NULL";
}

function paidWhere(columns, alias = "p") {
  if (!columns.has("status")) return "1 = 1";

  return `${alias}.status IN (${PAID_STATUSES.map(() => "?").join(", ")})`;
}

function paidParams(columns) {
  return columns.has("status") ? [...PAID_STATUSES] : [];
}

function buildDateFilter(dateSql, filters = {}, params = []) {
  const clauses = [];

  if (filters.date_from) {
    clauses.push(`DATE(${dateSql}) >= ?`);
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    clauses.push(`DATE(${dateSql}) <= ?`);
    params.push(filters.date_to);
  }

  return {
    sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "",
    params,
  };
}

function normalizeFilters(filters = {}) {
  return {
    date_from: clean(filters.date_from || filters.from, 40) || null,
    date_to: clean(filters.date_to || filters.to, 40) || null,
    limit: Math.min(1000, Math.max(1, Number(filters.limit || 100))),
  };
}

function currentYear() {
  return new Date().getFullYear();
}

function currentMonth() {
  return new Date().getMonth() + 1;
}

/* -------------------------------------------------------------------------- */
/* Revenue                                                                    */
/* -------------------------------------------------------------------------- */

async function getRevenueKpis(filters = {}) {
  if (!(await tableExists("tbl_finance_payments"))) {
    return {
      total_transactions: 0,
      total_revenue: 0,
      average_payment: 0,
      largest_payment: 0,
      today_revenue: 0,
      month_revenue: 0,
      year_revenue: 0,
    };
  }

  const normalized = normalizeFilters(filters);
  const columns = await getTableColumns("tbl_finance_payments");

  const amount = amountColumn(columns, "p");
  const date = dateColumn(columns, "p");

  const params = paidParams(columns);
  const dateFilter = buildDateFilter(date, normalized, params);

  const [rows] = await pool.query(
    `
    SELECT
      COUNT(*) AS total_transactions,
      COALESCE(SUM(${amount}), 0) AS total_revenue,
      COALESCE(AVG(${amount}), 0) AS average_payment,
      COALESCE(MAX(${amount}), 0) AS largest_payment,

      COALESCE(SUM(CASE
        WHEN DATE(${date}) = CURDATE()
        THEN ${amount}
        ELSE 0
      END), 0) AS today_revenue,

      COALESCE(SUM(CASE
        WHEN YEAR(${date}) = YEAR(CURDATE())
         AND MONTH(${date}) = MONTH(CURDATE())
        THEN ${amount}
        ELSE 0
      END), 0) AS month_revenue,

      COALESCE(SUM(CASE
        WHEN YEAR(${date}) = YEAR(CURDATE())
        THEN ${amount}
        ELSE 0
      END), 0) AS year_revenue

    FROM tbl_finance_payments p
    WHERE ${paidWhere(columns, "p")}
    ${dateFilter.sql}
    `,
    dateFilter.params
  );

  const row = rows[0] || {};

  return {
    total_transactions: numberValue(row.total_transactions),
    total_revenue: money(row.total_revenue),
    average_payment: money(row.average_payment),
    largest_payment: money(row.largest_payment),
    today_revenue: money(row.today_revenue),
    month_revenue: money(row.month_revenue),
    year_revenue: money(row.year_revenue),
  };
}

async function getMonthlyRevenueTrend(filters = {}) {
  if (!(await tableExists("tbl_finance_payments"))) return [];

  const normalized = normalizeFilters(filters);
  const columns = await getTableColumns("tbl_finance_payments");

  const amount = amountColumn(columns, "p");
  const date = dateColumn(columns, "p");

  const params = paidParams(columns);
  const dateFilter = buildDateFilter(date, normalized, params);

  const [rows] = await pool.query(
    `
    SELECT
      DATE_FORMAT(${date}, '%Y-%m') AS month_key,
      COUNT(*) AS transactions,
      COALESCE(SUM(${amount}), 0) AS total_amount
    FROM tbl_finance_payments p
    WHERE ${paidWhere(columns, "p")}
    ${dateFilter.sql}
    GROUP BY DATE_FORMAT(${date}, '%Y-%m')
    ORDER BY month_key ASC
    `,
    dateFilter.params
  );

  return rows.map((row) => ({
    month_key: row.month_key,
    transactions: numberValue(row.transactions),
    total_amount: money(row.total_amount),
  }));
}

async function getPaymentMethodAnalytics(filters = {}) {
  if (!(await tableExists("tbl_finance_payments"))) return [];

  const normalized = normalizeFilters(filters);
  const columns = await getTableColumns("tbl_finance_payments");

  const amount = amountColumn(columns, "p");
  const method = methodColumn(columns, "p");
  const provider = providerColumn(columns, "p");
  const date = dateColumn(columns, "p");

  const params = paidParams(columns);
  const dateFilter = buildDateFilter(date, normalized, params);

  const [rows] = await pool.query(
    `
    SELECT
      COALESCE(${method}, 'unknown') AS method,
      COALESCE(${provider}, 'unknown') AS provider,
      COUNT(*) AS transactions,
      COALESCE(SUM(${amount}), 0) AS total_amount
    FROM tbl_finance_payments p
    WHERE ${paidWhere(columns, "p")}
    ${dateFilter.sql}
    GROUP BY
      COALESCE(${method}, 'unknown'),
      COALESCE(${provider}, 'unknown')
    ORDER BY total_amount DESC
    `,
    dateFilter.params
  );

  return rows.map((row) => ({
    method: row.method,
    provider: row.provider,
    transactions: numberValue(row.transactions),
    total_amount: money(row.total_amount),
  }));
}

/* -------------------------------------------------------------------------- */
/* Giving / Categories                                                        */
/* -------------------------------------------------------------------------- */

async function getDonationAnalytics(filters = {}) {
  if (!(await tableExists("tbl_finance_payments"))) return [];

  const normalized = normalizeFilters(filters);
  const columns = await getTableColumns("tbl_finance_payments");

  const amount = amountColumn(columns, "p");
  const category = categoryColumn(columns, "p");
  const date = dateColumn(columns, "p");

  let donationType = "NULL";

  for (const name of ["donation_category", "sub_category", "category"]) {
    if (columns.has(name)) {
      donationType = `p.${quoteIdent(name)}`;
      break;
    }
  }

  const params = paidParams(columns);
  const dateFilter = buildDateFilter(date, normalized, params);

  const [rows] = await pool.query(
    `
    SELECT
      COALESCE(${donationType}, 'general_donation') AS sub_category,
      COUNT(*) AS donations,
      COALESCE(SUM(${amount}), 0) AS total_amount
    FROM tbl_finance_payments p
    WHERE ${paidWhere(columns, "p")}
      AND ${category} IN ('donation', 'giving', 'tithe')
    ${dateFilter.sql}
    GROUP BY COALESCE(${donationType}, 'general_donation')
    ORDER BY total_amount DESC
    `,
    dateFilter.params
  );

  return rows.map((row) => ({
    sub_category: row.sub_category,
    donations: numberValue(row.donations),
    total_amount: money(row.total_amount),
  }));
}

async function getCategoryRevenueAnalytics(filters = {}) {
  if (!(await tableExists("tbl_finance_payments"))) return [];

  const normalized = normalizeFilters(filters);
  const columns = await getTableColumns("tbl_finance_payments");

  const amount = amountColumn(columns, "p");
  const category = categoryColumn(columns, "p");
  const date = dateColumn(columns, "p");

  const params = paidParams(columns);
  const dateFilter = buildDateFilter(date, normalized, params);

  const [rows] = await pool.query(
    `
    SELECT
      COALESCE(${category}, 'uncategorized') AS category,
      COUNT(*) AS transactions,
      COALESCE(SUM(${amount}), 0) AS total_amount
    FROM tbl_finance_payments p
    WHERE ${paidWhere(columns, "p")}
    ${dateFilter.sql}
    GROUP BY COALESCE(${category}, 'uncategorized')
    ORDER BY total_amount DESC
    `,
    dateFilter.params
  );

  return rows.map((row) => ({
    category: row.category,
    transactions: numberValue(row.transactions),
    total_amount: money(row.total_amount),
  }));
}

/* -------------------------------------------------------------------------- */
/* Membership                                                                 */
/* -------------------------------------------------------------------------- */

async function getMembershipAnalytics() {
  if (!(await tableExists("tbl_members"))) {
    return {
      total_members: 0,
      active_members: 0,
      inactive_members: 0,
      expired_members: 0,
      pending_members: 0,
      new_members_this_month: 0,
    };
  }

  const columns = await getTableColumns("tbl_members");

  const status = columns.has("membership_status")
    ? "membership_status"
    : columns.has("status")
      ? "status"
      : "NULL";

  const created = columns.has("created_at")
    ? "created_at"
    : columns.has("joined_at")
      ? "joined_at"
      : "NULL";

  const [rows] = await pool.query(
    `
    SELECT
      COUNT(*) AS total_members,

      SUM(CASE
        WHEN ${status} IN ('active', 'current', 'paid')
        THEN 1
        ELSE 0
      END) AS active_members,

      SUM(CASE
        WHEN ${status} IN ('inactive', 'suspended')
        THEN 1
        ELSE 0
      END) AS inactive_members,

      SUM(CASE
        WHEN ${status} IN ('expired', 'overdue')
        THEN 1
        ELSE 0
      END) AS expired_members,

      SUM(CASE
        WHEN ${status} IN ('pending', 'pending_payment')
        THEN 1
        ELSE 0
      END) AS pending_members,

      SUM(CASE
        WHEN ${created} IS NOT NULL
         AND YEAR(${created}) = YEAR(CURDATE())
         AND MONTH(${created}) = MONTH(CURDATE())
        THEN 1
        ELSE 0
      END) AS new_members_this_month

    FROM tbl_members
    `
  );

  const row = rows[0] || {};

  return {
    total_members: numberValue(row.total_members),
    active_members: numberValue(row.active_members),
    inactive_members: numberValue(row.inactive_members),
    expired_members: numberValue(row.expired_members),
    pending_members: numberValue(row.pending_members),
    new_members_this_month: numberValue(row.new_members_this_month),
  };
}

async function getMemberGrowthTrend() {
  if (!(await tableExists("tbl_members"))) return [];

  const columns = await getTableColumns("tbl_members");

  const created = columns.has("created_at")
    ? "created_at"
    : columns.has("joined_at")
      ? "joined_at"
      : null;

  if (!created) return [];

  const [rows] = await pool.query(
    `
    SELECT
      DATE_FORMAT(${created}, '%Y-%m') AS month_key,
      COUNT(*) AS registrations
    FROM tbl_members
    WHERE ${created} IS NOT NULL
    GROUP BY DATE_FORMAT(${created}, '%Y-%m')
    ORDER BY month_key ASC
    `
  );

  return rows.map((row) => ({
    month_key: row.month_key,
    registrations: numberValue(row.registrations),
  }));
}

/* -------------------------------------------------------------------------- */
/* Programs                                                                   */
/* -------------------------------------------------------------------------- */

async function getEventAnalytics() {
  if (
    (await tableExists("tbl_event_program_registrations")) &&
    (await tableExists("tbl_news_events"))
  ) {
    const regColumns = await getTableColumns("tbl_event_program_registrations");
    const eventColumns = await getTableColumns("tbl_news_events");

    const amount = regColumns.has("amount_paid")
      ? "r.amount_paid"
      : regColumns.has("total_amount")
        ? "r.total_amount"
        : regColumns.has("amount")
          ? "r.amount"
          : "0";

    const eventIdColumn = regColumns.has("event_id")
      ? "event_id"
      : regColumns.has("program_id")
        ? "program_id"
        : null;

    if (eventIdColumn && eventColumns.has("id")) {
      const [rows] = await pool.query(
        `
        SELECT
          COALESCE(e.category, 'program') AS category,
          COUNT(r.id) AS registrations,
          COALESCE(SUM(${amount}), 0) AS revenue
        FROM tbl_news_events e
        LEFT JOIN tbl_event_program_registrations r
          ON r.${quoteIdent(eventIdColumn)} = e.id
        GROUP BY COALESCE(e.category, 'program')
        ORDER BY revenue DESC
        `
      );

      return rows.map((row) => ({
        category: row.category,
        registrations: numberValue(row.registrations),
        revenue: money(row.revenue),
      }));
    }
  }

  return getProgramRevenueFromPayments();
}

async function getProgramRevenueFromPayments() {
  if (!(await tableExists("tbl_finance_payments"))) return [];

  const columns = await getTableColumns("tbl_finance_payments");
  const amount = amountColumn(columns, "p");
  const category = categoryColumn(columns, "p");

  const params = paidParams(columns);

  const [rows] = await pool.query(
    `
    SELECT
      COALESCE(${category}, 'program') AS category,
      COUNT(*) AS registrations,
      COALESCE(SUM(${amount}), 0) AS revenue
    FROM tbl_finance_payments p
    WHERE ${paidWhere(columns, "p")}
      AND ${category} IN ('school', 'trip', 'program')
    GROUP BY COALESCE(${category}, 'program')
    ORDER BY revenue DESC
    `,
    params
  );

  return rows.map((row) => ({
    category: row.category,
    registrations: numberValue(row.registrations),
    revenue: money(row.revenue),
  }));
}

/* -------------------------------------------------------------------------- */
/* Volunteers                                                                 */
/* -------------------------------------------------------------------------- */

async function getVolunteerAnalytics() {
  if (!(await tableExists("tbl_volunteer_hours"))) {
    return {
      entries: 0,
      total_hours: 0,
      avg_hours: 0,
    };
  }

  const columns = await getTableColumns("tbl_volunteer_hours");

  const hours = columns.has("total_hours")
    ? "total_hours"
    : columns.has("hours")
      ? "hours"
      : "0";

  const [rows] = await pool.query(
    `
    SELECT
      COUNT(*) AS entries,
      COALESCE(SUM(${hours}), 0) AS total_hours,
      COALESCE(AVG(${hours}), 0) AS avg_hours
    FROM tbl_volunteer_hours
    `
  );

  const row = rows[0] || {};

  return {
    entries: numberValue(row.entries),
    total_hours: numberValue(row.total_hours),
    avg_hours: numberValue(row.avg_hours),
  };
}

/* -------------------------------------------------------------------------- */
/* Invoices / Receipts                                                        */
/* -------------------------------------------------------------------------- */

async function getInvoiceAnalytics() {
  if (!(await tableExists("tbl_finance_invoices"))) {
    return {
      invoices: 0,
      total_invoiced: 0,
      paid_invoices: 0,
      open_invoices: 0,
      overdue_invoices: 0,
      total_balance_due: 0,
    };
  }

  const columns = await getTableColumns("tbl_finance_invoices");

  const total = columns.has("total_amount")
    ? "total_amount"
    : columns.has("amount")
      ? "amount"
      : "0";

  const paid = columns.has("paid_amount")
    ? "paid_amount"
    : "0";

  const balance = columns.has("balance_due")
    ? "balance_due"
    : `GREATEST(COALESCE(${total}, 0) - COALESCE(${paid}, 0), 0)`;

  const status = columns.has("status") ? "status" : "NULL";
  const dueDate = columns.has("due_date") ? "due_date" : "NULL";

  const [rows] = await pool.query(
    `
    SELECT
      COUNT(*) AS invoices,
      COALESCE(SUM(${total}), 0) AS total_invoiced,

      SUM(CASE
        WHEN ${status} = 'paid'
        THEN 1
        ELSE 0
      END) AS paid_invoices,

      SUM(CASE
        WHEN ${status} IN (${OPEN_INVOICE_STATUSES.map(() => "?").join(", ")})
        THEN 1
        ELSE 0
      END) AS open_invoices,

      SUM(CASE
        WHEN ${dueDate} IS NOT NULL
         AND ${dueDate} < CURDATE()
         AND COALESCE(${balance}, 0) > 0
        THEN 1
        ELSE 0
      END) AS overdue_invoices,

      COALESCE(SUM(${balance}), 0) AS total_balance_due

    FROM tbl_finance_invoices
    `,
    [...OPEN_INVOICE_STATUSES]
  );

  const row = rows[0] || {};

  return {
    invoices: numberValue(row.invoices),
    total_invoiced: money(row.total_invoiced),
    paid_invoices: numberValue(row.paid_invoices),
    open_invoices: numberValue(row.open_invoices),
    overdue_invoices: numberValue(row.overdue_invoices),
    total_balance_due: money(row.total_balance_due),
  };
}

async function getReceiptAnalytics() {
  if (!(await tableExists("tbl_finance_receipts"))) return [];

  const columns = await getTableColumns("tbl_finance_receipts");

  const status = columns.has("email_status")
    ? "email_status"
    : columns.has("status")
      ? "status"
      : null;

  if (!status) {
    const [rows] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_finance_receipts
      `
    );

    return [
      {
        email_status: "unknown",
        total: numberValue(rows[0]?.total),
      },
    ];
  }

  const [rows] = await pool.query(
    `
    SELECT
      COALESCE(${status}, 'unknown') AS email_status,
      COUNT(*) AS total
    FROM tbl_finance_receipts
    GROUP BY COALESCE(${status}, 'unknown')
    ORDER BY total DESC
    `
  );

  return rows.map((row) => ({
    email_status: row.email_status,
    total: numberValue(row.total),
  }));
}

/* -------------------------------------------------------------------------- */
/* Pledges                                                                    */
/* -------------------------------------------------------------------------- */

async function getPledgeAnalytics() {
  if (!(await tableExists("tbl_finance_pledges"))) {
    return {
      total_pledges: 0,
      active_pledges: 0,
      paid_pledges: 0,
      overdue_pledges: 0,
      pledged_amount: 0,
      paid_amount: 0,
      outstanding_amount: 0,
    };
  }

  const columns = await getTableColumns("tbl_finance_pledges");

  const pledged = columns.has("pledged_amount")
    ? "pledged_amount"
    : columns.has("amount")
      ? "amount"
      : "0";

  const paid = columns.has("paid_amount")
    ? "paid_amount"
    : "0";

  const remaining = columns.has("remaining_balance")
    ? "remaining_balance"
    : `GREATEST(COALESCE(${pledged}, 0) - COALESCE(${paid}, 0), 0)`;

  const status = columns.has("status") ? "status" : "NULL";

  const [rows] = await pool.query(
    `
    SELECT
      COUNT(*) AS total_pledges,

      SUM(CASE
        WHEN ${status} IN ('active', 'partial', 'partially_paid')
        THEN 1
        ELSE 0
      END) AS active_pledges,

      SUM(CASE
        WHEN ${status} IN ('paid', 'completed', 'fulfilled')
        THEN 1
        ELSE 0
      END) AS paid_pledges,

      SUM(CASE
        WHEN ${status} = 'overdue'
        THEN 1
        ELSE 0
      END) AS overdue_pledges,

      COALESCE(SUM(${pledged}), 0) AS pledged_amount,
      COALESCE(SUM(${paid}), 0) AS paid_amount,
      COALESCE(SUM(${remaining}), 0) AS outstanding_amount

    FROM tbl_finance_pledges
    `
  );

  const row = rows[0] || {};

  return {
    total_pledges: numberValue(row.total_pledges),
    active_pledges: numberValue(row.active_pledges),
    paid_pledges: numberValue(row.paid_pledges),
    overdue_pledges: numberValue(row.overdue_pledges),
    pledged_amount: money(row.pledged_amount),
    paid_amount: money(row.paid_amount),
    outstanding_amount: money(row.outstanding_amount),
  };
}

/* -------------------------------------------------------------------------- */
/* Executive Dashboard                                                        */
/* -------------------------------------------------------------------------- */

async function getExecutiveDashboard(filters = {}) {
  const [
    revenue,
    monthlyRevenue,
    paymentMethods,
    donations,
    categoryRevenue,
    membership,
    growth,
    events,
    volunteers,
    invoices,
    receipts,
    pledges,
  ] = await Promise.all([
    getRevenueKpis(filters),
    getMonthlyRevenueTrend(filters),
    getPaymentMethodAnalytics(filters),
    getDonationAnalytics(filters),
    getCategoryRevenueAnalytics(filters),
    getMembershipAnalytics(),
    getMemberGrowthTrend(),
    getEventAnalytics(),
    getVolunteerAnalytics(),
    getInvoiceAnalytics(),
    getReceiptAnalytics(),
    getPledgeAnalytics(),
  ]);

  return {
    revenue,
    monthly_revenue: monthlyRevenue,
    payment_methods: paymentMethods,
    donations,
    category_revenue: categoryRevenue,
    membership,
    member_growth: growth,
    events,
    volunteers,
    invoices,
    receipts,
    pledges,
    generated_at: new Date().toISOString(),
  };
}

async function getCurrentMonthSummary() {
  return getRevenueKpis({
    date_from: `${currentYear()}-${String(currentMonth()).padStart(2, "0")}-01`,
    date_to: new Date().toISOString().slice(0, 10),
  });
}

/* -------------------------------------------------------------------------- */
/* Exports                                                                    */
/* -------------------------------------------------------------------------- */

module.exports = {
  getRevenueKpis,
  getMonthlyRevenueTrend,
  getPaymentMethodAnalytics,
  getDonationAnalytics,
  getCategoryRevenueAnalytics,
  getMembershipAnalytics,
  getMemberGrowthTrend,
  getEventAnalytics,
  getProgramRevenueFromPayments,
  getVolunteerAnalytics,
  getInvoiceAnalytics,
  getReceiptAnalytics,
  getPledgeAnalytics,
  getExecutiveDashboard,
  getCurrentMonthSummary,
};