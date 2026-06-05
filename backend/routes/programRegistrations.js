// backend/routes/programRegistrations.js
"use strict";

const express = require("express");
const Stripe = require("stripe");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function getJwtSecret() {
  return process.env.JWT_SECRET || "dev_secret";
}

function clean(v, max = 255) {
  return String(v ?? "").trim().slice(0, max);
}

function toId(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      req.user = null;
      return next();
    }

    const payload = jwt.verify(token, getJwtSecret());
    req.user = payload;
    return next();
  } catch {
    req.user = null;
    return next();
  }
}

async function getMemberIdFromUser(userId) {
  if (!userId) return null;

  const [[row]] = await pool.query(
    `SELECT member_id FROM tbl_users WHERE id = ? LIMIT 1`,
    [userId]
  );

  return row?.member_id || null;
}

/**
 * Public/member create registration + Stripe checkout
 */
router.post("/create-checkout", optionalAuth, async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const eventId = toId(req.body.news_event_id || req.body.program_id);
    const fullName = clean(req.body.full_name, 180);
    const email = clean(req.body.email, 190);
    const phone = clean(req.body.phone, 50);
    const quantity = Math.max(1, Number(req.body.quantity || 1));
    const participants = Array.isArray(req.body.participants)
      ? req.body.participants
      : [];

    const successUrl =
      clean(req.body.success_url, 500) ||
      `${req.protocol}://${req.get("host")}/payment-success`;

    const cancelUrl =
      clean(req.body.cancel_url, 500) ||
      `${req.protocol}://${req.get("host")}/payment-cancel`;

    if (!eventId) {
      return res.status(400).json({ error: "Program or trip id is required." });
    }

    if (!fullName || !email) {
      return res.status(400).json({ error: "Full name and email are required." });
    }

    await conn.beginTransaction();

    const [[event]] = await conn.query(
      `
      SELECT
        id,
        category,
        title,
        price_per_person,
        capacity,
        registration_enabled,
        is_published
      FROM tbl_news_events
      WHERE id = ?
      LIMIT 1
      `,
      [eventId]
    );

    if (!event) {
      await conn.rollback();
      return res.status(404).json({ error: "Program or trip not found." });
    }

    if (!["kids", "trip"].includes(event.category)) {
      await conn.rollback();
      return res.status(400).json({ error: "This event is not registerable." });
    }

    if (!Number(event.is_published) || !Number(event.registration_enabled)) {
      await conn.rollback();
      return res.status(400).json({ error: "Registration is not open." });
    }

    const price = Number(event.price_per_person || 0);
    if (!Number.isFinite(price) || price <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: "Program price is not configured." });
    }

    if (event.capacity) {
      const [[usedRow]] = await conn.query(
        `
        SELECT COALESCE(SUM(quantity), 0) AS used
        FROM tbl_event_program_registrations
        WHERE news_event_id = ?
          AND status IN ('pending','paid')
        `,
        [eventId]
      );

      const used = Number(usedRow?.used || 0);
      if (used + quantity > Number(event.capacity)) {
        await conn.rollback();
        return res.status(400).json({ error: "Not enough seats available." });
      }
    }

    const memberId =
      (await getMemberIdFromUser(req.user?.id)) || toId(req.body.member_id);

    const total = Number((price * quantity).toFixed(2));

    const [regResult] = await conn.query(
      `
      INSERT INTO tbl_event_program_registrations
      (
        news_event_id,
        category,
        member_id,
        full_name,
        email,
        phone,
        quantity,
        participants_json,
        price_per_person,
        total_amount,
        status,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `,
      [
        event.id,
        event.category,
        memberId,
        fullName,
        email,
        phone || null,
        quantity,
        JSON.stringify(participants),
        price,
        total,
        clean(req.body.notes, 1000) || null,
      ]
    );

    const registrationId = regResult.insertId;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          quantity,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(price * 100),
            product_data: {
              name: event.title,
              description:
                event.category === "kids"
                  ? "Kids School Program Registration"
                  : "Trip / Outing Registration",
            },
          },
        },
      ],
      metadata: {
        payment_kind: "program_registration",
        registration_id: String(registrationId),
        news_event_id: String(event.id),
        category: event.category === "kids" ? "school" : "trip",
        sub_category: event.title,
        quantity: String(quantity),
        member_id: memberId ? String(memberId) : "",
        full_name: fullName,
        email,
      },
    });

    await conn.query(
      `
      UPDATE tbl_event_program_registrations
      SET stripe_checkout_session_id = ?
      WHERE id = ?
      `,
      [session.id, registrationId]
    );

    await conn.commit();

    return res.json({
      ok: true,
      url: session.url,
      session_id: session.id,
      registration_id: registrationId,
    });
  } catch (err) {
    await conn.rollback();
    console.error("POST /program-registrations/create-checkout error:", err);
    return res.status(500).json({ error: "Failed to create checkout." });
  } finally {
    conn.release();
  }
});
/**
 * Admin registration tracking
 */
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

      /* ========================================
         EXTRA SECURITY
      ======================================== */

      if (

        ![
          "admin",
          "finance",
          "super_admin",
        ].includes(
          req.user?.role
        )
      ) {

        return res.status(403).json({

          error:
            "Access denied.",
        });
      }

      const params = [];
      const where = [];

      /* ========================================
         FILTERS
      ======================================== */

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

        where.push(`
          (
            LOWER(r.full_name) LIKE LOWER(?)
            OR LOWER(r.email) LIKE LOWER(?)
            OR LOWER(r.phone) LIKE LOWER(?)
            OR LOWER(e.title) LIKE LOWER(?)
          )
        `);

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

      /* ========================================
         PAGINATION
      ======================================== */

      const limit =
        Math.min(
          200,
          Number(
            req.query.limit || 50
          )
        );

      const offset =
        Math.max(
          0,
          Number(
            req.query.offset || 0
          )
        );

      /* ========================================
         ROWS
      ======================================== */

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

            r.stripe_checkout_session_id,
            r.stripe_payment_intent_id,

            r.payment_id,

            p.payment_number,

            rc.receipt_number,

            e.capacity,

            (
              SELECT COALESCE(
                SUM(r2.quantity),
                0
              )

              FROM tbl_event_program_registrations r2

              WHERE r2.news_event_id = r.news_event_id
                AND r2.status = 'paid'

            ) AS total_paid_participants,

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

          LIMIT ?
          OFFSET ?
          `,
          [
            ...params,
            limit,
            offset,
          ]
        );

          /* ========================================
         SUMMARY
      ======================================== */

      const [[summary]] =
        await pool.query(
          `
          SELECT

            COUNT(*) AS total,

            SUM(
              CASE
                WHEN r.status = 'paid'
                THEN 1
                ELSE 0
              END
            ) AS paid,

            SUM(
              CASE
                WHEN r.status = 'pending'
                THEN 1
                ELSE 0
              END
            ) AS pending,

            SUM(
              CASE
                WHEN r.status = 'cancelled'
                THEN 1
                ELSE 0
              END
            ) AS cancelled,

            COALESCE(
              SUM(
                CASE
                  WHEN r.status = 'paid'
                  THEN r.total_amount
                  ELSE 0
                END
              ),
              0
            ) AS paidRevenue,

            COALESCE(
              SUM(r.total_amount),
              0
            ) AS totalRevenue

          FROM tbl_event_program_registrations r

          ${whereSql}
          `,
          params
        );

      /* ========================================
         RESPONSE
      ======================================== */

      return res.json({

        ok: true,

        rows,

        summary: {

          total:
            Number(
              summary?.total || 0
            ),

          paid:
            Number(
              summary?.paid || 0
            ),

          pending:
            Number(
              summary?.pending || 0
            ),

          cancelled:
            Number(
              summary?.cancelled || 0
            ),

          paidRevenue:
            Number(
              summary?.paidRevenue || 0
            ),

          totalRevenue:
            Number(
              summary?.totalRevenue || 0
            ),
        },

        pagination: {

          limit,

          offset,

          returned:
            rows.length,
        },
      });

    } catch (err) {

      console.error(
        "GET /program-registrations/admin error:",
        err
      );

      return res.status(500).json({

        ok: false,

        error:
          "Failed to load registrations.",
      });
    }
  }
);

/**
 * Member registrations/payment history
 */
router.get("/member", authRequired, async (req, res) => {
  try {
    const memberId = await getMemberIdFromUser(req.user?.id);

    if (!memberId) return res.json({ ok: true, rows: [] });

    const [rows] = await pool.query(
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
      INNER JOIN tbl_news_events e ON e.id = r.news_event_id
      LEFT JOIN tbl_finance_payments p ON p.id = r.payment_id
      LEFT JOIN tbl_finance_receipts rc ON rc.payment_id = p.id
      WHERE r.member_id = ?
      ORDER BY r.created_at DESC
      `,
      [memberId]
    );

    return res.json({ ok: true, rows });
  } catch (err) {
    console.error("GET /program-registrations/member error:", err);
    return res.status(500).json({ error: "Failed to load member registrations." });
  }
});

module.exports = router;