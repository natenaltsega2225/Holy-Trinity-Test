// backend/routes/financeReports.js
"use strict";

const express = require("express");
const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();

const FINANCE_ROLES = ["finance", "admin", "super_admin", "reconciliation"];
const columnCache = new Map();

function sqlId(name) {
  return `\`${String(name).replaceAll("`", "``")}\``;
}

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return Number(number(value).toFixed(2));
}

function intValue(value, fallback = 25, min = 1, max = 500) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

async function tableColumns(table) {
  if (columnCache.has(table)) return columnCache.get(table);

  try {
    const [rows] = await pool.query(`SHOW COLUMNS FROM ${sqlId(table)}`);
    const columns = new Set(rows.map((row) => row.Field));
    columnCache.set(table, columns);
    return columns;
  } catch (_err) {
    const columns = new Set();
    columnCache.set(table, columns);
    return columns;
  }
}

async function hasTable(table) {
  const columns = await tableColumns(table);
  return columns.size > 0;
}

function firstColumn(columns, names) {
  return names.find((name) => columns.has(name)) || null;
}

function col(columns, alias, names, fallback = "NULL") {
  const column = firstColumn(columns, names);
  return column ? `${alias}.${sqlId(column)}` : fallback;
}

function numExpr(columns, alias, names, fallback = "0") {
  return `COALESCE(${col(columns, alias, names, "NULL")}, ${fallback})`;
}

function textExpr(columns, alias, names, fallback = "''") {
  return `LOWER(COALESCE(${col(columns, alias, names, "NULL")}, ${fallback}))`;
}

function rawTextExpr(columns, alias, names, fallback = "'--'") {
  return `COALESCE(${col(columns, alias, names, "NULL")}, ${fallback})`;
}

function dateColumn(columns, preferred = []) {
  return firstColumn(columns, [
    ...preferred,
    "paid_at",
    "payment_date",
    "created_at",
    "invoice_date",
    "issued_at",
    "date",
  ]);
}

function appendDateWhere(where, params, columns, alias, filters, preferred = []) {
  const column = dateColumn(columns, preferred);
  if (!column) return;

  if (filters.from) {
    where.push(`DATE(${alias}.${sqlId(column)}) >= ?`);
    params.push(filters.from);
  }

  if (filters.to) {
    where.push(`DATE(${alias}.${sqlId(column)}) <= ?`);
    params.push(filters.to);
  }
}

function statusClause(columns, alias, names, paid = true) {
  const statusColumn = firstColumn(columns, names);
  if (!statusColumn) return "1=1";

  const expr = `LOWER(COALESCE(${alias}.${sqlId(statusColumn)}, '${paid ? "paid" : "open"}'))`;

  if (paid) {
    return `
      (
        ${expr} IN ('paid','posted','completed','complete','succeeded','success','captured','settled')
        OR (
          ${expr} NOT LIKE '%pending%'
          AND ${expr} NOT IN ('failed','failure','cancelled','canceled','void','voided','refunded','declined','expired')
        )
      )
    `;
  }

  return `${expr} NOT IN ('paid','posted','completed','complete','succeeded','success','captured','settled','void','voided','cancelled','canceled','refunded')`;
}

