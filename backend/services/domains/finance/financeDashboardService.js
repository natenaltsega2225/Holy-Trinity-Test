// backend/services/domains/finance/financeDashboardService.js
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

const ACTIVE_PLEDGE_STATUSES = [
  "active",
  "partial",
  "partially_paid",
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

function selectExisting(columns, alias, names, fallback = "NULL", asName = null) {
  for (const name of names) {
    if (columns.has(name)) {
      return `${alias}.${quoteIdent(name)} AS ${quoteIdent(asName || names[0])}`;
    }
  }

  return `${fallback} AS ${quoteIdent(asName || names[0])}`;
}

function dateColumn(columns, alias) {
  for (const name of ["paid_at", "payment_date", "created_at"]) {
    if (columns.has(name)) return `${alias}.${quoteIdent(name)}`;
  }

  return "NOW()";
}

function amountColumn(columns, alias) {
  for (const name of ["amount", "payment_amount", "total_amount"]) {
    if (columns.has(name)) return `${alias}.${quoteIdent(name)}`;
  }

  return "0";
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

function buildDateFilter(columnSql, filters = {}, params = []) {
  const clauses = [];

  if (filters.date_from) {
    clauses.push(`DATE(${columnSql}) >= ?`);
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    clauses.push(`DATE(${columnSql}) <= ?`);
    params.push(filters.date_to);
  }

  return {
    sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "",
    params,
  };
}

function normalizePeriodFilters(filters = {}) {
  const period = clean(filters.period || "all", 40).toLowerCase();

  if (filters.date_from || filters.date_to) {
    return {
      date_from: filters.date_from || null,
      date_to: filters.date_to || null,
      period,
    };
  }

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  if (period === "today") {
    return {
      date_from: `${yyyy}-${mm}-${dd}`,
      date_to: `${yyyy}-${mm}-${dd}`,
      period,
    };
  }

  if (period === "month" || period === "current_month") {
    return {
      date_from: `${yyyy}-${mm}-01`,
      date_to: `${yyyy}-${mm}-${dd}`,
      period,
    };
  }

  if (period === "year" || period === "current_year") {
    return {
      date_from: `${yyyy}-01-01`,
      date_to: `${yyyy}-${mm}-${dd}`,
      period,
    };
  }

  return {
    date_from: null,
    date_to: null,
    period,
  };
}

/* -------------------------------------------------------------------------- */
/* Payment Queries                                                            */
/* -------------------------------------------------------------------------- */

async function getFinanceKpis(filters = {}) {
  if (!(await tableExists("tbl_finance_payments"))) {
    return {
      total_transactions: 0,
      total_revenue: 0,
      membership_total: 0,
      donation_total: 0,
      program_total: 0,
      pledge_total: 0,
      cash_total: 0,
      check_total: 0,
      zelle_total: 0,
      card_total: 0,
      ach_total: 0,
      today_revenue: 0,
      month_revenue: 0,
      year_revenue: 0,
    };
  }

  const columns = await getTableColumns("tbl_finance_payments");
  const amount = amountColumn(columns, "p");
  const category = categoryColumn(columns, "p");
  const method = methodColumn(columns, "p");
  const date = dateColumn(columns, "p");

  const params = paidParams(columns);
  const dateFilter = buildDateFilter(date, normalizePeriodFilters(filters), params);

  const [rows] = await pool.query(
    `
    SELECT
      COUNT(*) AS total_transactions,

      COALESCE(SUM(${amount}), 0) AS total_revenue,

      COALESCE(SUM(CASE
        WHEN ${category} IN ('membership', 'membership_dues', 'dues')
        THEN ${amount}
        ELSE 0
      END), 0) AS membership_total,

      COALESCE(SUM(CASE
        WHEN ${category} IN ('donation', 'giving', 'tithe')
        THEN ${amount}
        ELSE 0
      END), 0) AS donation_total,

      COALESCE(SUM(CASE
        WHEN ${category} IN ('school', 'trip', 'program')
        THEN ${amount}
        ELSE 0
      END), 0) AS program_total,

      COALESCE(SUM(CASE
        WHEN ${category} = 'pledge'
        THEN ${amount}
        ELSE 0
      END), 0) AS pledge_total,

      COALESCE(SUM(CASE
        WHEN ${method} = 'cash'
        THEN ${amount}
        ELSE 0
      END), 0) AS cash_total,

      COALESCE(SUM(CASE
        WHEN ${method} = 'check'
        THEN ${amount}
        ELSE 0
      END), 0) AS check_total,

      COALESCE(SUM(CASE
        WHEN ${method} = 'zelle'
        THEN ${amount}
        ELSE 0
      END), 0) AS zelle_total,

      COALESCE(SUM(CASE
        WHEN ${method} = 'card'
        THEN ${amount}
        ELSE 0
      END), 0) AS card_total,

      COALESCE(SUM(CASE
        WHEN ${method} IN ('ach', 'us_bank_account')
        THEN ${amount}
        ELSE 0
      END), 0) AS ach_total,

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

    membership_total: money(row.membership_total),
    donation_total: money(row.donation_total),
    program_total: money(row.program_total),
    pledge_total: money(row.pledge_total),

    cash_total: money(row.cash_total),
    check_total: money(row.check_total),
    zelle_total: money(row.zelle_total),
    card_total: money(row.card_total),
    ach_total: money(row.ach_total),

    today_revenue: money(row.today_revenue),
    month_revenue: money(row.month_revenue),
    year_revenue: money(row.year_revenue),
  };
}

async function getPaymentMethodSummary(filters = {}) {
  if (!(await tableExists("tbl_finance_payments"))) return [];

  const columns = await getTableColumns("tbl_finance_payments");
  const amount = amountColumn(columns, "p");
  const method = methodColumn(columns, "p");
  const provider = providerColumn(columns, "p");
  const date = dateColumn(columns, "p");

  const params = paidParams(columns);
  const dateFilter = buildDateFilter(date, normalizePeriodFilters(filters), params);

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
    ...row,
    transactions: numberValue(row.transactions),
    total_amount: money(row.total_amount),
  }));
}

async function getMonthlyRevenue(filters = {}) {
  if (!(await tableExists("tbl_finance_payments"))) return [];

  const columns = await getTableColumns("tbl_finance_payments");
  const amount = amountColumn(columns, "p");
  const date = dateColumn(columns, "p");

  const params = paidParams(columns);
  const dateFilter = buildDateFilter(date, normalizePeriodFilters(filters), params);

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
    ...row,
    transactions: numberValue(row.transactions),
    total_amount: money(row.total_amount),
  }));
}

async function getCategoryBreakdown(filters = {}) {
  if (!(await tableExists("tbl_finance_payments"))) return [];

  const columns = await getTableColumns("tbl_finance_payments");
  const amount = amountColumn(columns, "p");
  const category = categoryColumn(columns, "p");
  const date = dateColumn(columns, "p");

  const params = paidParams(columns);
  const dateFilter = buildDateFilter(date, normalizePeriodFilters(filters), params);

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
    ...row,
    transactions: numberValue(row.transactions),
    total_amount: money(row.total_amount),
  }));
}

async function getRecentPayments(limit = 10) {
  if (!(await tableExists("tbl_finance_payments"))) return [];

  const columns = await getTableColumns("tbl_finance_payments");
  const amount = amountColumn(columns, "p");
  const category = categoryColumn(columns, "p");
  const method = methodColumn(columns, "p");
  const provider = providerColumn(columns, "p");
  const date = dateColumn(columns, "p");

  const select = [
    "p.id",
    selectExisting(columns, "p", ["payment_number"], "NULL", "payment_number"),
    `${category} AS category`,
    selectExisting(columns, "p", ["sub_category"], "NULL", "sub_category"),
    selectExisting(
      columns,
      "p",
      ["full_name_snapshot", "full_name", "payer_name", "donor_name"],
      "NULL",
      "payer_name"
    ),
    `${amount} AS amount`,
    `${method} AS method`,
    `${provider} AS provider`,
    `${date} AS paid_at`,
    selectExisting(columns, "p", ["status"], "NULL", "status"),
    selectExisting(columns, "p", ["receipt_number"], "NULL", "receipt_number"),
    selectExisting(columns, "p", ["invoice_number"], "NULL", "invoice_number"),
  ];

  const params = paidParams(columns);

  const [rows] = await pool.query(
    `
    SELECT ${select.join(", ")}
    FROM tbl_finance_payments p
    WHERE ${paidWhere(columns, "p")}
    ORDER BY ${date} DESC, p.id DESC
    LIMIT ?
    `,
    [...params, Math.min(100, Math.max(1, Number(limit || 10)))]
  );

  return rows.map((row) => ({
    ...row,
    amount: money(row.amount),
  }));
}

/* -------------------------------------------------------------------------- */
/* Email / Invoices / Pledges                                                 */
/* -------------------------------------------------------------------------- */

async function getFailedReceiptCount() {
  if (!(await tableExists("tbl_finance_receipts"))) return 0;

  const columns = await getTableColumns("tbl_finance_receipts");

  if (!columns.has("email_status")) return 0;

  const [rows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM tbl_finance_receipts
    WHERE email_status = 'failed'
    `
  );

  return numberValue(rows[0]?.total);
}

async function getReceiptEmailSummary() {
  const summary = {
    sent: 0,
    failed: 0,
    queued: 0,
    pending: 0,
  };

  if (await tableExists("tbl_finance_receipt_email_tracking")) {
    const [rows] = await pool.query(
      `
      SELECT
        status,
        COUNT(*) AS total
      FROM tbl_finance_receipt_email_tracking
      GROUP BY status
      `
    );

    for (const row of rows) {
      const key = clean(row.status, 40).toLowerCase() || "pending";
      summary[key] = numberValue(row.total);
    }

    return summary;
  }

  if (!(await tableExists("tbl_finance_receipts"))) {
    return summary;
  }

  const columns = await getTableColumns("tbl_finance_receipts");

  if (!columns.has("email_status")) return summary;

  const [rows] = await pool.query(
    `
    SELECT
      email_status AS status,
      COUNT(*) AS total
    FROM tbl_finance_receipts
    GROUP BY email_status
    `
  );

  for (const row of rows) {
    const key = clean(row.status, 40).toLowerCase() || "pending";
    summary[key] = numberValue(row.total);
  }

  return summary;
}

async function getOverdueInvoiceSummary() {
  if (!(await tableExists("tbl_finance_invoices"))) {
    return {
      invoices: 0,
      total_balance_due: 0,
      open_invoices: 0,
      open_balance_due: 0,
    };
  }

  const columns = await getTableColumns("tbl_finance_invoices");

  const balance = columns.has("balance_due")
    ? "balance_due"
    : columns.has("total_amount") && columns.has("paid_amount")
      ? "(COALESCE(total_amount, 0) - COALESCE(paid_amount, 0))"
      : columns.has("amount")
        ? "amount"
        : "0";

  const statusWhere = columns.has("status")
    ? `AND status IN (${OPEN_INVOICE_STATUSES.map(() => "?").join(", ")})`
    : "";

  const dueWhere = columns.has("due_date")
    ? "AND due_date < CURDATE()"
    : "";

  const params = columns.has("status") ? [...OPEN_INVOICE_STATUSES] : [];

  const [rows] = await pool.query(
    `
    SELECT
      COUNT(*) AS open_invoices,
      COALESCE(SUM(${balance}), 0) AS open_balance_due,
      SUM(CASE WHEN 1 = 1 ${dueWhere} THEN 1 ELSE 0 END) AS invoices,
      COALESCE(SUM(CASE WHEN 1 = 1 ${dueWhere} THEN ${balance} ELSE 0 END), 0)
        AS total_balance_due
    FROM tbl_finance_invoices
    WHERE COALESCE(${balance}, 0) > 0
    ${statusWhere}
    `,
    params
  );

  const row = rows[0] || {};

  return {
    invoices: numberValue(row.invoices),
    total_balance_due: money(row.total_balance_due),
    open_invoices: numberValue(row.open_invoices),
    open_balance_due: money(row.open_balance_due),
  };
}

async function getPledgeSummary() {
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
        WHEN ${status} IN (${ACTIVE_PLEDGE_STATUSES.map(() => "?").join(", ")})
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
    `,
    [...ACTIVE_PLEDGE_STATUSES]
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

async function getMemberSummary() {
  if (!(await tableExists("tbl_members"))) {
    return {
      total_members: 0,
      active_members: 0,
      inactive_members: 0,
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
        WHEN ${status} IN ('active', 'paid', 'current')
        THEN 1
        ELSE 0
      END) AS active_members,

      SUM(CASE
        WHEN ${status} IN ('inactive', 'expired', 'suspended', 'pending_payment')
        THEN 1
        ELSE 0
      END) AS inactive_members,

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
    new_members_this_month: numberValue(row.new_members_this_month),
  };
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

async function getFinanceDashboardSummary(filters = {}) {
  const normalizedFilters = normalizePeriodFilters(filters);

  const [
    kpis,
    methods,
    monthly,
    categories,
    recent,
    failedReceipts,
    receiptEmails,
    overdueInvoices,
    pledges,
    members,
  ] = await Promise.all([
    getFinanceKpis(normalizedFilters),
    getPaymentMethodSummary(normalizedFilters),
    getMonthlyRevenue(normalizedFilters),
    getCategoryBreakdown(normalizedFilters),
    getRecentPayments(filters.limit || 10),
    getFailedReceiptCount(),
    getReceiptEmailSummary(),
    getOverdueInvoiceSummary(),
    getPledgeSummary(),
    getMemberSummary(),
  ]);

  return {
    period: normalizedFilters.period,
    date_from: normalizedFilters.date_from,
    date_to: normalizedFilters.date_to,

    kpis: {
      ...kpis,
      outstanding_invoices: overdueInvoices.open_balance_due,
      outstanding_pledges: pledges.outstanding_amount,
      receipt_emails_sent: receiptEmails.sent || receiptEmails.delivered || 0,
      receipt_emails_failed: receiptEmails.failed || failedReceipts || 0,
      receipt_emails_queued: receiptEmails.queued || receiptEmails.pending || 0,
    },

    methods,
    monthly,
    categories,
    recent,

    failed_receipts: failedReceipts,
    receipt_emails: receiptEmails,
    overdue_invoices: overdueInvoices,
    pledges,
    members,

    generated_at: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Exports                                                                    */
/* -------------------------------------------------------------------------- */

module.exports = {
  getFinanceKpis,
  getPaymentMethodSummary,
  getMonthlyRevenue,
  getCategoryBreakdown,
  getRecentPayments,
  getFailedReceiptCount,
  getReceiptEmailSummary,
  getOverdueInvoiceSummary,
  getPledgeSummary,
  getMemberSummary,
  getFinanceDashboardSummary,
};