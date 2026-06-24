// backend/routes/financeSearch.js
"use strict";

const express = require("express");
const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* Security                                                                   */
/* -------------------------------------------------------------------------- */

router.use(authRequired);

router.use(
  requireRole(
    "finance",
    "admin",
    "super_admin",
    "reconciliation"
  )
);

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

const CACHE_TTL_MS = 60 * 1000;
const columnCache = new Map();

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

function lower(value, max = 120) {
  return clean(value, max).toLowerCase();
}

function positiveInt(value, fallback = 1, max = 500) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function money(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function like(value) {
  return `%${clean(value, 190)}%`;
}

function sqlId(value) {
  const text = String(value || "");

  if (!/^[a-zA-Z0-9_]+$/.test(text)) {
    throw new Error(`Invalid SQL identifier: ${text}`);
  }

  return `\`${text}\``;
}

async function columnsFor(table) {
  const cached = columnCache.get(table);

  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.columns;
  }

  const [rows] = await pool.query(
    `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    `,
    [table]
  );

  const columns = new Set(rows.map((row) => row.COLUMN_NAME));

  columnCache.set(table, {
    columns,
    loadedAt: Date.now(),
  });

  return columns;
}

async function tableExists(table) {
  const columns = await columnsFor(table);
  return columns.size > 0;
}

function has(columns, column) {
  return columns.has(column);
}

function col(alias, column) {
  return `${alias}.${sqlId(column)}`;
}

function firstExpr(alias, columns, candidates, fallback = "NULL") {
  const existing = candidates
    .filter((candidate) => has(columns, candidate))
    .map((candidate) => col(alias, candidate));

  return existing.length
    ? `COALESCE(${existing.join(", ")}, ${fallback})`
    : fallback;
}

function amountExpr(alias, columns, candidates, fallback = "0") {
  return `CAST(${firstExpr(alias, columns, candidates, fallback)} AS DECIMAL(18,2))`;
}

function dateExpr(alias, columns, candidates, fallback = "NULL") {
  return firstExpr(alias, columns, candidates, fallback);
}

function concatNameExpr(alias, columns) {
  if (has(columns, "full_name")) return col(alias, "full_name");
  if (has(columns, "name")) return col(alias, "name");

  const first = has(columns, "first_name") ? col(alias, "first_name") : "NULL";
  const last = has(columns, "last_name") ? col(alias, "last_name") : "NULL";

  return `NULLIF(TRIM(CONCAT_WS(' ', ${first}, ${last})), '')`;
}

/* -------------------------------------------------------------------------- */
/* Query Filters                                                              */
/* -------------------------------------------------------------------------- */

function addSearchClause(clauses, params, query, expressions) {
  const search = clean(query.search || query.q || "", 190);
  const usable = expressions.filter(Boolean);

  if (!search || !usable.length) return;

  clauses.push(`(${usable.map((expr) => `${expr} LIKE ?`).join(" OR ")})`);
  usable.forEach(() => params.push(like(search)));
}

function addDateFilters(clauses, params, dateSql, query) {
  if (!dateSql || dateSql === "NULL") return;

  const from = clean(query.date_from || query.from || query.start_date || "", 30);
  const to = clean(query.date_to || query.to || query.end_date || "", 30);

  if (from) {
    clauses.push(`DATE(${dateSql}) >= DATE(?)`);
    params.push(from);
  }

  if (to) {
    clauses.push(`DATE(${dateSql}) <= DATE(?)`);
    params.push(to);
  }
}

function addAmountFilters(clauses, params, amountSql, query) {
  const min = query.amount_min || query.min_amount;
  const max = query.amount_max || query.max_amount;

  if (min !== undefined && min !== "") {
    clauses.push(`${amountSql} >= ?`);
    params.push(money(min));
  }

  if (max !== undefined && max !== "") {
    clauses.push(`${amountSql} <= ?`);
    params.push(money(max));
  }
}

function addLowerFilter(clauses, params, expr, value) {
  if (!expr || expr === "NULL" || value === undefined || value === "") return;

  clauses.push(`LOWER(${expr}) = ?`);
  params.push(lower(value));
}

