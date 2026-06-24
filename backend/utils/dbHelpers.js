// backend/utils/dbHelpers.js
"use strict";

/* -------------------------------------------------------------------------- */
/* Identifier Safety                                                          */
/* -------------------------------------------------------------------------- */

const columnCache = new Map();

function cleanObject(payload = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
}

function assertIdentifier(value, label = "identifier") {
  const text = String(value || "").trim();

  if (!/^[A-Za-z0-9_]+$/.test(text)) {
    throw new Error(`Invalid SQL ${label}: ${text}`);
  }

  return text;
}

function quoteIdentifier(value) {
  return `\`${assertIdentifier(value)}\``;
}

function cacheKey(table) {
  return assertIdentifier(table, "table");
}

/* -------------------------------------------------------------------------- */
/* Columns                                                                    */
/* -------------------------------------------------------------------------- */

async function getTableColumns(conn, table) {
  const key = cacheKey(table);

  if (columnCache.has(key)) {
    return columnCache.get(key);
  }

  const [columns] = await conn.query(`SHOW COLUMNS FROM ${quoteIdentifier(key)}`);

  const set = new Set(columns.map((column) => column.Field));
  columnCache.set(key, set);

  return set;
}

function clearColumnCache(table = null) {
  if (table) {
    columnCache.delete(cacheKey(table));
    return;
  }

  columnCache.clear();
}

async function filterExistingColumns(conn, table, payload = {}) {
  const data = cleanObject(payload);
  const columns = await getTableColumns(conn, table);

  return Object.fromEntries(
    Object.entries(data).filter(([key]) => columns.has(key))
  );
}

async function hasColumn(conn, table, column) {
  const columns = await getTableColumns(conn, table);
  return columns.has(column);
}

/* -------------------------------------------------------------------------- */
/* Insert / Update                                                            */
/* -------------------------------------------------------------------------- */

async function insertExistingColumns(conn, table, payload = {}) {
  const tableName = assertIdentifier(table, "table");
  const filteredData = await filterExistingColumns(conn, tableName, payload);
  const keys = Object.keys(filteredData);

  if (!keys.length) {
    throw new Error(`insertExistingColumns(${tableName}) empty payload`);
  }

  const sql = `
    INSERT INTO ${quoteIdentifier(tableName)}
    (${keys.map(quoteIdentifier).join(", ")})
    VALUES (${keys.map(() => "?").join(", ")})
  `;

  const values = keys.map((key) => filteredData[key]);

  if (process.env.DEBUG_DB_HELPERS === "true") {
    console.log("DB INSERT", {
      table: tableName,
      keys,
    });
  }

  const [result] = await conn.query(sql, values);

  return result.insertId;
}

async function updateExistingColumns(
  conn,
  table,
  payload = {},
  whereClause = "",
  whereParams = []
) {
  const tableName = assertIdentifier(table, "table");
  const filteredData = await filterExistingColumns(conn, tableName, payload);
  const keys = Object.keys(filteredData);

  if (!keys.length) {
    return 0;
  }

  if (!whereClause) {
    throw new Error(`updateExistingColumns(${tableName}) missing where clause`);
  }

  const setSql = keys.map((key) => `${quoteIdentifier(key)} = ?`).join(", ");

  const sql = `
    UPDATE ${quoteIdentifier(tableName)}
    SET ${setSql}
    WHERE ${whereClause}
  `;

  const values = [
    ...keys.map((key) => filteredData[key]),
    ...whereParams,
  ];

  const [result] = await conn.query(sql, values);

  return result.affectedRows;
}

async function upsertExistingColumns(
  conn,
  table,
  payload = {},
  updatePayload = null
) {
  const tableName = assertIdentifier(table, "table");
  const insertData = await filterExistingColumns(conn, tableName, payload);
  const insertKeys = Object.keys(insertData);

  if (!insertKeys.length) {
    throw new Error(`upsertExistingColumns(${tableName}) empty payload`);
  }

  const updateData = await filterExistingColumns(
    conn,
    tableName,
    updatePayload || payload
  );

  const updateKeys = Object.keys(updateData).filter((key) => key !== "id");

  const sql = `
    INSERT INTO ${quoteIdentifier(tableName)}
    (${insertKeys.map(quoteIdentifier).join(", ")})
    VALUES (${insertKeys.map(() => "?").join(", ")})
    ON DUPLICATE KEY UPDATE
    ${
      updateKeys.length
        ? updateKeys
            .map((key) => `${quoteIdentifier(key)} = VALUES(${quoteIdentifier(key)})`)
            .join(", ")
        : `${quoteIdentifier(insertKeys[0])} = ${quoteIdentifier(insertKeys[0])}`
    }
  `;

  const [result] = await conn.query(
    sql,
    insertKeys.map((key) => insertData[key])
  );

  return result.insertId || result.affectedRows;
}

/* -------------------------------------------------------------------------- */
/* Query Helpers                                                              */
/* -------------------------------------------------------------------------- */

async function findOne(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows[0] || null;
}

async function findMany(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

async function exists(conn, sql, params = []) {
  const row = await findOne(conn, sql, params);
  return Boolean(row);
}

async function countRows(conn, sql, params = []) {
  const row = await findOne(conn, sql, params);
  return Number(row?.total || row?.count || 0);
}

/* -------------------------------------------------------------------------- */
/* Transactions                                                               */
/* -------------------------------------------------------------------------- */

async function withTransaction(pool, callback) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const result = await callback(conn);

    await conn.commit();

    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      console.error("Transaction rollback failed:", rollbackErr);
    }

    throw err;
  } finally {
    conn.release();
  }
}

/* -------------------------------------------------------------------------- */
/* Pagination                                                                 */
/* -------------------------------------------------------------------------- */

function buildPagination({ page = 1, limit = 25, total = 0 } = {}) {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.min(500, Math.max(1, Number(limit || 25)));
  const safeTotal = Number(total || 0);

  return {
    page: safePage,
    limit: safeLimit,
    total: safeTotal,
    pages: Math.ceil(safeTotal / safeLimit),
    offset: (safePage - 1) * safeLimit,
  };
}

function limitOffsetSql(pagination = {}) {
  const limit = Math.min(500, Math.max(1, Number(pagination.limit || 25)));
  const offset = Math.max(0, Number(pagination.offset || 0));

  return {
    sql: " LIMIT ? OFFSET ? ",
    params: [limit, offset],
  };
}

module.exports = {
  cleanObject,

  assertIdentifier,
  quoteIdentifier,

  getTableColumns,
  clearColumnCache,
  filterExistingColumns,
  hasColumn,

  insertExistingColumns,
  updateExistingColumns,
  upsertExistingColumns,

  findOne,
  findMany,
  exists,
  countRows,

  withTransaction,

  buildPagination,
  limitOffsetSql,
};