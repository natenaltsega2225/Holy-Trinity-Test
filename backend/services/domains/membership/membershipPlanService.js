// backend/services/domains/membership/membershipPlanService.js
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
   CREATE PLAN
========================================================= */

async function createMembershipPlan(
  payload = {}
) {

  const conn =
    await pool.getConnection();

  try {

    await conn.beginTransaction();

    const amount =
      money(
        payload.amount
      );

    if (
      amount <= 0
    ) {

      throw new Error(
        "Membership plan amount must be greater than zero."
      );
    }

    const intervalMonths =
      Math.max(
        1,
        Number(
          payload.interval_months || 1
        )
      );

    const planId =
      await insertExistingColumns(

        conn,

        "tbl_membership_plans",

        {

          name:
            clean(
              payload.name,
              180
            ),

          description:
            clean(
              payload.description,
              2000
            ),

          amount,

          currency:
            payload.currency || "USD",
minimum_amount:
  payload.minimum_amount || null,

maximum_amount:
  payload.maximum_amount || null,
          interval_months:
            intervalMonths,

          is_active:
            payload.is_active === false
              ? 0
              : 1,

          allow_auto_renew:
            payload.allow_auto_renew
              ? 1
              : 0,

          max_members:
            payload.max_members || null,

          sort_order:
            Number(
              payload.sort_order || 0
            ),

          created_at:
            mysqlNow(),

          updated_at:
            mysqlNow(),
        }
      );

    await conn.commit();

    return {

      success: true,

      id:
        planId,
    };

  } catch (err) {

    await conn.rollback();

    throw err;

  } finally {

    conn.release();
  }
}

/* =========================================================
   UPDATE PLAN
========================================================= */

async function updateMembershipPlan(

  planId,

  payload = {}
) {

  return updateExistingColumns(

    pool,

    "tbl_membership_plans",

    {

      name:
        payload.name,

      description:
        payload.description,

      amount:
        payload.amount !== undefined

          ? money(
              payload.amount
            )

          : undefined,

      currency:
        payload.currency,

      interval_months:
        payload.interval_months,

      is_active:
        payload.is_active,

      allow_auto_renew:
        payload.allow_auto_renew,

      max_members:
        payload.max_members,

      sort_order:
        payload.sort_order,

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [planId]
  );
}

/* =========================================================
   GET PLAN
========================================================= */

async function getMembershipPlan(
  planId
) {

  return findOne(

    pool,

    `
    SELECT *

    FROM tbl_membership_plans

    WHERE id = ?

    LIMIT 1
    `,

    [planId]
  );
}

/* =========================================================
   LIST ACTIVE PLANS
========================================================= */

async function listActiveMembershipPlans() {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_membership_plans

    WHERE is_active = 1

    ORDER BY
      sort_order ASC,
      amount ASC
    `,

    []
  );
}

/* =========================================================
   LIST ALL PLANS
========================================================= */

async function listMembershipPlans() {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_membership_plans

    ORDER BY
      sort_order ASC,
      amount ASC
    `,

    []
  );
}

/* =========================================================
   DISABLE PLAN
========================================================= */

async function disableMembershipPlan(
  planId
) {

  return updateExistingColumns(

    pool,

    "tbl_membership_plans",

    {

      is_active:
        0,

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [planId]
  );
}

/* =========================================================
   ENABLE PLAN
========================================================= */

async function enableMembershipPlan(
  planId
) {

  return updateExistingColumns(

    pool,

    "tbl_membership_plans",

    {

      is_active:
        1,

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [planId]
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  createMembershipPlan,

  updateMembershipPlan,

  getMembershipPlan,

  listActiveMembershipPlans,

  listMembershipPlans,

  disableMembershipPlan,

  enableMembershipPlan,
};