function categoryCase(categoryExpr) {
  return `
    CASE
      WHEN ${categoryExpr} LIKE '%member%'
        OR ${categoryExpr} LIKE '%dues%'
        OR ${categoryExpr} LIKE '%membership%'
        OR ${categoryExpr} LIKE '%አባል%'
      THEN 'membership'

      WHEN ${categoryExpr} LIKE '%school%'
        OR ${categoryExpr} LIKE '%kids%'
        OR ${categoryExpr} LIKE '%student%'
        OR ${categoryExpr} LIKE '%ትምህርት%'
      THEN 'school'

      WHEN ${categoryExpr} LIKE '%trip%'
        OR ${categoryExpr} LIKE '%travel%'
        OR ${categoryExpr} LIKE '%ጉዞ%'
      THEN 'trip'

      WHEN ${categoryExpr} LIKE '%pledge%'
        OR ${categoryExpr} LIKE '%ቃል%'
      THEN 'pledge'

      WHEN ${categoryExpr} LIKE '%donation%'
        OR ${categoryExpr} LIKE '%tithe%'
        OR ${categoryExpr} LIKE '%fund%'
        OR ${categoryExpr} LIKE '%plate%'
        OR ${categoryExpr} LIKE '%candle%'
        OR ${categoryExpr} LIKE '%baptism%'
        OR ${categoryExpr} LIKE '%wedding%'
        OR ${categoryExpr} LIKE '%memorial%'
        OR ${categoryExpr} LIKE '%charity%'
        OR ${categoryExpr} LIKE '%auction%'
        OR ${categoryExpr} LIKE '%መባ%'
        OR ${categoryExpr} LIKE '%ሻማ%'
        OR ${categoryExpr} LIKE '%ስጦታ%'
        OR ${categoryExpr} LIKE '%አስራት%'
        OR ${categoryExpr} LIKE '%ክርስትና%'
        OR ${categoryExpr} LIKE '%ጋብቻ%'
        OR ${categoryExpr} LIKE '%ፍታት%'
        OR ${categoryExpr} LIKE '%ሌላ%'
      THEN 'donation'

      ELSE 'other'
    END
  `;
}

function normalizeMethodCase(methodExpr, providerExpr) {
  return `
    CASE
      WHEN ${methodExpr} LIKE '%cash%' THEN 'cash'
      WHEN ${methodExpr} LIKE '%check%' THEN 'check'
      WHEN ${methodExpr} LIKE '%zelle%' THEN 'zelle'
      WHEN ${methodExpr} LIKE '%ach%'
        OR ${methodExpr} LIKE '%bank%'
        OR ${methodExpr} LIKE '%us_bank%'
      THEN 'ach'
      WHEN ${methodExpr} LIKE '%card%'
        OR ${methodExpr} LIKE '%visa%'
        OR ${methodExpr} LIKE '%master%'
        OR ${providerExpr} LIKE '%stripe%'
      THEN 'card'
      ELSE COALESCE(NULLIF(${methodExpr}, ''), 'unknown')
    END
  `;
}

async function getMemberReport() {
  const columns = await tableColumns("tbl_members");
  if (!columns.size) {
    return {
      total_members: 0,
      active_members: 0,
      dependent_count: 0,
      total_members_and_dependents: 0,
      rows: [],
    };
  }

  const statusColumn = firstColumn(columns, [
    "membership_status",
    "status",
    "account_status",
    "active",
    "is_active",
  ]);

  const activeExpr = statusColumn
    ? `
      CASE
        WHEN LOWER(COALESCE(m.${sqlId(statusColumn)}, 'active')) IN ('active','paid','current','1','yes','true')
        THEN 1 ELSE 0
      END
    `
    : "1";

  const [[summary]] = await pool.query(`
    SELECT
      COUNT(*) AS total_members,
      COALESCE(SUM(${activeExpr}), 0) AS active_members
    FROM tbl_members m
  `);

  const dependentTables = [
    "tbl_member_dependents",
    "tbl_dependents",
    "tbl_member_family",
    "tbl_family_members",
  ];

  let dependentCount = 0;

  for (const table of dependentTables) {
    if (!(await hasTable(table))) continue;

    const [[row]] = await pool.query(`SELECT COUNT(*) AS total FROM ${sqlId(table)}`);
    dependentCount = number(row?.total);
    break;
  }

  const [rows] = await pool.query(
    `
    SELECT
      m.id,
      ${rawTextExpr(columns, "m", ["member_no", "member_number"], "CONCAT('M-', m.id)")} AS member_no,
      ${rawTextExpr(columns, "m", ["full_name", "name"], "'--'")} AS full_name,
      ${rawTextExpr(columns, "m", ["email"], "'--'")} AS email,
      ${statusColumn ? `COALESCE(m.${sqlId(statusColumn)}, 'active')` : "'active'"} AS status
    FROM tbl_members m
    ORDER BY m.id DESC
    LIMIT 25
    `
  );

  return {
    total_members: number(summary?.total_members),
    active_members: number(summary?.active_members),
    dependent_count: dependentCount,
    total_members_and_dependents: number(summary?.total_members) + dependentCount,
    rows,
  };
}

