// backend/services/domains/reports/auditTrailReportingService.js
"use strict";

const pool = require("../../../db");

const {
  insertExistingColumns,
  findOne,
  findMany,
} = require("../../../utils/dbHelpers");

const {
  clean,
  safeJson,
} = require("../../../utils/financeHelpers");

const {
  exportExcel,
  exportCsv,
  exportJson,
} = require("../export/exportService");

const AUDIT_TABLE = "tbl_audit_logs";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const FINANCE_ENTITY_TYPES = new Set([
  "payment",
  "payments",
  "invoice",
  "invoices",
  "receipt",
  "receipts",
  "pledge",
  "pledges",
  "membership",
  "member",
  "registration",
  "finance_registration",
  "reconciliation",
  "ledger",
  "reminder",
  "email",
  "statement",
  "stripe_webhook",
  "webhook",
]);

const SECURITY_ACTIONS = [
  "login_failed",
  "login_success",
  "logout",
  "password_reset",
  "password_reset_requested",
  "password_reset_success",
  "password_changed",
  "access_denied",
  "unauthorized",
  "token_refresh",
];

/* -------------------------------------------------------------------------- */
/* Schema Helpers                                                             */
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

function sqlId(value) {
  const ident = String(value || "");

  if (!/^[A-Za-z0-9_]+$/.test(ident)) {
    throw new Error("Unsafe SQL identifier.");
  }

  return `\`${ident}\``;
}

function firstColumn(columns, names = []) {
  return names.find((name) => columns.has(name)) || null;
}

function coalesceExpr(columns, alias, names = [], fallback = "NULL") {
  const available = names
    .filter((name) => columns.has(name))
    .map((name) => `${alias}.${sqlId(name)}`);

  if (!available.length) return fallback;

  return `COALESCE(${available.join(", ")}, ${fallback})`;
}

function orderSql(columns) {
  const parts = [];

  const dateColumn = firstColumn(columns, [
    "created_at",
    "logged_at",
    "event_at",
    "timestamp",
    "date",
  ]);

  if (dateColumn) {
    parts.push(`a.${sqlId(dateColumn)} DESC`);
  }

  if (columns.has("id")) {
    parts.push("a.`id` DESC");
  }

  return parts.length ? parts.join(", ") : "1";
}

async function auditSchema() {
  const columns = await tableColumns(AUDIT_TABLE);

  const dateColumn = firstColumn(columns, [
    "created_at",
    "logged_at",
    "event_at",
    "timestamp",
    "date",
  ]);

  return {
    columns,
    dateColumn,

    actionExpr: coalesceExpr(
      columns,
      "a",
      ["action", "event_type", "activity", "operation"],
      "'system_event'"
    ),

    entityExpr: coalesceExpr(
      columns,
      "a",
      ["entity_type", "entity", "module", "resource_type", "table_name"],
      "'system'"
    ),

    entityIdExpr: coalesceExpr(
      columns,
      "a",
      ["entity_id", "record_id", "resource_id", "target_id"],
      "NULL"
    ),

    actorIdExpr: coalesceExpr(
      columns,
      "a",
      ["user_id", "actor_id", "actor_user_id", "created_by"],
      "NULL"
    ),

    actorNameExpr: coalesceExpr(
      columns,
      "a",
      ["actor_name", "user_name", "created_by_name", "full_name"],
      "'System'"
    ),

    ipExpr: coalesceExpr(
      columns,
      "a",
      ["ip_address", "ip", "remote_addr"],
      "''"
    ),

    statusExpr: coalesceExpr(
      columns,
      "a",
      ["status", "result", "outcome"],
      "'success'"
    ),

    severityExpr: columns.has("severity")
      ? "COALESCE(a.`severity`, 'info')"
      : `
        CASE
          WHEN LOWER(${coalesceExpr(columns, "a", ["action", "event_type"], "''")})
            IN ('login_failed', 'access_denied', 'unauthorized')
          THEN 'warning'
          ELSE 'info'
        END
      `,

    hasSeverity: columns.has("severity"),
    hasStatus: columns.has("status") || columns.has("result") || columns.has("outcome"),
  };
}

