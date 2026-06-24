//backend/services/domains/pledge/pledgeAuditService.js
"use strict";

const pool = require("../../../db");

/* =========================================================
   CONFIG
========================================================= */

const AUDIT_TABLES = [
  "tbl_finance_audit_logs",
  "tbl_audit_logs",
  "audit_logs",
];

/* =========================================================
   HELPERS
========================================================= */

const tableCache = new Map();
const columnCache = new Map();

function clean(value) {
  return String(value ?? "").trim();
}

function safeJson(value) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "{}";
  }
}

async function tableExists(conn, tableName) {
  if (tableCache.has(tableName)) {
    return tableCache.get(tableName);
  }

  try {
    const [rows] = await conn.query(
      `SHOW TABLES LIKE ?`,
      [tableName]
    );

    const exists = rows.length > 0;

    tableCache.set(tableName, exists);

    return exists;
  } catch {
    tableCache.set(tableName, false);
    return false;
  }
}

async function getColumns(conn, tableName) {
  if (columnCache.has(tableName)) {
    return columnCache.get(tableName);
  }

  const exists = await tableExists(conn, tableName);

  if (!exists) {
    const empty = new Set();
    columnCache.set(tableName, empty);
    return empty;
  }

  const [rows] = await conn.query(
    `SHOW COLUMNS FROM \`${tableName}\``
  );

  const cols = new Set(
    rows.map((r) => r.Field)
  );

  columnCache.set(tableName, cols);

  return cols;
}

async function getAuditTable(conn) {
  for (const table of AUDIT_TABLES) {
    if (await tableExists(conn, table)) {
      return table;
    }
  }

  return null;
}

async function insertDynamic(
  conn,
  tableName,
  payload
) {
  const cols =
    await getColumns(
      conn,
      tableName
    );

  const entries =
    Object.entries(payload)
      .filter(
        ([key, value]) =>
          cols.has(key) &&
          value !== undefined
      );

  if (!entries.length) {
    return null;
  }

  const fields =
    entries
      .map(
        ([key]) =>
          `\`${key}\``
      )
      .join(", ");

  const marks =
    entries
      .map(() => "?")
      .join(", ");

  const values =
    entries.map(
      ([, value]) => value
    );

  const [result] =
    await conn.query(
      `
      INSERT INTO \`${tableName}\`
      (${fields})
      VALUES (${marks})
      `,
      values
    );

  return result.insertId;
}

/* =========================================================
   CORE AUDIT WRITER
========================================================= */

async function createAuditLog({
  actorId = null,
  actorName = null,
  actorRole = null,

  entityType,
  entityId,
  entityNumber = null,

  action,
  description,

  beforeData = null,
  afterData = null,

  metadata = {},

  ipAddress = null,
  userAgent = null,
}) {
  const conn =
    await pool.getConnection();

  try {
    const auditTable =
      await getAuditTable(conn);

    if (!auditTable) {
      return null;
    }

    const auditId =
      await insertDynamic(
        conn,
        auditTable,
        {
          module:
            "finance_pledges",

          category:
            "pledge",

          entity_type:
            entityType,

          entity_id:
            entityId,

          entity_number:
            entityNumber,

          action,

          description,

          actor_id:
            actorId,

          actor_name:
            actorName,

          actor_role:
            actorRole,

          old_values:
            safeJson(
              beforeData
            ),

          new_values:
            safeJson(
              afterData
            ),

          metadata:
            safeJson(
              metadata
            ),

          ip_address:
            ipAddress,

          user_agent:
            userAgent,

          created_at:
            new Date(),
        }
      );

    return auditId;
  } finally {
    conn.release();
  }
}

/* =========================================================
   PLEDGE EVENTS
========================================================= */

async function logPledgeCreated(
  pledge,
  user = {},
  requestInfo = {}
) {
  return createAuditLog({
    actorId:
      user.id,

    actorName:
      user.name,

    actorRole:
      user.role,

    entityType:
      "pledge",

    entityId:
      pledge.id,

    entityNumber:
      pledge.pledge_number,

    action:
      "pledge_created",

    description:
      `Created pledge ${pledge.pledge_number}`,

    afterData:
      pledge,

    metadata: {
      campaign_id:
        pledge.campaign_id,

      pledged_amount:
        pledge.pledged_amount,
    },

    ipAddress:
      requestInfo.ip,

    userAgent:
      requestInfo.userAgent,
  });
}

async function logPledgeUpdated(
  beforeData,
  afterData,
  user = {},
  requestInfo = {}
) {
  return createAuditLog({
    actorId:
      user.id,

    actorName:
      user.name,

    actorRole:
      user.role,

    entityType:
      "pledge",

    entityId:
      afterData.id,

    entityNumber:
      afterData.pledge_number,

    action:
      "pledge_updated",

    description:
      `Updated pledge ${afterData.pledge_number}`,

    beforeData,
    afterData,

    ipAddress:
      requestInfo.ip,

    userAgent:
      requestInfo.userAgent,
  });
}

/* =========================================================
   PAYMENT EVENTS
========================================================= */

