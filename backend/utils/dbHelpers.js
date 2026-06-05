// backend/utils/dbHelpers.js
"use strict";

/*
=========================================================
 ENTERPRISE DB HELPERS
---------------------------------------------------------
 Centralized reusable DB utilities
=========================================================
*/

/* =========================================================
   HELPERS
========================================================= */

function cleanObject(
  payload = {}
) {

  return Object.fromEntries(

    Object.entries(payload)
      .filter(

        ([, value]) =>

          value !== undefined
      )
  );
}

/* =========================================================
   INSERT EXISTING COLUMNS
========================================================= */

async function insertExistingColumns(
  conn,
  table,
  payload = {}
) {
  const data = cleanObject(payload);

  /* =========================================
     LOAD REAL TABLE COLUMNS
  ========================================= */

  const [columns] = await conn.query(`
    SHOW COLUMNS FROM ${table}
  `);

  const allowedColumns = new Set(
    columns.map((c) => c.Field)
  );

  /* =========================================
     FILTER ONLY VALID COLUMNS
  ========================================= */

  const filteredData = Object.fromEntries(
    Object.entries(data).filter(
      ([key]) => allowedColumns.has(key)
    )
  );

  const keys = Object.keys(filteredData);

  if (!keys.length) {
    throw new Error(
      `insertExistingColumns(${table}) empty payload`
    );
  }

  /* =========================================
     BUILD INSERT
  ========================================= */

  const placeholders = keys
    .map(() => "?")
    .join(", ");

  const sql = `
    INSERT INTO ${table}
    (${keys.join(", ")})
    VALUES (${placeholders})
  `;

  const values = keys.map(
    (k) => filteredData[k]
  );

  /* =========================================
     DEBUG LOGGING
  ========================================= */

  console.log(
    `DB INSERT -> ${table}`
  );

  console.log({
    keys,
  });

  /* =========================================
     EXECUTE
  ========================================= */

  const [result] = await conn.query(
    sql,
    values
  );

  return result.insertId;
}
/* =========================================================
   UPDATE EXISTING COLUMNS
========================================================= */

async function updateExistingColumns(

  conn,

  table,

  payload = {},

  whereClause = "",

  whereParams = []
) {

  const data =
    cleanObject(payload);

  const keys =
    Object.keys(data);

  if (!keys.length) {

    return 0;
  }

  if (!whereClause) {

    throw new Error(
      `updateExistingColumns(${table}) missing where clause`
    );
  }

  const setSql =
    keys
      .map(
        (key) => `${key} = ?`
      )
      .join(", ");

  const sql = `
    UPDATE ${table}
    SET ${setSql}
    WHERE ${whereClause}
  `;

  const values = [

    ...keys.map(
      (k) => data[k]
    ),

    ...whereParams,
  ];

  const [result] =
    await conn.query(
      sql,
      values
    );

  return result.affectedRows;
}

/* =========================================================
   FIND ONE
========================================================= */

async function findOne(

  conn,

  sql,

  params = []
) {

  const [rows] =
    await conn.query(
      sql,
      params
    );

  return rows[0] || null;
}

/* =========================================================
   FIND MANY
========================================================= */

async function findMany(

  conn,

  sql,

  params = []
) {

  const [rows] =
    await conn.query(
      sql,
      params
    );

  return rows;
}

/* =========================================================
   EXISTS
========================================================= */

async function exists(

  conn,

  sql,

  params = []
) {

  const row =
    await findOne(
      conn,
      sql,
      params
    );

  return !!row;
}

/* =========================================================
   PAGINATION
========================================================= */

function buildPagination({

  page = 1,

  limit = 25,

  total = 0,
}) {

  const safePage =
    Math.max(
      1,
      Number(page || 1)
    );

  const safeLimit =
    Math.max(
      1,
      Number(limit || 25)
    );

  return {

    page:
      safePage,

    limit:
      safeLimit,

    total:
      Number(total || 0),

    pages:
      Math.ceil(
        Number(total || 0) /
        safeLimit
      ),

    offset:
      (safePage - 1) *
      safeLimit,
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  cleanObject,

  insertExistingColumns,

  updateExistingColumns,

  findOne,
  findMany,

  exists,

  buildPagination,
};