/* -------------------------------------------------------------------------- */
/* Filters                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeFilters(filters = {}) {
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

  const action = clean(filters.action || "", 120).toLowerCase();

  const entityType =
    clean(
      filters.entity_type ||
        filters.entity ||
        filters.module ||
        "",
      120
    ).toLowerCase();

  const userId =
    Number(
      filters.user_id ||
        filters.actor_id ||
        filters.created_by ||
        0
    ) || null;

  const entityId =
    Number(filters.entity_id || filters.record_id || 0) || null;

  const ipAddress =
    clean(filters.ip_address || filters.ip || "", 80);

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
    action,
    entity_type: entityType,
    user_id: userId,
    entity_id: entityId,
    ip_address: ipAddress,
    search,
    limit,
    page,
    offset,
  };
}

async function buildAuditWhere(filters = {}) {
  const schema = await auditSchema();
  const f = normalizeFilters(filters);
  const where = ["1=1"];
  const params = [];

  if (schema.dateColumn && f.date_from) {
    where.push(`DATE(a.${sqlId(schema.dateColumn)}) >= DATE(?)`);
    params.push(f.date_from);
  }

  if (schema.dateColumn && f.date_to) {
    where.push(`DATE(a.${sqlId(schema.dateColumn)}) <= DATE(?)`);
    params.push(f.date_to);
  }

  if (f.action) {
    where.push(`LOWER(${schema.actionExpr}) = ?`);
    params.push(f.action);
  }

  if (f.entity_type) {
    where.push(`LOWER(${schema.entityExpr}) = ?`);
    params.push(f.entity_type);
  }

  if (f.user_id) {
    const userColumns = [
      "user_id",
      "actor_id",
      "actor_user_id",
      "created_by",
    ].filter((column) => schema.columns.has(column));

    if (userColumns.length) {
      where.push(
        `(${userColumns.map((column) => `a.${sqlId(column)} = ?`).join(" OR ")})`
      );
      userColumns.forEach(() => params.push(f.user_id));
    } else {
      where.push("1=0");
    }
  }

  if (f.entity_id) {
    const entityIdColumns = [
      "entity_id",
      "record_id",
      "resource_id",
      "target_id",
    ].filter((column) => schema.columns.has(column));

    if (entityIdColumns.length) {
      where.push(
        `(${entityIdColumns.map((column) => `a.${sqlId(column)} = ?`).join(" OR ")})`
      );
      entityIdColumns.forEach(() => params.push(f.entity_id));
    } else {
      where.push("1=0");
    }
  }

  if (f.ip_address) {
    const ipColumns = [
      "ip_address",
      "ip",
      "remote_addr",
    ].filter((column) => schema.columns.has(column));

    if (ipColumns.length) {
      where.push(
        `(${ipColumns.map((column) => `a.${sqlId(column)} = ?`).join(" OR ")})`
      );
      ipColumns.forEach(() => params.push(f.ip_address));
    } else {
      where.push("1=0");
    }
  }

  if (f.search) {
    const searchable = [
      "action",
      "event_type",
      "activity",
      "entity_type",
      "entity",
      "module",
      "resource_type",
      "description",
      "message",
      "ip_address",
      "ip",
      "actor_name",
      "user_name",
      "created_by_name",
      "status",
      "severity",
      "details",
      "details_json",
      "metadata_json",
    ].filter((column) => schema.columns.has(column));

    if (searchable.length) {
      where.push(
        `(${searchable.map((column) => `CAST(a.${sqlId(column)} AS CHAR) LIKE ?`).join(" OR ")})`
      );

      const like = `%${f.search}%`;
      searchable.forEach(() => params.push(like));
    }
  }

  return {
    schema,
    filters: f,
    whereSql: `WHERE ${where.join(" AND ")}`,
    params,
  };
}

async function financeWhere(filters = {}) {
  const base = await buildAuditWhere(filters);

  if (base.filters.entity_type) {
    return base;
  }

  const values = [...FINANCE_ENTITY_TYPES];

  return {
    ...base,
    whereSql: `${base.whereSql} AND LOWER(${base.schema.entityExpr}) IN (${values.map(() => "?").join(", ")})`,
    params: [...base.params, ...values],
  };
}

async function securityWhere(filters = {}) {
  const base = await buildAuditWhere(filters);

  return {
    ...base,
    whereSql: `${base.whereSql} AND LOWER(${base.schema.actionExpr}) IN (${SECURITY_ACTIONS.map(() => "?").join(", ")})`,
    params: [...base.params, ...SECURITY_ACTIONS],
  };
}

/* -------------------------------------------------------------------------- */
/* Rows                                                                       */
/* -------------------------------------------------------------------------- */