async function getPaymentsReport(filters) {
  const columns = await tableColumns("tbl_finance_payments");

  if (!columns.size) {
    return {
      total: 0,
      membership: 0,
      donations: 0,
      school: 0,
      trip: 0,
      pledge: 0,
      manual: 0,
      online: 0,
      by_category: [],
      by_method: [],
      rows: [],
    };
  }

  const where = [statusClause(columns, "p", ["status", "payment_status", "transaction_status"], true)];
  const params = [];
  appendDateWhere(where, params, columns, "p", filters, ["paid_at", "payment_date", "created_at"]);

  const amountExpr = numExpr(columns, "p", ["amount", "total_amount", "paid_amount"], "0");
  const categoryExpr = textExpr(
    columns,
    "p",
    ["category", "donation_category", "payment_type", "sub_category", "type"],
    "''"
  );
  const methodExpr = textExpr(columns, "p", ["method", "payment_method"], "''");
  const providerExpr = textExpr(columns, "p", ["provider", "payment_provider"], "''");
  const payerExpr = rawTextExpr(
    columns,
    "p",
    ["full_name_snapshot", "payer_name", "donor_name", "full_name"],
    "'--'"
  );
  const emailExpr = rawTextExpr(
    columns,
    "p",
    ["email_snapshot", "payer_email", "donor_email", "email"],
    "'--'"
  );
  const paymentNoExpr = rawTextExpr(
    columns,
    "p",
    ["payment_number", "payment_no", "reference_no"],
    "CONCAT('PAY-', p.id)"
  );
  const dateExpr = col(columns, "p", ["paid_at", "payment_date", "created_at"], "NULL");
  const categorySql = categoryCase(categoryExpr);
  const methodSql = normalizeMethodCase(methodExpr, providerExpr);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const baseParams = [...params];
  const limit = intValue(filters.limit, 25, 1, 100);

  const baseSql = `
    SELECT
      p.id,
      ${paymentNoExpr} AS payment_number,
      ${payerExpr} AS payer_name,
      ${emailExpr} AS email,
      ${amountExpr} AS amount,
      ${categorySql} AS category_norm,
      ${methodSql} AS method_norm,
      ${dateExpr} AS paid_at
    FROM tbl_finance_payments p
    ${whereSql}
  `;

  const [[summary]] = await pool.query(
    `
    SELECT
      COALESCE(SUM(amount), 0) AS total_revenue,
      COALESCE(SUM(CASE WHEN category_norm = 'membership' THEN amount ELSE 0 END), 0) AS membership_revenue,
      COALESCE(SUM(CASE WHEN category_norm = 'donation' THEN amount ELSE 0 END), 0) AS donation_revenue,
      COALESCE(SUM(CASE WHEN category_norm = 'school' THEN amount ELSE 0 END), 0) AS school_revenue,
      COALESCE(SUM(CASE WHEN category_norm = 'trip' THEN amount ELSE 0 END), 0) AS trip_revenue,
      COALESCE(SUM(CASE WHEN category_norm = 'pledge' THEN amount ELSE 0 END), 0) AS pledge_revenue,
      COALESCE(SUM(CASE WHEN method_norm IN ('cash','check','zelle') THEN amount ELSE 0 END), 0) AS manual_revenue,
      COALESCE(SUM(CASE WHEN method_norm IN ('card','ach','stripe','us_bank_account') THEN amount ELSE 0 END), 0) AS online_revenue
    FROM (${baseSql}) payment_report
    `,
    baseParams
  );

  const [categoryRows] = await pool.query(
    `
    SELECT category_norm AS category, COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count
    FROM (${baseSql}) payment_report
    GROUP BY category_norm
    ORDER BY amount DESC
    `,
    baseParams
  );

  const [methodRows] = await pool.query(
    `
    SELECT method_norm AS method, COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count
    FROM (${baseSql}) payment_report
    GROUP BY method_norm
    ORDER BY amount DESC
    `,
    baseParams
  );

  const [rows] = await pool.query(
    `
    SELECT *
    FROM (${baseSql}) payment_report
    ORDER BY paid_at DESC, id DESC
    LIMIT ?
    `,
    [...baseParams, limit]
  );

  return {
    total: money(summary?.total_revenue),
    membership: money(summary?.membership_revenue),
    donations: money(summary?.donation_revenue),
    school: money(summary?.school_revenue),
    trip: money(summary?.trip_revenue),
    pledge: money(summary?.pledge_revenue),
    manual: money(summary?.manual_revenue),
    online: money(summary?.online_revenue),
    by_category: categoryRows.map((row) => ({
      category: row.category,
      amount: money(row.amount),
      count: number(row.count),
    })),
    by_method: methodRows.map((row) => ({
      method: row.method,
      amount: money(row.amount),
      count: number(row.count),
    })),
    rows,
  };
}

