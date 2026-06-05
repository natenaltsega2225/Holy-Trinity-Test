"use strict";

const pool = require("../db");

const {
  clean,
  money,
  mysqlNow,
} = require("../utils/financeHelpers");

const {
  processSuccessfulPayment,
  sendReceiptForPayment,
} = require("../services/paymentService");

/* =========================================================
   HELPERS
========================================================= */

function normalizeMethod(
  value
) {

  const v = clean(
    value,
    40
  ).toLowerCase();

  if (
    [
      "cash",
      "check",
      "zelle",
    ].includes(v)
  ) {
    return v;
  }

  return "cash";
}

/* =========================================================
   CREATE MANUAL DONATION
========================================================= */

async function createManualDonation(
  req,
  res
) {

  const conn =
    await pool.getConnection();

  try {

    await conn.beginTransaction();

    const donorType =
      clean(
        req.body.donor_type ||
        "non_member",
        40
      );

    const memberId =
      donorType ===
      "member"

        ? Number(
            req.body.member_id || 0
          ) || null

        : null;

    const fullName =
      clean(
        req.body.full_name,
        180
      );

    const email =
      clean(
        req.body.email,
        190
      );

    const phone =
      clean(
        req.body.phone,
        50
      );

    const donationCategory =
      clean(
        req.body.donation_category,
        120
      );

    if (
      !donationCategory
    ) {

      return res.status(400).json({

        error:
          "Donation category is required.",
      });
    }

    const amount =
      money(
        req.body.amount
      );

    if (amount <= 0) {

      return res.status(400).json({

        error:
          "Invalid donation amount.",
      });
    }

    const method =
      normalizeMethod(
        req.body.method
      );

    const paymentResult =
      await processSuccessfulPayment(
        conn,
        {

          member_id:
            memberId,

          full_name:
            fullName,

          email,

          phone,

          amount,

          payment_type:
            "donation",

          category:
            "donation",

          sub_category:
            donationCategory,

          donation_category:
            donationCategory,

          method,

          provider:
            "manual",

          reference_no:
            clean(
              req.body.reference_no,
              120
            ),

          note:
            clean(
              req.body.note,
              1000
            ),

          status:
            "paid",

          paid_at:
            mysqlNow(),
        }
      );

    await conn.commit();

    /* =====================================
       SEND RECEIPT EMAIL
    ===================================== */

    if (email) {

      sendReceiptForPayment(
        paymentResult
      ).catch(
        console.error
      );
    }

    return res.json({

      ok: true,

      message:
        "Donation recorded successfully.",

      payment:
        paymentResult,
    });

  } catch (err) {

    try {

      await conn.rollback();

    } catch {}

    console.error(
      "createManualDonation error:",
      err
    );

    return res.status(500).json({

      error:
        err.message ||

        "Failed to create donation.",
    });

  } finally {

    conn.release();
  }
}

module.exports = {

  createManualDonation,
};