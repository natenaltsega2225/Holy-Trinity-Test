// backend/services/domains/membership/membershipRegistrationService.js
"use strict";

const argon2 = require("argon2");
const crypto =
  require("crypto");

const pool =
  require("../../../db");

const {

  insertExistingColumns,

  findOne,

  updateExistingColumns,

} = require(
  "../../../utils/dbHelpers"
);

const {

  clean,

  nullable,

  mysqlNow,

} = require(
  "../../../utils/financeHelpers"
);

const {

  createUnifiedPayment,

} = require(
  "../payments/unifiedPaymentService"
);



const {

  createActivity,

} = require(
  "../activity/activityFeedService"
);

const {

  sendEmail,

} = require(
  "../notifications/notificationService"
);

/* =========================================================
   HELPERS
========================================================= */

function generatePassword() {

  return crypto
    .randomBytes(6)
    .toString("hex");
}

function memberNumber() {

  return `HT-${Date.now()}`;
}

function usernameFromEmail(
  email
) {

  return String(
    email || ""
  )
    .split("@")[0]
    .toLowerCase();
}

/* =========================================================
   CREATE USER ACCOUNT
========================================================= */

async function createMemberUser(
  payload = {}
) {

  /* =====================================
     EXISTING USER
  ===================================== */

  const existing =
    await findOne(

      pool,

      `
      SELECT
        id,
        username,
        email
      FROM tbl_users
      WHERE LOWER(email) = LOWER(?)
      LIMIT 1
      `,

      [payload.email]
    );

  if (existing) {

    return {

      existing: true,

      user_id:
        existing.id,

      username:
        existing.username,

      raw_password:
        null,
    };
  }

  /* =====================================
     ENTERPRISE PASSWORD
  ===================================== */

  const rawPassword =
    generatePassword();

  /* =====================================
     ARGON2 HASH
  ===================================== */

  const passwordHash =
    await argon2.hash(
      rawPassword,
      {
        type:
          argon2.argon2id,

        memoryCost:
          19456,

        timeCost:
          2,

        parallelism:
          1,
      }
    );

  /* =====================================
     USERNAME
  ===================================== */

  const username =
    usernameFromEmail(
      payload.email
    );

  /* =====================================
     INSERT USER
  ===================================== */

  const result =
    await insertExistingColumns(

      pool,

      "tbl_users",

      {

        member_id:
          payload.member_id ||
          null,

        full_name:
          clean(
            payload.full_name,
            255
          ),

        username,

        email:
          clean(
            payload.email,
            255
          ),

        phone:
          nullable(
            payload.phone,
            100
          ),

        password_hash:
          passwordHash,

        role:
          "member",

        is_active:
          1,

        must_change_password:
          1,

        email_verified:
          1,

        created_at:
          mysqlNow(),

        updated_at:
          mysqlNow(),
      }
    );

  /* =====================================
     SUCCESS
  ===================================== */

  return {

    existing: false,

    user_id:
      result.insertId,

    username,

    raw_password:
      rawPassword,
  };
}
/* =========================================================
   CREATE MEMBER PROFILE
========================================================= */

async function createMemberProfile(
  payload = {}
) {

  const result =
    await insertExistingColumns(

      pool,

      "tbl_members",

      {

        user_id:
          payload.user_id,

        member_no:
          memberNumber(),

        full_name:
          clean(
            payload.full_name,
            255
          ),

        baptismal_name:
          nullable(
            payload.baptismal_name,
            255
          ),

        email:
          clean(
            payload.email,
            255
          ),

        phone:
          nullable(
            payload.phone,
            100
          ),

        gender:
          nullable(
            payload.gender,
            50
          ),

        marital_status:
          nullable(
            payload.marital_status,
            50
          ),

        address:
          nullable(
            payload.address,
            1000
          ),

        city:
          nullable(
            payload.city,
            255
          ),

        state:
          nullable(
            payload.state,
            255
          ),

        zip_code:
          nullable(
            payload.zip_code,
            50
          ),

        household_role:
          nullable(
            payload.household_role,
            100
          ),

        membership_status:
          "active",

        joined_at:
          mysqlNow(),

        created_at:
          mysqlNow(),

        updated_at:
          mysqlNow(),
      }
    );

  return result.insertId;
}

/* =========================================================
   CREATE DEPENDENT
========================================================= */

async function createDependentMember(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_member_dependents",

    {

      member_id:
        payload.member_id,

      full_name:
        clean(
          payload.full_name,
          255
        ),

      relationship:
        nullable(
          payload.relationship,
          100
        ),

      birth_date:
        payload.birth_date || null,

      gender:
        nullable(
          payload.gender,
          50
        ),

      created_at:
        mysqlNow(),

      updated_at:
        mysqlNow(),
    }
  );
}

