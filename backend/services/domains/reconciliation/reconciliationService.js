// backend/services/domains/reconciliation/reconciliationService.js
"use strict";

const pool =
  require("../../../db");

const {

  insertExistingColumns,

  updateExistingColumns,

  findOne,

  findMany,

} = require(
  "../../../utils/dbHelpers"
);

const {

  clean,

  money,

  mysqlNow,

} = require(
  "../../../utils/financeHelpers"
);

/* =========================================================
   HELPERS
========================================================= */

function normalizeStatus(
  status
) {

  const allowed = [

    "draft",

    "in_progress",

    "completed",

    "approved",

    "closed",
  ];

  const value =
    String(
      status || "draft"
    ).toLowerCase();

  return allowed.includes(
    value
  )
    ? value
    : "draft";
}

/* =========================================================
   CREATE RECONCILIATION
========================================================= */

async function createReconciliation(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_finance_reconciliations",

    {

      reconciliation_number:
        clean(
          payload.reconciliation_number,
          120
        ),

      period_start:
        payload.period_start,

      period_end:
        payload.period_end,

      status:
        normalizeStatus(
          payload.status
        ),

      notes:
        payload.notes || null,

      created_by:
        payload.created_by || null,

      created_at:
        mysqlNow(),

      updated_at:
        mysqlNow(),
    }
  );
}

/* =========================================================
   UPDATE RECONCILIATION
========================================================= */

async function updateReconciliation(

  reconciliationId,

  payload = {}
) {

  return updateExistingColumns(

    pool,

    "tbl_finance_reconciliations",

    {

      status:
        payload.status
          ? normalizeStatus(
              payload.status
            )
          : undefined,

      notes:
        payload.notes,

      approved_by:
        payload.approved_by,

      approved_at:
        payload.approved_at,

      closed_at:
        payload.closed_at,

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [reconciliationId]
  );
}

/* =========================================================
   GET RECONCILIATION
========================================================= */

async function getReconciliation(
  reconciliationId
) {

  return findOne(

    pool,

    `
    SELECT *

    FROM tbl_finance_reconciliations

    WHERE id = ?

    LIMIT 1
    `,

    [reconciliationId]
  );
}

/* =========================================================
   LIST RECONCILIATIONS
========================================================= */

async function listReconciliations(
  filters = {}
) {

  const params = [];
  const where = [];

  if (
    filters.status
  ) {

    where.push(
      "status = ?"
    );

    params.push(
      normalizeStatus(
        filters.status
      )
    );
  }

  const whereSql =
    where.length

      ? `WHERE ${where.join(" AND ")}`

      : "";

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_finance_reconciliations

    ${whereSql}

    ORDER BY
      period_start DESC,
      id DESC
    `,

    params
  );
}

/* =========================================================
   CREATE ITEM
========================================================= */

async function createReconciliationItem(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_finance_reconciliation_items",

    {

      reconciliation_id:
        payload.reconciliation_id,

      item_type:
        clean(
          payload.item_type,
          80
        ),

      source_type:
        clean(
          payload.source_type,
          80
        ),

      source_id:
        payload.source_id || null,

      transaction_date:
        payload.transaction_date || null,

      amount:
        money(
          payload.amount
        ),

      description:
        payload.description || null,

      status:
        clean(
          payload.status ||
          "unmatched",
          80
        ),

      matched_reference:
        payload.matched_reference || null,

      notes:
        payload.notes || null,

      created_at:
        mysqlNow(),

      updated_at:
        mysqlNow(),
    }
  );
}

/* =========================================================
   MATCH ITEM
========================================================= */

async function matchReconciliationItem(

  itemId,

  payload = {}
) {

  return updateExistingColumns(

    pool,

    "tbl_finance_reconciliation_items",

    {

      status:
        "matched",

      matched_reference:
        payload.matched_reference,

      matched_at:
        mysqlNow(),

      matched_by:
        payload.matched_by || null,

      notes:
        payload.notes,

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [itemId]
  );
}

/* =========================================================
   GET UNMATCHED ITEMS
========================================================= */

async function getUnmatchedItems(
  reconciliationId
) {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_finance_reconciliation_items

    WHERE reconciliation_id = ?
      AND status != 'matched'

    ORDER BY
      transaction_date ASC,
      id ASC
    `,

    [reconciliationId]
  );
}

/* =========================================================
   RECONCILIATION SUMMARY
========================================================= */

async function getReconciliationSummary(
  reconciliationId
) {

  const summary =
    await findOne(

      pool,

      `
      SELECT

        COUNT(*) AS total_items,

        SUM(
          CASE
            WHEN status = 'matched'
            THEN 1
            ELSE 0
          END
        ) AS matched_items,

        SUM(
          CASE
            WHEN status != 'matched'
            THEN 1
            ELSE 0
          END
        ) AS unmatched_items,

        COALESCE(
          SUM(amount),
          0
        ) AS total_amount

      FROM tbl_finance_reconciliation_items

      WHERE reconciliation_id = ?
      `,

      [reconciliationId]
    );

  return {

    total_items:
      Number(
        summary?.total_items || 0
      ),

    matched_items:
      Number(
        summary?.matched_items || 0
      ),

    unmatched_items:
      Number(
        summary?.unmatched_items || 0
      ),

    total_amount:
      money(
        summary?.total_amount || 0
      ),
  };
}

/* =========================================================
   AUTO IMPORT PAYMENTS
========================================================= */

async function importPaymentsToReconciliation(
  reconciliationId
) {

  const payments =
    await findMany(

      pool,

      `
      SELECT

        id,
        amount,
        paid_at,
        payment_number,
        category

      FROM tbl_finance_payments

      WHERE status = 'paid'
      `,

      []
    );

  for (const p of payments) {

    await createReconciliationItem({

      reconciliation_id:
        reconciliationId,

      item_type:
        "payment",

      source_type:
        "finance_payment",

      source_id:
        p.id,

      transaction_date:
        p.paid_at,

      amount:
        p.amount,

      description:
        `${p.category} - ${p.payment_number}`,

      status:
        "unmatched",
    });
  }

  return {

    success: true,

    imported:
      payments.length,
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  createReconciliation,

  updateReconciliation,

  getReconciliation,

  listReconciliations,

  createReconciliationItem,

  matchReconciliationItem,

  getUnmatchedItems,

  getReconciliationSummary,

  importPaymentsToReconciliation,
};