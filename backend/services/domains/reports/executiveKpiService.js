// backend/services/domains/reports/executiveKpiService.js
"use strict";

const pool = require("../../../db");

const {
  findOne,
  findMany,
} = require("../../../utils/dbHelpers");

const {
  money,
  clean,
} = require("../../../utils/financeHelpers");

const {
  mysqlDate,
} = require("../../../utils/dateHelpers");

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const tableColumnCache = new Map();

async function tableColumns(table) {
  if (tableColumnCache.has(table)) {
    return tableColumnCache.get(table);
  }

  try {
    const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
    const set = new Set(rows.map((row) => row.Field));
    tableColumnCache.set(table, set);
    return set;
  } catch (_err) {
    const set = new Set();
    tableColumnCache.set(table, set);
    return set;
  }
}

async function hasColumn(table, column) {
  const columns = await tableColumns(table);
  return columns.has(column);
}

function number(value) {
  return Number(value || 0);
}

function moneyValue(value) {
  return money(Number(value || 0));
}

function firstDayOfMonth() {
  const now = new Date();
  return mysqlDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function firstDayOfYear() {
  const now = new Date();
  return mysqlDate(new Date(now.getFullYear(), 0, 1));
}

function normalizeFilters(filters = {}) {
  return {
    date_from:
      clean(
        filters.date_from ||
          filters.from ||
          filters.start_date ||
          "",
        20
      ) || null,

    date_to:
      clean(
        filters.date_to ||
          filters.to ||
          filters.end_date ||
          "",
        20
      ) || null,
  };
}

function addDateRange(where, params, fieldSql, filters = {}) {
  if (filters.date_from) {
    where.push(`DATE(${fieldSql}) >= DATE(?)`);
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push(`DATE(${fieldSql}) <= DATE(?)`);
    params.push(filters.date_to);
  }
}

async function paymentDateExpr(alias = "p") {
  return (await hasColumn("tbl_finance_payments", "paid_at"))
    ? `COALESCE(${alias}.paid_at, ${alias}.created_at)`
    : `${alias}.created_at`;
}

async function paymentAmountExpr(alias = "p") {
  return (await hasColumn("tbl_finance_payments", "amount"))
    ? `COALESCE(${alias}.amount, 0)`
    : "0";
}

async function paymentCategoryExpr(alias = "p") {
  return (await hasColumn("tbl_finance_payments", "category"))
    ? `LOWER(COALESCE(${alias}.category, ''))`
    : (await hasColumn("tbl_finance_payments", "payment_type"))
      ? `LOWER(COALESCE(${alias}.payment_type, ''))`
      : "''";
}

async function paymentMethodExpr(alias = "p") {
  return (await hasColumn("tbl_finance_payments", "method"))
    ? `LOWER(COALESCE(${alias}.method, ''))`
    : (await hasColumn("tbl_finance_payments", "payment_method"))
      ? `LOWER(COALESCE(${alias}.payment_method, ''))`
      : "''";
}

async function paymentStatusExpr(alias = "p") {
  if (
    (await hasColumn("tbl_finance_payments", "status")) &&
    (await hasColumn("tbl_finance_payments", "payment_status"))
  ) {
    return `LOWER(COALESCE(${alias}.status, ${alias}.payment_status, 'paid'))`;
  }

  if (await hasColumn("tbl_finance_payments", "status")) {
    return `LOWER(COALESCE(${alias}.status, 'paid'))`;
  }

  if (await hasColumn("tbl_finance_payments", "payment_status")) {
    return `LOWER(COALESCE(${alias}.payment_status, 'paid'))`;
  }

  return "'paid'";
}

function paidStatusSql(statusExpr) {
  return `${statusExpr} IN ('paid', 'completed', 'posted', 'succeeded', 'success')`;
}

/* -------------------------------------------------------------------------- */
/* Revenue KPIs                                                               */
/* -------------------------------------------------------------------------- */

async function getRevenueKpis(filters = {}) {
  const f = normalizeFilters(filters);
  const dateExpr = await paymentDateExpr("p");
  const amountExpr = await paymentAmountExpr("p");
  const categoryExpr = await paymentCategoryExpr("p");
  const methodExpr = await paymentMethodExpr("p");
  const statusExpr = await paymentStatusExpr("p");

  const where = [
    paidStatusSql(statusExpr),
  ];

  const params = [];
  addDateRange(where, params, dateExpr, f);

  const whereSql = where.join(" AND ");

  const row = await findOne(
    pool,
    `
    SELECT
      COUNT(*) AS period_transactions,
      COALESCE(SUM(${amountExpr}), 0) AS period_revenue,

      COALESCE(SUM(CASE WHEN DATE(${dateExpr}) = CURDATE() THEN ${amountExpr} ELSE 0 END), 0) AS today_revenue,
      COALESCE(SUM(CASE WHEN DATE(${dateExpr}) >= DATE(?) THEN ${amountExpr} ELSE 0 END), 0) AS month_revenue,
      COALESCE(SUM(CASE WHEN DATE(${dateExpr}) >= DATE(?) THEN ${amountExpr} ELSE 0 END), 0) AS year_revenue,

      COALESCE(SUM(CASE WHEN ${categoryExpr} = 'membership' THEN ${amountExpr} ELSE 0 END), 0) AS membership_revenue,
      COALESCE(SUM(CASE WHEN ${categoryExpr} = 'donation' THEN ${amountExpr} ELSE 0 END), 0) AS donation_revenue,
      COALESCE(SUM(CASE WHEN ${categoryExpr} IN ('school', 'trip', 'kids') THEN ${amountExpr} ELSE 0 END), 0) AS program_revenue,
      COALESCE(SUM(CASE WHEN ${categoryExpr} IN ('school', 'kids') THEN ${amountExpr} ELSE 0 END), 0) AS school_revenue,
      COALESCE(SUM(CASE WHEN ${categoryExpr} = 'trip' THEN ${amountExpr} ELSE 0 END), 0) AS trip_revenue,
      COALESCE(SUM(CASE WHEN ${categoryExpr} = 'pledge' THEN ${amountExpr} ELSE 0 END), 0) AS pledge_revenue,

      COALESCE(SUM(CASE WHEN ${methodExpr} = 'cash' THEN ${amountExpr} ELSE 0 END), 0) AS cash_revenue,
      COALESCE(SUM(CASE WHEN ${methodExpr} = 'check' THEN ${amountExpr} ELSE 0 END), 0) AS check_revenue,
      COALESCE(SUM(CASE WHEN ${methodExpr} = 'zelle' THEN ${amountExpr} ELSE 0 END), 0) AS zelle_revenue,
      COALESCE(SUM(CASE WHEN ${methodExpr} = 'card' THEN ${amountExpr} ELSE 0 END), 0) AS card_revenue,
      COALESCE(SUM(CASE WHEN ${methodExpr} = 'ach' THEN ${amountExpr} ELSE 0 END), 0) AS ach_revenue

    FROM tbl_finance_payments p
    WHERE ${whereSql}
    `,
    [
      firstDayOfMonth(),
      firstDayOfYear(),
      ...params,
    ]
  );

  const methodRows = await findMany(
    pool,
    `
    SELECT
      ${methodExpr} AS method,
      COUNT(*) AS transactions,
      COALESCE(SUM(${amountExpr}), 0) AS total_amount
    FROM tbl_finance_payments p
    WHERE ${whereSql}
    GROUP BY ${methodExpr}
    ORDER BY total_amount DESC
    `,
    params
  );

  const categoryRows = await findMany(
    pool,
    `
    SELECT
      ${categoryExpr} AS category,
      COUNT(*) AS transactions,
      COALESCE(SUM(${amountExpr}), 0) AS total_amount
    FROM tbl_finance_payments p
    WHERE ${whereSql}
    GROUP BY ${categoryExpr}
    ORDER BY total_amount DESC
    `,
    params
  );

  return {
    period_transactions: number(row?.period_transactions),
    period_revenue: moneyValue(row?.period_revenue),

    today_revenue: moneyValue(row?.today_revenue),
    month_revenue: moneyValue(row?.month_revenue),
    year_revenue: moneyValue(row?.year_revenue),

    membership_revenue: moneyValue(row?.membership_revenue),
    donation_revenue: moneyValue(row?.donation_revenue),
    program_revenue: moneyValue(row?.program_revenue),
    school_revenue: moneyValue(row?.school_revenue),
    trip_revenue: moneyValue(row?.trip_revenue),
    pledge_revenue: moneyValue(row?.pledge_revenue),

    cash_revenue: moneyValue(row?.cash_revenue),
    check_revenue: moneyValue(row?.check_revenue),
    zelle_revenue: moneyValue(row?.zelle_revenue),
    card_revenue: moneyValue(row?.card_revenue),
    ach_revenue: moneyValue(row?.ach_revenue),

    by_method: methodRows.map((item) => ({
      method: item.method || "unknown",
      transactions: number(item.transactions),
      total_amount: moneyValue(item.total_amount),
    })),

    by_category: categoryRows.map((item) => ({
      category: item.category || "unknown",
      transactions: number(item.transactions),
      total_amount: moneyValue(item.total_amount),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Members                                                                    */
/* -------------------------------------------------------------------------- */

async function getMemberKpis(filters = {}) {
  const f = normalizeFilters(filters);

  const row = await findOne(
    pool,
    `
    SELECT
      COUNT(*) AS total_members,
      SUM(CASE WHEN LOWER(COALESCE(m.membership_status, '')) = 'active' THEN 1 ELSE 0 END) AS active_members,
      SUM(CASE WHEN LOWER(COALESCE(m.membership_status, '')) IN ('inactive', 'expired', 'suspended') THEN 1 ELSE 0 END) AS inactive_members,
      SUM(CASE WHEN m.created_at IS NOT NULL AND DATE(m.created_at) = CURDATE() THEN 1 ELSE 0 END) AS new_today,
      SUM(CASE WHEN m.created_at IS NOT NULL AND DATE(m.created_at) >= DATE(?) THEN 1 ELSE 0 END) AS new_this_month
    FROM tbl_members m
    `,
    [firstDayOfMonth()]
  );

  const dateExpr = await paymentDateExpr("p");
  const statusExpr = await paymentStatusExpr("p");
  const categoryExpr = await paymentCategoryExpr("p");

  const subWhere = [
    "p.member_id = m.id",
    paidStatusSql(statusExpr),
    `${categoryExpr} = 'membership'`,
  ];

  const subParams = [];

  if (f.date_from || f.date_to) {
    if (f.date_from) {
      subWhere.push(`DATE(${dateExpr}) >= DATE(?)`);
      subParams.push(f.date_from);
    }

    if (f.date_to) {
      subWhere.push(`DATE(${dateExpr}) <= DATE(?)`);
      subParams.push(f.date_to);
    }
  } else {
    subWhere.push(`DATE(${dateExpr}) >= DATE(?)`);
    subParams.push(firstDayOfMonth());
  }

  const unpaid = await findOne(
    pool,
    `
    SELECT COUNT(*) AS unpaid_members
    FROM tbl_members m
    WHERE LOWER(COALESCE(m.membership_status, '')) = 'active'
      AND NOT EXISTS (
        SELECT 1
        FROM tbl_finance_payments p
        WHERE ${subWhere.join(" AND ")}
      )
    `,
    subParams
  );

  return {
    total_members: number(row?.total_members),
    active_members: number(row?.active_members),
    inactive_members: number(row?.inactive_members),
    new_members_today: number(row?.new_today),
    new_members_this_month: number(row?.new_this_month),
    unpaid_members: number(unpaid?.unpaid_members),
  };
}

/* -------------------------------------------------------------------------- */
/* Invoices                                                                   */
/* -------------------------------------------------------------------------- */

async function getInvoiceKpis() {
  const totalExpr = (await hasColumn("tbl_finance_invoices", "total_amount"))
    ? "COALESCE(i.total_amount, 0)"
    : (await hasColumn("tbl_finance_invoices", "amount"))
      ? "COALESCE(i.amount, 0)"
      : "0";

  const rawPaidExpr = (await hasColumn("tbl_finance_invoices", "paid_amount"))
    ? "COALESCE(i.paid_amount, 0)"
    : "0";

  const paidExpr = `LEAST(GREATEST(${rawPaidExpr}, 0), GREATEST(${totalExpr}, 0))`;
  const balanceExpr = `GREATEST(${totalExpr} - ${paidExpr}, 0)`;

  const statusExpr = (await hasColumn("tbl_finance_invoices", "status"))
    ? "LOWER(COALESCE(i.status, 'open'))"
    : (await hasColumn("tbl_finance_invoices", "invoice_status"))
      ? "LOWER(COALESCE(i.invoice_status, 'open'))"
      : "'open'";

  const dueDateExpr = (await hasColumn("tbl_finance_invoices", "due_date"))
    ? "i.due_date"
    : (await hasColumn("tbl_finance_invoices", "invoice_due_date"))
      ? "i.invoice_due_date"
      : "i.created_at";

  const openStatuses = "('open', 'pending', 'partial', 'overdue', 'draft')";

  const row = await findOne(
    pool,
    `
    SELECT
      COUNT(*) AS total_invoices,

      SUM(CASE WHEN ${statusExpr} IN ${openStatuses} THEN 1 ELSE 0 END) AS outstanding_invoices,

      COALESCE(SUM(
        CASE
          WHEN ${statusExpr} IN ${openStatuses}
          THEN ${balanceExpr}
          ELSE 0
        END
      ), 0) AS outstanding_invoice_amount,

      SUM(CASE WHEN ${statusExpr} = 'paid' OR ${balanceExpr} = 0 THEN 1 ELSE 0 END) AS paid_invoices,

      SUM(
        CASE
          WHEN ${statusExpr} IN ${openStatuses}
            AND ${dueDateExpr} IS NOT NULL
            AND DATE(${dueDateExpr}) < CURDATE()
          THEN 1
          ELSE 0
        END
      ) AS overdue_invoices,

      COALESCE(SUM(
        CASE
          WHEN ${statusExpr} IN ${openStatuses}
            AND ${dueDateExpr} IS NOT NULL
            AND DATE(${dueDateExpr}) < CURDATE()
          THEN ${balanceExpr}
          ELSE 0
        END
      ), 0) AS overdue_invoice_amount

    FROM tbl_finance_invoices i
    `
  );

  return {
    total_invoices: number(row?.total_invoices),
    paid_invoices: number(row?.paid_invoices),
    outstanding_invoices: number(row?.outstanding_invoices),
    outstanding_invoice_amount: moneyValue(row?.outstanding_invoice_amount),
    overdue_invoices: number(row?.overdue_invoices),
    overdue_invoice_amount: moneyValue(row?.overdue_invoice_amount),
  };
}

/* -------------------------------------------------------------------------- */
/* Pledges                                                                    */
/* -------------------------------------------------------------------------- */

async function getPledgeKpis() {
  const row = await findOne(
    pool,
    `
    SELECT
      COUNT(*) AS total_pledges,

      SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('active', 'partial', 'overdue', 'pending') THEN 1 ELSE 0 END) AS outstanding_pledges,

      SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('paid', 'completed', 'closed') THEN 1 ELSE 0 END) AS completed_pledges,

      COALESCE(SUM(COALESCE(pledged_amount, 0)), 0) AS pledged_amount,
      COALESCE(SUM(COALESCE(paid_amount, 0)), 0) AS paid_amount,
      COALESCE(SUM(GREATEST(COALESCE(pledged_amount, 0) - COALESCE(paid_amount, 0), 0)), 0) AS outstanding_amount,

      SUM(
        CASE
          WHEN LOWER(COALESCE(status, '')) IN ('active', 'partial', 'overdue', 'pending')
            AND due_date IS NOT NULL
            AND DATE(due_date) < CURDATE()
          THEN 1
          ELSE 0
        END
      ) AS overdue_pledges

    FROM tbl_finance_pledges
    `
  );

  return {
    total_pledges: number(row?.total_pledges),
    outstanding_pledges: number(row?.outstanding_pledges),
    completed_pledges: number(row?.completed_pledges),
    overdue_pledges: number(row?.overdue_pledges),
    pledged_amount: moneyValue(row?.pledged_amount),
    paid_amount: moneyValue(row?.paid_amount),
    outstanding_amount: moneyValue(row?.outstanding_amount),
  };
}

/* -------------------------------------------------------------------------- */
/* Program Registrations                                                      */
/* -------------------------------------------------------------------------- */

async function getProgramKpis(filters = {}) {
  const f = normalizeFilters(filters);
  const where = ["1=1"];
  const params = [];

  if (await hasColumn("tbl_event_program_registrations", "created_at")) {
    addDateRange(where, params, "r.created_at", f);
  }

  const categoryExpr = (await hasColumn("tbl_event_program_registrations", "category"))
    ? "LOWER(COALESCE(r.category, ''))"
    : "''";

  const amountExpr = (await hasColumn("tbl_event_program_registrations", "amount"))
    ? "COALESCE(r.amount, 0)"
    : (await hasColumn("tbl_event_program_registrations", "total_amount"))
      ? "COALESCE(r.total_amount, 0)"
      : "0";

  const row = await findOne(
    pool,
    `
    SELECT
      COUNT(*) AS total_registrations,

      SUM(CASE WHEN ${categoryExpr} IN ('school', 'kids', 'school_program') THEN 1 ELSE 0 END) AS school_registrations,

      SUM(CASE WHEN ${categoryExpr} IN ('trip', 'travel', 'trip_program') THEN 1 ELSE 0 END) AS trip_registrations,

      COALESCE(SUM(CASE WHEN ${categoryExpr} IN ('school', 'kids', 'school_program') THEN ${amountExpr} ELSE 0 END), 0) AS school_registration_amount,

      COALESCE(SUM(CASE WHEN ${categoryExpr} IN ('trip', 'travel', 'trip_program') THEN ${amountExpr} ELSE 0 END), 0) AS trip_registration_amount

    FROM tbl_event_program_registrations r
    WHERE ${where.join(" AND ")}
    `,
    params
  );

  let participantCount = 0;

  try {
    const participantRow = await findOne(
      pool,
      `
      SELECT COUNT(*) AS total
      FROM tbl_event_program_registration_participants
      `
    );

    participantCount = number(participantRow?.total);
  } catch (_err) {
    participantCount = 0;
  }

  return {
    total_registrations: number(row?.total_registrations),
    school_registrations: number(row?.school_registrations),
    trip_registrations: number(row?.trip_registrations),
    school_registration_amount: moneyValue(row?.school_registration_amount),
    trip_registration_amount: moneyValue(row?.trip_registration_amount),
    participant_count: participantCount,
  };
}

/* -------------------------------------------------------------------------- */
/* Email KPIs                                                                 */
/* -------------------------------------------------------------------------- */

async function getEmailTrackingKpis() {
  async function statsFor(table) {
    const columns = await tableColumns(table);

    if (!columns.size) {
      return {
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0,
      };
    }

    const statusColumn =
      columns.has("status")
        ? "status"
        : columns.has("email_status")
          ? "email_status"
          : null;

    if (!statusColumn) {
      return {
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0,
      };
    }

    const row = await findOne(
      pool,
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN LOWER(COALESCE(${statusColumn}, '')) IN ('sent', 'success', 'delivered') THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN LOWER(COALESCE(${statusColumn}, '')) IN ('failed', 'error', 'bounced') THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN LOWER(COALESCE(${statusColumn}, '')) IN ('pending', 'queued', '') THEN 1 ELSE 0 END) AS pending
      FROM ${table}
      `
    );

    return {
      total: number(row?.total),
      sent: number(row?.sent),
      failed: number(row?.failed),
      pending: number(row?.pending),
    };
  }

  const [receiptEmails, invoiceEmails] = await Promise.all([
    statsFor("tbl_finance_receipt_email_tracking"),
    statsFor("tbl_finance_invoice_email_tracking"),
  ]);

  return {
    receipt_emails: receiptEmails,
    invoice_emails: invoiceEmails,

    receipt_emails_sent: receiptEmails.sent,
    receipt_emails_failed: receiptEmails.failed,

    invoice_emails_sent: invoiceEmails.sent,
    invoice_emails_failed: invoiceEmails.failed,
  };
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

async function getExecutiveKpis(filters = {}) {
  const [
    revenue,
    members,
    invoices,
    pledges,
    programs,
    emails,
  ] = await Promise.all([
    getRevenueKpis(filters),
    getMemberKpis(filters),
    getInvoiceKpis(filters),
    getPledgeKpis(filters),
    getProgramKpis(filters),
    getEmailTrackingKpis(),
  ]);

  return {
    generated_at: new Date().toISOString(),
    filters: normalizeFilters(filters),

    revenue,
    members,
    invoices,
    pledges,
    programs,
    emails,

    cards: {
      today_revenue: revenue.today_revenue,
      month_revenue: revenue.month_revenue,
      year_revenue: revenue.year_revenue,

      membership_revenue: revenue.membership_revenue,
      donation_revenue: revenue.donation_revenue,
      program_revenue: revenue.program_revenue,
      pledge_revenue: revenue.pledge_revenue,

      outstanding_invoices: invoices.outstanding_invoices,
      outstanding_invoice_amount: invoices.outstanding_invoice_amount,

      outstanding_pledges: pledges.outstanding_pledges,
      outstanding_pledge_amount: pledges.outstanding_amount,

      active_members: members.active_members,
      inactive_members: members.inactive_members,
      unpaid_members: members.unpaid_members,

      receipt_emails_sent: emails.receipt_emails_sent,
      receipt_emails_failed: emails.receipt_emails_failed,
      invoice_emails_sent: emails.invoice_emails_sent,
      invoice_emails_failed: emails.invoice_emails_failed,
    },
  };
}

function flattenForExport(kpis = {}) {
  const rows = [];

  function add(section, metric, value) {
    rows.push({
      section,
      metric,
      value,
    });
  }

  Object.entries(kpis.cards || {}).forEach(([key, value]) => {
    add("Executive Cards", key, value);
  });

  Object.entries(kpis.revenue || {}).forEach(([key, value]) => {
    if (!Array.isArray(value)) add("Revenue", key, value);
  });

  Object.entries(kpis.members || {}).forEach(([key, value]) => {
    add("Members", key, value);
  });

  Object.entries(kpis.invoices || {}).forEach(([key, value]) => {
    add("Invoices", key, value);
  });

  Object.entries(kpis.pledges || {}).forEach(([key, value]) => {
    add("Pledges", key, value);
  });

  Object.entries(kpis.programs || {}).forEach(([key, value]) => {
    add("Programs", key, value);
  });

  Object.entries(kpis.emails || {}).forEach(([key, value]) => {
    if (typeof value !== "object") add("Emails", key, value);
  });

  return rows;
}

module.exports = {
  normalizeFilters,

  getRevenueKpis,
  getMemberKpis,
  getInvoiceKpis,
  getPledgeKpis,
  getProgramKpis,
  getEmailTrackingKpis,

  getExecutiveKpis,
  flattenForExport,
};