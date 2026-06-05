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
   HELPERS
========================================================= */

function clean(
  value
) {

  return String(
    value ?? ""
  ).trim();
}

function normalizeType(
  value
) {

  const v =
    clean(value)
      .toLowerCase();

  if (
    [
      "membership",
      "dues",
    ].includes(v)
  ) {
    return "membership";
  }

  if (
    [
      "school",
      "kids",
    ].includes(v)
  ) {
    return "school";
  }

  if (
    [
      "trip",
    ].includes(v)
  ) {
    return "trip";
  }

  return v;
}

/* =========================================================
   CREATE IN-PERSON PAYMENT
========================================================= */

router.post(
  "/",

  async (req, res) => {

    const conn =
      await pool.getConnection();

    try {

      const {

        member_id,

        payment_type,

        sub_category,

        amount,

        payment_method,

        months_paid,

        quantity,

        reference_no,

        notes,
      } = req.body || {};

      /* =====================================
         VALIDATION
      ===================================== */

      if (!member_id) {

        return res.status(400).json({

          error:
            "member_id is required.",
        });
      }

      if (
        !amount ||
        Number(amount) <= 0
      ) {

        return res.status(400).json({

          error:
            "Invalid payment amount.",
        });
      }

      if (
        ![
          "cash",
          "check",
          "zelle",
          "card",
        ].includes(
          payment_method
        )
      ) {

        return res.status(400).json({

          error:
            "Invalid payment method.",
        });
      }

      /* =====================================
         MEMBER
      ===================================== */

      const [[member]] =
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

      if (!member) {

        return res.status(404).json({

          error:
            "Member not found.",
        });
      }

      const type =
        normalizeType(
          payment_type
        );

      /* =====================================
         TRANSACTION
      ===================================== */

      await conn.beginTransaction();

      const result =
        await processSuccessfulPayment(
          conn,
          {

            member_id:
              member.id,

            member_no:
              member.member_no,

            full_name:
              member.full_name,

            email:
              member.email,

            phone:
              member.phone,

            payment_type:
              type,

            category:
              type,

            sub_category:
              sub_category || null,

            amount:
              Number(amount),

            quantity:
              Number(
                quantity || 1
              ),

            months_paid:
              Number(
                months_paid || 1
              ),

            currency:
              "USD",

            method:
              payment_method,

            provider:
              payment_method === "card"
                ? "stripe_terminal"
                : "manual",

            status:
              "paid",

            reference_no:
              reference_no || null,

            notes:
              notes || null,

            description:
              `Finance in-person ${type} payment`,

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
          "Payment processed successfully.",

        result,
      });

    } catch (err) {

      try {

        await conn.rollback();

      } catch {}

      console.error(
        "POST /in-person-payments error:",
        err
      );

      return res.status(500).json({

        error:
          err.message ||
          "Failed to process payment.",
      });

    } finally {

      conn.release();
    }
  }
);

module.exports =
  router;