function addExactColumnFilter(clauses, params, alias, columns, column, value) {
  if (!has(columns, column) || value === undefined || value === "") return;

  clauses.push(`${col(alias, column)} = ?`);
  params.push(value);
}

/* -------------------------------------------------------------------------- */
/* Generic Search                                                             */
/* -------------------------------------------------------------------------- */

async function searchEntity(config, query, limit, offset, withTotal = true) {
  if (!(await tableExists(config.table))) {
    return {
      rows: [],
      total: 0,
    };
  }

  const columns = await columnsFor(config.table);
  const alias = config.alias;

  const joins = [];
  const extraSelects = [];

  if (config.withCampaign && has(columns, "campaign_id") && await tableExists("tbl_finance_campaigns")) {
    const campaignColumns = await columnsFor("tbl_finance_campaigns");
    const campaignName = firstExpr("c", campaignColumns, ["title", "name", "campaign_name"], "NULL");

    joins.push(`
      LEFT JOIN tbl_finance_campaigns c
        ON c.id = ${alias}.campaign_id
    `);

    config.campaignNameSql = campaignName;
  }

  if (config.withProgram && has(columns, "program_id") && await tableExists("tbl_news_events")) {
    const eventColumns = await columnsFor("tbl_news_events");
    const programName = firstExpr("ne", eventColumns, ["title", "name"], "NULL");

    joins.push(`
      LEFT JOIN tbl_news_events ne
        ON ne.id = ${alias}.program_id
    `);

    config.programNameSql = programName;
  }

  const displaySql = firstExpr(
    alias,
    columns,
    config.numberColumns,
    `CONCAT('${config.prefix}-', ${alias}.id)`
  );

  const amountSql = amountExpr(alias, columns, config.amountColumns, "0");
  const dateSql = dateExpr(alias, columns, config.dateColumns, `${alias}.created_at`);
  const methodSql = firstExpr(alias, columns, config.methodColumns || [], "NULL");
  const categorySql = firstExpr(alias, columns, config.categoryColumns || [], `'${config.defaultCategory || config.scope}'`);
  const statusSql = firstExpr(alias, columns, config.statusColumns || [], "'active'");
  const emailSql = firstExpr(alias, columns, config.emailColumns || [], "NULL");
  const nameSql = firstExpr(alias, columns, config.nameColumns || [], config.defaultNameSql || "'--'");
  const memberNoSql = firstExpr(alias, columns, config.memberNoColumns || [], "NULL");
  const referenceSql = firstExpr(alias, columns, config.referenceColumns || [], "NULL");
  const campaignSql = config.campaignNameSql || "NULL";
  const programSql = config.programNameSql || "NULL";

  if (config.extraSelects) {
    extraSelects.push(...config.extraSelects(alias, columns));
  }

  const clauses = ["1=1"];
  const params = [];

  addSearchClause(clauses, params, query, [
    displaySql,
    referenceSql,
    emailSql,
    nameSql,
    memberNoSql,
    campaignSql,
    programSql,
  ]);

  addDateFilters(clauses, params, dateSql, query);
  addAmountFilters(clauses, params, amountSql, query);

  addLowerFilter(clauses, params, methodSql, query.method);
  addLowerFilter(clauses, params, categorySql, query.category || query.payment_type);
  addLowerFilter(clauses, params, statusSql, query.status);

  addExactColumnFilter(clauses, params, alias, columns, "member_id", query.member_id);
  addExactColumnFilter(clauses, params, alias, columns, "campaign_id", query.campaign_id);
  addExactColumnFilter(clauses, params, alias, columns, "program_id", query.program_id);
  addExactColumnFilter(clauses, params, alias, columns, "coverage_year", query.coverage_year);

  const whereSql = `WHERE ${clauses.join(" AND ")}`;

  const [rows] = await pool.query(
    `
    SELECT
      '${config.scope}' AS entity_type,
      ${alias}.id,
      ${displaySql} AS display_number,
      ${nameSql} AS person_name,
      ${memberNoSql} AS member_no,
      ${emailSql} AS email,
      ${amountSql} AS amount,
      ${dateSql} AS record_date,
      ${methodSql} AS method,
      ${categorySql} AS category,
      ${statusSql} AS status,
      ${campaignSql} AS campaign_name,
      ${programSql} AS program_name,
      ${referenceSql} AS reference_number,

      ${config.scope === "payment" ? `${alias}.id` : "NULL"} AS payment_id,
      ${config.scope === "invoice" ? `${alias}.id` : has(columns, "invoice_id") ? `${alias}.invoice_id` : "NULL"} AS invoice_id,
      ${config.scope === "receipt" ? `${alias}.id` : has(columns, "receipt_id") ? `${alias}.receipt_id` : "NULL"} AS receipt_id,
      ${config.scope === "pledge" ? `${alias}.id` : has(columns, "pledge_id") ? `${alias}.pledge_id` : "NULL"} AS pledge_id,
      ${config.scope === "campaign" ? `${alias}.id` : has(columns, "campaign_id") ? `${alias}.campaign_id` : "NULL"} AS campaign_id,
      ${config.scope === "member" ? `${alias}.id` : has(columns, "member_id") ? `${alias}.member_id` : "NULL"} AS member_id,
      ${config.scope === "program_registration" ? `${alias}.id` : "NULL"} AS registration_id
      ${extraSelects.length ? `, ${extraSelects.join(", ")}` : ""}

    FROM ${sqlId(config.table)} ${alias}
    ${joins.join("\n")}
    ${whereSql}

    ORDER BY
      record_date DESC,
      ${alias}.id DESC

    LIMIT ?
    OFFSET ?
    `,
    [...params, limit, offset]
  );

  let total = rows.length;

  if (withTotal) {
    const [[count]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM ${sqlId(config.table)} ${alias}
      ${joins.join("\n")}
      ${whereSql}
      `,
      params
    );

    total = Number(count?.total || 0);
  }

  return {
    rows,
    total,
  };
}

/* -------------------------------------------------------------------------- */
/* Entity Configs                                                             */
/* -------------------------------------------------------------------------- */

const ENTITY_CONFIGS = {
  payments: {
    scope: "payment",
    table: "tbl_finance_payments",
    alias: "p",
    prefix: "PAY",
    numberColumns: ["payment_number", "payment_no", "transaction_reference", "reference_no"],
    amountColumns: ["amount", "payment_amount", "total_amount"],
    dateColumns: ["paid_at", "payment_date", "created_at"],
    methodColumns: ["method", "payment_method"],
    categoryColumns: ["category", "payment_category", "finance_category"],
    statusColumns: ["status", "payment_status"],
    emailColumns: ["email_snapshot", "email", "payer_email", "member_email", "donor_email"],
    nameColumns: ["full_name_snapshot", "full_name", "payer_name", "member_name", "donor_name", "guest_name"],
    memberNoColumns: ["member_no", "member_number"],
    referenceColumns: ["reference_no", "reference_number", "transaction_reference", "stripe_payment_intent_id", "stripe_charge_id", "check_number", "zelle_reference"],
    withCampaign: true,
  },

  invoices: {
    scope: "invoice",
    table: "tbl_finance_invoices",
    alias: "i",
    prefix: "INV",
    numberColumns: ["invoice_number", "invoice_no", "number"],
    amountColumns: ["total_amount", "amount", "invoice_amount", "balance_due"],
    dateColumns: ["invoice_date", "issued_at", "created_at"],
    methodColumns: ["payment_method", "method"],
    categoryColumns: ["category", "invoice_type", "payment_category", "finance_category"],
    statusColumns: ["status", "invoice_status"],
    emailColumns: ["email_snapshot", "email", "recipient_email", "member_email", "guest_email", "donor_email"],
    nameColumns: ["full_name_snapshot", "full_name", "bill_to", "member_name", "customer_name", "guest_name"],
    memberNoColumns: ["member_no", "member_number"],
    referenceColumns: ["reference_no", "reference_number", "payment_reference", "transaction_reference"],
    withCampaign: true,
  },

  receipts: {
    scope: "receipt",
    table: "tbl_finance_receipts",
    alias: "r",
    prefix: "RCPT",
    numberColumns: ["receipt_number", "receipt_no", "number"],
    amountColumns: ["amount", "receipt_amount", "total_amount"],
    dateColumns: ["issued_at", "receipt_date", "sent_at", "created_at"],
    methodColumns: ["payment_method", "method"],
    categoryColumns: ["category", "receipt_type", "payment_category", "finance_category"],
    statusColumns: ["status", "receipt_status", "email_status"],
    emailColumns: ["email_snapshot", "email", "recipient_email", "emailed_to", "member_email", "donor_email"],
    nameColumns: ["full_name_snapshot", "full_name", "paid_by", "member_name", "donor_name", "guest_name"],
    memberNoColumns: ["member_no", "member_number"],
    referenceColumns: ["reference_no", "reference_number", "transaction_reference"],
  },

  pledges: {
    scope: "pledge",
    table: "tbl_finance_pledges",
    alias: "pl",
    prefix: "PLG",
    numberColumns: ["pledge_number", "pledge_no", "reference_no"],
    amountColumns: ["pledged_amount", "amount", "total_amount"],
    dateColumns: ["created_at", "pledge_date", "due_date"],
    methodColumns: [],
    categoryColumns: ["category", "pledge_type"],
    defaultCategory: "pledge",
    statusColumns: ["status", "pledge_status"],
    emailColumns: ["email", "email_snapshot", "donor_email", "guest_email"],
    nameColumns: ["full_name_snapshot", "full_name", "donor_name", "guest_name"],
    memberNoColumns: ["member_no", "member_number"],
    referenceColumns: ["reference_no", "reference_number", "pledge_number"],
    withCampaign: true,
    extraSelects(alias, columns) {
      const paid = amountExpr(alias, columns, ["paid_amount"], "0");
      const pledged = amountExpr(alias, columns, ["pledged_amount", "amount"], "0");

      return [
        `${paid} AS paid_amount`,
        `GREATEST(${pledged} - ${paid}, 0) AS balance_due`,
      ];
    },
  },

  campaigns: {
    scope: "campaign",
    table: "tbl_finance_campaigns",
    alias: "c",
    prefix: "CMP",
    numberColumns: ["campaign_number", "campaign_no", "code"],
    amountColumns: ["goal_amount", "goal", "target_amount"],
    dateColumns: ["created_at", "start_date"],
    methodColumns: [],
    categoryColumns: [],
    defaultCategory: "campaign",
    statusColumns: ["status"],
    emailColumns: [],
    nameColumns: ["title", "name", "campaign_name"],
    memberNoColumns: [],
    referenceColumns: ["campaign_number", "code"],
  },

  members: {
    scope: "member",
    table: "tbl_members",
    alias: "m",
    prefix: "MEM",
    numberColumns: ["member_no", "member_number"],
    amountColumns: [],
    dateColumns: ["created_at", "membership_start_date", "joined_at", "join_date"],
    methodColumns: [],
    categoryColumns: [],
    defaultCategory: "member",
    statusColumns: ["membership_status", "status", "member_status"],
    emailColumns: ["email", "member_email"],
    nameColumns: ["full_name", "name"],
    memberNoColumns: ["member_no", "member_number"],
    referenceColumns: ["phone", "mobile", "cell_phone", "phone_number"],
    defaultNameSql: "NULL",
  },

  program_registrations: {
    scope: "program_registration",
    table: "tbl_event_program_registrations",
    alias: "g",
    prefix: "REG",
    numberColumns: ["registration_number", "registration_no", "reference_no"],
    amountColumns: ["total_amount", "amount", "price"],
    dateColumns: ["created_at", "registered_at"],
    methodColumns: ["payment_method", "method"],
    categoryColumns: ["category", "program_category"],
    statusColumns: ["status", "payment_status"],
    emailColumns: ["email_snapshot", "email", "parent_email", "guardian_email"],
    nameColumns: ["full_name_snapshot", "full_name", "parent_name", "guardian_name", "registrant_name"],
    memberNoColumns: ["member_no", "member_number"],
    referenceColumns: ["reference_no", "registration_number", "payment_reference"],
    withProgram: true,
  },
};

ENTITY_CONFIGS.payment = ENTITY_CONFIGS.payments;
ENTITY_CONFIGS.invoice = ENTITY_CONFIGS.invoices;
ENTITY_CONFIGS.receipt = ENTITY_CONFIGS.receipts;
ENTITY_CONFIGS.pledge = ENTITY_CONFIGS.pledges;
ENTITY_CONFIGS.campaign = ENTITY_CONFIGS.campaigns;
ENTITY_CONFIGS.member = ENTITY_CONFIGS.members;
ENTITY_CONFIGS.registrations = ENTITY_CONFIGS.program_registrations;
ENTITY_CONFIGS.programs = ENTITY_CONFIGS.program_registrations;
ENTITY_CONFIGS.school = ENTITY_CONFIGS.program_registrations;
ENTITY_CONFIGS.trip = ENTITY_CONFIGS.program_registrations;

function normalizeScopes(value) {
  const raw = lower(value || "all");

  if (!raw || raw === "all") {
    return [
      "payments",
      "invoices",
      "receipts",
      "pledges",
      "campaigns",
      "members",
      "program_registrations",
    ];
  }

  return [
    ...new Set(
      raw
        .split(",")
        .map((item) => lower(item))
        .filter((item) => ENTITY_CONFIGS[item])
    ),
  ];
}

function enrichRow(row) {
  const type = row.entity_type;

  const actions = {
    payment: {
      view: `/dash/finance/payments/${row.payment_id || row.id}`,
    },
    invoice: {
      view: `/dash/finance/invoices/${row.invoice_id || row.id}`,
      pdf: `/api/finance/invoices/${row.invoice_id || row.id}/pdf`,
    },
    receipt: {
      view: `/dash/finance/receipts/${row.receipt_id || row.id}`,
      pdf: `/api/finance/receipts/${row.receipt_id || row.id}/pdf`,
    },
    pledge: {
      view: `/dash/finance/pledges/${row.pledge_id || row.id}`,
      reminder: `/api/finance/pledges/${row.pledge_id || row.id}/reminder`,
    },
    campaign: {
      view: `/dash/finance/campaigns/${row.campaign_id || row.id}`,
    },
    member: {
      view: `/dash/members/${row.member_id || row.id}`,
      statement: `/api/finance/statements/member/${row.member_id || row.id}`,
    },
    program_registration: {
      view: `/dash/finance/program-registrations/${row.registration_id || row.id}`,
    },
  };

  return {
    ...row,
    amount: row.amount == null ? null : money(row.amount),
    paid_amount: row.paid_amount == null ? null : money(row.paid_amount),
    balance_due: row.balance_due == null ? null : money(row.balance_due),
    actions: actions[type] || {},
  };
}

function sortRows(rows) {
  return rows.sort((a, b) => {
    const aTime = a.record_date ? new Date(a.record_date).getTime() : 0;
    const bTime = b.record_date ? new Date(b.record_date).getTime() : 0;

    if (bTime !== aTime) return bTime - aTime;

    return Number(b.id || 0) - Number(a.id || 0);
  });
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/search/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "financeSearch",
    version: "enterprise",
    timestamp: new Date().toISOString(),
  });
});

router.get("/search", async (req, res) => {
  try {
    const page = positiveInt(req.query.page, 1, 100000);
    const limit = positiveInt(req.query.limit || req.query.pageSize, 25, 200);
    const offset = (page - 1) * limit;
    const scopes = normalizeScopes(req.query.scope || req.query.type);

    if (!scopes.length) {
      return res.json({
        ok: true,
        scope: "none",
        rows: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 1,
        },
        summary: {
          total: 0,
        },
      });
    }

    if (scopes.length === 1) {
      const config = ENTITY_CONFIGS[scopes[0]];
      const result = await searchEntity(config, req.query, limit, offset, true);

      return res.json({
        ok: true,
        scope: scopes[0],
        rows: result.rows.map(enrichRow),
        pagination: {
          page,
          limit,
          total: result.total,
          pages: Math.max(Math.ceil(result.total / limit), 1),
        },
        summary: {
          total: result.total,
          [scopes[0]]: result.total,
        },
      });
    }

    const perScopeLimit = Math.min(Math.max(limit, 25), 100);

    const results = await Promise.all(
      scopes.map(async (scope) => {
        const result = await searchEntity(
          ENTITY_CONFIGS[scope],
          req.query,
          perScopeLimit,
          0,
          true
        );

        return {
          scope,
          ...result,
        };
      })
    );

    const total = results.reduce(
      (sum, result) => sum + Number(result.total || 0),
      0
    );

    const rows = sortRows(
      results.flatMap((result) => result.rows.map(enrichRow))
    ).slice(offset, offset + limit);

    const summary = results.reduce(
      (acc, result) => {
        acc[result.scope] = Number(result.total || 0);
        return acc;
      },
      { total }
    );

    return res.json({
      ok: true,
      scope: "all",
      rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1),
      },
      summary,
    });
  } catch (err) {
    console.error("finance search error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to search finance records.",
    });
  }
});

router.get("/search/filters", async (_req, res) => {
  try {
    const filters = {
      scopes: [
        "payments",
        "invoices",
        "receipts",
        "pledges",
        "campaigns",
        "members",
        "program_registrations",
      ],
      methods: [],
      categories: [],
      statuses: [],
      campaigns: [],
      years: [],
    };

    if (await tableExists("tbl_finance_payments")) {
      const paymentColumns = await columnsFor("tbl_finance_payments");
      const methodSql = firstExpr("p", paymentColumns, ["method", "payment_method"], "NULL");
      const categorySql = firstExpr("p", paymentColumns, ["category", "payment_category"], "NULL");
      const statusSql = firstExpr("p", paymentColumns, ["status", "payment_status"], "NULL");

      const [methods] = await pool.query(
        `
        SELECT DISTINCT ${methodSql} AS value
        FROM tbl_finance_payments p
        WHERE ${methodSql} IS NOT NULL
        ORDER BY value
        LIMIT 100
        `
      );

      const [categories] = await pool.query(
        `
        SELECT DISTINCT ${categorySql} AS value
        FROM tbl_finance_payments p
        WHERE ${categorySql} IS NOT NULL
        ORDER BY value
        LIMIT 100
        `
      );

      const [statuses] = await pool.query(
        `
        SELECT DISTINCT ${statusSql} AS value
        FROM tbl_finance_payments p
        WHERE ${statusSql} IS NOT NULL
        ORDER BY value
        LIMIT 100
        `
      );

      filters.methods = methods.map((row) => row.value).filter(Boolean);
      filters.categories = categories.map((row) => row.value).filter(Boolean);
      filters.statuses = statuses.map((row) => row.value).filter(Boolean);
    }

    if (await tableExists("tbl_finance_campaigns")) {
      const campaignColumns = await columnsFor("tbl_finance_campaigns");
      const nameSql = firstExpr("c", campaignColumns, ["title", "name", "campaign_name"], "CONCAT('Campaign ', c.id)");

      const [campaigns] = await pool.query(
        `
        SELECT
          c.id,
          ${nameSql} AS name
        FROM tbl_finance_campaigns c
        ORDER BY name ASC
        LIMIT 500
        `
      );

      filters.campaigns = campaigns;
    }

    return res.json({
      ok: true,
      filters,
    });
  } catch (err) {
    console.error("finance search filters error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to load finance search filters.",
    });
  }
});

router.get("/search/export/csv", async (req, res) => {
  try {
    const scopes = normalizeScopes(req.query.scope || req.query.type);
    const limit = positiveInt(req.query.limit, 5000, 10000);

    const results = await Promise.all(
      scopes.map(async (scope) => {
        const result = await searchEntity(
          ENTITY_CONFIGS[scope],
          req.query,
          limit,
          0,
          false
        );

        return result.rows.map(enrichRow);
      })
    );

    const rows = sortRows(results.flat()).slice(0, limit);

    const headers = [
      "Type",
      "Number",
      "Name",
      "Member #",
      "Email",
      "Amount",
      "Date",
      "Method",
      "Category",
      "Status",
      "Campaign",
      "Program",
      "Reference #",
    ];

    const escape = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const lines = [
      headers.join(","),
      ...rows.map((row) =>
        [
          row.entity_type,
          row.display_number,
          row.person_name,
          row.member_no,
          row.email,
          row.amount,
          row.record_date,
          row.method,
          row.category,
          row.status,
          row.campaign_name,
          row.program_name,
          row.reference_number,
        ].map(escape).join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="finance-search-results.csv"'
    );

    return res.send(`\uFEFF${lines.join("\n")}`);
  } catch (err) {
    console.error("finance search export error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to export finance search results.",
    });
  }
});

module.exports = router;