async function getPledgeReport(filters) {
  const columns = await tableColumns("tbl_finance_pledges");

  if (!columns.size) {
    return { count: 0, pledged: 0, paid: 0, outstanding: 0, rows: [] };
  }

  const where = [];
  const params = [];
  appendDateWhere(where, params, columns, "pl", filters, ["created_at", "due_date"]);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const pledgedExpr = numExpr(columns, "pl", ["pledged_amount", "total_amount", "amount"], "0");
  const paidExpr = numExpr(columns, "pl", ["paid_amount", "amount_paid", "collected_amount"], "0");
  const outstandingExpr = numExpr(
    columns,
    "pl",
    ["remaining_balance", "remaining_amount", "outstanding_amount", "balance_due"],
    `GREATEST(${pledgedExpr} - ${paidExpr}, 0)`
  );
  const limit = intValue(filters.limit, 25, 1, 100);

  const [[summary]] = await pool.query(
    `
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(${pledgedExpr}), 0) AS pledged,
      COALESCE(SUM(${paidExpr}), 0) AS paid,
      COALESCE(SUM(${outstandingExpr}), 0) AS outstanding
    FROM tbl_finance_pledges pl
    ${whereSql}
    `,
    params
  );

  const [rows] = await pool.query(
    `
    SELECT
      pl.id,
      ${rawTextExpr(columns, "pl", ["pledge_number", "pledge_no"], "CONCAT('PLG-', pl.id)")} AS pledge_number,
      ${rawTextExpr(columns, "pl", ["full_name_snapshot", "donor_name", "guest_name", "name"], "'--'")} AS donor_name,
      ${rawTextExpr(columns, "pl", ["email_snapshot", "email", "donor_email"], "'--'")} AS email,
      ${rawTextExpr(columns, "pl", ["campaign_name", "title"], "'General Pledge'")} AS campaign_name,
      ${pledgedExpr} AS pledged_amount,
      ${paidExpr} AS paid_amount,
      ${outstandingExpr} AS outstanding_amount,
      ${rawTextExpr(columns, "pl", ["status"], "'pending'")} AS status,
      ${col(columns, "pl", ["due_date"], "NULL")} AS due_date,
      ${col(columns, "pl", ["created_at"], "NULL")} AS created_at
    FROM tbl_finance_pledges pl
    ${whereSql}
    ORDER BY ${col(columns, "pl", ["created_at"], "pl.id")} DESC, pl.id DESC
    LIMIT ?
    `,
    [...params, limit]
  );

  return {
    count: number(summary?.count),
    pledged: money(summary?.pledged),
    paid: money(summary?.paid),
    outstanding: money(summary?.outstanding),
    rows,
  };
}