function selectAuditSql(schema) {
  return `
    SELECT
      a.*,
      ${schema.actionExpr} AS normalized_action,
      ${schema.entityExpr} AS normalized_entity_type,
      ${schema.entityIdExpr} AS normalized_entity_id,
      ${schema.actorIdExpr} AS normalized_actor_id,
      ${schema.actorNameExpr} AS normalized_actor_name,
      ${schema.ipExpr} AS normalized_ip_address,
      ${schema.statusExpr} AS normalized_status,
      ${schema.severityExpr} AS normalized_severity
    FROM ${AUDIT_TABLE} a
  `;
}

async function getAuditLogs(filters = {}) {
  const { schema, filters: f, whereSql, params } =
    await buildAuditWhere(filters);

  return findMany(
    pool,
    `
    ${selectAuditSql(schema)}
    ${whereSql}
    ORDER BY ${orderSql(schema.columns)}
    LIMIT ? OFFSET ?
    `,
    [...params, f.limit, f.offset]
  );
}

async function getFinanceAuditReport(filters = {}) {
  const { schema, filters: f, whereSql, params } =
    await financeWhere(filters);

  return findMany(
    pool,
    `
    ${selectAuditSql(schema)}
    ${whereSql}
    ORDER BY ${orderSql(schema.columns)}
    LIMIT ? OFFSET ?
    `,
    [...params, f.limit, f.offset]
  );
}

async function getSecurityAuditReport(filters = {}) {
  const { schema, filters: f, whereSql, params } =
    await securityWhere(filters);

  return findMany(
    pool,
    `
    ${selectAuditSql(schema)}
    ${whereSql}
    ORDER BY ${orderSql(schema.columns)}
    LIMIT ? OFFSET ?
    `,
    [...params, f.limit, f.offset]
  );
}

async function getFailedLoginReport(filters = {}) {
  return getAuditLogs({
    ...filters,
    action: "login_failed",
  });
}

async function getSuspiciousSecurityEvents(filters = {}) {
  const { schema, filters: f, whereSql, params } =
    await buildAuditWhere(filters);

  const statusRisk = schema.hasStatus
    ? `LOWER(${schema.statusExpr}) IN ('failed', 'error', 'denied')`
    : "0=1";

  const severityRisk = schema.hasSeverity
    ? `LOWER(${schema.severityExpr}) IN ('critical', 'warning', 'high')`
    : "0=1";

  return findMany(
    pool,
    `
    ${selectAuditSql(schema)}
    ${whereSql}
      AND (
        LOWER(${schema.actionExpr}) IN ('login_failed', 'access_denied', 'unauthorized')
        OR ${statusRisk}
        OR ${severityRisk}
      )
    ORDER BY ${orderSql(schema.columns)}
    LIMIT ? OFFSET ?
    `,
    [...params, f.limit, f.offset]
  );
}

/* -------------------------------------------------------------------------- */
/* Summaries                                                                  */
/* -------------------------------------------------------------------------- */

async function getAdminAuditSummary(filters = {}) {
  const { schema, whereSql, params } = await buildAuditWhere(filters);

  return findMany(
    pool,
    `
    SELECT
      ${schema.actionExpr} AS action,
      COUNT(*) AS total_actions
    FROM ${AUDIT_TABLE} a
    ${whereSql}
    GROUP BY ${schema.actionExpr}
    ORDER BY total_actions DESC
    `,
    params
  );
}

