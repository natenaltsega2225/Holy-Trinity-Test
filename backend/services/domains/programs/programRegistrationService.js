//backend\services\domains\programs\programRegistrationService.js
"use strict";

const express = require("express");
const jwt = require("jsonwebtoken");

const pool = require("../../../db");

const {
  authRequired,
  requireRole,
} = require("../../../middleware/auth");

const {
  clean,
} = require("../../../utils/financeHelpers");

const {
  buildSchoolPaymentPayload,
} = require(
  "../../domains/programs/schoolPaymentService.js"
);

const {
  buildTripPaymentPayload,
} = require(
  "../../domains/programs/tripPaymentService"
);

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

function jwtSecret() {

  return (
    process.env.JWT_SECRET ||
    "dev_secret"
  );
}

function optionalAuth(
  req,
  _res,
  next
) {

  try {

    const header =
      req.headers.authorization ||
      "";

    const token =
      header.startsWith(
        "Bearer "
      )
        ? header.slice(7)
        : null;

    req.user = token
      ? jwt.verify(
          token,
          jwtSecret()
        )
      : null;

  } catch {

    req.user = null;
  }

  next();
}

async function getMemberIdFromUser(
  userId
) {

  if (!userId) {
    return null;
  }

  const [[row]] =
    await pool.query(
      `
      SELECT member_id

      FROM tbl_users

      WHERE id = ?

      LIMIT 1
      `,
      [userId]
    );

  return (
    row?.member_id ||
    null
  );
}

/* =========================================================
   CREATE PROGRAM PAYMENT PAYLOAD
========================================================= */

router.post(
  "/create-checkout",

  optionalAuth,

  async (req, res) => {

    try {

      const category =
        clean(
          req.body.category ||
          req.body.type ||
          "",
          40
        ).toLowerCase();

      if (
        ![
          "kids",
          "school",
          "trip",
        ].includes(category)
      ) {

        return res.status(400).json({

          error:
            "Invalid program category.",
        });
      }

      const memberId =
        (
          await getMemberIdFromUser(
            req.user?.id
          )
        ) ||

        Number(
          req.body.member_id || 0
        ) ||

        null;

      const payload = {

        ...req.body,

        member_id:
          memberId,
      };

      let result = null;

      /* ========================================
         SCHOOL
      ======================================== */

      if (
        category === "kids" ||

        category === "school"
      ) {

        result =
          await buildSchoolPaymentPayload(
            payload
          );
      }

      /* ========================================
         TRIP
      ======================================== */

      else if (
        category === "trip"
      ) {

        result =
          await buildTripPaymentPayload(
            payload
          );
      }

      return res.json({

        ok: true,

        registration_id:
          result.registration_id,

        payment_payload:
          result.payment_payload,
      });

    } catch (err) {

      console.error(
        "POST /program-registrations/create-checkout error:",
        err
      );

      return res.status(500).json({

        error:
          err.message ||

          "Failed to create registration.",
      });
    }
  }
);

/* =========================================================
   ADMIN REGISTRATIONS
========================================================= */

router.get(
  "/admin",

  authRequired,

  requireRole(
    "admin",
    "finance",
    "super_admin"
  ),

  async (req, res) => {

    try {

      const params = [];
      const where = [];

      if (
        req.query.category &&
        req.query.category !== "all"
      ) {

        where.push(
          "r.category = ?"
        );

        params.push(
          req.query.category
        );
      }

      if (
        req.query.status &&
        req.query.status !== "all"
      ) {

        where.push(
          "r.status = ?"
        );

        params.push(
          req.query.status
        );
      }

      if (req.query.search) {

        const like =
          `%${clean(
            req.query.search
          )}%`;

        where.push(
          `
          (
            r.full_name LIKE ?
            OR r.email LIKE ?
            OR r.phone LIKE ?
            OR e.title LIKE ?
          )
          `
        );

        params.push(
          like,
          like,
          like,
          like
        );
      }

      const whereSql =
        where.length
          ? `WHERE ${where.join(
              " AND "
            )}`
          : "";

      const [rows] =
        await pool.query(
          `
          SELECT

            r.id,
            r.news_event_id,

            e.title AS program_title,

            r.category,

            r.full_name,
            r.email,
            r.phone,

            r.quantity,

            r.participants_json,

            r.price_per_person,
            r.total_amount,

            r.status,

            r.payment_id,

            p.payment_number,

            rc.receipt_number,

            r.created_at

          FROM tbl_event_program_registrations r

          INNER JOIN tbl_news_events e
            ON e.id = r.news_event_id

          LEFT JOIN tbl_finance_payments p
            ON p.id = r.payment_id

          LEFT JOIN tbl_finance_receipts rc
            ON rc.payment_id = p.id

          ${whereSql}

          ORDER BY r.created_at DESC

          LIMIT 300
          `,
          params
        );

      return res.json({
        ok: true,
        rows,
      });

    } catch (err) {

      console.error(
        "GET /program-registrations/admin error:",
        err
      );

      return res.status(500).json({

        error:
          "Failed to load registrations.",
      });
    }
  }
);

/* =========================================================
   MEMBER HISTORY
========================================================= */

router.get(
  "/member",

  authRequired,

  async (req, res) => {

    try {

      const memberId =
        await getMemberIdFromUser(
          req.user?.id
        );

      if (!memberId) {

        return res.json({
          ok: true,
          rows: [],
        });
      }

      const [rows] =
        await pool.query(
          `
          SELECT

            r.id,
            r.news_event_id,

            e.title AS program_title,

            r.category,

            r.quantity,

            r.price_per_person,
            r.total_amount,

            r.status,

            r.created_at,

            p.payment_number,

            rc.receipt_number

          FROM tbl_event_program_registrations r

          INNER JOIN tbl_news_events e
            ON e.id = r.news_event_id

          LEFT JOIN tbl_finance_payments p
            ON p.id = r.payment_id

          LEFT JOIN tbl_finance_receipts rc
            ON rc.payment_id = p.id

          WHERE r.member_id = ?

          ORDER BY r.created_at DESC
          `,
          [memberId]
        );

      return res.json({
        ok: true,
        rows,
      });

    } catch (err) {

      console.error(
        "GET /program-registrations/member error:",
        err
      );

      return res.status(500).json({

        error:
          "Failed to load registrations.",
      });
    }
  }
);

module.exports = router;