async function getInvoiceReport(filters) {
  const columns = await tableColumns("tbl_finance_invoices");

  if (!columns.size) {
    return {
      count: 0,
      open_count: 0,
      total_amount: 0,
      paid_amount: 0,
      outstanding: 0,
      rows: [],
    };
  }

  const where = [];
  const params = [];
  appendDateWhere(where, params, columns, "i", filters, ["invoice_date", "issued_at", "created_at"]);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const statusExpr = textExpr(columns, "i", ["status", "invoice_status"], "'open'");
  const totalExpr = numExpr(columns, "i", ["total_amount", "amount", "invoice_amount"], "0");
  const paidExpr = numExpr(columns, "i", ["paid_amount", "amount_paid", "collected_amount"], "0");
  const balanceExpr = numExpr(
    columns,
    "i",
    ["balance_due", "remaining_amount", "outstanding_amount"],
    `GREATEST(${totalExpr} - ${paidExpr}, 0)`
  );

  const [[summary]] = await pool.query(
    `
    SELECT
      COUNT(*) AS count,
      SUM(CASE WHEN ${statusExpr} NOT IN ('paid','void','voided','cancelled','canceled','refunded') THEN 1 ELSE 0 END) AS open_count,
      COALESCE(SUM(${totalExpr}), 0) AS total_amount,
      COALESCE(SUM(${paidExpr}), 0) AS paid_amount,
      COALESCE(SUM(CASE WHEN ${statusExpr} NOT IN ('paid','void','voided','cancelled','canceled','refunded') THEN ${balanceExpr} ELSE 0 END), 0) AS outstanding
    FROM tbl_finance_invoices i
    ${whereSql}
    `,
    params
  );

  return {
    count: number(summary?.count),
    open_count: number(summary?.open_count),
    total_amount: money(summary?.total_amount),
    paid_amount: money(summary?.paid_amount),
    outstanding: money(summary?.outstanding),
    rows: [],
  };
}

async function getProgramReport(filters) {
  const columns = await tableColumns("tbl_event_program_registrations");

  if (!columns.size) {
    return {
      school_registrations: 0,
      trip_registrations: 0,
      school_revenue: 0,
      trip_revenue: 0,
      rows: [],
    };
  }

  const where = [];
  const params = [];
  appendDateWhere(where, params, columns, "r", filters, ["created_at", "paid_at", "updated_at"]);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const amountExpr = numExpr(columns, "r", ["total_amount", "amount", "paid_amount"], "0");
  const categoryExpr = textExpr(columns, "r", ["category", "program_type", "type"], "''");
  const statusExpr = textExpr(columns, "r", ["status", "payment_status"], "'pending'");
  const schoolCondition = `${categoryExpr} IN ('kids','school','school_program')`;
  const tripCondition = `${categoryExpr} = 'trip'`;
  const paidCondition = `${statusExpr} IN ('paid','posted','completed','complete','succeeded','success')`;
  const limit = intValue(filters.limit, 25, 1, 100);

  const [[summary]] = await pool.query(
    `
    SELECT
      COALESCE(SUM(CASE WHEN ${schoolCondition} THEN 1 ELSE 0 END), 0) AS school_registrations,
      COALESCE(SUM(CASE WHEN ${tripCondition} THEN 1 ELSE 0 END), 0) AS trip_registrations,
      COALESCE(SUM(CASE WHEN ${schoolCondition} AND ${paidCondition} THEN ${amountExpr} ELSE 0 END), 0) AS school_revenue,
      COALESCE(SUM(CASE WHEN ${tripCondition} AND ${paidCondition} THEN ${amountExpr} ELSE 0 END), 0) AS trip_revenue
    FROM tbl_event_program_registrations r
    ${whereSql}
    `,
    params
  );

  const [rows] = await pool.query(
    `
    SELECT
      r.id,
      ${rawTextExpr(columns, "r", ["full_name", "registrant_name", "payer_name"], "'--'")} AS full_name,
      ${rawTextExpr(columns, "r", ["email"], "'--'")} AS email,
      ${rawTextExpr(columns, "r", ["category"], "'program'")} AS category,
      ${amountExpr} AS total_amount,
      ${rawTextExpr(columns, "r", ["status"], "'pending'")} AS status,
      ${col(columns, "r", ["created_at"], "NULL")} AS created_at
    FROM tbl_event_program_registrations r
    ${whereSql}
    ORDER BY ${col(columns, "r", ["created_at"], "r.id")} DESC, r.id DESC
    LIMIT ?
    `,
    [...params, limit]
  );

  return {
    school_registrations: number(summary?.school_registrations),
    trip_registrations: number(summary?.trip_registrations),
    school_revenue: money(summary?.school_revenue),
    trip_revenue: money(summary?.trip_revenue),
    rows,
  };
}