async function getSecurityAuditSummary(filters = {}) {
  const { schema, whereSql, params } = await securityWhere(filters);

  return findMany(
    pool,
    `
    SELECT
      ${schema.actionExpr} AS event_type,
      ${schema.severityExpr} AS severity,
      COUNT(*) AS total_events
    FROM ${AUDIT_TABLE} a
    ${whereSql}
    GROUP BY
      ${schema.actionExpr},
      ${schema.severityExpr}
    ORDER BY total_events DESC
    `,
    params
  );
}

async function getAdminUserActivity(filters = {}) {
  const { schema, whereSql, params } = await buildAuditWhere(filters);

  return findMany(
    pool,
    `
    SELECT
      ${schema.actorIdExpr} AS actor_id,
      ${schema.actorNameExpr} AS actor_name,
      COUNT(*) AS total_actions,
      MAX(${
        schema.dateColumn
          ? `a.${sqlId(schema.dateColumn)}`
          : "NULL"
      }) AS last_action_at
    FROM ${AUDIT_TABLE} a
    ${whereSql}
    GROUP BY
      ${schema.actorIdExpr},
      ${schema.actorNameExpr}
    ORDER BY total_actions DESC
    `,
    params
  );
}

async function getFinanceAuditSummary(filters = {}) {
  const { schema, whereSql, params } = await financeWhere(filters);

  return findMany(
    pool,
    `
    SELECT
      ${schema.entityExpr} AS entity_type,
      ${schema.actionExpr} AS action,
      COUNT(*) AS total_actions,
      MAX(${
        schema.dateColumn
          ? `a.${sqlId(schema.dateColumn)}`
          : "NULL"
      }) AS last_action_at
    FROM ${AUDIT_TABLE} a
    ${whereSql}
    GROUP BY
      ${schema.entityExpr},
      ${schema.actionExpr}
    ORDER BY total_actions DESC
    `,
    params
  );
}