/* =========================================================
   REGISTER MEMBER
========================================================= */

async function registerMember(
  payload = {}
) {

  const conn =
    await pool.getConnection();

  try {

    await conn.beginTransaction();

    /* =====================================
       USER ACCOUNT
    ===================================== */

    const user =
      await createMemberUser(
        payload
      );

    /* =====================================
       MEMBER PROFILE
    ===================================== */

    const memberId =
      await createMemberProfile({

        ...payload,

        user_id:
          user.user_id,
      });

    /* =====================================
       DEPENDENTS
    ===================================== */

    if (
      Array.isArray(
        payload.dependents
      )
    ) {

      for (const dep of payload.dependents) {

        await createDependentMember({

          member_id:
            memberId,

          ...dep,
        });
      }
    }

    /* =====================================
       MEMBERSHIP COVERAGE
    ===================================== */

    // if (
    //   Number(
    //     payload.months_paid || 0
    //   ) > 0
    // ) {

    //   await createMembershipCoverage({

    //     member_id:
    //       memberId,

    //     months:
    //       Number(
    //         payload.months_paid
    //       ),

    //     amount:
    //       Number(
    //         payload.amount || 0
    //       ),

    //     membership_plan:
    //       payload.membership_plan,

    //     membership_frequency:
    //       payload.membership_frequency,

    //     payment_method:
    //       payload.payment_method,

    //     payment_provider:
    //       payload.provider ||
    //       "manual",

    //     created_by:
    //       payload.created_by,
    //   });
    // }

    /* =====================================
       INITIAL PAYMENT
    ===================================== */

  let payment = null;

if (
  Number(
    payload.amount || 0
  ) > 0
) {

  payment =
    await createUnifiedPayment({

      category:
        "membership",

      payment_type:
        "membership",

      sub_category:
        payload.membership_plan,

      member_id:
        memberId,

      full_name:
        payload.full_name,

      email:
        payload.email,

      phone:
        payload.phone,

      amount:
        Number(
          payload.amount || 0
        ),

      months_paid:
        Number(
          payload.months_paid || 1
        ),

      duration_months:
        Number(
          payload.months_paid || 1
        ),

      interval_count:
        Number(
          payload.months_paid || 1
        ),

      interval_unit:
        "month",

      payment_method:
        payload.payment_method ||
        "cash",

      provider:
        payload.provider ||
        "manual",

      created_by:
        payload.created_by,

      notes:
        payload.notes,
    });
}
    /* =====================================
       ACTIVITY
    ===================================== */

    await createActivity({

      activity_type:
        "member_registration",

      severity:
        "success",

      title:
        "Member Registered",

      message:
        `
        ${payload.full_name}
        registered successfully.
        `.trim(),

      member_id:
        memberId,

      user_id:
        payload.created_by,
    });

    /* =====================================
       WELCOME EMAIL
    ===================================== */

    try {

      if (
        payload.email
      ) {

        await sendEmail({

          to:
            payload.email,

          subject:
            "Welcome to Holy Trinity",

          html:
            `
            <h2>
              Welcome
              ${payload.full_name}
            </h2>

            <p>
              Your account has been created.
            </p>

            <p>
              Email:
              ${payload.email}
            </p>

            ${
              user.raw_password

                ? `
                <p>
                  Temporary Password:
                  ${user.raw_password}
                </p>
                `

                : ""
            }
            `,
        });
      }

    } catch (e2) {

      console.error(
        "welcome email error:",
        e2
      );
    }

    await conn.commit();

    return {

      success: true,

      member_id:
        memberId,

      user_id:
        user.user_id,

      payment,
    };

  } catch (err) {

    await conn.rollback();

    console.error(
      "registerMember error:",
      err
    );

    throw err;

  } finally {

    conn.release();
  }
}

/* =========================================================
   ACTIVATE MEMBER
========================================================= */

async function activateMember(
  memberId
) {

  await updateExistingColumns(

    pool,

    "tbl_members",

    {

      membership_status:
        "active",

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [memberId]
  );

  return true;
}

/* =========================================================
   SUSPEND MEMBER
========================================================= */

async function suspendMember(
  memberId,
  reason = null
) {

  await updateExistingColumns(

    pool,

    "tbl_members",

    {

      membership_status:
        "suspended",

      suspension_reason:
        reason,

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [memberId]
  );

  return true;
}

/* =========================================================
   GET MEMBER PROFILE
========================================================= */

async function getMemberProfile(
  memberId
) {

  return findOne(

    pool,

    `
    SELECT *

    FROM tbl_members

    WHERE id = ?

    LIMIT 1
    `,

    [memberId]
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  createMemberUser,

  createMemberProfile,

  createDependentMember,

  registerMember,

  activateMember,

  suspendMember,

  getMemberProfile,
};