async function getUnpaidMembers(filters) {
  const columns = await tableColumns("tbl_members");

  if (!columns.size) {
    return [];
  }

  const balanceColumn = firstColumn(columns, [
    "balance",
    "balance_due",
    "outstanding_balance",
    "amount_due",
    "membership_balance",
  ]);
  const statusColumn = firstColumn(columns, [
    "status",
    "membership_status",
    "account_status",
  ]);
  const limit = intValue(filters.limit, 25, 1, 100);
  const where = [];

  if (balanceColumn) {
    where.push(`COALESCE(m.${sqlId(balanceColumn)}, 0) > 0`);
  }

  if (statusColumn) {
    where.push(`LOWER(COALESCE(m.${sqlId(statusColumn)}, '')) IN ('unpaid','overdue','past_due','pending_payment','pending')`);
  }

  if (!where.length) return [];

  const [rows] = await pool.query(
    `
    SELECT
      m.id,
      ${rawTextExpr(columns, "m", ["member_no", "member_number"], "CONCAT('M-', m.id)")} AS member_no,
      ${rawTextExpr(columns, "m", ["full_name", "name"], "'--'")} AS full_name,
      ${rawTextExpr(columns, "m", ["email"], "'--'")} AS email,
      ${balanceColumn ? `COALESCE(m.${sqlId(balanceColumn)}, 0)` : "0"} AS balance
    FROM tbl_members m
    WHERE ${where.join(" OR ")}
    ORDER BY ${balanceColumn ? `m.${sqlId(balanceColumn)} DESC,` : ""} m.id DESC
    LIMIT ?
    `,
    [limit]
  );

  return rows;
}

function maxMoney(...values) {
  return money(Math.max(...values.map(number)));
}

