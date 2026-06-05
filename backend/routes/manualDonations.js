"use strict";

const express =
  require("express");

const pool =
  require("../db");

const {

  authRequired,
  requireRole,

} = require(
  "../middleware/auth"
);

const {

  processSuccessfulPayment,

} = require(
  "../services/paymentService"
);

const router =
  express.Router();

/* =========================================================
   SECURITY
========================================================= */

router.use(
  authRequired
);

router.use(

  requireRole(
    "finance",
    "admin",
    "super_admin"
  )
);

/* =========================================================
   DONATION CATEGORIES
========================================================= */

const VALID_CATEGORIES = [

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

function clean(
  value
) {

  return String(
    value ?? ""
  ).trim();
}

function isEmail(
  value
) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(
      clean(value)
    );
}

/* =========================================================
   CREATE MANUAL DONATION
========================================================= */

router.post(
  "/",

  async (req, res) => {

    const conn =
      await pool.getConnection();

    try {

      const {

        member_id,

        donor_type,

        full_name,

        email,

        phone,

        donation_category,

        amount,

        payment_method,

        reference_no,

        notes,
      } = req.body || {};

      /* =====================================
         VALIDATION
      ===================================== */

      if (
        !VALID_CATEGORIES.includes(
          donation_category
        )
      ) {

        return res.status(400).json({

          error:
            "Invalid donation category.",
        });
      }

      if (
        !amount ||
        Number(amount) <= 0
      ) {

        return res.status(400).json({

          error:
            "Invalid amount.",
        });
      }

      if (
        ![
          "cash",
          "check",
          "zelle",
        ].includes(
          payment_method
        )
      ) {

        return res.status(400).json({

          error:
            "Invalid payment method.",
        });
      }

      if (
        email &&
        !isEmail(email)
      ) {

        return res.status(400).json({

          error:
            "Invalid email address.",
        });
      }

      /* =====================================
         MEMBER LOOKUP
      ===================================== */

      let member =
        null;

      if (member_id) {

        const [[row]] =
          await conn.query(
            `
            SELECT
              id,
              member_no,
              full_name,
              email,
              phone
            FROM tbl_members
            WHERE id = ?
            LIMIT 1
            `,
            [member_id]
          );

        if (!row) {

          return res.status(404).json({

            error:
              "Member not found.",
          });
        }

        member = row;
      }

      /* =====================================
         PAYMENT FLOW
      ===================================== */

      await conn.beginTransaction();

      const result =
        await processSuccessfulPayment(
          conn,
          {

            member_id:
              member?.id || null,

            member_no:
              member?.member_no || null,

            full_name:
              member?.full_name ||
              full_name,

            email:
              member?.email ||
              email,

            phone:
              member?.phone ||
              phone,

            payment_type:
              "donation",

            category:
              "donation",

            sub_category:
              donation_category,

            amount:
              Number(amount),

            quantity:
              1,

            currency:
              "USD",

            method:
              payment_method,

            provider:
              "manual",

            status:
              "paid",

            reference_no:
              reference_no || null,

            notes:
              notes || null,

            description:
              `Manual donation - ${donation_category}`,

            created_by:
              req.user?.id || null,

            paid_at:
              new Date(),
          }
        );

      await conn.commit();

      return res.json({

        ok: true,

        message:
          "Donation recorded successfully.",

        result,
      });

    } catch (err) {

      try {

        await conn.rollback();

      } catch {}

      console.error(
        "POST /manual-donations error:",
        err
      );

      return res.status(500).json({

        error:
          err.message ||
          "Failed to process donation.",
      });

    } finally {

      conn.release();
    }
  }
);

module.exports =
  router;