async function logPaymentApplied({
  pledge,
  payment,
  invoice,
  receipt,
  user = {},
  requestInfo = {},
}) {
  return createAuditLog({
    actorId:
      user.id,

    actorName:
      user.name,

    actorRole:
      user.role,

    entityType:
      "pledge_payment",

    entityId:
      payment.id,

    entityNumber:
      payment.payment_number,

    action:
      "payment_applied",

    description:
      `Payment ${payment.payment_number} applied to pledge ${pledge.pledge_number}`,

    afterData: {
      payment,
      invoice,
      receipt,
    },

    metadata: {
      pledge_id:
        pledge.id,

      amount:
        payment.amount,
    },

    ipAddress:
      requestInfo.ip,

    userAgent:
      requestInfo.userAgent,
  });
}

/* =========================================================
   INVOICE EVENTS
========================================================= */

async function logInvoiceGenerated({
  pledge,
  invoice,
  user = {},
  requestInfo = {},
}) {
  return createAuditLog({
    actorId:
      user.id,

    actorName:
      user.name,

    actorRole:
      user.role,

    entityType:
      "invoice",

    entityId:
      invoice.id,

    entityNumber:
      invoice.invoice_number,

    action:
      "invoice_generated",

    description:
      `Invoice ${invoice.invoice_number} generated`,

    afterData:
      invoice,

    metadata: {
      pledge_id:
        pledge.id,
    },

    ipAddress:
      requestInfo.ip,

    userAgent:
      requestInfo.userAgent,
  });
}

/* =========================================================
   RECEIPT EVENTS
========================================================= */

async function logReceiptGenerated({
  pledge,
  receipt,
  user = {},
  requestInfo = {},
}) {
  return createAuditLog({
    actorId:
      user.id,

    actorName:
      user.name,

    actorRole:
      user.role,

    entityType:
      "receipt",

    entityId:
      receipt.id,

    entityNumber:
      receipt.receipt_number,

    action:
      "receipt_generated",

    description:
      `Receipt ${receipt.receipt_number} generated`,

    afterData:
      receipt,

    metadata: {
      pledge_id:
        pledge.id,
    },

    ipAddress:
      requestInfo.ip,

    userAgent:
      requestInfo.userAgent,
  });
}

/* =========================================================
   REMINDER EVENTS
========================================================= */

async function logReminderSent({
  pledge,
  email,
  subject,
  status,
  user = {},
}) {
  return createAuditLog({
    actorId:
      user.id,

    actorName:
      user.name,

    actorRole:
      user.role,

    entityType:
      "pledge_reminder",

    entityId:
      pledge.id,

    entityNumber:
      pledge.pledge_number,

    action:
      "reminder_sent",

    description:
      `Reminder sent for pledge ${pledge.pledge_number}`,

    metadata: {
      email,
      subject,
      status,
    },
  });
}

/* =========================================================
   WRITE OFF EVENTS
========================================================= */

async function logWriteOff({
  pledge,
  reason,
  user = {},
  requestInfo = {},
}) {
  return createAuditLog({
    actorId:
      user.id,

    actorName:
      user.name,

    actorRole:
      user.role,

    entityType:
      "pledge",

    entityId:
      pledge.id,

    entityNumber:
      pledge.pledge_number,

    action:
      "pledge_writeoff",

    description:
      `Pledge ${pledge.pledge_number} written off`,

    metadata: {
      reason,
      amount:
        pledge.remaining_balance,
    },

    ipAddress:
      requestInfo.ip,

    userAgent:
      requestInfo.userAgent,
  });
}

/* =========================================================
   CANCEL EVENTS
========================================================= */

async function logPledgeCancelled({
  pledge,
  reason,
  user = {},
  requestInfo = {},
}) {
  return createAuditLog({
    actorId:
      user.id,

    actorName:
      user.name,

    actorRole:
      user.role,

    entityType:
      "pledge",

    entityId:
      pledge.id,

    entityNumber:
      pledge.pledge_number,

    action:
      "pledge_cancelled",

    description:
      `Pledge ${pledge.pledge_number} cancelled`,

    metadata: {
      reason,
    },

    ipAddress:
      requestInfo.ip,

    userAgent:
      requestInfo.userAgent,
  });
}

/* =========================================================
   REPORTING
========================================================= */

async function getAuditHistory(
  entityType,
  entityId
) {
  const conn =
    await pool.getConnection();

  try {
    const auditTable =
      await getAuditTable(conn);

    if (!auditTable) {
      return [];
    }

    const [rows] =
      await conn.query(
        `
        SELECT *
        FROM \`${auditTable}\`
        WHERE entity_type = ?
          AND entity_id = ?
        ORDER BY created_at DESC
        `,
        [
          entityType,
          entityId,
        ]
      );

    return rows;
  } finally {
    conn.release();
  }
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  createAuditLog,

  logPledgeCreated,
  logPledgeUpdated,

  logPaymentApplied,

  logInvoiceGenerated,
  logReceiptGenerated,

  logReminderSent,

  logWriteOff,
  logPledgeCancelled,

  getAuditHistory,
};