async function buildReport(req) {
  const filters = {
    from: clean(req.query.from || req.query.date_from, 20),
    to: clean(req.query.to || req.query.date_to, 20),
    category: clean(req.query.category, 80),
    type: clean(req.query.type || "summary", 80),
    limit: intValue(req.query.limit || req.query.pageSize, 25, 1, 100),
  };

  const [
    members,
    payments,
    pledges,
    invoices,
    programs,
    unpaidMembers,
  ] = await Promise.all([
    getMemberReport(),
    getPaymentsReport(filters),
    getPledgeReport(filters),
    getInvoiceReport(filters),
    getProgramReport(filters),
    getUnpaidMembers(filters),
  ]);

  const schoolPayments = maxMoney(payments.school, programs.school_revenue);
  const tripPayments = maxMoney(payments.trip, programs.trip_revenue);
  const pledgePayments = maxMoney(payments.pledge, pledges.paid);
  const donationPayments = payments.donations;
  const membershipPayments = payments.membership;
  const totalRevenue = money(
    membershipPayments +
      donationPayments +
      schoolPayments +
      tripPayments +
      pledgePayments
  );

  const summary = {
    total_members_and_dependents: members.total_members_and_dependents,
    total_members: members.total_members,
    dependent_count: members.dependent_count,
    active_members: members.active_members,
    total_revenue: totalRevenue,
    total_payments: payments.total,
    membership_payments: membershipPayments,
    donation_payments: donationPayments,
    school_program_payments: schoolPayments,
    trip_program_payments: tripPayments,
    pledge_payments: pledgePayments,
    total_pledges: pledges.pledged,
    outstanding_pledges: pledges.outstanding,
    outstanding_invoices: invoices.outstanding,
    open_invoices: invoices.open_count,
    unpaid_members: unpaidMembers.length,
    manual_payments: payments.manual,
    online_payments: payments.online,
    school_registrations: programs.school_registrations,
    trip_registrations: programs.trip_registrations,
  };

  const cards = [
    { key: "total_members_and_dependents", label: "Members + Dependents", value: summary.total_members_and_dependents, type: "count", note: `${summary.total_members} members + ${summary.dependent_count} dependents` },
    { key: "active_members", label: "Active Members", value: summary.active_members, type: "count", note: "Current active members" },
    { key: "total_revenue", label: "Total Revenue", value: summary.total_revenue, type: "money", note: "Membership, giving, programs, pledges" },
    { key: "membership_payments", label: "Membership", value: summary.membership_payments, type: "money", note: "Membership dues and registration" },
    { key: "donation_payments", label: "Donations", value: summary.donation_payments, type: "money", note: "Donation categories" },
    { key: "school_program_payments", label: "School Programs", value: summary.school_program_payments, type: "money", note: `${summary.school_registrations} registration(s)` },
    { key: "trip_program_payments", label: "Trip Programs", value: summary.trip_program_payments, type: "money", note: `${summary.trip_registrations} registration(s)` },
    { key: "total_pledges", label: "Total Pledges", value: summary.total_pledges, type: "money", note: `${summary.outstanding_pledges} outstanding` },
    { key: "pledge_payments", label: "Pledge Payments", value: summary.pledge_payments, type: "money", note: "Collected pledge payments" },
    { key: "outstanding_invoices", label: "Outstanding Invoices", value: summary.outstanding_invoices, type: "money", note: `${summary.open_invoices} open invoice(s)` },
    { key: "unpaid_members", label: "Unpaid Members", value: summary.unpaid_members, type: "count", note: "Needs finance follow-up" },
    { key: "manual_payments", label: "Manual Payments", value: summary.manual_payments, type: "money", note: "Cash, check, Zelle" },
    { key: "online_payments", label: "Online Payments", value: summary.online_payments, type: "money", note: "Card and ACH" },
  ];

  return {
    filters,
    summary,
    cards,
    breakdowns: {
      revenue_by_category: payments.by_category,
      payment_methods: payments.by_method,
    },
    lists: {
      unpaid_members: unpaidMembers,
      pledge_rows: pledges.rows,
      program_rows: programs.rows,
      payment_rows: payments.rows,
      member_rows: members.rows,
    },
    members,
    payments,
    pledges,
    invoices,
    programs,
    generated_at: new Date().toISOString(),
  };
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function toCsv(report) {
  const lines = [
    ["Metric", "Value"],
    ...Object.entries(report.summary).map(([key, value]) => [key, value]),
    [],
    ["Revenue Category", "Amount", "Count"],
    ...(report.breakdowns.revenue_by_category || []).map((row) => [row.category, row.amount, row.count]),
    [],
    ["Payment Method", "Amount", "Count"],
    ...(report.breakdowns.payment_methods || []).map((row) => [row.method, row.amount, row.count]),
    [],
    ["Pledge #", "Donor", "Campaign", "Pledged", "Paid", "Outstanding"],
    ...(report.lists.pledge_rows || []).map((row) => [
      row.pledge_number,
      row.donor_name,
      row.campaign_name,
      row.pledged_amount,
      row.paid_amount,
      row.outstanding_amount,
    ]),
  ];

  return lines.map((line) => line.map(csvEscape).join(",")).join("\n");
}

router.use(authRequired);
router.use(requireRole(...FINANCE_ROLES));

router.get(["/", "/enterprise", "/dashboard", "/summary"], async (req, res) => {
  try {
    const report = await buildReport(req);

    return res.json({
      ok: true,
      report,
      dashboard: report,
      summary: report.summary,
      cards: report.cards,
      breakdowns: report.breakdowns,
      lists: report.lists,
      generated_at: report.generated_at,
    });
  } catch (err) {
    console.error("finance reports failed:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to load finance reports.",
      details: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  }
});

router.get(["/export.csv", "/enterprise/export.csv"], async (req, res) => {
  try {
    const report = await buildReport(req);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="finance-report-${new Date().toISOString().slice(0, 10)}.csv"`
    );

    return res.send(toCsv(report));
  } catch (err) {
    console.error("finance reports export failed:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to export finance reports.",
    });
  }
});

router.get("/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "financeReports",
    version: "enterprise",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
