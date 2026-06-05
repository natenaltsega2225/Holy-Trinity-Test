// backend/services/domains/payments/unifiedPaymentService.js
"use strict";

const crypto =
  require("crypto");

const pool =
  require("../../../db");

const {

  insertExistingColumns,

  findOne,

  findMany,

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

  createInvoice,

} = require(
  "../invoices/invoiceService"
);

const {

  createReceipt,

} = require(
  "../receipts/receiptService"
);

const {

  createLedgerEntry,

} = require(
  "../ledger/ledgerService"
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
const DONATION_CATEGORIES = [

  "plate_collection",

  "candle_sale",

  "general_donation",

  "tithe",

  "vows",

  "baptism",

  "wedding_engagement",

  "memorial_service",

  "pledge",

  "building_fund",

  "charity_fund",

  "auction",

  "other_fund",

  "sunday_cash_collection",
];
/* =========================================================
   HELPERS
========================================================= */

function paymentNumber() {

  return `PAY-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

function normalizeCategory(
  value
) {

  const allowed = [

    "membership",

    "donation",

    "school",

    "trip",

    "pledge",

    "sunday_collection",
  ];

  const category =
    String(
      value || ""
    ).toLowerCase();

  return allowed.includes(
    category
  )
    ? category
    : "donation";
}

function normalizeMethod(
  value
) {

  const allowed = [

    "cash",

    "check",

    "zelle",

    "card",

    "ach",

    "manual",
  ];

  const method =
    String(
      value || ""
    ).toLowerCase();

  return allowed.includes(
    method
  )
    ? method
    : "manual";
}

/* =========================================================
   CREATE PAYMENT
========================================================= */

async function createUnifiedPayment(
  payload = {}
) {

  const conn =
    await pool.getConnection();

  try {

    await conn.beginTransaction();

    const amount =
      Number(
        payload.amount || 0
      );

    if (
      amount <= 0
    ) {

      throw new Error(
        "Amount must be greater than zero."
      );
    }

    /* =====================================
       MEMBER
    ===================================== */

    let member = null;

    if (
      payload.member_id
    ) {

      member =
        await findOne(

          conn,

          `
          SELECT *

          FROM tbl_members

          WHERE id = ?

          LIMIT 1
          `,

          [payload.member_id]
        );
    }

    /* =====================================
       PAYMENT
    ===================================== */

    const paymentResult =
      await insertExistingColumns(

        conn,

        "tbl_finance_payments",

        {

          payment_number:
            paymentNumber(),

          member_id:
            payload.member_id || null,

          category:
            normalizeCategory(
              payload.category
            ),

          sub_category:
            nullable(
              payload.sub_category,
              255
            ),

          payment_method:
            normalizeMethod(
              payload.payment_method
            ),

          provider:
            clean(
              payload.provider ||
              "manual",
              100
            ),

          full_name_snapshot:
            clean(

              payload.full_name ||

              member?.full_name ||

              "Guest",

              255
            ),

          email_snapshot:
            nullable(

              payload.email ||

              member?.email,

              255
            ),

          phone_snapshot:
            nullable(

              payload.phone ||

              member?.phone,

              100
            ),

          amount,

          quantity:
            Number(
              payload.quantity || 1
            ),

          status:
            clean(
              payload.status ||
              "paid",
              50
            ),

          paid_at:
            mysqlNow(),

          notes:
            nullable(
              payload.notes,
              5000
            ),

          reference_no:
            nullable(
              payload.reference_no,
              255
            ),

          created_by:
            payload.created_by || null,

          created_at:
            mysqlNow(),

          updated_at:
            mysqlNow(),
        }
      );

    const paymentId =
      paymentResult.insertId;

    /* =====================================
       INVOICE
    ===================================== */

    const invoice =
      await createInvoice({

        member_id:
          payload.member_id || null,

        invoice_type:
          payload.category,

        total_amount:
          amount,

        balance_due: 0,

        status: "paid",

        full_name_snapshot:

          payload.full_name ||

          member?.full_name,

        created_by:
          payload.created_by,
      });

    /* =====================================
       RECEIPT
    ===================================== */

    const receipt =
      await createReceipt({

        payment_id:
          paymentId,

        member_id:
          payload.member_id || null,

        invoice_id:
          invoice?.id || null,

        amount,

        email:
          payload.email ||

          member?.email,
      });

    /* =====================================
       LEDGER
    ===================================== */

    await createLedgerEntry({

      member_id:
        payload.member_id || null,

      entry_type:
        "payment",

      debit: 0,

      credit:
        amount,

      description:
        `
        ${payload.category}
        payment
        `.trim(),

      reference_id:
        paymentId,
    });

    /* =====================================
       MEMBERSHIP
    ===================================== */

    if (
      payload.category ===
      "membership"
    ) {

      await updateMembershipCoverage({

        conn,

        member_id:
          payload.member_id,

        months_paid:
          Number(
            payload.months_paid || 1
          ),
      });
    }

    /* =====================================
       ACTIVITY
    ===================================== */

    await createActivity({

      activity_type:
        "payment",

      severity:
        "success",

      title:
        "Payment Received",

      message:
        `
        ${amount}
        payment recorded.
        `.trim(),

      member_id:
        payload.member_id,

      user_id:
        payload.created_by,
    });

    /* =====================================
       EMAIL
    ===================================== */

    if (
      receipt &&
      (
        payload.send_receipt !==
        false
      )
    ) {

      try {

        await sendEmail({

          to:
            payload.email ||

            member?.email,

          subject:
            "Payment Receipt",

          html:
            `
            <h2>
              Payment Receipt
            </h2>

            <p>
              Amount:
              $${amount.toFixed(2)}
            </p>

            <p>
              Payment Number:
              ${
                paymentResult.payment_number ||
                ""
              }
            </p>
            `,
        });

      } catch (e2) {

        console.error(
          "receipt email error:",
          e2
        );
      }
    }

    await conn.commit();

    return {

      id:
        paymentId,

      payment_id:
        paymentId,

      invoice,

      receipt,

      amount,

      category:
        payload.category,
    };

  } catch (err) {

    await conn.rollback();

    console.error(
      "createUnifiedPayment error:",
      err
    );

    throw err;

  } finally {

    conn.release();
  }
}

/* =========================================================
   MEMBERSHIP COVERAGE
========================================================= */

async function updateMembershipCoverage({

  conn,

  member_id,

  months_paid = 1,
}) {

  if (!member_id) {

    return;
  }

  const member =
    await findOne(

      conn,

      `
      SELECT *

      FROM tbl_members

      WHERE id = ?

      LIMIT 1
      `,

      [member_id]
    );

  if (!member) {

    return;
  }

  const current =
    member.membership_expires_at

      ? new Date(
          member.membership_expires_at
        )

      : new Date();

  current.setMonth(
    current.getMonth() +
    Number(months_paid || 1)
  );

  await conn.query(
    `
    UPDATE tbl_members

    SET

      membership_status = 'active',

      membership_expires_at = ?,

      updated_at = NOW()

    WHERE id = ?
    `,

    [current, member_id]
  );
}

/* =========================================================
   GET PAYMENT
========================================================= */

async function getPaymentById(
  paymentId
) {

  return findOne(

    pool,

    `
    SELECT *

    FROM tbl_finance_payments

    WHERE id = ?

    LIMIT 1
    `,

    [paymentId]
  );
}

/* =========================================================
   LIST PAYMENTS
========================================================= */

async function listPayments(
  filters = {}
) {

  const where = [];
  const params = [];

  if (
    filters.member_id
  ) {

    where.push(
      "member_id = ?"
    );

    params.push(
      filters.member_id
    );
  }

  if (
    filters.category
  ) {

    where.push(
      "category = ?"
    );

    params.push(
      filters.category
    );
  }

  if (
    filters.status
  ) {

    where.push(
      "status = ?"
    );

    params.push(
      filters.status
    );
  }

  const whereSql =
    where.length

      ? `WHERE ${where.join(" AND ")}`

      : "";

  const limit =
    Math.min(
      5000,
      Math.max(
        1,
        Number(filters.limit || 100)
      )
    );

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_finance_payments

    ${whereSql}

    ORDER BY
      paid_at DESC,
      id DESC

    LIMIT ?
    `,

    [...params, limit]
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  createUnifiedPayment,

  updateMembershipCoverage,

  getPaymentById,

  listPayments,
};