async function getAuditKpis(filters = {}) {
  const allWhere = await buildAuditWhere(filters);
  const finance = await financeWhere(filters);
  const security = await securityWhere(filters);
  const failedLogin = await buildAuditWhere({
    ...filters,
    action: "login_failed",
  });

  const statusRisk = allWhere.schema.hasStatus
    ? `LOWER(${allWhere.schema.statusExpr}) IN ('failed', 'error', 'denied')`
    : "0=1";

  const severityRisk = allWhere.schema.hasSeverity
    ? `LOWER(${allWhere.schema.severityExpr}) IN ('critical', 'warning', 'high')`
    : "0=1";

  const [
    allLogs,
    financeLogs,
    securityLogs,
    failedLogins,
    failedEvents,
  ] = await Promise.all([
    findOne(
      pool,
      `
      SELECT COUNT(*) AS total
      FROM ${AUDIT_TABLE} a
      ${allWhere.whereSql}
      `,
      allWhere.params
    ),

    findOne(
      pool,
      `
      SELECT COUNT(*) AS total
      FROM ${AUDIT_TABLE} a
      ${finance.whereSql}
      `,
      finance.params
    ),

    findOne(
      pool,
      `
      SELECT COUNT(*) AS total
      FROM ${AUDIT_TABLE} a
      ${security.whereSql}
      `,
      security.params
    ),

    findOne(
      pool,
      `
      SELECT COUNT(*) AS total
      FROM ${AUDIT_TABLE} a
      ${failedLogin.whereSql}
      `,
      failedLogin.params
    ),

    findOne(
      pool,
      `
      SELECT COUNT(*) AS total
      FROM ${AUDIT_TABLE} a
      ${allWhere.whereSql}
        AND (
          LOWER(${allWhere.schema.actionExpr}) IN ('login_failed', 'access_denied', 'unauthorized')
          OR ${statusRisk}
          OR ${severityRisk}
        )
      `,
      allWhere.params
    ),
  ]);

  return {
    total_logs: Number(allLogs?.total || 0),
    finance_logs: Number(financeLogs?.total || 0),
    security_logs: Number(securityLogs?.total || 0),
    failed_logins: Number(failedLogins?.total || 0),
    failed_or_high_risk_events: Number(failedEvents?.total || 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Audit Logging Helper                                                       */
/* -------------------------------------------------------------------------- */

async function createAuditLog(payload = {}) {
  const details =
    payload.details_json ||
    payload.metadata_json ||
    payload.details ||
    payload.metadata ||
    null;

  const [result] = await insertExistingColumns(
    pool,
    AUDIT_TABLE,
    {
      user_id: payload.user_id || payload.actor_id || null,
      actor_id: payload.actor_id || payload.user_id || null,
      actor_user_id: payload.actor_id || payload.user_id || null,
      actor_name:
        clean(
          payload.actor_name ||
            payload.user_name ||
            payload.created_by_name ||
            "",
          255
        ) || null,

      action: clean(payload.action || "system_event", 120),
      event_type: clean(payload.action || "system_event", 120),

      entity_type: clean(payload.entity_type || payload.module || "system", 120),
      module: clean(payload.module || payload.entity_type || "system", 120),
      resource_type: clean(payload.entity_type || payload.module || "system", 120),

      entity_id: payload.entity_id || payload.record_id || null,
      record_id: payload.record_id || payload.entity_id || null,
      resource_id: payload.record_id || payload.entity_id || null,

      description:
        clean(payload.description || payload.message || "", 2000) || null,
      message:
        clean(payload.message || payload.description || "", 2000) || null,

      ip_address: clean(payload.ip_address || payload.ip || "", 80) || null,
      ip: clean(payload.ip || payload.ip_address || "", 80) || null,

      user_agent: clean(payload.user_agent || "", 1000) || null,

      status: clean(payload.status || "success", 40),
      severity: clean(payload.severity || "info", 40),

      details: safeJson(details),
      details_json: safeJson(details),
      metadata_json: safeJson(payload.metadata || payload.meta || details),

      created_at: new Date(),
    }
  );

  return result.insertId;
}

/* -------------------------------------------------------------------------- */
/* Exports                                                                    */
/* -------------------------------------------------------------------------- */

async function exportAuditReport({
  report = "all",
  format = "xlsx",
  filters = {},
} = {}) {
  const exportFilters = {
    ...filters,
    limit: filters.limit || 5000,
  };

  let rows = [];
  let fileName = "audit-report";
  let sheetName = "Audit";

  if (report === "finance") {
    rows = await getFinanceAuditReport(exportFilters);
    fileName = "finance-audit-report";
    sheetName = "Finance Audit";
  } else if (report === "security") {
    rows = await getSecurityAuditReport(exportFilters);
    fileName = "security-audit-report";
    sheetName = "Security Audit";
  } else if (report === "failed-logins") {
    rows = await getFailedLoginReport(exportFilters);
    fileName = "failed-login-report";
    sheetName = "Failed Logins";
  } else {
    rows = await getAuditLogs(exportFilters);
  }

  const summary = {
    report,
    total_logs: rows.length,
    generated_at: new Date().toISOString(),
    date_from: filters.date_from || filters.from || "",
    date_to: filters.date_to || filters.to || "",
  };

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
      summary,
    });
  }

  return exportExcel({
    rows,
    fileName,
    sheetName,
    summary,
  });
}

async function exportAdminAuditReport(format = "xlsx", filters = {}) {
  return exportAuditReport({
    report: "all",
    format,
    filters,
  });
}

async function exportSecurityAuditReport(format = "xlsx", filters = {}) {
  return exportAuditReport({
    report: "security",
    format,
    filters,
  });
}

async function exportFinanceAuditReport(format = "xlsx", filters = {}) {
  return exportAuditReport({
    report: "finance",
    format,
    filters,
  });
}

module.exports = {
  normalizeFilters,

  createAuditLog,

  getAuditLogs,

  getAdminAuditSummary,
  getSecurityAuditSummary,
  getFinanceAuditSummary,

  getFailedLoginReport,
  getAdminUserActivity,
  getFinanceAuditReport,
  getSecurityAuditReport,
  getSuspiciousSecurityEvents,

  getAuditKpis,

  exportAuditReport,
  exportAdminAuditReport,
  exportSecurityAuditReport,
  exportFinanceAuditReport,
};